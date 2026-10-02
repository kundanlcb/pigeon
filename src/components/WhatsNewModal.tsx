import { useEffect, useState } from 'react';
import { X, Sparkles, Shield, Zap, CheckCircle2 } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';

const RELEASE_NOTES: Record<string, { title: string; date: string; features: { icon: any; title: string; desc: string }[] }> = {
  '2.0.12': {
    title: 'DevSecOps Suite & UI Polish',
    date: 'October 2026',
    features: [
      {
        icon: Shield,
        title: 'DevSecOps Collection Scanner',
        desc: 'Execute 50+ security checks (BOLA, Mass Assignment, SQLi) across entire API collections instantly.'
      },
      {
        icon: Zap,
        title: 'Export Security Reports',
        desc: 'Download fully structured JSON reports of your fleet audits to share with your security team.'
      },
      {
        icon: CheckCircle2,
        title: 'Bulk Selection & UI Upgrades',
        desc: 'Easily select/deselect hundreds of endpoints at once. Added syntax highlighting to payloads and fixed layout glitches on small screens.'
      }
    ]
  }
};

export function WhatsNewModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>('');

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const appVersion = await getVersion();
        setCurrentVersion(appVersion);
        
        const lastSeen = localStorage.getItem('pigeon_last_seen_version');
        if (lastSeen !== appVersion) {
          setIsOpen(true);
          localStorage.setItem('pigeon_last_seen_version', appVersion);
        }
      } catch (err) {
        // Fallback for web mode
        const fallbackVersion = '2.0.12';
        setCurrentVersion(fallbackVersion);
        const lastSeen = localStorage.getItem('pigeon_last_seen_version');
        if (lastSeen !== fallbackVersion) {
          setIsOpen(true);
          localStorage.setItem('pigeon_last_seen_version', fallbackVersion);
        }
      }
    };
    
    checkVersion();
  }, []);

  if (!isOpen) return null;

  const notes = RELEASE_NOTES[currentVersion] || RELEASE_NOTES['2.0.12'];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div 
        className="bg-panel-bg border border-border-strong rounded-xl shadow-2xl flex flex-col w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="relative h-32 bg-gradient-to-br from-accent/20 to-panel-bg flex flex-col items-center justify-center border-b border-border-strong overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] [mask-image:linear-gradient(to_bottom,white,transparent)]" />
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 bg-black/20 hover:bg-black/40 text-white/70 hover:text-white rounded-full transition-colors backdrop-blur-md"
            >
              <X size={16} />
            </button>
          </div>
          <Sparkles className="text-accent mb-2" size={32} />
          <h2 className="text-xl font-bold text-text-primary z-10">What's New in Pigeon</h2>
          <span className="text-xs font-medium bg-accent/20 text-accent px-2 py-0.5 rounded-full mt-2 z-10">
            v{currentVersion}
          </span>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-text-primary">{notes.title}</h3>
            <p className="text-xs text-text-muted mt-1">{notes.date}</p>
          </div>

          <div className="space-y-4">
            {notes.features.map((feat, i) => (
              <div key={i} className="flex gap-4 p-3 rounded-lg hover:bg-surface-hover/50 transition-colors">
                <div className="mt-0.5 flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                    <feat.icon size={16} className="text-accent" />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">{feat.title}</h4>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-strong bg-surface-bg flex justify-end">
          <button 
            onClick={() => setIsOpen(false)}
            className="px-6 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            Awesome, let's go!
          </button>
        </div>
      </div>
    </div>
  );
}
