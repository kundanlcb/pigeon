import { useState, useEffect } from 'react';
import { Panel } from 'react-resizable-panels';
import { useStore } from '../store';
import { getGitStatus, gitBranch, isGitRepo, gitInit } from '../utils/git';
import { GitBranch, RefreshCw, FolderGit2, Loader2 } from 'lucide-react';

export function SourceControlPanel() {
  const collections = useStore(state => state.collections).filter(c => c.storageMode === 'folder' && c.folderPath);
  const [gitData, setGitData] = useState<Record<string, { isRepo: boolean, branch: string, status: { status: string, file: string }[], loading: boolean }>>({});
  const [activeColId, setActiveColId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!activeColId && collections.length > 0) {
      setActiveColId(collections[0].id);
    }
  }, [collections, activeColId]);

  const fetchGitStatus = async (colId: string, folderPath: string) => {
    setGitData(prev => ({ ...prev, [colId]: { ...prev[colId], loading: true } }));
    try {
      const isRepo = await isGitRepo(folderPath);
      if (!isRepo) {
        setGitData(prev => ({ ...prev, [colId]: { isRepo: false, branch: '', status: [], loading: false } }));
        return;
      }
      const branch = await gitBranch(folderPath);
      const status = await getGitStatus(folderPath);
      setGitData(prev => ({ ...prev, [colId]: { isRepo: true, branch, status, loading: false } }));
    } catch (e) {
      setGitData(prev => ({ ...prev, [colId]: { isRepo: false, branch: 'unknown', status: [], loading: false } }));
    }
  };

  useEffect(() => {
    for (const col of collections) {
      if (col.folderPath) {
        fetchGitStatus(col.id, col.folderPath);
      }
    }
  }, [collections.map(c => c.id).join(',')]);

  const handleInitRepo = async () => {
    if (!activeColId) return;
    const col = collections.find(c => c.id === activeColId);
    if (!col?.folderPath) return;

    setActionLoading(true);
    try {
      await gitInit(col.folderPath);
      await fetchGitStatus(col.id, col.folderPath);
      useStore.getState().showToast('Initialized empty Git repository', 'success');
    } catch (e: any) {
      useStore.getState().showToast('Initialization failed: ' + String(e), 'error');
    }
    setActionLoading(false);
  };


  const activeCol = collections.find(c => c.id === activeColId);
  const data = activeColId ? gitData[activeColId] : null;

  return (
    <Panel defaultSize={30} minSize={15} className="bg-[#161618] flex flex-col z-10 select-none rounded-tr-xl border-r border-t border-border-strong overflow-hidden relative shadow-2xl">
      <div className="h-[44px] px-4 flex items-center justify-between border-b border-border-subtle shrink-0 select-none">
        <span className="text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Source Control</span>
        {activeCol && (
          <div className="flex space-x-1">
            <button onClick={() => fetchGitStatus(activeCol.id, activeCol.folderPath!)} disabled={actionLoading} title="Refresh" className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/50 disabled:opacity-50">
              <RefreshCw size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {collections.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-text-muted">
            <FolderGit2 size={32} className="mb-4 opacity-50" />
            <p className="text-sm">No Git-backed collections.</p>
            <p className="text-xs mt-2 opacity-70">Connect a collection to a local git folder to see changes here.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="p-2 border-b border-border-subtle">
              <select
                value={activeColId || ''}
                onChange={e => setActiveColId(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-border-strong rounded px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
              >
                {collections.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {activeCol && data && (
              <div className="p-3">
                {!data.isRepo ? (
                  <div className="text-center py-8">
                    <FolderGit2 size={32} className="mx-auto mb-4 text-text-muted" />
                    <p className="text-sm text-text-primary mb-2">Not a Git Repository</p>
                    <p className="text-xs text-text-muted mb-4 px-4">
                      This collection is linked to a local folder, but it hasn't been initialized as a git repository yet.
                    </p>
                    <button
                      onClick={handleInitRepo}
                      disabled={actionLoading}
                      className="bg-accent hover:bg-accent-hover text-white text-xs font-medium py-1.5 px-4 rounded inline-flex items-center"
                    >
                      {actionLoading ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <GitBranch size={12} className="mr-1.5" />}
                      Initialize Git Repository
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center text-xs text-text-secondary">
                        <GitBranch size={12} className="mr-1.5" />
                        <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded">{data.branch || 'No Commits Yet'}</span>
                      </div>
                    </div>

                    <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">
                      Changes {(data?.status?.length || 0) > 0 && <span className="bg-white/10 text-white rounded-full px-1.5 py-0.5 ml-1">{data.status.length}</span>}
                    </div>

                    {data.loading ? (
                      <div className="flex justify-center p-4">
                        <Loader2 size={16} className="animate-spin text-text-muted" />
                      </div>
                    ) : (data?.status?.length || 0) === 0 ? (
                      <div className="text-xs text-text-muted italic py-4 text-center">
                        No changes
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        {(data.status || []).map((item, i) => (
                          <div key={i} className="flex items-center text-xs py-1 px-1.5 hover:bg-surface-hover rounded group cursor-default">
                            <span className={`w-4 font-mono font-bold text-[10px] mr-2 text-center ${
                              item.status.includes('M') ? 'text-blue-400' :
                              item.status.includes('A') ? 'text-green-400' :
                              item.status.includes('D') ? 'text-red-400' :
                              'text-yellow-400'
                            }`}>
                              {item.status.trim() || '?'}
                            </span>
                            <span className="text-text-primary truncate">{item.file}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="mt-8 border-t border-border-subtle pt-4">
                      <p className="text-[10px] text-text-muted">
                        Pigeon does not manage commits or pushing to remotes. Use your preferred Git client (like VS Code, GitHub Desktop, or the terminal) to manage this repository.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
