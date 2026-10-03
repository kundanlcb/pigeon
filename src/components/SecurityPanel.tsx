import { useState, useRef, useEffect } from 'react';
import { Shield, Settings2, Play, CheckSquare, Square, StopCircle } from 'lucide-react';
import { SecurityOutcomeUI } from './SecurityOutcomeUI';
import { Dropdown } from './Dropdown';
import { runSecurityAudit } from '../utils/security/engine';
import type { AuditFinding, SecurityAuditContext, SecurityAuditConfig } from '../utils/security/engine';

interface SecurityPanelProps {
  requestContext: SecurityAuditContext | null;
}

export function SecurityPanel({ requestContext }: SecurityPanelProps) {
  const [config, setConfig] = useState<SecurityAuditConfig>({
    authHeaderName: 'Authorization',
    testBOLA: false,
    attackerAuthHeader: '',
    testBrokenAuth: true,
    testMassAssignment: true,
    testVerbTampering: true,
    testFuzzing: true
  });
  
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [findings, setFindings] = useState<AuditFinding[] | null>(null);
  const [isLogsExpanded, setIsLogsExpanded] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [expandedFindingIds, setExpandedFindingIds] = useState<Set<string>>(new Set(['single-request']));
  const toggleFindingExpand = (reqId: string) => {
    const next = new Set(expandedFindingIds);
    if (next.has(reqId)) next.delete(reqId);
    else next.add(reqId);
    setExpandedFindingIds(next);
  };

  const groupedFindings = findings ? [{
    requestId: 'single-request',
    requestName: requestContext?.url || 'Current Request',
    requestMethod: requestContext?.method || 'GET',
    findings
  }] : null;

  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const handleRunAudit = async () => {
    if (!requestContext) return;

    if (isRunning && abortControllerRef.current) {
      abortControllerRef.current.abort();
      return;
    }

    setIsRunning(true);
    setFindings(null);
    setLogs(['[*] Initializing DevSecOps Audit for current request...']);
    setIsLogsExpanded(false);
    
    abortControllerRef.current = new AbortController();

    try {
      const results = await runSecurityAudit(
        requestContext, 
        config, 
        (msg) => setLogs(prev => [...prev, msg]),
        abortControllerRef.current.signal
      );
      setFindings(results);
    } catch (err: any) {
      setLogs(prev => [...prev, `[!] Audit Aborted: ${err.message || String(err)}`]);
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const criticalCount = findings?.filter(f => f.risk === 'CRITICAL' || f.risk === 'HIGH').length || 0;

  
  
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
    <div className="flex flex-col h-full bg-app-bg text-text-primary overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border-strong bg-panel-bg shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Shield size={16} className="text-accent" />
            <span className="text-[13px] font-semibold">Security Matrix</span>
          </div>
          {findings && !isRunning && (
            <div className="flex items-center space-x-3 px-3 border-l border-border-strong">
              <span className="text-[11px] text-text-secondary">Scanned {findings.length} vectors</span>
              <span className={`text-[13px] font-medium ${criticalCount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {criticalCount > 0 ? `${criticalCount} vulnerabilities` : 'Secure'}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          {findings && !isRunning && (
            <button
              onClick={() => { setFindings(null); setIsLogsExpanded(false); }}
              className="text-[12px] font-medium text-text-secondary hover:text-text-primary flex items-center space-x-1"
            >
              <Settings2 size={14} />
              <span>Configure</span>
            </button>
          )}
          
          <button
            onClick={handleRunAudit}
            disabled={!requestContext && !isRunning}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-md text-[13px] font-medium transition-all shadow-sm ${
              isRunning 
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20' 
                : 'bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20'
            }`}
          >
            {isRunning ? <StopCircle size={14} className="animate-pulse" /> : <Play size={14} />}
            <span>{isRunning ? 'Stop Audit' : (findings ? 'Re-run Audit' : 'Launch Audit')}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-4">
        {!findings && !isRunning ? (
          // Configuration Matrix
          <div className="w-full flex flex-col h-full overflow-y-auto custom-scrollbar">
            <div className="space-y-6 w-full">
              <div>
                <h3 className="text-sm font-semibold mb-1">Audit Configuration</h3>
                <p className="text-xs text-text-secondary">Select the attack vectors to execute against the current endpoint.</p>
              </div>

              <div className="border border-border-strong rounded-md overflow-hidden bg-surface-bg shadow-sm">
                <div className="grid grid-cols-[200px_1fr] border-b border-border-strong text-[11px] font-medium text-text-muted bg-panel-bg">
                  <div className="border-r border-border-strong px-4 py-2">Target Auth Header</div>
                  <div className="px-4 py-2">Secondary Attacker Token (For BOLA)</div>
                </div>
                <div className="grid grid-cols-[200px_1fr]">
                  <div className="border-r border-border-strong h-[36px]">
                    <Dropdown 
                      value={config.authHeaderName} 
                      onChange={val => setConfig({...config, authHeaderName: val})}
                      options={Array.from(new Set([...Object.keys(requestContext?.headers || {}), 'Authorization', 'X-API-Key'])).map(h => ({ value: h, label: h }))}
                      className="w-full h-full text-[13px] font-mono px-4 !border-0 !rounded-none bg-transparent"
                    />
                  </div>
                  <div className="h-[36px]">
                    <input 
                      type="text" 
                      value={config.attackerAuthHeader}
                      onChange={e => setConfig({...config, attackerAuthHeader: e.target.value})}
                      disabled={!config.testBOLA}
                      placeholder={config.testBOLA ? "Bearer eyJhbG..." : "Enable BOLA test to enter token..."}
                      className="w-full h-full bg-transparent px-4 text-[13px] font-mono focus:outline-none placeholder-text-muted disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-0">
                {renderConfigToggle(
                  "Broken Authentication", 
                  `Strips ${config.authHeaderName} headers to ensure endpoint rejects unauthenticated access.`, 
                  config.testBrokenAuth,  
                  (v) => setConfig({ ...config, testBrokenAuth: v })
                )}
                
                {renderConfigToggle(
                  "Broken Object Level Auth (BOLA)", 
                  "Tests if a different user can access this resource. Requires a secondary token above.", 
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
        ) : (
          <div className="flex-1 flex flex-col gap-6 min-h-0 w-full h-full">
                          <SecurityOutcomeUI 
                isRunning={isRunning}
                logs={logs}
                groupedFindings={groupedFindings}
                isLogsExpanded={isLogsExpanded}
                setIsLogsExpanded={setIsLogsExpanded}
                expandedFindingIds={expandedFindingIds}
                toggleFindingExpand={toggleFindingExpand}
              />
</div>
        )}
      </div>
    </div>
  );
}
