import { useState } from 'react';
import { Panel } from 'react-resizable-panels';
import { KeyValueEditor } from './KeyValueEditor';
import { AuthEditor } from './AuthEditor';
import { BodyEditor } from './BodyEditor';
import { Braces } from 'lucide-react';

import { JsonEditor } from './JsonEditor';
import { useStore } from '../store';
import { getQueryParams, setQueryParams, COMMON_HEADERS } from '../utils/url';

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
                value={activeRequest?.preRequestScript || ''}
                onChange={(val) => updateActiveRequest({ preRequestScript: val })}
              />
              {!activeRequest?.preRequestScript && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6 z-10">
                   <div className="bg-surface-bg/80 backdrop-blur-md border border-border-strong p-6 rounded-xl shadow-2xl pointer-events-auto max-w-md w-full animate-fade-in">
                     <h3 className="text-text-primary font-semibold mb-2 flex items-center gap-2">
                       <span className="text-accent">⚡</span> Pre-request Script
                     </h3>
                     <p className="text-text-secondary text-[13px] mb-4 leading-relaxed">
                       Write JavaScript that runs before the request is sent. Use the <code className="text-accent bg-accent/10 px-1 py-0.5 rounded border border-accent/20">pigeon</code> object to set variables or modify headers dynamically.
                     </p>
                     <div className="bg-[#1e1e1e] border border-border-strong p-3 rounded-lg text-[11px] font-mono text-gray-300 whitespace-pre overflow-x-auto shadow-inner">
{`// Generate a timestamp and set it as a variable
const timestamp = Date.now();
pigeon.env.set("req_time", timestamp.toString());

// You can use {{req_time}} in your URL or headers!`}
                     </div>
                     <button 
                       onClick={() => updateActiveRequest({ preRequestScript: '// Generate a timestamp and set it as a variable\nconst timestamp = Date.now();\npigeon.env.set("req_time", timestamp.toString());\n' })}
                       className="mt-4 w-full bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 py-2 rounded-lg text-[13px] font-medium transition-colors"
                     >
                       Insert Example
                     </button>
                   </div>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'tests' && (
          <div className="absolute inset-0 bg-app-bg flex relative">
            <div className="flex-1 w-full h-full relative">
              <JsonEditor 
                language="javascript"
                value={activeRequest?.testScript || ''}
                onChange={(val) => updateActiveRequest({ testScript: val })}
              />
              {!activeRequest?.testScript && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6 z-10">
                   <div className="bg-surface-bg/80 backdrop-blur-md border border-border-strong p-6 rounded-xl shadow-2xl pointer-events-auto max-w-md w-full animate-fade-in">
                     <h3 className="text-text-primary font-semibold mb-2 flex items-center gap-2">
                       <span className="text-green-500">✓</span> Test Script
                     </h3>
                     <p className="text-text-secondary text-[13px] mb-4 leading-relaxed">
                       Write JavaScript that runs after the response is received. Validate data, check status codes, or save response data to variables.
                     </p>
                     <div className="bg-[#1e1e1e] border border-border-strong p-3 rounded-lg text-[11px] font-mono text-gray-300 whitespace-pre overflow-x-auto shadow-inner">
{`// Verify the request was successful
pigeon.test("Status code is 200", () => {
  pigeon.expect(pigeon.response.status).toEqual(200);
});

// Extract data from the response and save it
const data = pigeon.response.json();
if (data && data.token) {
  pigeon.env.set("auth_token", data.token);
}`}
                     </div>
                     <button 
                       onClick={() => updateActiveRequest({ testScript: '// Verify the request was successful\npigeon.test("Status code is 200", () => {\n  pigeon.expect(pigeon.response.status).toEqual(200);\n});\n\n// Extract data from the response and save it\nconst data = pigeon.response.json();\nif (data && data.token) {\n  pigeon.env.set("auth_token", data.token);\n}\n' })}
                       className="mt-4 w-full bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/30 py-2 rounded-lg text-[13px] font-medium transition-colors"
                     >
                       Insert Example
                     </button>
                   </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
