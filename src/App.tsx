import { secureImportedCollection } from './utils/authSecrets';
import { serializePortableCollection } from './utils/collectionFormat';
import { Dropdown } from "./components/Dropdown";
import { Sidebar } from "./components/Sidebar";
import { CollectionsPanel } from "./components/CollectionsPanel";
import { FlowsPanel } from "./components/FlowsPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { SourceControlPanel } from "./components/SourceControlPanel";
import { SecuritySidebar } from "./components/SecuritySidebar";
import { RequestTabs } from "./components/RequestTabs";
import { SecurityHub } from "./components/SecurityHub";
import { PerformanceSidebar } from "./components/PerformanceSidebar";
import { PerformanceHub } from "./components/PerformanceHub";
import { RequestEditor } from "./components/RequestEditor";
import { ResponseViewer } from "./components/ResponseViewer";
import { CurlModal } from "./components/CurlModal";
import { EnvironmentSelector } from "./components/EnvironmentSelector";
import { EnvironmentManager } from "./components/EnvironmentManager";
import { HighlightedInput } from "./components/HighlightedInput";
import { getMethodColor } from "./utils/styles";

import { downloadAsFile, openFilesAndRead, openFilesWithNames } from "./utils/file";
import { parsePostmanCollection, parsePostmanEnvironment } from "./utils/postman";
import { parseOpenAPI } from "./utils/openapi";
import { secureImportedEnvironment } from './utils/authSecrets';

import { formatPigeonError } from "./utils/errors";
import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { EnvironmentEditor } from './components/EnvironmentEditor';
import { createSecretReference, setSecret } from './utils/secrets';

import { Panel, Group, Separator } from 'react-resizable-panels';

import { getCurrentWindow } from '@tauri-apps/api/window';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WhatsNewModal } from './components/WhatsNewModal';
import { startCollectionStorage } from './utils/collectionStorage';
import {
  Send,
  Activity,
  Code2,
  Loader2
} from 'lucide-react';

import { useStore } from './store';

const ResizeHandle = ({ vertical = false }) => (
  <Separator className={`flex items-center justify-center group relative transition-colors ${vertical ? 'hover:bg-accent/50 bg-border-subtle h-[1px] cursor-row-resize z-50' : 'bg-transparent w-1 cursor-col-resize z-10'}`}>
    <div className={`absolute bg-transparent ${vertical ? 'w-full h-4 -top-1.5' : 'w-4 h-full -left-0.5'}`} />
    {!vertical && <div className="w-[1px] h-full bg-transparent group-hover:bg-accent/50 transition-colors" />}
  </Separator>
);


import { RunnerView } from "./components/RunnerView";
import { AutomationView } from "./components/AutomationView";


export default function App() {
  const theme = useStore(state => state.theme);
  const activeView = useStore(state => state.activeView);

  React.useEffect(() => { document.documentElement.classList.toggle('light', theme === 'light'); try { getCurrentWindow().setTheme(theme); } catch { } }, [theme]);

  React.useEffect(() => {
    const migrateSecrets = async () => {
      const state = useStore.getState();
      const authVars = new Set<string>();
      for (const col of state.collections) {
        for (const req of col.requests) {
          const authValues = [req.auth?.bearerToken, req.auth?.basicPassword, req.auth?.apiKeyValue, req.auth?.clientSecret];
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
        { valueKey: 'apiKeyValue', markerKey: 'apiKeyValueInKeychain', refKey: 'apiKeyValueKeychainRef' },
        { valueKey: 'clientSecret', markerKey: 'clientSecretInKeychain', refKey: 'clientSecretKeychainRef' }
      ] as const;
      let authMigrationFailed = false;
      for (const collection of state.collections) {
        for (const request of collection.requests) {
          let migratedAuth = request.auth ? { ...request.auth } : undefined;
          let authChanged = false;
          if (migratedAuth) {
            for (const { valueKey, markerKey } of secretFields) {
              const value = migratedAuth[valueKey];
              if (!value || /^\{\{\s*[^{}]+\s*\}\}$/.test(value.trim())) continue;
              try {
                const reference = createSecretReference();
                await setSecret('request-auth', reference, value);
                migratedAuth = {
                  ...migratedAuth, [valueKey]: '', [markerKey]: true, [
                    { bearerToken: 'bearerTokenKeychainRef', basicPassword: 'basicPasswordKeychainRef', apiKeyValue: 'apiKeyValueKeychainRef', clientSecret: 'clientSecretKeychainRef' }[valueKey]
                  ]: reference
                };
                authChanged = true;
              } catch (error) {
                authMigrationFailed = true;
                console.error(`Failed to migrate auth secret for request ${request.name}`, error);
              }
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
                      auth: migratedAuth
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
  const [curlModalMode, setCurlModalMode] = useState<'import' | 'export'>('import');
  const [curlModalTargetColId, setCurlModalTargetColId] = useState<string | null>(null);
  const activeRequestId = useStore(state => state.activeRequestId);
  const activeRequest = useStore(state => state.getActiveRequest());
  const toast = useStore(state => state.toast);
  const [curlModalRequest, setCurlModalRequest] = useState(activeRequest);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const updateActiveRequest = useStore(state => state.updateActiveRequest);
  const addHistoryItem = useStore(state => state.addHistoryItem);

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
    if (isLoading) {
      abortControllerRef.current?.abort();
      setIsLoading(false);
      return;
    }
    if (!localUrl) return;
    setIsLoading(true);
    setResponse(null);

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const { executeRequest } = await import('./utils/engine');
      const stateAtSend = useStore.getState();
      const activeEnvironment = stateAtSend.environments.find(e => e.id === stateAtSend.activeEnvironmentId);
      
      const result = await executeRequest({
        request: { ...activeRequest, url: localUrl, method: localMethod } as any,
        environment: activeEnvironment,
        signal,
        saveSecretsToEnvironment: true
      });

      setResponse({
        status: result.status,
        statusText: result.statusText,
        time: result.timeMs,
        size: result.rawText.length,
        headers: result.headers,
        data: typeof result.data === 'object' ? JSON.stringify(result.data, null, 2) : result.data,
        testResults: result.testResults
      });
      
    } catch (error: any) {
      setResponse({
        status: 0,
        statusText: error.name === 'AbortError' ? 'Cancelled' : 'Error',
        time: 0,
        size: 0,
        headers: {},
        data: error.name === 'AbortError' ? 'Request was cancelled by the user.' : formatPigeonError(error),
        testResults: []
      });
    } finally {
      if (activeRequest) {
        addHistoryItem({
          ...activeRequest,
          url: localUrl,
          method: localMethod,
          name: activeRequest.name || localUrl || 'Unnamed Request'
        });
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-app-bg text-text-primary overflow-hidden font-sans">
      <div className="h-[32px] w-full shrink-0 z-50 bg-app-bg flex items-center relative">
        <div className="absolute inset-0" data-tauri-drag-region />
      </div>
      <div className="flex flex-1 min-h-0 relative">
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

        {activeView === 'history' ? (
          <HistoryPanel />
        ) : activeView === 'automation' ? (
          <FlowsPanel />
        ) : activeView === 'source-control' ? (
          <SourceControlPanel />
        ) : activeView === 'security' ? (
          <SecuritySidebar />
        ) : activeView === 'performance' ? (
          <PerformanceSidebar />
        ) : (
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
              } else if (type === 'openapi') {
                try {
                  const files = await openFilesWithNames('.json,.yaml,.yml');
                  let successCount = 0;
                  for (const { name, content } of files) {
                    try {
                      const col = parseOpenAPI(content, name);
                      if (col) {
                        const securedCollection = await secureImportedCollection(col);
                        useStore.getState().importCollection(securedCollection);
                        successCount++;
                      }
                    } catch (e: any) {
                      console.error("OpenAPI parse error:", e);
                    }
                  }
                  if (successCount > 0) {
                    useStore.getState().showToast(`Successfully imported ${successCount} OpenAPI spec(s)`, 'success');
                  } else {
                    useStore.getState().showToast('Invalid OpenAPI format(s) or no valid files', 'error');
                  }
                } catch (err: any) {
                  if (err.message !== 'No file selected') useStore.getState().showToast(err.message || 'Failed to parse OpenAPI', 'error');
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
        )}

        <ResizeHandle />

        <Panel defaultSize={70} className="flex flex-col min-w-0 bg-panel-bg z-0 rounded-tl-xl border-l border-t border-border-strong overflow-hidden shadow-2xl relative">
          <div className={activeView === 'runner' ? "h-full w-full flex flex-col min-h-0" : "hidden"}>
            <ErrorBoundary name="Collection Runner">
              <RunnerView />
            </ErrorBoundary>
          </div>
          
          <div className={activeView === 'automation' ? "h-full w-full flex flex-col min-h-0" : "hidden"}>
            <ErrorBoundary name="Automation Builder">
              <AutomationView onManageEnvClick={() => setIsEnvManagerOpen(true)} />
            </ErrorBoundary>
          </div>
          
          <div className={activeView === 'security' ? "h-full w-full flex flex-col min-h-0" : "hidden"}>
            <ErrorBoundary name="Security Hub">
              <SecurityHub onManageEnvClick={() => setIsEnvManagerOpen(true)} />
            </ErrorBoundary>
          </div>
          
          <div className={activeView === 'performance' ? "h-full w-full flex flex-col min-h-0" : "hidden"}>
            <ErrorBoundary name="Performance Hub">
              <PerformanceHub />
            </ErrorBoundary>
          </div>

          <div className={!['runner', 'automation', 'security', 'performance'].includes(activeView) ? "h-full w-full flex flex-col min-h-0" : "hidden"}>
            <div data-tauri-drag-region className="flex items-end justify-between bg-panel-bg pr-4 pl-0 h-[44px] border-b border-border-strong shrink-0">
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
                  <div className="pl-3 pr-4 h-[54px] flex items-center space-x-3 border-b border-border-subtle shrink-0 min-w-0">
                    <div className="flex-1 min-w-0 flex items-center bg-transparent border border-border-strong rounded-md focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition-all h-[36px]">
                      <div className="relative border-r border-border-strong flex items-center w-[100px] shrink-0 h-full">
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
                      className={`flex shrink-0 items-center justify-center space-x-1.5 px-4 h-[36px] rounded-md text-sm font-medium transition-all active:scale-95 ${
                        isLoading 
                          ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" 
                          : "bg-accent hover:bg-accent-hover text-white"
                      }`}
                    >
                      {isLoading ? (
                        <>
                          <span>Cancel</span>
                          <Loader2 size={14} className="animate-spin" />
                        </>
                      ) : (
                        <>
                          <span>Send</span>
                          <Send size={14} />
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex-1 min-h-0">
                    <Group orientation="vertical">
                      <RequestEditor 
                        setLocalUrl={setLocalUrl} 
                        localUrl={localUrl}
                        localMethod={localMethod}
                      />

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
          </div>
        </Panel>
      </Group>
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-xl border z-[9999] flex items-center gap-2 transform transition-all ${toast.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-500' :
            toast.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-500' :
              'bg-surface-bg border-border-strong text-text-primary'
          }`}>
          {toast.type === 'success' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>}
          {toast.type === 'error' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
      <WhatsNewModal />
      </div>
    </div>
  );
}
