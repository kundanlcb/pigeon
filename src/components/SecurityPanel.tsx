import { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';
import { runSecurityAudit } from '../utils/security/engine';
import type { AuditFinding, SecurityAuditContext, RiskLevel } from '../utils/security/engine';

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
  const [attackerAuth, setAttackerAuth] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [findings, setFindings] = useState<AuditFinding[]>([]);

  const handleRunAudit = async () => {
    if (!requestContext) return;
    setIsRunning(true);
    setFindings([]);
    try {
      const results = await runSecurityAudit(requestContext, attackerAuth, setProgress);
      setFindings(results);
    } catch (err) {
      setProgress(`Error: ${String(err)}`);
    } finally {
      setIsRunning(false);
    }
  };

  const hasRun = findings.length > 0;
  const criticalCount = findings.filter(f => f.risk === 'CRITICAL' || f.risk === 'HIGH').length;

  return (
    <div className="flex flex-col h-full bg-app-bg text-text-primary overflow-hidden">
      {/* Control Bar */}
      <div className="flex items-center space-x-3 p-3 border-b border-border-strong bg-panel-bg shrink-0">
        <button
          onClick={handleRunAudit}
          disabled={isRunning || !requestContext}
          className={`flex items-center space-x-2 px-4 py-1.5 rounded-md text-[13px] font-medium transition-all shadow-sm ${
            isRunning 
              ? 'bg-surface-hover text-text-muted cursor-not-allowed' 
              : 'bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 border border-blue-500/20'
          }`}
        >
          {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
          <span>{isRunning ? 'Auditing...' : 'Run DevSecOps Audit'}</span>
        </button>

        <div className="h-4 w-px bg-border-strong" />

        <div className="flex-1 flex items-center space-x-2 min-w-0">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider shrink-0">Attacker Auth (BOLA):</span>
          <input
            type="text"
            value={attackerAuth}
            onChange={(e) => setAttackerAuth(e.target.value)}
            placeholder="Bearer eyJhbGciOiJIUzI1..."
            className="flex-1 min-w-0 bg-transparent border border-border-strong rounded px-2 py-1 text-[13px] font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none placeholder-text-muted transition-colors h-[28px]"
          />
        </div>
      </div>

      {/* Progress Log */}
      {isRunning && (
        <div className="p-3 border-b border-border-strong bg-surface-bg flex items-center space-x-2 text-xs font-mono text-text-secondary animate-pulse shrink-0">
          <Loader2 size={12} className="animate-spin text-accent" />
          <span>{progress}</span>
        </div>
      )}

      {/* Results View */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {!hasRun && !isRunning ? (
          <div className="h-full flex flex-col items-center justify-center text-text-muted space-y-4">
            <Shield size={48} className="opacity-20" />
            <div className="text-center">
              <h3 className="text-sm font-medium text-text-primary mb-1">Security & Fuzzing Engine</h3>
              <p className="text-xs max-w-sm leading-relaxed">
                Run an automated penetration test against the current endpoint. 
                Pigeon will mutate the request to test for OWASP vulnerabilities like BOLA, Mass Assignment, and unhandled exceptions.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {hasRun && (
              <div className="flex items-center space-x-2 text-sm font-medium mb-4">
                <span>Audit Complete.</span>
                <span className={criticalCount > 0 ? 'text-red-400' : 'text-green-400'}>
                  Found {findings.length} checks ({criticalCount} critical/high risks).
                </span>
              </div>
            )}

            <div className="space-y-3">
              {findings.map((finding) => (
                <div key={finding.id} className="border border-border-strong rounded-md overflow-hidden bg-panel-bg shadow-sm">
                  {/* Card Header */}
                  <div className="flex items-center justify-between p-3 border-b border-border-subtle bg-surface-bg/50">
                    <div className="flex items-center space-x-3">
                      <RiskIcon risk={finding.risk} />
                      <span className="text-[13px] font-semibold">{finding.title}</span>
                    </div>
                    <RiskBadge risk={finding.risk} />
                  </div>
                  
                  {/* Card Body */}
                  <div className="p-3 text-[13px] space-y-3">
                    <p className="text-text-secondary leading-relaxed">{finding.description}</p>
                    
                    {finding.payloadSent && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Payload Mutated To</span>
                        <pre className="bg-app-bg p-2 rounded border border-border-subtle font-mono text-[11px] text-text-secondary overflow-x-auto whitespace-pre-wrap">
                          {finding.payloadSent}
                        </pre>
                      </div>
                    )}

                    {finding.remediation && finding.risk !== 'PASS' && (
                      <div className="bg-blue-500/5 border border-blue-500/20 rounded p-2 flex space-x-2 mt-2">
                        <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
                        <span className="text-blue-200/80 leading-relaxed text-xs">{finding.remediation}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
