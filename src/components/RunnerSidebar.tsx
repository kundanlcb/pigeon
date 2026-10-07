import { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, MoreHorizontal } from 'lucide-react';
import { SidebarRequest } from './SidebarNodes';
import { useStore } from '../store';
import { Panel } from 'react-resizable-panels';
export function RunnerSidebar() {
  const collections = useStore(state => state.collections);
  const selectedRequestIds = useStore(state => state.selectedRunnerRequestIds);
  const setSelectedRequestIds = useStore(state => state.setSelectedRunnerRequestIds);

  const expandedColIds = useStore(state => state.runnerExpandedColIds);
  const toggleCollectionExpand = useStore(state => state.toggleRunnerCollectionCollapse);
  const [activeMenuColId, setActiveMenuColId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuColId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);





  const toggleRequestSelection = (reqId: string) => {
    let next = [...selectedRequestIds];
    if (next.includes(reqId)) {
      next = next.filter(id => id !== reqId);
    } else {
      next.push(reqId);
    }
    setSelectedRequestIds(next);
  };

  const allRequestIds = collections.flatMap(c => c.requests.map(r => r.id));
  const isAllSelected = collections.length > 0 && selectedRequestIds.length === allRequestIds.length;

  const handleBulkToggle = () => {
    if (isAllSelected) {
      setSelectedRequestIds([]);
    } else {
      setSelectedRequestIds(allRequestIds);
    }
  };

  const getRequestsForNode = (colId: string, folderId?: string | null) => {
    const col = collections.find(c => c.id === colId);
    if (!col) return [];
    if (!folderId) return col.requests;
    
    const getAllFolderIds = (fid: string): string[] => {
      if (!col.folders) return [];
      const children = col.folders.filter(f => f.parentId === fid).map(f => f.id);
      return [fid, ...children.flatMap(getAllFolderIds)];
    };
    
    const targetFolderIds = getAllFolderIds(folderId);
    return col.requests.filter(r => r.folderId && targetFolderIds.includes(r.folderId));
  };

  const handleSelectNodeMethod = (colId: string, folderId: string | null, method: string) => {
    const reqs = getRequestsForNode(colId, folderId);
    const methodIds = reqs.filter(r => r.method === method).map(r => r.id);
    const newSelected = new Set([...selectedRequestIds]);
    methodIds.forEach(id => newSelected.add(id));
    setSelectedRequestIds(Array.from(newSelected));
    setActiveMenuColId(null);
  };

  const handleSelectNodeAll = (colId: string, folderId: string | null) => {
    const reqs = getRequestsForNode(colId, folderId);
    const reqIds = reqs.map(r => r.id);
    const newSelected = new Set([...selectedRequestIds]);
    reqIds.forEach(id => newSelected.add(id));
    setSelectedRequestIds(Array.from(newSelected));
    setActiveMenuColId(null);
  };
  
  const handleDeselectNodeAll = (colId: string, folderId: string | null) => {
    const reqs = getRequestsForNode(colId, folderId);
    const reqIds = reqs.map(r => r.id);
    const newSelected = selectedRequestIds.filter(id => !reqIds.includes(id));
    setSelectedRequestIds(newSelected);
    setActiveMenuColId(null);
  };

  return (
    <Panel id="runner-sidebar" defaultSize={30} minSize={15} className="bg-panel-bg flex flex-col z-10 select-none overflow-hidden relative">
      <div className="h-[44px] px-4 flex items-center justify-between shrink-0 select-none">
        <span className="text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Collection Runner</span>
        {collections.length > 0 && (
          <button
            onClick={handleBulkToggle}
            className="text-[10px] font-medium text-text-muted hover:text-text-primary transition-colors"
          >
            {isAllSelected ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-2">
        {collections.map(col => {
          const isExpanded = expandedColIds.includes(col.id);
          
          return (
            <div key={col.id} className="relative w-full">
              <div
                className="w-full flex items-center h-[24px] px-2 cursor-pointer text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors group relative select-none"
              >
                <div 
                  onClick={() => toggleCollectionExpand(col.id)}
                  className="w-5 h-5 flex items-center justify-center mr-1.5 flex-shrink-0 cursor-pointer text-text-muted hover:text-text-primary"
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
                <div className="flex-1 min-w-0 flex items-center overflow-hidden cursor-pointer h-full" onClick={() => toggleCollectionExpand(col.id)}>
                  <span className="text-[12.5px] font-semibold tracking-[-0.01em] truncate text-text-secondary group-hover:text-text-primary">
                    {col.name}
                  </span>
                </div>
                <button
                  className="w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-primary hover:bg-border-subtle rounded flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuColId(activeMenuColId === col.id ? null : col.id);
                  }}
                >
                  <MoreHorizontal size={14} />
                </button>

                  {activeMenuColId === col.id && (
                    <div 
                      ref={menuRef}
                      className="absolute top-6 right-0 w-36 bg-surface-bg border border-border-strong rounded-md shadow-lg z-50 py-1 text-[11px]"
                    >
                      <button className="w-full text-left px-3 py-1.5 hover:bg-surface-hover text-blue-400 font-medium" onClick={() => handleSelectNodeMethod(col.id, null, 'GET')}>Select GET</button>
                      <button className="w-full text-left px-3 py-1.5 hover:bg-surface-hover text-green-400 font-medium" onClick={() => handleSelectNodeMethod(col.id, null, 'POST')}>Select POST</button>
                      <button className="w-full text-left px-3 py-1.5 hover:bg-surface-hover text-yellow-400 font-medium" onClick={() => handleSelectNodeMethod(col.id, null, 'PUT')}>Select PUT</button>
                      <button className="w-full text-left px-3 py-1.5 hover:bg-surface-hover text-red-400 font-medium" onClick={() => handleSelectNodeMethod(col.id, null, 'DELETE')}>Select DELETE</button>
                      <div className="h-px bg-border-subtle my-1"></div>
                      <button className="w-full text-left px-3 py-1.5 hover:bg-surface-hover" onClick={() => handleSelectNodeAll(col.id, null)}>Select All</button>
                      <button className="w-full text-left px-3 py-1.5 hover:bg-surface-hover" onClick={() => handleDeselectNodeAll(col.id, null)}>Deselect All</button>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div className="w-full">
                    {(() => {
                      const rootFolders = col.folders ? [...col.folders].filter(f => !f.parentId).sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
                      const rootRequests = [...col.requests].filter(r => !r.folderId).sort((a, b) => (a.order || 0) - (b.order || 0));

                      const renderRequest = (req: any, depth: number) => (
                        <SidebarRequest 
                          key={req.id} 
                          request={req} 
                          depth={depth} 
                          isSelected={selectedRequestIds.includes(req.id)} 
                          onToggleSelection={toggleRequestSelection} 
                        />
                      );

                      const renderFolder = (folder: any, depth: number): React.ReactNode => {
                        const isCollapsed = expandedColIds.includes(folder.id);
                        const children = col.folders ? [...col.folders].filter(f => f.parentId === folder.id).sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
                        const requests = [...col.requests].filter(r => r.folderId === folder.id).sort((a, b) => (a.order || 0) - (b.order || 0));
                        
                        return (
                          <div key={folder.id} className="w-full">
                            <div 
                              className="w-full flex items-center h-[24px] pr-2 cursor-pointer text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors group relative select-none"
                              style={{ paddingLeft: `${(depth + 1) * 16}px` }}
                            >
                              <div className="flex flex-1 items-center overflow-hidden h-full" onClick={() => toggleCollectionExpand(folder.id)}>
                                <span className="w-5 h-5 flex items-center justify-center mr-1.5 flex-shrink-0 text-text-muted group-hover:text-text-primary">
                                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                </span>
                                <span className="text-[12.5px] tracking-[-0.01em] truncate flex-1 font-medium">{folder.name}</span>
                              </div>
                              <button
                                className="w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-primary hover:bg-border-subtle rounded flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuColId(activeMenuColId === folder.id ? null : folder.id);
                                }}
                              >
                                <MoreHorizontal size={14} />
                              </button>
                              
                              {activeMenuColId === folder.id && (
                                <div 
                                  ref={menuRef}
                                  className="absolute top-6 right-0 w-36 bg-surface-bg border border-border-strong rounded-md shadow-lg z-50 py-1 text-[11px]"
                                >
                                  <button className="w-full text-left px-3 py-1.5 hover:bg-surface-hover text-blue-400 font-medium" onClick={() => handleSelectNodeMethod(col.id, folder.id, 'GET')}>Select GET</button>
                                  <button className="w-full text-left px-3 py-1.5 hover:bg-surface-hover text-green-400 font-medium" onClick={() => handleSelectNodeMethod(col.id, folder.id, 'POST')}>Select POST</button>
                                  <button className="w-full text-left px-3 py-1.5 hover:bg-surface-hover text-yellow-400 font-medium" onClick={() => handleSelectNodeMethod(col.id, folder.id, 'PUT')}>Select PUT</button>
                                  <button className="w-full text-left px-3 py-1.5 hover:bg-surface-hover text-red-400 font-medium" onClick={() => handleSelectNodeMethod(col.id, folder.id, 'DELETE')}>Select DELETE</button>
                                  <div className="h-px bg-border-subtle my-1"></div>
                                  <button className="w-full text-left px-3 py-1.5 hover:bg-surface-hover" onClick={() => handleSelectNodeAll(col.id, folder.id)}>Select All</button>
                                  <button className="w-full text-left px-3 py-1.5 hover:bg-surface-hover" onClick={() => handleDeselectNodeAll(col.id, folder.id)}>Deselect All</button>
                                </div>
                              )}
                            </div>
                            {!isCollapsed && (
                              <div className="w-full">
                                {children.map(child => renderFolder(child, depth + 1))}
                                {requests.map(r => renderRequest(r, depth + 1))}
                              </div>
                            )}
                          </div>
                        );
                      };

                      return (
                        <>
                          {rootFolders.map(f => renderFolder(f, 0))}
                          {rootRequests.map(r => renderRequest(r, 0))}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
    </Panel>
  );
}
