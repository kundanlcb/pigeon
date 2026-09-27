import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { parseCurl, exportCurl } from '../utils/curl';
import { useStore } from '../store';
import type { RequestItem } from '../store';

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

  // When modal opens in export mode, generate the curl string
  React.useEffect(() => {
    if (isOpen && mode === 'export' && request) {
      setCurlText(exportCurl(request));
      setCopied(false);
    } else if (isOpen && mode === 'import') {
      setCurlText('');
    }
  }, [isOpen, mode, request]);

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-panel-bg border border-border-strong rounded-xl w-[600px] max-w-[90vw] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-bg">
          <h2 className="text-lg font-semibold text-text-primary">
            {mode === 'import' ? 'Import Request' : 'Export cURL'}
          </h2>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1">
          {mode === 'import' ? (
            <p className="text-sm text-text-secondary mb-4">
              Paste your Postman snippet or cURL command below to create a new request in your collection.
            </p>
          ) : (
            <p className="text-sm text-text-secondary mb-4">
              Here is the cURL command for your current request:
            </p>
          )}

          <div className="relative group">
            <textarea 
              value={curlText}
              onChange={(e) => setCurlText(e.target.value)}
              readOnly={mode === 'export'}
              placeholder="curl -X GET 'https://api.example.com'"
              className="w-full h-48 bg-surface-bg border border-border-strong rounded-lg p-4 font-mono text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none transition-all leading-relaxed"
              spellCheck={false}
            />
            {mode === 'export' && (
              <button 
                onClick={handleCopy}
                className="absolute top-3 right-3 p-2 bg-panel-bg border border-border-strong rounded-md shadow-sm text-text-secondary hover:text-text-primary hover:border-border-subtle transition-all active:scale-95"
                title="Copy to clipboard"
              >
                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-surface-bg border-t border-border-subtle flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            {mode === 'export' ? 'Close' : 'Cancel'}
          </button>
          
          {mode === 'import' && (
            <button 
              onClick={handleImport}
              className="px-6 py-2 rounded-lg text-sm font-medium bg-accent hover:bg-accent-hover text-white transition-all shadow-md active:scale-95 disabled:opacity-50"
              disabled={!curlText.trim()}
            >
              Import
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
