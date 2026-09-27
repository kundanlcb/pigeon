import { useState, useEffect } from 'react';
import { HighlightedInput } from './HighlightedInput';
import { type KeyValPair } from '../store';
import { Check } from 'lucide-react';

interface KeyValPairEditorProps {
  items: KeyValPair[];
  onChange: (items: KeyValPair[]) => void;
  isBulk?: boolean;
}

export function KeyValPairEditor({ items, onChange, isBulk = false }: KeyValPairEditorProps) {
  const [pairs, setPairs] = useState<KeyValPair[]>(() => {
    const initial = [...items];
    if (initial.length === 0 || initial[initial.length - 1].key || initial[initial.length - 1].value) {
      initial.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true });
    }
    return initial;
  });

  useEffect(() => {
    const newPairs = [...items];
    if (newPairs.length === 0 || newPairs[newPairs.length - 1].key || newPairs[newPairs.length - 1].value) {
      newPairs.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true });
    }
    
    // Compare stringified without the empty last element to avoid endless loops
    const currentActive = pairs.filter(p => p.key || p.value);
    const newActive = newPairs.filter(p => p.key || p.value);
    
    if (JSON.stringify(currentActive) !== JSON.stringify(newActive)) {
       setPairs(newPairs);
    }
  }, [items]);

  const updateStore = (newPairs: KeyValPair[]) => {
    onChange(newPairs.filter(p => p.key || p.value));
  };

  const handleBulkChange = (text: string) => {
    const lines = text.split('\n');
    const newPairs: KeyValPair[] = lines.map(line => {
      const idx = line.indexOf(':');
      if (idx === -1) return { id: crypto.randomUUID(), key: line.trim(), value: '', enabled: true };
      return { id: crypto.randomUUID(), key: line.substring(0, idx).trim(), value: line.substring(idx + 1).trim(), enabled: true };
    }).filter(p => p.key || p.value);
    
    updateStore(newPairs);
  };

  const bulkText = pairs.filter(p => p.key.trim()).map(p => `${p.key}: ${p.value}`).join('\n');

  if (isBulk) {
    return (
      <div className="flex flex-col h-full w-full relative">
        <HighlightedInput 
          isTextArea={true}
          className="flex-1 text-text-primary font-mono text-[13px] leading-relaxed"
          value={bulkText}
          onChange={(e: any) => handleBulkChange(e.target.value)}
          placeholder={"key: value\nkey2: value2"}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-24">
        {pairs.map((pair, idx) => {
          return (
            <div key={pair.id} className="flex items-center space-x-2 group">
              <button
                onClick={() => {
                  const newPairs = [...pairs];
                  newPairs[idx].enabled = !newPairs[idx].enabled;
                  setPairs(newPairs);
                  updateStore(newPairs);
                }}
                className={`flex-shrink-0 w-4 h-4 rounded flex items-center justify-center border ${pair.enabled ? 'bg-accent border-accent text-white' : 'border-border-strong text-transparent hover:border-text-muted'}`}
              >
                <Check size={12} strokeWidth={3} />
              </button>
              <div className="flex-1 relative h-[34px]">
                <HighlightedInput 
                  className={`w-full h-full bg-surface-bg border border-border-strong rounded text-[13px] font-mono focus-within:border-accent ${!pair.enabled ? 'opacity-50 line-through' : ''}`}
                  value={pair.key}
                  placeholder="Key"
                  onChange={(e: any) => {
                    const newPairs = [...pairs];
                    newPairs[idx].key = e.target.value;
                    if (idx === pairs.length - 1 && e.target.value) {
                      newPairs.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true });
                    }
                    setPairs(newPairs);
                    updateStore(newPairs);
                  }}
                />
              </div>
              <div className="flex-1 relative h-[34px]">
                <HighlightedInput 
                  className={`w-full h-full bg-surface-bg border border-border-strong rounded text-[13px] font-mono focus-within:border-accent pr-8 ${!pair.enabled ? 'opacity-50 line-through' : ''}`}
                  value={pair.value}
                  placeholder="Value"
                  onChange={(e: any) => {
                    const newPairs = [...pairs];
                    newPairs[idx].value = e.target.value;
                    if (idx === pairs.length - 1 && e.target.value) {
                       newPairs.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true });
                    }
                    setPairs(newPairs);
                    updateStore(newPairs);
                  }}
                />
                <button 
                  onClick={() => {
                    const newPairs = pairs.filter((_, i) => i !== idx);
                    if (newPairs.length === 0) newPairs.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true });
                    setPairs(newPairs);
                    updateStore(newPairs);
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-red-400 transition-opacity z-10"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
