import React, { useState } from 'react';
import { X, Copy, Check, AlertTriangle, Terminal } from 'lucide-react';
import { createPortal } from 'react-dom';
import { parseCurl, exportCurl } from '../utils/curl';
import { useStore } from '../store';
import type { RequestItem } from '../store';
import { MethodIcon } from './MethodIcon';

interface CurlModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'import' | 'export';
  request?: RequestItem; // Needed for export
  targetCollectionId?: string | null;
}

export function CurlModal({ isOpen, onClose, mode, request, targetCollectionId }: CurlModalProps) {
  const [curlText, setCurlText] = useState('');
  const [copied, setCopied] = useState(false);
  const collections = useStore(state => state.collections);
  const addRequest = useStore(state => state.addRequest);

  const [format, setFormat] = useState<'curl' | 'postman' | 'bruno'>('curl');
  const [parsedPreview, setParsedPreview] = useState<{ method?: string, url?: string, headersCount?: number, hasBody?: boolean } | null>(null);

  // When modal opens in export mode, generate the curl string
  React.useEffect(() => {
    if (isOpen && mode === 'export' && request) {
      if (format === 'curl') {
        setCurlText(exportCurl(request));
      } else if (format === 'postman') {
        setCurlText('{\n  "info": { "name": "Postman Export (Coming soon)" }\n}');
      } else {
        setCurlText('meta {\n  name: Bruno Export (Coming soon)\n}');
      }
      setCopied(false);
    } else if (isOpen && mode === 'import') {
      setCurlText('');
      setParsedPreview(null);
    }
  }, [isOpen, mode, request, format]);

  React.useEffect(() => {
    if (mode === 'import' && curlText.trim()) {
      try {
        const parsed = parseCurl(curlText);
        setParsedPreview({
          method: parsed.method || 'GET',
          url: parsed.url,
          headersCount: Object.keys(parsed.headers || {}).length,
          hasBody: !!parsed.body
        });
      } catch {
        setParsedPreview(null);
      }
    } else {
      setParsedPreview(null);
    }
  }, [curlText, mode]);

  if (!isOpen) return null;

  const handleImport = () => {
    if (!curlText.trim()) return;
    try {
      const parsed = parseCurl(curlText);
      if (parsed.url) {
        if (collections.length > 0) {
          const colId = targetCollectionId || collections[0].id;
          addRequest(colId, {
            name: 'Imported cURL',
            method: parsed.method || 'GET',
            url: parsed.url,
            headers: parsed.headers || {},
            body: parsed.body,
            auth: parsed.auth
          });
          onClose();
        } else {
          alert('No collection available to add the request.');
        }
      } else {
        alert('Could not find a valid URL in the cURL command.');
      }
    } catch {
      alert('Failed to parse cURL command.');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(curlText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-panel-bg border border-border-strong rounded-xl w-[600px] max-w-[90vw] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex flex-col border-b border-border-subtle bg-panel-bg">
          <div className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Terminal size={14} className="text-accent" />
              </div>
              <h2 className="text-[13px] font-semibold text-text-primary tracking-wide">
                {mode === 'import' ? 'Import Request' : 'Export Request'}
              </h2>
            </div>
            <button 
              onClick={onClose}
              className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          
          {/* Format Tabs */}
          <div className="flex items-center px-5 gap-4">
            {(['curl', 'postman', 'bruno'] as const).map(fmt => (
              <button
                key={fmt}
                onClick={() => setFormat(fmt)}
                className={`py-2 text-[12px] font-medium transition-colors border-b-2 relative top-[1px] ${
                  format === fmt 
                    ? 'text-accent border-accent' 
                    : 'text-text-muted border-transparent hover:text-text-secondary hover:border-text-secondary/30'
                }`}
              >
                {fmt === 'curl' ? 'cURL' : fmt === 'postman' ? 'Postman' : 'Bruno'}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-4 flex-1 bg-app-bg">
          <div className="relative group">
            <textarea 
              value={curlText}
              onChange={(e) => setCurlText(e.target.value)}
              readOnly={mode === 'export' || format !== 'curl'}
              placeholder={format === 'curl' ? "curl -X GET 'https://api.example.com'" : `${format} import coming soon...`}
              className={`w-full ${mode === 'export' ? 'h-40' : 'h-32'} bg-app-bg border border-border-strong rounded-lg p-3 font-mono text-[12px] text-text-secondary outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none transition-all leading-relaxed shadow-inner scrollbar-hide`}
              spellCheck={false}
            />
            {mode === 'export' && (
              <button 
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 bg-surface-hover border border-border-strong rounded shadow-sm text-text-secondary hover:text-text-primary hover:border-text-muted transition-all active:scale-95"
                title="Copy to clipboard"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            )}
          </div>

          {mode === 'import' && (
            <div className="mt-3">
              {parsedPreview && parsedPreview.url ? (
                <div className="p-2.5 bg-panel-bg border border-border-strong rounded-lg flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MethodIcon method={parsedPreview.method || 'GET'} size={12} />
                    <span className="text-[11.5px] font-mono text-zinc-200 truncate" title={parsedPreview.url}>
                      {parsedPreview.url}
                    </span>
                  </div>
                  <div className="flex gap-1.5 text-[10px] font-mono text-text-secondary shrink-0 ml-3">
                    {parsedPreview.headersCount ? <span className="bg-surface-bg px-1.5 py-0.5 rounded border border-border-subtle">{parsedPreview.headersCount} Headers</span> : null}
                    {parsedPreview.hasBody ? <span className="bg-surface-bg px-1.5 py-0.5 rounded border border-border-subtle">Body</span> : null}
                  </div>
                </div>
              ) : curlText.trim() ? (
                <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[11px] flex items-center shadow-sm">
                  <AlertTriangle size={12} className="mr-2" />
                  Invalid or unsupported cURL format
                </div>
              ) : (
                <div className="p-2.5 border border-dashed border-border-strong rounded-lg text-text-muted text-[11px] flex items-center justify-center bg-surface-bg/50">
                  Paste a valid cURL command above to see preview
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-panel-bg border-t border-border-subtle flex justify-end space-x-2">
          <button 
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            {mode === 'export' ? 'Close' : 'Cancel'}
          </button>
          
          {mode === 'import' && (
            <button 
              onClick={handleImport}
              className="px-4 py-1.5 rounded-md text-[12px] font-medium bg-accent hover:bg-accent-hover text-white transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center gap-1.5"
              disabled={!parsedPreview?.url}
            >
              <Terminal size={12} />
              Import Request
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
