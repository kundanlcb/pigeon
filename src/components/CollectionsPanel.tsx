import React from 'react';
import { useSyncExternalStore } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import {
  AlertTriangle,
  CircleAlert,
  FolderPlus,
  Download,
  Plus,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  MoreHorizontal,
  Edit2,
  Copy,
  Trash2,
  Share,
  GitBranch,
  LoaderCircle,
  Play,
  FileUp,
  FileDown
} from 'lucide-react';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
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
  onImportClick: (type: 'request' | 'collection' | 'environment' | 'openapi', colId?: string, folderId?: string) => void;
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

  const [openTopMenu, setOpenTopMenu] = React.useState<'import' | 'more' | null>(null);

  React.useEffect(() => {
    const handleClickOutside = () => {
      setOpenColMenuId(null);
      setOpenEnvMenuId(null);
      setOpenTopMenu(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleExportWorkspace = async () => {
    try {
      const filePath = await save({
        filters: [{ name: 'Pigeon Workspace', extensions: ['json'] }],
        defaultPath: 'pigeon-workspace.json'
      });
      if (filePath) {
        const flows = useStore.getState().flows;
        const workspaceData = { collections, environments, flows };
        await writeTextFile(filePath, JSON.stringify(workspaceData, null, 2));
        useStore.getState().showToast('Workspace exported successfully!', 'success');
      }
    } catch (e: any) {
      useStore.getState().showToast('Error exporting workspace: ' + String(e), 'error');
    }
    setOpenTopMenu(null);
  };

  const handleImportWorkspace = async () => {
    try {
      const selected = await open({
        filters: [{ name: 'Pigeon Workspace', extensions: ['json'] }],
        multiple: false
      });
      if (selected && typeof selected === 'string') {
        const contents = await readTextFile(selected);
        const data = JSON.parse(contents);
        if (data && data.collections) {
          useStore.getState().importWorkspace(data);
          useStore.getState().showToast('Workspace imported successfully!', 'success');
        } else {
          useStore.getState().showToast('Invalid workspace file format.', 'error');
        }
      }
    } catch (e: any) {
      useStore.getState().showToast('Error importing workspace: ' + String(e), 'error');
    }
    setOpenTopMenu(null);
  };

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
    <Panel defaultSize={30} minSize={15} className="bg-[#161618] flex flex-col z-10 select-none rounded-tr-xl border-r border-t border-border-strong overflow-hidden relative shadow-2xl">
      <Group orientation="vertical">
        <Panel defaultSize={70} minSize={20} className="flex flex-col">
          {/* Header matching request detail section height */}
          <div className="h-[44px] px-4 flex items-center justify-between border-b border-border-subtle shrink-0 select-none">
            <span className="text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Explorer</span>
            <div className="flex items-center space-x-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); setIsAddingCollection(true); setNewCollectionName(''); setOpenTopMenu(null); }}
                title="New Collection"
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition-colors"
              >
                <Plus size={14} />
              </button>

              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenTopMenu(openTopMenu === 'import' ? null : 'import'); setOpenColMenuId(null); }}
                  title="Import"
                  className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition-colors"
                >
                  <Download size={14} />
                </button>
                {openTopMenu === 'import' && (
                  <div className="absolute top-full right-0 mt-1 w-44 bg-panel-bg border border-border-strong rounded shadow-2xl overflow-hidden z-50 py-1">
                    <div onClick={() => { setOpenTopMenu(null); onImportClick('request'); }} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                      Import Request
                    </div>
                    <div onClick={() => { setOpenTopMenu(null); onImportClick('collection'); }} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                      Import Collection
                    </div>
                    <div onClick={() => { setOpenTopMenu(null); onImportClick('openapi'); }} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                      Import OpenAPI
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
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenTopMenu(openTopMenu === 'more' ? null : 'more'); setOpenColMenuId(null); }}
                  title="More Actions..."
                  className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition-colors"
                >
                  <MoreHorizontal size={14} />
                </button>
                {openTopMenu === 'more' && (
                  <div className="absolute top-full right-0 mt-1 w-48 bg-panel-bg border border-border-strong rounded shadow-2xl overflow-hidden z-50 py-1">
                    <div onClick={() => { setOpenTopMenu(null); onAddEnvironmentClick(); }} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                      New Environment
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
                    <div className="h-px bg-border-subtle my-1"></div>
                    <div onClick={handleExportWorkspace} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                      <FileUp size={12} className="mr-2 opacity-70" /> Export Workspace
                    </div>
                    <div onClick={handleImportWorkspace} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                      <FileDown size={12} className="mr-2 opacity-70" /> Import Workspace
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pt-3 pb-2">
            {isAddingCollection && (
              <div className="px-2 py-1">
                <input
                  autoFocus
                  className="w-full bg-[#1e1e1e] border border-accent rounded-none px-2 py-0 text-xs h-[22px] text-text-primary outline-none"
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
              <div key={col.id} className="w-full">
                <div
                  onClick={() => toggleCollection(col.id)}
                  className="w-full flex items-center h-[24px] px-2 cursor-pointer text-[#cccccc] hover:text-white hover:bg-[#2a2d2e] transition-colors group relative select-none"
                >
                  <span className="w-4 h-4 flex items-center justify-center mr-1.5 flex-shrink-0 text-zinc-400 group-hover:text-zinc-200">
                    {col.isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </span>

                  {confirmDeleteColId === col.id ? (
                    <div className="flex items-center space-x-2 flex-1 mr-2" onClick={e => e.stopPropagation()}>
                      <span className="text-xs text-text-secondary flex-1 truncate">Delete?</span>
                      <button
                        onClick={() => { deleteCollection(col.id); setConfirmDeleteColId(null); }}
                        className="text-xs text-red-500 hover:underline"
                      >Yes</button>
                      <button
                        onClick={() => setConfirmDeleteColId(null)}
                        className="text-xs text-text-muted hover:text-text-primary"
                      >No</button>
                    </div>
                  ) : editingColId === col.id ? (
                    <input
                      autoFocus
                      className="flex-1 bg-[#1e1e1e] border border-accent rounded-none px-1 text-xs h-[18px] text-text-primary outline-none mr-2"
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
                    <span className="text-[12.5px] font-semibold tracking-[-0.01em] select-none truncate flex-1 text-zinc-300 group-hover:text-white">
                      {col.name}
                    </span>
                  )}

                  {col.storageMode === 'folder' && (
                    <span
                      className="ml-1 text-text-muted flex-shrink-0"
                      title={storageStatuses[col.id]?.message || (storageStatuses[col.id]?.state === 'saving' ? 'Saving collection files' : 'Folder-backed collection')}
                    >
                      {storageStatuses[col.id]?.state === 'saving' || storageStatuses[col.id]?.state === 'loading'
                        ? <LoaderCircle size={12} className="animate-spin" />
                        : storageStatuses[col.id]?.state === 'error' || storageStatuses[col.id]?.state === 'conflict'
                          ? <CircleAlert size={12} className="text-red-500" />
                          : <GitBranch size={12} />}
                    </span>
                  )}

                  {confirmDeleteColId !== col.id && editingColId !== col.id && (
                    <div className="opacity-0 group-hover:opacity-100 flex-shrink-0 relative ml-1 flex items-center">
                      <button
                        onClick={(e) => handleColAction(e, 'run-collection', col)}
                        className="p-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/50"
                        title="Run Collection"
                      >
                        <Play size={12} />
                      </button>
                      <button
                        onClick={(e) => handleColAction(e, 'add-request', col)}
                        className="p-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/50 ml-0.5"
                        title="Add Request"
                      >
                        <Plus size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenColMenuId(null);
                          setNewRootFolderCollectionId(col.id);
                          setNewRootFolderName('');
                          if (!col.isOpen) toggleCollection(col.id);
                        }}
                        className="p-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/50 ml-0.5"
                        title="Add Folder"
                      >
                        <FolderPlus size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenColMenuId(openColMenuId === col.id ? null : col.id);
                        }}
                        className="p-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/50 ml-0.5"
                        title="More Actions"
                      >
                        <MoreVertical size={13} />
                      </button>

                      {openColMenuId === col.id && (
                        <div className="absolute top-full right-0 mt-1 w-44 bg-panel-bg border border-border-strong rounded shadow-2xl overflow-hidden z-50 py-1">
                          <div onClick={(e) => handleColAction(e, 'run-collection', col)} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                            <Play size={12} className="mr-2 opacity-70" /> Run
                          </div>
                          <div className="h-px bg-border-subtle my-1"></div>
                          <div onClick={(e) => void handleStorageMode(e, col)} className="flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover cursor-pointer">
                            <GitBranch size={12} className="mr-2 opacity-70" />
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
                  <div className="w-full space-y-0">
                    {newRootFolderCollectionId === col.id && (
                      <div className="w-full flex items-center h-[24px] pr-2 pl-[30px]" onClick={event => event.stopPropagation()}>
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
                          className="w-full bg-[#1e1e1e] border border-accent rounded-none px-1.5 py-0 text-xs h-[20px] text-text-primary outline-none"
                        />
                      </div>
                    )}
                    <CollectionTree 
                      collection={col} 
                      onExportRequest={request => onExportClick?.('request', request)}
                      onImportRequest={folderId => onImportClick('request', col.id, folderId)}
                    />
                    {storageStatuses[col.id]?.errors.map(fileError => (
                      <div key={`${fileError.path}:${fileError.message}`} className="mx-4 my-1 flex items-center gap-1.5 text-[11px] text-red-500" title={fileError.message}>
                        <AlertTriangle size={12} className="flex-shrink-0" />
                        <span className="truncate">{fileError.path}: {fileError.message}</span>
                      </div>
                    ))}
                    {storageStatuses[col.id]?.conflicts.map(conflict => (
                      <div key={conflict.path} className="mx-4 my-1 flex flex-wrap items-center gap-2 border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 rounded text-[11px]">
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
          className={`flex flex-col bg-panel-bg ${isEnvCollapsed ? 'min-h-[24px]' : ''}`}
        >
          <div
            onClick={toggleEnvPanel}
            className="h-[24px] px-2 flex items-center justify-between border-t border-border-subtle shrink-0 cursor-pointer hover:bg-[#2a2d2e] transition-colors select-none"
          >
            <div className="flex items-center">
              <span className="w-4 h-4 flex items-center justify-center mr-1 flex-shrink-0 text-zinc-400">
                {isEnvCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
              </span>
              <span className="text-[11px] font-bold tracking-wider text-text-secondary uppercase">Environments</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const newEnvName = `Environment ${environments.length + 1}`;
                useStore.getState().addEnvironment(newEnvName);
                setIsEnvCollapsed(false);
              }}
              title="Add Environment"
              className="p-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition-colors"
            >
              <Plus size={13} />
            </button>
          </div>

          {!isEnvCollapsed && (
            <div className="overflow-y-auto pb-4">
              {environments.map(env => {
                const isActive = env.id === activeEnvironmentId;
                return (
                  <div key={env.id} className="w-full">
                    <div
                      onClick={() => openEnvironmentTab(env.id)}
                      className="w-full flex items-center h-[24px] pl-[30px] pr-2 cursor-pointer text-[#cccccc] hover:text-white hover:bg-[#2a2d2e] group transition-colors relative select-none"
                    >
                      <span className="w-4 h-4 flex items-center justify-center mr-1.5 flex-shrink-0">
                        {isActive ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                        )}
                      </span>

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
                          className="flex-1 bg-[#1e1e1e] border border-accent rounded-none px-1 text-xs h-[18px] text-text-primary outline-none"
                        />
                      ) : (
                        <span className={`text-[12.5px] leading-[24px] tracking-[-0.01em] flex-1 truncate select-none ${activeRequestId === env.id ? 'text-white font-medium' : 'text-[#cccccc] group-hover:text-white'}`}>
                          {env.name}
                        </span>
                      )}

                      {isActive && !editingEnvId && (
                        <span className="text-[9.5px] uppercase font-mono text-emerald-400 mr-1 flex-shrink-0">
                          active
                        </span>
                      )}

                      <div className="opacity-0 group-hover:opacity-100 flex-shrink-0 relative ml-1">
                        {confirmDeleteEnvId === env.id ? (
                          <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => void handleDeleteEnvironment(env.id)}
                              className="text-xs text-red-500 hover:underline"
                            >Yes</button>
                            <button
                              onClick={() => setConfirmDeleteEnvId(null)}
                              className="text-xs text-text-muted hover:text-text-primary"
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
                              className="p-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/50"
                            >
                              <MoreVertical size={13} />
                            </button>

                            {openEnvMenuId === env.id && (
                              <div className="absolute top-full right-0 mt-1 w-40 bg-panel-bg border border-border-strong rounded shadow-2xl overflow-hidden z-50 py-1">
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
                                  const filename = `${env.name.toLowerCase().replace(/\s+/g, '_')}_env.json`;
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
