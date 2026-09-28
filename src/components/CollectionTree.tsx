import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Edit2, Folder, FolderPlus, MoreVertical, Plus, Share, Trash2 } from 'lucide-react';
import type { Collection, CollectionFolder, RequestItem } from '../store';
import { useStore } from '../store';
import { getMethodColor } from '../utils/styles';

interface CollectionTreeProps {
  collection: Collection;
  onExportRequest?: (request: RequestItem) => void;
}

function sortByOrder<T extends { order?: number; id: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id));
}

export function CollectionTree({ collection, onExportRequest }: CollectionTreeProps) {
  const folders = collection.folders || [];
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState<string | null>(null);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [editingRequestName, setEditingRequestName] = useState('');
  const [confirmDeleteRequestId, setConfirmDeleteRequestId] = useState<string | null>(null);

  const activeRequestId = useStore(state => state.activeRequestId);
  const setActiveRequest = useStore(state => state.setActiveRequest);
  const addRequest = useStore(state => state.addRequest);
  const renameRequest = useStore(state => state.renameRequest);
  const deleteRequest = useStore(state => state.deleteRequest);
  const duplicateRequest = useStore(state => state.duplicateRequest);
  const moveRequestToFolder = useStore(state => state.moveRequestToFolder);
  const addFolder = useStore(state => state.addCollectionFolder);
  const renameFolder = useStore(state => state.renameCollectionFolder);
  const deleteFolder = useStore(state => state.deleteCollectionFolder);

  const allFolders = (parentId: string | null = null, depth = 0): Array<{ folder: CollectionFolder; depth: number }> =>
    sortByOrder(folders.filter(folder => folder.parentId === parentId)).flatMap(folder => [
      { folder, depth },
      ...allFolders(folder.id, depth + 1)
    ]);

  const saveNewFolder = () => {
    const name = newFolderName.trim();
    if (name) addFolder(collection.id, name, newFolderParentId ?? null);
    setNewFolderParentId(undefined);
    setNewFolderName('');
  };

  const renderFolderInput = (parentId: string | null) => newFolderParentId === parentId ? (
    <div className="px-2 py-1" style={{ paddingLeft: `${12 + (parentId ? 20 : 0)}px` }}>
      <input
        autoFocus
        value={newFolderName}
        onChange={event => setNewFolderName(event.target.value)}
        onBlur={saveNewFolder}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            setNewFolderParentId(undefined);
          }
        }}
        className="w-full bg-surface-hover border border-border-strong rounded px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
        placeholder="Folder name"
      />
    </div>
  ) : null;

  const renderRequest = (request: RequestItem, depth: number) => {
    const isActive = request.id === activeRequestId;
    return (
      <div key={request.id} className="px-2" style={{ paddingLeft: `${8 + depth * 16}px` }}>
        <div
          onClick={() => setActiveRequest(request.id)}
          className="flex items-center px-2 py-1 cursor-pointer text-sm group transition-colors"
        >
          <span className={`text-[10px] font-bold w-10 flex-shrink-0 ${getMethodColor(request.method)}`}>
            {request.method.substring(0, 4)}
          </span>
          {confirmDeleteRequestId === request.id ? (
            <div className="flex items-center gap-2 flex-1" onClick={event => event.stopPropagation()}>
              <span className="text-xs text-text-secondary flex-1 truncate">Delete request?</span>
              <button onClick={() => { deleteRequest(request.id); setConfirmDeleteRequestId(null); }} className="text-xs text-red-500">Yes</button>
              <button onClick={() => setConfirmDeleteRequestId(null)} className="text-xs text-text-muted">No</button>
            </div>
          ) : editingRequestId === request.id ? (
            <input
              autoFocus
              value={editingRequestName}
              onChange={event => setEditingRequestName(event.target.value)}
              onBlur={() => {
                if (editingRequestName.trim()) renameRequest(request.id, editingRequestName.trim());
                setEditingRequestId(null);
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') setEditingRequestId(null);
              }}
              onClick={event => event.stopPropagation()}
              className="flex-1 min-w-0 bg-surface-hover border border-border-strong rounded px-1.5 py-0.5 text-xs text-text-primary outline-none"
            />
          ) : (
            <span className={`text-[13px] flex-1 truncate select-none ${isActive ? 'text-text-primary font-medium' : 'text-text-secondary group-hover:text-text-primary'}`}>
              {request.name}
            </span>
          )}
          {confirmDeleteRequestId !== request.id && editingRequestId !== request.id && (
            <div className="relative ml-1 flex-shrink-0">
              <button
                onClick={event => {
                  event.stopPropagation();
                  setMenuId(menuId === request.id ? null : request.id);
                }}
                className="p-1 rounded text-text-muted opacity-0 group-hover:opacity-100 hover:text-text-primary hover:bg-surface-hover"
                title="Request actions"
              >
                <MoreVertical size={14} />
              </button>
              {menuId === request.id && (
                <div onClick={event => event.stopPropagation()} className="absolute top-full right-0 mt-1 w-48 bg-panel-bg border border-border-strong rounded-lg shadow-xl z-50 py-1">
                  <button onClick={() => { setEditingRequestId(request.id); setEditingRequestName(request.name); setMenuId(null); }} className="w-full flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover">
                    <Edit2 size={12} className="mr-2" /> Rename
                  </button>
                  <button onClick={() => { duplicateRequest(request.id); setMenuId(null); }} className="w-full flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover">
                    <Copy size={12} className="mr-2" /> Duplicate
                  </button>
                  <label className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover">
                    <span>Move to</span>
                    <select
                      value={request.folderId || ''}
                      onChange={event => { moveRequestToFolder(request.id, event.target.value || null); setMenuId(null); }}
                      className="min-w-0 flex-1 bg-panel-bg text-text-primary outline-none"
                    >
                      <option value="">Collection root</option>
                      {allFolders().map(({ folder, depth }) => (
                        <option key={folder.id} value={folder.id}>{`${'  '.repeat(depth)}${folder.name}`}</option>
                      ))}
                    </select>
                  </label>
                  <button onClick={() => { onExportRequest?.(request); setMenuId(null); }} className="w-full flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover">
                    <Share size={12} className="mr-2" /> Export as cURL
                  </button>
                  <button onClick={() => { setConfirmDeleteRequestId(request.id); setMenuId(null); }} className="w-full flex items-center px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10">
                    <Trash2 size={12} className="mr-2" /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFolder = (folder: CollectionFolder, depth: number): React.ReactNode => {
    const isCollapsed = collapsedFolders.has(folder.id);
    const children = sortByOrder(folders.filter(child => child.parentId === folder.id));
    const requests = sortByOrder(collection.requests.filter(request => request.folderId === folder.id));
    return (
      <div key={folder.id}>
        <div
          className="flex items-center px-2 py-1.5 cursor-pointer text-text-secondary hover:text-text-primary transition-colors group relative"
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          <button
            onClick={() => setCollapsedFolders(current => {
              const next = new Set(current);
              if (next.has(folder.id)) next.delete(folder.id);
              else next.add(folder.id);
              return next;
            })}
            className="mr-1.5 flex-shrink-0 opacity-60 hover:opacity-100"
            title={isCollapsed ? 'Expand folder' : 'Collapse folder'}
          >
            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </button>
          <Folder size={13} className="mr-2 text-text-muted flex-shrink-0" />
          {confirmDeleteFolderId === folder.id ? (
            <div className="flex items-center gap-2 flex-1" onClick={event => event.stopPropagation()}>
              <span className="text-xs text-text-secondary flex-1 truncate">Delete folder and contents?</span>
              <button onClick={() => { deleteFolder(collection.id, folder.id); setConfirmDeleteFolderId(null); }} className="text-xs text-red-500">Yes</button>
              <button onClick={() => setConfirmDeleteFolderId(null)} className="text-xs text-text-muted">No</button>
            </div>
          ) : editingFolderId === folder.id ? (
            <input
              autoFocus
              value={editingFolderName}
              onChange={event => setEditingFolderName(event.target.value)}
              onBlur={() => {
                if (editingFolderName.trim()) renameFolder(collection.id, folder.id, editingFolderName.trim());
                setEditingFolderId(null);
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') setEditingFolderId(null);
              }}
              onClick={event => event.stopPropagation()}
              className="flex-1 min-w-0 bg-surface-hover border border-border-strong rounded px-1.5 py-0.5 text-xs text-text-primary outline-none"
            />
          ) : (
            <span className="text-[13px] select-none truncate flex-1">{folder.name}</span>
          )}
          <div className="relative ml-1">
            <button
              onClick={event => { event.stopPropagation(); setMenuId(menuId === folder.id ? null : folder.id); }}
              className="p-1 rounded text-text-muted opacity-0 group-hover:opacity-100 hover:text-text-primary hover:bg-surface-hover"
              title="Folder actions"
            >
              <MoreVertical size={14} />
            </button>
            {menuId === folder.id && (
              <div onClick={event => event.stopPropagation()} className="absolute top-full right-0 mt-1 w-40 bg-panel-bg border border-border-strong rounded-lg shadow-xl z-50 py-1">
                <button onClick={() => { addRequest(collection.id, { name: 'New Request', method: 'GET', url: '', headers: {}, folderId: folder.id }); setMenuId(null); }} className="w-full flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover">
                  <Plus size={12} className="mr-2" /> Add Request
                </button>
                <button onClick={() => { setNewFolderParentId(folder.id); setNewFolderName(''); setMenuId(null); setCollapsedFolders(current => { const next = new Set(current); next.delete(folder.id); return next; }); }} className="w-full flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover">
                  <FolderPlus size={12} className="mr-2" /> Add Subfolder
                </button>
                <button onClick={() => { setEditingFolderId(folder.id); setEditingFolderName(folder.name); setMenuId(null); }} className="w-full flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover">
                  <Edit2 size={12} className="mr-2" /> Rename
                </button>
                <button onClick={() => { setConfirmDeleteFolderId(folder.id); setMenuId(null); }} className="w-full flex items-center px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10">
                  <Trash2 size={12} className="mr-2" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
        {!isCollapsed && (
          <div>
            {renderFolderInput(folder.id)}
            {children.map(child => renderFolder(child, depth + 1))}
            {requests.map(request => renderRequest(request, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootFolders = sortByOrder(folders.filter(folder => !folder.parentId));
  const rootRequests = sortByOrder(collection.requests.filter(request => !request.folderId || !folders.some(folder => folder.id === request.folderId)));

  return (
    <div className="ml-6 mt-1 space-y-0.5">
      {rootFolders.map(folder => renderFolder(folder, 0))}
      {rootRequests.map(request => renderRequest(request, 0))}
    </div>
  );
}