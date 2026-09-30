import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Edit2, FolderPlus, MoreVertical, Plus, Share, Trash2, Download } from 'lucide-react';
import type { Collection, CollectionFolder, RequestItem } from '../store';
import { useStore } from '../store';
import { MethodIcon } from './MethodIcon';

interface CollectionTreeProps {
  collection: Collection;
  onExportRequest?: (request: RequestItem) => void;
  onImportRequest?: (folderId: string) => void;
}

function sortByOrder<T extends { order?: number; id: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id));
}

export function CollectionTree({ collection, onExportRequest, onImportRequest }: CollectionTreeProps) {
  const folders = collection.folders || [];
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState<string | null>(null);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [editingRequestName, setEditingRequestName] = useState('');


  const activeRequestId = useStore(state => state.activeRequestId);
  const setActiveRequest = useStore(state => state.setActiveRequest);
  const addRequest = useStore(state => state.addRequest);
  const renameRequest = useStore(state => state.renameRequest);
  const deleteRequest = useStore(state => state.deleteRequest);
  const duplicateRequest = useStore(state => state.duplicateRequest);

  const addFolder = useStore(state => state.addCollectionFolder);
  const renameFolder = useStore(state => state.renameCollectionFolder);
  const deleteFolder = useStore(state => state.deleteCollectionFolder);

  const allFolders = (parentId: string | null = null, depth = 0): Array<{ folder: CollectionFolder; depth: number }> =>
    sortByOrder(folders.filter(folder => folder.parentId === parentId)).flatMap(folder => [
      { folder, depth },
      ...allFolders(folder.id, depth + 1)
    ]);

  const getPaddingLeft = (depth: number) => 30 + depth * 18;

  const saveNewFolder = () => {
    const name = newFolderName.trim();
    if (name) addFolder(collection.id, name, newFolderParentId ?? null);
    setNewFolderParentId(undefined);
    setNewFolderName('');
  };

  const renderFolderInput = (parentId: string | null, depth: number) => newFolderParentId === parentId ? (
    <div className="w-full flex items-center h-[24px] pr-2" style={{ paddingLeft: `${getPaddingLeft(depth)}px` }}>
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
        className="w-full bg-[#1e1e1e] border border-accent rounded-none px-1.5 py-0 text-xs h-[20px] text-text-primary outline-none"
        placeholder="Folder name"
      />
    </div>
  ) : null;

  const renderRequest = (request: RequestItem, depth: number) => {
    const isActive = request.id === activeRequestId;
    return (
      <div
        key={request.id}
        onClick={() => setActiveRequest(request.id)}
        className="w-full flex items-center h-[24px] cursor-pointer hover:bg-[#2a2d2e] transition-colors group relative pr-2 select-none"
        style={{ paddingLeft: `${getPaddingLeft(depth)}px` }}
      >
        <span className="w-4 h-4 flex items-center justify-center mr-1.5 flex-shrink-0">
          <MethodIcon method={request.method} size={13} />
        </span>
        {editingRequestId === request.id ? (
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
            className="flex-1 min-w-0 bg-[#1e1e1e] border border-accent rounded-none px-1 text-xs h-[18px] text-text-primary outline-none"
          />
        ) : (
          <span className={`text-[12.5px] leading-[24px] tracking-[-0.01em] flex-1 truncate select-none ${isActive ? 'text-white font-semibold' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
            {request.name}
          </span>
        )}
        {editingRequestId !== request.id && (
          <div className="relative ml-1 flex-shrink-0 opacity-0 group-hover:opacity-100">
            <button
              onClick={event => {
                event.stopPropagation();
                setMenuId(menuId === request.id ? null : request.id);
              }}
              className="p-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/50"
              title="Request actions"
            >
              <MoreVertical size={13} />
            </button>
            {menuId === request.id && (
              <div onClick={event => event.stopPropagation()} className="absolute top-full right-0 mt-1 w-48 bg-panel-bg border border-border-strong rounded shadow-2xl z-50 py-1">
                <button onClick={() => { setEditingRequestId(request.id); setEditingRequestName(request.name); setMenuId(null); }} className="w-full flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover">
                  <Edit2 size={12} className="mr-2" /> Rename
                </button>
                <button onClick={() => { duplicateRequest(request.id); setMenuId(null); }} className="w-full flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover">
                  <Copy size={12} className="mr-2" /> Duplicate
                </button>
                <button onClick={() => { onExportRequest?.(request); setMenuId(null); }} className="w-full flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover">
                  <Share size={12} className="mr-2" /> Export Request
                </button>
                <div className="h-px bg-border-subtle my-1" />
                <button onClick={() => { deleteRequest(request.id); setMenuId(null); }} className="w-full flex items-center px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10">
                  <Trash2 size={12} className="mr-2" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderFolder = (folder: CollectionFolder, depth: number): React.ReactNode => {
    const isCollapsed = collapsedFolders.has(folder.id);
    const children = sortByOrder(folders.filter(child => child.parentId === folder.id));
    const requests = sortByOrder(collection.requests.filter(request => request.folderId === folder.id));
    return (
      <div key={folder.id} className="w-full">
        <div
          onClick={() => setCollapsedFolders(current => {
            const next = new Set(current);
            if (next.has(folder.id)) next.delete(folder.id);
            else next.add(folder.id);
            return next;
          })}
          className="w-full flex items-center h-[24px] cursor-pointer text-[#cccccc] hover:text-white hover:bg-[#2a2d2e] transition-colors group relative pr-2 select-none"
          style={{ paddingLeft: `${getPaddingLeft(depth)}px` }}
        >
          <span
            className="w-4 h-4 flex items-center justify-center mr-1.5 flex-shrink-0 text-zinc-400 group-hover:text-zinc-200"
            title={isCollapsed ? 'Expand folder' : 'Collapse folder'}
          >
            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </span>
          {editingFolderId === folder.id ? (
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
              className="flex-1 min-w-0 bg-[#1e1e1e] border border-accent rounded-none px-1 text-xs h-[18px] text-text-primary outline-none"
            />
          ) : (
            <span className="text-[12.5px] leading-[24px] tracking-[-0.01em] select-none truncate flex-1 text-[#cccccc] group-hover:text-white">
              {folder.name}
            </span>
          )}
          <div className="relative ml-1 flex-shrink-0 opacity-0 group-hover:opacity-100 flex items-center">
            <button
              onClick={event => {
                event.stopPropagation();
                addRequest(collection.id, { name: 'New Request', method: 'GET', url: '', headers: {}, folderId: folder.id });
                if (isCollapsed) {
                  setCollapsedFolders(current => {
                    const next = new Set(current);
                    next.delete(folder.id);
                    return next;
                  });
                }
              }}
              className="p-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/50"
              title="Add Request"
            >
              <Plus size={13} />
            </button>
            <button
              onClick={event => {
                event.stopPropagation();
                setNewFolderParentId(folder.id);
                setNewFolderName('');
                setMenuId(null);
                setCollapsedFolders(current => {
                  const next = new Set(current);
                  next.delete(folder.id);
                  return next;
                });
              }}
              className="p-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/50 ml-0.5"
              title="Add Subfolder"
            >
              <FolderPlus size={13} />
            </button>
            <button
              onClick={event => { event.stopPropagation(); setMenuId(menuId === folder.id ? null : folder.id); }}
              className="p-0.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/50 ml-0.5"
              title="Folder actions"
            >
              <MoreVertical size={13} />
            </button>
            {menuId === folder.id && (
              <div onClick={event => event.stopPropagation()} className="absolute top-full right-0 mt-1 w-40 bg-panel-bg border border-border-strong rounded shadow-2xl z-50 py-1">
                <button onClick={() => { addRequest(collection.id, { name: 'New Request', method: 'GET', url: '', headers: {}, folderId: folder.id }); setMenuId(null); }} className="w-full flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover">
                  <Plus size={12} className="mr-2" /> Add Request
                </button>
                <button onClick={() => { setNewFolderParentId(folder.id); setNewFolderName(''); setMenuId(null); setCollapsedFolders(current => { const next = new Set(current); next.delete(folder.id); return next; }); }} className="w-full flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover">
                  <FolderPlus size={12} className="mr-2" /> Add Subfolder
                </button>
                <button onClick={() => { setEditingFolderId(folder.id); setEditingFolderName(folder.name); setMenuId(null); }} className="w-full flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover">
                  <Edit2 size={12} className="mr-2" /> Rename
                </button>
                <button onClick={() => { onImportRequest?.(folder.id); setMenuId(null); }} className="w-full flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover">
                  <Download size={12} className="mr-2" /> Import Request
                </button>
                <div className="h-px bg-border-subtle my-1" />
                <button onClick={() => { deleteFolder(collection.id, folder.id); setMenuId(null); }} className="w-full flex items-center px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10">
                  <Trash2 size={12} className="mr-2" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
        {!isCollapsed && (
          <div className="w-full space-y-0">
            {renderFolderInput(folder.id, depth + 1)}
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
    <div className="w-full space-y-0">
      {rootFolders.map(folder => renderFolder(folder, 0))}
      {rootRequests.map(request => renderRequest(request, 0))}
    </div>
  );
}