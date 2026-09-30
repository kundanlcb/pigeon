import { useStore, type FlowNode, type FlowEdge, type RequestItem } from '../store';
import { resolveEnvVariables } from './env';
import { runPreRequestScript, runTestScript, type PigeonContext } from './sandbox';
import { getEnabledRequestHeaders, prepareRequestBody } from './request';
import { removeDisabledQueryParams, setQueryParams } from './url';
import { fetch } from '@tauri-apps/plugin-http';
import { resolveOAuth2ClientCredentials } from './oauth';

export interface FlowRunResult {
  nodeId: string;
  requestId: string;
  requestName: string;
  status: 'success' | 'error';
  statusCode?: number;
  timeMs?: number;
  error?: string;
}

export function topologicalSort(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const inDegree: Record<string, number> = {};
  const adjList: Record<string, string[]> = {};

  nodes.forEach(n => {
    inDegree[n.id] = 0;
    adjList[n.id] = [];
  });

  edges.forEach(e => {
    if (inDegree[e.target] !== undefined) {
      inDegree[e.target]++;
      if (!adjList[e.source]) adjList[e.source] = [];
      adjList[e.source].push(e.target);
    }
  });

  const queue: string[] = [];
  Object.keys(inDegree).forEach(id => {
    if (inDegree[id] === 0) queue.push(id);
  });

  const sorted: FlowNode[] = [];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const node = nodes.find(n => n.id === currentId);
    if (node) sorted.push(node);

    (adjList[currentId] || []).forEach(neighbor => {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    });
  }

  // If there's a cycle, sorted.length !== nodes.length. We just return sorted (will miss cyclic nodes)
  // or we could append the remaining. For now, just return what we could sort.
  return sorted;
}

/**
 * Organizes flow nodes into parallel stages/levels according to DAG dependency resolution.
 * All nodes within a single stage have their prerequisites met and can be executed concurrently.
 */
export function getFlowExecutionStages(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[][] {
  const inDegree: Record<string, number> = {};
  const adjList: Record<string, string[]> = {};

  nodes.forEach(n => {
    inDegree[n.id] = 0;
    adjList[n.id] = [];
  });

  edges.forEach(e => {
    if (inDegree[e.target] !== undefined && inDegree[e.source] !== undefined) {
      inDegree[e.target]++;
      adjList[e.source].push(e.target);
    }
  });

  const stages: FlowNode[][] = [];
  let currentStageIds = Object.keys(inDegree).filter(id => inDegree[id] === 0);
  const processed = new Set<string>();

  while (currentStageIds.length > 0) {
    const stageNodes = currentStageIds
      .map(id => nodes.find(n => n.id === id)!)
      .filter(Boolean);

    stages.push(stageNodes);
    stageNodes.forEach(n => processed.add(n.id));

    const nextStageIds: string[] = [];
    for (const id of currentStageIds) {
      for (const neighbor of adjList[id] || []) {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          nextStageIds.push(neighbor);
        }
      }
    }
    currentStageIds = nextStageIds;
  }

  // Cover any remaining disconnected or cyclical nodes as a fallback stage
  if (processed.size < nodes.length) {
    const remaining = nodes.filter(n => !processed.has(n.id));
    if (remaining.length > 0) {
      stages.push(remaining);
    }
  }

  return stages;
}

export async function executeRequestNode(
  node: FlowNode, 
  onLog: (msg: string) => void,
  flowVariables: Record<string, string> = {}
): Promise<FlowRunResult> {
  const state = useStore.getState();
  const reqId = node.data?.requestId;
  if (!reqId) {
    return { nodeId: node.id, requestId: '', requestName: 'Unknown', status: 'error', error: 'No request selected' };
  }

  let request: RequestItem | null = null;
  for (const c of state.collections) {
    const found = c.requests.find(r => r.id === reqId);
    if (found) { request = found; break; }
  }

  if (!request) {
    return { nodeId: node.id, requestId: reqId, requestName: 'Unknown', status: 'error', error: 'Request not found' };
  }
  const startTime = performance.now();

  try {
    const context: PigeonContext = {
      env: {
        get: (key: string) => {
          if (flowVariables[key] !== undefined) return flowVariables[key];
          const env = useStore.getState().environments.find(e => e.id === useStore.getState().activeEnvironmentId);
          return env?.variables.find(v => v.key === key)?.value;
        },
        set: (key: string, value: string) => {
          flowVariables[key] = value; // Always save to local flow state
          const envId = useStore.getState().activeEnvironmentId;
          if (!envId) return; // But also sync to environment if one is active
          const env = useStore.getState().environments.find(e => e.id === envId);
          if (!env) return;
          const newVars = [...env.variables];
          const idx = newVars.findIndex(v => v.key === key);
          if (idx >= 0) newVars[idx] = { ...newVars[idx], value };
          else newVars.push({ id: `var-${Date.now()}`, key, value, enabled: true });
          useStore.getState().updateEnvironment(envId, { variables: newVars });
        }
      },
      request: {
        url: removeDisabledQueryParams(request.url, request.disabledParams),
        method: request.method,
        headers: getEnabledRequestHeaders(request),
        body: request.body
      },
      response: undefined
    };

    if (request.preRequestScript) {
      const allVars: Record<string, string> = {};
      const envId = useStore.getState().activeEnvironmentId;
      const envObj = useStore.getState().environments.find(e => e.id === envId);
      if (envObj) {
        for (const v of envObj.variables) {
          allVars[v.key] = v.secret ? (await import('./secrets').then(m => m.getSecret(envId!, v.key)) || '') : v.value;
        }
      }
      await runPreRequestScript(request.preRequestScript, context, allVars);
      onLog(`[Pre-request] Executed script successfully`);
    }

    // Refresh active environment in case pre-request script modified it
    const freshState = useStore.getState();
    const freshEnv = freshState.environments.find(e => e.id === freshState.activeEnvironmentId);

    let finalHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(context.request.headers)) {
      finalHeaders[resolveEnvVariables(k, freshEnv, flowVariables)] = resolveEnvVariables(v as string, freshEnv, flowVariables);
    }

    let finalUrl = resolveEnvVariables(context.request.url, freshEnv, flowVariables);
    const resolvedRequest = { ...request, body: context.request.body };
    const { body: finalBody, headers: bodyHeaders } = prepareRequestBody(resolvedRequest, freshEnv, flowVariables);
    for (const [k, v] of Object.entries(bodyHeaders)) finalHeaders[k] = v as string;

    if (request.auth) {
      if (request.auth.type === 'bearer' && request.auth.bearerToken) {
        finalHeaders['Authorization'] = `Bearer ${resolveEnvVariables(request.auth.bearerToken, freshEnv, flowVariables)}`;
      } else if (request.auth.type === 'basic' && (request.auth.basicUsername || request.auth.basicPassword)) {
        const user = resolveEnvVariables(request.auth.basicUsername || '', freshEnv, flowVariables);
        const pass = resolveEnvVariables(request.auth.basicPassword || '', freshEnv, flowVariables);
        finalHeaders['Authorization'] = `Basic ${btoa(`${user}:${pass}`)}`;
      } else if (request.auth.type === 'api_key' && request.auth.apiKeyKey) {
        const key = resolveEnvVariables(request.auth.apiKeyKey, freshEnv, flowVariables);
        const val = resolveEnvVariables(request.auth.apiKeyValue || '', freshEnv, flowVariables);
        if (request.auth.apiKeyIn === 'query') {
          finalUrl = setQueryParams(finalUrl, { [key]: val });
        } else {
          finalHeaders[key] = val;
        }
      } else if (request.auth.type === 'oauth2_client_credentials') {
        const oauthRes = await resolveOAuth2ClientCredentials({
          auth: request.auth,
          activeEnvironment: freshEnv,
          localVars: flowVariables
        });
        finalHeaders['Authorization'] = `Bearer ${oauthRes.accessToken}`;
      }
    }

    // Pigeon doesn't have queryParams in RequestItem yet. We extract them from the URL if needed, 
    // but url already contains them. So no queryParams logic here.

    const appSettings = useStore.getState().appSettings;
    const dangerOptions = appSettings?.insecureSSL ? { acceptInvalidCerts: true, acceptInvalidHostnames: true } : undefined;

    const response = await fetch(finalUrl, {
      method: context.request.method,
      headers: finalHeaders,
      body: finalBody as any,
      connectTimeout: appSettings?.requestTimeout,
      maxRedirections: appSettings?.maxRedirects,
      ...(dangerOptions ? { danger: dangerOptions } : {})
    });

    const responseBuffer = await response.arrayBuffer();
    let responseText = '';
    try { responseText = new TextDecoder().decode(responseBuffer); } catch (e) {}

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((val, key) => { responseHeaders[key] = val; });

    context.response = {
      status: response.status,
      headers: responseHeaders,
      text: () => responseText,
      json: () => {
        try { return JSON.parse(responseText); } catch (e) { return null; }
      }
    };

    let testError = '';
    if (request.testScript) {
      const allVars: Record<string, string> = {};
      const envId = useStore.getState().activeEnvironmentId;
      const envObj = useStore.getState().environments.find(e => e.id === envId);
      envObj?.variables.forEach(v => {
        allVars[v.key] = v.value; // Secrets shouldn't strictly be needed after response, but we might need them. Let's keep it simple for tests or load via promise if needed.
      });
      const results = await runTestScript(request.testScript, context, allVars);
      onLog(`[Test] Ran ${results.length} tests`);
      const failed = results.filter((r: any) => !r.passed);
      if (failed.length > 0) {
        testError = `Tests failed: ${failed.length}`;
      }
    }

    return {
      nodeId: node.id,
      requestId: request.id,
      requestName: request.name,
      status: response.ok && !testError ? 'success' : 'error',
      statusCode: response.status,
      timeMs: Math.round(performance.now() - startTime),
      error: testError || (response.ok ? undefined : `HTTP ${response.status}`)
    };

  } catch (error: any) {
    return {
      nodeId: node.id,
      requestId: request.id,
      requestName: request.name,
      status: 'error',
      timeMs: Math.round(performance.now() - startTime),
      error: error.message || String(error)
    };
  }
}
