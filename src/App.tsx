import { secureImportedCollection } from './utils/authSecrets';
import { serializePortableCollection } from './utils/collectionFormat';
import { Dropdown } from "./components/Dropdown";
import { Sidebar } from "./components/Sidebar";
import { CollectionsPanel } from "./components/CollectionsPanel";
import { RequestTabs } from "./components/RequestTabs";
import { RequestEditor } from "./components/RequestEditor";
import { ResponseViewer } from "./components/ResponseViewer";
import { CurlModal } from "./components/CurlModal";
import { EnvironmentSelector } from "./components/EnvironmentSelector";
import { EnvironmentManager } from "./components/EnvironmentManager";
import { HighlightedInput } from "./components/HighlightedInput";
import { getMethodColor } from "./utils/styles";
import { removeDisabledQueryParams, setQueryParams } from "./utils/url";
import { resolveEnvVariables } from "./utils/env";
import { downloadAsFile, openFilesAndRead } from "./utils/file";
import { parsePostmanCollection, parsePostmanEnvironment } from "./utils/postman";
import { secureImportedEnvironment } from './utils/authSecrets';
import { runPreRequestScript, runTestScript, type PigeonContext } from "./utils/sandbox";
import { formatRequestError, getEnabledRequestHeaders, getResponseStatusText, prepareRequestBody } from "./utils/request";
import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { EnvironmentEditor } from './components/EnvironmentEditor';
import { createSecretReference, getSecret, setSecret } from './utils/secrets';

import { Panel, Group, Separator } from 'react-resizable-panels';
import { fetch } from '@tauri-apps/plugin-http';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startCollectionStorage } from './utils/collectionStorage';
import { 
  Send, 
  Activity,
  Code2,
  Loader2
} from 'lucide-react';

import { useStore } from './store';

const ResizeHandle = ({ vertical = false }) => (
  <Separator className={`flex items-center justify-center bg-border-subtle group z-50 relative transition-colors hover:bg-accent ${vertical ? 'h-[1px] cursor-row-resize' : 'w-[1px] cursor-col-resize'}`}>
    <div className={`absolute bg-transparent ${vertical ? 'w-full h-4 -top-1.5' : 'w-4 h-full -left-1.5'}`} />
  </Separator>
);


import { RunnerView } from "./components/RunnerView";
import { AutomationView } from "./components/AutomationView";


export default function App() {
  const theme = useStore(state => state.theme);
  const activeView = useStore(state => state.activeView);
  
  React.useEffect(() => { document.documentElement.classList.toggle('light', theme === 'light'); try { getCurrentWindow().setTheme(theme); } catch {} }, [theme]);
  
  React.useEffect(() => {
    const migrateSecrets = async () => {
      const state = useStore.getState();
      const authVars = new Set<string>();
      for (const col of state.collections) {
        for (const req of col.requests) {
          const authValues = [req.auth?.bearerToken, req.auth?.basicPassword, req.auth?.apiKeyValue];
          for (const [header, value] of Object.entries(req.headers)) {
            if (header.toLowerCase() === 'authorization') authValues.push(value);
          }
          for (const value of authValues) {
            if (!value) continue;
            for (const match of value.matchAll(/\{\{([^}]+)\}\}/g)) authVars.add(match[1].trim());
          }
        }
      }

      for (const env of state.environments) {
        let envChanged = false;
        let migrationFailed = false;
        const newVars = [];
        for (const v of env.variables) {
           if ((v.secret || authVars.has(v.key) || v.key.toLowerCase().includes('token') || v.key.toLowerCase().includes('secret')) && v.value !== '') {
            try {
             await setSecret(env.id, v.key, v.value);
             newVars.push({ ...v, secret: true, secretStored: true, value: '' });
             envChanged = true;
            } catch (error) {
             migrationFailed = true;
             newVars.push(v);
             console.error(`Failed to migrate secret ${v.key} for environment ${env.name}`, error);
            }
           } else {
              newVars.push(v);
           }
        }
        if (envChanged) {
           useStore.getState().updateEnvironment(env.id, { variables: newVars });
        } else if (env.variables.length === 0) {
           useStore.getState().updateEnvironment(env.id, { 
             variables: [{ id: `var-${Date.now()}-${Math.random()}`, key: '', value: '', enabled: true, secret: false, secretStored: false }]
           });
        }
        if (migrationFailed) {
          useStore.getState().showToast(`Some secrets in ${env.name} could not be moved to the system keychain. Existing values were kept.`, 'error');
        }
      }

      const secretFields = [
        { valueKey: 'bearerToken', markerKey: 'bearerTokenInKeychain', refKey: 'bearerTokenKeychainRef' },
        { valueKey: 'basicPassword', markerKey: 'basicPasswordInKeychain', refKey: 'basicPasswordKeychainRef' },
        { valueKey: 'apiKeyValue', markerKey: 'apiKeyValueInKeychain', refKey: 'apiKeyValueKeychainRef' }
      ] as const;
      let authMigrationFailed = false;
      for (const collection of state.collections) {
        for (const request of collection.requests) {
          let migratedAuth = request.auth ? { ...request.auth } : undefined;
          let migratedHeaders = { ...request.headers };
          let authorizationHeaderInKeychain = request.authorizationHeaderInKeychain;
          let authorizationHeaderKeychainRef = request.authorizationHeaderKeychainRef;
          let authChanged = false;
          if (migratedAuth) {
            for (const { valueKey, markerKey } of secretFields) {
              const value = migratedAuth[valueKey];
              if (!value || /^\{\{\s*[^{}]+\s*\}\}$/.test(value.trim())) continue;
              try {
                const reference = createSecretReference();
                await setSecret('request-auth', reference, value);
                migratedAuth = { ...migratedAuth, [valueKey]: '', [markerKey]: true, [
                  { bearerToken: 'bearerTokenKeychainRef', basicPassword: 'basicPasswordKeychainRef', apiKeyValue: 'apiKeyValueKeychainRef' }[valueKey]
                ]: reference };
                authChanged = true;
              } catch (error) {
                authMigrationFailed = true;
                console.error(`Failed to migrate auth secret for request ${request.name}`, error);
              }
            }
          }
          const authorizationHeader = Object.keys(migratedHeaders).find(key => key.toLowerCase() === 'authorization');
          const authorizationValue = authorizationHeader ? migratedHeaders[authorizationHeader] : undefined;
          if (authorizationHeader && authorizationValue && !/^\{\{\s*[^{}]+\s*\}\}$/.test(authorizationValue.trim())) {
            try {
              const reference = createSecretReference();
              await setSecret('request-auth', reference, authorizationValue);
              delete migratedHeaders[authorizationHeader];
              authorizationHeaderInKeychain = true;
              authorizationHeaderKeychainRef = reference;
              authChanged = true;
            } catch (error) {
              authMigrationFailed = true;
              console.error(`Failed to migrate Authorization header for request ${request.name}`, error);
            }
          }
          if (authChanged) {
            const current = useStore.getState();
            useStore.setState({
              collections: current.collections.map(currentCollection => currentCollection.id !== collection.id
                ? currentCollection
                : {
                    ...currentCollection,
                    requests: currentCollection.requests.map(currentRequest =>
                      currentRequest.id === request.id ? {
                        ...currentRequest,
                        auth: migratedAuth,
                        headers: migratedHeaders,
                        authorizationHeaderInKeychain,
                        authorizationHeaderKeychainRef
                      } : currentRequest
                    )
                  })
            });
          }
        }
      }
      if (authMigrationFailed) {
        useStore.getState().showToast('Some request credentials could not be moved to the system keychain. Existing values were kept.', 'error');
      }
    };
    let cancelled = false;
    let stopStorage: (() => void) | undefined;
    void migrateSecrets().then(() => {
      if (!cancelled) stopStorage = startCollectionStorage();
    }).catch(error => {
      useStore.getState().showToast(`Could not initialize secure storage: ${String(error)}`, 'error');
    });
    return () => {
      cancelled = true;
      stopStorage?.();
    };
  }, []);
  
  const [isCurlModalOpen, setIsCurlModalOpen] = useState(false);
  const [isEnvManagerOpen, setIsEnvManagerOpen] = useState(false);
  const [curlModalMode, setCurlModalMode] = useState<'import'|'export'>('import');
  const [curlModalTargetColId, setCurlModalTargetColId] = useState<string | null>(null);
  const activeRequestId = useStore(state => state.activeRequestId);
  const activeRequest = useStore(state => state.getActiveRequest());
  const toast = useStore(state => state.toast);
  const [curlModalRequest, setCurlModalRequest] = useState(activeRequest);

  const updateActiveRequest = useStore(state => state.updateActiveRequest);

  const [localUrl, setLocalUrl] = useState(activeRequest?.url || '');
  const [localMethod, setLocalMethod] = useState(activeRequest?.method || 'GET');

  const [response, setResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (activeRequest) {
      setLocalUrl(activeRequest.url);
      setLocalMethod(activeRequest.method);
      setResponse(null); // Clear response when switching requests
    }
  }, [activeRequest]);

  const handleSend = async () => {
    if (!localUrl) return;
    setIsLoading(true);
    setResponse(null);

    const startTime = performance.now();
    try {
      const stateAtSend = useStore.getState();
      const activeEnvironment = stateAtSend.environments.find(e => e.id === stateAtSend.activeEnvironmentId);
      const scriptText = `${activeRequest?.preRequestScript || ''}\n${activeRequest?.testScript || ''}`;
      const serializedRequest = JSON.stringify({ ...activeRequest, url: localUrl });
      const referencedKeys = new Set<string>();
      for (const match of serializedRequest.matchAll(/\{\{([^}]+)\}\}/g)) referencedKeys.add(match[1].trim());
      for (const match of scriptText.matchAll(/pigeon\.env\.get\(\s*['"]([^'"]+)['"]\s*\)/g)) referencedKeys.add(match[1]);
      const dynamicSecretLookup = /pigeon\.env\.get\(\s*[^'"]/.test(scriptText);
      const localVars: Record<string, string> = {};
      const pendingSecretWrites = new Map<string, string>();
      if (activeEnvironment) {
        for (const v of activeEnvironment.variables) {
          if (v.secret && v.enabled && (referencedKeys.has(v.key) || dynamicSecretLookup)) {
            const val = await getSecret(activeEnvironment.id, v.key);
            if (val !== null && val !== undefined) {
              localVars[v.key] = val;
              if (v.secretStored === false) {
                useStore.getState().updateEnvironment(activeEnvironment.id, {
                  variables: activeEnvironment.variables.map(variable => variable.id === v.id
                    ? { ...variable, secretStored: true }
                    : variable)
                });
              }
            } else if (referencedKeys.has(v.key)) {
              useStore.getState().updateEnvironment(activeEnvironment.id, {
                variables: activeEnvironment.variables.map(variable => variable.id === v.id
                  ? { ...variable, secretStored: false }
                  : variable)
              });
              throw new Error(`Secret variable "${v.key}" is missing from the system keychain.`);
            }
          }
        }
        const disabledSecret = activeEnvironment.variables.find(variable => variable.secret && !variable.enabled && referencedKeys.has(variable.key));
        if (disabledSecret) throw new Error(`Secret variable "${disabledSecret.key}" is disabled.`);
      }

      const flushSecretWrites = async () => {
        if (!activeEnvironment) return;
        for (const [key, value] of pendingSecretWrites) {
          await setSecret(activeEnvironment.id, key, value);
          localVars[key] = value;
          pendingSecretWrites.delete(key);
          const state = useStore.getState();
          const environment = state.environments.find(item => item.id === activeEnvironment.id);
          const variable = environment?.variables.find(item => item.key === key && item.secret);
          if (environment && variable && variable.secretStored !== true) {
            state.updateEnvironment(environment.id, {
              variables: environment.variables.map(item => item.id === variable.id ? { ...item, secretStored: true } : item)
            });
          }
        }
      };

      const finalHeaders: Record<string, string> = {};
      const baseHeaders = activeRequest ? getEnabledRequestHeaders(activeRequest) : {};
      for (const [k, v] of Object.entries(baseHeaders)) {
        finalHeaders[resolveEnvVariables(k, activeEnvironment, localVars)] = resolveEnvVariables(v, activeEnvironment, localVars);
      }
      
      const requestUrl = removeDisabledQueryParams(localUrl, activeRequest?.disabledParams);
      let finalUrl = resolveEnvVariables(requestUrl, activeEnvironment, localVars);
      const { body: finalBody, headers: bodyHeaders } = activeRequest ? prepareRequestBody({ ...activeRequest, method: localMethod }, activeEnvironment, localVars) : { body: undefined, headers: {} };
      for (const [k, v] of Object.entries(bodyHeaders)) finalHeaders[k] = v;
      
      const context: PigeonContext = {
        env: {
          get: (key: string) => {
            const v = activeEnvironment?.variables.find(variable => variable.key === key);
            if (v && v.secret) {
              return localVars[key];
            }
            return v ? v.value : undefined;
          },
          set: (key: string, value: string) => {
            if (!activeEnvironment) return;
            const existing = activeEnvironment.variables.find(variable => variable.key === key);
            if (existing) {
              if (existing.secret) {
                localVars[key] = value;
                pendingSecretWrites.set(key, value);
              } else {
                const newVars = activeEnvironment.variables.map(variable => variable.key === key ? { ...variable, value } : variable);
                useStore.getState().updateEnvironment(activeEnvironment.id, { variables: newVars });
              }
            } else {
              const secret = /token|secret/i.test(key);
              const newVars = [...activeEnvironment.variables, {
                id: `var-${Date.now()}-${Math.random()}`,
                key,
                value: secret ? '' : value,
                enabled: true,
                secret,
                secretStored: secret ? false : undefined
              }];
              if (secret) {
                localVars[key] = value;
                pendingSecretWrites.set(key, value);
              }
              useStore.getState().updateEnvironment(activeEnvironment.id, { variables: newVars });
            }
          }
        },
        request: {
          headers: finalHeaders,
          url: finalUrl,
          method: localMethod,
          body: finalBody
        }
      };

      if (activeRequest?.preRequestScript) {
        runPreRequestScript(activeRequest.preRequestScript, context);
        finalUrl = context.request.url;
      }
      await flushSecretWrites();

      if (activeRequest?.authorizationHeaderInKeychain) {
        const authorization = await getSecret('request-auth', activeRequest.authorizationHeaderKeychainRef || '');
        if (!authorization) throw new Error('Authorization header is missing from the system keychain. Re-enter it in the Headers tab.');
        finalHeaders.Authorization = authorization;
      }
      
      if (activeRequest?.auth) {
        if (activeRequest.auth.type === 'bearer' && (activeRequest.auth.bearerToken || activeRequest.auth.bearerTokenInKeychain)) {
          const token = activeRequest.auth.bearerTokenInKeychain
            ? await getSecret('request-auth', activeRequest.auth.bearerTokenKeychainRef || '')
            : activeRequest.auth.bearerToken;
          if (!token) throw new Error('Bearer token is missing from the system keychain. Re-enter it in the Auth tab.');
          finalHeaders['Authorization'] = `Bearer ${resolveEnvVariables(token, activeEnvironment, localVars)}`;
        } else if (activeRequest.auth.type === 'basic' && (activeRequest.auth.basicUsername || activeRequest.auth.basicPassword || activeRequest.auth.basicPasswordInKeychain)) {
          const user = resolveEnvVariables(activeRequest.auth.basicUsername || '', activeEnvironment, localVars);
          const storedPassword = activeRequest.auth.basicPasswordInKeychain
            ? await getSecret('request-auth', activeRequest.auth.basicPasswordKeychainRef || '')
            : activeRequest.auth.basicPassword || '';
          if (activeRequest.auth.basicPasswordInKeychain && !storedPassword) {
            throw new Error('Basic-auth password is missing from the system keychain. Re-enter it in the Auth tab.');
          }
          const pass = resolveEnvVariables(storedPassword || '', activeEnvironment, localVars);
          const creds = btoa(`${user}:${pass}`);
          finalHeaders['Authorization'] = `Basic ${creds}`;
        } else if (activeRequest.auth.type === 'api_key' && activeRequest.auth.apiKeyKey) {
          const key = resolveEnvVariables(activeRequest.auth.apiKeyKey, activeEnvironment, localVars);
          const storedValue = activeRequest.auth.apiKeyValueInKeychain
            ? await getSecret('request-auth', activeRequest.auth.apiKeyValueKeychainRef || '')
            : activeRequest.auth.apiKeyValue || '';
          if (activeRequest.auth.apiKeyValueInKeychain && !storedValue) {
            throw new Error('API key value is missing from the system keychain. Re-enter it in the Auth tab.');
          }
          const val = resolveEnvVariables(storedValue || '', activeEnvironment, localVars);
          if (activeRequest.auth.apiKeyIn === 'query') {
            finalUrl = setQueryParams(finalUrl, { [key]: val });
          } else {
            finalHeaders[key] = val;
          }
        }
      }
      // the body is already computed into finalBody and context.request.body could have been modified by script
      const reqBodyToUse = context.request.body;

      const appSettings = useStore.getState().appSettings;
      const dangerOptions = appSettings?.insecureSSL ? { acceptInvalidCerts: true, acceptInvalidHostnames: true } : undefined;

      let res;
      if ('__TAURI_INTERNALS__' in window) {
        res = await fetch(finalUrl, {
          method: context.request.method,
          headers: context.request.headers,
          body: reqBodyToUse,
          connectTimeout: appSettings?.requestTimeout,
          maxRedirections: appSettings?.maxRedirects,
          ...(dangerOptions ? { danger: dangerOptions } : {})
        });
      } else {
        res = await window.fetch(finalUrl, {
          method: context.request.method,
          headers: context.request.headers,
          body: reqBodyToUse
        });
      }

      const endTime = performance.now();
      const timeMs = Math.round(endTime - startTime);
      
      const text = await res.text();
      let data = text;
      try { data = JSON.parse(text); } catch {}

      const headersRecord: Record<string, string> = {};
      res.headers.forEach((value, key) => { headersRecord[key] = value; });
      
      let testResults: any[] = [];
      
      if (activeRequest?.testScript) {
        context.response = {
          status: res.status,
          json: () => {
            if (typeof data !== 'object') throw new Error('Response is not JSON');
            return data;
          },
          text: () => text,
          headers: headersRecord
        };
        testResults = runTestScript(activeRequest.testScript, context);
        try {
          await flushSecretWrites();
        } catch (error) {
          useStore.getState().showToast(`Failed to save script secret: ${String(error)}`, 'error');
        }
      }

      setResponse({
        status: res.status,
        statusText: getResponseStatusText(res.status, res.statusText),
        time: timeMs,
        size: text.length,
        headers: headersRecord,
        data: typeof data === 'object' ? JSON.stringify(data, null, 2) : data,
        testResults
      });

    } catch (error: any) {
      const endTime = performance.now();
      setResponse({
        status: 0,
        statusText: 'Error',
        time: Math.round(endTime - startTime),
        size: 0,
        headers: {},
        data: formatRequestError(error),
        testResults: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-app-bg text-text-primary overflow-hidden font-sans">
      <EnvironmentManager 
        isOpen={isEnvManagerOpen} 
        onClose={() => setIsEnvManagerOpen(false)} 
      />
      <CurlModal 
        isOpen={isCurlModalOpen} 
        onClose={() => setIsCurlModalOpen(false)} 
        mode={curlModalMode}
        request={curlModalRequest || activeRequest}
        targetCollectionId={curlModalTargetColId}
      />
      
      <Sidebar />

      <Group orientation="horizontal" className="flex-1 min-w-0" >
        
        <CollectionsPanel 
          onAddEnvironmentClick={() => setIsEnvManagerOpen(true)}
          onImportClick={async (type, colId?: string) => {
            if (type === 'request') {
              setCurlModalMode('import');
              setCurlModalTargetColId(colId || null);
              setIsCurlModalOpen(true);
            } else if (type === 'collection') {
              try {
                const jsons = await openFilesAndRead('.json');
                let successCount = 0;
                for (const json of jsons) {
                  const parsed = JSON.parse(json);
                  let col: any = null;
                  if (parsed.info && parsed.info.schema && parsed.item) {
                    col = parsePostmanCollection(parsed);
                  } else if (parsed && parsed.name && Array.isArray(parsed.requests)) {
                    col = parsed;
                  }
                  if (col) {
                    const securedCollection = await secureImportedCollection(col);
                    useStore.getState().importCollection(securedCollection);
                    successCount++;
                  }
                }
                if (successCount > 0) useStore.getState().showToast(`Successfully imported ${successCount} collection(s)`, 'success');
                else useStore.getState().showToast('Invalid collection format(s)', 'error');
              } catch (err: any) {
                if (err.message !== 'No file selected') useStore.getState().showToast(err.message || 'Failed to parse JSON', 'error');
              }
            } else if (type === 'environment') {
              try {
                const jsons = await openFilesAndRead('.json');
                let successCount = 0;
                for (const json of jsons) {
                  const parsed = JSON.parse(json);
                  let env: any = null;
                  if (parsed.values && Array.isArray(parsed.values)) {
                    env = parsePostmanEnvironment(parsed);
                  } else if (parsed && parsed.name && Array.isArray(parsed.variables)) {
                    env = {
                      ...parsed,
                      variables: parsed.variables.map((v: any) => ({
                        ...v,
                        key: v.key || v.name || '',
                        id: v.id || `var-${Date.now()}-${Math.random()}`
                      }))
                    };
                  }
                  if (env) {
                    const securedEnvironment = await secureImportedEnvironment(env);
                    useStore.getState().importEnvironment(securedEnvironment);
                    successCount++;
                  }
                }
                if (successCount > 0) {
                  setIsEnvManagerOpen(true);
                  useStore.getState().showToast(`Successfully imported ${successCount} environment(s)`, 'success');
                } else {
                  useStore.getState().showToast('Invalid environment format(s)', 'error');
                }
              } catch (err: any) {
                if (err.message !== 'No file selected') useStore.getState().showToast(err.message || 'Failed to parse JSON', 'error');
              }
            }
          }}
          onExportClick={(type, item) => {
            if (type === 'request') {
              setCurlModalRequest(item);
              setCurlModalMode('export');
              setIsCurlModalOpen(true);
            } else if (type === 'collection') {
              const filename = `${item.name.toLowerCase().replace(/\s+/g, '_')}_collection.json`;
              downloadAsFile(filename, serializePortableCollection(item));
              useStore.getState().showToast(`Exported ${filename}. Keychain credentials are not included.`, 'success');
            }
          }}
        />

        <ResizeHandle />

        <Panel defaultSize={70} className="flex flex-col min-w-0 bg-app-bg z-0">
          {activeView === 'runner' ? (
            <ErrorBoundary name="Collection Runner">
              <RunnerView />
            </ErrorBoundary>
          ) : activeView === 'automation' ? (
            <ErrorBoundary name="Automation Builder">
              <AutomationView />
            </ErrorBoundary>
          ) : (
            <>
              <div className="flex items-end justify-between border-b border-border-subtle bg-panel-bg pr-4 pl-2 h-[44px]">
            <div className="flex-1 overflow-hidden h-full">
              <RequestTabs />
            </div>
            <div className="flex items-center h-full">
              <div 
                className="flex items-center justify-center w-6 h-6 mr-1 rounded cursor-pointer text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
                onClick={() => {
                  const el = document.getElementById('request-tabs-container');
                  if (el) el.scrollBy({ left: 200, behavior: 'smooth' });
                }}
                title="Scroll Tabs Right"
              >
                <ChevronRight size={14} />
              </div>
              <EnvironmentSelector onManageClick={() => setIsEnvManagerOpen(true)} />
            </div>
          </div>

          {activeRequestId?.startsWith('env-') ? (
            <ErrorBoundary name="Environment Editor">
              <EnvironmentEditor environmentId={activeRequestId} />
            </ErrorBoundary>
          ) : activeRequest ? (

            <ErrorBoundary name="Request Editor">
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="px-4 py-3 border-b border-border-subtle flex justify-between items-center shrink-0">
                <input 
                  type="text"
                  value={activeRequest.name}
                  onChange={(e) => updateActiveRequest({ name: e.target.value })}
                  className="bg-transparent text-lg font-bold text-text-primary outline-none focus:border-accent border-b border-transparent w-full"
                  placeholder="Request Name"
                />
              </div>
              <div className="px-4 h-[68px] flex items-center space-x-3 border-b border-border-subtle shrink-0 min-w-0">
            <div className="flex-1 min-w-0 flex items-center bg-transparent border border-border-strong rounded-md focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition-all h-[36px]">
              <div className="relative border-r border-border-strong flex items-center w-[84px] shrink-0 h-full">
                <Dropdown 
                  value={localMethod}
                  onChange={(val) => {
                    setLocalMethod(val as any);
                    updateActiveRequest({ method: val as any });
                  }}
                  options={[
                    { value: 'GET', label: 'GET' },
                    { value: 'POST', label: 'POST' },
                    { value: 'PUT', label: 'PUT' },
                    { value: 'PATCH', label: 'PATCH' },
                    { value: 'DELETE', label: 'DELETE' }
                  ]}
                  className={`bg-transparent font-bold text-xs px-2 h-full w-full ${getMethodColor(localMethod)}`}
                />
              </div>
              <HighlightedInput 
                singleLineEllipsis
                value={localUrl}
                onChange={(e: any) => {
                  setLocalUrl(e.target.value);
                  updateActiveRequest({ url: e.target.value });
                }}
                onKeyDown={(e: any) => e.key === 'Enter' && handleSend()}
                className="flex-1 min-w-0 overflow-hidden text-sm font-mono placeholder-text-muted h-full"
                placeholder="Enter request URL"
              />
              <button  
                onClick={() => {
                  setCurlModalRequest(activeRequest);
                  setCurlModalMode('export');
                  setIsCurlModalOpen(true);
                }}
                title="Export as cURL"
                className="flex shrink-0 items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover px-2 h-full transition-all active:scale-95 rounded-r-md"
              >
                <Code2 size={16} />
              </button>
            </div>
            <button 
              onClick={handleSend}
              disabled={isLoading}
              className="flex shrink-0 items-center justify-center space-x-1.5 bg-accent hover:bg-accent-hover text-white px-4 h-[36px] rounded-md text-sm font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : (
                <>
                  <span>Send</span>
                  <Send size={14} />
                </>
              )}
            </button>
          </div>

          <div className="flex-1 min-h-0">
            <Group orientation="vertical">
              <RequestEditor setLocalUrl={setLocalUrl} />

              <ResizeHandle vertical />

              <ResponseViewer response={response} isLoading={isLoading} />
            </Group>
          </div>
          </div>
            </ErrorBoundary>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-text-muted bg-app-bg">
              <Activity size={48} className="mb-4 opacity-20" />
              <p>Select or create a request to get started</p>
            </div>
          )}
            </>
          )}
        </Panel>
      </Group>
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-xl border z-[9999] flex items-center gap-2 transform transition-all ${
          toast.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-500' : 
          toast.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-500' : 
          'bg-surface-bg border-border-strong text-text-primary'
        }`}>
          {toast.type === 'success' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>}
          {toast.type === 'error' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
