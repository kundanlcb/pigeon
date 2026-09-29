import React, { useState } from 'react';
import { useStore } from '../store';
import { ChevronDown, Settings, Check, Globe } from 'lucide-react';

interface EnvironmentSelectorProps {
  onManageClick: () => void;
}

export function EnvironmentSelector({ onManageClick }: EnvironmentSelectorProps) {
  const environments = useStore(state => state.environments);
  const activeEnvironmentId = useStore(state => state.activeEnvironmentId);
  const setActiveEnvironment = useStore(state => state.setActiveEnvironment);
  
  const [isOpen, setIsOpen] = useState(false);
  
  const activeEnv = environments.find(e => e.id === activeEnvironmentId);

  React.useEffect(() => {
    const handleClickOutside = () => setIsOpen(false);
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative">
      <div 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="flex items-center space-x-1.5 px-2 py-1 rounded-md cursor-pointer text-xs font-medium text-accent border border-accent/40 bg-accent/5 hover:bg-accent/10 hover:border-accent transition-all"
      >
        <Globe size={13} className={activeEnvironmentId ? 'text-emerald-400' : 'text-accent'} />
        <span className="truncate max-w-[110px]">{activeEnv ? activeEnv.name : 'No Environment'}</span>
        <ChevronDown size={11} className="shrink-0" />
      </div>
      
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-panel-bg border border-border-strong rounded-lg shadow-xl overflow-hidden z-50 flex flex-col max-h-96">
          <div className="px-3 py-2 text-xs font-semibold text-text-muted border-b border-border-subtle flex justify-between items-center">
            <span>Environments</span>
            <button 
              onClick={(e) => { e.stopPropagation(); onManageClick(); setIsOpen(false); }}
              className="p-1 hover:bg-surface-hover hover:text-text-primary rounded transition-colors"
              title="Manage Environments"
            >
              <Settings size={14} />
            </button>
          </div>
          
          <div className="overflow-y-auto flex-1 p-1">
            <div 
              onClick={() => { setActiveEnvironment(null); setIsOpen(false); }}
              className={`flex items-center px-3 py-2 text-sm rounded cursor-pointer group ${!activeEnvironmentId ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}
            >
              <span className="flex-1">No Environment</span>
              {!activeEnvironmentId && <Check size={14} />}
            </div>
            
            {environments.map(env => (
              <div 
                key={env.id}
                onClick={() => { setActiveEnvironment(env.id); setIsOpen(false); }}
                className={`flex items-center px-3 py-2 text-sm rounded cursor-pointer group ${activeEnvironmentId === env.id ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}
              >
                <span className="flex-1 truncate">{env.name}</span>
                {activeEnvironmentId === env.id && <Check size={14} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
