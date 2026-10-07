import { useState, useRef, useEffect } from 'react';
import { Play, ChevronRight, ChevronDown, CheckSquare, Square, MinusSquare, MoreHorizontal } from 'lucide-react';
import { useStore } from '../store';
import { Panel } from 'react-resizable-panels';
export function RunnerSidebar() {
  const collections = useStore(state => state.collections);
  const selectedRequestIds = useStore(state => state.selectedRunnerRequestIds);
  const setSelectedRequestIds = useStore(state => state.setSelectedRunnerRequestIds);

  const [expandedColIds, setExpandedColIds] = useState<Set<string>>(new Set());
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

  const toggleCollectionExpand = (colId: string) => {
    const next = new Set(expandedColIds);
    if (next.has(colId)) next.delete(colId);
    else next.add(colId);
    setExpandedColIds(next);
  };

  const getCollectionSelectionState = (colId: string) => {
    const col = collections.find(c => c.id === colId);
    if (!col || col.requests.length === 0) return 'none';
    const selectedCount = col.requests.filter(r => selectedRequestIds.includes(r.id)).length;
    if (selectedCount === 0) return 'none';
    if (selectedCount === col.requests.length) return 'all';
    return 'partial';
  };

  const toggleCollectionSelection = (colId: string) => {
    const col = collections.find(c => c.id === colId);
    if (!col) return;
    const reqIds = col.requests.map(r => r.id);
    const state = getCollectionSelectionState(colId);
    
    let next = [...selectedRequestIds];
    if (state === 'all') {
      next = next.filter(id => !reqIds.includes(id));
    } else {
      const missing = reqIds.filter(id => !next.includes(id));
      next = [...next, ...missing];
    }
    setSelectedRequestIds(next);
  };

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
      <div className="flex-1 flex flex-col overflow-hidden text-text-primary text-[11px]">
        <div className="p-3 border-b border-border-subtle shrink-0">
          <div className="flex items-center space-x-2 font-bold mb-3 text-text-primary">
            <Play size={14} className="text-accent" />
            <span>Runner Select</span>
          </div>
          
          <div className="flex items-center justify-between text-text-muted">
            <button 
              className="flex items-center space-x-1.5 hover:text-text-primary transition-colors"
              onClick={handleBulkToggle}
            >
              {isAllSelected ? (
                <CheckSquare size={14} className="text-accent" />
              ) : selectedRequestIds.length > 0 ? (
                <MinusSquare size={14} className="text-accent opacity-70" />
              ) : (
                <Square size={14} />
              )}
              <span>{isAllSelected ? 'Deselect All' : 'Select All'}</span>
            </button>
            <span className="font-mono bg-surface-bg px-1.5 py-0.5 rounded text-[10px]">
              {selectedRequestIds.length}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {collections.map(col => {
            const isExpanded = expandedColIds.has(col.id);
            const selState = getCollectionSelectionState(col.id);
            
            return (
              <div key={col.id} className="space-y-0.5 relative">
                <div className="flex items-center p-1 rounded hover:bg-surface-hover group relative">
                  <button 
                    onClick={() => toggleCollectionExpand(col.id)}
                    className="p-1 mr-0.5 hover:bg-white/10 rounded text-text-muted shrink-0"
                  >
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                  <button 
                    onClick={() => toggleCollectionSelection(col.id)}
                    className="mr-2 shrink-0 text-text-muted hover:text-text-primary transition-colors"
                  >
                    {selState === 'all' ? (
                      <CheckSquare size={13} className="text-accent" />
                    ) : selState === 'partial' ? (
                      <MinusSquare size={13} className="text-accent opacity-70" />
                    ) : (
                      <Square size={13} />
                    )}
                  </button>
                  <div 
                    className="flex-1 truncate font-semibold cursor-pointer"
                    onClick={() => toggleCollectionExpand(col.id)}
                  >
                    {col.name}
                  </div>
                  
                  <button
                    className="p-1 hover:bg-white/10 rounded text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuColId(activeMenuColId === col.id ? null : col.id);
                    }}
                  >
                    <MoreHorizontal size={12} />
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
                  <div className="pl-2 space-y-0.5 mt-1">
                    {(() => {
                      const rootFolders = col.folders ? [...col.folders].filter(f => !f.parentId).sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
                      const rootRequests = [...col.requests].filter(r => !r.folderId).sort((a, b) => (a.order || 0) - (b.order || 0));

                      const renderRequest = (req: any, depth: number) => {
                        const isSelected = selectedRequestIds.includes(req.id);
                        return (
                          <div 
                            key={req.id} 
                            className="flex items-center p-1 rounded hover:bg-surface-hover cursor-pointer group"
                            style={{ paddingLeft: `${depth * 14}px` }}
                            onClick={() => toggleRequestSelection(req.id)}
                          >
                            <div className="mr-2 text-text-muted group-hover:text-text-primary transition-colors">
                              {isSelected ? (
                                <CheckSquare size={12} className="text-accent" />
                              ) : (
                                <Square size={12} />
                              )}
                            </div>
                            <span className={`text-[9px] font-bold w-10 shrink-0 ${
                              req.method === 'GET' ? 'text-blue-400' :
                              req.method === 'POST' ? 'text-green-400' :
                              req.method === 'PUT' ? 'text-yellow-400' :
                              req.method === 'DELETE' ? 'text-red-400' : 'text-purple-400'
                            }`}>
                              {req.method}
                            </span>
                            <span className={`truncate ${isSelected ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
                              {req.name}
                            </span>
                          </div>
                        );
                      };

                      const renderFolder = (folder: any, depth: number): React.ReactNode => {
                        const isCollapsed = expandedColIds.has(folder.id);
                        const children = col.folders ? [...col.folders].filter(f => f.parentId === folder.id).sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
                        const requests = [...col.requests].filter(r => r.folderId === folder.id).sort((a, b) => (a.order || 0) - (b.order || 0));
                        
                        return (
                          <div key={folder.id} className="w-full">
                            <div 
                              className="flex items-center space-x-1 p-1 rounded hover:bg-surface-hover cursor-pointer group text-text-secondary hover:text-text-primary relative"
                              style={{ paddingLeft: `${depth * 14}px` }}
                            >
                              <div className="flex flex-1 items-center overflow-hidden" onClick={() => toggleCollectionExpand(folder.id)}>
                                <span className="w-4 h-4 flex items-center justify-center text-text-muted group-hover:text-text-primary">
                                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                </span>
                                <span className="truncate text-[11px] font-medium">{folder.name}</span>
                              </div>
                              <button
                                className="p-1 hover:bg-white/10 rounded text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuColId(activeMenuColId === folder.id ? null : folder.id);
                                }}
                              >
                                <MoreHorizontal size={12} />
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
                              <div className="w-full space-y-0.5 mt-0.5">
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
      </div>
    </Panel>
  );
}
