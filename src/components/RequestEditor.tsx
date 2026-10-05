import { useState } from 'react';
import { Panel } from 'react-resizable-panels';
import { KeyValueEditor } from './KeyValueEditor';
import { AuthEditor } from './AuthEditor';
import { BodyEditor } from './BodyEditor';
import { Braces, Shield } from 'lucide-react';

import { JsonEditor } from './JsonEditor';
import { SecurityPanel } from './SecurityPanel';
import { resolveEnvVariables } from '../utils/env';
import { useStore } from '../store';
import { createSecretReference, deleteSecret, getSecret, setSecret } from '../utils/secrets';
import { deleteUnusedRequestSecrets, requestSecretIsShared } from '../utils/authSecrets';
import { getQueryParams, setQueryParams, getPathVariables, COMMON_HEADERS } from '../utils/url';

const DEFAULT_PRE_REQUEST = `// Write JavaScript that runs before the request is sent.
// Use the 'pigeon' object to set variables or modify headers.

// Example: Generate a timestamp and set it as a variable
// const timestamp = Date.now();
// pigeon.env.set("req_time", timestamp.toString());
`;

const DEFAULT_TEST_SCRIPT = `// Write JavaScript that runs after the response is received.
// Validate data, check status codes, or save response data.

// Example: Verify the request was successful
// pigeon.test("Status code is 200", () => {
//   pigeon.expect(pigeon.response.status).toEqual(200);
// });

// Example: Extract data from the response and save it
// const data = pigeon.response.json();
// if (data && data.token) {
//   pigeon.env.set("auth_token", data.token);
// }
`;

interface RequestEditorProps {
  setLocalUrl: (url: string) => void;
  localUrl: string;
  localMethod: string;
}

export function RequestEditor({ setLocalUrl, localUrl, localMethod }: RequestEditorProps) {
  const activeRequest = useStore(state => state.getActiveRequest());
  const updateActiveRequest = useStore(state => state.updateActiveRequest);
  const updateRequest = useStore(state => state.updateRequest);

  const [activeTab, setActiveTab] = useState('req-headers');
  const [isBulk, setIsBulk] = useState(false);
  const [keyColumnWidth, setKeyColumnWidth] = useState(250);
  const [authorizationDraftState, setAuthorizationDraftState] = useState({ requestId: activeRequest?.id || '', value: '' });
  const authorizationDraft = authorizationDraftState.requestId === activeRequest?.id ? authorizationDraftState.value : '';

  const setAuthorizationDraft = (value: string, requestId = activeRequest?.id || '') => {
    setAuthorizationDraftState({ requestId, value });
  };

  const findRequest = (requestId: string) => useStore.getState().collections
    .flatMap(collection => collection.requests)
    .find(request => request.id === requestId);

  const saveAuthorizationHeader = async (headerKey: string, value: string) => {
    if (!activeRequest || headerKey.toLowerCase() !== 'authorization' || !value) return;
    const requestId = activeRequest.id;
    let createdReference: string | undefined;
    try {
      const request = findRequest(requestId);
      if (!request) throw new Error('Request was removed before the Authorization header could be saved.');
      const previousReference = request.authorizationHeaderKeychainRef;
      const shared = previousReference && requestSecretIsShared(useStore.getState().collections, requestId, previousReference);
      const reference = previousReference && !shared ? previousReference : createSecretReference();
      if (reference !== previousReference) createdReference = reference;
      await setSecret('request-auth', reference, value);
      const latestRequest = findRequest(requestId);
      if (!latestRequest) {
        if (createdReference) await deleteSecret('request-auth', createdReference);
        throw new Error('Request was removed before the Authorization header could be attached.');
      }
      const headers = Object.fromEntries(Object.entries(latestRequest.headers)
        .filter(([key]) => key.toLowerCase() !== 'authorization'));
      updateRequest(requestId, {
        headers,
        authorizationHeaderInKeychain: true,
        authorizationHeaderKeychainRef: reference
      });
      setAuthorizationDraft('', requestId);
      if (previousReference && previousReference !== reference) {
        await deleteUnusedRequestSecrets(useStore.getState().collections, [{
          ...latestRequest,
          authorizationHeaderKeychainRef: previousReference
        }]);
      }
      useStore.getState().showToast('Authorization header saved to the system keychain', 'success');
    } catch (error) {
      useStore.getState().showToast(`Failed to save Authorization header: ${String(error)}`, 'error');
    }
  };

  const toggleAuthorizationSecret = async (headerKey: string, enabled: boolean, currentValue: string) => {
    if (!activeRequest) return;
    const requestId = activeRequest.id;
    try {
      const request = findRequest(requestId);
      if (!request) return;
      const previousReference = request.authorizationHeaderKeychainRef;
      const headerName = Object.keys(request.headers).find(key => key.toLowerCase() === 'authorization') || headerKey || 'Authorization';

      if (enabled) {
        if (!currentValue) {
          useStore.getState().showToast('Enter an Authorization value before saving it to the system keychain.', 'error');
          return;
        }
        const headers = Object.fromEntries(Object.entries(request.headers)
          .filter(([key]) => key.toLowerCase() !== 'authorization'));
        const reference = createSecretReference();
        await setSecret('request-auth', reference, currentValue);
        updateRequest(requestId, {
          headers,
          authorizationHeaderInKeychain: true,
          authorizationHeaderKeychainRef: reference
        });
        if (previousReference) {
          await deleteUnusedRequestSecrets(useStore.getState().collections, [{ ...request, authorizationHeaderKeychainRef: previousReference }]);
        }
        setAuthorizationDraft('', requestId);
        return;
      }

      const pendingValue = authorizationDraftState.requestId === requestId ? authorizationDraftState.value : '';
      const storedValue = pendingValue || (previousReference ? await getSecret('request-auth', previousReference) : '');
      if (previousReference && storedValue === null) {
        throw new Error('Authorization header is missing from the system keychain.');
      }
      const headers = { ...request.headers, [headerName]: storedValue || '' };
      updateRequest(requestId, {
        headers,
        authorizationHeaderInKeychain: false,
        authorizationHeaderKeychainRef: undefined
      });
      if (previousReference) {
        await deleteUnusedRequestSecrets(useStore.getState().collections, [{ ...request, authorizationHeaderKeychainRef: previousReference }]);
      }
      setAuthorizationDraft('', requestId);
    } catch (error) {
      useStore.getState().showToast(`Failed to update Authorization header: ${String(error)}`, 'error');
    }
  };

  const deleteAuthorizationSecret = async () => {
    if (!activeRequest) return;
    const requestId = activeRequest.id;
    const request = findRequest(requestId);
    if (!request) return;
    const previousReference = request.authorizationHeaderKeychainRef;
    const headers = Object.fromEntries(Object.entries(request.headers)
      .filter(([key]) => key.toLowerCase() !== 'authorization'));
    updateRequest(requestId, {
      headers,
      authorizationHeaderInKeychain: false,
      authorizationHeaderKeychainRef: undefined
    });
    setAuthorizationDraft('', requestId);
    if (previousReference) {
      try {
        await deleteUnusedRequestSecrets(useStore.getState().collections, [{ ...request, authorizationHeaderKeychainRef: previousReference }]);
      } catch (error) {
        useStore.getState().showToast(`Failed to remove Authorization header from keychain: ${String(error)}`, 'error');
      }
    }
  };

  const handleHeadersChange = (headers: Record<string, string>) => {
    if (activeRequest) updateRequest(activeRequest.id, { headers });
  };

  return (
    <Panel defaultSize={50} minSize={20} className="flex flex-col min-h-0 bg-app-bg">
      <div className="flex px-5 space-x-6 border-b border-border-subtle text-sm">
        <button 
          onClick={() => setActiveTab('req-params')}
          className={`py-3 font-medium transition-colors relative ${activeTab === 'req-params' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Params
          {activeTab === 'req-params' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-accent"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('req-auth')}
          className={`py-3 font-medium transition-colors relative ${activeTab === 'req-auth' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Auth
          {activeRequest?.auth && activeRequest.auth.type !== 'none' && (
            <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-accent inline-block"></span>
          )}
          {activeTab === 'req-auth' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-accent"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('req-headers')}
          className={`py-3 font-medium transition-colors relative ${activeTab === 'req-headers' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Headers 
          {activeRequest?.headers && Object.keys(activeRequest.headers).length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-surface-hover text-[10px] text-text-muted">
              {Object.keys(activeRequest.headers).length}
            </span>
          )}
          {activeTab === 'req-headers' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-accent"></div>}
        </button>
          <button 
          onClick={() => setActiveTab('req-body')}
          className={`py-3 font-medium transition-colors relative ${activeTab === 'req-body' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Body
          {activeRequest?.body && (typeof activeRequest.body === 'string' || activeRequest.body.type !== 'none') && (
            <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
          )}
          {activeTab === 'req-body' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-accent"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('pre-request')}
          className={`py-3 font-medium transition-colors relative ${activeTab === 'pre-request' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Pre-request
          {activeTab === 'pre-request' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-accent"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('tests')}
          className={`py-3 font-medium transition-colors relative ${activeTab === 'tests' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Tests
          {activeTab === 'tests' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-accent"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('security')}
          className={`py-3 font-medium flex items-center space-x-1.5 transition-colors relative ${activeTab === 'security' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
        >
          <Shield size={14} className={activeTab === 'security' ? 'text-accent' : 'text-text-secondary'} />
          <span>DevSecOps</span>
          {activeTab === 'security' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-accent"></div>}
        </button>

        {(activeTab === 'req-params' || activeTab === 'req-headers' || (activeTab === 'req-body' && typeof activeRequest?.body === 'object' && (activeRequest?.body?.type === 'form-data' || activeRequest?.body?.type === 'x-www-form-urlencoded'))) && (
          <button 
            onClick={() => setIsBulk(!isBulk)}
            className={`ml-auto py-3 text-xs font-medium transition-colors ${isBulk ? 'text-accent hover:text-accent-hover' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {isBulk ? 'Key-Value Edit' : 'Bulk Edit'}
          </button>
        )}
        {activeTab === 'req-body' && (
          <button 
            onClick={() => {
              if (activeRequest?.body) {
                try {
                  let bodyStr = '';
                  if (typeof activeRequest.body === 'string') {
                    bodyStr = activeRequest.body;
                    const parsed = JSON.parse(bodyStr);
                    updateActiveRequest({ body: { type: 'raw', raw: JSON.stringify(parsed, null, 2), rawLanguage: 'json' } });
                  } else if (activeRequest.body.type === 'raw' && activeRequest.body.raw) {
                    bodyStr = activeRequest.body.raw;
                    const parsed = JSON.parse(bodyStr);
                    updateActiveRequest({ body: { ...activeRequest.body, raw: JSON.stringify(parsed, null, 2) } });
                  }
                } catch (e) {
                  useStore.getState().showToast('Invalid JSON: Cannot beautify', 'error');
                }
              }
            }}
            className="ml-auto py-3 text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center group relative"
            title="Format JSON Body"
          >
            <Braces size={16} />
          </button>
        )}
      </div>
      
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {activeTab === 'req-params' && (
          <div className="h-full flex flex-col overflow-y-auto">
            {(() => {
              const pathVars = getPathVariables(activeRequest?.url || '');
              return pathVars.length > 0 ? (
                <div className="flex-shrink-0 pt-2 pb-0">
                  <h3 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider px-4 mb-2">Path Variables</h3>
                  <div className="px-2">
                    <KeyValueEditor
                      items={activeRequest?.pathParams || {}}
                      onChange={(newParams: Record<string, string>) => {
                        updateActiveRequest({ pathParams: newParams });
                      }}
                      fixedKeys={pathVars}
                      keyColumnWidth={keyColumnWidth}
                      onKeyColumnWidthChange={setKeyColumnWidth}
                    />
                  </div>
                  <div className="h-px bg-border-subtle mx-4 mt-2 mb-2"></div>
                </div>
              ) : null;
            })()}
            <div className="flex-1 min-h-[200px] flex flex-col">
              {getPathVariables(activeRequest?.url || '').length > 0 && (
                <h3 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider px-4 mt-2 mb-2 flex-shrink-0">Query Parameters</h3>
              )}
              <KeyValueEditor 
                items={getQueryParams(activeRequest?.url || '')} 
                onChange={(newParams: Record<string, string>) => {
                  const newUrl = setQueryParams(activeRequest?.url || '', newParams);
                  setLocalUrl(newUrl);
                  updateActiveRequest({
                    url: newUrl,
                    disabledParams: (activeRequest?.disabledParams || []).filter(key => Object.hasOwn(newParams, key))
                  });
                }}
                disabledKeys={activeRequest?.disabledParams}
                onDisabledKeysChange={disabledParams => updateActiveRequest({ disabledParams })}
                keyColumnWidth={keyColumnWidth}
                onKeyColumnWidthChange={setKeyColumnWidth}
                isBulk={isBulk}
              />
            </div>
          </div>
        )}
        {activeTab === 'req-auth' && (
          <AuthEditor 
            key={activeRequest?.id || 'no-request'}
            requestId={activeRequest?.id || ''}
            auth={activeRequest?.auth}
          />
        )}
        {activeTab === 'req-headers' && (
          <div className="flex flex-col h-full min-h-0">
            <KeyValueEditor
              items={activeRequest?.headers || {}}
              onChange={handleHeadersChange}
              disabledKeys={activeRequest?.disabledHeaders}
              onDisabledKeysChange={disabledHeaders => updateActiveRequest({ disabledHeaders })}
              keyColumnWidth={keyColumnWidth}
              onKeyColumnWidthChange={setKeyColumnWidth}
              keySuggestions={COMMON_HEADERS}
              isBulk={isBulk}
              secretKeys={activeRequest?.authorizationHeaderInKeychain ? ['Authorization'] : []}
              secretValues={{ Authorization: authorizationDraft }}
              secretPlaceholder={activeRequest?.authorizationHeaderKeychainRef ? 'Stored in system keychain' : 'Enter secret value'}
              onSecretToggle={toggleAuthorizationSecret}
              onSecretValueChange={(_key, value) => setAuthorizationDraft(value)}
              onSecretSave={saveAuthorizationHeader}
              onSecretDelete={deleteAuthorizationSecret}
            />
          </div>
        )}
        {activeTab === 'req-body' && (
          <div className="absolute inset-0 bg-app-bg">
            <BodyEditor 
              body={activeRequest?.body}
              onChange={(val) => updateActiveRequest({ body: val })}
              isBulk={isBulk}
              keyColumnWidth={keyColumnWidth}
              onKeyColumnWidthChange={setKeyColumnWidth}
            />
          </div>
        )}
        {activeTab === 'pre-request' && (
          <div className="absolute inset-0 bg-app-bg">
            <JsonEditor 
              language="javascript"
              value={activeRequest?.preRequestScript || DEFAULT_PRE_REQUEST}
              onChange={(val) => updateActiveRequest({ preRequestScript: val })}
            />
          </div>
        )}
        {activeTab === 'tests' && (
          <div className="absolute inset-0 bg-app-bg">
            <JsonEditor 
              language="javascript"
              value={activeRequest?.testScript || DEFAULT_TEST_SCRIPT}
              onChange={(val) => updateActiveRequest({ testScript: val })}
            />
          </div>
        )}
        {activeTab === 'security' && (
          <div className="absolute inset-0 bg-app-bg z-10">
            <SecurityPanel 
              requestContext={
                activeRequest ? {
                  url: resolveEnvVariables(localUrl, useStore.getState().environments.find(e => e.id === useStore.getState().activeEnvironmentId)),
                  method: localMethod,
                  headers: Object.fromEntries(
                    Object.entries(activeRequest.headers || {})
                      .filter(([key]) => !activeRequest.disabledHeaders?.includes(key))
                      .map(([k, v]) => [
                        resolveEnvVariables(k, useStore.getState().environments.find(e => e.id === useStore.getState().activeEnvironmentId)),
                        resolveEnvVariables(v as string, useStore.getState().environments.find(e => e.id === useStore.getState().activeEnvironmentId))
                      ])
                  ),
                  body: activeRequest.body && typeof activeRequest.body === 'object' && activeRequest.body.type === 'raw' && activeRequest.body.raw 
                    ? (() => {
                        try {
                          return JSON.parse(resolveEnvVariables((activeRequest.body as any).raw, useStore.getState().environments.find(e => e.id === useStore.getState().activeEnvironmentId)));
                        } catch {
                          return undefined;
                        }
                      })()
                    : undefined
                } : null
              }
            />
          </div>
        )}
      </div>
    </Panel>
  );
}
