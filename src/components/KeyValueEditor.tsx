import { useState, useEffect } from 'react';
import { HighlightedInput } from './HighlightedInput';

interface KeyValue {
  key: string;
  value: string;
}

interface KeyValueEditorProps {
  items: Record<string, string>;
  onChange: (items: Record<string, string>) => void;
  placeholderKey?: string;
  placeholderValue?: string;
  keySuggestions?: string[];
  isBulk?: boolean;
}

export function KeyValueEditor({ items, onChange, placeholderKey = "Key", placeholderValue = "Value", keySuggestions, isBulk = false }: KeyValueEditorProps) {
  const [pairs, setPairs] = useState<KeyValue[]>(() => {
    const initial = Object.entries(items || {}).map(([key, value]) => ({ key, value }));
    initial.push({ key: '', value: '' });
    return initial;
  });
  const [focusedKeyIdx, setFocusedKeyIdx] = useState<number | null>(null);

  useEffect(() => {
    const currentRecord: Record<string, string> = {};
    pairs.forEach(p => {
      if (p.key.trim()) currentRecord[p.key.trim()] = p.value;
    });
    
    if (JSON.stringify(currentRecord) === JSON.stringify(items || {})) {
      return;
    }

    const newPairs = Object.entries(items || {}).map(([key, value]) => ({ key, value }));
    newPairs.push({ key: '', value: '' });
    setPairs(newPairs);
  }, [items, pairs]);

  const updateStore = (newPairs: KeyValue[]) => {
    const record: Record<string, string> = {};
    newPairs.forEach(p => {
      if (p.key.trim()) record[p.key.trim()] = p.value;
    });
    onChange(record);
  };

  const handleBulkChange = (text: string) => {
    const lines = text.split('\n');
    const newPairs: KeyValue[] = lines.map(line => {
      const idx = line.indexOf(':');
      if (idx === -1) return { key: line.trim(), value: '' };
      return { key: line.substring(0, idx).trim(), value: line.substring(idx + 1).trim() };
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
          const filteredSuggestions = keySuggestions?.filter(s => s.toLowerCase().includes(pair.key.toLowerCase())) || [];
          return (
            <div key={idx} className="flex items-center space-x-2 group">
              <div className="flex-1 relative h-[34px]">
                <HighlightedInput 
                  className="w-full h-full bg-surface-bg border border-border-strong rounded text-[13px] font-mono focus-within:border-accent"
                  value={pair.key}
                  placeholder={placeholderKey}
                  onFocus={() => setFocusedKeyIdx(idx)}
                  onBlur={() => setFocusedKeyIdx(null)}
                  onChange={(e: any) => {
                    const newPairs = [...pairs];
                    newPairs[idx].key = e.target.value;
                    if (idx === pairs.length - 1 && e.target.value) newPairs.push({ key: '', value: '' });
                    setPairs(newPairs);
                    updateStore(newPairs);
                  }}
                />
                {focusedKeyIdx === idx && filteredSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-full max-h-48 overflow-y-auto bg-panel-bg border border-border-strong rounded-lg shadow-xl z-50 py-1">
                    {filteredSuggestions.map(s => (
                      <div 
                        key={s} 
                        className="px-3 py-1.5 text-[13px] font-mono text-text-primary hover:bg-surface-hover cursor-pointer"
                        onMouseDown={(e) => {
                          e.preventDefault(); // prevent blur
                          const newPairs = [...pairs];
                          newPairs[idx].key = s;
                          if (idx === pairs.length - 1) newPairs.push({ key: '', value: '' });
                          setPairs(newPairs);
                          updateStore(newPairs);
                          setFocusedKeyIdx(null);
                        }}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 relative h-[34px]">
                <HighlightedInput 
                  className="w-full h-full bg-surface-bg border border-border-strong rounded text-[13px] font-mono focus-within:border-accent pr-8"
                  value={pair.value}
                  placeholder={placeholderValue}
                  onChange={(e: any) => {
                    const newPairs = [...pairs];
                    newPairs[idx].value = e.target.value;
                    setPairs(newPairs);
                    updateStore(newPairs);
                  }}
                />
                <button 
                  onClick={() => {
                    const newPairs = pairs.filter((_, i) => i !== idx);
                    if (newPairs.length === 0) newPairs.push({ key: '', value: '' });
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
