import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DangerConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  warningText: string;
  targetUrls: string[];
  requireTyping?: boolean;
  expectedTypeMatch?: string;
  confirmButtonText?: string;
}

export function DangerConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  warningText,
  targetUrls,
  requireTyping = false,
  expectedTypeMatch = '',
  confirmButtonText = 'Confirm'
}: DangerConfirmationModalProps) {
  const [typedValue, setTypedValue] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireTyping && typedValue !== expectedTypeMatch) return;
    onConfirm();
    setTypedValue('');
  };

  const isConfirmDisabled = requireTyping && typedValue !== expectedTypeMatch;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-panel-bg border border-border-strong rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-strong bg-surface-bg">
          <div className="flex items-center space-x-2 text-red-400 font-semibold text-sm">
            <AlertTriangle size={16} />
            <span>{title}</span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <p className="text-sm text-text-primary leading-relaxed">
            {warningText}
          </p>

          <div className="bg-app-bg border border-border-strong rounded p-3 space-y-1 max-h-32 overflow-y-auto">
            <div className="text-xs text-text-muted mb-1 font-semibold uppercase tracking-wider">Resolved Targets</div>
            {targetUrls.length === 0 ? (
              <div className="text-xs text-text-secondary font-mono italic">No targets selected</div>
            ) : (
              targetUrls.map((url, i) => (
                <div key={i} className="text-xs text-text-primary font-mono truncate">{url}</div>
              ))
            )}
          </div>

          {requireTyping && expectedTypeMatch && (
            <div className="space-y-2">
              <label className="text-xs text-text-secondary">
                Please type <span className="font-mono font-bold text-text-primary select-all">{expectedTypeMatch}</span> to confirm:
              </label>
              <input
                type="text"
                value={typedValue}
                onChange={(e) => setTypedValue(e.target.value)}
                className="w-full bg-app-bg border border-border-strong rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500 font-mono text-text-primary"
                placeholder={expectedTypeMatch}
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-4 py-3 border-t border-border-strong bg-surface-bg space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-all shadow-sm flex items-center space-x-2 ${
              isConfirmDisabled
                ? 'bg-surface-hover text-text-muted cursor-not-allowed opacity-50'
                : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            <span>{confirmButtonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
