import { useState } from 'react';
import { Panel } from 'react-resizable-panels';
import { KeyValueEditor } from './KeyValueEditor';
import { AuthEditor } from './AuthEditor';
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
          {activeRequest?.body && (
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
                  const parsed = JSON.parse(activeRequest.body);
                  updateActiveRequest({ body: JSON.stringify(parsed, null, 2) });
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
      
      <div className={`flex-1 relative ${activeTab === 'req-body' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
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
            <JsonEditor 
              value={activeRequest?.body || ''}
              onChange={(val) => updateActiveRequest({ body: val })}
            />
          </div>
        )}
        {activeTab === 'pre-request' && (
           <div className="p-4 text-sm text-text-muted italic">Pre-request scripts coming soon...</div>
        )}
      </div>
    </Panel>
  );
}
