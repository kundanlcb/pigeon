import React from 'react';
import { Panel } from 'react-resizable-panels';
import { Edit2, MoreVertical, Play, Plus, Trash2, Workflow } from 'lucide-react';
import { useStore } from '../store';

export function FlowsPanel() {
  const flows = useStore(state => state.flows);
  const activeFlowId = useStore(state => state.activeFlowId);
  const addFlow = useStore(state => state.addFlow);
  const deleteFlow = useStore(state => state.deleteFlow);
  const setActiveFlow = useStore(state => state.setActiveFlow);
  const updateFlow = useStore(state => state.updateFlow);

  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  const [editingFlowId, setEditingFlowId] = React.useState<string | null>(null);
  const [editingFlowName, setEditingFlowName] = React.useState('');
  const [confirmDeleteFlowId, setConfirmDeleteFlowId] = React.useState<string | null>(null);
  const [isAddingFlow, setIsAddingFlow] = React.useState(false);
  const [newFlowName, setNewFlowName] = React.useState('');

  React.useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const saveNewFlow = () => {
    const name = newFlowName.trim();
    if (name) addFlow(name);
    setIsAddingFlow(false);
    setNewFlowName('');
  };

  return (
    <Panel defaultSize={30} minSize={15} className="bg-panel-bg flex flex-col z-10 select-none">
      <div className="h-[44px] px-4 flex items-center justify-between border-b border-border-subtle shrink-0 select-none">
        <span className="text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Flows</span>
        <button
          onClick={() => { setIsAddingFlow(true); setNewFlowName(''); }}
          title="Add Flow"
          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {isAddingFlow && (
          <div className="px-2 py-1">
            <input
              autoFocus
              className="w-full bg-[#1e1e1e] border border-accent rounded-none px-2 py-0 text-xs h-[22px] text-text-primary outline-none"
              placeholder="Flow name..."
              value={newFlowName}
              onChange={e => setNewFlowName(e.target.value)}
              onBlur={saveNewFlow}
              onKeyDown={e => {
                if (e.key === 'Enter') saveNewFlow();
                else if (e.key === 'Escape') { setIsAddingFlow(false); setNewFlowName(''); }
              }}
            />
          </div>
        )}
        {flows.length === 0 && !isAddingFlow && (
          <div className="px-4 py-3 text-xs italic text-text-muted">No flows yet. Click + to create one.</div>
        )}
        {flows.map(flow => {
          const isActive = flow.id === activeFlowId;
          return (
            <div key={flow.id} className="w-full">
              <div
                onClick={() => setActiveFlow(flow.id)}
                className="w-full flex items-center h-[24px] px-2 cursor-pointer text-[#cccccc] hover:text-white hover:bg-[#2a2d2e] transition-colors group relative select-none"
              >
                <Workflow size={13} className="mr-2 text-zinc-400 group-hover:text-zinc-200 flex-shrink-0" />

                {confirmDeleteFlowId === flow.id ? (
                  <div className="flex items-center space-x-2 flex-1 mr-2" onClick={e => e.stopPropagation()}>
                    <span className="text-xs text-text-secondary flex-1 truncate">Delete?</span>
                    <button
                      onClick={() => { deleteFlow(flow.id); setConfirmDeleteFlowId(null); }}
                      className="px-2 py-0.5 bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded text-xs transition-colors"
                    >Yes</button>
                    <button
                      onClick={() => setConfirmDeleteFlowId(null)}
                      className="px-2 py-0.5 bg-surface-hover text-text-muted hover:text-text-primary rounded text-xs transition-colors"
                    >No</button>
                  </div>
                ) : editingFlowId === flow.id ? (
                  <input
                    autoFocus
                    className="flex-1 bg-surface-hover border border-border-strong rounded px-1.5 py-0.5 text-xs text-text-primary outline-none focus:border-accent mr-2"
                    value={editingFlowName}
                    onChange={e => setEditingFlowName(e.target.value)}
                    onBlur={() => {
                      if (editingFlowName.trim() && editingFlowName.trim() !== flow.name) {
                        updateFlow(flow.id, { name: editingFlowName.trim() });
                      }
                      setEditingFlowId(null);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        if (editingFlowName.trim() && editingFlowName.trim() !== flow.name) {
                          updateFlow(flow.id, { name: editingFlowName.trim() });
                        }
                        setEditingFlowId(null);
                      } else if (e.key === 'Escape') {
                        setEditingFlowId(null);
                      }
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className={`text-[12.5px] leading-[24px] tracking-[-0.01em] select-none truncate flex-1 ${isActive ? 'text-white font-semibold' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                    {flow.name}
                  </span>
                )}

                {confirmDeleteFlowId !== flow.id && editingFlowId !== flow.id && (
                  <div className="opacity-0 group-hover:opacity-100 flex-shrink-0 relative ml-1">
                    <button
                      onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === flow.id ? null : flow.id); }}
                      className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover"
                      title="Flow actions"
                    >
                      <MoreVertical size={14} />
                    </button>

                    {openMenuId === flow.id && (
                      <div onClick={e => e.stopPropagation()} className="absolute top-full right-0 mt-1 w-36 bg-panel-bg border border-border-strong rounded-lg shadow-xl overflow-hidden z-50 py-1">
                        <div onClick={() => { setActiveFlow(flow.id); setOpenMenuId(null); }} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                          <Play size={12} className="mr-2 opacity-70" /> Open
                        </div>
                        <div onClick={() => { setEditingFlowId(flow.id); setEditingFlowName(flow.name); setOpenMenuId(null); }} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                          <Edit2 size={12} className="mr-2 opacity-70" /> Rename
                        </div>
                        <div className="h-px bg-border-subtle my-1"></div>
                        <div onClick={() => { setConfirmDeleteFlowId(flow.id); setOpenMenuId(null); }} className="flex items-center px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 cursor-pointer">
                          <Trash2 size={12} className="mr-2 opacity-70" /> Delete
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
