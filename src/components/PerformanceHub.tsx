import { useState, useEffect, useRef } from 'react';

import { useStore, type TelemetrySnapshot, type TargetMetrics } from '../store';
import { EnvironmentSelector } from './EnvironmentSelector';
import { Dropdown } from './Dropdown';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { invoke } from '@tauri-apps/api/core';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { listen } from '@tauri-apps/api/event';
import { getEnabledRequestHeaders, prepareRequestBody } from '../utils/request';
import { resolveEnvVariables } from '../utils/env';
import { getSecret } from '../utils/secrets';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { Terminal, Settings2, Activity, Play, StopCircle } from 'lucide-react';

interface MetricsBatch {
  total_requests: number;
  success_count: number;
  error_count: number;
  rps: number;
  p50_latency_ms: number;
  p90_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  status_codes: Record<number, number>;
  running: boolean;
  target_metrics?: Record<number, TargetMetrics>;
}



export function PerformanceHub() {
  const collections = useStore(state => state.collections);
  const environments = useStore(state => state.environments);
  const activeEnvironmentId = useStore(state => state.activeEnvironmentId);
  const selectedRequestIds = useStore(state => state.selectedPerformanceRequestIds);
  const activeTestId = useStore(state => state.activePerformanceTestId);
  const activeTest = useStore(state => state.performanceHistory.find(h => h.id === state.activePerformanceTestId));
  const addPerformanceTest = useStore(state => state.addPerformanceTest);
  
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState({
    vus: 10,
    durationSec: 30,
    strategy: 'sequential',
  });
  
  const [filterPathIndex, setFilterPathIndex] = useState<string | null>(null);
  
  const [liveMetrics, setLiveMetrics] = useState<MetricsBatch | null>(null);
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetrySnapshot[]>([]);
  const telemetryLogsRef = useRef<TelemetrySnapshot[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [telemetryLogs]);

  const selectedRequests = collections.flatMap(c => c.requests).filter(r => useStore.getState().selectedPerformanceRequestIds.includes(r.id));
  
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    
    const setupListener = async () => {
      try {
        // Only attempt to listen if Tauri IPC is available (avoids crashing in browser previews)
        if (typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window) && !('__TAURI_IPC__' in window)) {
          console.warn("Tauri IPC not found. Load testing telemetry requires running within the Tauri app.");
          return;
        }
        
        unlisten = await listen<MetricsBatch>('load-test-metrics', (event) => {
          const batch = event.payload;
          setLiveMetrics(batch);
          
          if (batch.running) {
          const now = new Date();
          const snapshot = {
            time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`,
            path: selectedRequests.length === 1 ? selectedRequests[0].name : `Multi-target (${selectedRequests.length})`,
            rps: Math.round(batch.rps),
            p50: Math.round(batch.p50_latency_ms),
            p95: Math.round(batch.p95_latency_ms),
            success: batch.success_count,
            error: batch.error_count,
            target_metrics: batch.target_metrics
          };
          
          telemetryLogsRef.current = [...telemetryLogsRef.current, snapshot];
          setTelemetryLogs([...telemetryLogsRef.current]);
        } else {
          setIsRunning(false);
          // Save to history when done
          if (selectedRequests.length > 0 && telemetryLogsRef.current.length > 0) {
            addPerformanceTest({
              id: `test-${Date.now()}`,
              name: selectedRequests.length === 1 ? selectedRequests[0].name : `${selectedRequests.length} API(s)`,
              targetUrl: selectedRequests.length === 1 ? selectedRequests[0].url : 'Multi-target Run',
              timestamp: Date.now(),
              durationSec: config.durationSec,
              vus: config.vus,
              totalRequests: batch.total_requests,
              successCount: batch.success_count,
              errorCount: batch.error_count,
              rps: batch.rps,
              p95LatencyMs: batch.p95_latency_ms,
              telemetryLogs: [...telemetryLogsRef.current]
            });
          }
        }
      });
      } catch (err) {
        console.warn("Could not start Tauri event listener:", err);
      }
    };
    
    setupListener();
    
    return () => {
      if (unlisten) unlisten();
    };
  }, [selectedRequests, config, addPerformanceTest]);

  // Reset state when selection changes
  useEffect(() => {
    if (!isRunning) {
      setLiveMetrics(null);
      setTelemetryLogs([]);
      telemetryLogsRef.current = [];
    }
  }, [selectedRequestIds, activeTestId]);

  const startTest = async () => {
    if (selectedRequests.length === 0) return;
    
    setIsRunning(true);
    setLiveMetrics(null);
    setTelemetryLogs([]);
    telemetryLogsRef.current = [];

    const env = environments.find(e => e.id === activeEnvironmentId);
    
    const targets = [];
    
    for (const req of selectedRequests) {
      let finalUrl = resolveEnvVariables(req.url || '', env);
      if (!finalUrl.startsWith('http')) finalUrl = 'http://' + finalUrl;
      
      const resolvedHeaders = getEnabledRequestHeaders(req);
      const resolvedAuth = req.auth;
      
      if (resolvedAuth?.type === 'bearer') {
        const token = resolvedAuth.bearerTokenInKeychain && resolvedAuth.bearerTokenKeychainRef
          ? await getSecret('request-auth', resolvedAuth.bearerTokenKeychainRef || '')
          : resolvedAuth.bearerToken;
        if (token) {
          resolvedHeaders['Authorization'] = `Bearer ${token}`;
        }
      }

      const { body: reqBody, headers: extraHeaders } = prepareRequestBody(req, env);
      Object.assign(resolvedHeaders, extraHeaders);

      let finalBody: string | null = null;
      if (typeof reqBody === 'string') {
        finalBody = reqBody;
      } else if (reqBody && typeof reqBody.toString === 'function' && !(reqBody instanceof FormData)) {
        finalBody = reqBody.toString();
      }
      
      targets.push({
        url: finalUrl,
        method: req.method,
        headers: resolvedHeaders,
        body: finalBody,
      });
    }

    try {
      await invoke('start_load_test', {
        config: {
          targets,
          strategy: config.strategy,
          vus: config.vus,
          duration_sec: config.durationSec
        }
      });
    } catch (err) {
      console.error("Failed to start load test", err);
      setIsRunning(false);
    }
  };

  const stopTest = async () => {
    try {
      await invoke('stop_load_test');
    } catch (err) {
      console.error("Failed to stop load test", err);
    }
  };

  let chartData = activeTest?.telemetryLogs || [];
  if (filterPathIndex !== null && activeTest?.telemetryLogs) {
    chartData = activeTest.telemetryLogs.map(log => {
      const tm = log.target_metrics?.[parseInt(filterPathIndex)];
      return {
        time: log.time,
        path: log.path,
        p50: tm ? Math.round(tm.p50_latency_ms) : 0,
        p95: tm ? Math.round(tm.p95_latency_ms) : 0,
        success: tm ? tm.success_count : 0,
        error: tm ? tm.error_count : 0,
        rps: tm ? Math.round(tm.rps) : 0,
      };
    });
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-app-bg text-text-primary">
      <div className="flex items-center justify-between px-4 h-[44px] border-b border-border-strong bg-panel-bg shrink-0">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3 shrink-0">
            <Activity className="text-accent" size={16} />
            <h2 className="text-[13px] font-semibold text-text-primary whitespace-nowrap">Load Testing Engine</h2>
          </div>

          <div className="w-[1px] h-4 bg-border-strong shrink-0" />
          <div className="flex items-center space-x-2 text-sm text-text-muted shrink-0">
            <span className="font-medium text-text-primary whitespace-nowrap">
              {selectedRequests.length > 0 ? (selectedRequests.length === 1 ? selectedRequests[0].name : `${selectedRequests.length} selected`) : 'No target selected'}
            </span>
          </div>

          <div className="w-[1px] h-4 bg-border-strong" />
          <div className="shrink-0">
            <EnvironmentSelector onManageClick={() => {}} />
          </div>
        </div>
        
        {isRunning ? (
          <button
            onClick={stopTest}
            className="flex items-center space-x-1.5 px-3 h-[28px] rounded text-[11px] font-medium transition-all shadow-sm bg-red-500/10 text-red-400 hover:bg-red-500/20"
            title="Stop Test Early"
          >
            <StopCircle size={14} />
            <span>Stop Test</span>
          </button>
        ) : (
          <div className="flex items-center space-x-3">
            <button
              onClick={startTest}
              disabled={selectedRequests.length === 0}
              className={`flex items-center space-x-1.5 px-3 h-[28px] rounded text-[11px] font-medium transition-all shadow-sm ${
                selectedRequests.length === 0
                  ? 'opacity-50 cursor-not-allowed bg-surface-hover text-text-muted'
                  : 'bg-accent text-white hover:bg-accent-hover'
              }`}
            >
              <Play size={14} />
              <span>Start Test</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-4 min-h-0">
        {selectedRequests.length === 0 && !activeTestId ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Activity size={48} className="mb-4 opacity-20" />
            <h3 className="text-[13px] font-medium text-text-primary mb-2">High-Performance Load Tester</h3>
            <p className="text-[12px] max-w-sm text-center leading-relaxed">
              Select one or more endpoints from the sidebar to configure Virtual Users (VUs) and simulate load from your local machine.
            </p>
          </div>
        ) : (
          <Group orientation="vertical" className="w-full h-full border border-border-strong rounded-md overflow-hidden bg-panel-bg">
            <Panel defaultSize={60} minSize={30} className="flex flex-col relative bg-app-bg">
              <div className="flex-1 overflow-y-auto flex flex-col">
                
                {/* Configuration Row */}
                <div className="flex items-center space-x-5 bg-panel-bg px-5 py-3 shrink-0 border-b border-border-strong">
                  <div className="flex items-center space-x-2 text-text-muted">
                    <Settings2 size={14} />
                    <span className="text-[11px] font-medium uppercase tracking-wider">Config</span>
                  </div>
                  <div className="w-px h-4 bg-border-strong" />
                  <div className="flex items-center space-x-3">
                    <label className="text-[11px] text-text-secondary">VUs:</label>
                    <input 
                      type="number" 
                      value={config.vus}
                      onChange={e => setConfig({...config, vus: parseInt(e.target.value) || 1})}
                      disabled={isRunning}
                      className="bg-transparent border-b border-border-strong px-1 py-0.5 text-[12px] w-16 focus:outline-none focus:border-accent disabled:opacity-50 text-text-primary text-center font-mono"
                    />
                  </div>
                  <div className="flex items-center space-x-3">
                    <label className="text-[11px] text-text-secondary">Duration (s):</label>
                    <input 
                      type="number" 
                      value={config.durationSec}
                      onChange={e => setConfig({...config, durationSec: parseInt(e.target.value) || 1})}
                      disabled={isRunning}
                      className="bg-transparent border-b border-border-strong px-1 py-0.5 text-[12px] w-16 focus:outline-none focus:border-accent disabled:opacity-50 text-text-primary text-center font-mono"
                    />
                  </div>
                  <div className="w-px h-4 bg-border-strong" />
                  <div className="flex items-center space-x-2">
                    <label className="text-[11px] text-text-secondary">Strategy:</label>
                    <Dropdown
                      value={config.strategy}
                      onChange={val => setConfig({...config, strategy: val})}
                      options={[
                        { value: 'sequential', label: 'Sequential Flow' },
                        { value: 'random', label: 'Random Target' }
                      ]}
                      className="text-[12px] w-32 border-b border-border-strong px-1 py-0.5"
                    />
                  </div>
                  <div className="w-px h-4 bg-border-strong" />
                  <div className="text-[11px] text-text-muted flex-1 truncate">
                    Targeting: <span className="font-mono text-text-primary ml-1">{selectedRequests.length} API(s)</span>
                  </div>
                </div>

                {/* Outcome Chart (Only shown in History mode) */}
                {(!isRunning && !liveMetrics && activeTest && activeTest.telemetryLogs && activeTest.telemetryLogs.length > 0) && (
                  <div className="px-6 py-4 border-b border-border-strong bg-panel-bg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Test Outcome Graph</span>
                      </div>
                      <div className="flex space-x-4 text-[10px] text-text-muted">
                        <div className="flex items-center"><div className="w-2 h-2 rounded bg-green-500/50 mr-1.5"/>Success Count</div>
                        <div className="flex items-center"><div className="w-2 h-2 rounded bg-red-500/50 mr-1.5"/>Error Count</div>
                        <div className="flex items-center"><div className="w-2 h-2 rounded bg-yellow-500/50 mr-1.5"/>Latency (p95 ms)</div>
                      </div>
                    </div>
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--color-method-put)" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="var(--color-method-put)" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--color-method-post)" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="var(--color-method-post)" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorError" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--color-method-delete)" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="var(--color-method-delete)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-strong)" />
                          <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis yAxisId="left" stroke="var(--color-text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis yAxisId="right" orientation="right" stroke="var(--color-text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--color-surface-bg)', border: '1px solid var(--color-border-strong)', fontSize: '11px', color: 'var(--color-text-primary)' }}
                            itemStyle={{ color: 'var(--color-text-secondary)' }}
                            labelStyle={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}
                          />
                          <Area isAnimationActive={false} connectNulls={true} yAxisId="left" type="monotone" dataKey="p95" name="Latency (p95)" stroke="var(--color-method-put)" strokeWidth={1.5} fillOpacity={1} fill="url(#colorLatency)" />
                          <Area isAnimationActive={false} connectNulls={true} yAxisId="right" type="monotone" dataKey="success" name="Success Count" stroke="var(--color-method-post)" strokeWidth={1.5} fillOpacity={1} fill="url(#colorSuccess)" />
                          <Area isAnimationActive={false} connectNulls={true} yAxisId="right" type="monotone" dataKey="error" name="Error Count" stroke="var(--color-method-delete)" strokeWidth={1.5} fillOpacity={1} fill="url(#colorError)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {selectedRequests.length > 1 && (
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-text-muted">
                        <div 
                          className={`flex items-center cursor-pointer transition-colors ${filterPathIndex === null ? 'text-text-primary font-medium' : 'hover:text-text-secondary'}`}
                          onClick={() => setFilterPathIndex(null)}
                        >
                          <div className={`w-2 h-2 rounded-full mr-1.5 ${filterPathIndex === null ? 'bg-accent' : 'bg-border-strong'}`} />
                          All Paths (Global)
                        </div>
                        {selectedRequests.map((req, idx) => (
                          <div 
                            key={req.id}
                            className={`flex items-center cursor-pointer transition-colors ${filterPathIndex === idx.toString() ? 'text-text-primary font-medium' : 'hover:text-text-secondary'}`}
                            onClick={() => setFilterPathIndex(idx.toString())}
                          >
                            <div className={`w-2 h-2 rounded-full mr-1.5 ${filterPathIndex === idx.toString() ? 'bg-accent' : 'bg-border-strong'}`} />
                            {req.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Modern Summary Area */}
                {(isRunning || liveMetrics || activeTest) && (
                  <div className="flex flex-col flex-1 p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center text-[13px]">
                        <span className="text-text-secondary mr-2">Auditing:</span>
                        {selectedRequests.length === 1 ? (
                          <>
                            <span className={`font-bold text-[11px] mr-2 px-1.5 py-0.5 rounded bg-surface-hover ${
                              selectedRequests[0].method === 'GET' ? 'text-blue-400' :
                              selectedRequests[0].method === 'POST' ? 'text-green-400' : 'text-purple-400'
                            }`}>{selectedRequests[0].method}</span>
                            <span className="font-medium text-[14px] tracking-tight">{selectedRequests[0].name}</span>
                          </>
                        ) : (
                          <span className="font-medium text-[14px] tracking-tight">{selectedRequests.length} Requests ({config.strategy})</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-3 text-text-secondary">
                          <span className="text-accent font-bold text-lg">{Math.round(liveMetrics?.rps || activeTest?.rps || 0)} <span className="text-[11px] text-text-muted uppercase font-normal">RPS</span></span>
                        </div>
                        <div className="w-px h-6 bg-border-strong" />
                        <div className={`flex items-center font-medium text-[12px] ${isRunning ? 'text-accent animate-pulse' : 'text-text-secondary'}`}>
                          <Activity size={14} className="mr-2" />
                          {isRunning ? 'Load test in progress...' : 'Historical Result'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Sleek Typography Stats Grid */}
                    <div className="grid grid-cols-5 gap-6 mt-6">
                      <div className="flex flex-col items-start border-l-2 border-border-strong pl-4">
                        <span className="text-[10px] text-text-muted uppercase mb-1.5 font-medium tracking-wider">Total Requests</span>
                        <span className="text-[28px] font-bold font-mono tracking-tight text-text-primary leading-none">{liveMetrics?.total_requests || activeTest?.totalRequests || 0}</span>
                      </div>
                      <div className="flex flex-col items-start border-l-2 border-border-strong pl-4">
                        <span className="text-[10px] text-text-muted uppercase mb-1.5 font-medium tracking-wider">Success <span className="lowercase text-[9px]">(2xx/3xx)</span></span>
                        <span className="text-[28px] font-bold font-mono tracking-tight text-method-post leading-none">{liveMetrics?.success_count || activeTest?.successCount || 0}</span>
                      </div>
                      <div className="flex flex-col items-start border-l-2 border-border-strong pl-4">
                        <span className="text-[10px] text-text-muted uppercase mb-1.5 font-medium tracking-wider">Errors <span className="lowercase text-[9px]">(4xx/5xx)</span></span>
                        <span className="text-[28px] font-bold font-mono tracking-tight text-method-delete leading-none">{liveMetrics?.error_count || activeTest?.errorCount || 0}</span>
                      </div>
                      <div className="flex flex-col items-start border-l-2 border-border-strong pl-4">
                        <span className="text-[10px] text-text-muted uppercase mb-1.5 font-medium tracking-wider">Median Latency</span>
                        <span className="text-[28px] font-bold font-mono tracking-tight text-method-post leading-none">{Math.round(liveMetrics?.p50_latency_ms || 0)}<span className="text-[14px] text-text-muted ml-1">ms</span></span>
                      </div>
                      <div className="flex flex-col items-start border-l-2 border-border-strong pl-4">
                        <span className="text-[10px] text-text-muted uppercase mb-1.5 font-medium tracking-wider">Tail Latency <span className="lowercase text-[9px]">(p95)</span></span>
                        <span className="text-[28px] font-bold font-mono tracking-tight text-method-put leading-none">{Math.round(liveMetrics?.p95_latency_ms || activeTest?.p95LatencyMs || 0)}<span className="text-[14px] text-text-muted ml-1">ms</span></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Panel>

            <Separator className="h-1 bg-transparent hover:bg-accent/20 cursor-row-resize flex items-center justify-center group z-10 transition-colors relative -my-0.5">
              <div className="w-full h-[1px] bg-border-strong group-hover:bg-accent transition-colors" />
            </Separator>

            <Panel defaultSize={40} minSize={20} className="flex flex-col bg-app-bg border-t border-border-strong relative">
              <div className="flex items-center justify-between px-3 py-1.5 bg-panel-bg border-b border-border-strong shrink-0">
                <div className="flex items-center text-[11px] font-medium text-text-muted uppercase tracking-wider">
                  <Terminal size={12} className="mr-1.5" />
                  Telemetry Logs
                </div>
                <div className="text-[10px] text-text-muted">{telemetryLogs.length} events</div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-[1.6]">
                {telemetryLogs.length === 0 ? (
                  <div className="text-text-muted italic opacity-50 text-center mt-4">No telemetry data yet. Run a test to see live logs.</div>
                ) : (
                  <div className="flex flex-col">
                    <div className="grid grid-cols-7 gap-2 text-text-muted border-b border-border-strong pb-1 mb-1 font-bold">
                      <div className="col-span-1">TIME</div>
                      <div className="col-span-1">PATH</div>
                      <div className="col-span-1 text-right">RPS</div>
                      <div className="col-span-1 text-right">p50 (ms)</div>
                      <div className="col-span-1 text-right">p95 (ms)</div>
                      <div className="col-span-1 text-right text-method-post opacity-80">2XX/3XX</div>
                      <div className="col-span-1 text-right text-method-delete opacity-80">4XX/5XX</div>
                    </div>
                    {telemetryLogs.flatMap((log, idx) => {
                      if (selectedRequests.length > 1 && log.target_metrics && Object.keys(log.target_metrics).length > 0) {
                        return selectedRequests.map((req, rIdx) => {
                          const tm = log.target_metrics![rIdx];
                          if (!tm || tm.total_requests === 0) return null;
                          return (
                            <div key={`${idx}-${rIdx}`} className="grid grid-cols-7 gap-2 hover:bg-surface-hover px-1 -mx-1 rounded transition-colors py-0.5">
                              <div className="col-span-1 text-text-secondary">{log.time}</div>
                              <div className="col-span-1 text-text-muted truncate" title={req.name}>{req.name}</div>
                              <div className="col-span-1 text-right text-method-get">{Math.round(tm.rps)}</div>
                              <div className="col-span-1 text-right text-method-post">{Math.round(tm.p50_latency_ms)}</div>
                              <div className="col-span-1 text-right text-method-put">{Math.round(tm.p95_latency_ms)}</div>
                              <div className="col-span-1 text-right text-method-post">{tm.success_count}</div>
                              <div className="col-span-1 text-right text-method-delete">{tm.error_count}</div>
                            </div>
                          );
                        });
                      }
                      
                      return (
                        <div key={idx} className="grid grid-cols-7 gap-2 hover:bg-surface-hover px-1 -mx-1 rounded transition-colors py-0.5">
                          <div className="col-span-1 text-text-secondary">{log.time}</div>
                          <div className="col-span-1 text-text-muted truncate" title={log.path}>{log.path}</div>
                          <div className="col-span-1 text-right text-method-get">{log.rps}</div>
                          <div className="col-span-1 text-right text-method-post">{log.p50}</div>
                          <div className="col-span-1 text-right text-method-put">{log.p95}</div>
                          <div className="col-span-1 text-right text-method-post">{log.success}</div>
                          <div className="col-span-1 text-right text-method-delete">{log.error}</div>
                        </div>
                      );
                    })}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            </Panel>
          </Group>
        )}
      </div>
    </div>
  );
}
