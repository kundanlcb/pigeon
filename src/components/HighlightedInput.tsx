import React, { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import _Editor from 'react-simple-code-editor';
const Editor = (_Editor as any).default || _Editor;
import { useStore } from '../store';
import { highlightJson, isJsonString } from '../utils/syntax';

interface HighlightedInputProps {
  value: string;
  onChange: (e: any) => void;
  className?: string;
  placeholder?: string;
  isTextArea?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function HighlightedInput({ value, onChange, className = '', placeholder, isTextArea = false, onKeyDown, onFocus, onBlur }: HighlightedInputProps) {
  const environments = useStore(state => state.environments);
  const activeEnvironmentId = useStore(state => state.activeEnvironmentId);
  const activeEnv = environments.find(e => e.id === activeEnvironmentId);
  
  const updateEnvironment = useStore(state => state.updateEnvironment);
  
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionFilter, setSuggestionFilter] = useState('');
  const [cursorPos, setCursorPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [hoveredVar, setHoveredVar] = useState<{name: string, id: string, value: string, top: number, left: number} | null>(null);
  const [isPopoverPinned, setIsPopoverPinned] = useState(false);
  const [editVarValue, setEditVarValue] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  
  const highlightText = (code: string) => {
    if (!code) return '';
    
    // First, escape HTML and apply JSON highlighting if it's a textarea and looks like JSON
    let highlighted = code;
    if (isTextArea && isJsonString(code)) {
      highlighted = highlightJson(code);
    } else {
      highlighted = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    
    // Now highlight {{variables}} over the (potentially already highlighted) text
    const parts = highlighted.split(/(\{\{[^}]*\}\}?)/g);
    
    return parts.map((part) => {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        const varName = part.slice(2, -2).trim();
        const activeVar = activeEnv?.variables.find(v => v.key === varName && v.enabled);
        const colorClass = activeVar ? 'text-accent font-medium' : 'text-red-500 font-medium';
        const valEscaped = activeVar ? activeVar.value.replace(/"/g, '&quot;') : '';
        return `<span class="${colorClass}" data-varname="${varName}" data-varid="${activeVar?.id || ''}" data-varval="${valEscaped}">${part}</span>`;
      }
      // Highlight partially typed {{var...
      if (part.startsWith('{{') && !part.endsWith('}}')) {
        return `<span class="text-accent opacity-80">${part}</span>`;
      }
      return part;
    }).join('');
  };

  const availableVariables = activeEnv?.variables.filter(v => v.enabled) || [];
  const filteredSuggestions = availableVariables.filter(v => v.key.toLowerCase().includes(suggestionFilter.toLowerCase()));

  const handleValueChange = (code: string) => {
    // Send a mock event to match standard onChange signature
    onChange({ target: { value: code } });
  };

  const getCaretCoordinates = () => {
    const textarea = containerRef.current?.querySelector('textarea');
    if (!textarea) return;
    
    // Very simple approximation since getCaretCoordinates is complex without a library
    const textBeforeCaret = textarea.value.substring(0, textarea.selectionEnd);
    const lines = textBeforeCaret.split('\n');
    const currentLineIdx = lines.length - 1;
    const currentLine = lines[currentLineIdx];
    
    // Check if we are inside a {{...}} block
    const lastOpen = currentLine.lastIndexOf('{{');
    const lastClose = currentLine.lastIndexOf('}}');
    
    if (lastOpen > lastClose && lastOpen !== -1) {
      const filterText = currentLine.substring(lastOpen + 2);
      setSuggestionFilter(filterText);
      setShowSuggestions(true);
      setSelectedIndex(0);
      
      // Calculate position
      const top = (currentLineIdx + 1) * 20; // Approx line height
      const left = Math.min(currentLine.length * 8, 300); // Approx char width
      setCursorPos({ top, left });
    } else {
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<any>) => {
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertSuggestion(filteredSuggestions[selectedIndex].key);
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }
    
    if (!isTextArea && e.key === 'Enter') {
      e.preventDefault();
      onKeyDown?.(e);
      return;
    }
    
    onKeyDown?.(e);
  };

  const insertSuggestion = (varKey: string) => {
    const textarea = containerRef.current?.querySelector('textarea');
    if (!textarea) return;
    
    const cursorPosition = textarea.selectionEnd;
    const textBeforeCaret = value.substring(0, cursorPosition);
    const textAfterCaret = value.substring(cursorPosition);
    
    const lastOpenIndex = textBeforeCaret.lastIndexOf('{{');
    if (lastOpenIndex !== -1) {
      const newBefore = textBeforeCaret.substring(0, lastOpenIndex);
      const newValue = newBefore + `{{${varKey}}}` + textAfterCaret;
      
      handleValueChange(newValue);
      setShowSuggestions(false);
      
      // Restore focus and cursor position after render
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          const newPos = newBefore.length + varKey.length + 4; // +4 for {{}}
          textarea.setSelectionRange(newPos, newPos);
        }
      }, 0);
    }
  };

  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (hoveredVar) {
        const el = e.target as HTMLElement;
        if (!el.closest('.var-popover')) {
          setIsPopoverPinned(false);
          setHoveredVar(null);
        }
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [hoveredVar]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPopoverPinned) return; // Don't change hover state while pinned
    if (e.buttons !== 0) return; // Don't interrupt dragging
    const textarea = containerRef.current?.querySelector('textarea');
    if (!textarea) return;
    const pre = containerRef.current?.querySelector('pre');
    
    textarea.style.pointerEvents = 'none';
    if (pre) pre.style.pointerEvents = 'auto';
    
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
    
    textarea.style.pointerEvents = 'auto';
    if (pre) pre.style.pointerEvents = 'none';
    
    if (el && el.closest('.var-popover')) {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      return; // Keep open if hovering popover
    }

    if (el && el.tagName === 'SPAN' && el.hasAttribute('data-varname')) {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      
      const varName = el.getAttribute('data-varname');
      const varId = el.getAttribute('data-varid');
      const varVal = el.getAttribute('data-varval');
      
      if (varName && varName !== hoveredVar?.name) {
        const containerRect = containerRef.current?.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        if (containerRect) {
          setHoveredVar({
            name: varName,
            id: varId || '',
            value: varVal || '',
            top: elRect.bottom - containerRect.top + 5,
            left: elRect.left - containerRect.left,
          });
          setEditVarValue(varVal || '');
        }
      }
    } else {
      if (!hideTimeoutRef.current && hoveredVar) {
        hideTimeoutRef.current = setTimeout(() => {
          setHoveredVar(null);
          hideTimeoutRef.current = null;
        }, 200);
      }
    }
  };

  return (
    <div 
      className={`relative flex items-center ${className} editor-container`} 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPopoverPinned) return;
        if (!hideTimeoutRef.current && hoveredVar) {
          hideTimeoutRef.current = setTimeout(() => {
            setHoveredVar(null);
            hideTimeoutRef.current = null;
          }, 200);
        }
      }}
    >
      <Editor
        value={value}
        onValueChange={handleValueChange}
        highlight={highlightText}
        padding={isTextArea ? 16 : 8}
        onKeyUp={getCaretCoordinates}
        onClick={getCaretCoordinates}
        className={`w-full font-mono text-[13px] outline-none !bg-transparent ${isTextArea ? 'min-h-full leading-[1.6]' : 'leading-none whitespace-nowrap overflow-x-auto no-scrollbar'}`}
        textareaClassName="outline-none focus:outline-none"
        preClassName="!bg-transparent"
        placeholder={placeholder}
        onFocus={onFocus}
        onBlur={() => {
          // Delay hiding suggestions to allow clicks
          setTimeout(() => setShowSuggestions(false), 200);
          onBlur?.();
        }}
        onKeyDown={handleKeyDown}
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          minHeight: isTextArea ? '100%' : 'auto',
          backgroundColor: 'transparent'
        }}
      />
      
      {/* Suggestions Dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && cursorPos && (
        <div 
          className="absolute z-50 bg-panel-bg border border-border-strong rounded-lg shadow-xl overflow-hidden py-1 min-w-[200px]"
          style={{ top: cursorPos.top + 10, left: cursorPos.left }}
        >
          {filteredSuggestions.map((s, idx) => (
            <div 
              key={s.key}
              onMouseDown={(e) => {
                e.preventDefault();
                insertSuggestion(s.key);
              }}
              className={`px-3 py-1.5 text-xs font-mono cursor-pointer flex justify-between items-center ${idx === selectedIndex ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-surface-hover'}`}
            >
              <span className="font-bold">{s.key}</span>
              <span className="text-text-muted truncate ml-2 max-w-[100px]">{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Variable Hover Popover */}
      {hoveredVar && (
        <div 
          className="var-popover absolute z-[100] bg-panel-bg border border-border-strong rounded-lg shadow-xl p-3 w-64 flex flex-col gap-2"
          style={{ top: hoveredVar.top, left: hoveredVar.left }}
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-text-secondary flex items-center gap-1">
              <span className="text-[10px] px-1 py-0.5 bg-surface-bg rounded">E</span> 
              <span className="text-text-primary truncate">{hoveredVar.name}</span>
            </span>
            {!hoveredVar.id && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Unresolved</span>}
          </div>
          {hoveredVar.id ? (
            <div className="flex items-center space-x-2 mt-1">
              <input 
                type="text"
                value={editVarValue}
                onChange={(e) => {
                  setEditVarValue(e.target.value);
                  setIsPopoverPinned(true);
                }}
                onClick={() => setIsPopoverPinned(true)}
                className="flex-1 min-w-0 bg-surface-bg border border-border-strong rounded px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent font-mono"
                placeholder="Initial Value"
              />
              <button
                onClick={() => {
                  if (activeEnvironmentId) {
                    const updatedVars = activeEnv!.variables.map(v => 
                      v.id === hoveredVar.id ? { ...v, value: editVarValue } : v
                    );
                    updateEnvironment(activeEnvironmentId, { variables: updatedVars });
                    setHoveredVar(null);
                    setIsPopoverPinned(false);
                  }
                }}
                className="p-1.5 rounded-md bg-accent hover:bg-accent-hover text-white transition-colors shadow-sm active:scale-95 flex-shrink-0"
                title="Save"
              >
                <Check size={14} />
              </button>
            </div>
          ) : activeEnvironmentId ? (
            <div className="flex items-center space-x-2 mt-1">
              <input 
                type="text"
                value={editVarValue}
                onChange={(e) => {
                  setEditVarValue(e.target.value);
                  setIsPopoverPinned(true);
                }}
                onClick={() => setIsPopoverPinned(true)}
                className="flex-1 min-w-0 bg-surface-bg border border-border-strong rounded px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent font-mono"
                placeholder="Initial Value"
              />
              <button
                onClick={() => {
                  const updatedVars = [
                    ...activeEnv!.variables,
                    { id: `var-${Date.now()}`, key: hoveredVar.name, value: editVarValue, enabled: true }
                  ];
                  updateEnvironment(activeEnvironmentId, { variables: updatedVars });
                  setHoveredVar(null);
                  setIsPopoverPinned(false);
                }}
                className="p-1.5 rounded-md bg-accent hover:bg-accent-hover text-white transition-colors shadow-sm active:scale-95 flex-shrink-0"
                title="Create Variable"
              >
                <Check size={14} />
              </button>
            </div>
          ) : (
            <div className="text-xs text-text-muted">Select an environment to create this variable.</div>
          )}
        </div>
      )}
      
      <style>{`
        .editor-container textarea {
          outline: none !important;
          box-shadow: none !important;
          caret-color: var(--color-text-primary);
        }
        .editor-container textarea::placeholder {
          color: var(--color-text-muted);
          opacity: 1;
        }
        /* Custom scrollbar for single line */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
