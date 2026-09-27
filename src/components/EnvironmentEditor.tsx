
import { useStore } from '../store';
import type { EnvironmentVariable } from '../store';
import { Trash2, Share } from 'lucide-react';
import { downloadAsFile } from '../utils/file';

interface EnvironmentEditorProps {
  environmentId: string;
}

export function EnvironmentEditor({ environmentId }: EnvironmentEditorProps) {
  const environments = useStore(state => state.environments);
  const activeEnvironmentId = useStore(state => state.activeEnvironmentId);
  const updateEnvironment = useStore(state => state.updateEnvironment);
  const setActiveEnvironment = useStore(state => state.setActiveEnvironment);
  
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

  const handleAddVariable = () => {
    updateEnvironment(environmentId, {
      variables: [
        ...selectedEnv.variables,
        { id: `var-${Date.now()}`, key: '', value: '', enabled: true }
      ]
    });
  };

  const handleUpdateVariable = (id: string, updates: Partial<EnvironmentVariable>) => {
    updateEnvironment(environmentId, {
      variables: selectedEnv.variables.map(v => v.id === id ? { ...v, ...updates } : v)
    });
  };

  const handleDeleteVariable = (id: string) => {
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
            <div className="grid grid-cols-[48px_1fr_1fr_48px] gap-px bg-border-strong text-[11px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border-strong">
              <div className="py-1.5 px-2 bg-surface-bg text-center flex items-center justify-center">Use</div>
              <div className="py-1.5 px-3 bg-surface-bg flex items-center">Variable</div>
              <div className="py-1.5 px-3 bg-surface-bg flex items-center">Initial Value</div>
              <div className="py-1.5 px-2 bg-surface-bg"></div>
            </div>
            
            {selectedEnv.variables.map((v, index) => (
              <div key={v.id} className="grid grid-cols-[48px_1fr_1fr_48px] gap-px bg-border-strong text-[13px] group border-b border-border-strong">
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
                      handleUpdateVariable(v.id, { key: e.target.value });
                      if (index === selectedEnv.variables.length - 1 && e.target.value.trim() !== '') {
                        handleAddVariable();
                      }
                    }}
                    placeholder="Add new variable"
                    className="w-full h-full py-1.5 px-3 bg-transparent text-text-primary outline-none font-mono text-[13px] placeholder-text-muted"
                  />
                </div>
                <div className="bg-app-bg">
                  <input
                    type="text"
                    value={v.value}
                    onChange={(e) => handleUpdateVariable(v.id, { value: e.target.value })}
                    placeholder="Value"
                    className="w-full h-full py-1.5 px-3 bg-transparent text-text-primary outline-none font-mono text-[13px] placeholder-text-muted"
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

            {/* Empty row for adding new */}
            <div className="grid grid-cols-[48px_1fr_1fr_48px] gap-px bg-border-strong text-[13px] opacity-60 hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <div className="py-1 px-2 bg-app-bg flex items-center justify-center"></div>
              <div className="bg-app-bg">
                <input
                  type="text"
                  placeholder="New key"
                  onChange={(e) => {
                    if (e.target.value.trim()) {
                      updateEnvironment(environmentId, {
                        variables: [
                          ...selectedEnv.variables,
                          { id: `var-${Date.now()}`, key: e.target.value, value: '', enabled: true }
                        ]
                      });
                      e.target.value = '';
                    }
                  }}
                  className="w-full h-full py-1.5 px-3 bg-transparent text-text-primary outline-none font-mono text-[13px] placeholder-text-muted"
                />
              </div>
              <div className="bg-app-bg py-1.5 px-3 text-text-muted flex items-center font-mono">Value</div>
              <div className="py-1 px-2 bg-app-bg"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
