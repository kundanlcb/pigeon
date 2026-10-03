import { useRef, useEffect } from 'react';
import { Play, ChevronDown, ChevronRight, Check, AlertTriangle, Download, Shield } from 'lucide-react';
import type { AuditFinding } from '../utils/security/engine';

export interface RequestFindings {
  requestId: string;
  requestName: string;
  requestMethod: string;
  findings: AuditFinding[];
}

interface SecurityOutcomeUIProps {
  isRunning: boolean;
  logs: string[];
  groupedFindings: RequestFindings[] | null;
  isLogsExpanded: boolean;
  setIsLogsExpanded: (val: boolean) => void;
  expandedFindingIds: Set<string>;
  toggleFindingExpand: (reqId: string) => void;
  exportReport?: () => void;
}

const renderLogWithHighlightedPaths = (log: string) => {
  // Split on anything that looks like a URL path or full URL
  // e.g. /api/users, /auth/login, https://example.com/api
  const parts = log.split(/((?:https?:\/\/[^\s"']+)|(?:\/[a-zA-Z0-9_\-./?&=]+))/g);
  return parts.map((part, i) => {
    if (part.startsWith('/') || part.startsWith('http')) {
      return <span key={i} className="text-blue-400 font-semibold">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
};

export function SecurityOutcomeUI({
  isRunning,
  logs,
  groupedFindings,
  isLogsExpanded,
  setIsLogsExpanded,
  expandedFindingIds,
  toggleFindingExpand,
  exportReport
}: SecurityOutcomeUIProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex-1 flex flex-col gap-6 min-h-0 w-full h-full">
      {/* Terminal / Live Logs */}
      <div className={`flex flex-col ${(!isRunning && groupedFindings && !isLogsExpanded) ? 'hidden' : 'flex-1'} bg-panel-bg border border-border-strong rounded-md overflow-hidden shadow-sm min-h-0`}>
        <div className="bg-app-bg px-4 py-2 border-b border-border-strong text-[11px] font-bold text-text-muted uppercase tracking-wider flex justify-between items-center shrink-0">
          <span>Execution Log</span>
          <div className="flex items-center space-x-3">
            {isRunning && <span className="flex items-center text-accent"><Play size={10} className="mr-1 animate-pulse" /> Live</span>}
            {!isRunning && isLogsExpanded && (
              <button
                onClick={() => setIsLogsExpanded(false)}
                className="flex items-center space-x-1 text-[10px] font-medium text-text-secondary hover:text-text-primary transition-colors bg-surface-hover/50 px-2 py-1 rounded"
              >
                <ChevronDown size={12} />
                <span>Back to Findings</span>
              </button>
            )}
          </div>
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
                <span className="leading-relaxed whitespace-pre-wrap">{renderLogWithHighlightedPaths(log)}</span>
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
      {(groupedFindings && (!isLogsExpanded || isRunning)) && (
        <div className={`flex flex-col flex-1 min-h-0 w-full bg-panel-bg border border-border-strong rounded-md overflow-hidden shadow-sm`}>
          <div className="bg-app-bg px-4 py-2 border-b border-border-strong text-[11px] font-bold text-text-muted uppercase tracking-wider flex justify-between items-center shrink-0">
            <span>Audit Findings</span>
            <div className="flex items-center space-x-3 text-[11px] font-medium text-text-secondary normal-case tracking-normal">
              {(() => {
                let critical = 0, high = 0, medium = 0, low = 0, affected = 0;
                groupedFindings.forEach(g => {
                  const vulns = g.findings.filter(f => f.risk !== 'PASS');
                  if (vulns.length > 0) affected++;
                  vulns.forEach(v => {
                    if (v.risk === 'CRITICAL') critical++;
                    else if (v.risk === 'HIGH') high++;
                    else if (v.risk === 'MEDIUM') medium++;
                    else if (v.risk === 'LOW') low++;
                  });
                });
                
                return (
                  <>
                    {critical > 0 && <span className="text-purple-400">{critical} Critical</span>}
                    {high > 0 && <span className="text-red-400">{high} High</span>}
                    {medium > 0 && <span className="text-yellow-400">{medium} Medium</span>}
                    {low > 0 && <span className="text-blue-400">{low} Low</span>}
                    {(critical > 0 || high > 0 || medium > 0 || low > 0) && <span className="opacity-40">|</span>}
                    <span>{affected} {affected === 1 ? 'endpoint' : 'endpoints'} affected</span>
                    {exportReport && (
                      <>
                        <div className="w-px h-3 bg-border-strong mx-1" />
                        <button
                          onClick={exportReport}
                          className="flex items-center space-x-1.5 px-2 py-1 rounded text-[11px] font-medium transition-all bg-surface-bg text-text-secondary border border-border-strong hover:bg-surface-hover hover:text-text-primary normal-case"
                        >
                          <Download size={12} />
                          <span>Export</span>
                        </button>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {groupedFindings.length === 0 && (
              <div className="text-[12px] text-text-muted text-center py-10">No findings to display.</div>
            )}
            {groupedFindings.map((group) => {
              const vulns = group.findings.filter(f => f.risk !== 'PASS');
              const hasVulns = vulns.length > 0;
              const isExpanded = expandedFindingIds.has(group.requestId);

              return (
                <div key={group.requestId} className="flex flex-col border-b border-border-subtle last:border-b-0">
                  {/* Request Row Header */}
                  <div 
                    onClick={() => hasVulns && toggleFindingExpand(group.requestId)}
                    className={`flex items-center justify-between p-3 rounded-md text-[13px] ${
                      hasVulns ? 'cursor-pointer hover:bg-surface-hover/50' : 'opacity-70'
                    } transition-colors`}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0 mr-4">
                      <div className="w-4 h-4 flex items-center justify-center text-text-muted shrink-0">
                        {hasVulns ? (
                          isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                        ) : (
                          <Check size={14} className="text-green-500" />
                        )}
                      </div>
                      <span className={`font-bold text-[10px] shrink-0 ${
                        group.requestMethod === 'GET' ? 'text-blue-400' :
                        group.requestMethod === 'POST' ? 'text-green-400' :
                        group.requestMethod === 'PUT' ? 'text-yellow-400' :
                        group.requestMethod === 'DELETE' ? 'text-red-400' : 'text-purple-400'
                      }`}>{group.requestMethod}</span>
                      <span className={`font-medium truncate ${hasVulns ? 'text-text-primary' : 'text-text-muted'}`}>{group.requestName}</span>
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
                            <div className="mt-3">
                              <span className="text-[9px] uppercase tracking-wider font-bold block mb-1.5 text-text-muted">Payload / Headers Sent:</span>
                              <div className="bg-app-bg border border-border-strong rounded p-3 text-[10.5px] font-mono text-text-secondary whitespace-pre-wrap overflow-x-auto shadow-inner">
                                {vuln.payloadSent}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {!isRunning && groupedFindings && !isLogsExpanded && (
            <div className="p-2 border-t border-border-strong bg-app-bg shrink-0 flex justify-center">
              <button
                onClick={() => setIsLogsExpanded(true)}
                className="flex items-center space-x-1.5 text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors py-1"
              >
                <ChevronRight size={14} />
                <span>View Raw Execution Logs</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
