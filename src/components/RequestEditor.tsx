import { useState } from 'react';
import { Panel } from 'react-resizable-panels';
import { KeyValueEditor } from './KeyValueEditor';
import { AuthEditor } from './AuthEditor';
import { BodyEditor } from './BodyEditor';
import { Braces } from 'lucide-react';

import { JsonEditor } from './JsonEditor';
import { useStore } from '../store';
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

  const [activeTab, setActiveTab] = useState('req-headers');
  const [isBulk, setIsBulk] = useState(false);

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
      
      <div className={`flex-1 relative ${activeTab === 'req-body' || activeTab === 'pre-request' || activeTab === 'tests' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {activeTab === 'req-params' && (
          <KeyValueEditor 
            items={getQueryParams(activeRequest?.url || '')} 
            onChange={(newParams: Record<string, string>) => {
              const newUrl = setQueryParams(activeRequest?.url || '', newParams);
              setLocalUrl(newUrl);
              updateActiveRequest({ url: newUrl });
            }}
            isBulk={isBulk}
          />
        )}
        {activeTab === 'req-auth' && (
          <AuthEditor 
            auth={activeRequest?.auth}
            onChange={(newAuth) => updateActiveRequest({ auth: newAuth })}
          />
        )}
        {activeTab === 'req-headers' && (
          <KeyValueEditor 
            items={activeRequest?.headers || {}} 
            onChange={(newHeaders: Record<string, string>) => updateActiveRequest({ headers: newHeaders })}
            keySuggestions={COMMON_HEADERS}
            isBulk={isBulk}
          />
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
          <div className="absolute inset-0 bg-app-bg flex relative">
            <div className="flex-1 w-full h-full relative">
              <JsonEditor 
                language="javascript"
                value={activeRequest?.preRequestScript || DEFAULT_PRE_REQUEST}
                onChange={(val) => updateActiveRequest({ preRequestScript: val })}
              />
            </div>
          </div>
        )}
        {activeTab === 'tests' && (
          <div className="absolute inset-0 bg-app-bg flex relative">
            <div className="flex-1 w-full h-full relative">
              <JsonEditor 
                language="javascript"
                value={activeRequest?.testScript || DEFAULT_TEST_SCRIPT}
                onChange={(val) => updateActiveRequest({ testScript: val })}
              />
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
