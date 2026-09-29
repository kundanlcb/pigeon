
import { Files, Workflow } from 'lucide-react';
import { SettingsMenu } from './SettingsMenu';
import { useStore } from '../store';

export function Sidebar() {
  const activeView = useStore(state => state.activeView);
  const setActiveView = useStore(state => state.setActiveView);

  return (
    <nav className="w-12 bg-app-bg border-r border-border-subtle flex flex-col items-center py-0 z-50 relative shrink-0 select-none">
      <div className="w-full flex flex-col items-center">
        <button 
          onClick={() => setActiveView('editor')}
          className={`w-full h-12 flex items-center justify-center cursor-pointer transition-colors border-l-2 outline-none ${
            activeView === 'editor' 
              ? 'border-white text-white' 
              : 'border-transparent text-zinc-500 hover:text-zinc-200'
          }`}
          title="Explorer"
        >
          <Files size={21} strokeWidth={1.5} />
        </button>
        <button 
          onClick={() => setActiveView('automation')}
          className={`w-full h-12 flex items-center justify-center cursor-pointer transition-colors border-l-2 outline-none ${
            activeView === 'automation' 
              ? 'border-white text-white' 
              : 'border-transparent text-zinc-500 hover:text-zinc-200'
          }`}
          title="API Automation"
        >
          <Workflow size={21} strokeWidth={1.5} />
        </button>
      </div>
      <SettingsMenu />
    </nav>
  );
}
