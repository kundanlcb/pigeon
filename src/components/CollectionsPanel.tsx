import React from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { Folder, Download, Plus, ChevronDown, ChevronRight, MoreVertical, Edit2, Copy, Trash2, Share } from 'lucide-react';
import { useStore } from '../store';
import { getMethodColor } from '../utils/styles';
import { downloadAsFile } from '../utils/file';
import type { RequestItem } from '../store';

interface CollectionsPanelProps {
  onImportClick: (type: 'request' | 'collection' | 'environment', colId?: string) => void;
  onAddEnvironmentClick: () => void;
  onExportClick?: (type: 'request' | 'collection', item: any) => void;
}

export function CollectionsPanel({ onImportClick, onAddEnvironmentClick, onExportClick }: CollectionsPanelProps) {
  const collections = useStore(state => state.collections);
  const environments = useStore(state => state.environments);
  const activeEnvironmentId = useStore(state => state.activeEnvironmentId);
  const openEnvironmentTab = useStore(state => state.openEnvironmentTab);
  
  const activeRequestId = useStore(state => state.activeRequestId);
  const toggleCollection = useStore(state => state.toggleCollection);
  const setActiveRequest = useStore(state => state.setActiveRequest);
  const renameRequest = useStore(state => state.renameRequest);
  const deleteRequest = useStore(state => state.deleteRequest);
  const duplicateRequest = useStore(state => state.duplicateRequest);
  const addCollection = useStore(state => state.addCollection);
  const renameCollection = useStore(state => state.renameCollection);
  const deleteCollection = useStore(state => state.deleteCollection);
  const addRequest = useStore(state => state.addRequest);

  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  
  const [openColMenuId, setOpenColMenuId] = React.useState<string | null>(null);
  const [editingColId, setEditingColId] = React.useState<string | null>(null);
  const [editColName, setEditColName] = React.useState('');
  const [confirmDeleteColId, setConfirmDeleteColId] = React.useState<string | null>(null);

  const [isAddingCollection, setIsAddingCollection] = React.useState(false);
  const [newCollectionName, setNewCollectionName] = React.useState('');
  
  const [isEnvCollapsed, setIsEnvCollapsed] = React.useState(true);
  const [openEnvMenuId, setOpenEnvMenuId] = React.useState<string | null>(null);
  const [confirmDeleteEnvId, setConfirmDeleteEnvId] = React.useState<string | null>(null);
  const [editingEnvId, setEditingEnvId] = React.useState<string | null>(null);
  const [editEnvName, setEditEnvName] = React.useState('');

  const [openTopMenu, setOpenTopMenu] = React.useState<'import' | 'add' | null>(null);

  React.useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuId(null);
      setOpenColMenuId(null);
      setOpenEnvMenuId(null);
      setOpenTopMenu(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleAction = (e: React.MouseEvent, action: string, req: RequestItem) => {
    e.stopPropagation();
    setOpenMenuId(null);
    if (action === 'rename') {
      setEditingId(req.id);
      setEditName(req.name);
      setConfirmDeleteId(null);
    } else if (action === 'duplicate') {
      duplicateRequest(req.id);
    } else if (action === 'delete') {
      setConfirmDeleteId(req.id);
      setEditingId(null);
    } else if (action === 'share') {
      onExportClick?.('request', req);
    }
  };

  const handleColAction = (e: React.MouseEvent, action: string, col: any) => {
    e.stopPropagation();
    setOpenColMenuId(null);
    if (action === 'rename') {
      setEditingColId(col.id);
      setEditColName(col.name);
      setConfirmDeleteColId(null);
    } else if (action === 'delete') {
      setConfirmDeleteColId(col.id);
      setEditingColId(null);
    } else if (action === 'add-request') {
      addRequest(col.id, { name: 'New Request', method: 'GET', url: '', headers: {} });
      if (!col.isOpen) {
        toggleCollection(col.id);
      }
    } else if (action === 'import-curl') {
      onImportClick('request', col.id);
      if (!col.isOpen) {
        toggleCollection(col.id);
      }
    } else if (action === 'export') {
      onExportClick?.('collection', col);
    } else if (action === 'run-collection') {
      useStore.getState().setActiveView('runner');
      useStore.getState().setRunnerState({ collectionId: col.id, isRunning: false, results: [], currentIndex: 0 });
    }
  };

  const toggleEnvPanel = () => {
    setIsEnvCollapsed(!isEnvCollapsed);
  };

  return (
    <Panel defaultSize={30} minSize={15} className="bg-panel-bg flex flex-col z-10">
      <Group orientation="vertical">
        <Panel defaultSize={70} minSize={20} className="flex flex-col">
          <div className="h-[44px] px-4 flex items-center justify-between border-b border-border-subtle shrink-0">
        <span className="text-xs font-semibold tracking-wider text-text-secondary uppercase">Collections</span>
        <div className="flex items-center space-x-2">
          
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setOpenTopMenu(openTopMenu === 'import' ? null : 'import'); setOpenMenuId(null); setOpenColMenuId(null); }} title="Import" className="p-1 rounded text-text-muted hover:text-text-primary transition-colors">
              <Download size={14} />
            </button>
            {openTopMenu === 'import' && (
              <div className="absolute top-full right-0 mt-1 w-44 bg-panel-bg border border-border-strong rounded-lg shadow-xl overflow-hidden z-50 py-1">
                <div onClick={() => { setOpenTopMenu(null); onImportClick('request'); }} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                  Import Request
                </div>
                <div onClick={() => { setOpenTopMenu(null); onImportClick('collection'); }} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                  Import Collection
                </div>
                <div onClick={() => { setOpenTopMenu(null); onImportClick('environment'); }} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                  Import Environment
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setOpenTopMenu(openTopMenu === 'add' ? null : 'add'); setOpenMenuId(null); setOpenColMenuId(null); }} title="Add" className="p-1 rounded text-text-muted hover:text-text-primary transition-colors">
              <Plus size={16} />
            </button>
            {openTopMenu === 'add' && (
              <div className="absolute top-full right-0 mt-1 w-44 bg-panel-bg border border-border-strong rounded-lg shadow-xl overflow-hidden z-50 py-1">
                <div onClick={() => { setOpenTopMenu(null); setIsAddingCollection(true); setNewCollectionName(''); }} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                  New Collection
                </div>
                <div onClick={() => { setOpenTopMenu(null); onAddEnvironmentClick(); }} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                  New Environment
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {isAddingCollection && (
          <div className="px-4 mb-2">
            <input
              autoFocus
              className="w-full bg-surface-hover border border-border-strong rounded px-2 py-1 text-sm text-text-primary outline-none focus:border-accent"
              placeholder="Collection name..."
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onBlur={() => {
                if (newCollectionName.trim()) {
                  addCollection(newCollectionName.trim());
                }
                setIsAddingCollection(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (newCollectionName.trim()) {
                    addCollection(newCollectionName.trim());
                  }
                  setIsAddingCollection(false);
                } else if (e.key === 'Escape') {
                  setIsAddingCollection(false);
                }
              }}
            />
          </div>
        )}
        {collections.map(col => (
          <div key={col.id} className="px-2">
            <div 
              onClick={() => toggleCollection(col.id)}
              className="flex items-center px-2 py-1.5 cursor-pointer text-text-secondary hover:text-text-primary transition-colors group relative"
            >
              {col.isOpen ? (
                <ChevronDown size={14} className="mr-1.5 opacity-50 group-hover:opacity-100 flex-shrink-0" />
              ) : (
                <ChevronRight size={14} className="mr-1.5 opacity-50 group-hover:opacity-100 flex-shrink-0" />
              )}
              <Folder size={14} className="mr-2 text-text-muted flex-shrink-0" />
              
              {confirmDeleteColId === col.id ? (
                <div className="flex items-center space-x-2 flex-1 mr-2" onClick={e => e.stopPropagation()}>
                  <span className="text-xs text-text-secondary flex-1 truncate">Delete?</span>
                  <button 
                    onClick={() => { deleteCollection(col.id); setConfirmDeleteColId(null); }}
                    className="px-2 py-0.5 bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded text-xs transition-colors"
                  >Yes</button>
                  <button 
                    onClick={() => setConfirmDeleteColId(null)}
                    className="px-2 py-0.5 bg-surface-hover text-text-muted hover:text-text-primary rounded text-xs transition-colors"
                  >No</button>
                </div>
              ) : editingColId === col.id ? (
                <input 
                  autoFocus
                  className="flex-1 bg-surface-hover border border-border-strong rounded px-1.5 py-0.5 text-xs text-text-primary outline-none focus:border-accent mr-2"
                  value={editColName}
                  onChange={(e) => setEditColName(e.target.value)}
                  onBlur={() => {
                    if (editColName.trim() && editColName.trim() !== col.name) {
                      renameCollection(col.id, editColName.trim());
                    }
                    setEditingColId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (editColName.trim() && editColName.trim() !== col.name) {
                        renameCollection(col.id, editColName.trim());
                      }
                      setEditingColId(null);
                    } else if (e.key === 'Escape') {
                      setEditingColId(null);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-[13px] select-none truncate flex-1">{col.name}</span>
              )}

              {confirmDeleteColId !== col.id && editingColId !== col.id && (
                <div className="opacity-0 group-hover:opacity-100 flex-shrink-0 relative ml-1">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenColMenuId(openColMenuId === col.id ? null : col.id);
                      setOpenMenuId(null);
                    }}
                    className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover"
                  >
                    <MoreVertical size={14} />
                  </button>
                  
                  {openColMenuId === col.id && (
                    <div className="absolute top-full right-0 mt-1 w-36 bg-panel-bg border border-border-strong rounded-lg shadow-xl overflow-hidden z-50 py-1">
                      <div onClick={(e) => handleColAction(e, 'run-collection', col)} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                        <span className="mr-2 opacity-70 flex items-center justify-center w-3 h-3"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg></span> Run
                      </div>
                      <div className="h-px bg-border-subtle my-1"></div>
                      <div onClick={(e) => handleColAction(e, 'add-request', col)} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                        <Plus size={12} className="mr-2 opacity-70" /> Add Request
                      </div>
                      <div onClick={(e) => handleColAction(e, 'import-curl', col)} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                        <Download size={12} className="mr-2 opacity-70" /> Import Request
                      </div>
                      <div onClick={(e) => handleColAction(e, 'rename', col)} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                        <Edit2 size={12} className="mr-2 opacity-70" /> Rename
                      </div>
                      <div onClick={(e) => handleColAction(e, 'export', col)} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                        <Share size={12} className="mr-2 opacity-70" /> Export
                      </div>
                      <div className="h-px bg-border-subtle my-1"></div>
                      <div onClick={(e) => handleColAction(e, 'delete', col)} className="flex items-center px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 cursor-pointer">
                        <Trash2 size={12} className="mr-2 opacity-70" /> Delete
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {col.isOpen && (
              <div className="ml-6 mt-1 space-y-0.5">
                {col.requests.map(req => {
                  const isActive = req.id === activeRequestId;
                  return (
                    <div 
                      key={req.id}
                      onClick={() => setActiveRequest(req.id)}
                      className="flex items-center px-2 py-1 cursor-pointer text-sm group transition-colors"
                    >
                      <span className={`text-[10px] font-bold w-10 ${getMethodColor(req.method)}`}>
                        {req.method.substring(0, 4)}
                      </span>
                      
                      {confirmDeleteId === req.id ? (
                        <div className="flex items-center space-x-2 flex-1 mr-2" onClick={e => e.stopPropagation()}>
                          <span className="text-xs text-text-secondary flex-1 truncate">Delete?</span>
                          <button 
                            onClick={() => { deleteRequest(req.id); setConfirmDeleteId(null); }}
                            className="px-2 py-0.5 bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded text-xs transition-colors"
                          >Yes</button>
                          <button 
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-0.5 bg-surface-hover text-text-muted hover:text-text-primary rounded text-xs transition-colors"
                          >No</button>
                        </div>
                      ) : editingId === req.id ? (
                        <input 
                          autoFocus
                          className="flex-1 bg-surface-hover border border-border-strong rounded px-1.5 py-0.5 text-xs text-text-primary outline-none focus:border-accent mr-2"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onBlur={() => {
                            if (editName.trim() && editName.trim() !== req.name) {
                              renameRequest(req.id, editName.trim());
                            }
                            setEditingId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (editName.trim() && editName.trim() !== req.name) {
                                renameRequest(req.id, editName.trim());
                              }
                              setEditingId(null);
                            } else if (e.key === 'Escape') {
                              setEditingId(null);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className={`text-[13px] flex-1 truncate select-none ${isActive ? 'text-text-primary font-medium' : 'text-text-secondary group-hover:text-text-primary'}`}>
                          {req.name}
                        </span>
                      )}
                      
                      {confirmDeleteId !== req.id && editingId !== req.id && (
                        <div className="opacity-0 group-hover:opacity-100 flex-shrink-0 relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === req.id ? null : req.id);
                            }}
                            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover"
                          >
                            <MoreVertical size={14} />
                          </button>
                          
                          {openMenuId === req.id && (
                            <div className="absolute top-full right-0 mt-1 w-36 bg-panel-bg border border-border-strong rounded-lg shadow-xl overflow-hidden z-50 py-1">
                              <div onClick={(e) => handleAction(e, 'rename', req)} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                                <Edit2 size={12} className="mr-2 opacity-70" /> Rename
                              </div>
                              <div onClick={(e) => handleAction(e, 'duplicate', req)} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                                <Copy size={12} className="mr-2 opacity-70" /> Duplicate
                              </div>
                              <div onClick={(e) => handleAction(e, 'share', req)} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                                <Share size={12} className="mr-2 opacity-70" /> Share as cURL
                              </div>
                              <div className="h-px bg-border-subtle my-1"></div>
                              <div onClick={(e) => handleAction(e, 'delete', req)} className="flex items-center px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 cursor-pointer">
                                <Trash2 size={12} className="mr-2 opacity-70" /> Delete
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      </Panel>

      <Separator className="flex items-center justify-center h-[1px] bg-border-subtle hover:bg-accent cursor-row-resize transition-colors shrink-0 group relative z-50">
        <div className="absolute w-full h-4 -top-1.5 bg-transparent" />
        <div className="w-8 h-[2px] bg-text-muted/40 rounded-full group-hover:bg-white/50 transition-colors" />
      </Separator>

      <Panel 
        defaultSize={isEnvCollapsed ? 0 : 30} 
        minSize={15}
        className={`flex flex-col bg-panel-bg ${isEnvCollapsed ? 'min-h-[44px]' : ''}`}
      >
        <div 
          onClick={toggleEnvPanel}
          className="h-[44px] px-4 flex items-center justify-between border-b border-transparent shrink-0 cursor-pointer hover:bg-surface-hover/30 transition-colors"
        >
          <div className="flex items-center">
            {isEnvCollapsed ? (
              <ChevronRight size={14} className="mr-1.5 opacity-50" />
            ) : (
              <ChevronDown size={14} className="mr-1.5 opacity-50" />
            )}
            <span className="text-xs font-semibold tracking-wider text-text-secondary uppercase">Environments</span>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              const newEnvName = `Environment ${environments.length + 1}`;
              useStore.getState().addEnvironment(newEnvName);
              setIsEnvCollapsed(false);
            }}
            title="Add Environment" 
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
        
        {!isEnvCollapsed && (
          <div className="overflow-y-auto pb-[140px]">
            {environments.map(env => {
              const isActive = env.id === activeEnvironmentId;
              return (
                <div key={env.id} className="px-2">
                  <div 
                    onClick={() => openEnvironmentTab(env.id)}
                    className="flex items-center px-2 py-1 cursor-pointer text-sm group transition-colors"
                  >
                    <Folder size={14} className="mr-2 text-text-muted flex-shrink-0" />
                    
                    {editingEnvId === env.id ? (
                      <input
                        autoFocus
                        value={editEnvName}
                        onChange={(e) => setEditEnvName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.stopPropagation();
                            if (editEnvName.trim()) {
                              useStore.getState().updateEnvironment(env.id, { name: editEnvName.trim() });
                            }
                            setEditingEnvId(null);
                          } else if (e.key === 'Escape') {
                            e.stopPropagation();
                            setEditingEnvId(null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={() => {
                          if (editEnvName.trim()) {
                            useStore.getState().updateEnvironment(env.id, { name: editEnvName.trim() });
                          }
                          setEditingEnvId(null);
                        }}
                        className="flex-1 bg-surface-bg border border-accent rounded px-1 text-[13px] text-text-primary outline-none"
                      />
                    ) : (
                      <span className={`text-[13px] flex-1 truncate select-none ${activeRequestId === env.id ? 'text-text-primary font-medium' : 'text-text-secondary group-hover:text-text-primary'}`}>
                        {env.name}
                      </span>
                    )}

                    {isActive && !editingEnvId && (
                      <span className="text-[10px] uppercase bg-accent/20 text-accent px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
                        Active
                      </span>
                    )}
                    
                    <div className="opacity-0 group-hover:opacity-100 flex-shrink-0 relative ml-1">
                      {confirmDeleteEnvId === env.id ? (
                        <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
                          <button 
                            onClick={() => { useStore.getState().deleteEnvironment(env.id); setConfirmDeleteEnvId(null); }}
                            className="px-2 py-0.5 bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded text-xs transition-colors"
                          >Yes</button>
                          <button 
                            onClick={() => setConfirmDeleteEnvId(null)}
                            className="px-2 py-0.5 bg-surface-hover text-text-muted hover:text-text-primary rounded text-xs transition-colors"
                          >No</button>
                        </div>
                      ) : (
                        <>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenEnvMenuId(openEnvMenuId === env.id ? null : env.id);
                              setOpenMenuId(null);
                              setOpenColMenuId(null);
                            }}
                            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover"
                          >
                            <MoreVertical size={14} />
                          </button>
                          
                          {openEnvMenuId === env.id && (
                            <div className="absolute top-full right-0 mt-1 w-36 bg-panel-bg border border-border-strong rounded-lg shadow-xl overflow-hidden z-50 py-1">
                              <div onClick={(e) => {
                                e.stopPropagation();
                                setOpenEnvMenuId(null);
                                setEditingEnvId(env.id);
                                setEditEnvName(env.name);
                              }} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                                <Edit2 size={12} className="mr-2 opacity-70" /> Rename
                              </div>
                              <div onClick={(e) => {
                                e.stopPropagation();
                                setOpenEnvMenuId(null);
                                useStore.getState().duplicateEnvironment(env.id);
                              }} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                                <Copy size={12} className="mr-2 opacity-70" /> Duplicate
                              </div>
                              <div className="h-px bg-border-subtle my-1"></div>
                              <div onClick={(e) => {
                                e.stopPropagation();
                                setOpenEnvMenuId(null);
                                const filename = `${env.name.toLowerCase().replace(/\\s+/g, '_')}_env.json`;
                                downloadAsFile(filename, JSON.stringify(env, null, 2));
                                useStore.getState().showToast(`Exported ${filename}`, 'success');
                              }} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                                <Share size={12} className="mr-2 opacity-70" /> Export
                              </div>
                              <div className="h-px bg-border-subtle my-1"></div>
                              <div onClick={(e) => {
                                e.stopPropagation();
                                setOpenEnvMenuId(null);
                                setConfirmDeleteEnvId(env.id);
                              }} className="flex items-center px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 cursor-pointer">
                                <Trash2 size={12} className="mr-2 opacity-70" /> Delete
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {environments.length === 0 && (
              <div className="px-6 py-2 text-xs text-text-muted italic">
                No environments yet
              </div>
            )}
          </div>
        )}
      </Panel>
      </Group>
    </Panel>
  );
}
