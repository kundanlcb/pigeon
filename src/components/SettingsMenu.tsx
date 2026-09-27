import { useState, useRef, useEffect } from 'react';
import { Settings, Sun, Moon, Download, Info, X, Bird } from 'lucide-react';
import { useStore } from '../store';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const theme = useStore(state => state.theme);
  const toggleTheme = useStore(state => state.toggleTheme);
  const showToast = useStore((state: any) => state.showToast);

  useEffect(() => {
    // Silently check for updates on mount
    check().then(update => {
      if (update) setHasUpdate(true);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUpdate = async () => {
    try {
      setIsUpdating(true);
      const update = await check();
      if (update) {
        showToast(`Update found: ${update.version}. Installing...`);
        await update.downloadAndInstall();
        showToast("Update installed! Restarting app...");
        await relaunch();
      } else {
        showToast("You are on the latest version.");
      }
    } catch (e: any) {
      showToast("Error checking for updates: " + (e.message || String(e)));
    } finally {
      setIsUpdating(false);
      setIsOpen(false);
    }
  };

  const handleAbout = () => {
    setIsAboutOpen(true);
    setIsOpen(false);
  };

  return (
    <>
    <div className="relative mt-auto" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-bg cursor-pointer transition-colors outline-none"
      >
        <Settings size={20} strokeWidth={2.5} className={isOpen ? 'text-accent' : ''} />
        {hasUpdate && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-app-bg" />
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-2 left-14 w-52 bg-panel-bg border border-border-strong rounded-lg shadow-xl overflow-hidden z-50 py-1">
          <button
            onClick={() => { toggleTheme(); setIsOpen(false); }}
            className="w-full px-3 py-2 text-[13px] text-left flex items-center hover:bg-surface-hover text-text-primary transition-colors"
          >
            {theme === "dark" ? <Sun size={14} className="mr-2" /> : <Moon size={14} className="mr-2" />}
            Toggle Theme
          </button>
          
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="w-full px-3 py-2 text-[13px] text-left flex items-center hover:bg-surface-hover text-text-primary transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download size={14} className={`mr-2 ${isUpdating ? 'animate-bounce' : ''} ${hasUpdate && !isUpdating ? 'text-blue-500' : ''}`} />
            {isUpdating ? 'Checking...' : (hasUpdate ? 'Update Available' : 'Check for Updates')}
          </button>

          <div className="my-1 border-t border-border-subtle" />

          <button
            onClick={handleAbout}
            className="w-full px-3 py-2 text-[13px] text-left flex items-center hover:bg-surface-hover text-text-primary transition-colors cursor-pointer"
          >
            <Info size={14} className="mr-2" />
            About Pigeon
          </button>
        </div>
      )}
    </div>
      
      {isAboutOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-panel-bg border border-border-strong rounded-xl shadow-2xl p-6 w-80 relative flex flex-col items-center">
            <button 
              onClick={() => setIsAboutOpen(false)}
              className="absolute top-3 right-3 text-text-muted hover:text-text-primary p-1 rounded-md hover:bg-surface-hover transition-colors"
            >
              <X size={18} />
            </button>
            <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mb-4 text-accent">
              <Bird size={32} strokeWidth={2} />
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-1">Pigeon API</h2>
            <p className="text-sm text-text-secondary mb-6">v1.0.9</p>
            
            <div className="text-[13px] text-text-muted flex items-center gap-1.5 mb-2">
              Developed with <span className="text-red-500 animate-pulse">❤️</span> by
            </div>
            <a 
              href="https://github.com/kundanlcb" 
              target="_blank" 
              rel="noreferrer"
              className="text-sm font-medium text-accent hover:text-accent-hover hover:underline"
            >
              @kundanlcb
            </a>
          </div>
        </div>
      )}
    </>
  );
}
