import { Files, Workflow, History, GitBranch, Shield, Activity } from 'lucide-react';
import { SettingsMenu } from './SettingsMenu';
import { useStore } from '../store';

export function Sidebar() {
  const activeView = useStore(state => state.activeView);
  const setActiveView = useStore(state => state.setActiveView);

  return (
    <nav className="w-12 bg-panel-bg border-r border-border-strong flex flex-col items-center py-2 z-50 relative shrink-0 select-none">
      <div className="w-full flex flex-col items-center gap-1">
        <button 
          onClick={() => setActiveView('editor')}
          className={`w-8 h-8 flex items-center justify-center cursor-pointer transition-all rounded-md outline-none mx-auto ${
            activeView === 'editor' 
              ? 'bg-border-strong text-text-primary' 
              : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
          }`}
          title="Explorer"
        >
          <Files size={19} strokeWidth={1.5} />
        </button>
        <button 
          onClick={() => setActiveView('history')}
          className={`w-8 h-8 flex items-center justify-center cursor-pointer transition-all rounded-md outline-none mx-auto ${
            activeView === 'history' 
              ? 'bg-border-strong text-text-primary' 
              : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
          }`}
          title="History"
        >
          <History size={19} strokeWidth={1.5} />
        </button>
        <button 
          onClick={() => setActiveView('security')}
          className={`w-8 h-8 flex items-center justify-center cursor-pointer transition-all rounded-md outline-none mx-auto ${
            activeView === 'security' 
              ? 'bg-border-strong text-accent' 
              : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
          }`}
          title="DevSecOps Hub"
        >
          <Shield size={19} strokeWidth={1.5} />
        </button>
        <button 
          onClick={() => setActiveView('performance')}
          className={`w-8 h-8 flex items-center justify-center cursor-pointer transition-all rounded-md outline-none mx-auto ${
            activeView === 'performance' 
              ? 'bg-border-strong text-accent' 
              : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
          }`}
          title="Load Testing"
        >
          <Activity size={19} strokeWidth={1.5} />
        </button>
        <button 
          onClick={() => setActiveView('automation')}
          className={`w-8 h-8 flex items-center justify-center cursor-pointer transition-all rounded-md outline-none mx-auto ${
            activeView === 'automation' 
              ? 'bg-border-strong text-text-primary' 
              : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
          }`}
          title="API Automation"
        >
          <Workflow size={19} strokeWidth={1.5} />
        </button>
        <button 
          onClick={() => setActiveView('source-control')}
          className={`w-8 h-8 flex items-center justify-center cursor-pointer transition-all rounded-md outline-none mx-auto ${
            activeView === 'source-control' 
              ? 'bg-border-strong text-text-primary' 
              : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
          }`}
          title="Source Control"
        >
          <GitBranch size={19} strokeWidth={1.5} />
        </button>
      </div>
      <SettingsMenu />
    </nav>
  );
}
