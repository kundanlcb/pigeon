import { useState, useEffect } from 'react';
import { HighlightedInput } from './HighlightedInput';
import { type KeyValPair } from '../store';
import { Trash2 } from 'lucide-react';

interface KeyValPairEditorProps {
  items: KeyValPair[];
  onChange: (items: KeyValPair[]) => void;
  isBulk?: boolean;
  keyColumnWidth?: number;
  onKeyColumnWidthChange?: (width: number) => void;
}

export function KeyValPairEditor({
  items,
  onChange,
  isBulk = false,
  keyColumnWidth,
  onKeyColumnWidthChange
}: KeyValPairEditorProps) {
  const [pairs, setPairs] = useState<KeyValPair[]>(() => {
    const initial = (items || []).map(item => ({ ...item, id: item.id || crypto.randomUUID() }));
    if (initial.length === 0 || initial[initial.length - 1].key || initial[initial.length - 1].value) {
      initial.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true });
    }
    return initial;
  });

  const [localKeyColWidth, setLocalKeyColWidth] = useState(250);
  const keyColWidth = keyColumnWidth ?? localKeyColWidth;
  const gridTemplateColumns = `40px ${keyColWidth}px minmax(0, 1fr) 40px`;

  const namedPairs = pairs.filter(p => p.key.trim() || p.value.trim());
  const enabledCount = namedPairs.filter(p => p.enabled).length;
  const allSelected = namedPairs.length > 0 && enabledCount === namedPairs.length;

  const updateKeyColumnWidth = (width: number) => {
    if (keyColumnWidth === undefined) setLocalKeyColWidth(width);
    onKeyColumnWidthChange?.(width);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.pageX;
    const startWidth = keyColWidth;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(100, Math.min(600, startWidth + (moveEvent.pageX - startX)));
      updateKeyColumnWidth(newWidth);
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
    const activeCurrent = pairs.filter(p => p.key || p.value);
    const activeIncoming = (items || []).filter(p => p.key || p.value);
    if (JSON.stringify(activeCurrent.map(({ id, ...rest }) => rest)) === JSON.stringify(activeIncoming.map(({ id, ...rest }) => rest))) {
      return;
    }
    const newPairs = (items || []).map(item => ({ ...item, id: item.id || crypto.randomUUID() }));
    if (newPairs.length === 0 || newPairs[newPairs.length - 1].key || newPairs[newPairs.length - 1].value) {
      newPairs.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true });
    }
    setPairs(newPairs);
  }, [items]);

  const updateStore = (newPairs: KeyValPair[]) => {
    onChange(newPairs.filter(p => p.key || p.value));
  };

  const handleKeyChange = (id: string, newKey: string) => {
    const newPairs = [...pairs];
    const idx = newPairs.findIndex(p => p.id === id);
    if (idx === -1) return;
    newPairs[idx] = { ...newPairs[idx], key: newKey };
    if (idx === newPairs.length - 1 && newKey) {
      newPairs.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true });
    }
    setPairs(newPairs);
    updateStore(newPairs);
  };

  const handleValueChange = (id: string, newValue: string) => {
    const newPairs = [...pairs];
    const idx = newPairs.findIndex(p => p.id === id);
    if (idx === -1) return;
    newPairs[idx] = { ...newPairs[idx], value: newValue };
    if (idx === newPairs.length - 1 && newValue) {
      newPairs.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true });
    }
    setPairs(newPairs);
    updateStore(newPairs);
  };

  const handleToggle = (id: string) => {
    const newPairs = pairs.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p);
    setPairs(newPairs);
    updateStore(newPairs);
  };

  const handleToggleAll = () => {
    const targetState = !allSelected;
    const newPairs = pairs.map(p => (p.key.trim() || p.value.trim()) ? { ...p, enabled: targetState } : p);
    setPairs(newPairs);
    updateStore(newPairs);
  };

  const handleDelete = (id: string) => {
    let newPairs = pairs.filter(p => p.id !== id);
    if (newPairs.length === 0 || newPairs[newPairs.length - 1].key || newPairs[newPairs.length - 1].value) {
      newPairs.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true });
    }
    setPairs(newPairs);
    updateStore(newPairs);
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
      <div className="flex flex-col h-full w-full relative p-2">
        <HighlightedInput autoExpand={true} 
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
    <div className="flex flex-col h-full min-h-0 relative p-2">
      <div className="max-h-full min-h-0 border border-border-strong rounded-lg overflow-y-auto overflow-x-hidden no-scrollbar">
        <div
          className="sticky top-0 z-20 grid gap-px bg-border-strong text-[11px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border-strong"
          style={{ gridTemplateColumns }}
        >
          <div className="py-1.5 px-2 bg-surface-bg text-center flex items-center justify-center">
            <input
              type="checkbox"
              aria-label="Select all rows"
              checked={allSelected}
              onChange={handleToggleAll}
              className="accent-accent w-3.5 h-3.5 cursor-pointer"
            />
          </div>
          <div className="py-1.5 px-3 bg-surface-bg flex items-center relative">
            Key
            <div
              onMouseDown={handleResizeStart}
              className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize z-10 group/resizer flex justify-center translate-x-1/2"
              title="Resize Column"
            >
              <div className="w-[2px] h-full bg-transparent group-hover/resizer:bg-accent transition-colors" />
            </div>
          </div>
          <div className="py-1.5 px-3 bg-surface-bg flex items-center">Value</div>
          <div className="py-1.5 px-2 bg-surface-bg"></div>
        </div>

        {pairs.map((pair) => {
          const hasContent = !!(pair.key.trim() || pair.value.trim());
          return (
            <div 
              key={pair.id} 
              className="grid gap-px bg-border-strong text-[13px] group border-b border-border-strong last:border-b-0"
              style={{ gridTemplateColumns }}
            >
              <div className="bg-app-bg flex items-center justify-center">
                {hasContent && (
                  <input
                    type="checkbox"
                    aria-label={`Use ${pair.key.trim() || 'row'}`}
                    checked={pair.enabled}
                    onChange={() => handleToggle(pair.id)}
                    className="accent-accent w-3.5 h-3.5 cursor-pointer"
                  />
                )}
              </div>
              <div className="bg-app-bg relative h-auto min-h-[34px]">
                <HighlightedInput autoExpand={true} 
                  className={`w-full h-full py-1 px-3 bg-transparent text-[13px] font-mono outline-none placeholder-text-muted focus-within:ring-1 focus-within:ring-inset focus-within:ring-accent ${!pair.enabled ? 'opacity-50 line-through' : ''}`}
                  value={pair.key}
                  placeholder="Key"
                  onChange={(e: any) => handleKeyChange(pair.id, e.target.value)}
                />
              </div>
              <div className="bg-app-bg relative h-auto min-h-[34px]">
                <HighlightedInput autoExpand={true}
                  className={`w-full h-full py-1 px-3 bg-transparent text-[13px] font-mono outline-none placeholder-text-muted focus-within:ring-1 focus-within:ring-inset focus-within:ring-accent ${!pair.enabled ? 'opacity-50 line-through' : ''}`}
                  value={pair.value}
                  placeholder="Value"
                  onChange={(e: any) => handleValueChange(pair.id, e.target.value)}
                />
              </div>
              <div className="bg-app-bg flex items-center justify-center">
                {hasContent && (
                  <button
                    type="button"
                    title="Remove row"
                    aria-label={`Remove ${pair.key || 'row'}`}
                    onClick={() => handleDelete(pair.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-red-400 transition-opacity z-10"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
