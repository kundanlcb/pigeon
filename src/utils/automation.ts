import { useStore, type FlowNode, type FlowEdge, type RequestItem } from '../store';


export interface FlowRunResult {
  nodeId: string;
  requestId: string;
  requestName: string;
  status: 'success' | 'error' | 'pending';
  statusCode?: number;
  timeMs?: number;
  error?: string;
  data?: any;
  headers?: Record<string, string>;
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

  try {
    const { executeRequest } = await import('./engine');
    const envId = useStore.getState().activeEnvironmentId;
    const environment = useStore.getState().environments.find(e => e.id === envId);
    
    const result = await executeRequest({
      request,
      environment,
      localVars: flowVariables,
      onLog,
      saveSecretsToEnvironment: true
    });
    
    // PIGEON-111: Process variable extractions
    if (node.data?.extractions && node.data.extractions.length > 0) {
      for (const ext of node.data.extractions) {
        let extractedVal: any = undefined;
        
        if (ext.source === 'header') {
          // Headers are case-insensitive, we'll try to match exact or lowercase
          const headers = result.headers || {};
          const lowerPath = ext.path.toLowerCase();
          const key = Object.keys(headers).find(k => k.toLowerCase() === lowerPath);
          if (key) {
            extractedVal = headers[key];
          }
        } else {
          // Body extraction
          if (result.data) {
            if (ext.path === '') {
              extractedVal = result.data;
            } else {
              // Simple JSONPath resolver for dot and bracket notation
              const parts = ext.path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
              let curr = result.data;
              let found = true;
              for (const p of parts) {
                if (curr && typeof curr === 'object' && p in curr) {
                  curr = curr[p];
                } else {
                  found = false;
                  break;
                }
              }
              if (found) {
                extractedVal = curr;
              }
            }
          }
        }

        if (extractedVal !== undefined) {
          flowVariables[ext.variableName] = typeof extractedVal === 'object' ? JSON.stringify(extractedVal) : String(extractedVal);
          onLog(`[Extraction] Extracted variable '${ext.variableName}' from ${ext.source} path '${ext.path}'`);
        } else {
          throw new Error(`\`{{${ext.variableName}}}\` — field '${ext.path}' not found in Step '${request.name}' response`);
        }
      }
    }

    const testError = result.testResults.filter(t => !t.passed).length > 0 
      ? `Tests failed: ${result.testResults.filter(t => !t.passed).length}` 
      : '';

    return {
      nodeId: node.id,
      requestId: request.id,
      requestName: request.name,
      status: (result.status >= 200 && result.status < 300 && !testError) ? 'success' : 'error',
      statusCode: result.status,
      timeMs: result.timeMs,
      error: testError || (result.status >= 200 && result.status < 300 ? undefined : `HTTP ${result.status}: ${result.error || result.statusText}`),
      data: result.data,
      headers: result.headers
    };
  } catch (error: any) {
    return {
      nodeId: node.id,
      requestId: request.id,
      requestName: request.name,
      status: 'error',
      timeMs: 0,
      error: error.message || String(error)
    };
  }
}
