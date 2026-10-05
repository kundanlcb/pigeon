
import { useStore } from '../store';
import type { EnvironmentVariable } from '../store';
import { Trash2, Share, Check, Eye, EyeOff } from 'lucide-react';
import { downloadAsFile } from '../utils/file';
import { getSecret, setSecret, deleteSecret } from '../utils/secrets';
import { serializePortableEnvironment } from '../utils/collectionFormat';
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
  const [secretKeyDrafts, setSecretKeyDrafts] = useState<Record<string, string>>({});
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [keyColWidth, setKeyColWidth] = useState(250);
  const [activeTab, setActiveTab] = useState<'variables' | 'secrets'>('variables');

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

  const handleDeleteVariable = async (id: string) => {
    const v = selectedEnv.variables.find(v => v.id === id);
    if (v && v.secretStored) {
      try {
        await deleteSecret(environmentId, v.key);
      } catch (error) {
        useStore.getState().showToast(`Failed to delete secret: ${String(error)}`, 'error');
        return;
      }
    }
    updateEnvironment(environmentId, {
      variables: selectedEnv.variables.filter(v => v.id !== id)
    });
  };

  const clearSecretDraft = (id: string) => {
    setSecretDrafts(drafts => {
      const next = { ...drafts };
      delete next[id];
      return next;
    });
  };

  const saveSecretDraft = async (variable: EnvironmentVariable) => {
    const value = secretDrafts[variable.id];
    if (value === undefined) return;
    if (!value) {
      clearSecretDraft(variable.id);
      return;
    }
    if (variable.secretStored) {
      try {
        await setSecret(environmentId, variable.key, value);
        handleUpdateVariable(variable.id, { value: '' });
        clearSecretDraft(variable.id);
        useStore.getState().showToast('Secret saved to keychain', 'success');
      } catch (error) {
        useStore.getState().showToast(`Failed to save secret: ${String(error)}`, 'error');
      }
    } else {
      handleUpdateVariable(variable.id, { value });
      clearSecretDraft(variable.id);
    }
  };

  const toggleRevealSecret = async (variable: EnvironmentVariable) => {
    if (revealedSecrets[variable.id] !== undefined) {
      setRevealedSecrets(prev => {
        const next = { ...prev };
        delete next[variable.id];
        return next;
      });
    } else {
      try {
        const value = await getSecret(environmentId, variable.key);
        if (value === null) {
          useStore.getState().showToast('Secret not found in keychain. Please save it again.', 'warning');
        }
        setRevealedSecrets(prev => ({ ...prev, [variable.id]: value || '' }));
      } catch (e) {
        useStore.getState().showToast(`Failed to retrieve secret: ${String(e)}`, 'error');
      }
    }
  };

  const updateSecretStatus = async (variable: EnvironmentVariable, makeSecret: boolean) => {
    if (makeSecret) {
      handleUpdateVariable(variable.id, { secret: true });
      return;
    }

    if (!variable.secret) return;

    if (variable.secretStored) {
      try {
        const value = await getSecret(environmentId, variable.key);
        if (value !== null) {
          await deleteSecret(environmentId, variable.key);
          handleUpdateVariable(variable.id, { secret: false, secretStored: false, value });
        } else {
          handleUpdateVariable(variable.id, { secret: false, secretStored: false });
        }
      } catch (error) {
        useStore.getState().showToast(`Failed to fetch from keychain: ${String(error)}`, 'error');
      }
    } else {
      handleUpdateVariable(variable.id, { secret: false });
    }
  };

  const updateKeychainStatus = async (variable: EnvironmentVariable, useKeychain: boolean) => {
    if (useKeychain) {
      if (variable.value) {
        try {
          await setSecret(environmentId, variable.key, variable.value);
          handleUpdateVariable(variable.id, { secretStored: true, value: '' });
        } catch (error) {
          useStore.getState().showToast(`Failed to save to keychain: ${String(error)}`, 'error');
        }
      } else {
        handleUpdateVariable(variable.id, { secretStored: true, value: '' });
      }
    } else {
      try {
        const value = await getSecret(environmentId, variable.key);
        if (value !== null) {
          await deleteSecret(environmentId, variable.key);
          handleUpdateVariable(variable.id, { secretStored: false, value });
        } else {
          handleUpdateVariable(variable.id, { secretStored: false, value: '' });
        }
      } catch (error) {
        useStore.getState().showToast(`Failed to fetch from keychain: ${String(error)}`, 'error');
      }
    }
  };

  const renameVariableKey = async (variable: EnvironmentVariable) => {
    const nextKey = secretKeyDrafts[variable.id]?.trim();
    if (!nextKey || nextKey === variable.key) {
      setSecretKeyDrafts(drafts => {
        const next = { ...drafts };
        delete next[variable.id];
        return next;
      });
      return;
    }

    if (variable.secret) {
      if (variable.secretStored === false) {
        // Nothing in keychain yet, safe to just rename the key in state
      } else {
        try {
          const value = await getSecret(environmentId, variable.key);
          if (value !== null) {
            await setSecret(environmentId, nextKey, value);
            await deleteSecret(environmentId, variable.key);
          }
        } catch (error) {
          useStore.getState().showToast(`Failed to rename secret variable: ${String(error)}`, 'error');
          return;
        }
      }
    }

    handleUpdateVariable(variable.id, { key: nextKey });
    setSecretKeyDrafts(drafts => {
      const next = { ...drafts };
      delete next[variable.id];
      return next;
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-app-bg min-w-0 h-full overflow-hidden">
      <div className="px-4 h-[44px] border-b border-border-subtle flex justify-between items-center shrink-0">
        <input 
          type="text"
          value={selectedEnv.name}
          onChange={(e) => handleUpdateEnvName(e.target.value)}
          className="bg-transparent text-base font-bold text-text-primary outline-none focus:border-accent border-b border-transparent w-1/2"
          placeholder="Environment Name"
        />
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => {
              const filename = `${selectedEnv.name.toLowerCase().replace(/\s+/g, '_')}_env.json`;
              downloadAsFile(filename, serializePortableEnvironment(selectedEnv));
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
          <div className="flex items-center space-x-6 border-b border-border-strong mb-4">
            <button
              className={`pb-2 text-sm font-semibold transition-colors ${activeTab === 'variables' ? 'text-accent border-b-2 border-accent' : 'text-text-secondary hover:text-text-primary border-b-2 border-transparent'}`}
              onClick={() => setActiveTab('variables')}
            >
              Variables
            </button>
            <button
              className={`pb-2 text-sm font-semibold transition-colors ${activeTab === 'secrets' ? 'text-accent border-b-2 border-accent' : 'text-text-secondary hover:text-text-primary border-b-2 border-transparent'}`}
              onClick={() => setActiveTab('secrets')}
            >
              Secrets
            </button>
          </div>
          
          <div className="border border-border-strong rounded-lg overflow-hidden">
            <div 
              className="grid gap-px bg-border-strong text-[11px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border-strong shrink-0"
              style={{ gridTemplateColumns: `48px ${keyColWidth}px 1fr 50px 70px 48px` }}
            >
              <div className="py-1.5 px-2 bg-surface-bg text-center flex items-center justify-center">Use</div>
              <div className="py-1.5 px-3 bg-surface-bg flex items-center relative">
                Variable
                <div 
                  onMouseDown={handleResizeStart}
                  className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize z-10 group/resizer flex justify-center translate-x-1/2"
                  title="Resize Column"
                >
                  <div className="w-[2px] h-full bg-transparent group-hover/resizer:bg-accent transition-colors" />
                </div>
              </div>
              <div className="py-1.5 px-3 bg-surface-bg flex items-center">Initial Value</div>
              <div className="py-1.5 px-2 bg-surface-bg text-center flex items-center justify-center" title="Hide value">Secret</div>
              <div className="py-1.5 px-2 bg-surface-bg text-center flex items-center justify-center" title="Store in OS Keychain">Keychain</div>
              <div className="py-1.5 px-2 bg-surface-bg"></div>
            </div>
            
            {(() => {
              let displayedVars = selectedEnv.variables.filter(v => activeTab === 'secrets' ? v.secret : !v.secret);
              if (displayedVars.length === 0 || displayedVars[displayedVars.length - 1].key.trim() !== '') {
                displayedVars = [...displayedVars, { id: `var-empty-${Date.now()}`, key: '', value: '', enabled: true, secret: activeTab === 'secrets' }];
              }
              return displayedVars.map((v) => {
                const isPlaceholder = v.id.startsWith('var-empty-');
                return (
              <div 
                key={v.id} 
                className="grid gap-px bg-border-strong text-[13px] group border-b border-border-strong last:border-b-0"
                style={{ gridTemplateColumns: `48px ${keyColWidth}px 1fr 50px 70px 48px` }}
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
                    value={v.secret ? (secretKeyDrafts[v.id] ?? v.key) : v.key}
                    onChange={(e) => {
                      const newKey = e.target.value;
                      if (v.secret && !isPlaceholder) {
                        setSecretKeyDrafts(drafts => ({ ...drafts, [v.id]: newKey }));
                        return;
                      }
                      
                      const state = useStore.getState();
                      const currentEnv = state.environments.find(env => env.id === environmentId);
                      if (!currentEnv) return;
                      
                      const freshVars = [...currentEnv.variables];
                      
                      if (isPlaceholder) {
                        if (newKey.trim() !== '') {
                          freshVars.push({ id: `var-${Date.now()}-${Math.random()}`, key: newKey, value: '', enabled: true, secret: activeTab === 'secrets' });
                          updateEnvironment(environmentId, { variables: freshVars });
                        }
                      } else {
                        const freshIndex = freshVars.findIndex(v_ => v_.id === v.id);
                        if (freshIndex === -1) return;
                        
                        freshVars[freshIndex] = { ...freshVars[freshIndex], key: newKey };
                        updateEnvironment(environmentId, { variables: freshVars });
                      }
                    }}
                    onBlur={() => {
                      if (v.secret) void renameVariableKey(v);
                    }}
                    placeholder="Add new variable"
                    className="w-full h-full py-1.5 px-3 bg-transparent text-text-primary outline-none font-mono text-[13px] placeholder-text-muted"
                  />
                </div>
                <div className="bg-app-bg relative">
                  <input
                    id={`secret-input-${v.id}`}
                    type={v.secret && revealedSecrets[v.id] === undefined ? "password" : "text"}
                    value={
                      (v.secret && v.secretStored)
                        ? (secretDrafts[v.id] !== undefined ? secretDrafts[v.id] : (revealedSecrets[v.id] !== undefined ? revealedSecrets[v.id] : ''))
                        : v.value
                    }
                    onChange={(e) => {
                       if (v.secret && v.secretStored) {
                         setSecretDrafts(prev => ({...prev, [v.id]: e.target.value}));
                       } else {
                         handleUpdateVariable(v.id, { value: e.target.value });
                       }
                    }}
                    onBlur={() => {
                       if (v.secret && v.secretStored) void saveSecretDraft(v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && v.secret && v.secretStored) {
                         void saveSecretDraft(v);
                      }
                    }}
                    placeholder={
                      (v.secret && v.secretStored)
                        ? (revealedSecrets[v.id] !== undefined ? "Empty" : '••••••')
                        : "Value"
                    }
                    className="w-full h-full py-1.5 pl-3 pr-8 bg-transparent text-text-primary outline-none font-mono text-[13px] placeholder-text-muted"
                  />
                  {v.secret && !isPlaceholder && (!v.secretStored || secretDrafts[v.id] === undefined) && (
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (v.secretStored) {
                          void toggleRevealSecret(v);
                        } else {
                          if (revealedSecrets[v.id] !== undefined) {
                            setRevealedSecrets(prev => { const next={...prev}; delete next[v.id]; return next; });
                          } else {
                            setRevealedSecrets(prev => ({...prev, [v.id]: 'local'}));
                          }
                        }
                      }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary transition-colors z-10"
                      title={revealedSecrets[v.id] !== undefined ? "Hide Secret" : "Show Secret"}
                    >
                      {revealedSecrets[v.id] !== undefined ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                  {v.secret && v.secretStored && secretDrafts[v.id] !== undefined && (
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                         void saveSecretDraft(v);
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
                      if (isPlaceholder) return;
                      void updateSecretStatus(v, e.target.checked);
                    }}
                    className="accent-accent w-3.5 h-3.5 cursor-pointer rounded-sm"
                  />
                </div>
                <div className="py-1 px-2 bg-app-bg flex items-center justify-center">
                  {v.secret && !isPlaceholder && (
                    <input 
                      type="checkbox" 
                      checked={v.secretStored || false}
                      onChange={(e) => {
                        void updateKeychainStatus(v, e.target.checked);
                      }}
                      className="accent-accent w-3.5 h-3.5 cursor-pointer rounded-sm"
                    />
                  )}
                </div>
                <div className="py-1 px-2 bg-app-bg flex items-center justify-center">
                  <button 
                    onClick={() => void handleDeleteVariable(v.id)}
                    className="text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
                );
              });
            })()}

            {/* Standalone empty row removed; we use the trailing mapped row instead */}
          </div>
        </div>
      </div>
    </div>
  );
}
