import { useState, useRef } from 'react';
import { Shield, AlertTriangle, CheckCircle2, Info, XCircle, Settings2, Play, ChevronRight, CheckSquare, Square, StopCircle } from 'lucide-react';
import { Dropdown } from './Dropdown';
import { runSecurityAudit } from '../utils/security/engine';
import type { AuditFinding, SecurityAuditContext, RiskLevel, SecurityAuditConfig } from '../utils/security/engine';

interface SecurityPanelProps {
  requestContext: SecurityAuditContext | null;
}

const RiskIcon = ({ risk }: { risk: RiskLevel }) => {
  switch (risk) {
    case 'CRITICAL': return <XCircle size={14} className="text-red-500" />;
    case 'HIGH': return <AlertTriangle size={14} className="text-orange-500" />;
    case 'MEDIUM': return <AlertTriangle size={14} className="text-yellow-500" />;
    case 'LOW': return <Info size={14} className="text-blue-500" />;
    case 'PASS': return <CheckCircle2 size={14} className="text-green-500" />;
  }
};

const RiskBadge = ({ risk }: { risk: RiskLevel }) => {
  const colors = {
    CRITICAL: 'bg-red-500/15 text-red-500 border-red-500/20',
    HIGH: 'bg-orange-500/15 text-orange-500 border-orange-500/20',
    MEDIUM: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/20',
    LOW: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
    PASS: 'bg-green-500/15 text-green-500 border-green-500/20'
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border ${colors[risk]}`}>
      {risk}
    </span>
  );
};

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
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleRunAudit = async () => {
    if (!requestContext) return;

    if (isRunning && abortControllerRef.current) {
      abortControllerRef.current.abort();
      return;
    }

    setIsRunning(true);
    setFindings(null);
    setLogs([]);
    
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
      className="flex items-start space-x-3 p-3 border border-border-subtle rounded-md hover:border-accent/50 cursor-pointer transition-colors"
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
        <div className="flex items-center space-x-2">
          <Shield size={16} className="text-accent" />
          <span className="text-[13px] font-semibold">Security Matrix</span>
        </div>
        
        <div className="flex items-center space-x-3">
          {findings && !isRunning && (
            <button
              onClick={() => setFindings(null)}
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

      {/* Progress Terminal */}
      {isRunning && (
        <div className="flex-1 p-4 bg-[#0a0a0a] overflow-y-auto custom-scrollbar font-mono text-xs flex flex-col space-y-1.5">
          {logs.map((log, i) => (
            <div key={i} className={`flex items-start ${log.includes('[!]') ? 'text-red-400' : log.includes('[✓]') ? 'text-green-400' : log.includes('[-]') ? 'text-text-muted' : 'text-blue-300'}`}>
              <ChevronRight size={14} className="mt-[2px] shrink-0 opacity-50 mr-2" />
              <span className="leading-relaxed">{log}</span>
            </div>
          ))}
          <div className="flex items-center text-blue-300 opacity-50">
            <ChevronRight size={14} className="shrink-0 mr-2" />
            <span className="animate-pulse">_</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {!isRunning && (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
        {!findings && !isRunning ? (
          // Configuration Matrix
          <div className="p-5 max-w-3xl mx-auto space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-1">Audit Configuration</h3>
              <p className="text-xs text-text-secondary">Select the attack vectors to execute against the current endpoint.</p>
            </div>

            <div className="border border-border-strong rounded-md overflow-hidden bg-app-bg shadow-sm">
              <div className="grid grid-cols-[200px_1fr] bg-surface-bg border-b border-border-strong text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                <div className="border-r border-border-strong px-3 py-1.5">Target Auth Header</div>
                <div className="px-3 py-1.5">Secondary Attacker Token (For BOLA)</div>
              </div>
              <div className="grid grid-cols-[200px_1fr]">
                <div className="border-r border-border-strong p-1 h-[32px]">
                  <Dropdown 
                    value={config.authHeaderName} 
                    onChange={val => setConfig({...config, authHeaderName: val})}
                    options={Array.from(new Set([...Object.keys(requestContext?.headers || {}), 'Authorization', 'X-API-Key'])).map(h => ({ value: h, label: h }))}
                    className="w-full h-full text-[13px] font-mono px-2"
                  />
                </div>
                <div className="p-1 h-[32px]">
                  <input 
                    type="text" 
                    value={config.attackerAuthHeader}
                    onChange={e => setConfig({...config, attackerAuthHeader: e.target.value})}
                    disabled={!config.testBOLA}
                    placeholder={config.testBOLA ? "Bearer eyJhbG..." : "Enable BOLA test to enter token..."}
                    className="w-full h-full bg-transparent px-2 text-[13px] font-mono focus:outline-none placeholder-text-muted disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        ) : (findings && (
          // Security Report
          <div className="p-5 max-w-4xl mx-auto space-y-6">
            {/* Scorecard Header */}
            <div className="flex items-center justify-between p-4 bg-surface-bg border border-border-strong rounded-lg">
              <div>
                <h3 className="text-sm font-semibold mb-1">Security Audit Report</h3>
                <p className="text-xs text-text-secondary">Scanned {findings.length} attack vectors across the endpoint.</p>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold font-mono ${criticalCount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {criticalCount > 0 ? `${criticalCount} VULNERABILITIES` : 'SECURE'}
                </div>
                <div className="text-[11px] text-text-muted uppercase tracking-wider mt-1">Status</div>
              </div>
            </div>

            <div className="border border-border-strong rounded-md overflow-hidden bg-app-bg shadow-sm">
              <table className="w-full text-left text-[12px] font-mono border-collapse">
                <thead>
                  <tr className="bg-surface-bg border-b border-border-strong text-[10px] text-text-muted uppercase tracking-wider">
                    <th className="px-4 py-2 w-8"></th>
                    <th className="px-3 py-2 w-[250px]">Attack Vector</th>
                    <th className="px-3 py-2 w-24">Risk</th>
                    <th className="px-3 py-2">Forensic Result</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.map((finding) => (
                    <tr key={finding.id} className="border-b border-border-subtle hover:bg-surface-hover/30 group align-top">
                      <td className="px-4 py-3 pt-[14px]">
                        <RiskIcon risk={finding.risk} />
                      </td>
                      <td className="px-3 py-3 font-semibold text-text-primary text-[13px]">
                        {finding.title}
                      </td>
                      <td className="px-3 py-3">
                        <RiskBadge risk={finding.risk} />
                      </td>
                      <td className="px-3 py-3 space-y-2 max-w-[400px]">
                        <div className="text-text-secondary leading-relaxed">{finding.description}</div>
                        
                        {finding.payloadSent && (
                          <div className="mt-2 text-red-400 bg-[#0a0a0a] p-2 rounded border border-border-strong text-[11px] whitespace-pre-wrap font-mono custom-scrollbar overflow-x-auto">
                            {finding.payloadSent}
                          </div>
                        )}

                        {finding.remediation && finding.risk !== 'PASS' && (
                          <div className="mt-2 text-blue-300 bg-blue-500/10 p-2 rounded border border-blue-500/20 text-[11px] leading-relaxed">
                            <span className="font-semibold uppercase tracking-wider block mb-1 opacity-70">Remediation</span>
                            {finding.remediation}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
