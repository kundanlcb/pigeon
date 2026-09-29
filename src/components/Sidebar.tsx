import { Files, Workflow, History } from 'lucide-react';
import { SettingsMenu } from './SettingsMenu';
import { useStore } from '../store';

export function Sidebar() {
  const activeView = useStore(state => state.activeView);
  const setActiveView = useStore(state => state.setActiveView);

  return (
    <nav className="w-12 bg-[#161618] border-r border-t border-[#2a2d2e] flex flex-col items-center py-2 z-50 relative shrink-0 select-none">
      <div className="w-full flex flex-col items-center gap-1">
        <button 
          onClick={() => setActiveView('editor')}
          className={`w-9 h-9 flex items-center justify-center cursor-pointer transition-all rounded-lg outline-none mx-auto ${
            activeView === 'editor' 
              ? 'bg-white/10 text-white' 
              : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
          }`}
          title="Explorer"
        >
          <Files size={19} strokeWidth={1.5} />
        </button>
        <button 
          onClick={() => setActiveView('history')}
          className={`w-9 h-9 flex items-center justify-center cursor-pointer transition-all rounded-lg outline-none mx-auto ${
            activeView === 'history' 
              ? 'bg-white/10 text-white' 
              : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
          }`}
          title="History"
        >
          <History size={19} strokeWidth={1.5} />
        </button>
        <button 
          onClick={() => setActiveView('automation')}
          className={`w-9 h-9 flex items-center justify-center cursor-pointer transition-all rounded-lg outline-none mx-auto ${
            activeView === 'automation' 
              ? 'bg-white/10 text-white' 
              : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
          }`}
          title="API Automation"
        >
          <Workflow size={19} strokeWidth={1.5} />
        </button>
      </div>
      <SettingsMenu />
    </nav>
  );
}
