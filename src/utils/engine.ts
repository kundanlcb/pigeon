import { useStore, type RequestItem, type Environment } from '../store';
import { runPreRequestScript, type PigeonContext } from './sandbox';
import { getResponseStatusText } from './request';
import { formatPigeonError } from './errors';
import { setSecret } from './secrets';
import { invoke } from '@tauri-apps/api/core';

export interface RequestExecutionOptions {
  request: RequestItem;
  environment?: Environment;
  localVars?: Record<string, string>;
  onLog?: (msg: string) => void;
  signal?: AbortSignal;
  saveSecretsToEnvironment?: boolean; // App.tsx saves to env, RunnerView/Automation often don't save back unless it's a persistent var
}

export interface RequestExecutionResult {
  status: number;
  statusText: string;
  timeMs: number;
  headers: Record<string, string>;
  data: any;
  rawText: string;
  testResults: any[];
  isBinary?: boolean;
  sizeBytes?: number;
  isTruncated?: boolean;
  dnsTimeMs?: number;
  connectTimeMs?: number;
  ttfbTimeMs?: number;
  error?: string;
  isCancelled?: boolean;
}

export async function executeRequest(options: RequestExecutionOptions): Promise<RequestExecutionResult> {
  const { request, environment, onLog, saveSecretsToEnvironment = false } = options;
  const localVars = options.localVars || {};
  const pendingSecretWrites = new Map<string, string>();
  
  const startTime = performance.now();

  try {
    const context: PigeonContext = {
      env: {
        get: (key: string) => {
          const v = environment?.variables.find(variable => variable.key === key);
          if (v && v.secret) return localVars[key];
          return v ? v.value : localVars[key];
        },
        set: (key: string, value: string) => {
          localVars[key] = value;
          if (!environment) return;
          const existing = environment.variables.find(variable => variable.key === key);
          if (existing) {
            if (existing.secret) {
              pendingSecretWrites.set(key, value);
            } else if (saveSecretsToEnvironment) {
              const newVars = environment.variables.map(variable => variable.key === key ? { ...variable, value } : variable);
              useStore.getState().updateEnvironment(environment.id, { variables: newVars });
            }
          } else if (saveSecretsToEnvironment) {
            const secret = /token|secret/i.test(key);
            const newVars = [...environment.variables, {
              id: `var-${Date.now()}-${Math.random()}`,
              key,
              value: secret ? '' : value,
              enabled: true,
              secret,
              secretStored: secret ? false : undefined
            }];
            if (secret) {
              pendingSecretWrites.set(key, value);
            }
            useStore.getState().updateEnvironment(environment.id, { variables: newVars });
          }
        }
      },
      request: {
        headers: { ...request.headers },
        url: request.url,
        method: request.method,
        body: typeof request.body === 'string' ? request.body : JSON.stringify(request.body)
      }
    };

    if (request.preRequestScript) {
      const allVars: Record<string, string> = { ...localVars };
      environment?.variables.forEach(v => {
        if (!allVars[v.key]) {
          allVars[v.key] = v.secret ? (localVars[v.key] || '') : v.value;
        }
      });
      await runPreRequestScript(request.preRequestScript, context, allVars);
      // Sync mutated context back to request object for rust invocation
      request.url = context.request.url;
      request.method = context.request.method as any;
      request.headers = context.request.headers;
      
      if (onLog) onLog('[Pre-request] Executed script successfully');
    }

    const flushSecretWrites = async () => {
      if (!environment || !saveSecretsToEnvironment) return;
      for (const [key, value] of pendingSecretWrites) {
        await setSecret(environment.id, key, value);
        localVars[key] = value;
        pendingSecretWrites.delete(key);
        const state = useStore.getState();
        const freshEnv = state.environments.find(item => item.id === environment.id);
        const variable = freshEnv?.variables.find(item => item.key === key && item.secret);
        if (freshEnv && variable && variable.secretStored !== true) {
          state.updateEnvironment(freshEnv.id, {
            variables: freshEnv.variables.map(item => item.id === variable.id ? { ...item, secretStored: true } : item)
          });
        }
      }
    };
    
    await flushSecretWrites();

    const rawSettings = useStore.getState().appSettings;
    const settings = rawSettings ? {
      insecureSsl: (rawSettings as any).insecureSsl ?? (rawSettings as any).insecureSSL ?? true,
      requestTimeout: rawSettings.requestTimeout ?? 30000,
      maxRedirects: rawSettings.maxRedirects ?? 10
    } : null;

    // Resolve Path Variables before sending to Rust
    let resolvedUrl = request.url;
    if (request.pathParams) {
      for (const [key, val] of Object.entries(request.pathParams)) {
        if (key && val !== undefined) {
          resolvedUrl = resolvedUrl.replace(`:${key}`, val);
        }
      }
    }
    const executableRequest = { ...request, url: resolvedUrl };

    // Delegate core execution to Rust (PIGEON-110 Unification)
    const res: any = await invoke('execute_request', {
      request: executableRequest,
      environment: environment || null,
      localVars: Object.keys(localVars).length > 0 ? localVars : null,
      settings
    });
    
    if (res.error) {
        throw new Error(res.error);
    }

    let testResults: any[] = [];
    if (res.testResults) {
        testResults = res.testResults;
        
        if (onLog) {
            onLog(`[Test] Ran ${testResults.length} tests`);
        }
        
        if (res.envMutations) {
            for (const [k, v] of Object.entries(res.envMutations)) {
                if (localVars[k] !== v) {
                    context.env.set(k, v as string);
                    localVars[k] = v as string;
                }
            }
        }
        
        try {
            await flushSecretWrites();
        } catch (error) {
            useStore.getState().showToast(`Failed to save script secret: ${String(error)}`, 'error');
        }
    }

    return {
      status: res.status,
      statusText: getResponseStatusText(res.status, res.statusText || ''),
      timeMs: res.timeMs,
      headers: res.headers || {},
      data: res.data,
      rawText: res.rawText || '',
      testResults,
      isBinary: res.isBinary,
      sizeBytes: res.sizeBytes,
      isTruncated: res.isTruncated,
      dnsTimeMs: res.dnsTimeMs,
      connectTimeMs: res.connectTimeMs,
      ttfbTimeMs: res.ttfbTimeMs,
      error: res.error,
      isCancelled: res.isCancelled
    };

  } catch (error: any) {
    const endTime = performance.now();
    return {
      status: 0,
      statusText: error.name === 'AbortError' ? 'Cancelled' : 'Error',
      timeMs: Math.round(endTime - startTime),
      headers: {},
      data: error.name === 'AbortError' ? 'Request was cancelled by the user.' : formatPigeonError(error),
      rawText: '',
      testResults: [],
      isBinary: false,
      sizeBytes: 0,
      isTruncated: false,
      dnsTimeMs: 0,
      connectTimeMs: 0,
      ttfbTimeMs: 0,
      error: error.message || String(error),
      isCancelled: error.name === 'AbortError'
    };
  }
}

export async function parseDataset(content: string, isCsv: boolean): Promise<Record<string, string>[]> {
  return await invoke('parse_dataset', { content, isCsv });
}
