import React, { useState } from 'react';
import { useStore, type RequestItem } from '../store';
import { Play, Loader2, Check, X, ArrowLeft, Upload, FileText } from 'lucide-react';
import { getMethodColor } from '../utils/styles';
import { parseDataset } from '../utils/engine';

export function RunnerView() {
  const runnerState = useStore(state => state.runnerState);
  const setRunnerState = useStore(state => state.setRunnerState);
  const collections = useStore(state => state.collections);
  const setActiveView = useStore(state => state.setActiveView);
  const showToast = useStore(state => state.showToast);

  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [parsedDataset, setParsedDataset] = useState<Record<string, string>[] | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [currentIteration, setCurrentIteration] = useState<number>(0);

  const collection = collections.find(c => c.id === runnerState.collectionId);
  
  if (!collection) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-muted bg-app-bg">
        <p>No collection selected for running.</p>
        <button onClick={() => setActiveView('editor')} className="mt-4 text-accent hover:underline">Go Back</button>
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
      saveSecretsToEnvironment: true
    });
    
    if (result.error && !result.status) {
      throw new Error(result.error);
    }
    
    return {
      status: result.status,
      testResults: result.testResults,
      error: result.error
    };
  };

  const handleStartRun = async () => {
    setRunnerState({ isRunning: true, results: [], currentIndex: 0 });
    
    const dataset = parsedDataset && parsedDataset.length > 0 ? parsedDataset : [{}];
    
    for (let iter = 0; iter < dataset.length; iter++) {
      setCurrentIteration(iter + 1);
      const rowVars = dataset[iter];
      
      for (let i = 0; i < collection.requests.length; i++) {
        const req = collection.requests[i];
        setRunnerState({ currentIndex: i });
        
        const startTime = performance.now();
        try {
          const response = await runRequest(req, rowVars);
          const endTime = performance.now();
          
          const allTestsPassed = response.testResults.every((t: any) => t.passed);
          const isSuccess = response.status >= 200 && response.status < 300 && (response.testResults.length === 0 || allTestsPassed);
          
          const resultItem = {
            requestId: req.id,
            requestName: req.name,
            iteration: iter + 1,
            status: isSuccess ? 'success' : 'error',
            statusCode: response.status,
            responseTime: Math.round(endTime - startTime),
            testResults: response.testResults,
            error: response.error
          };
          
          useStore.getState().setRunnerState({
            results: [...useStore.getState().runnerState.results, resultItem as any]
          });
          
        } catch (error: any) {
          const endTime = performance.now();
          const resultItem = {
            requestId: req.id,
            requestName: req.name,
            iteration: iter + 1,
            status: 'error',
            responseTime: Math.round(endTime - startTime),
            testResults: [],
            error: error.message || String(error)
          };
          useStore.getState().setRunnerState({
            results: [...useStore.getState().runnerState.results, resultItem as any]
          });
        }
      }
    }
    
    useStore.getState().setRunnerState({ isRunning: false });
    setCurrentIteration(0);
  };

  return (
    <div className="flex-1 flex flex-col bg-app-bg overflow-hidden relative">
      <div className="h-[68px] px-6 border-b border-border-subtle shrink-0 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setActiveView('editor')}
            className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-text-primary flex items-center">
              Runner: <span className="ml-2 text-text-secondary">{collection.name}</span>
            </h1>
            <p className="text-xs text-text-muted">
              {collection.requests.length} requests in sequence
              {parsedDataset && parsedDataset.length > 0 && ` × ${parsedDataset.length} iterations = ${collection.requests.length * parsedDataset.length} total`}
            </p>
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
            disabled={runnerState.isRunning || collection.requests.length === 0}
            className="flex items-center space-x-2 bg-accent hover:bg-accent-hover text-white px-5 h-[36px] rounded-md text-sm font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {runnerState.isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
            <span>{runnerState.isRunning ? (currentIteration ? `Running (Iter ${currentIteration})...` : 'Running...') : 'Start Run'}</span>
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
        {collection.requests.length === 0 ? (
          <div className="text-center text-text-muted py-12">
            This collection has no requests. Add some requests to run them in sequence.
          </div>
        ) : (
          <div className="space-y-3">
            {runnerState.results.length === 0 ? collection.requests.map((req, idx) => (
              <div 
                key={req.id} 
                className="rounded-lg border p-4 bg-surface-bg border-border-subtle opacity-70"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-6 flex justify-center">
                      <span className="text-text-muted text-xs">{idx + 1}</span>
                    </div>
                    <span className={`text-[11px] font-bold w-12 ${getMethodColor(req.method)}`}>
                      {req.method}
                    </span>
                    <span className="font-medium text-text-muted">
                      {req.name}
                    </span>
                  </div>
                </div>
              </div>
            )) : runnerState.results.map((result, idx) => {
              const req = collection.requests.find(r => r.id === result.requestId);
              if (!req) return null;
              
              return (
                <div 
                  key={`${result.requestId}-${result.iteration}-${idx}`} 
                  className={`rounded-lg border p-4 transition-all ${
                    result.status === 'success' ? 'bg-green-500/5 border-green-500/20' : 
                    result.status === 'error' ? 'bg-red-500/5 border-red-500/20' : 
                    'bg-surface-bg border-border-subtle'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-6 flex justify-center">
                        {result.status === 'success' ? (
                          <Check size={16} className="text-green-500" />
                        ) : result.status === 'error' ? (
                          <X size={16} className="text-red-500" />
                        ) : (
                          <span className="text-text-muted text-xs">{idx + 1}</span>
                        )}
                      </div>
                      
                      <span className={`text-[11px] font-bold w-12 ${getMethodColor(req.method)}`}>
                        {req.method}
                      </span>
                      
                      <span className="font-medium text-text-primary">
                        {req.name}
                      </span>
                      
                      {result.iteration && parsedDataset && (
                        <span className="px-1.5 py-0.5 rounded bg-surface-hover text-[10px] text-text-muted border border-border-subtle font-mono">
                          iter {result.iteration}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-xs font-mono">
                      <span className={result.statusCode && result.statusCode >= 200 && result.statusCode < 300 ? 'text-green-400' : 'text-red-400'}>
                        {result.statusCode || 'Err'}
                      </span>
                      <span className="text-text-muted">{result.responseTime}ms</span>
                    </div>
                  </div>
                  
                  {result.error && (
                    <div className="mt-3 ml-10 p-2 rounded bg-red-500/10 text-red-400 text-xs font-mono">
                      {result.error}
                    </div>
                  )}
                  
                  {result.testResults && result.testResults.length > 0 && (
                    <div className="mt-3 ml-10 space-y-1.5">
                      {result.testResults.map((test: any, tIdx: number) => (
                        <div key={tIdx} className="flex items-start space-x-2 text-xs">
                          {test.passed ? (
                            <Check size={12} className="text-green-500 mt-0.5" />
                          ) : (
                            <X size={12} className="text-red-500 mt-0.5" />
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
