import { useState } from 'react';
import { ChevronRight, ChevronDown, CheckCircle2, Circle, Clock, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { Panel, Group, Separator } from 'react-resizable-panels';

export function PerformanceSidebar() {
  const collections = useStore(state => state.collections);
  const selectedRequestId = useStore(state => state.selectedPerformanceRequestId);
  const setSelectedRequestId = useStore(state => state.setSelectedPerformanceRequestId);
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

  const handleSelectRequest = (reqId: string) => {
    setSelectedRequestId(reqId);
    setActivePerformanceTestId(null); // Reset history view if selecting new test
  };

  return (
    <Panel defaultSize={30} minSize={15} className="bg-panel-bg flex flex-col z-10 select-none rounded-tr-xl border-r border-t border-border-strong overflow-hidden relative shadow-2xl">
      <div className="h-[44px] px-4 flex items-center justify-between border-b border-border-subtle shrink-0 select-none">
        <span className="text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Performance Testing</span>
      </div>
      
      <Group orientation="vertical">
        <Panel defaultSize={65} minSize={20} className="flex flex-col">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {collections.map(col => {
              const isExpanded = expandedColIds.has(col.id);
              
              return (
                <div key={col.id} className="space-y-0.5">
                  <div
                    className="flex items-center space-x-1 px-1 py-1.5 rounded-md text-[13px] hover:bg-surface-hover group cursor-pointer"
                    onClick={() => toggleCollectionExpand(col.id)}
                  >
                    <div className="w-4 h-4 flex items-center justify-center text-text-muted group-hover:text-text-primary transition-colors">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                    <span className="font-medium text-text-primary truncate">{col.name}</span>
                    <span className="text-[10px] text-text-muted ml-auto bg-surface-bg px-1.5 py-0.5 rounded-md">
                      {col.requests.length}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="pl-5 space-y-0.5 mt-1">
                      {col.requests.map(req => {
                        const isSelected = selectedRequestId === req.id;
                        
                        return (
                          <div 
                            key={req.id} 
                            onClick={() => handleSelectRequest(req.id)}
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
                              {isSelected ? <CheckCircle2 size={14} /> : <Circle size={14} className="text-text-muted opacity-50" />}
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
                performanceHistory.map(record => {
                  const isActive = activePerformanceTestId === record.id;
                  
                  return (
                    <div 
                      key={record.id}
                      onClick={() => {
                        setActivePerformanceTestId(record.id);
                        setSelectedRequestId(null);
                      }}
                      className={`flex flex-col p-2 rounded-md cursor-pointer transition-colors border group ${
                        isActive 
                          ? 'bg-accent/5 border-accent text-accent' 
                          : 'bg-surface-bg border-border-subtle hover:border-border-strong text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-medium truncate pr-2">{record.name}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deletePerformanceTest(record.id); }}
                          className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-all ${
                            isActive ? 'opacity-100 text-red-400' : ''
                          }`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between text-[10px] opacity-80">
                        <span className="font-mono">{new Date(record.timestamp).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}</span>
                        <div className="flex items-center space-x-2 font-medium">
                          <span className={record.errorCount > 0 ? 'text-red-400' : 'text-green-500'}>
                            {record.totalRequests} reqs
                          </span>
                        </div>
                      </div>
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
