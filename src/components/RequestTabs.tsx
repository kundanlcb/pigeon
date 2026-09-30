import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, MoreHorizontal } from 'lucide-react';
import { useStore } from '../store';

import { MethodIcon } from './MethodIcon';

interface ContextMenuState {
  x: number;
  y: number;
  tabId: string;
}

export function RequestTabs() {
  const openRequestIds = useStore(state => state.openRequestIds);
  const activeRequestId = useStore(state => state.activeRequestId);
  const setActiveRequest = useStore(state => state.setActiveRequest);
  const closeRequest = useStore(state => state.closeRequest);
  const closeOtherRequests = useStore(state => state.closeOtherRequests);
  const closeAllRequests = useStore(state => state.closeAllRequests);
  const closeRequestsToTheRight = useStore(state => state.closeRequestsToTheRight);
  const addRequest = useStore(state => state.addRequest);
  const showToast = useStore(state => state.showToast);

  const collections = useStore(state => state.collections);
  const environments = useStore(state => state.environments);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [contextMenu]);

  const handleOpenContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      tabId
    });
  };

  const createRequest = () => {
    const activeCollection = collections.find(collection =>
      collection.requests.some(request => request.id === activeRequestId)
    ) || collections[0];
    if (!activeCollection) {
      showToast('Create a collection before adding a request.', 'info');
      return;
    }
    addRequest(activeCollection.id, { name: 'New Request', method: 'GET', url: '', headers: {} });
  };

  const getTabItem = (id: string) => {
    if (id.startsWith('env-')) {
      return environments.find(e => e.id === id);
    }
    for (const col of collections) {
      const req = col.requests.find(r => r.id === id);
      if (req) return req;
    }
    const history = useStore.getState().history;
    if (history) {
      const histReq = history.find(h => h.id === id);
      if (histReq) return histReq.request;
    }
    return undefined;
  };

  const menuIndex = contextMenu ? openRequestIds.indexOf(contextMenu.tabId) : -1;
  const isLastTab = menuIndex === openRequestIds.length - 1;
  const hasMultipleTabs = openRequestIds.length > 1;

  return (
    <div
      id="request-tabs-container"
      className="flex h-full overflow-x-auto no-scrollbar gap-0 items-end px-0 scroll-smooth"
      onContextMenu={(e) => {
        if (e.target === e.currentTarget && openRequestIds.length > 0) {
          e.preventDefault();
          handleOpenContextMenu(e, activeRequestId || openRequestIds[0]);
        }
      }}
    >
      {openRequestIds.map((id) => {
        const item = getTabItem(id);
        if (!item) return null;
        
        const isEnv = id.startsWith('env-');
        const isActive = id === activeRequestId;

        return (
          <div 
            key={id}
            onClick={() => setActiveRequest(id)}
            onContextMenu={(e) => handleOpenContextMenu(e, id)}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                e.stopPropagation();
                closeRequest(id);
              }
            }}
            className={`flex items-center min-w-[140px] max-w-[240px] px-3 h-full cursor-pointer relative group select-none ${isActive ? 'bg-app-bg text-text-primary z-10 rounded-t-lg' : 'bg-transparent text-text-secondary hover:bg-[#1e1e20]'}`}
          >
            {isEnv ? (
              <span className="text-[10px] font-bold mr-2 text-accent">ENV</span>
            ) : (
              <MethodIcon method={(item as any).method} size={12} className="mr-2 shrink-0" />
            )}
            <span className="text-[13px] font-medium truncate flex-1">{item.name}</span>
            <div 
              onClick={(e) => { e.stopPropagation(); closeRequest(id); }}
              title="Close (Middle click)"
              className={`ml-1 flex items-center justify-center w-5 h-5 rounded-full transition-colors ${isActive ? 'opacity-100 hover:bg-surface-hover' : 'opacity-0 group-hover:opacity-100 hover:bg-border-strong'}`}
            >
              <X size={13} />
            </div>
            
          </div>
        );
      })}

      <div className="flex items-center mb-1 shrink-0 gap-0.5">
        <button
          type="button"
          onClick={createRequest}
          title="New Request"
          aria-label="New Request"
          className="flex shrink-0 items-center justify-center w-8 h-8 ml-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          <Plus size={16} />
        </button>

        {openRequestIds.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              const targetId = activeRequestId || openRequestIds[0];
              const rect = e.currentTarget.getBoundingClientRect();
              setContextMenu({
                x: rect.left,
                y: rect.bottom + 4,
                tabId: targetId
              });
            }}
            title="Tab Actions (Close, Close Others, Close All)"
            aria-label="Tab Actions"
            className="flex shrink-0 items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <MoreHorizontal size={16} />
          </button>
        )}
      </div>

      {contextMenu && createPortal(
        <div
          className="fixed inset-0 z-[99999]"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        >
          <div
            style={{
              position: 'fixed',
              left: `${Math.min(Math.max(8, contextMenu.x), window.innerWidth - 180)}px`,
              top: `${Math.min(Math.max(8, contextMenu.y), window.innerHeight - 170)}px`
            }}
            className="w-48 bg-surface-bg/95 backdrop-blur-md border border-border-strong rounded-lg shadow-2xl py-1 text-xs text-text-primary z-[100000] select-none animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                closeRequest(contextMenu.tabId);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-white flex items-center justify-between transition-colors"
            >
              <span>Close</span>
              <span className="text-[10px] opacity-60">⌘W</span>
            </button>

            <button
              type="button"
              disabled={!hasMultipleTabs}
              onClick={() => {
                closeOtherRequests(contextMenu.tabId);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit flex items-center justify-between transition-colors"
            >
              <span>Close Others</span>
            </button>

            <button
              type="button"
              disabled={isLastTab}
              onClick={() => {
                closeRequestsToTheRight(contextMenu.tabId);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit flex items-center justify-between transition-colors"
            >
              <span>Close to the Right</span>
            </button>

            <div className="h-px bg-border-subtle my-1" />

            <button
              type="button"
              disabled={openRequestIds.length === 0}
              onClick={() => {
                closeAllRequests();
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit flex items-center justify-between transition-colors"
            >
              <span>Close All</span>
              <span className="text-[10px] opacity-60">⌥⌘W</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
