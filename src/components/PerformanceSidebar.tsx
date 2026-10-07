import { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, CheckSquare, Square, MinusSquare, Clock, Trash2, MoreHorizontal } from 'lucide-react';
import { useStore } from '../store';
import { Panel, Group, Separator } from 'react-resizable-panels';

export function PerformanceSidebar() {
  const collections = useStore(state => state.collections);
  const selectedRequestIds = useStore(state => state.selectedPerformanceRequestIds);
  const setSelectedRequestIds = useStore(state => state.setSelectedPerformanceRequestIds);
  const performanceHistory = useStore(state => state.performanceHistory);
  const activePerformanceTestId = useStore(state => state.activePerformanceTestId);
  const setActivePerformanceTestId = useStore(state => state.setActivePerformanceTestId);
  const deletePerformanceTest = useStore(state => state.deletePerformanceTest);

  const [expandedColIds, setExpandedColIds] = useState<Set<string>>(new Set());
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);

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
      // Deselect all
      next = next.filter(id => !reqIds.includes(id));
    } else {
      // Select all (add missing)
      const missing = reqIds.filter(id => !next.includes(id));
      next = [...next, ...missing];
    }
    setSelectedRequestIds(next);
    setActivePerformanceTestId(null);
  };

  const toggleRequestSelection = (reqId: string) => {
    let next = [...selectedRequestIds];
    if (next.includes(reqId)) {
      next = next.filter(id => id !== reqId);
    } else {
      next.push(reqId);
    }
    setSelectedRequestIds(next);
    setActivePerformanceTestId(null);
  };

  const [activeMenuColId, setActiveMenuColId] = useState<string | null>(null);
  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(event.target as Node)) {
        setActiveMenuColId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    setActivePerformanceTestId(null);
    setActiveMenuColId(null);
  };

  const handleSelectNodeAll = (colId: string, folderId: string | null) => {
    const reqs = getRequestsForNode(colId, folderId);
    const reqIds = reqs.map(r => r.id);
    const newSelected = new Set([...selectedRequestIds]);
    reqIds.forEach(id => newSelected.add(id));
    setSelectedRequestIds(Array.from(newSelected));
    setActivePerformanceTestId(null);
    setActiveMenuColId(null);
  };
  
  const handleDeselectNodeAll = (colId: string, folderId: string | null) => {
    const reqs = getRequestsForNode(colId, folderId);
    const reqIds = reqs.map(r => r.id);
    const newSelected = new Set([...selectedRequestIds]);
    reqIds.forEach(id => newSelected.delete(id));
    setSelectedRequestIds(Array.from(newSelected));
    setActivePerformanceTestId(null);
    setActiveMenuColId(null);
  };

  const allRequestIds = collections.flatMap(c => c.requests.map(r => r.id));
  const isAllSelected = collections.length > 0 && selectedRequestIds.length === allRequestIds.length;

  const handleBulkToggle = () => {
    if (isAllSelected) {
      setSelectedRequestIds([]);
    } else {
      setSelectedRequestIds(allRequestIds);
    }
    setActivePerformanceTestId(null);
  };

  return (
    <Panel defaultSize={30} minSize={15} className="bg-panel-bg flex flex-col z-10 select-none overflow-hidden relative">
      <div className="h-[44px] px-4 flex items-center justify-between shrink-0 select-none">
        <span className="text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Performance Testing</span>
        {collections.length > 0 && (
          <button
            onClick={handleBulkToggle}
            className="text-[10px] font-medium text-text-muted hover:text-text-primary transition-colors"
          >
            {isAllSelected ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>
      
      <Group autoSave="pigeon-performance-sidebar" orientation="vertical">
        <Panel defaultSize={65} minSize={20} className="flex flex-col">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {collections.map(col => {
              const isExpanded = expandedColIds.has(col.id);
              
              return (
                <div key={col.id} className="space-y-0.5">
                  <div
                    className="flex items-center space-x-1 px-1 py-1.5 rounded-md text-[13px] hover:bg-surface-hover group"
                  >
                    <div 
                      className="w-4 h-4 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                      onClick={() => toggleCollectionExpand(col.id)}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                    <div 
                      className="flex-1 flex items-center justify-between cursor-pointer"
                      onClick={() => toggleCollectionSelection(col.id)}
                    >
                      <span className="font-medium text-text-primary truncate">{col.name}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] text-text-muted bg-surface-bg px-1.5 py-0.5 rounded-md">
                          {col.requests.length}
                        </span>
                        <div className="text-accent" onClick={(e) => { e.stopPropagation(); toggleCollectionSelection(col.id); }}>
                          {getCollectionSelectionState(col.id) === 'all' ? (
                            <CheckSquare size={14} />
                          ) : getCollectionSelectionState(col.id) === 'partial' ? (
                            <MinusSquare size={14} />
                          ) : (
                            <Square size={14} className="text-text-muted" />
                          )}
                        </div>
                      </div>
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
                        ref={colMenuRef}
                        className="absolute top-full right-0 mt-1 w-36 bg-panel-bg border border-border-strong rounded-lg shadow-xl overflow-hidden z-50 py-1 flex flex-col"
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSelectNodeAll(col.id, null); }}
                          className="px-3 py-1.5 text-[11px] text-left hover:bg-surface-hover text-text-primary"
                        >
                          Select All
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeselectNodeAll(col.id, null); }}
                          className="px-3 py-1.5 text-[11px] text-left hover:bg-surface-hover text-text-primary"
                        >
                          Deselect All
                        </button>
                        <div className="h-px bg-border-strong my-1" />
                        {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(method => (
                          <button
                            key={method}
                            onClick={(e) => { e.stopPropagation(); handleSelectNodeMethod(col.id, null, method); }}
                            className="px-3 py-1.5 text-[11px] text-left hover:bg-surface-hover text-text-secondary hover:text-text-primary flex items-center justify-between"
                          >
                            <span>Select {method}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="pl-1 space-y-0.5 mt-1">
                      {(() => {
                        const rootFolders = col.folders ? [...col.folders].filter(f => !f.parentId).sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
                        const rootRequests = [...col.requests].filter(r => !r.folderId).sort((a, b) => (a.order || 0) - (b.order || 0));

                        const renderRequest = (req: any, depth: number) => {
                          const isSelected = selectedRequestIds.includes(req.id);
                          return (
                            <div 
                              key={req.id} 
                              onClick={() => toggleRequestSelection(req.id)}
                              style={{ paddingLeft: `${depth * 14}px` }}
                              className={`flex items-center justify-between px-2 py-1.5 rounded-md text-[12px] cursor-pointer transition-colors ${
                                isSelected 
                                  ? 'bg-accent/10 text-accent font-medium' 
                                  : 'hover:bg-surface-hover text-text-secondary hover:text-text-primary'
                              }`}
                            >
                              <div className="flex items-center space-x-2 truncate">
                                <span className={`font-bold text-[9px] w-10 shrink-0 ${
                                  req.method === 'GET' ? 'text-blue-400' :
                                  req.method === 'POST' ? 'text-green-400' :
                                  req.method === 'PUT' ? 'text-yellow-400' :
                                  req.method === 'DELETE' ? 'text-red-400' : 'text-purple-400'
                                }`}>{req.method}</span>
                                <span className="truncate">{req.name}</span>
                              </div>
                              <div className="ml-2 flex items-center justify-center text-accent shrink-0">
                                {isSelected ? <CheckSquare size={14} /> : <Square size={14} className="text-text-muted opacity-50" />}
                              </div>
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
                                className="flex items-center space-x-1 px-2 py-1.5 rounded-md text-[12px] hover:bg-surface-hover cursor-pointer group text-text-secondary hover:text-text-primary relative"
                                style={{ paddingLeft: `${depth * 14}px` }}
                              >
                                <div className="flex flex-1 items-center overflow-hidden" onClick={() => toggleCollectionExpand(folder.id)}>
                                  <span className="w-4 h-4 flex items-center justify-center text-text-muted group-hover:text-text-primary">
                                    {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                                  </span>
                                  <span className="truncate flex-1 font-medium">{folder.name}</span>
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
                                    ref={colMenuRef}
                                    className="absolute top-full right-0 mt-1 w-36 bg-panel-bg border border-border-strong rounded-lg shadow-xl overflow-hidden z-50 py-1 flex flex-col"
                                  >
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleSelectNodeAll(col.id, folder.id); }}
                                      className="px-3 py-1.5 text-[11px] text-left hover:bg-surface-hover text-text-primary"
                                    >
                                      Select All
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDeselectNodeAll(col.id, folder.id); }}
                                      className="px-3 py-1.5 text-[11px] text-left hover:bg-surface-hover text-text-primary"
                                    >
                                      Deselect All
                                    </button>
                                    <div className="h-px bg-border-strong my-1" />
                                    {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(method => (
                                      <button
                                        key={method}
                                        onClick={(e) => { e.stopPropagation(); handleSelectNodeMethod(col.id, folder.id, method); }}
                                        className="px-3 py-1.5 text-[11px] text-left hover:bg-surface-hover text-text-secondary hover:text-text-primary flex items-center justify-between"
                                      >
                                        <span>Select {method}</span>
                                      </button>
                                    ))}
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
            
            {collections.length === 0 && (
              <div className="text-[12px] text-text-muted text-center py-8">
                No collections available.
              </div>
            )}
          </div>
        </Panel>

        <Separator className="h-[1px] bg-border-strong hover:bg-accent hover:h-[3px] -my-[1px] z-10 transition-colors cursor-row-resize shrink-0" />

        <Panel defaultSize={35} minSize={15} className="flex flex-col overflow-hidden bg-panel-bg">
          <div 
            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
            className="flex items-center space-x-2 px-4 py-2 border-b border-border-subtle cursor-pointer hover:bg-surface-hover transition-colors shrink-0"
          >
            <div className="text-text-muted">
              {isHistoryExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
            <Clock size={14} className="text-accent" />
            <span className="text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Past Load Tests</span>
          </div>

          {isHistoryExpanded && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {performanceHistory.length === 0 ? (
                <div className="text-[11px] text-text-muted text-center py-4 px-2 leading-relaxed">
                  No past tests. Run a load test to see history.
                </div>
              ) : (
                [...performanceHistory].sort((a, b) => b.timestamp - a.timestamp).map(record => {
                  const isActive = activePerformanceTestId === record.id;
                  
                  return (
                    <div 
                      key={record.id}
                      onClick={() => {
                        setActivePerformanceTestId(record.id);
                        setSelectedRequestIds([]);
                      }}
                      className={`group flex items-center justify-between px-2 py-2 rounded-md cursor-pointer transition-colors ${
                        isActive ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover/50'
                      }`}
                    >
                      <div className="flex items-center space-x-2 overflow-hidden">
                        <Clock size={12} className="shrink-0 text-text-muted" />
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-[12px] font-medium truncate">
                            {new Date(record.timestamp).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-text-muted truncate">
                            {record.name} • {record.totalRequests} reqs
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deletePerformanceTest(record.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-text-muted transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </Panel>
      </Group>
    </Panel>
  );
}
