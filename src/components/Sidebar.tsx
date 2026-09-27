
import { Folder, Search, Activity, Sun, Moon } from 'lucide-react';
import { useStore } from '../store';

export function Sidebar() {
  const toggleTheme = useStore(state => state.toggleTheme);
  const theme = useStore(state => state.theme);

  return (
    <nav className="w-12 bg-app-bg border-r border-border-subtle flex flex-col items-center py-4 space-y-6 z-10">
      <div className="p-2 rounded-xl bg-accent/10 text-accent cursor-pointer transition-colors">
        <Folder size={20} strokeWidth={2.5} />
      </div>
      <div className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-bg cursor-pointer transition-colors">
        <Search size={20} strokeWidth={2.5} />
      </div>
      <div className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-bg cursor-pointer transition-colors">
        <Activity size={20} strokeWidth={2.5} />
      </div>
      <div className="mt-auto p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-bg cursor-pointer transition-colors">
        <button onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={20} strokeWidth={2.5} /> : <Moon size={20} strokeWidth={2.5} />}
        </button>
      </div>
    </nav>
  );
}
