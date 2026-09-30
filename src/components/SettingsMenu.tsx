import { useState, useRef, useEffect } from 'react';
import { Settings, Download } from 'lucide-react';
import { useStore } from '../store';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

import { SettingsModal } from './SettingsModal';

export function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasUpdate] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const showToast = useStore((state: any) => state.showToast);

  // Removed silent check on mount to prevent loop on broken macOS translocation

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

  return (
    <>
    <div className="relative mt-auto w-full" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-12 flex items-center justify-center cursor-pointer transition-colors outline-none border-l-2 border-transparent ${isOpen ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
        title="Settings"
      >
        <Settings size={21} strokeWidth={1.5} />
        {hasUpdate && (
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-500 rounded-full" />
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-2 left-14 w-52 bg-panel-bg border border-border-strong rounded-lg shadow-xl overflow-hidden z-50 py-1">
          <button
            onClick={() => { setIsSettingsOpen(true); setIsOpen(false); }}
            className="w-full px-3 py-2 text-[13px] text-left flex items-center hover:bg-surface-hover text-text-primary transition-colors"
          >
            <Settings size={14} className="mr-2" />
            Settings
          </button>
          
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="w-full px-3 py-2 text-[13px] text-left flex items-center hover:bg-surface-hover text-text-primary transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download size={14} className={`mr-2 ${isUpdating ? 'animate-bounce' : ''} ${hasUpdate && !isUpdating ? 'text-blue-500' : ''}`} />
            {isUpdating ? 'Checking...' : (hasUpdate ? 'Update Available' : 'Check for Updates')}
          </button>


        </div>
      )}
    </div>
      

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
