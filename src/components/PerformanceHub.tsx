import { useState, useEffect, useRef } from 'react';
import { Activity, Play, StopCircle, Settings2 } from 'lucide-react';
import { useStore } from '../store';
import { EnvironmentSelector } from './EnvironmentSelector';
import { invoke } from '@tauri-apps/api/core';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { listen } from '@tauri-apps/api/event';
import { getEnabledRequestHeaders, prepareRequestBody } from '../utils/request';
import { resolveEnvVariables } from '../utils/env';
import { getSecret } from '../utils/secrets';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

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
}

interface ChartDataPoint {
  time: string;
  rps: number;
  p50: number;
  p95: number;
}

export function PerformanceHub() {
  const collections = useStore(state => state.collections);
  const environments = useStore(state => state.environments);
  const activeEnvironmentId = useStore(state => state.activeEnvironmentId);
  const selectedRequestId = useStore(state => state.selectedPerformanceRequestId);
  const activeTestId = useStore(state => state.activePerformanceTestId);
  const addPerformanceTest = useStore(state => state.addPerformanceTest);
  
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState({
    vus: 10,
    durationSec: 30,
  });
  
  const [liveMetrics, setLiveMetrics] = useState<MetricsBatch | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const chartDataRef = useRef<ChartDataPoint[]>([]);

  const selectedRequest = collections.flatMap(c => c.requests).find(r => r.id === selectedRequestId);
  
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    
    const setupListener = async () => {
      unlisten = await listen<MetricsBatch>('load-test-metrics', (event) => {
        const batch = event.payload;
        setLiveMetrics(batch);
        
        if (batch.running) {
          const now = new Date();
          const point = {
            time: `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`,
            rps: Math.round(batch.rps),
            p50: Math.round(batch.p50_latency_ms),
            p95: Math.round(batch.p95_latency_ms),
          };
          
          chartDataRef.current = [...chartDataRef.current.slice(-60), point];
          setChartData([...chartDataRef.current]);
        } else {
          setIsRunning(false);
          // Save to history when done
          if (selectedRequest && chartDataRef.current.length > 0) {
            addPerformanceTest({
              id: `test-${Date.now()}`,
              name: selectedRequest.name,
              targetUrl: selectedRequest.url,
              timestamp: Date.now(),
              durationSec: config.durationSec,
              vus: config.vus,
              totalRequests: batch.total_requests,
              successCount: batch.success_count,
              errorCount: batch.error_count,
              rps: batch.rps,
              p95LatencyMs: batch.p95_latency_ms
            });
          }
        }
      });
    };
    
    setupListener();
    
    return () => {
      if (unlisten) unlisten();
    };
  }, [selectedRequest, config, addPerformanceTest]);

  // Reset state when selection changes
  useEffect(() => {
    if (!isRunning) {
      setLiveMetrics(null);
      setChartData([]);
      chartDataRef.current = [];
    }
  }, [selectedRequestId, activeTestId]);

  const startTest = async () => {
    if (!selectedRequest) return;
    
    setIsRunning(true);
    setLiveMetrics(null);
    setChartData([]);
    chartDataRef.current = [];

    const env = environments.find(e => e.id === activeEnvironmentId);
    let finalUrl = resolveEnvVariables(selectedRequest.url || '', env);
    if (!finalUrl.startsWith('http')) finalUrl = 'http://' + finalUrl;
    
    const resolvedHeaders = getEnabledRequestHeaders(selectedRequest);
    const resolvedAuth = selectedRequest.auth;
    
    // Quick Auth header if Bearer
    if (resolvedAuth?.type === 'bearer') {
      const token = resolvedAuth.bearerTokenInKeychain && resolvedAuth.bearerTokenKeychainRef
        ? await getSecret('request-auth', resolvedAuth.bearerTokenKeychainRef || '')
        : resolvedAuth.bearerToken;
      if (token) {
        resolvedHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    const { body: reqBody, headers: extraHeaders } = prepareRequestBody(selectedRequest, env);
    Object.assign(resolvedHeaders, extraHeaders);

    let finalBody: string | null = null;
    if (typeof reqBody === 'string') {
      finalBody = reqBody;
    } else if (reqBody && typeof reqBody.toString === 'function' && !(reqBody instanceof FormData)) {
      finalBody = reqBody.toString();
    }

    try {
      await invoke('start_load_test', {
        config: {
          url: finalUrl,
          method: selectedRequest.method,
          headers: resolvedHeaders,
          body: finalBody,
          vus: config.vus,
          duration_sec: config.durationSec
        }
      });
    } catch (err) {
      console.error("Failed to start load test", err);
      setIsRunning(false);
    }
  };

  const stopTest = () => {
    // We could invoke a stop command here, but currently our Rust backend listens to a duration or dropping.
    // To cleanly stop early, we would need to add a stop_load_test command.
    // For now, it will stop automatically after duration.
  };

  const renderMetricBox = (label: string, value: string | number, colorClass: string = "text-text-primary") => (
    <div className="bg-panel-bg border border-border-strong rounded-md p-4 flex flex-col justify-center items-center shadow-sm">
      <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">{label}</span>
      <span className={`text-2xl font-bold ${colorClass}`}>{value}</span>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-app-bg text-text-primary">
      <div className="flex items-center justify-between px-4 h-[44px] border-b border-border-strong bg-panel-bg shrink-0">
        <div className="flex items-center space-x-6 overflow-hidden">
          <div className="flex items-center space-x-3 shrink-0">
            <Activity className="text-accent" size={16} />
            <h2 className="text-[13px] font-semibold text-text-primary whitespace-nowrap">Load Testing Engine</h2>
          </div>

          <div className="w-[1px] h-4 bg-border-strong shrink-0" />
          <div className="flex items-center space-x-2 text-sm text-text-muted shrink-0">
            <span className="font-medium text-text-primary whitespace-nowrap">
              {selectedRequest ? selectedRequest.name : 'No target selected'}
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
            disabled
            className="flex items-center space-x-1.5 px-3 h-[28px] rounded text-[11px] font-medium transition-all shadow-sm bg-red-500/10 text-red-400 opacity-50 cursor-not-allowed"
            title="Early stopping not implemented yet"
          >
            <StopCircle size={14} />
            <span>Running...</span>
          </button>
        ) : (
          <div className="flex items-center space-x-3">
            <button
              onClick={startTest}
              disabled={!selectedRequest}
              className={`flex items-center space-x-1.5 px-3 h-[28px] rounded text-[11px] font-medium transition-all shadow-sm ${
                !selectedRequest
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

      <div className="flex-1 overflow-hidden flex flex-col p-6 min-h-0">
        {!selectedRequest && !activeTestId ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted mt-20">
            <Activity size={48} className="mb-4 opacity-20" />
            <h3 className="text-[13px] font-medium text-text-primary mb-2">High-Performance Load Tester</h3>
            <p className="text-[12px] max-w-sm text-center leading-relaxed">
              Select a target endpoint from the sidebar to configure Virtual Users (VUs) and bombard it directly from your local machine.
            </p>
          </div>
        ) : (
          <div className="flex flex-col h-full space-y-6">
            {/* Configuration Row */}
            <div className="flex items-center space-x-4 bg-panel-bg border border-border-strong rounded-md p-4 shrink-0 shadow-sm">
              <Settings2 size={16} className="text-text-muted" />
              <div className="flex items-center space-x-2">
                <label className="text-[12px] font-medium text-text-secondary">Virtual Users:</label>
                <input 
                  type="number" 
                  value={config.vus}
                  onChange={e => setConfig({...config, vus: parseInt(e.target.value) || 1})}
                  disabled={isRunning}
                  className="bg-surface-bg border border-border-strong rounded px-2 py-1 text-[12px] w-20 focus:outline-none focus:border-accent disabled:opacity-50"
                />
              </div>
              <div className="w-px h-4 bg-border-strong" />
              <div className="flex items-center space-x-2">
                <label className="text-[12px] font-medium text-text-secondary">Duration (sec):</label>
                <input 
                  type="number" 
                  value={config.durationSec}
                  onChange={e => setConfig({...config, durationSec: parseInt(e.target.value) || 1})}
                  disabled={isRunning}
                  className="bg-surface-bg border border-border-strong rounded px-2 py-1 text-[12px] w-20 focus:outline-none focus:border-accent disabled:opacity-50"
                />
              </div>
              <div className="w-px h-4 bg-border-strong" />
              <div className="text-[11px] text-text-muted flex-1">
                Targeting: <span className="font-mono text-text-primary">{selectedRequest?.url || 'History Mode'}</span>
              </div>
            </div>

            {/* Metrics Dashboard */}
            {(liveMetrics || chartData.length > 0) && (
              <div className="flex-1 flex flex-col min-h-0 space-y-6">
                
                {/* Top Stats */}
                <div className="grid grid-cols-4 gap-4 shrink-0">
                  {renderMetricBox("Total Requests", liveMetrics?.total_requests || 0)}
                  {renderMetricBox("RPS (Avg)", Math.round(liveMetrics?.rps || 0), "text-blue-400")}
                  {renderMetricBox("Errors", liveMetrics?.error_count || 0, liveMetrics?.error_count ? "text-red-400" : "text-green-500")}
                  {renderMetricBox("p95 Latency", `${Math.round(liveMetrics?.p95_latency_ms || 0)}ms`, "text-yellow-400")}
                </div>

                {/* Charts Area */}
                <div className="flex-1 min-h-0 bg-panel-bg border border-border-strong rounded-md p-4 shadow-sm flex flex-col">
                  <h3 className="text-[12px] font-medium text-text-secondary uppercase tracking-wider mb-4">Real-Time Telemetry</h3>
                  
                  <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
                    <div className="flex-1 min-h-0 flex flex-col">
                      <h4 className="text-[11px] font-medium text-text-muted mb-2 text-center">Requests Per Second (RPS)</h4>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorRps" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#60A5FA" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                          <XAxis dataKey="time" stroke="#ffffff30" fontSize={10} tickMargin={10} />
                          <YAxis stroke="#ffffff30" fontSize={10} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', fontSize: '11px' }}
                            itemStyle={{ color: '#60A5FA' }}
                          />
                          <Area type="monotone" dataKey="rps" stroke="#60A5FA" fillOpacity={1} fill="url(#colorRps)" strokeWidth={2} isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex-1 min-h-0 flex flex-col">
                      <h4 className="text-[11px] font-medium text-text-muted mb-2 text-center">Latency (ms)</h4>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                          <XAxis dataKey="time" stroke="#ffffff30" fontSize={10} tickMargin={10} />
                          <YAxis stroke="#ffffff30" fontSize={10} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', fontSize: '11px' }}
                          />
                          <Line type="monotone" dataKey="p95" name="p95" stroke="#FBBF24" strokeWidth={2} dot={false} isAnimationActive={false} />
                          <Line type="monotone" dataKey="p50" name="p50" stroke="#34D399" strokeWidth={2} dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
