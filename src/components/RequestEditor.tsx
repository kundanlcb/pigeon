import { useState } from 'react';
import { Panel } from 'react-resizable-panels';
import { KeyValueEditor } from './KeyValueEditor';
import { AuthEditor } from './AuthEditor';
import { BodyEditor } from './BodyEditor';
import { Braces } from 'lucide-react';

import { JsonEditor } from './JsonEditor';
import { useStore } from '../store';
import { createSecretReference, deleteSecret, setSecret } from '../utils/secrets';
import { deleteUnusedRequestSecrets, requestSecretIsShared } from '../utils/authSecrets';
import { getQueryParams, setQueryParams, COMMON_HEADERS } from '../utils/url';

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
}

export function RequestEditor({ setLocalUrl }: RequestEditorProps) {
  const activeRequest = useStore(state => state.getActiveRequest());
  const updateActiveRequest = useStore(state => state.updateActiveRequest);
  const updateRequest = useStore(state => state.updateRequest);

  const [activeTab, setActiveTab] = useState('req-headers');
  const [isBulk, setIsBulk] = useState(false);
  const [keyColumnWidth, setKeyColumnWidth] = useState(250);
  const [authorizationDraftState, setAuthorizationDraftState] = useState({ requestId: activeRequest?.id || '', value: '' });
  const authorizationDraft = authorizationDraftState.requestId === activeRequest?.id ? authorizationDraftState.value : '';
  const [isSavingAuthorization, setIsSavingAuthorization] = useState(false);

  const setAuthorizationDraft = (value: string, requestId = activeRequest?.id || '') => {
    setAuthorizationDraftState({ requestId, value });
  };

  const saveAuthorizationHeader = async () => {
    if (!activeRequest || !authorizationDraft) return;
    const requestId = activeRequest.id;
    const value = authorizationDraft;
    setIsSavingAuthorization(true);
    try {
      const reference = createSecretReference();
      await setSecret('request-auth', reference, value);
      const request = useStore.getState().collections.flatMap(collection => collection.requests).find(item => item.id === requestId);
      if (!request) {
        await deleteSecret('request-auth', reference);
        throw new Error('Request was removed before the Authorization header could be attached.');
      }
      const previousReference = request.authorizationHeaderKeychainRef;
      const headers = Object.fromEntries(Object.entries(request.headers)
        .filter(([key]) => key.toLowerCase() !== 'authorization'));
      updateRequest(requestId, {
        headers,
        authorizationHeaderInKeychain: true,
        authorizationHeaderKeychainRef: reference
      });
      setAuthorizationDraft('', requestId);
      if (previousReference) {
        await deleteUnusedRequestSecrets(useStore.getState().collections, [{
          ...request,
          authorizationHeaderKeychainRef: previousReference
        }]);
      }
      useStore.getState().showToast('Authorization header saved to the system keychain', 'success');
    } catch (error) {
      useStore.getState().showToast(`Failed to save Authorization header: ${String(error)}`, 'error');
    } finally {
      setIsSavingAuthorization(false);
    }
  };

  const removeAuthorizationHeader = async () => {
    if (!activeRequest) return;
    const requestId = activeRequest.id;
    const previousReference = activeRequest.authorizationHeaderKeychainRef;
    if (previousReference) {
      try {
        const state = useStore.getState();
        if (!requestSecretIsShared(state.collections, requestId, previousReference)) {
          await deleteSecret('request-auth', previousReference);
        }
      } catch (error) {
        useStore.getState().showToast(`Failed to remove Authorization header: ${String(error)}`, 'error');
        return;
      }
    }
    updateRequest(requestId, { authorizationHeaderInKeychain: false, authorizationHeaderKeychainRef: undefined });
    useStore.getState().showToast('Authorization header removed', 'success');
  };

  const handleHeadersChange = (headers: Record<string, string>) => {
    const authorizationKey = Object.keys(headers).find(key => key.toLowerCase() === 'authorization');
    if (authorizationKey) {
      const value = headers[authorizationKey];
      if (value && !/^\{\{\s*[^{}]+\s*\}\}$/.test(value.trim())) {
        delete headers[authorizationKey];
        useStore.getState().showToast('Enter literal Authorization values in the secure field above.', 'error');
      }
    }
    if (activeRequest) updateRequest(activeRequest.id, { headers });
  };

  return (
    <Panel defaultSize={50} minSize={20} className="flex flex-col min-h-0 bg-app-bg">
      <div className="flex px-4 space-x-6 border-b border-border-subtle text-sm">
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

        {(activeTab === 'req-params' || activeTab === 'req-headers') && (
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
            <div className="px-2 pt-2">
              <div className="flex flex-wrap items-center gap-2 border border-border-subtle rounded-md px-3 py-1.5">
                <div className="flex flex-1 min-w-[180px] items-center gap-2">
                  <label className="shrink-0 text-[11px] font-semibold text-text-secondary">Authorization</label>
                  <input
                    type="password"
                    value={authorizationDraft}
                    onChange={event => setAuthorizationDraft(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') void saveAuthorizationHeader(); }}
                    placeholder={activeRequest?.authorizationHeaderInKeychain ? 'Replace stored value' : 'Enter a private header value'}
                    className="min-w-0 flex-1 bg-transparent text-xs font-mono text-text-primary outline-none"
                    autoComplete="new-password"
                    spellCheck={false}
                  />
                </div>
                {authorizationDraft && (
                  <button
                    type="button"
                    disabled={isSavingAuthorization}
                    onClick={() => void saveAuthorizationHeader()}
                    className="px-2.5 py-1.5 bg-accent text-white rounded text-xs disabled:opacity-50"
                  >
                    {isSavingAuthorization ? 'Saving...' : 'Save to Keychain'}
                  </button>
                )}
                {activeRequest?.authorizationHeaderInKeychain && (
                  <>
                    <span className="text-[11px] text-text-muted">Stored in system keychain</span>
                    <button type="button" onClick={() => void removeAuthorizationHeader()} className="text-xs text-red-500 hover:text-red-400">Remove</button>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <KeyValueEditor
                items={activeRequest?.headers || {}}
                onChange={handleHeadersChange}
                disabledKeys={activeRequest?.disabledHeaders}
                onDisabledKeysChange={disabledHeaders => updateActiveRequest({ disabledHeaders })}
                keyColumnWidth={keyColumnWidth}
                onKeyColumnWidthChange={setKeyColumnWidth}
                keySuggestions={COMMON_HEADERS}
                isBulk={isBulk}
              />
            </div>
          </div>
        )}
        {activeTab === 'req-body' && (
          <div className="absolute inset-0 bg-app-bg">
            <BodyEditor 
              body={activeRequest?.body}
              onChange={(val) => updateActiveRequest({ body: val })}
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
      </div>
    </Panel>
  );
}
