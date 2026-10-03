import { useStore, type RequestItem, type Environment } from '../store';
import { resolveEnvVariables } from './env';
import { runPreRequestScript, runTestScript, type PigeonContext } from './sandbox';
import { prepareRequestBody, getEnabledRequestHeaders, getResponseStatusText } from './request';
import { formatPigeonError } from './errors';
import { removeDisabledQueryParams, setQueryParams } from './url';
import { getSecret, setSecret } from './secrets';
import { invalidateOAuthToken, resolveOAuth2ClientCredentials, type OAuthResolutionResult } from './oauth';
import { fetch } from '@tauri-apps/plugin-http';

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
  error?: string;
  isCancelled?: boolean;
}

export async function executeRequest(options: RequestExecutionOptions): Promise<RequestExecutionResult> {
  const { request, environment, onLog, signal, saveSecretsToEnvironment = false } = options;
  const localVars = options.localVars || {};
  const pendingSecretWrites = new Map<string, string>();
  
  const startTime = performance.now();

  try {
    const scriptText = `${request.preRequestScript || ''}\n${request.testScript || ''}`;
    const serializedRequest = JSON.stringify(request);
    const referencedKeys = new Set<string>();
    
    for (const match of serializedRequest.matchAll(/\{\{([^}]+)\}\}/g)) {
      referencedKeys.add(match[1].trim());
    }
    for (const match of scriptText.matchAll(/pigeon\.env\.get\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      referencedKeys.add(match[1]);
    }
    
    const dynamicSecretLookup = /pigeon\.env\.get\(\s*[^'"]/.test(scriptText);
    
    // Resolve required secrets
    if (environment) {
      for (const v of environment.variables) {
        if (v.secret && v.enabled && (referencedKeys.has(v.key) || dynamicSecretLookup)) {
          if (!localVars[v.key]) {
            const val = await getSecret(environment.id, v.key);
            if (val !== null && val !== undefined) {
              localVars[v.key] = val;
              if (v.secretStored === false && saveSecretsToEnvironment) {
                useStore.getState().updateEnvironment(environment.id, {
                  variables: environment.variables.map(variable => variable.id === v.id
                    ? { ...variable, secretStored: true }
                    : variable)
                });
              }
            } else if (referencedKeys.has(v.key)) {
              if (saveSecretsToEnvironment) {
                useStore.getState().updateEnvironment(environment.id, {
                  variables: environment.variables.map(variable => variable.id === v.id
                    ? { ...variable, secretStored: false }
                    : variable)
                });
              }
              throw new Error(`Secret variable "${v.key}" is missing from the system keychain.`);
            }
          }
        }
      }
      const disabledSecret = environment.variables.find(variable => variable.secret && !variable.enabled && referencedKeys.has(variable.key));
      if (disabledSecret) throw new Error(`Secret variable "${disabledSecret.key}" is disabled.`);
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

    const finalHeaders: Record<string, string> = {};
    const baseHeaders = getEnabledRequestHeaders(request);
    for (const [k, v] of Object.entries(baseHeaders)) {
      finalHeaders[resolveEnvVariables(k, environment, localVars)] = resolveEnvVariables(v, environment, localVars);
    }

    const requestUrl = removeDisabledQueryParams(request.url, request.disabledParams);
    let finalUrl = resolveEnvVariables(requestUrl, environment, localVars);
    const { body: finalBody, headers: bodyHeaders } = prepareRequestBody(request, environment, localVars);
    for (const [k, v] of Object.entries(bodyHeaders)) finalHeaders[k] = v;

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
        headers: finalHeaders,
        url: finalUrl,
        method: request.method,
        body: finalBody
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
      finalUrl = context.request.url;
      if (onLog) onLog('[Pre-request] Executed script successfully');
    }
    
    await flushSecretWrites();

    const authorizationDisabled = (request.disabledHeaders || []).some(key => key.toLowerCase() === 'authorization');
    if (request.authorizationHeaderInKeychain && !authorizationDisabled) {
      const authorization = await getSecret('request-auth', request.authorizationHeaderKeychainRef || '');
      if (!authorization) throw new Error('Authorization header is missing from the system keychain. Re-enter it in the Headers tab.');
      finalHeaders.Authorization = authorization;
    }

    const appSettings = useStore.getState().appSettings;
    const dangerOptions = appSettings?.insecureSSL ? { acceptInvalidCerts: true, acceptInvalidHostnames: true } : undefined;

    let usedCachedOAuth = false;
    let oauthResolution: OAuthResolutionResult | null = null;

    if (request.auth) {
      if (request.auth.type === 'bearer' && (request.auth.bearerToken || request.auth.bearerTokenInKeychain)) {
        const token = request.auth.bearerTokenInKeychain
          ? await getSecret('request-auth', request.auth.bearerTokenKeychainRef || '')
          : request.auth.bearerToken;
        if (request.auth.bearerTokenInKeychain && !token) throw new Error('Bearer token is missing from the system keychain.');
        finalHeaders['Authorization'] = `Bearer ${resolveEnvVariables(token || '', environment, localVars)}`;
      } else if (request.auth.type === 'basic' && (request.auth.basicUsername || request.auth.basicPassword || request.auth.basicPasswordInKeychain)) {
        const user = resolveEnvVariables(request.auth.basicUsername || '', environment, localVars);
        const storedPassword = request.auth.basicPasswordInKeychain
          ? await getSecret('request-auth', request.auth.basicPasswordKeychainRef || '')
          : request.auth.basicPassword || '';
        if (request.auth.basicPasswordInKeychain && !storedPassword) {
          throw new Error('Basic-auth password is missing from the system keychain.');
        }
        const pass = resolveEnvVariables(storedPassword || '', environment, localVars);
        finalHeaders['Authorization'] = `Basic ${btoa(`${user}:${pass}`)}`;
      } else if (request.auth.type === 'api_key' && request.auth.apiKeyKey) {
        const key = resolveEnvVariables(request.auth.apiKeyKey, environment, localVars);
        const storedValue = request.auth.apiKeyValueInKeychain
          ? await getSecret('request-auth', request.auth.apiKeyValueKeychainRef || '')
          : request.auth.apiKeyValue || '';
        if (request.auth.apiKeyValueInKeychain && !storedValue) {
          throw new Error('API key value is missing from the system keychain.');
        }
        const val = resolveEnvVariables(storedValue || '', environment, localVars);
        if (request.auth.apiKeyIn === 'query') {
          finalUrl = setQueryParams(finalUrl, { [key]: val });
        } else {
          finalHeaders[key] = val;
        }
      } else if (request.auth.type === 'oauth2_client_credentials') {
        oauthResolution = await resolveOAuth2ClientCredentials({
          auth: request.auth,
          activeEnvironment: environment,
          localVars,
          fetchFn: ('__TAURI_INTERNALS__' in window) ? fetch : window.fetch,
          dangerOptions,
          timeout: appSettings?.requestTimeout
        });
        finalHeaders['Authorization'] = `Bearer ${oauthResolution.accessToken}`;
        usedCachedOAuth = oauthResolution.fromCache;
      }
    }
    
    context.request.headers = { ...context.request.headers, ...finalHeaders };
    const reqBodyToUse = context.request.body;

    const doSendHttp = async () => {
      if ('__TAURI_INTERNALS__' in window) {
        return await fetch(finalUrl, {
          method: context.request.method,
          headers: context.request.headers,
          body: reqBodyToUse as any,
          connectTimeout: appSettings?.requestTimeout,
          maxRedirections: appSettings?.maxRedirects,
          signal,
          ...(dangerOptions ? { danger: dangerOptions } : {})
        });
      } else {
        return await window.fetch(finalUrl, {
          method: context.request.method,
          headers: context.request.headers,
          body: reqBodyToUse as any,
          signal
        });
      }
    };

    let res = await doSendHttp();

    if (res.status === 401 && usedCachedOAuth && oauthResolution && request.auth) {
      invalidateOAuthToken(oauthResolution.cacheKey);
      const freshResolution = await resolveOAuth2ClientCredentials({
        auth: request.auth,
        activeEnvironment: environment,
        localVars,
        fetchFn: ('__TAURI_INTERNALS__' in window) ? fetch : window.fetch,
        dangerOptions,
        timeout: appSettings?.requestTimeout,
        forceFresh: true
      });
      context.request.headers['Authorization'] = `Bearer ${freshResolution.accessToken}`;
      finalHeaders['Authorization'] = `Bearer ${freshResolution.accessToken}`;
      res = await doSendHttp();
    }

    const endTime = performance.now();
    const timeMs = Math.round(endTime - startTime);

    let text = '';
    try {
      text = await res.text();
    } catch(e) {
      try {
        const buf = await res.arrayBuffer();
        text = new TextDecoder().decode(buf);
      } catch (e2) {}
    }
    
    let data = text;
    try { data = JSON.parse(text); } catch { }

    const headersRecord: Record<string, string> = {};
    res.headers.forEach((value: any, key: any) => { headersRecord[key] = value; });

    let testResults: any[] = [];

    if (request.testScript) {
      context.response = {
        status: res.status,
        json: () => {
          if (typeof data !== 'object') throw new Error('Response is not JSON');
          return data;
        },
        text: () => text,
        headers: headersRecord
      };
      const allVars: Record<string, string> = { ...localVars };
      environment?.variables.forEach(v => {
        if (!allVars[v.key]) {
          allVars[v.key] = v.secret ? (localVars[v.key] || '') : v.value;
        }
      });
      testResults = await runTestScript(request.testScript, context, allVars);
      if (onLog) {
        onLog(`[Test] Ran ${testResults.length} tests`);
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
      timeMs,
      headers: headersRecord,
      data,
      rawText: text,
      testResults
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
      error: error.message || String(error),
      isCancelled: error.name === 'AbortError'
    };
  }
}
