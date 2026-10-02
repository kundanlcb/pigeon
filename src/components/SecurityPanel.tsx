import { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle2, Info, Loader2, XCircle, Settings2, Play, ChevronRight, CheckSquare, Square } from 'lucide-react';
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
  const [progress, setProgress] = useState<string>('');
  const [findings, setFindings] = useState<AuditFinding[] | null>(null);

  const handleRunAudit = async () => {
    if (!requestContext) return;
    setIsRunning(true);
    setFindings(null);
    try {
      const results = await runSecurityAudit(requestContext, config, setProgress);
      setFindings(results);
    } catch (err) {
      setProgress(`Error: ${String(err)}`);
    } finally {
      setIsRunning(false);
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
            disabled={isRunning || !requestContext}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-md text-[13px] font-medium transition-all shadow-sm ${
              isRunning 
                ? 'bg-surface-hover text-text-muted cursor-not-allowed' 
                : 'bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20'
            }`}
          >
            {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            <span>{isRunning ? 'Running Matrix...' : (findings ? 'Re-run Audit' : 'Launch Audit')}</span>
          </button>
        </div>
      </div>

      {/* Progress Log */}
      {isRunning && (
        <div className="p-3 border-b border-border-strong bg-[#0a0a0a] flex items-center space-x-2 text-xs font-mono text-green-400 shrink-0">
          <ChevronRight size={14} className="animate-pulse" />
          <span>[SYSTEM] {progress}</span>
        </div>
      )}

      {/* Main Content Area */}
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

            {/* Findings List */}
            <div className="space-y-4">
              {findings.map((finding) => (
                <div key={finding.id} className="border border-border-strong rounded-md overflow-hidden bg-panel-bg shadow-sm">
                  {/* Card Header */}
                  <div className="flex items-center justify-between p-3 border-b border-border-subtle bg-[#1a1a1a]">
                    <div className="flex items-center space-x-3">
                      <RiskIcon risk={finding.risk} />
                      <span className="text-[13px] font-mono font-semibold text-gray-200">{finding.title}</span>
                    </div>
                    <RiskBadge risk={finding.risk} />
                  </div>
                  
                  {/* Card Body */}
                  <div className="p-4 text-[13px] space-y-4">
                    <div>
                      <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Finding</h4>
                      <p className="text-text-secondary leading-relaxed">{finding.description}</p>
                    </div>
                    
                    {finding.payloadSent && (
                      <div>
                        <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Forensic Evidence (Injected)</h4>
                        <pre className="bg-[#0a0a0a] p-3 rounded border border-border-strong font-mono text-[11px] text-red-400 overflow-x-auto whitespace-pre-wrap">
                          {finding.payloadSent}
                        </pre>
                      </div>
                    )}

                    {finding.remediation && finding.risk !== 'PASS' && (
                      <div>
                        <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Remediation</h4>
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3 text-blue-300 leading-relaxed text-[12px]">
                          {finding.remediation}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
