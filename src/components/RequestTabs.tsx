
import { Plus } from 'lucide-react';
import { useStore } from '../store';
import { getMethodColor } from '../utils/styles';

export function RequestTabs() {
  const openRequestIds = useStore(state => state.openRequestIds);
  const activeRequestId = useStore(state => state.activeRequestId);
  const setActiveRequest = useStore(state => state.setActiveRequest);
  const closeRequest = useStore(state => state.closeRequest);

  const collections = useStore(state => state.collections);
  const environments = useStore(state => state.environments);

  const getTabItem = (id: string) => {
    if (id.startsWith('env-')) {
      return environments.find(e => e.id === id);
    }
    for (const col of collections) {
      const req = col.requests.find(r => r.id === id);
      if (req) return req;
    }
    return undefined;
  };

  return (
    <div id="request-tabs-container" className="flex h-full overflow-x-auto no-scrollbar gap-0.5 items-end px-2 scroll-smooth">
      {openRequestIds.map((id, index) => {
        const item = getTabItem(id);
        if (!item) return null;
        
        const isEnv = id.startsWith('env-');
        const isActive = id === activeRequestId;
        const isNextActive = openRequestIds[index + 1] === activeRequestId;
        return (
          <div 
            key={id}
            onClick={() => setActiveRequest(id)}
            className={`flex items-center min-w-[140px] max-w-[240px] px-3 h-[40px] cursor-pointer relative group transition-colors duration-150 rounded-t-lg select-none ${isActive ? 'bg-app-bg text-text-primary z-10 before:content-[""] before:absolute before:bottom-0 before:left-[-8px] before:w-2 before:h-2 before:bg-transparent before:rounded-br-lg before:shadow-[4px_4px_0_4px_var(--color-app-bg)] after:content-[""] after:absolute after:bottom-0 after:right-[-8px] after:w-2 after:h-2 after:bg-transparent after:rounded-bl-lg after:shadow-[-4px_4px_0_4px_var(--color-app-bg)]' : 'bg-transparent hover:bg-surface-hover/60 text-text-secondary'}`}
          >
            {isEnv ? (
              <span className="text-[10px] font-bold mr-2 text-accent">ENV</span>
            ) : (
              <span className={`text-[10px] font-bold mr-2 ${getMethodColor((item as any).method)}`}>{(item as any).method}</span>
            )}
            <span className="text-[13px] font-medium truncate flex-1">{item.name}</span>
            <div 
              onClick={(e) => { e.stopPropagation(); closeRequest(id); }}
              className={`ml-1 flex items-center justify-center w-5 h-5 rounded-full transition-colors ${isActive ? 'opacity-100 hover:bg-surface-hover' : 'opacity-0 group-hover:opacity-100 hover:bg-border-strong'}`}
            >
              <Plus size={14} className="rotate-45" />
            </div>
            
            {/* Inactive tab separator */}
            {!isActive && !isNextActive && (
              <div className="absolute right-[-1px] top-1/2 -translate-y-1/2 w-px h-4 bg-border-strong group-hover:bg-transparent transition-colors z-20"></div>
            )}
          </div>
        );
      })}
    </div>
  );
}
