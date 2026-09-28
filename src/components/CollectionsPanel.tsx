import React from 'react';
import { useSyncExternalStore } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { AlertTriangle, CircleAlert, Folder, FolderPlus, Download, Plus, ChevronDown, ChevronRight, MoreVertical, Edit2, Copy, Trash2, Share, GitBranch, LoaderCircle } from 'lucide-react';
import { useStore } from '../store';
import { downloadAsFile } from '../utils/file';
import type { Collection } from '../store';
import { serializePortableEnvironment } from '../utils/collectionFormat';
import { deleteSecret, getSecret, setSecret } from '../utils/secrets';
import { CollectionTree } from './CollectionTree';
import {
  chooseFolderForCollection,
  getCollectionStorageStatusSnapshot,
  openCollectionFolder,
  resolveStorageConflict,
  subscribeCollectionStorageStatus,
  switchToLocalStorage
} from '../utils/collectionStorage';

interface CollectionsPanelProps {
  onImportClick: (type: 'request' | 'collection' | 'environment', colId?: string) => void;
  onAddEnvironmentClick: () => void;
  onExportClick?: (type: 'request' | 'collection', item: any) => void;
}

export function CollectionsPanel({ onImportClick, onAddEnvironmentClick, onExportClick }: CollectionsPanelProps) {
  const storageStatuses = useSyncExternalStore(
    subscribeCollectionStorageStatus,
    getCollectionStorageStatusSnapshot,
    getCollectionStorageStatusSnapshot
  );
  const collections = useStore(state => state.collections);
  const environments = useStore(state => state.environments);
  const activeEnvironmentId = useStore(state => state.activeEnvironmentId);
  const openEnvironmentTab = useStore(state => state.openEnvironmentTab);
  
  const activeRequestId = useStore(state => state.activeRequestId);
  const toggleCollection = useStore(state => state.toggleCollection);
  const addCollection = useStore(state => state.addCollection);
  const renameCollection = useStore(state => state.renameCollection);
  const deleteCollection = useStore(state => state.deleteCollection);
  const addCollectionFolder = useStore(state => state.addCollectionFolder);
  
  const [openColMenuId, setOpenColMenuId] = React.useState<string | null>(null);
  const [editingColId, setEditingColId] = React.useState<string | null>(null);
  const [editColName, setEditColName] = React.useState('');
  const [confirmDeleteColId, setConfirmDeleteColId] = React.useState<string | null>(null);

  const [isAddingCollection, setIsAddingCollection] = React.useState(false);
  const [newCollectionName, setNewCollectionName] = React.useState('');
  const [newRootFolderCollectionId, setNewRootFolderCollectionId] = React.useState<string | null>(null);
  const [newRootFolderName, setNewRootFolderName] = React.useState('');
  
  const [isEnvCollapsed, setIsEnvCollapsed] = React.useState(true);
  const [openEnvMenuId, setOpenEnvMenuId] = React.useState<string | null>(null);
  const [confirmDeleteEnvId, setConfirmDeleteEnvId] = React.useState<string | null>(null);
  const [editingEnvId, setEditingEnvId] = React.useState<string | null>(null);
  const [editEnvName, setEditEnvName] = React.useState('');

  const [openTopMenu, setOpenTopMenu] = React.useState<'import' | 'add' | null>(null);

  React.useEffect(() => {
    const handleClickOutside = () => {
      setOpenColMenuId(null);
      setOpenEnvMenuId(null);
      setOpenTopMenu(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleColAction = (e: React.MouseEvent, action: string, col: Collection) => {
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
      useStore.getState().addRequest(col.id, { name: 'New Request', method: 'GET', url: '', headers: {} });
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

  const handleStorageMode = async (event: React.MouseEvent, collection: Collection) => {
    event.stopPropagation();
    setOpenColMenuId(null);
    try {
      if (collection.storageMode === 'folder') {
        await switchToLocalStorage(collection.id);
        useStore.getState().showToast('Collection now uses local storage. Folder files were kept.', 'success');
      } else {
        await chooseFolderForCollection(collection.id);
        useStore.getState().showToast('Collection folder storage enabled.', 'success');
      }
    } catch (error) {
      useStore.getState().showToast(error instanceof Error ? error.message : String(error), 'error');
    }
  };

  const saveRootFolder = (collectionId: string) => {
    const name = newRootFolderName.trim();
    if (name) addCollectionFolder(collectionId, name, null);
    setNewRootFolderCollectionId(null);
    setNewRootFolderName('');
  };

  const handleResolveConflict = async (collectionId: string, path: string, choice: 'reload' | 'keep') => {
    try {
      await resolveStorageConflict(collectionId, path, choice);
    } catch (error) {
      useStore.getState().showToast(error instanceof Error ? error.message : String(error), 'error');
    }
  };

  const handleDeleteEnvironment = async (environmentId: string) => {
    const environment = useStore.getState().environments.find(item => item.id === environmentId);
    if (!environment) return;
    const deletedSecrets: Array<{ key: string; value: string | null }> = [];
    try {
      for (const variable of environment.variables) {
        if (!variable.secret) continue;
        const value = await getSecret(environment.id, variable.key);
        await deleteSecret(environment.id, variable.key);
        deletedSecrets.push({ key: variable.key, value });
      }
      useStore.getState().deleteEnvironment(environmentId);
      setConfirmDeleteEnvId(null);
    } catch (error) {
      const rollbackErrors: string[] = [];
      for (const secret of deletedSecrets.reverse()) {
        if (secret.value === null) continue;
        try {
          await setSecret(environment.id, secret.key, secret.value);
        } catch (rollbackError) {
          rollbackErrors.push(String(rollbackError));
        }
      }
      const rollbackMessage = rollbackErrors.length ? ` Keychain rollback also failed: ${rollbackErrors.join('; ')}` : '';
      useStore.getState().showToast(`Could not delete environment secrets: ${String(error)}.${rollbackMessage}`, 'error');
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
            <button onClick={(e) => { e.stopPropagation(); setOpenTopMenu(openTopMenu === 'import' ? null : 'import'); setOpenColMenuId(null); }} title="Import" className="p-1 rounded text-text-muted hover:text-text-primary transition-colors">
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
                <div onClick={async () => {
                  setOpenTopMenu(null);
                  try {
                    await openCollectionFolder();
                  } catch (error) {
                    useStore.getState().showToast(error instanceof Error ? error.message : String(error), 'error');
                  }
                }} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                  Open Collection Folder
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setOpenTopMenu(openTopMenu === 'add' ? null : 'add'); setOpenColMenuId(null); }} title="Add" className="p-1 rounded text-text-muted hover:text-text-primary transition-colors">
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

              {col.storageMode === 'folder' && (
                <span
                  className="ml-1 text-text-muted flex-shrink-0"
                  title={storageStatuses[col.id]?.message || (storageStatuses[col.id]?.state === 'saving' ? 'Saving collection files' : 'Folder-backed collection')}
                >
                  {storageStatuses[col.id]?.state === 'saving' || storageStatuses[col.id]?.state === 'loading'
                    ? <LoaderCircle size={13} className="animate-spin" />
                    : storageStatuses[col.id]?.state === 'error' || storageStatuses[col.id]?.state === 'conflict'
                      ? <CircleAlert size={13} className="text-red-500" />
                      : <GitBranch size={13} />}
                </span>
              )}

              {confirmDeleteColId !== col.id && editingColId !== col.id && (
                <div className="opacity-0 group-hover:opacity-100 flex-shrink-0 relative ml-1">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenColMenuId(openColMenuId === col.id ? null : col.id);
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
                      <div onClick={(e) => void handleStorageMode(e, col)} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                        {col.storageMode === 'folder' ? <Folder size={12} className="mr-2 opacity-70" /> : <GitBranch size={12} className="mr-2 opacity-70" />}
                        {col.storageMode === 'folder' ? 'Use Local Storage' : 'Use Git Folder'}
                      </div>
                      <div onClick={(e) => handleColAction(e, 'add-request', col)} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                        <Plus size={12} className="mr-2 opacity-70" /> Add Request
                      </div>
                      <div onClick={(e) => {
                        e.stopPropagation();
                        setOpenColMenuId(null);
                        setNewRootFolderCollectionId(col.id);
                        setNewRootFolderName('');
                        if (!col.isOpen) toggleCollection(col.id);
                      }} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                        <FolderPlus size={12} className="mr-2 opacity-70" /> Add Folder
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
              <div className="ml-6 mt-1 space-y-1">
                {newRootFolderCollectionId === col.id && (
                  <div className="px-2 py-1" onClick={event => event.stopPropagation()}>
                    <input
                      autoFocus
                      value={newRootFolderName}
                      onChange={event => setNewRootFolderName(event.target.value)}
                      onBlur={() => saveRootFolder(col.id)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          event.currentTarget.blur();
                        } else if (event.key === 'Escape') {
                          setNewRootFolderCollectionId(null);
                          setNewRootFolderName('');
                        }
                      }}
                      placeholder="Folder name"
                      className="w-full bg-surface-hover border border-border-strong rounded px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
                    />
                  </div>
                )}
                <CollectionTree collection={col} onExportRequest={request => onExportClick?.('request', request)} />
                {storageStatuses[col.id]?.errors.map(fileError => (
                  <div key={`${fileError.path}:${fileError.message}`} className="mx-2 flex items-center gap-1.5 text-[11px] text-red-500" title={fileError.message}>
                    <AlertTriangle size={12} className="flex-shrink-0" />
                    <span className="truncate">{fileError.path}: {fileError.message}</span>
                  </div>
                ))}
                {storageStatuses[col.id]?.conflicts.map(conflict => (
                  <div key={conflict.path} className="mx-2 flex flex-wrap items-center gap-2 border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 rounded text-[11px]">
                    <span className="flex-1 min-w-[130px] text-text-secondary truncate">{conflict.path} changed on disk and in Pigeon</span>
                    <button onClick={() => void handleResolveConflict(col.id, conflict.path, 'reload')} className="text-text-primary hover:text-accent">Reload from disk</button>
                    <button onClick={() => void handleResolveConflict(col.id, conflict.path, 'keep')} className="text-text-primary hover:text-accent">Keep my edits</button>
                  </div>
                ))}
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
                            onClick={() => void handleDeleteEnvironment(env.id)}
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
                                downloadAsFile(filename, serializePortableEnvironment(env));
                                useStore.getState().showToast(`Exported ${filename}. Secret values are not included.`, 'success');
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
