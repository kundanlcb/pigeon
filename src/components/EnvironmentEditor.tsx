
import { useStore } from '../store';
import type { EnvironmentVariable } from '../store';
import { Trash2, Share, Check } from 'lucide-react';
import { downloadAsFile } from '../utils/file';
import { setSecret, deleteSecret } from '../utils/secrets';
import { useState } from 'react';

interface EnvironmentEditorProps {
  environmentId: string;
}

export function EnvironmentEditor({ environmentId }: EnvironmentEditorProps) {
  const environments = useStore(state => state.environments);
  const activeEnvironmentId = useStore(state => state.activeEnvironmentId);
  const updateEnvironment = useStore(state => state.updateEnvironment);
  const setActiveEnvironment = useStore(state => state.setActiveEnvironment);
  const [secretDrafts, setSecretDrafts] = useState<Record<string, string>>({});
  const [keyColWidth, setKeyColWidth] = useState(250);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.pageX;
    const startWidth = keyColWidth;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(100, Math.min(600, startWidth + (moveEvent.pageX - startX)));
      setKeyColWidth(newWidth);
    };
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
  };
  
  const selectedEnv = environments.find(e => e.id === environmentId);

  if (!selectedEnv) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
        <p>Environment not found</p>
      </div>
    );
  }

  const handleUpdateEnvName = (name: string) => {
    updateEnvironment(environmentId, { name });
  };



  const handleUpdateVariable = (id: string, updates: Partial<EnvironmentVariable>) => {
    const state = useStore.getState();
    const currentEnv = state.environments.find(e => e.id === environmentId);
    if (!currentEnv) return;
    updateEnvironment(environmentId, {
      variables: currentEnv.variables.map(v => v.id === id ? { ...v, ...updates } : v)
    });
  };

  const handleDeleteVariable = (id: string) => {
    const v = selectedEnv.variables.find(v => v.id === id);
    if (v && v.secret) {
      deleteSecret(environmentId, v.key).catch(console.error);
    }
    updateEnvironment(environmentId, {
      variables: selectedEnv.variables.filter(v => v.id !== id)
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-app-bg min-w-0 h-full overflow-hidden">
      <div className="px-4 h-[68px] border-b border-border-subtle flex justify-between items-center shrink-0">
        <input 
          type="text"
          value={selectedEnv.name}
          onChange={(e) => handleUpdateEnvName(e.target.value)}
          className="bg-transparent text-xl font-bold text-text-primary outline-none focus:border-accent border-b border-transparent w-1/2"
          placeholder="Environment Name"
        />
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => {
              const filename = `${selectedEnv.name.toLowerCase().replace(/\s+/g, '_')}_env.json`;
              downloadAsFile(filename, JSON.stringify(selectedEnv, null, 2));
              useStore.getState().showToast(`Exported ${filename} to your Downloads folder`, 'success');
            }}
            className="px-3 py-1.5 bg-surface-hover text-text-secondary hover:text-text-primary rounded text-sm transition-colors flex items-center"
            title="Export Environment"
          >
            <Share size={14} className="mr-1.5" /> Export
          </button>
          {activeEnvironmentId !== selectedEnv.id && (
            <button 
              onClick={() => setActiveEnvironment(selectedEnv.id)}
              className="px-3 py-1.5 bg-surface-hover text-text-secondary hover:text-text-primary rounded text-sm transition-colors"
            >
              Set Active
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-text-secondary">Variables</h3>
          </div>
          
          <div className="border border-border-strong rounded-lg overflow-hidden">
            <div 
              className="grid gap-px bg-border-strong text-[11px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border-strong shrink-0"
              style={{ gridTemplateColumns: `48px ${keyColWidth}px 1fr 64px 48px` }}
            >
              <div className="py-1.5 px-2 bg-surface-bg text-center flex items-center justify-center">Use</div>
              <div className="py-1.5 px-3 bg-surface-bg flex items-center relative">
                Variable
                <div 
                  onMouseDown={handleResizeStart}
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-accent/50 z-10 translate-x-1/2"
                  title="Resize Column"
                />
              </div>
              <div className="py-1.5 px-3 bg-surface-bg flex items-center">Initial Value</div>
              <div className="py-1.5 px-2 bg-surface-bg text-center flex items-center justify-center">Secret</div>
              <div className="py-1.5 px-2 bg-surface-bg"></div>
            </div>
            
            {selectedEnv.variables.map((v) => (
              <div 
                key={v.id} 
                className="grid gap-px bg-border-strong text-[13px] group border-b border-border-strong last:border-b-0"
                style={{ gridTemplateColumns: `48px ${keyColWidth}px 1fr 64px 48px` }}
              >
                <div className="py-1 px-2 bg-app-bg flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    checked={v.enabled}
                    onChange={(e) => handleUpdateVariable(v.id, { enabled: e.target.checked })}
                    className="accent-accent w-3.5 h-3.5 cursor-pointer rounded-sm"
                  />
                </div>
                <div className="bg-app-bg">
                  <input
                    type="text"
                    value={v.key}
                    onChange={(e) => {
                      const newKey = e.target.value;
                      
                      const state = useStore.getState();
                      const currentEnv = state.environments.find(env => env.id === environmentId);
                      if (!currentEnv) return;
                      
                      const freshVars = [...currentEnv.variables];
                      const freshIndex = freshVars.findIndex(v_ => v_.id === v.id);
                      if (freshIndex === -1) return;
                      
                      const isLast = freshIndex === freshVars.length - 1;
                      const isAdding = isLast && newKey.trim() !== '';
                      
                      freshVars[freshIndex] = { ...freshVars[freshIndex], key: newKey };
                      
                      if (isAdding) {
                        freshVars.push({ id: `var-${Date.now()}-${Math.random()}`, key: '', value: '', enabled: true, secret: false });
                      }
                      
                      updateEnvironment(environmentId, { variables: freshVars });
                    }}
                    placeholder="Add new variable"
                    className="w-full h-full py-1.5 px-3 bg-transparent text-text-primary outline-none font-mono text-[13px] placeholder-text-muted"
                  />
                </div>
                <div className="bg-app-bg relative">
                  <input
                    id={`secret-input-${v.id}`}
                    type={v.secret ? "password" : "text"}
                    value={secretDrafts[v.id] !== undefined ? secretDrafts[v.id] : (v.secret ? '' : v.value)}
                    onChange={(e) => {
                       if (v.secret) {
                         setSecretDrafts(prev => ({...prev, [v.id]: e.target.value}));
                       } else {
                         handleUpdateVariable(v.id, { value: e.target.value });
                       }
                    }}
                    onBlur={() => {
                       if (v.secret && secretDrafts[v.id] !== undefined) {
                         if (secretDrafts[v.id] !== '') {
                           setSecret(selectedEnv.id, v.key, secretDrafts[v.id]).then(() => {
                             useStore.getState().showToast('Secret saved to keychain', 'success');
                           }).catch(err => {
                             useStore.getState().showToast('Failed to save secret: ' + err, 'error');
                           });
                         }
                         setSecretDrafts(prev => {
                            const newDrafts = {...prev};
                            delete newDrafts[v.id];
                            return newDrafts;
                         });
                         handleUpdateVariable(v.id, { value: '' });
                       }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && v.secret && secretDrafts[v.id] !== undefined) {
                         if (secretDrafts[v.id] !== '') {
                           setSecret(selectedEnv.id, v.key, secretDrafts[v.id]).then(() => {
                             useStore.getState().showToast('Secret saved to keychain', 'success');
                           }).catch(err => {
                             useStore.getState().showToast('Failed to save secret: ' + err, 'error');
                           });
                         }
                         setSecretDrafts(prev => {
                            const newDrafts = {...prev};
                            delete newDrafts[v.id];
                            return newDrafts;
                         });
                         handleUpdateVariable(v.id, { value: '' });
                      }
                    }}
                    placeholder={v.secret ? "••••••" : "Value"}
                    className="w-full h-full py-1.5 px-3 bg-transparent text-text-primary outline-none font-mono text-[13px] placeholder-text-muted"
                  />
                  {v.secret && secretDrafts[v.id] !== undefined && (
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                         if (secretDrafts[v.id] !== '') {
                           setSecret(selectedEnv.id, v.key, secretDrafts[v.id]).then(() => {
                             useStore.getState().showToast('Secret saved to keychain', 'success');
                           }).catch(err => {
                             useStore.getState().showToast('Failed to save secret: ' + err, 'error');
                           });
                         }
                         setSecretDrafts(prev => {
                            const newDrafts = {...prev};
                            delete newDrafts[v.id];
                            return newDrafts;
                         });
                         handleUpdateVariable(v.id, { value: '' });
                         const el = document.getElementById(`secret-input-${v.id}`);
                         if (el) el.blur();
                      }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 bg-accent text-white rounded-md shadow hover:bg-accent-hover active:scale-95 transition-all z-10"
                      title="Save Secret"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
                <div className="py-1 px-2 bg-app-bg flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    checked={v.secret || false}
                    onChange={(e) => {
                       const isSecret = e.target.checked;
                       handleUpdateVariable(v.id, { secret: isSecret });
                       if (isSecret && v.value) {
                         setSecret(selectedEnv.id, v.key, v.value).then(() => {
                           handleUpdateVariable(v.id, { value: '' });
                         });
                       }
                    }}
                    className="accent-accent w-3.5 h-3.5 cursor-pointer rounded-sm"
                  />
                </div>
                <div className="py-1 px-2 bg-app-bg flex items-center justify-center">
                  <button 
                    onClick={() => handleDeleteVariable(v.id)}
                    className="text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {/* Standalone empty row removed; we use the trailing mapped row instead */}
          </div>
        </div>
      </div>
    </div>
  );
}
