import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldAlert, Settings as SettingsIcon, Globe, Info, Monitor, Bird } from 'lucide-react';
import { useStore } from '../store';
import { getVersion } from '@tauri-apps/api/app';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const appSettings = useStore(state => state.appSettings);
  const updateAppSettings = useStore(state => state.updateAppSettings);
  const theme = useStore(state => state.theme);
  const toggleTheme = useStore(state => state.toggleTheme);
  
  const [activeTab, setActiveTab] = useState<'general' | 'network' | 'about'>('general');
  const [appVersion, setAppVersion] = useState<string>('...');

  useEffect(() => {
    if ('__TAURI_INTERNALS__' in window) {
      getVersion().then(setAppVersion).catch(() => setAppVersion('Unknown'));
    } else {
      setAppVersion('Web Mode');
    }
  }, []);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-panel-bg rounded-xl shadow-2xl border border-border-strong flex overflow-hidden w-[750px] h-[500px] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Left Sidebar */}
        <div className="w-56 bg-surface-bg/60 border-r border-border-subtle flex flex-col">
          <div className="h-12 flex items-center px-4 mb-2 mt-2">
            <h2 className="text-sm font-bold text-text-primary tracking-wide flex items-center gap-2">
              <SettingsIcon size={16} className="text-accent" />
              Settings
            </h2>
          </div>
          
          <nav className="flex-1 px-3 space-y-1">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'general' ? 'bg-accent/15 text-accent shadow-sm' : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
              }`}
            >
              <Monitor size={15} /> General
            </button>
            <button
              onClick={() => setActiveTab('network')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'network' ? 'bg-accent/15 text-accent shadow-sm' : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
              }`}
            >
              <Globe size={15} /> Network
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'about' ? 'bg-accent/15 text-accent shadow-sm' : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
              }`}
            >
              <Info size={15} /> About
            </button>
          </nav>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col bg-app-bg relative">
          {/* Header Action */}
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={onClose}
              className="text-text-muted hover:text-text-primary p-1.5 rounded-md hover:bg-surface-hover transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-10 py-10">
            {activeTab === 'general' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-1">Appearance</h3>
                  <p className="text-xs text-text-muted mb-6">Customize the look and feel of Pigeon.</p>
                  
                  {/* One setting per row */}
                  <div className="flex items-center justify-between py-4 border-b border-border-subtle group">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Theme Mode</div>
                      <div className="text-xs text-text-muted mt-0.5">Toggle between Dark and Light mode</div>
                    </div>
                    
                    {/* Minimal Toggle Switch */}
                    <button 
                      onClick={toggleTheme}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 focus:ring-offset-app-bg ${theme === 'dark' ? 'bg-accent' : 'bg-surface-hover border border-border-strong'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'network' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-1">Network</h3>
                  <p className="text-xs text-text-muted mb-6">Configure how Pigeon handles outgoing requests.</p>
                  
                  {/* One setting per row */}
                  <div className="flex items-center justify-between py-4 border-b border-border-subtle">
                    <div className="pr-4">
                      <div className="text-sm font-medium text-text-primary flex items-center gap-2">
                        Disable SSL Validation
                        <ShieldAlert size={14} className="text-yellow-500" />
                      </div>
                      <div className="text-xs text-text-muted mt-1 leading-relaxed">
                        Bypass strict certificate checks. Required for corporate proxies.
                      </div>
                    </div>
                    <button 
                      onClick={() => updateAppSettings({ insecureSSL: !appSettings?.insecureSSL })}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 focus:ring-offset-app-bg ${appSettings?.insecureSSL ? 'bg-accent' : 'bg-surface-hover border border-border-strong'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${appSettings?.insecureSSL ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>

                  {/* One setting per row */}
                  <div className="flex items-center justify-between py-4 border-b border-border-subtle">
                    <div className="pr-4">
                      <div className="text-sm font-medium text-text-primary">Request Timeout</div>
                      <div className="text-xs text-text-muted mt-1">Maximum time (in milliseconds) to wait for a connection.</div>
                    </div>
                    <input 
                      type="number" 
                      value={appSettings?.requestTimeout || 30000}
                      onChange={(e) => updateAppSettings({ requestTimeout: parseInt(e.target.value) || 0 })}
                      className="w-24 bg-surface-bg border border-border-subtle hover:border-border-strong focus:border-accent rounded-md px-3 py-1.5 text-sm text-text-primary outline-none transition-colors"
                    />
                  </div>

                  {/* One setting per row */}
                  <div className="flex items-center justify-between py-4 border-b border-border-subtle">
                    <div className="pr-4">
                      <div className="text-sm font-medium text-text-primary">Max Redirects</div>
                      <div className="text-xs text-text-muted mt-1">Maximum number of HTTP redirects to follow automatically.</div>
                    </div>
                    <input 
                      type="number" 
                      value={appSettings?.maxRedirects || 10}
                      onChange={(e) => updateAppSettings({ maxRedirects: parseInt(e.target.value) || 0 })}
                      className="w-24 bg-surface-bg border border-border-subtle hover:border-border-strong focus:border-accent rounded-md px-3 py-1.5 text-sm text-text-primary outline-none transition-colors"
                    />
                  </div>

                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div className="flex flex-col items-center justify-center h-full space-y-5 animate-in fade-in duration-300">
                <div className="w-20 h-20 bg-gradient-to-br from-accent/20 to-accent/5 rounded-2xl flex items-center justify-center text-accent ring-1 ring-accent/20 shadow-inner">
                  <Bird size={40} strokeWidth={1.5} />
                </div>
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold text-text-primary">Pigeon</h2>
                  <p className="text-xs text-text-secondary font-mono tracking-widest uppercase">Version {appVersion}</p>
                </div>
                <div className="flex flex-col items-center gap-2 mt-6">
                  <div className="text-xs text-text-muted flex items-center gap-1">
                    Crafted with <span className="text-red-500 mx-1">❤️</span> by @adbhut
                  </div>
                  <div className="text-[10px] text-text-muted/60">
                    © {new Date().getFullYear()} Pigeon. All rights reserved.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
