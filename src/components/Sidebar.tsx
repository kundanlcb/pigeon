
import { Folder, Workflow } from 'lucide-react';
import { SettingsMenu } from './SettingsMenu';

import { useStore } from '../store';

export function Sidebar() {
  const activeView = useStore(state => state.activeView);
  const setActiveView = useStore(state => state.setActiveView);

  return (
    <nav className="w-12 bg-app-bg border-r border-border-subtle flex flex-col items-center py-4 space-y-6 z-50 relative">
      <div 
        onClick={() => setActiveView('editor')}
        className={`p-2 rounded-xl cursor-pointer transition-colors ${activeView === 'editor' ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-primary hover:bg-surface-bg'}`}
      >
        <Folder size={20} strokeWidth={2.5} />
      </div>
      <div 
        onClick={() => setActiveView('automation')}
        className={`p-2 rounded-xl cursor-pointer transition-colors ${activeView === 'automation' ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-primary hover:bg-surface-bg'}`}
        title="API Automation"
      >
        <Workflow size={20} strokeWidth={2.5} />
      </div>
      <SettingsMenu />
    </nav>
  );
}
