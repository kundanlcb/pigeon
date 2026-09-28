import { useState, useEffect } from 'react';
import { HighlightedInput } from './HighlightedInput';
import { Trash2 } from 'lucide-react';

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
  const [keyColWidth, setKeyColWidth] = useState(250);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.pageX;
    const startWidth = keyColWidth;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(100, Math.min(600, startWidth + (moveEvent.pageX - startX)));
      setKeyColWidth(newWidth);
    };
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
  };

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
    <div className="flex flex-col h-full relative p-4">
      <div className="border border-border-strong rounded-lg overflow-hidden flex flex-col min-h-0">
        <div 
          className="grid gap-px bg-border-strong text-[11px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border-strong shrink-0"
          style={{ gridTemplateColumns: `${keyColWidth}px 1fr 40px` }}
        >
          <div className="py-1.5 px-3 bg-surface-bg flex items-center relative">
            {placeholderKey}
            <div 
              onMouseDown={handleResizeStart}
              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-accent/50 z-10 translate-x-1/2"
              title="Resize Column"
            />
          </div>
          <div className="py-1.5 px-3 bg-surface-bg flex items-center">{placeholderValue}</div>
          <div className="py-1.5 px-2 bg-surface-bg"></div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
        {pairs.map((pair, idx) => {
          const filteredSuggestions = keySuggestions?.filter(s => s.toLowerCase().includes(pair.key.toLowerCase())) || [];
          return (
            <div 
              key={idx} 
              className="grid gap-px bg-border-strong text-[13px] group border-b border-border-strong last:border-b-0"
              style={{ gridTemplateColumns: `${keyColWidth}px 1fr 40px` }}
            >
              <div className="bg-app-bg relative h-[34px]">
                <HighlightedInput 
                  className="w-full h-full py-1 px-3 bg-transparent text-[13px] font-mono outline-none placeholder-text-muted focus-within:ring-1 focus-within:ring-inset focus-within:ring-accent"
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
                  <div className="absolute top-[100%] left-0 mt-1 w-[200%] max-w-sm max-h-48 overflow-y-auto bg-panel-bg border border-border-strong rounded-lg shadow-xl z-[9999] py-1">
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
              <div className="bg-app-bg relative h-[34px]">
                <HighlightedInput 
                  className="w-full h-full py-1 px-3 bg-transparent text-[13px] font-mono outline-none placeholder-text-muted focus-within:ring-1 focus-within:ring-inset focus-within:ring-accent"
                  value={pair.value}
                  placeholder={placeholderValue}
                  onChange={(e: any) => {
                    const newPairs = [...pairs];
                    newPairs[idx].value = e.target.value;
                    setPairs(newPairs);
                    updateStore(newPairs);
                  }}
                />
              </div>
              <div className="bg-app-bg flex items-center justify-center">
                <button 
                  onClick={() => {
                    const newPairs = pairs.filter((_, i) => i !== idx);
                    if (newPairs.length === 0) newPairs.push({ key: '', value: '' });
                    setPairs(newPairs);
                    updateStore(newPairs);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-red-400 transition-opacity z-10"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
