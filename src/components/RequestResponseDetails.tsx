import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { JsonEditor } from './JsonEditor';

interface RequestResponseDetailsProps {
  method: string;
  url?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string | null;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  statusCode?: number;
  responseTime?: number;
}

export function RequestResponseDetails(props: RequestResponseDetailsProps) {
  const [showCurl, setShowCurl] = useState(false);
  const [showResponseHeaders, setShowResponseHeaders] = useState(false);
  const [showResponseBody, setShowResponseBody] = useState(false);
  
  // Format body if JSON
  const formatBody = (body?: string | null) => {
    if (!body) return '';
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  };

  const safeUrl = props.url || '';

  // Build cURL
  let curlCmd = `curl -X ${props.method} "${safeUrl}"`;
  if (props.requestHeaders) {
    Object.entries(props.requestHeaders).forEach(([k, v]) => {
      curlCmd += ` \\\n  -H "${k}: ${v}"`;
    });
  }
  if (props.requestBody) {
    curlCmd += ` \\\n  -d '${props.requestBody.replace(/'/g, "'\\''")}'`;
  }

  return (
    <div className="space-y-4 text-left">
      {/* Request Section */}
      <div>
        <div 
          className="flex items-center space-x-2 text-[12px] font-bold text-text-muted cursor-pointer hover:text-text-primary transition-colors"
          onClick={() => setShowCurl(!showCurl)}
        >
          {showCurl ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>Request (cURL)</span>
        </div>
        {showCurl && (
          <div className="mt-2 relative">
            <pre className="p-3 text-[11px] font-mono bg-app-bg text-text-secondary overflow-x-auto border-l-2 border-accent">
              {curlCmd}
            </pre>
            <button 
              onClick={() => navigator.clipboard.writeText(curlCmd)}
              className="absolute top-2 right-2 p-1.5 bg-surface-bg hover:bg-surface-hover text-text-muted rounded transition-colors"
            >
              <Copy size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Response Section */}
      {(props.responseBody !== undefined || props.responseHeaders) && (
        <div className="space-y-3">
          {props.responseHeaders && Object.keys(props.responseHeaders).length > 0 && (
            <div>
              <div 
                className="flex items-center space-x-2 text-[12px] font-bold text-text-muted cursor-pointer hover:text-text-primary transition-colors"
                onClick={() => setShowResponseHeaders(!showResponseHeaders)}
              >
                {showResponseHeaders ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>Response Headers</span>
              </div>
              {showResponseHeaders && (
                <div className="mt-2 p-3 text-[11px] font-mono bg-app-bg text-text-secondary overflow-x-auto border-l-2 border-border-strong">
                  {Object.entries(props.responseHeaders).map(([k, v]) => (
                    <div key={k} className="flex">
                      <span className="text-text-primary w-1/3 truncate pr-2">{k}:</span>
                      <span className="w-2/3 break-all">{v as React.ReactNode}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {props.responseBody !== undefined && (
            <div>
              <div 
                className="flex items-center space-x-2 text-[12px] font-bold text-text-muted cursor-pointer hover:text-text-primary transition-colors"
                onClick={() => setShowResponseBody(!showResponseBody)}
              >
                {showResponseBody ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>Response Body</span>
                {props.statusCode && (
                  <span className={`ml-2 font-mono font-medium ${props.statusCode >= 200 && props.statusCode < 300 ? 'text-green-400' : 'text-red-400'}`}>
                    {props.statusCode} {props.responseTime ? `(${props.responseTime}ms)` : ''}
                  </span>
                )}
              </div>
              {showResponseBody && (
                <div className="mt-2 h-[250px] border border-border-subtle/30 shadow-inner overflow-hidden relative rounded-md" style={{ minHeight: '150px' }}>
                  <JsonEditor 
                    value={formatBody(props.responseBody)} 
                    readOnly={true} 
                    bgType="panel"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
