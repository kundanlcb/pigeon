import { useState, useEffect, useRef } from 'react';
import { Panel } from 'react-resizable-panels';
import { useStore } from '../store';
import { getGitStatus, gitBranch, gitBranches, gitCheckout, gitCheckoutNew, isGitRepo, gitInit, gitAdd, gitCommit, gitPush, gitPull, gitRemoteAdd, gitCommand } from '../utils/git';
import { GitBranch, RefreshCw, FolderGit2, Loader2, Check, ArrowDownToLine, ArrowUpFromLine, Plus, ChevronDown } from 'lucide-react';

export function SourceControlPanel() {
  const collections = useStore(state => state.collections).filter(c => c.storageMode === 'folder' && c.folderPath);
  const [gitData, setGitData] = useState<Record<string, { isRepo: boolean, branch: string, branches: string[], status: { status: string, file: string }[], remoteConfigured: boolean, loading: boolean }>>({});
  const [activeColId, setActiveColId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const branchMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (branchMenuRef.current && !branchMenuRef.current.contains(e.target as Node)) {
        setShowBranchMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!activeColId && collections.length > 0) {
      setActiveColId(collections[0].id);
    }
  }, [collections, activeColId]);

  const handleCommit = async () => {
    if (!activeColId || !commitMessage.trim()) return;
    const col = collections.find(c => c.id === activeColId);
    if (!col?.folderPath) return;

    setActionLoading(true);
    try {
      await gitAdd(col.folderPath, ['.']);
      await gitCommit(col.folderPath, commitMessage.trim());
      setCommitMessage('');
      await fetchGitStatus(col.id, col.folderPath);
      useStore.getState().showToast('Successfully committed changes', 'success');
    } catch (e: any) {
      useStore.getState().showToast('Commit failed: ' + String(e), 'error');
    }
    setActionLoading(false);
  };

  const handlePush = async () => {
    if (!activeColId) return;
    const col = collections.find(c => c.id === activeColId);
    if (!col?.folderPath) return;

    setActionLoading(true);
    try {
      await gitPush(col.folderPath);
      useStore.getState().showToast('Successfully pushed to remote', 'success');
    } catch (e: any) {
      useStore.getState().showToast('Push failed. Ensure SSH keys are configured or remote is valid. Error: ' + String(e), 'error');
    }
    setActionLoading(false);
  };

  const handlePull = async () => {
    if (!activeColId) return;
    const col = collections.find(c => c.id === activeColId);
    if (!col?.folderPath) return;

    setActionLoading(true);
    try {
      await gitPull(col.folderPath);
      await fetchGitStatus(col.id, col.folderPath);
      useStore.getState().showToast('Successfully pulled from remote', 'success');
    } catch (e: any) {
      useStore.getState().showToast('Pull failed. Stash/Commit changes or check remote. Error: ' + String(e), 'error');
    }
    setActionLoading(false);
  };

  const handleAddRemote = async () => {
    if (!activeColId || !remoteUrl.trim()) return;
    const col = collections.find(c => c.id === activeColId);
    if (!col?.folderPath) return;

    setActionLoading(true);
    try {
      await gitRemoteAdd(col.folderPath, remoteUrl.trim());
      await fetchGitStatus(col.id, col.folderPath);
      setRemoteUrl('');
      useStore.getState().showToast('Remote added successfully', 'success');
    } catch (e: any) {
      useStore.getState().showToast('Failed to add remote: ' + String(e), 'error');
    }
    setActionLoading(false);
  };

  const handleSwitchBranch = async (branchName: string) => {
    if (!activeColId) return;
    const col = collections.find(c => c.id === activeColId);
    if (!col?.folderPath) return;

    setActionLoading(true);
    try {
      await gitCheckout(col.folderPath, branchName);
      await fetchGitStatus(col.id, col.folderPath);
      setShowBranchMenu(false);
      useStore.getState().showToast(`Switched to ${branchName}`, 'success');
    } catch (e: any) {
      useStore.getState().showToast(`Switch failed: ${String(e)}`, 'error');
    }
    setActionLoading(false);
  };

  const handleCreateBranch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeColId || !newBranchName.trim()) return;
    const col = collections.find(c => c.id === activeColId);
    if (!col?.folderPath) return;

    setActionLoading(true);
    try {
      await gitCheckoutNew(col.folderPath, newBranchName.trim());
      setNewBranchName('');
      await fetchGitStatus(col.id, col.folderPath);
      setShowBranchMenu(false);
      useStore.getState().showToast(`Created branch ${newBranchName.trim()}`, 'success');
    } catch (e: any) {
      useStore.getState().showToast(`Create failed: ${String(e)}`, 'error');
    }
    setActionLoading(false);
  };

  const fetchGitStatus = async (colId: string, folderPath: string) => {
    setGitData(prev => ({ ...prev, [colId]: { ...prev[colId], loading: true } }));
    try {
      const isRepo = await isGitRepo(folderPath);
      if (!isRepo) {
        setGitData(prev => ({ ...prev, [colId]: { isRepo: false, branch: '', branches: [], status: [], remoteConfigured: false, loading: false } }));
        return;
      }
      const branch = await gitBranch(folderPath);
      const branches = await gitBranches(folderPath);
      const status = await getGitStatus(folderPath);
      let remoteConfigured = false;
      try {
        const remoteOut = await gitCommand(['remote', '-v'], folderPath);
        remoteConfigured = remoteOut.trim().length > 0;
      } catch (e) {}

      setGitData(prev => ({ ...prev, [colId]: { isRepo: true, branch, branches, status, remoteConfigured, loading: false } }));
    } catch (e) {
      setGitData(prev => ({ ...prev, [colId]: { isRepo: false, branch: 'unknown', branches: [], status: [], remoteConfigured: false, loading: false } }));
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
    <Panel defaultSize={30} minSize={15} className="bg-panel-bg flex flex-col z-10 select-none rounded-tr-xl border-r border-t border-border-strong overflow-hidden relative shadow-2xl">
      <div className="h-[44px] px-4 flex items-center justify-between border-b border-border-subtle shrink-0 select-none">
        <span className="text-[11px] font-semibold tracking-wider text-text-secondary uppercase">Source Control</span>
        {activeCol && (
          <div className="flex space-x-1">
            <button onClick={() => fetchGitStatus(activeCol.id, activeCol.folderPath!)} disabled={actionLoading} title="Refresh" className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover disabled:opacity-50">
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
                className="w-full bg-surface-bg border border-border-strong rounded px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
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
                    <div className="flex flex-col gap-3 mb-4">
                      <div className="flex items-center justify-between relative" ref={branchMenuRef}>
                        <div 
                          className="flex items-center text-xs text-text-secondary cursor-pointer hover:text-text-primary bg-surface-bg border border-border-strong px-2 py-1 rounded transition-colors"
                          onClick={() => setShowBranchMenu(!showBranchMenu)}
                        >
                          <GitBranch size={12} className="mr-1.5" />
                          <span className="font-mono flex-1 truncate max-w-[120px]">{data.branch || 'No Commits Yet'}</span>
                          <ChevronDown size={12} className="ml-1 opacity-70" />
                        </div>
                        
                        {showBranchMenu && (
                          <div className="absolute top-full left-0 mt-1 w-56 bg-panel-bg border border-border-strong rounded-md shadow-2xl z-50 overflow-hidden flex flex-col">
                            <div className="max-h-48 overflow-y-auto">
                              {(data.branches || []).map(b => (
                                <button
                                  key={b}
                                  onClick={() => handleSwitchBranch(b)}
                                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-surface-hover ${b === data.branch ? 'text-accent font-bold bg-accent/5' : 'text-text-secondary'} flex items-center justify-between`}
                                >
                                  <span className="truncate font-mono">{b}</span>
                                  {b === data.branch && <Check size={12} />}
                                </button>
                              ))}
                            </div>
                            <form onSubmit={handleCreateBranch} className="border-t border-border-subtle p-2 bg-surface-bg flex items-center">
                              <input
                                type="text"
                                placeholder="New branch name..."
                                value={newBranchName}
                                onChange={e => setNewBranchName(e.target.value)}
                                className="flex-1 bg-panel-bg border border-border-strong rounded-l px-2 py-1 text-[10px] text-text-primary outline-none focus:border-accent min-w-0"
                              />
                              <button 
                                type="submit" 
                                disabled={!newBranchName.trim() || actionLoading}
                                className="bg-accent hover:bg-accent-hover text-white px-2 py-1 rounded-r border border-accent text-[10px] font-bold disabled:opacity-50 transition-colors uppercase tracking-wider"
                              >
                                Create
                              </button>
                            </form>
                          </div>
                        )}
                        
                        {data.remoteConfigured && (
                          <div className="flex items-center space-x-1">
                            <button onClick={handlePull} disabled={actionLoading} title="Pull" className="p-1.5 rounded bg-surface-hover hover:bg-border-strong transition-colors disabled:opacity-50 text-text-secondary hover:text-text-primary">
                              <ArrowDownToLine size={14} />
                            </button>
                            <button onClick={handlePush} disabled={actionLoading} title="Push" className="p-1.5 rounded bg-surface-hover hover:bg-border-strong transition-colors disabled:opacity-50 text-text-secondary hover:text-text-primary">
                              <ArrowUpFromLine size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      {!data.remoteConfigured && (
                        <div className="flex items-center space-x-2 border border-yellow-500/20 bg-yellow-500/5 p-2 rounded">
                          <input 
                            type="text" 
                            placeholder="Remote URL (e.g. git@github.com:...)"
                            value={remoteUrl}
                            onChange={(e) => setRemoteUrl(e.target.value)}
                            className="flex-1 bg-transparent border-b border-border-strong outline-none text-[10px] px-1 py-0.5 text-text-primary"
                          />
                          <button onClick={handleAddRemote} disabled={actionLoading || !remoteUrl.trim()} className="bg-surface-hover hover:bg-border-strong p-1 rounded text-text-primary disabled:opacity-50">
                            <Plus size={12} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">
                      Changes {(data?.status?.length || 0) > 0 && <span className="bg-border-strong text-text-primary rounded-full px-1.5 py-0.5 ml-1">{data.status.length}</span>}
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
                            <span className="text-text-primary truncate flex-1">{item.file}</span>
                            <Check size={12} className="text-accent opacity-50" title="Staged for commit" />
                          </div>
                        ))}
                      </div>
                    )}

                    {(data?.status?.length || 0) > 0 && (
                      <div className="mt-4 pt-4 border-t border-border-subtle">
                        <textarea
                          value={commitMessage}
                          onChange={e => setCommitMessage(e.target.value)}
                          placeholder="Commit message..."
                          className="w-full bg-surface-bg border border-border-strong rounded px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent min-h-[60px] resize-y mb-2"
                        />
                        <button
                          onClick={handleCommit}
                          disabled={actionLoading || !commitMessage.trim()}
                          className="w-full bg-accent hover:bg-accent-hover text-white text-[11px] font-bold tracking-wide py-1.5 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors uppercase"
                        >
                          {actionLoading ? <Loader2 size={12} className="animate-spin mr-1.5" /> : null}
                          Commit All Changes
                        </button>
                      </div>
                    )}
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
