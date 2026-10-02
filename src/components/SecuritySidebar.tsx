import { useState } from 'react';
import { Shield, ChevronRight, ChevronDown, CheckSquare, Square, MinusSquare } from 'lucide-react';
import { useStore } from '../store';

export function SecuritySidebar() {
  const collections = useStore(state => state.collections);
  const selectedRequestIds = useStore(state => state.selectedSecurityRequestIds);
  const setSelectedRequestIds = useStore(state => state.setSelectedSecurityRequestIds);

  const [expandedColIds, setExpandedColIds] = useState<Set<string>>(new Set());

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

  return (
    <div className="w-64 flex-shrink-0 bg-sidebar-bg border-r border-border-strong flex flex-col h-full z-10 overflow-hidden font-sans select-none">
      <div className="flex items-center justify-between p-3 shrink-0 h-[40px] border-b border-border-strong text-text-primary">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-wider opacity-80 uppercase">DevSecOps Scanner</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {collections.map(col => {
          const isExpanded = expandedColIds.has(col.id);
          const selectionState = getCollectionSelectionState(col.id);
          
          return (
            <div key={col.id} className="space-y-0.5">
              <div
                className="flex items-center space-x-1 px-1 py-1.5 rounded-md text-[13px] hover:bg-surface-hover group"
              >
                <div 
                  onClick={() => toggleCollectionExpand(col.id)}
                  className="w-4 h-4 flex items-center justify-center cursor-pointer text-text-muted hover:text-text-primary"
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                
                <div 
                  onClick={() => toggleCollectionSelection(col.id)}
                  className="w-4 h-4 flex items-center justify-center cursor-pointer text-accent"
                >
                  {selectionState === 'all' ? <CheckSquare size={14} /> : 
                   selectionState === 'partial' ? <MinusSquare size={14} /> : 
                   <Square size={14} className="text-text-muted" />}
                </div>

                <div 
                  onClick={() => toggleCollectionExpand(col.id)}
                  className="flex-1 flex items-center space-x-1.5 overflow-hidden cursor-pointer"
                >
                  <Shield size={13} className="text-text-secondary" />
                  <span className="truncate text-text-primary font-medium">{col.name}</span>
                </div>
              </div>

              {isExpanded && (
                <div className="pl-6 space-y-0.5">
                  {col.requests.map(req => {
                    const isSelected = selectedRequestIds.includes(req.id);
                    return (
                      <div 
                        key={req.id}
                        onClick={() => toggleRequestSelection(req.id)}
                        className="flex items-center space-x-2 px-1 py-1 rounded-md text-[12px] hover:bg-surface-hover cursor-pointer group"
                      >
                        <div className="w-4 h-4 flex items-center justify-center text-accent">
                          {isSelected ? <CheckSquare size={13} /> : <Square size={13} className="text-text-muted opacity-50 group-hover:opacity-100 transition-opacity" />}
                        </div>
                        <span className={`text-[9px] font-bold w-10 ${
                          req.method === 'GET' ? 'text-blue-400' :
                          req.method === 'POST' ? 'text-green-400' :
                          req.method === 'PUT' ? 'text-yellow-400' :
                          req.method === 'DELETE' ? 'text-red-400' : 'text-purple-400'
                        }`}>{req.method}</span>
                        <span className={`truncate flex-1 ${isSelected ? 'text-text-primary' : 'text-text-muted'}`}>
                          {req.name}
                        </span>
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
            No collections found.
          </div>
        )}
      </div>
    </div>
  );
}
