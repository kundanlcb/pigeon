import { useMemo, useState } from 'react';
import { Panel, Group } from 'react-resizable-panels';
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useStore, type HistoryItem } from '../store';

import { MethodIcon } from './MethodIcon';

const isToday = (date: Date) => {
  const today = new Date();
  return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
};

const isYesterday = (date: Date) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();
};

const isThisWeek = (date: Date) => {
  const today = new Date();
  const diff = today.getTime() - date.getTime();
  return diff < 7 * 24 * 60 * 60 * 1000 && diff >= 0;
};

export function HistoryPanel() {
  const history = useStore(state => state.history);
  const clearHistory = useStore(state => state.clearHistory);
  const removeHistoryItem = useStore(state => state.removeHistoryItem);
  const setActiveRequest = useStore(state => state.setActiveRequest);
  const activeRequestId = useStore(state => state.activeRequestId);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const groupedHistory = useMemo(() => {
    const today: HistoryItem[] = [];
    const yesterday: HistoryItem[] = [];
    const thisWeek: HistoryItem[] = [];
    const older: HistoryItem[] = [];

    history.forEach(item => {
      const date = new Date(item.timestamp);
      if (isToday(date)) today.push(item);
      else if (isYesterday(date)) yesterday.push(item);
      else if (isThisWeek(date)) thisWeek.push(item);
      else older.push(item);
    });

    return [
      { label: 'Today', items: today },
      { label: 'Yesterday', items: yesterday },
      { label: 'This Week', items: thisWeek },
      { label: 'Older', items: older }
    ].filter(group => group.items.length > 0);
  }, [history]);

  return (
    <Panel defaultSize={30} minSize={15} className="bg-panel-bg flex flex-col z-10 select-none rounded-tr-xl border-r border-t border-border-strong overflow-hidden relative shadow-2xl">
      <Group orientation="vertical">
        <Panel defaultSize={100} minSize={20} className="flex flex-col">
          <div className="h-[44px] px-4 flex items-center justify-between border-b border-border-subtle shrink-0 select-none">
            <span className="text-[11px] font-semibold tracking-wider text-text-secondary uppercase">History</span>
            <div className="flex items-center space-x-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); clearHistory(); }}
                title="Clear History"
                className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pt-3 pb-2">
            {groupedHistory.length === 0 ? (
              <div className="px-6 py-4 text-xs text-text-muted text-center italic">
                No request history yet
              </div>
            ) : (
              groupedHistory.map((group, idx) => {
                const isCollapsed = collapsedGroups[group.label];
                return (
                  <div key={idx} className="w-full">
                    <div
                      onClick={() => toggleGroup(group.label)}
                      className="w-full flex items-center h-[24px] px-2 cursor-pointer text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors group relative select-none"
                    >
                      <span className="w-4 h-4 flex items-center justify-center mr-1.5 flex-shrink-0 text-text-secondary group-hover:text-text-primary">
                        {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                      </span>
                      <span className="text-[12.5px] font-semibold tracking-[-0.01em] select-none truncate flex-1 text-text-secondary group-hover:text-text-primary">
                        {group.label}
                      </span>
                    </div>

                    {!isCollapsed && (
                      <div className="w-full space-y-0">
                        {group.items.map(item => {
                          const isActive = activeRequestId === item.id;
                          return (
                            <div
                              key={item.id}
                              onClick={() => setActiveRequest(item.id)}
                              className="w-full flex items-center h-[24px] pl-[30px] pr-2 cursor-pointer transition-colors relative group hover:bg-surface-hover select-none"
                            >
                              <span className="w-4 h-4 flex items-center justify-center mr-1.5 flex-shrink-0">
                                <MethodIcon method={item.request.method} size={13} />
                              </span>
                              <span className={`text-[12.5px] tracking-[-0.01em] truncate flex-1 leading-[24px] ${isActive ? 'text-text-primary font-semibold' : 'text-text-secondary group-hover:text-text-primary'}`}>
                                {item.request.url || 'Unnamed Request'}
                              </span>
                              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity pl-2 space-x-1">
                                <span className="text-[10px] text-text-muted whitespace-nowrap hidden sm:inline-block">
                                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeHistoryItem(item.id);
                                  }}
                                  className="text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors p-0.5 rounded ml-1"
                                  title="Delete history item"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Panel>
      </Group>
    </Panel>
  );
}
