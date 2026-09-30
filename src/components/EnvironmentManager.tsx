import React, { useState } from 'react';
import { useStore } from '../store';
import type { EnvironmentVariable } from '../store';
import { X, Plus, Trash2, Share, CheckCircle2 } from 'lucide-react';
import { downloadAsFile } from '../utils/file';

interface EnvironmentManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EnvironmentManager({ isOpen, onClose }: EnvironmentManagerProps) {
  const environments = useStore(state => state.environments);
  const activeEnvironmentId = useStore(state => state.activeEnvironmentId);
  const addEnvironment = useStore(state => state.addEnvironment);
  const updateEnvironment = useStore(state => state.updateEnvironment);
  const deleteEnvironment = useStore(state => state.deleteEnvironment);
  const setActiveEnvironment = useStore(state => state.setActiveEnvironment);
  
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(environments[0]?.id || null);

  // If the selected env is deleted, select another one or null
  React.useEffect(() => {
    if (selectedEnvId && !environments.find(e => e.id === selectedEnvId)) {
      setSelectedEnvId(environments.length > 0 ? environments[0].id : null);
    }
    if (!selectedEnvId && environments.length > 0) {
      setSelectedEnvId(environments[0].id);
    }
  }, [environments, selectedEnvId]);

  if (!isOpen) return null;

  const selectedEnv = environments.find(e => e.id === selectedEnvId);

  const handleAddEnv = () => {
    addEnvironment('New Environment');
  };

  const handleUpdateEnvName = (name: string) => {
    if (selectedEnvId) {
      updateEnvironment(selectedEnvId, { name });
    }
  };



  const handleUpdateVariable = (id: string, updates: Partial<EnvironmentVariable>) => {
    const state = useStore.getState();
    const currentEnv = state.environments.find(e => e.id === selectedEnvId);
    if (!currentEnv) return;
    updateEnvironment(selectedEnvId!, {
      variables: currentEnv.variables.map(v => v.id === id ? { ...v, ...updates } : v)
    });
  };

  const handleDeleteVariable = (id: string) => {
    if (selectedEnv) {
      updateEnvironment(selectedEnvId!, {
        variables: selectedEnv.variables.filter(v => v.id !== id)
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-app-bg w-full max-w-4xl h-[600px] max-h-[90vh] rounded-xl shadow-2xl border border-border-strong flex overflow-hidden">
        
        {/* Left Sidebar - Environments List */}
        <div className="w-64 border-r border-border-subtle bg-surface-bg flex flex-col">
          <div className="p-4 border-b border-border-subtle flex justify-between items-center">
            <h2 className="font-semibold text-text-primary">Environments</h2>
            <button onClick={handleAddEnv} className="p-1 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded transition-colors">
              <Plus size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {environments.length === 0 ? (
              <div className="p-4 text-sm text-text-muted text-center">No environments created</div>
            ) : (
              environments.map(env => (
                <div 
                  key={env.id}
                  onClick={() => setSelectedEnvId(env.id)}
                  className={`flex items-center px-3 py-2 rounded-md cursor-pointer group ${selectedEnvId === env.id ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}
                >
                  <span className="flex-1 truncate text-sm font-medium">{env.name}</span>
                  
                  <div className="flex items-center space-x-1 shrink-0">
                    <div 
                      onClick={(e) => { e.stopPropagation(); setActiveEnvironment(activeEnvironmentId === env.id ? null : env.id); }}
                      className={`p-1 rounded transition-colors ${activeEnvironmentId === env.id ? 'text-text-primary' : 'text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100'}`}
                      title={activeEnvironmentId === env.id ? "Deactivate environment" : "Make active"}
                    >
                      <CheckCircle2 size={15} />
                    </div>

                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteEnvironment(env.id); }}
                      className={`p-1 rounded hover:bg-red-500/10 text-red-500 transition-colors ${selectedEnvId === env.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Area - Environment Editor */}
        <div className="flex-1 flex flex-col bg-app-bg min-w-0">
          <div className="p-4 border-b border-border-subtle flex justify-between items-center">
            {selectedEnv ? (
              <input 
                type="text"
                value={selectedEnv.name}
                onChange={(e) => handleUpdateEnvName(e.target.value)}
                className="bg-transparent text-lg font-bold text-text-primary outline-none focus:border-accent border-b border-transparent w-1/2"
                placeholder="Environment Name"
              />
            ) : (
              <div className="text-lg font-bold text-text-muted">Select an Environment</div>
            )}
            
            <div className="flex items-center space-x-3">
              {selectedEnv && (
                <>
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
                </>
              )}
              <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded transition-colors">
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {selectedEnv ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-text-secondary">Variables</h3>
                </div>
                
                <div className="border border-border-strong rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[48px_1fr_1fr_48px] gap-px bg-border-strong text-xs font-semibold text-text-secondary">
                    <div className="p-2 bg-surface-bg text-center">Use</div>
                    <div className="p-2 bg-surface-bg">Variable</div>
                    <div className="p-2 bg-surface-bg">Initial Value</div>
                    <div className="p-2 bg-surface-bg"></div>
                  </div>
                  
                  {selectedEnv.variables.map((v) => (
                    <div key={v.id} className="grid grid-cols-[48px_1fr_1fr_48px] gap-px bg-border-strong text-sm">
                      <div className="p-2 bg-app-bg flex items-center justify-center">
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
                            const currentEnv = state.environments.find(env => env.id === selectedEnvId);
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
                            
                            updateEnvironment(selectedEnvId!, { variables: freshVars });
                          }}
                          placeholder="Add new variable"
                          className="w-full h-full p-2 bg-transparent text-text-primary outline-none font-mono text-sm placeholder-text-muted"
                        />
                      </div>
                      <div className="bg-app-bg">
                        <input
                          type="text"
                          value={v.value}
                          onChange={(e) => handleUpdateVariable(v.id, { value: e.target.value })}
                          placeholder="Value"
                          className="w-full h-full p-2 bg-transparent text-text-primary outline-none font-mono text-sm placeholder-text-muted"
                        />
                      </div>
                      <div className="p-2 bg-app-bg flex items-center justify-center">
                        <button 
                          onClick={() => handleDeleteVariable(v.id)}
                          className="text-text-muted hover:text-red-500 opacity-0 hover:opacity-100 transition-opacity focus:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Standalone empty row removed because we append an empty row in variables */}
                </div>
                
                <div className="mt-8 flex justify-end">
                  <button 
                    onClick={onClose}
                    className="px-6 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors shadow-md flex items-center space-x-2"
                  >
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-text-muted">
                <p>Create or select an environment to manage variables.</p>
                <button 
                  onClick={handleAddEnv}
                  className="mt-4 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg flex items-center space-x-2 transition-colors shadow-md"
                >
                  <Plus size={16} />
                  <span>Create Environment</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
