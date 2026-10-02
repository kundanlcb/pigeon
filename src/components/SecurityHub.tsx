import { useState, useRef, useEffect } from 'react';
import { Shield, Play, CheckSquare, Square, StopCircle, ChevronRight, ChevronDown, Check, AlertTriangle } from 'lucide-react';
import { useStore } from '../store';
import { runSecurityAudit, type SecurityAuditConfig, type AuditFinding } from '../utils/security/engine';
import { resolveEnvVariables } from '../utils/env';
import { EnvironmentSelector } from './EnvironmentSelector';

interface SecurityHubProps {
  onManageEnvClick: () => void;
}

interface RequestFindings {
  requestId: string;
  requestName: string;
  requestMethod: string;
  findings: AuditFinding[];
}

export function SecurityHub({ onManageEnvClick }: SecurityHubProps) {
  const selectedRequestIds = useStore(state => state.selectedSecurityRequestIds);
  const collections = useStore(state => state.collections);
  const environments = useStore(state => state.environments);
  const activeEnvironmentId = useStore(state => state.activeEnvironmentId);
  const activeEnvironment = environments.find(e => e.id === activeEnvironmentId);

  const totalRequests = collections.reduce((sum, col) => sum + col.requests.length, 0);
  
  const [config, setConfig] = useState<SecurityAuditConfig>({
    testBrokenAuth: true,
    testBOLA: false,
    testMassAssignment: true,
    testVerbTampering: true,
    testFuzzing: false,
    authHeaderName: 'Authorization',
    attackerAuthHeader: ''
  });

  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [groupedFindings, setGroupedFindings] = useState<RequestFindings[] | null>(null);
  const [expandedFindingIds, setExpandedFindingIds] = useState<Set<string>>(new Set());
  
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const terminalRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const toggleFindingExpand = (reqId: string) => {
    const next = new Set(expandedFindingIds);
    if (next.has(reqId)) next.delete(reqId);
    else next.add(reqId);
    setExpandedFindingIds(next);
  };

  const startFleetAudit = async () => {
    if (selectedRequestIds.length === 0) return;
    
    setIsRunning(true);
    setLogs(['[*] Initializing DevSecOps Fleet Audit...']);
    setGroupedFindings(null);
    setExpandedFindingIds(new Set());
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    let allGroupedFindings: RequestFindings[] = [];

    const targetRequests = collections
      .flatMap(col => col.requests)
      .filter(req => selectedRequestIds.includes(req.id));

    setProgress({ current: 0, total: targetRequests.length });
    setLogs(prev => [...prev, `[*] Target Scope: ${targetRequests.length} endpoints.`]);

    let currentIndex = 0;
    for (const req of targetRequests) {
      if (signal.aborted) break;
      currentIndex++;
      setProgress({ current: currentIndex, total: targetRequests.length });

      setLogs(prev => [...prev, `__SECTION__STARTING_AUDIT_FOR__[${req.method}] ${req.name}`]);

      const resolvedUrl = resolveEnvVariables(req.url, activeEnvironment);
      const resolvedHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers || {})) {
        resolvedHeaders[k] = resolveEnvVariables(v, activeEnvironment);
      }
      
      if (config.testBOLA && config.attackerAuthHeader) {
        resolvedHeaders[config.authHeaderName] = resolveEnvVariables(config.attackerAuthHeader, activeEnvironment);
      }

      const context = { url: resolvedUrl, method: req.method, headers: resolvedHeaders, body: req.body };

      try {
        const endpointFindings = await runSecurityAudit(
          context,
          config,
          (msg) => setLogs(prev => [...prev, msg]),
          signal
        );

        allGroupedFindings.push({
          requestId: req.id,
          requestName: req.name,
          requestMethod: req.method,
          findings: endpointFindings
        });
      } catch (err: any) {
        if (err.name === 'AbortError') {
          setLogs(prev => [...prev, '[-] Audit aborted by user.']);
          break;
        }
        setLogs(prev => [...prev, `[!] Error auditing ${req.name}: ${err.message}`]);
      }
    }

    if (!signal.aborted) {
      setLogs(prev => [...prev, '__SECTION__COMPLETED__Fleet Audit Completed.']);
    }

    setGroupedFindings(allGroupedFindings);
    setIsRunning(false);
  };

  const stopAudit = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const renderConfigToggle = (label: string, description: string, checked: boolean, onChange: (val: boolean) => void) => (
    <div 
      className="flex items-start space-x-3 py-4 border-b border-border-subtle hover:bg-surface-hover/20 cursor-pointer transition-colors px-2 -mx-2"
      onClick={() => onChange(!checked)}
    >
      <div className="mt-0.5 text-accent">
        {checked ? <CheckSquare size={16} /> : <Square size={16} className="text-text-muted" />}
      </div>
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        <div className="text-[11px] text-text-secondary mt-0.5">{description}</div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-app-bg text-text-primary">
      <div className="flex items-center justify-between px-4 h-[44px] border-b border-border-strong bg-panel-bg shrink-0">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <Shield className="text-accent" size={16} />
            <h2 className="text-[13px] font-semibold text-text-primary">DevSecOps Collection Scanner</h2>
          </div>

          <div className="w-[1px] h-4 bg-border-strong" />
          <div className="flex items-center space-x-2 text-sm text-text-muted shrink-0">
            <span className="font-medium text-text-primary">{selectedRequestIds.length}/{totalRequests} APIs selected</span>
          </div>

          <div className="w-[1px] h-4 bg-border-strong" />
          <div className="shrink-0">
            <EnvironmentSelector onManageClick={onManageEnvClick} />
          </div>
        </div>
        
        {isRunning ? (
          <button
            onClick={stopAudit}
            className="flex items-center space-x-1.5 px-3 h-[28px] rounded-md text-[11px] font-medium transition-all shadow-sm bg-red-500/10 text-red-400 hover:bg-red-500/20"
          >
            <StopCircle size={14} />
            <span>Stop Audit</span>
          </button>
        ) : (
          <button
            onClick={startFleetAudit}
            disabled={selectedRequestIds.length === 0}
            className={`flex items-center space-x-1.5 px-3 h-[28px] rounded-md text-[11px] font-medium transition-all shadow-sm ${
              selectedRequestIds.length === 0
                ? 'opacity-50 cursor-not-allowed bg-surface-hover text-text-muted'
                : 'bg-accent text-white hover:bg-accent-hover'
            }`}
          >
            <Play size={14} />
            <span>Start Audit</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-6">
        <div className={`mx-auto w-full h-full flex flex-col ${isRunning || groupedFindings ? 'max-w-6xl' : 'max-w-5xl'}`}>
          
          {selectedRequestIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-text-muted mt-20">
              <Shield size={48} className="mb-4 opacity-20" />
              <h3 className="text-[13px] font-medium text-text-primary mb-2">Collection-Level Security Audit</h3>
              <p className="text-[12px] max-w-sm text-center leading-relaxed">
                Select target endpoints from the left sidebar to configure the master auth tokens and execute the complete security matrix against them.
              </p>
            </div>
          ) : isRunning || groupedFindings ? (
            <div className="flex-1 flex flex-col min-h-0 space-y-6">
              
              {/* Progress Summary Header */}
              {isRunning && (
                <div className="flex items-center justify-between bg-panel-bg border border-border-strong rounded-md p-4 shrink-0 shadow-sm">
                  <div className="flex flex-col space-y-2 flex-1 mr-8">
                    <div className="flex justify-between text-[12px] font-medium">
                      <span>Auditing endpoint {progress.current} of {progress.total}</span>
                      <span className="text-accent">{Math.round((progress.current / progress.total) * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-app-bg rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent transition-all duration-300"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center text-accent text-[12px] font-semibold animate-pulse">
                    <Shield size={14} className="mr-2" />
                    Audit in progress...
                  </div>
                </div>
              )}

              {/* Layout splits into two blocks if findings exist, or just terminal if running */}
              <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
                
                {/* Terminal / Live Logs */}
                <div className={`flex flex-col ${groupedFindings && !isRunning ? 'hidden' : 'flex-1 lg:w-1/2'} bg-panel-bg border border-border-strong rounded-md overflow-hidden shadow-sm min-h-0`}>
                  <div className="bg-app-bg px-4 py-2 border-b border-border-strong text-[11px] font-bold text-text-muted uppercase tracking-wider flex justify-between items-center shrink-0">
                    <span>Execution Log</span>
                    {isRunning && <span className="flex items-center text-accent"><Play size={10} className="mr-1 animate-pulse" /> Live</span>}
                  </div>
                  <div ref={terminalRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 font-mono text-[11px]">
                    {logs.map((log, i) => {
                      if (log.startsWith('__SECTION__STARTING_AUDIT_FOR__')) {
                        const title = log.replace('__SECTION__STARTING_AUDIT_FOR__', '');
                        return (
                          <div key={i} className="mt-6 mb-2 py-1.5 px-3 bg-accent/10 border-l-2 border-accent text-accent font-bold">
                            Audit Target: {title}
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
                    {isRunning && (
                      <div className="flex items-center text-blue-300 opacity-50 mt-2">
                        <ChevronRight size={14} className="shrink-0 mr-2" />
                        <span className="animate-pulse">_</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Findings List (Row by Row, grouped by Request) */}
                {groupedFindings && (
                  <div className={`flex flex-col flex-1 min-h-0 ${!isRunning ? 'w-full' : 'lg:w-1/2'}`}>
                    <div className="flex items-center justify-between mb-4 shrink-0">
                      <h3 className="text-[14px] font-semibold text-text-primary">Audit Findings</h3>
                      <div className="text-[11px] font-medium text-text-secondary">
                        {groupedFindings.filter(g => g.findings.some(f => f.risk !== 'PASS')).length} endpoints with vulnerabilities
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                      {groupedFindings.map((group) => {
                        const vulns = group.findings.filter(f => f.risk !== 'PASS');
                        const hasVulns = vulns.length > 0;
                        const isExpanded = expandedFindingIds.has(group.requestId);

                        return (
                          <div key={group.requestId} className="flex flex-col">
                            {/* Request Row Header */}
                            <div 
                              onClick={() => hasVulns && toggleFindingExpand(group.requestId)}
                              className={`flex items-center justify-between p-3 rounded-md text-[13px] ${
                                hasVulns ? 'cursor-pointer hover:bg-surface-hover/50' : 'opacity-70'
                              } transition-colors border-b border-border-subtle`}
                            >
                              <div className="flex items-center space-x-3">
                                <div className="w-4 h-4 flex items-center justify-center text-text-muted">
                                  {hasVulns ? (
                                    isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                                  ) : (
                                    <Check size={14} className="text-green-500" />
                                  )}
                                </div>
                                <span className={`font-bold text-[10px] w-12 ${
                                  group.requestMethod === 'GET' ? 'text-blue-400' :
                                  group.requestMethod === 'POST' ? 'text-green-400' :
                                  group.requestMethod === 'PUT' ? 'text-yellow-400' :
                                  group.requestMethod === 'DELETE' ? 'text-red-400' : 'text-purple-400'
                                }`}>{group.requestMethod}</span>
                                <span className={`font-medium ${hasVulns ? 'text-text-primary' : 'text-text-muted'}`}>{group.requestName}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                {hasVulns ? (
                                  <span className="text-[11px] font-bold text-red-400 flex items-center">
                                    <AlertTriangle size={12} className="mr-1.5" />
                                    {vulns.length} Issues
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium text-green-500">Passed</span>
                                )}
                              </div>
                            </div>

                            {/* Collapsed Details Rows */}
                            {isExpanded && hasVulns && (
                              <div className="pl-12 py-2 space-y-4 bg-surface-bg/30 rounded-b-md">
                                {vulns.map((vuln, i) => (
                                  <div key={i} className="py-2 border-b border-border-subtle last:border-0 pr-4">
                                    <div className="flex items-center space-x-3 mb-1">
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                        vuln.risk === 'CRITICAL' ? 'bg-red-500/10 text-red-500' :
                                        vuln.risk === 'HIGH' ? 'bg-orange-500/10 text-orange-500' :
                                        'bg-yellow-500/10 text-yellow-500'
                                      }`}>
                                        {vuln.risk}
                                      </span>
                                      <span className="text-[12px] font-semibold text-text-primary">{vuln.title}</span>
                                      <span className="text-[10px] text-text-muted font-mono bg-surface-hover px-1.5 py-0.5 rounded">{vuln.category}</span>
                                    </div>
                                    <div className="text-[12px] text-text-secondary leading-relaxed pl-[1px] mt-2 mb-3">
                                      {vuln.description}
                                    </div>
                                    {vuln.remediation && (
                                      <div className="text-[11px] pl-[1px] mt-1.5 text-text-secondary flex items-start">
                                        <Shield size={12} className="mr-1.5 mt-0.5 text-accent shrink-0" />
                                        <span><strong className="text-text-primary font-medium">Remediation:</strong> {vuln.remediation}</span>
                                      </div>
                                    )}
                                    {vuln.payloadSent && (
                                      <div className="mt-2 text-[10px] font-mono text-text-muted">
                                        <span className="text-[9px] uppercase tracking-wider font-bold block mb-1">Payload / Headers Sent:</span>
                                        {vuln.payloadSent}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {groupedFindings.length === 0 && (
                        <div className="text-[12px] text-text-muted text-center py-10">No findings to display.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-10 overflow-y-auto h-full pb-10">
              
              {/* Authentication Context */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-text-primary">1. Global Authentication Context</h3>
                </div>
                <div className="border border-border-strong rounded-md overflow-hidden bg-surface-bg shadow-sm">
                  <div className="grid grid-cols-[250px_1fr] border-b border-border-strong text-[11px] font-medium text-text-muted bg-panel-bg">
                    <div className="border-r border-border-strong px-4 py-2">Master Auth Header (e.g. Authorization)</div>
                    <div className="px-4 py-2">Secondary Attacker Token (For BOLA)</div>
                  </div>
                  <div className="grid grid-cols-[250px_1fr]">
                    <div className="border-r border-border-strong h-[40px]">
                      <input 
                        type="text" 
                        value={config.authHeaderName}
                        onChange={e => setConfig({...config, authHeaderName: e.target.value})}
                        placeholder="Authorization"
                        className="w-full h-full bg-transparent px-4 text-[13px] font-mono focus:outline-none placeholder-text-muted transition-colors"
                      />
                    </div>
                    <div className="h-[40px]">
                      <input 
                        type="text" 
                        value={config.attackerAuthHeader}
                        onChange={e => setConfig({...config, attackerAuthHeader: e.target.value})}
                        disabled={!config.testBOLA}
                        placeholder={config.testBOLA ? "Bearer eyJhbG..." : "Enable BOLA test to enter token..."}
                        className="w-full h-full bg-transparent px-4 text-[13px] font-mono focus:outline-none placeholder-text-muted disabled:opacity-50 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Policies Matrix */}
              <div className="space-y-4">
                <h3 className="text-[13px] font-semibold text-text-primary">2. Security Matrix Policies</h3>
                <div className="border border-border-strong rounded-md bg-surface-bg p-4 flex flex-col shadow-sm">
                  {renderConfigToggle(
                    "Broken Authentication", 
                    `Strips ${config.authHeaderName} headers to ensure endpoint rejects unauthenticated access.`, 
                    config.testBrokenAuth,  
                    (v) => setConfig({ ...config, testBrokenAuth: v })
                  )}
                  {renderConfigToggle(
                    "Broken Object Level Auth (BOLA)", 
                    "Tests if a different user can access this resource. Requires a secondary token.", 
                    config.testBOLA, 
                    (v) => setConfig({ ...config, testBOLA: v })
                  )}
                  {renderConfigToggle(
                    "Mass Assignment", 
                    "Injects elevated privilege properties (e.g. is_admin) into JSON payloads.", 
                    config.testMassAssignment, 
                    (v) => setConfig({ ...config, testMassAssignment: v })
                  )}
                  {renderConfigToggle(
                    "Verb Tampering", 
                    "Attempts to bypass routing restrictions using alternate HTTP methods.", 
                    config.testVerbTampering, 
                    (v) => setConfig({ ...config, testVerbTampering: v })
                  )}
                  {renderConfigToggle(
                    "1-Click Fuzzer", 
                    "Fires malformed payloads and edge-cases to detect 500 Internal Server Errors.", 
                    config.testFuzzing, 
                    (v) => setConfig({ ...config, testFuzzing: v })
                  )}
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
