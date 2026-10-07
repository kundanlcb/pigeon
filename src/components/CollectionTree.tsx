import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Edit2, FolderPlus, MoreVertical, Plus, Share, Trash2, Download } from 'lucide-react';
import type { Collection, CollectionFolder, RequestItem } from '../store';
import { useStore } from '../store';
import { MethodIcon } from './MethodIcon';
import { ContextMenu } from './ContextMenu';

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
  const collapsedFolders = useStore(state => state.collapsedFolderIds);
  const toggleFolderCollapse = useStore(state => state.toggleFolderCollapse);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [menuTriggerElement, setMenuTriggerElement] = useState<HTMLElement | null>(null);

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
        className="w-full bg-surface-bg border border-accent rounded-none px-1.5 py-0 text-xs h-[20px] text-text-primary outline-none"
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
        className={`w-full flex items-center h-[24px] cursor-pointer hover:bg-surface-hover transition-colors group relative pr-2 select-none ${menuId === request.id ? 'bg-surface-hover' : ''} ${isActive ? 'bg-accent/10 text-accent font-medium' : 'text-text-secondary hover:text-text-primary'}`}
        style={{ paddingLeft: `${getPaddingLeft(depth)}px` }}
      >
        <MethodIcon method={request.method} className="mr-1.5" />
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
            className="flex-1 min-w-0 bg-surface-bg border border-accent rounded-none px-1 text-xs h-[18px] text-text-primary outline-none"
          />
        ) : (
          <span className={`text-[12.5px] leading-[24px] tracking-[-0.01em] flex-1 truncate select-none ${isActive ? 'text-text-primary font-semibold' : 'text-text-secondary group-hover:text-text-primary'}`}>
            {request.name}
          </span>
        )}
        {editingRequestId !== request.id && (
          <div className={`relative ml-1 flex-shrink-0 transition-opacity ${menuId === request.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <button
              onClick={event => {
                event.stopPropagation();
                setMenuId(menuId === request.id ? null : request.id);
                setMenuTriggerElement(event.currentTarget);
              }}
              className={`p-0.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover ${menuId === request.id ? 'bg-surface-hover text-text-primary' : ''}`}
              title="Request actions"
            >
              <MoreVertical size={13} />
            </button>
            <ContextMenu isOpen={menuId === request.id} onClose={() => setMenuId(null)} triggerRef={{ current: menuTriggerElement }} width={160}>
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
            </ContextMenu>
          </div>
        )}
      </div>
    );
  };

  const renderFolder = (folder: CollectionFolder, depth: number): React.ReactNode => {
    const isCollapsed = collapsedFolders.includes(folder.id);
    const children = sortByOrder(folders.filter(child => child.parentId === folder.id));
    const requests = sortByOrder(collection.requests.filter(request => request.folderId === folder.id));
    return (
      <div key={folder.id} className="w-full">
        <div
          onClick={() => toggleFolderCollapse(folder.id)}
          className={`w-full flex items-center h-[24px] cursor-pointer text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors group relative pr-2 select-none ${menuId === folder.id ? 'bg-surface-hover text-text-primary' : ''}`}
          style={{ paddingLeft: `${getPaddingLeft(depth)}px` }}
        >
          <span
            className="w-5 h-5 flex items-center justify-center mr-1.5 flex-shrink-0 text-text-secondary group-hover:text-text-primary"
            title={isCollapsed ? 'Expand folder' : 'Collapse folder'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
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
              className="flex-1 min-w-0 bg-surface-bg border border-accent rounded-none px-1 text-xs h-[18px] text-text-primary outline-none"
            />
          ) : (
            <span className="text-[12.5px] leading-[24px] tracking-[-0.01em] select-none truncate flex-1 text-text-secondary group-hover:text-text-primary">
              {folder.name}
            </span>
          )}
          <div className={`relative ml-1 flex-shrink-0 flex items-center transition-opacity ${menuId === folder.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <button
              onClick={event => { 
                event.stopPropagation(); 
                setMenuId(menuId === folder.id ? null : folder.id); 
                setMenuTriggerElement(event.currentTarget);
              }}
              className={`p-0.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover ml-0.5 ${menuId === folder.id ? 'bg-surface-hover text-text-primary' : ''}`}
              title="Folder actions"
            >
              <MoreVertical size={13} />
            </button>
            <ContextMenu isOpen={menuId === folder.id} onClose={() => setMenuId(null)} triggerRef={{ current: menuTriggerElement }} width={160}>
                <button onClick={() => { addRequest(collection.id, { name: 'New Request', method: 'GET', url: '', headers: {}, folderId: folder.id }); setMenuId(null); }} className="w-full flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover">
                  <Plus size={12} className="mr-2" /> Add Request
                </button>
                <button onClick={() => { setNewFolderParentId(folder.id); setNewFolderName(''); setMenuId(null); if (collapsedFolders.includes(folder.id)) toggleFolderCollapse(folder.id); }} className="w-full flex items-center px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover">
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
            </ContextMenu>
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