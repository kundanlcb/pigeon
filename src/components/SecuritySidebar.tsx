import { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Clock, Trash2, MoreHorizontal } from 'lucide-react';
import { SidebarRequest } from './SidebarNodes';
import { useStore } from '../store';
import { Panel, Group, Separator } from 'react-resizable-panels';

export function SecuritySidebar() {
  const collections = useStore(state => state.collections);
  const selectedRequestIds = useStore(state => state.selectedSecurityRequestIds);
  const setSelectedRequestIds = useStore(state => state.setSelectedSecurityRequestIds);
  const securityHistory = useStore(state => state.securityHistory);
  const activeSecurityScanId = useStore(state => state.activeSecurityScanId);
  const setActiveSecurityScanId = useStore(state => state.setActiveSecurityScanId);
  const deleteSecurityScan = useStore(state => state.deleteSecurityScan);

  const expandedColIds = useStore(state => state.securityExpandedColIds);
  const toggleCollectionExpand = useStore(state => state.toggleSecurityCollectionCollapse);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);





  const toggleRequestSelection = (reqId: string) => {
    let next = [...selectedRequestIds];
    if (next.includes(reqId)) {
      next = next.filter(id => id !== reqId);
    } else {
      next.push(reqId);
    }
    setSelectedRequestIds(next);
    setActiveSecurityScanId(null);
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
    setActiveSecurityScanId(null);
    setActiveMenuColId(null);
  };

  const handleSelectNodeAll = (colId: string, folderId: string | null) => {
    const reqs = getRequestsForNode(colId, folderId);
    const reqIds = reqs.map(r => r.id);
    const newSelected = new Set([...selectedRequestIds]);
    reqIds.forEach(id => newSelected.add(id));
    setSelectedRequestIds(Array.from(newSelected));
    setActiveSecurityScanId(null);
    setActiveMenuColId(null);
  };
  
  const handleDeselectNodeAll = (colId: string, folderId: string | null) => {
    const reqs = getRequestsForNode(colId, folderId);
    const reqIds = reqs.map(r => r.id);
    const newSelected = new Set([...selectedRequestIds]);
    reqIds.forEach(id => newSelected.delete(id));
    setSelectedRequestIds(Array.from(newSelected));
    setActiveSecurityScanId(null);
    setActiveMenuColId(null);
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

  return (
    <Panel id="security-sidebar" defaultSize={30} minSize={15} className="bg-panel-bg flex flex-col z-10 select-none overflow-hidden relative">
      <div className="h-[44px] px-4 flex items-center justify-between shrink-0 select-none">
        <span className="text-[11px] font-semibold tracking-wider text-text-secondary uppercase">DevSecOps Scanner</span>
        {collections.length > 0 && (
          <button
            onClick={handleBulkToggle}
            className="text-[10px] font-medium text-text-muted hover:text-text-primary transition-colors"
          >
            {isAllSelected ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>
      
      <Group autoSave="pigeon-security-sidebar" orientation="vertical">
        <Panel defaultSize={65} minSize={20} className="flex flex-col">
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
                  className="flex-1 flex items-center overflow-hidden cursor-pointer h-full"
                >
                  <span className="w-5 h-5 flex items-center justify-center mr-1.5 flex-shrink-0 text-text-muted group-hover:text-text-primary">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <span className="text-[12.5px] font-semibold tracking-[-0.01em] truncate text-text-secondary group-hover:text-text-primary">{col.name}</span>
                </div>
                
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuColId(activeMenuColId === col.id ? null : col.id);
                    }}
                    className="w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-primary hover:bg-border-subtle rounded"
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
              </div>

              {isExpanded && (
                <div className="w-full">
                  {(() => {
                    const rootFolders = col.folders ? [...col.folders].filter(f => !f.parentId).sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
                    const rootRequests = [...col.requests].filter(r => !r.folderId || !(col.folders || []).some(f => f.id === r.folderId)).sort((a, b) => (a.order || 0) - (b.order || 0));

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
        
        {collections.length === 0 && (
            <div className="text-[12px] text-text-muted text-center py-8">
              No collections found.
            </div>
          )}
          </div>
        </Panel>

        <Separator className="h-[1px] bg-border-strong hover:bg-accent hover:h-[3px] -my-[1px] z-10 transition-colors cursor-row-resize shrink-0" />

        <Panel defaultSize={35} minSize={15} className="flex flex-col overflow-hidden bg-panel-bg">
          <div 
          className="flex items-center space-x-2 px-4 py-2 hover:bg-surface-hover/50 cursor-pointer text-[10px] font-bold text-text-muted uppercase tracking-wider shrink-0"
          onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
        >
          {isHistoryExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>Past Audits</span>
          <span className="ml-auto bg-surface-bg px-1.5 py-0.5 rounded text-[9px]">{securityHistory.length}</span>
        </div>

        {isHistoryExpanded && (
          <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4">
            {securityHistory.length === 0 ? (
              <div className="text-[11px] text-text-muted text-center py-4 px-2">
                No past audits. Run a scan to see history here.
              </div>
            ) : (
              securityHistory.map(scan => (
                <div 
                  key={scan.id}
                  onClick={() => setActiveSecurityScanId(scan.id)}
                  className={`group flex items-center justify-between px-2 py-2 rounded-md cursor-pointer transition-colors ${
                    activeSecurityScanId === scan.id ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover/50'
                  }`}
                >
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <Clock size={12} className="shrink-0 text-text-muted" />
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-[12px] font-medium truncate">
                        {new Date(scan.timestamp).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-text-muted truncate">
                        {scan.requestIds.length} endpoints • {scan.findings.reduce((sum, f) => sum + f.findings.filter(v => v.risk !== 'PASS').length, 0)} issues
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSecurityScan(scan.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-text-muted transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                ))
              )}
            </div>
          )}
        </Panel>
      </Group>
    </Panel>
  );
}
