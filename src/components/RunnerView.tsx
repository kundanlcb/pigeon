import React, { useState } from 'react';
import { useStore, type RequestItem } from '../store';
import { Play, Loader2, Check, X, Upload, FileText, ChevronRight, ChevronDown } from 'lucide-react';
import { getMethodColor } from '../utils/styles';
import { parseDataset } from '../utils/engine';
import { RequestResponseDetails } from './RequestResponseDetails';

export function RunnerView() {
  const runnerState = useStore(state => state.runnerState);
  const setRunnerState = useStore(state => state.setRunnerState);
  const collections = useStore(state => state.collections);
  const selectedRequestIds = useStore(state => state.selectedRunnerRequestIds);
  const showToast = useStore(state => state.showToast);

  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [parsedDataset, setParsedDataset] = useState<Record<string, string>[] | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [currentIteration, setCurrentIteration] = useState<number>(0);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentName: '', currentMethod: '', currentUrl: '' });
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [runLogs, setRunLogs] = useState<string[]>([]);
  const [isLogsExpanded, setIsLogsExpanded] = useState<boolean>(false);
  
  const terminalRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [runLogs]);

  const toggleResult = (id: string) => {
    const newSet = new Set(expandedResults);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedResults(newSet);
  };

  const allRequests = collections.flatMap(c => c.requests);
  const targetRequests = allRequests.filter(req => selectedRequestIds.includes(req.id));
  
  if (targetRequests.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-muted bg-app-bg">
        <p>No requests selected.</p>
        <p className="text-[12px] mt-2 opacity-70">Please select requests from the Runner Sidebar to run them in sequence.</p>
      </div>
    );
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setDatasetFile(file);
    setIsParsing(true);
    try {
      const text = await file.text();
      const isCsv = file.name.toLowerCase().endsWith('.csv');
      const data = await parseDataset(text, isCsv);
      setParsedDataset(data);
      if (data.length === 0) {
        showToast('Dataset is empty', 'error');
      } else {
        showToast(`Loaded ${data.length} rows from dataset`, 'success');
      }
    } catch (error: any) {
      showToast(`Failed to parse dataset: ${error.message || String(error)}`, 'error');
      setDatasetFile(null);
      setParsedDataset(null);
    } finally {
      setIsParsing(false);
    }
  };

  const runRequest = async (req: RequestItem, localVars: Record<string, string>): Promise<any> => {
    const { executeRequest } = await import('../utils/engine');
    const activeEnvironment = useStore.getState().environments.find(e => e.id === useStore.getState().activeEnvironmentId);
    
    const result = await executeRequest({
      request: req,
      environment: activeEnvironment,
      localVars,
      saveSecretsToEnvironment: true,
      onLog: (msg) => setRunLogs(prev => [...prev, msg])
    });
    
    if (result.error && !result.status) {
      throw new Error(result.error);
    }
    
    return result;
  };

  const handleStartRun = async () => {
    setRunnerState({ isRunning: true, results: [], currentIndex: 0 });
    setRunLogs([]);
    setIsLogsExpanded(true);
    
    const dataset = parsedDataset && parsedDataset.length > 0 ? parsedDataset : [{}];
    const totalRequestsToRun = dataset.length * targetRequests.length;
    setProgress({ current: 0, total: totalRequestsToRun, currentName: '', currentMethod: '', currentUrl: '' });
    
    let currentOverallIndex = 0;
    
    for (let iter = 0; iter < dataset.length; iter++) {
      setCurrentIteration(iter + 1);
      const rowVars = dataset[iter];
      
      const requestsToRun = targetRequests;

      for (let i = 0; i < requestsToRun.length; i++) {
        const req = requestsToRun[i];
        setRunnerState({ currentIndex: i });
        currentOverallIndex++;
        setProgress(p => ({ ...p, current: currentOverallIndex, currentName: req.name, currentMethod: req.method, currentUrl: req.url }));
        
        const startTime = performance.now();
        setRunLogs(prev => [...prev, `__SECTION__STARTING_AUDIT_FOR__${req.name}`]);
        try {
          const response = await runRequest(req, rowVars);
          const endTime = performance.now();
          
          const allTestsPassed = response.testResults.every((t: any) => t.passed);
          const isSuccess = response.status >= 200 && response.status < 300 && (response.testResults.length === 0 || allTestsPassed);
          
          if (isSuccess) {
            setRunLogs(prev => [
              ...prev, 
              `[✓] Request successful (${Math.round(endTime - startTime)}ms)\n  URL: ${req.url}\n  Status: ${response.status}\n  Response: ${typeof response.data === 'string' ? response.data.substring(0, 500) : JSON.stringify(response.data).substring(0, 500)}...`
            ]);
          } else {
            setRunLogs(prev => [
              ...prev, 
              `[!] Request failed with status ${response.status}\n  URL: ${req.url}\n  Response: ${typeof response.data === 'string' ? response.data.substring(0, 500) : JSON.stringify(response.data).substring(0, 500)}...`
            ]);
          }
          
          const resultItem = {
            requestId: req.id,
            requestName: req.name,
            iteration: iter + 1,
            status: isSuccess ? 'success' : 'error',
            statusCode: response.status,
            responseTime: response.timeMs || Math.round(endTime - startTime),
            testResults: response.testResults,
            error: response.error,
            requestUrl: req.url,
            requestHeaders: req.headers,
            requestBody: typeof req.body === 'string' ? req.body : req.body ? JSON.stringify(req.body) : null,
            responseHeaders: response.headers,
            responseBody: response.rawText || (typeof response.data === 'string' ? response.data : JSON.stringify(response.data))
          };
          
          useStore.getState().setRunnerState({
            results: [...useStore.getState().runnerState.results, resultItem as any]
          });
          
        } catch (error: any) {
          const endTime = performance.now();
          setRunLogs(prev => [...prev, `[!] Error executing ${req.name}: ${error.message || String(error)}`]);
          const resultItem = {
            requestId: req.id,
            requestName: req.name,
            iteration: iter + 1,
            status: 'error',
            responseTime: Math.round(endTime - startTime),
            testResults: [],
            error: error.message || String(error),
            requestUrl: req.url,
            requestHeaders: req.headers,
            requestBody: typeof req.body === 'string' ? req.body : req.body ? JSON.stringify(req.body) : null,
          };
          useStore.getState().setRunnerState({
            results: [...useStore.getState().runnerState.results, resultItem as any]
          });
        }
      }
    }
    
    setRunLogs(prev => [...prev, '__SECTION__COMPLETED__Collection Run Completed.']);
    useStore.getState().setRunnerState({ isRunning: false });
    setCurrentIteration(0);
    setIsLogsExpanded(false); // Switch back to outcomes
  };

  const requestsToDisplay = targetRequests;

  return (
    <div className="flex-1 flex flex-col bg-app-bg overflow-hidden relative">
      <div className="flex items-center justify-between px-4 h-[44px] border-b border-border-strong bg-panel-bg shrink-0">
        <div className="flex items-center space-x-6 overflow-hidden">
          <div className="flex items-center space-x-3 shrink-0">
            <Play className="text-accent" size={16} />
            <h2 className="text-[13px] font-semibold text-text-primary whitespace-nowrap">Runner Hub</h2>
          </div>

          <div className="w-[1px] h-4 bg-border-strong shrink-0" />
          <div className="flex items-center space-x-2 text-[12px] text-text-muted shrink-0">
            <span className="font-medium text-text-primary whitespace-nowrap">
              {requestsToDisplay.length}/{allRequests.length} APIs selected
              {parsedDataset && parsedDataset.length > 0 && <span className="text-text-muted ml-1 font-normal">× {parsedDataset.length} iterations = {requestsToDisplay.length * parsedDataset.length} total</span>}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Data File Upload */}
          <div className="flex items-center space-x-2 mr-4">
            {datasetFile ? (
              <div className="flex items-center space-x-2 bg-surface-hover px-3 py-1.5 rounded-md text-xs border border-border-subtle">
                <FileText size={14} className="text-accent" />
                <span className="text-text-primary max-w-[150px] truncate">{datasetFile.name}</span>
                <span className="text-text-muted">({parsedDataset?.length || 0} rows)</span>
                <button 
                  onClick={() => { setDatasetFile(null); setParsedDataset(null); }}
                  className="ml-2 text-text-muted hover:text-red-400 p-0.5 rounded"
                  disabled={runnerState.isRunning}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${runnerState.isRunning ? 'opacity-50 cursor-not-allowed text-text-muted' : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-dashed border-border-strong hover:border-text-secondary'}`}>
                {isParsing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                <span>Data File</span>
                <input 
                  type="file" 
                  accept=".csv,.json"
                  className="hidden" 
                  onChange={handleFileUpload}
                  disabled={runnerState.isRunning || isParsing}
                />
              </label>
            )}
          </div>

          <button 
            onClick={handleStartRun}
            disabled={runnerState.isRunning || requestsToDisplay.length === 0}
            className={`flex items-center space-x-1.5 px-3 h-[28px] rounded text-[11px] font-medium transition-all shadow-sm ${
              runnerState.isRunning || requestsToDisplay.length === 0
                ? 'opacity-50 cursor-not-allowed bg-surface-hover text-text-muted'
                : 'bg-accent text-white hover:bg-accent-hover'
            }`}
          >
            {runnerState.isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
            <span>{runnerState.isRunning ? (currentIteration ? `Running (Iter ${currentIteration})...` : 'Running...') : 'Start Run'}</span>
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden flex flex-col px-4 py-6">
        <div className="w-full h-full flex flex-col max-w-5xl mx-auto">
          {requestsToDisplay.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-text-muted mt-20">
              <Play size={48} className="mb-4 opacity-20" />
              <h3 className="text-[13px] font-medium text-text-primary mb-2">Collection Runner</h3>
              <p className="text-[12px] max-w-sm text-center leading-relaxed">
                Select target endpoints from the left sidebar to execute them in sequence.
              </p>
            </div>
          ) : !runnerState.isRunning && runnerState.results.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-text-muted mt-20">
              <Play size={48} className="mb-4 opacity-20 text-accent" />
              <h3 className="text-[13px] font-medium text-text-primary mb-2">Ready to Run</h3>
              <p className="text-[12px] max-w-sm text-center leading-relaxed">
                {requestsToDisplay.length} endpoints selected. Click Start Run to begin execution.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-6 min-h-0 w-full h-full">
              {/* Progress Summary Header */}
              {runnerState.isRunning && (
                <div className="flex flex-col space-y-3 bg-panel-bg border border-border-strong rounded-md p-4 shrink-0 shadow-sm">
                  <div className="flex items-center justify-between text-[12px] font-medium">
                    <div className="flex items-center flex-1 min-w-0 mr-4">
                      <span className="text-text-secondary mr-2 shrink-0">Running:</span>
                      {progress.currentMethod && (
                        <span className={`font-bold text-[10px] mr-1.5 w-12 text-left shrink-0 ${
                          progress.currentMethod === 'GET' ? 'text-blue-400' :
                          progress.currentMethod === 'POST' ? 'text-green-400' :
                          progress.currentMethod === 'PUT' ? 'text-yellow-400' :
                          progress.currentMethod === 'DELETE' ? 'text-red-400' : 'text-purple-400'
                        }`}>{progress.currentMethod}</span>
                      )}
                      <span className="truncate font-semibold">{progress.currentName || 'Initializing...'}</span>
                      {progress.currentUrl && (
                        <span className="ml-1.5 text-[11px] text-text-secondary font-mono truncate max-w-[250px] shrink-0">
                          ({progress.currentUrl})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 shrink-0">
                      <div className="flex items-center space-x-3 text-text-secondary">
                        <span>{progress.current} of {progress.total}</span>
                        <span className="text-accent font-bold w-8 text-right">{progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%</span>
                      </div>
                      <div className="w-px h-3.5 bg-border-strong" />
                      <div className="flex items-center text-accent font-semibold animate-pulse">
                        <Play size={13} className="mr-1.5" />
                        Run in progress...
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-app-bg rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent transition-all duration-300"
                      style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Logs Panel */}
              <div className={`flex flex-col ${!(runnerState.isRunning || isLogsExpanded) ? 'hidden' : 'flex-1'} bg-panel-bg border border-border-strong rounded-md overflow-hidden shadow-sm min-h-0`}>
              <div className="bg-app-bg px-4 py-2 border-b border-border-strong text-[11px] font-bold text-text-muted uppercase tracking-wider flex justify-between items-center shrink-0">
                <span>Execution Log</span>
                <div className="flex items-center space-x-3">
                  {runnerState.isRunning && <span className="flex items-center text-accent"><Play size={10} className="mr-1 animate-pulse" /> Live</span>}
                  {!runnerState.isRunning && isLogsExpanded && (
                    <button
                      onClick={() => setIsLogsExpanded(false)}
                      className="flex items-center space-x-1 text-[10px] font-medium text-text-secondary hover:text-text-primary transition-colors bg-surface-hover/50 px-2 py-1 rounded"
                    >
                      <ChevronDown size={12} />
                      <span>Back to Outcomes</span>
                    </button>
                  )}
                </div>
              </div>
              <div ref={terminalRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 font-mono text-[11px]">
                {runLogs.map((log, i) => {
                  if (log.startsWith('__SECTION__STARTING_AUDIT_FOR__')) {
                    const title = log.replace('__SECTION__STARTING_AUDIT_FOR__', '');
                    return (
                      <div key={i} className="mt-6 mb-2 py-1.5 px-3 bg-accent/10 border-l-2 border-accent text-accent font-bold">
                        Running Request: {title}
                      </div>
                    );
                  }
                  if (log.startsWith('__SECTION__COMPLETED__')) {
                    return (
                      <div key={i} className="mt-6 py-2 text-center text-green-400 font-bold border-y border-green-400/20 bg-green-400/5">
                        {log.replace('__SECTION__COMPLETED__', '')}
                      </div>
                    );
                  }
                  return (
                    <div key={i} className={`py-0.5 ${
                      log.includes('[!]') || log.includes('Error') ? 'text-red-400' :
                      log.includes('[✓]') ? 'text-green-400' :
                      log.includes('[-]') ? 'text-text-muted' :
                      'text-text-primary'
                    }`}>
                      <span className="leading-relaxed whitespace-pre-wrap">{log}</span>
                    </div>
                  );
                })}
                {runnerState.isRunning && (
                  <div className="py-2 text-accent animate-pulse flex items-center">
                    <span className="mr-2">_</span>
                    Executing...
                  </div>
                )}
              </div>
            </div>

          {/* Outcomes Panel */}
          {!(runnerState.isRunning || isLogsExpanded) && (
            <div className="flex flex-col flex-1 min-h-0 w-full bg-panel-bg border border-border-strong rounded-md overflow-hidden shadow-sm">
              <div className="bg-app-bg px-4 py-2 border-b border-border-strong text-[11px] font-bold text-text-muted uppercase tracking-wider flex justify-between items-center shrink-0">
                <span>Execution Outcomes</span>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {requestsToDisplay.length === 0 ? (
                <div className="text-[12px] text-text-muted text-center py-10">
                  No requests selected. Please select requests from the sidebar.
                </div>
              ) : (
                <>
                  {runnerState.results.length === 0 ? requestsToDisplay.map((req, idx) => (
                    <div 
                      key={req.id} 
                      className="flex flex-col border-b border-border-subtle last:border-b-0 opacity-70"
                    >
                <div className="flex items-center justify-between p-3 rounded-md text-[13px]">
                  <div className="flex items-center space-x-3 flex-1 min-w-0 mr-4">
                    <div className="w-4 h-4 flex items-center justify-center text-text-muted shrink-0">
                      <span className="text-[10px]">{idx + 1}</span>
                    </div>
                    <span className={`text-[10px] font-bold w-12 shrink-0 ${getMethodColor(req.method)}`}>
                      {req.method}
                    </span>
                    <span className="font-medium text-text-muted truncate shrink-0 max-w-[200px]">
                      {req.name}
                    </span>
                    <span className="text-[11px] text-text-muted truncate ml-2 font-mono">
                      {req.url}
                    </span>
                  </div>
                </div>
              </div>
            )) : runnerState.results.map((result, idx) => {
              const req = allRequests.find(r => r.id === result.requestId);
              if (!req) return null;
              
              const resultId = `${result.requestId}-${result.iteration}-${idx}`;
              const isExpanded = expandedResults.has(resultId);
              
              return (
                <div 
                  key={resultId} 
                  className="flex flex-col border-b border-border-subtle last:border-b-0"
                >
                  <div 
                    onClick={() => toggleResult(resultId)}
                    className={`flex items-center justify-between p-3 rounded-md text-[13px] cursor-pointer hover:bg-surface-hover/50 transition-colors ${
                      result.status === 'success' ? 'bg-green-500/5' : 
                      result.status === 'error' ? 'bg-red-500/5' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0 mr-4">
                      <div className="w-4 h-4 flex items-center justify-center text-text-muted hover:text-text-primary shrink-0">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                      <div className="w-4 h-4 flex justify-center items-center shrink-0">
                        {result.status === 'success' ? (
                          <Check size={14} className="text-green-500" />
                        ) : result.status === 'error' ? (
                          <X size={14} className="text-red-500" />
                        ) : (
                          <span className="text-text-muted text-[10px]">{idx + 1}</span>
                        )}
                      </div>
                      
                      <span className={`text-[10px] font-bold w-12 text-left shrink-0 ${getMethodColor(req.method)}`}>
                        {req.method}
                      </span>
                      
                      <span className="font-medium text-text-primary truncate shrink-0 max-w-[200px]">
                        {req.name}
                      </span>

                      {result.requestUrl && (
                        <span className="text-[11px] text-text-muted truncate ml-2 font-mono">
                          {result.requestUrl}
                        </span>
                      )}
                      
                      {result.iteration && parsedDataset && (
                        <span className="px-1.5 py-0.5 rounded bg-surface-hover text-[10px] text-text-muted border border-border-subtle font-mono">
                          iter {result.iteration}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-3 text-[11px] font-mono shrink-0">
                      <span className={result.statusCode && result.statusCode >= 200 && result.statusCode < 300 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                        {result.statusCode || 'Err'}
                      </span>
                      <span className="text-text-muted">{result.responseTime}ms</span>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="pl-12 py-2 pr-4 space-y-4 bg-surface-bg/30 rounded-b-md">
                      {result.error && (
                        <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono break-words whitespace-pre-wrap">
                          <strong className="text-[11px] uppercase tracking-wider text-red-400/70 block mb-1">Error</strong>
                          {result.error}
                        </div>
                      )}
                      
                      {result.testResults && result.testResults.length > 0 && (
                        <div>
                          <h4 className="text-[11px] uppercase tracking-wider text-text-secondary font-semibold mb-2">Test Results</h4>
                          <div className="space-y-2 bg-surface-bg p-3 rounded border border-border-subtle">
                            {result.testResults.map((test: any, tIdx: number) => (
                              <div key={tIdx} className="flex items-start space-x-2 text-xs">
                                {test.passed ? (
                                  <Check size={12} className="text-green-500 mt-0.5 shrink-0" />
                                ) : (
                                  <X size={12} className="text-red-500 mt-0.5 shrink-0" />
                                )}
                                <div>
                                  <span className={test.passed ? 'text-green-400/80' : 'text-red-400/80'}>{test.name}</span>
                                  {!test.passed && test.error && (
                                    <div className="mt-1 font-mono text-[10px] text-red-300/80 bg-red-500/10 p-1.5 rounded">
                                      {test.error}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {(result.requestUrl || result.responseHeaders || result.responseBody) && (
                        <div className="mt-4 pt-3 border-t border-border-subtle/50">
                          <RequestResponseDetails 
                            method={req.method}
                            url={result.requestUrl}
                            requestHeaders={result.requestHeaders}
                            requestBody={result.requestBody}
                            responseHeaders={result.responseHeaders}
                            responseBody={result.responseBody}
                            statusCode={result.statusCode}
                            responseTime={result.responseTime}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
                  })}
                </>
              )}
            </div>
            
            {runnerState.results.length > 0 && (
              <div className="p-2 border-t border-border-strong bg-app-bg shrink-0 flex justify-center">
                <button
                  onClick={() => setIsLogsExpanded(true)}
                  className="flex items-center space-x-1.5 text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors py-1"
                >
                  <ChevronRight size={14} />
                  <span>View Raw Execution Logs</span>
                </button>
              </div>
            )}
          </div>
          )}
        </div>
        )}
        </div>
      </div>
    </div>
  );
}
