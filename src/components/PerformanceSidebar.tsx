import { useState } from 'react';
import { ChevronRight, ChevronDown, CheckSquare, Square, MinusSquare, Clock, Trash2 } from 'lucide-react';
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
    <Panel defaultSize={30} minSize={15} className="bg-panel-bg flex flex-col z-10 select-none rounded-tr-xl border-r border-t border-border-strong overflow-hidden relative shadow-2xl">
      <div className="h-[44px] px-4 flex items-center justify-between border-b border-border-subtle shrink-0 select-none">
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
      
      <Group orientation="vertical">
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
                        <div className="text-accent">
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
                  </div>

                  {isExpanded && (
                    <div className="pl-5 space-y-0.5 mt-1">
                      {col.requests.map(req => {
                        const isSelected = selectedRequestIds.includes(req.id);
                        
                        return (
                          <div 
                            key={req.id} 
                            onClick={() => toggleRequestSelection(req.id)}
                            className={`flex items-center justify-between px-2 py-1.5 rounded-md text-[12px] cursor-pointer transition-colors ${
                              isSelected 
                                ? 'bg-accent/10 text-accent font-medium' 
                                : 'hover:bg-surface-hover text-text-secondary hover:text-text-primary'
                            }`}
                          >
                            <div className="flex items-center space-x-2 truncate">
                              <span className={`font-bold text-[9px] w-10 ${
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
                      })}
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
