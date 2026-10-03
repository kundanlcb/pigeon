import { useStore, type RequestItem } from '../store';
import { Play, Loader2, Check, X, ArrowLeft } from 'lucide-react';

import { getMethodColor } from '../utils/styles';


export function RunnerView() {
  const runnerState = useStore(state => state.runnerState);
  const setRunnerState = useStore(state => state.setRunnerState);
  const collections = useStore(state => state.collections);
  const setActiveView = useStore(state => state.setActiveView);

  const collection = collections.find(c => c.id === runnerState.collectionId);
  
  if (!collection) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-muted bg-app-bg">
        <p>No collection selected for running.</p>
        <button onClick={() => setActiveView('editor')} className="mt-4 text-accent hover:underline">Go Back</button>
      </div>
    );
  }

  const runRequest = async (req: RequestItem): Promise<any> => {
    const { executeRequest } = await import('../utils/engine');
    const activeEnvironment = useStore.getState().environments.find(e => e.id === useStore.getState().activeEnvironmentId);
    
    const result = await executeRequest({
      request: req,
      environment: activeEnvironment,
      saveSecretsToEnvironment: true
    });
    
    if (result.error && !result.status) {
      throw new Error(result.error);
    }
    
    return {
      status: result.status,
      testResults: result.testResults
    };
  };

  const handleStartRun = async () => {
    setRunnerState({ isRunning: true, results: [], currentIndex: 0 });
    
    for (let i = 0; i < collection.requests.length; i++) {
      const req = collection.requests[i];
      setRunnerState({ currentIndex: i });
      
      const startTime = performance.now();
      try {
        const response = await runRequest(req);
        const endTime = performance.now();
        
        const allTestsPassed = response.testResults.every((t: any) => t.passed);
        const isSuccess = response.status >= 200 && response.status < 300 && (response.testResults.length === 0 || allTestsPassed);
        
        const resultItem = {
          requestId: req.id,
          requestName: req.name,
          status: isSuccess ? 'success' : 'error',
          statusCode: response.status,
          responseTime: Math.round(endTime - startTime),
          testResults: response.testResults
        };
        
        useStore.getState().setRunnerState({
          results: [...useStore.getState().runnerState.results, resultItem as any]
        });
        
      } catch (error: any) {
        const endTime = performance.now();
        const resultItem = {
          requestId: req.id,
          requestName: req.name,
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
    
    useStore.getState().setRunnerState({ isRunning: false });
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
            <p className="text-xs text-text-muted">{collection.requests.length} requests in sequence</p>
          </div>
        </div>
        
        <button 
          onClick={handleStartRun}
          disabled={runnerState.isRunning || collection.requests.length === 0}
          className="flex items-center space-x-2 bg-accent hover:bg-accent-hover text-white px-5 h-[36px] rounded-md text-sm font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {runnerState.isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
          <span>{runnerState.isRunning ? 'Running...' : 'Start Run'}</span>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
        {collection.requests.length === 0 ? (
          <div className="text-center text-text-muted py-12">
            This collection has no requests. Add some requests to run them in sequence.
          </div>
        ) : (
          <div className="space-y-3">
            {collection.requests.map((req, idx) => {
              const result = runnerState.results.find(r => r.requestId === req.id);
              const isCurrent = runnerState.isRunning && runnerState.currentIndex === idx;
              const isPending = !result && !isCurrent;
              
              return (
                <div 
                  key={req.id} 
                  className={`rounded-lg border p-4 transition-all ${
                    isCurrent ? 'bg-surface-bg border-accent shadow-sm' : 
                    result?.status === 'success' ? 'bg-green-500/5 border-green-500/20' : 
                    result?.status === 'error' ? 'bg-red-500/5 border-red-500/20' : 
                    'bg-surface-bg border-border-subtle opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-6 flex justify-center">
                        {isCurrent ? (
                          <Loader2 size={16} className="animate-spin text-accent" />
                        ) : result?.status === 'success' ? (
                          <Check size={16} className="text-green-500" />
                        ) : result?.status === 'error' ? (
                          <X size={16} className="text-red-500" />
                        ) : (
                          <span className="text-text-muted text-xs">{idx + 1}</span>
                        )}
                      </div>
                      
                      <span className={`text-[11px] font-bold w-12 ${getMethodColor(req.method)}`}>
                        {req.method}
                      </span>
                      
                      <span className={`font-medium ${isPending ? 'text-text-muted' : 'text-text-primary'}`}>
                        {req.name}
                      </span>
                    </div>
                    
                    {result && (
                      <div className="flex items-center space-x-4 text-xs font-mono">
                        <span className={result.statusCode && result.statusCode >= 200 && result.statusCode < 300 ? 'text-green-400' : 'text-red-400'}>
                          {result.statusCode || 'Err'}
                        </span>
                        <span className="text-text-muted">{result.responseTime}ms</span>
                      </div>
                    )}
                  </div>
                  
                  {result?.error && (
                    <div className="mt-3 ml-10 p-2 rounded bg-red-500/10 text-red-400 text-xs font-mono">
                      {result.error}
                    </div>
                  )}
                  
                  {result?.testResults && result.testResults.length > 0 && (
                    <div className="mt-3 ml-10 space-y-1.5">
                      {result.testResults.map((test, tIdx) => (
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
