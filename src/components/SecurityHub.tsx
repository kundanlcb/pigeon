import { useState, useRef, useEffect } from 'react';
import { SecurityOutcomeUI, type RequestFindings } from './SecurityOutcomeUI';
import { Shield, Play, CheckSquare, Square, StopCircle } from 'lucide-react';
import { useStore } from '../store';
import { runSecurityAudit, type SecurityAuditConfig } from '../utils/security/engine';
import { resolveEnvVariables } from '../utils/env';
import { EnvironmentSelector } from './EnvironmentSelector';
import { DangerConfirmationModal } from './DangerConfirmationModal';

interface SecurityHubProps {
  onManageEnvClick: () => void;
}

export function SecurityHub({ onManageEnvClick }: SecurityHubProps) {
  const selectedRequestIds = useStore(state => state.selectedSecurityRequestIds);
  const collections = useStore(state => state.collections);
  const environments = useStore(state => state.environments);
  const activeEnvironmentId = useStore(state => state.activeEnvironmentId);
  const activeEnvironment = environments.find(e => e.id === activeEnvironmentId);
  const activeSecurityScanId = useStore(state => state.activeSecurityScanId);
  const securityHistory = useStore(state => state.securityHistory);
  const addSecurityScan = useStore(state => state.addSecurityScan);
  const setActiveSecurityScanId = useStore(state => state.setActiveSecurityScanId);

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
  const [isLogsExpanded, setIsLogsExpanded] = useState(false);
  
  const [progress, setProgress] = useState({ current: 0, total: 0, currentName: '', currentMethod: '', currentUrl: '' });
  const terminalRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTargetUrls, setModalTargetUrls] = useState<string[]>([]);
  const [modalExpectedMatch, setModalExpectedMatch] = useState('');

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (activeSecurityScanId) {
      const scan = securityHistory.find(s => s.id === activeSecurityScanId);
      if (scan) {
        setGroupedFindings(scan.findings);
        setLogs(scan.logs);
        setIsLogsExpanded(false);
        setExpandedFindingIds(new Set());
      }
    } else if (!isRunning) {
      setGroupedFindings(null);
      setLogs([]);
    }
  }, [activeSecurityScanId, securityHistory, isRunning]);

  const toggleFindingExpand = (reqId: string) => {
    const next = new Set(expandedFindingIds);
    if (next.has(reqId)) next.delete(reqId);
    else next.add(reqId);
    setExpandedFindingIds(next);
  };

  const onStartClick = () => {
    if (selectedRequestIds.length === 0) return;
    
    const targetRequests = (collections || [])
      .flatMap(col => col?.requests || [])
      .filter(req => req && selectedRequestIds.includes(req.id));
      
    const resolvedUrls = Array.from(new Set(targetRequests.map(req => {
      let url = resolveEnvVariables(req.url, activeEnvironment);
      try {
        const urlObj = new URL(url.startsWith('http') ? url : `http://${url}`);
        return urlObj.hostname;
      } catch (e) {
        return url;
      }
    })));

    setModalTargetUrls(resolvedUrls);
    setModalExpectedMatch(resolvedUrls[0] || '');
    setIsModalOpen(true);
  };

  const startFleetAudit = async () => {
    if (selectedRequestIds.length === 0) return;
    
    setIsRunning(true);
    setActiveSecurityScanId(null);
    let runLogs = ['[*] Initializing DevSecOps Fleet Audit...'];
    setLogs([...runLogs]);
    setGroupedFindings(null);
    setExpandedFindingIds(new Set());
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    let allGroupedFindings: RequestFindings[] = [];

    try {
      const targetRequests = (collections || [])
        .flatMap(col => col?.requests || [])
        .filter(req => req && selectedRequestIds.includes(req.id));

      setProgress({ current: 0, total: targetRequests.length, currentName: '', currentMethod: '', currentUrl: '' });
      runLogs.push(`[*] Target Scope: ${targetRequests.length} endpoints.`);
      setLogs([...runLogs]);

      let currentIndex = 0;
    for (const req of targetRequests) {
      if (signal.aborted) break;
      currentIndex++;
      setProgress({ current: currentIndex, total: targetRequests.length, currentName: req.name, currentMethod: req.method, currentUrl: req.url });

      runLogs.push(`__SECTION__STARTING_AUDIT_FOR__[${req.method}] ${req.name}`);
      setLogs([...runLogs]);

      const resolvedUrl = resolveEnvVariables(req.url, activeEnvironment);
      const resolvedHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers || {})) {
        resolvedHeaders[k] = resolveEnvVariables(v, activeEnvironment);
      }
      
      const context = { 
        url: resolvedUrl, 
        method: req.method, 
        headers: resolvedHeaders, 
        body: req.body,
        authorizationHeaderKeychainRef: req.authorizationHeaderInKeychain ? req.authorizationHeaderKeychainRef : undefined
      };

      try {
        const endpointFindings = await runSecurityAudit(
          context,
          config,
          (msg) => {
            runLogs.push(msg);
            setLogs([...runLogs]);
          },
          signal
        );

        allGroupedFindings.push({
          requestId: req.id,
          requestName: req.name,
          requestMethod: req.method,
          requestUrl: resolvedUrl,
          findings: endpointFindings
        });
      } catch (err: any) {
        if (err.name === 'AbortError') {
          runLogs.push('[-] Audit aborted by user.');
          setLogs([...runLogs]);
          break;
        }
        runLogs.push(`[!] Error auditing ${req.name}: ${err.message}`);
        setLogs([...runLogs]);
      }
    }

      if (!signal.aborted) {
        runLogs.push('__SECTION__COMPLETED__Fleet Audit Completed.');
        setLogs([...runLogs]);
      }

      setGroupedFindings(allGroupedFindings);
    } catch (err: any) {
      runLogs.push(`[!] Critical Error during initialization: ${err.message}`);
      setLogs([...runLogs]);
    } finally {
      setIsRunning(false);
      
      // Save to history automatically
      if (allGroupedFindings.length > 0 || !signal.aborted) {
        const newScan = {
          id: `scan-${Date.now()}`,
          timestamp: Date.now(),
          requestIds: selectedRequestIds,
          findings: allGroupedFindings,
          logs: runLogs
        };
        addSecurityScan(newScan);
        setActiveSecurityScanId(newScan.id);
      }
    }
  };

  const stopAudit = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const exportReport = () => {
    if (!groupedFindings) return;
    const report = {
      generatedAt: new Date().toISOString(),
      targetCount: groupedFindings.length,
      findings: groupedFindings
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pigeon-security-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderConfigToggle = (label: string, description: string, checked: boolean, onChange: (val: boolean) => void) => (
    <div 
      className="flex items-start space-x-3 py-4 border-b border-border-subtle hover:bg-surface-hover/20 cursor-pointer transition-colors px-2 -mx-2 last:border-b-0"
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
        <div className="flex items-center space-x-6 overflow-hidden">
          <div className="flex items-center space-x-3 shrink-0">
            <Shield className="text-accent" size={16} />
            <h2 className="text-[13px] font-semibold text-text-primary whitespace-nowrap">DevSecOps Collection Scanner</h2>
          </div>

          <div className="w-[1px] h-4 bg-border-strong shrink-0" />
          <div className="flex items-center space-x-2 text-sm text-text-muted shrink-0">
            <span className="font-medium text-text-primary whitespace-nowrap">{selectedRequestIds.length}/{totalRequests} APIs selected</span>
          </div>

          <div className="w-[1px] h-4 bg-border-strong" />
          <div className="shrink-0">
            <EnvironmentSelector onManageClick={onManageEnvClick} />
          </div>
        </div>
        
        {isRunning ? (
          <button
            onClick={stopAudit}
            className="flex items-center space-x-1.5 px-3 h-[28px] rounded text-[11px] font-medium transition-all shadow-sm bg-red-500/10 text-red-400 hover:bg-red-500/20"
          >
            <StopCircle size={14} />
            <span>Stop Audit</span>
          </button>
        ) : (
          <div className="flex items-center space-x-3">

            <button
              onClick={onStartClick}
              disabled={selectedRequestIds.length === 0}
              className={`flex items-center space-x-1.5 px-3 h-[28px] rounded text-[11px] font-medium transition-all shadow-sm ${
                selectedRequestIds.length === 0
                  ? 'opacity-50 cursor-not-allowed bg-surface-hover text-text-muted'
                  : 'bg-accent text-white hover:bg-accent-hover'
              }`}
            >
              <Play size={14} />
              <span>Start Audit</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col px-4 py-6">
        <div className="w-full h-full flex flex-col">
          
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
                <div className="flex flex-col space-y-3 bg-panel-bg border border-border-strong rounded-md p-4 shrink-0 shadow-sm">
                  <div className="flex items-center justify-between text-[12px] font-medium">
                    <div className="flex items-center flex-1 min-w-0 mr-4">
                      <span className="text-text-secondary mr-2 shrink-0">Auditing:</span>
                      {progress.currentMethod && (
                        <span className={`font-bold text-[10px] mr-1.5 w-12 text-left shrink-0 ${
                          progress.currentMethod === 'GET' ? 'text-method-get' :
                          progress.currentMethod === 'POST' ? 'text-method-post' :
                          progress.currentMethod === 'PUT' ? 'text-method-put' :
                          progress.currentMethod === 'DELETE' ? 'text-method-delete' : 'text-purple-400'
                        }`}>{progress.currentMethod}</span>
                      )}
                      <span className="truncate font-semibold">{progress.currentName || 'Initializing...'}</span>
                      {progress.currentUrl && (
                        <span className="ml-1.5 text-[11px] text-text-secondary font-mono truncate max-w-[250px] shrink-0">
                          ({progress.currentUrl})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 shrink-0">
                      <div className="flex items-center space-x-3 text-text-secondary">
                        <span>{progress.current} of {progress.total}</span>
                        <span className="text-accent font-bold w-8 text-right">{progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%</span>
                      </div>
                      <div className="w-px h-3.5 bg-border-strong" />
                      <div className="flex items-center text-accent font-semibold animate-pulse">
                        <Shield size={13} className="mr-1.5" />
                        Audit in progress...
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-app-bg rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent transition-all duration-300"
                      style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Layout splits into two blocks if findings exist, or just terminal if running */}
              <div className="flex-1 flex flex-col gap-6 min-h-0">
                <SecurityOutcomeUI 
                  isRunning={isRunning}
                  logs={logs}
                  groupedFindings={groupedFindings}
                  isLogsExpanded={isLogsExpanded}
                  setIsLogsExpanded={setIsLogsExpanded}
                  expandedFindingIds={expandedFindingIds}
                  toggleFindingExpand={toggleFindingExpand}
                  exportReport={exportReport}
                />
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
      <DangerConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={() => {
          setIsModalOpen(false);
          startFleetAudit();
        }}
        title="Confirm Security Audit"
        warningText="This sends live attack payloads (SQL injection, privilege escalation, verb tampering) to this URL. Only run against systems you own or have permission to test."
        targetUrls={modalTargetUrls}
        requireTyping={true}
        expectedTypeMatch={modalExpectedMatch}
        confirmButtonText="I understand the risk, Start Audit"
      />
    </div>
  );
}
