import React, { useState } from 'react';
import { Panel } from 'react-resizable-panels';
import { Check, Copy, Code2 } from 'lucide-react';
import { isJsonString } from '../utils/syntax';
import { JsonEditor } from './JsonEditor';

interface ResponseViewerProps {
  response: any;
  isLoading: boolean;
}

export function ResponseViewer({ response, isLoading }: ResponseViewerProps) {
  const [activeResponseTab, setActiveResponseTab] = useState('preview');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!response) return;
    let textToCopy = '';
    if (activeResponseTab === 'preview') {
      textToCopy = response.data;
    } else if (activeResponseTab === 'headers') {
      textToCopy = Object.entries(response.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
    }
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Panel defaultSize={50} minSize={20} className="flex flex-col bg-panel-bg min-h-0">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle bg-panel-bg">
        <div className="flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <span className="text-text-muted">Status</span>
            <span className={`font-mono font-medium ${response?.status >= 200 && response?.status < 300 ? 'text-green-400' : response?.status ? 'text-red-400' : 'text-border-strong'}`}>
              {response ? `${response.status} ${response.statusText}` : '---'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-text-muted">Time</span>
            <span className={`${response ? 'text-text-primary' : 'text-border-strong'} font-mono font-medium`}>
              {response ? `${response.time} ms` : '0 ms'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-text-muted">Size</span>
            <span className={`${response ? 'text-text-primary' : 'text-border-strong'} font-mono font-medium`}>
              {response ? (response.size > 1024 ? `${(response.size / 1024).toFixed(1)} KB` : `${response.size} B`) : '0 B'}
            </span>
          </div>
        </div>
        <div className="flex space-x-2">
          <button className="p-1.5 rounded hover:bg-surface-hover text-text-secondary transition-colors" onClick={handleCopy} disabled={!response}>
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          </button>
          <button className="p-1.5 rounded hover:bg-surface-hover text-text-secondary transition-colors">
            <Code2 size={16} />
          </button>
        </div>
      </div>
      
      <div className="flex px-4 space-x-6 border-b border-border-subtle text-sm bg-panel-bg">
        <button 
          onClick={() => setActiveResponseTab('preview')}
          className={`py-2.5 font-medium relative ${activeResponseTab === 'preview' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary transition-colors'}`}
        >
          Preview
          {activeResponseTab === 'preview' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-accent"></div>}
        </button>
        <button 
          onClick={() => setActiveResponseTab('headers')}
          className={`py-2.5 font-medium relative ${activeResponseTab === 'headers' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary transition-colors'}`}
        >
          Headers
          {response?.headers && Object.keys(response.headers).length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-surface-hover text-[10px] text-text-muted">
              {Object.keys(response.headers).length}
            </span>
          )}
          {activeResponseTab === 'headers' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-accent"></div>}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto font-mono text-[13px] leading-relaxed relative">
        {response ? (
          activeResponseTab === 'preview' ? (
            isJsonString(response.data) ? (
              <div className="w-full h-full bg-panel-bg absolute inset-0">
                <JsonEditor value={response.data} readOnly={true} bgType="panel" />
              </div>
            ) : (
              <pre className="text-text-primary m-0 whitespace-pre-wrap p-4 w-full h-full">
                {response.data}
              </pre>
            )
          ) : (
            <div className="w-full text-[13px] font-mono">
              {Object.entries(response.headers || {}).map(([k, v]) => (
                <div key={k} className="flex border-b border-border-subtle last:border-0 hover:bg-surface-bg transition-colors">
                  <div className="w-1/3 py-2 px-3 text-text-secondary font-medium break-words border-r border-border-subtle">
                    {k}
                  </div>
                  <div className="w-2/3 py-2 px-3 text-text-primary break-all">
                    {v as React.ReactNode}
                  </div>
                </div>
              ))}
              {Object.keys(response.headers || {}).length === 0 && (
                <div className="text-text-muted italic py-4 text-center">No headers received.</div>
              )}
            </div>
          )
        ) : (
           <span className="text-text-muted italic flex h-full items-center justify-center w-full">
             {isLoading ? 'Sending request...' : 'Hit Send to execute the request'}
           </span>
        )}
      </div>
    </Panel>
  );
}
