import { useState, useRef } from 'react';
import { Shield, Play, CheckSquare, Square, StopCircle, ChevronRight } from 'lucide-react';
import { useStore } from '../store';
import { runSecurityAudit, type SecurityAuditConfig, type AuditFinding } from '../utils/security/engine';
import { resolveEnvVariables } from '../utils/env';
import { EnvironmentSelector } from './EnvironmentSelector';

interface SecurityHubProps {
  onManageEnvClick: () => void;
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
  const [findings, setFindings] = useState<AuditFinding[] | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startFleetAudit = async () => {
    if (selectedRequestIds.length === 0) return;
    
    setIsRunning(true);
    setLogs(['[*] Initializing DevSecOps Fleet Audit...']);
    setFindings(null);
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    let allFindings: AuditFinding[] = [];

    // Gather all requests from collections that match the selected IDs
    const targetRequests = collections
      .flatMap(col => col.requests)
      .filter(req => selectedRequestIds.includes(req.id));

    setLogs(prev => [...prev, `[*] Target Scope: ${targetRequests.length} endpoints.`]);

    for (const req of targetRequests) {
      if (signal.aborted) break;

      setLogs(prev => [...prev, `\n[*] Starting audit for: ${req.method} ${req.name}`]);

      // Resolve variables for URL and Headers
      const resolvedUrl = resolveEnvVariables(req.url, activeEnvironment);
      
      const resolvedHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers || {})) {
        resolvedHeaders[k] = resolveEnvVariables(v, activeEnvironment);
      }
      
      // Inject Attacker Token if BOLA is enabled and we have it
      if (config.testBOLA && config.attackerAuthHeader) {
        resolvedHeaders[config.authHeaderName] = resolveEnvVariables(config.attackerAuthHeader, activeEnvironment);
      }

      const context = {
        url: resolvedUrl,
        method: req.method,
        headers: resolvedHeaders,
        body: req.body
      };

      try {
        const endpointFindings = await runSecurityAudit(
          context,
          config,
          (msg) => {
            setLogs(prev => [...prev, msg]);
          },
          signal
        );

        // Tag findings with the endpoint name for the fleet report
        const taggedFindings = endpointFindings.map(f => ({
          ...f,
          title: `[${req.name}] ${f.title}`
        }));

        allFindings = [...allFindings, ...taggedFindings];
      } catch (err: any) {
        if (err.name === 'AbortError') {
          setLogs(prev => [...prev, '[-] Audit aborted by user.']);
          break;
        }
        setLogs(prev => [...prev, `[!] Error auditing ${req.name}: ${err.message}`]);
      }
    }

    if (!signal.aborted) {
      setLogs(prev => [...prev, '\n[*] Fleet Audit Completed.']);
    }

    setFindings(allFindings);
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
      <div className="flex items-center justify-between p-4 border-b border-border-strong bg-panel-bg shrink-0">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <Shield className="text-accent" size={20} />
            <h2 className="text-sm font-semibold">DevSecOps Collection Scanner</h2>
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
            className="flex items-center space-x-2 px-6 py-2 rounded-md text-[13px] font-medium transition-all shadow-sm bg-red-500/10 text-red-400 hover:bg-red-500/20"
          >
            <StopCircle size={14} />
            <span>Stop Audit</span>
          </button>
        ) : (
          <button
            onClick={startFleetAudit}
            disabled={selectedRequestIds.length === 0}
            className={`flex items-center space-x-2 px-6 py-2 rounded-md text-[13px] font-medium transition-all shadow-sm ${
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

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-5xl">
          
          {selectedRequestIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-text-muted mt-20">
              <Shield size={48} className="mb-4 opacity-20" />
              <h3 className="text-[13px] font-medium text-text-primary mb-2">Collection-Level Security Audit</h3>
              <p className="text-[12px] max-w-sm text-center leading-relaxed">
                Select target endpoints from the left sidebar to configure the master auth tokens and execute the complete security matrix against them.
              </p>
            </div>
          ) : isRunning || findings ? (
            <div className="space-y-6">
              
              {/* Live Terminal Logs */}
              <div className="bg-panel-bg border border-border-strong rounded-md p-4 font-mono text-[11px] h-[300px] overflow-y-auto custom-scrollbar shadow-sm">
                {logs.map((log, i) => (
                  <div key={i} className={`py-0.5 ${
                    log.includes('[!]') || log.includes('Error') ? 'text-red-400' :
                    log.includes('[✓]') ? 'text-green-400' :
                    log.includes('[-]') ? 'text-text-muted' :
                    'text-text-primary'
                  }`}>
                    <span className="leading-relaxed">{log}</span>
                  </div>
                ))}
                {isRunning && (
                  <div className="flex items-center text-blue-300 opacity-50 mt-2">
                    <ChevronRight size={14} className="shrink-0 mr-2" />
                    <span className="animate-pulse">_</span>
                  </div>
                )}
              </div>

              {/* Audit Findings Report */}
              {findings && (
                <div className="space-y-4 pt-4 border-t border-border-strong">
                  <h3 className="text-sm font-semibold flex items-center">
                    Fleet Audit Report 
                    <span className="ml-3 text-[11px] font-normal px-2 py-0.5 bg-surface-hover rounded text-text-secondary">
                      {findings.filter(f => f.risk !== 'PASS').length} vulnerabilities found
                    </span>
                  </h3>
                  
                  {findings.filter(f => f.risk !== 'PASS').length === 0 ? (
                    <div className="p-6 border border-border-strong rounded-md bg-surface-bg flex flex-col items-center justify-center text-center">
                      <Shield className="text-green-400 mb-3" size={32} />
                      <div className="text-[13px] font-semibold text-green-400">0 Vulnerabilities Found</div>
                      <div className="text-[11px] text-text-secondary mt-1">All scanned endpoints passed the configured security matrix policies.</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {findings.filter(f => f.risk !== 'PASS').map((f, i) => (
                        <div key={i} className={`p-4 border rounded-md bg-surface-bg shadow-sm ${
                          f.risk === 'CRITICAL' ? 'border-red-500/50' :
                          f.risk === 'HIGH' ? 'border-orange-500/50' :
                          f.risk === 'MEDIUM' ? 'border-yellow-500/50' : 'border-border-strong'
                        }`}>
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="text-[13px] font-semibold text-text-primary">{f.title}</div>
                              <div className="text-[10px] text-text-muted mt-0.5 font-mono">{f.category}</div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${
                              f.risk === 'CRITICAL' ? 'bg-red-500/10 text-red-500' :
                              f.risk === 'HIGH' ? 'bg-orange-500/10 text-orange-500' :
                              f.risk === 'MEDIUM' ? 'bg-yellow-500/10 text-yellow-500' :
                              'bg-surface-hover text-text-secondary'
                            }`}>
                              {f.risk}
                            </span>
                          </div>
                          
                          <p className="text-[12px] text-text-secondary leading-relaxed mb-3">
                            {f.description}
                          </p>
                          
                          {f.remediation && (
                            <div className="mt-3 bg-surface-hover p-3 rounded text-[11px]">
                              <span className="font-semibold text-text-primary block mb-1">Recommended Remediation:</span>
                              <span className="text-text-secondary">{f.remediation}</span>
                            </div>
                          )}

                          {f.payloadSent && (
                            <div className="mt-3 text-[10px] font-mono p-3 bg-app-bg border border-border-strong rounded text-text-muted overflow-x-auto">
                              <div className="mb-1 text-[9px] uppercase tracking-wider font-bold">Payload Sent</div>
                              {f.payloadSent}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-10">
              
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
