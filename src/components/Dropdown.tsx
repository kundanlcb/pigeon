import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  onChange: (val: string) => void;
  options: Option[];
  className?: string;
  dropdownClassName?: string;
}

export function Dropdown({ value, onChange, options, className = '', dropdownClassName = '' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-full flex items-center justify-between outline-none"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown size={14} className={`text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''} flex-shrink-0 ml-2`} />
      </button>

      {isOpen && (
        <div className={`absolute top-full left-0 mt-1 w-full min-w-32 bg-panel-bg border border-border-strong rounded-lg shadow-xl overflow-hidden z-50 py-1 ${dropdownClassName}`}>
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`px-3 py-2 text-[13px] cursor-pointer transition-colors ${value === opt.value ? 'bg-accent/10 text-accent font-medium' : 'text-text-primary hover:bg-surface-hover'}`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
