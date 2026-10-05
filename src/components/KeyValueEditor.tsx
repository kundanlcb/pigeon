import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HighlightedInput } from './HighlightedInput';
import { Save, Trash2 } from 'lucide-react';

interface KeyValue {
  key: string;
  value: string;
  isInherited?: boolean;
}

interface KeyValueEditorProps {
  items: Record<string, string>;
  onChange: (items: Record<string, string>) => void;
  placeholderKey?: string;
  placeholderValue?: string;
  keySuggestions?: string[];
  isBulk?: boolean;
  disabledKeys?: string[];
  onDisabledKeysChange?: (disabledKeys: string[]) => void;
  keyColumnWidth?: number;
  onKeyColumnWidthChange?: (width: number) => void;
  secretKeys?: string[];
  secretValues?: Record<string, string>;
  secretPlaceholder?: string;
  onSecretToggle?: (key: string, enabled: boolean, currentValue: string) => void;
  onSecretValueChange?: (key: string, value: string) => void;
  onSecretSave?: (key: string, value: string) => void;
  onSecretDelete?: (key: string) => void;
  fixedKeys?: string[];
  inheritedItems?: Record<string, string>;
}

export function KeyValueEditor({
  items,
  onChange,
  placeholderKey = "Key",
  placeholderValue = "Value",
  keySuggestions,
  isBulk = false,
  disabledKeys = [],
  onDisabledKeysChange,
  keyColumnWidth,
  onKeyColumnWidthChange,
  secretKeys = [],
  secretValues = {},
  secretPlaceholder = 'Enter secret value',
  onSecretToggle,
  onSecretValueChange,
  onSecretSave,
  onSecretDelete,
  fixedKeys,
  inheritedItems
}: KeyValueEditorProps) {
  const [pairs, setPairs] = useState<KeyValue[]>(() => {
    if (fixedKeys) {
      return fixedKeys.map(key => ({ key, value: items[key] || '' }));
    }
    const newPairs: KeyValue[] = [];
    if (inheritedItems) {
      Object.entries(inheritedItems).forEach(([k, v]) => {
        newPairs.push({ key: k, value: v, isInherited: true });
      });
    }
    const initial = Object.entries(items || {}).map(([key, value]) => ({ key, value }));
    newPairs.push(...initial);
    secretKeys.forEach(key => {
      if (!newPairs.some(pair => pair.key.toLowerCase() === key.toLowerCase())) newPairs.push({ key, value: '' });
    });
    newPairs.push({ key: '', value: '' });
    return newPairs;
  });

  useEffect(() => {
    if (fixedKeys) {
      setPairs(fixedKeys.map(key => ({ key, value: items[key] || '' })));
    }
  }, [items, fixedKeys]);

  const [focusedKeyIdx, setFocusedKeyIdx] = useState<number | null>(null);
  const [keyRect, setKeyRect] = useState<{top: number, left: number, width: number} | null>(null);
  const [localKeyColWidth, setLocalKeyColWidth] = useState(250);
  const keyColWidth = keyColumnWidth ?? localKeyColWidth;
  const secretKeySet = new Set(secretKeys.map(key => key.toLowerCase()));
  const hasSecretColumn = !!onSecretToggle;
  const gridTemplateColumns = `40px ${keyColWidth}px minmax(0, 1fr) ${hasSecretColumn ? '56px ' : ''}${hasSecretColumn ? '64px' : '40px'}`;
  const namedKeys = pairs.map(pair => pair.key.trim()).filter(Boolean);
  const selectedCount = namedKeys.filter(key => !disabledKeys.includes(key)).length;
  const allSelected = namedKeys.length > 0 && selectedCount === namedKeys.length;

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
    const currentRecord: Record<string, string> = {};
    const currentInherited: Record<string, string> = {};
    pairs.forEach(p => {
      if (p.key.trim() && !secretKeys.some(key => key.toLowerCase() === p.key.trim().toLowerCase())) {
        if (p.isInherited) {
          currentInherited[p.key.trim()] = p.value;
        } else {
          currentRecord[p.key.trim()] = p.value;
        }
      }
    });

    const hasSecretRows = secretKeys.every(key => pairs.some(pair => pair.key.toLowerCase() === key.toLowerCase()));
    
    if (
      JSON.stringify(currentRecord) === JSON.stringify(items || {}) && 
      JSON.stringify(currentInherited) === JSON.stringify(inheritedItems || {}) &&
      hasSecretRows
    ) {
      return;
    }

    const newPairs: KeyValue[] = [];
    if (inheritedItems) {
      Object.entries(inheritedItems).forEach(([k, v]) => {
        newPairs.push({ key: k, value: v, isInherited: true });
      });
    }
    const initial = Object.entries(items || {}).map(([key, value]) => ({ key, value }));
    newPairs.push(...initial);
    secretKeys.forEach(key => {
      if (!newPairs.some(pair => pair.key.toLowerCase() === key.toLowerCase())) newPairs.push({ key, value: '' });
    });
    newPairs.push({ key: '', value: '' });
    setPairs(newPairs);
  }, [items, inheritedItems, pairs, secretKeys]);

  const updateStore = (newPairs: KeyValue[]) => {
    const record: Record<string, string> = {};
    newPairs.forEach(p => {
      if (p.key.trim() && !secretKeySet.has(p.key.trim().toLowerCase()) && !p.isInherited) {
        record[p.key.trim()] = p.value;
      }
    });
    onChange(record);
    const nextDisabledKeys = disabledKeys.filter(key => Object.hasOwn(record, key) || (inheritedItems && Object.hasOwn(inheritedItems, key)));
    if (nextDisabledKeys.length !== disabledKeys.length) onDisabledKeysChange?.(nextDisabledKeys);
  };

  const toggleKey = (key: string) => {
    if (!onDisabledKeysChange) return;
    onDisabledKeysChange(disabledKeys.includes(key)
      ? disabledKeys.filter(disabledKey => disabledKey !== key)
      : [...disabledKeys, key]);
  };

  const toggleAllKeys = () => {
    if (!onDisabledKeysChange) return;
    onDisabledKeysChange(allSelected ? namedKeys : []);
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

  const bulkText = pairs.filter(p => p.key.trim()).map(p =>
    `${p.key}: ${secretKeySet.has(p.key.trim().toLowerCase()) ? '' : p.value}`
  ).join('\n');

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
    <div className={`flex flex-col relative p-2 ${fixedKeys ? '' : 'h-full min-h-0'}`}>
      <div className={`border border-border-strong rounded-lg overflow-y-auto overflow-x-hidden no-scrollbar ${fixedKeys ? 'max-h-[300px]' : 'max-h-full min-h-0'}`}>
        <div
          className="sticky top-0 z-20 grid gap-px bg-border-strong text-[11px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border-strong"
          style={{ gridTemplateColumns }}
        >
          <div className="py-1.5 px-2 bg-surface-bg text-center flex items-center justify-center">
            <input
              type="checkbox"
              aria-label="Select all keys"
              checked={allSelected}
              onChange={toggleAllKeys}
              className="accent-accent w-3.5 h-3.5 cursor-pointer"
            />
          </div>
          <div className="py-1.5 px-3 bg-surface-bg flex items-center relative">
            {placeholderKey}
            <div
              onMouseDown={handleResizeStart}
              className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize z-10 group/resizer flex justify-center translate-x-1/2"
              title="Resize Column"
            >
              <div className="w-[2px] h-full bg-transparent group-hover/resizer:bg-accent transition-colors" />
            </div>
          </div>
          <div className="py-1.5 px-3 bg-surface-bg flex items-center">{placeholderValue}</div>
          {hasSecretColumn && <div className="py-1.5 px-2 bg-surface-bg text-center">Secret</div>}
          <div className="py-1.5 px-2 bg-surface-bg"></div>
        </div>

        {pairs.map((pair, idx) => {
          const isAuthorization = pair.key.trim().toLowerCase() === 'authorization';
          const isSecret = secretKeySet.has(pair.key.trim().toLowerCase());
          const filteredSuggestions = isSecret ? [] : keySuggestions?.filter(s => s.toLowerCase().includes(pair.key.toLowerCase())) || [];
          const secretDraft = secretValues[pair.key] ?? secretValues.Authorization ?? '';
          return (
            <div
              key={idx}
              className={`grid gap-px bg-border-strong text-[13px] group border-b border-border-strong last:border-b-0 ${pair.isInherited ? 'opacity-80' : ''}`}
              style={{ gridTemplateColumns }}
            >
              <div className="bg-app-bg flex items-center justify-center">
                {pair.key.trim() && (
                  <input
                    type="checkbox"
                    aria-label={`Use ${pair.key.trim()}`}
                    checked={!disabledKeys.includes(pair.key.trim())}
                    onChange={() => toggleKey(pair.key.trim())}
                    className="accent-accent w-3.5 h-3.5 cursor-pointer"
                  />
                )}
              </div>
              <div 
                className="bg-app-bg relative h-[34px]"
                onFocusCapture={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setKeyRect({ top: rect.bottom, left: rect.left, width: rect.width });
                }}
              >
                <div className={fixedKeys ? 'pointer-events-none opacity-80 h-full' : 'h-full'}>
                  <HighlightedInput
                    className="w-full h-full py-1 px-3 bg-transparent text-[13px] font-mono outline-none placeholder-text-muted focus-within:ring-1 focus-within:ring-inset focus-within:ring-accent"
                    value={pair.key}
                    placeholder={placeholderKey}
                    onFocus={() => setFocusedKeyIdx(idx)}
                    onBlur={() => setFocusedKeyIdx(null)}
                    onChange={(e: any) => {
                      if (isSecret || fixedKeys) return;
                      const newPairs = [...pairs];
                      newPairs[idx].key = e.target.value;
                      if (newPairs[idx].isInherited) newPairs[idx].isInherited = false;
                      if (idx === pairs.length - 1 && e.target.value && !fixedKeys) newPairs.push({ key: '', value: '' });
                      setPairs(newPairs);
                      updateStore(newPairs);
                    }}
                  />
                </div>
                {focusedKeyIdx === idx && filteredSuggestions.length > 0 && keyRect && createPortal(
                  <div 
                    className="fixed mt-1 max-h-48 overflow-y-auto bg-panel-bg border border-border-strong rounded-lg shadow-xl z-[9999] py-1"
                    style={{ top: keyRect.top, left: keyRect.left, width: Math.max(keyRect.width, 200) }}
                  >
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
                  </div>,
                  document.body
                )}
              </div>
              <div className="bg-app-bg relative h-[34px]">
                {isSecret ? (
                  <input
                    type="password"
                    autoComplete="new-password"
                    spellCheck={false}
                    className="w-full h-full py-1 px-3 bg-transparent text-[13px] font-mono outline-none placeholder-text-muted focus-within:ring-1 focus-within:ring-inset focus-within:ring-accent"
                    value={secretDraft}
                    placeholder={secretPlaceholder}
                    onChange={event => onSecretValueChange?.(pair.key, event.target.value)}
                    onBlur={() => {
                      if (secretDraft) onSecretSave?.(pair.key, secretDraft);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && secretDraft) onSecretSave?.(pair.key, secretDraft);
                    }}
                  />
                ) : (
                  <HighlightedInput
                    className="w-full h-full py-1 px-3 bg-transparent text-[13px] font-mono outline-none placeholder-text-muted focus-within:ring-1 focus-within:ring-inset focus-within:ring-accent"
                    value={pair.value}
                    placeholder={placeholderValue}
                    onChange={(e: any) => {
                      const newPairs = [...pairs];
                      newPairs[idx].value = e.target.value;
                      if (newPairs[idx].isInherited) newPairs[idx].isInherited = false;
                      setPairs(newPairs);
                      updateStore(newPairs);
                    }}
                  />
                )}
              </div>
              {hasSecretColumn && (
                <div className="bg-app-bg flex items-center justify-center">
                  {isAuthorization && (
                    <input
                      type="checkbox"
                      aria-label="Store Authorization in system keychain"
                      title="Store Authorization in system keychain"
                      checked={isSecret}
                      onChange={event => onSecretToggle?.(pair.key, event.target.checked, pair.value)}
                      className="accent-accent w-3.5 h-3.5 cursor-pointer"
                    />
                  )}
                </div>
              )}
              <div className="bg-app-bg flex items-center justify-center gap-1">
                {pair.isInherited ? (
                  <div className="text-[9px] uppercase text-text-muted px-1 border border-border-strong rounded" title="Inherited from Collection">Inherited</div>
                ) : (
                  <>
                    {isSecret && secretDraft && (
                      <button
                        type="button"
                        title="Save secret to system keychain"
                        aria-label="Save secret to system keychain"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onSecretSave?.(pair.key, secretDraft)}
                        className="p-1 text-text-muted hover:text-accent transition-colors"
                      >
                        <Save size={14} />
                      </button>
                    )}
                    {!fixedKeys && (
                      <button
                        type="button"
                        title="Remove header"
                        aria-label={`Remove ${pair.key || 'header'}`}
                        onClick={() => {
                          if (isSecret) {
                            onSecretDelete?.(pair.key);
                            return;
                          }
                          const newPairs = pairs.filter((_, i) => i !== idx);
                          if (newPairs.length === 0) newPairs.push({ key: '', value: '' });
                          setPairs(newPairs);
                          updateStore(newPairs);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-red-400 transition-opacity z-10"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
