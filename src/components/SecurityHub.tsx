import { useState, useEffect } from 'react';
import { Shield, Play, CheckSquare, Square, Info } from 'lucide-react';
import { useStore } from '../store';
import type { SecurityAuditConfig } from '../utils/security/engine';
import { EnvironmentSelector } from './EnvironmentSelector';

interface SecurityHubProps {
  onManageEnvClick: () => void;
}

export function SecurityHub({ onManageEnvClick }: SecurityHubProps) {
  const collections = useStore(state => state.collections);
  const selectedColId = useStore(state => state.activeSecurityCollectionId);
  const selectedCollection = collections.find(c => c.id === selectedColId);
  
  const [config, setConfig] = useState<SecurityAuditConfig>({
    testBrokenAuth: true,
    testBOLA: false,
    testMassAssignment: true,
    testVerbTampering: true,
    testFuzzing: false,
    authHeaderName: 'Authorization',
    attackerAuthHeader: ''
  });

  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [isRunning] = useState(false);

  useEffect(() => {
    if (selectedCollection) {
      setSelectedRequestIds(new Set(selectedCollection.requests.map(r => r.id)));
    } else {
      setSelectedRequestIds(new Set());
    }
  }, [selectedCollection]);

  const toggleRequest = (id: string) => {
    const next = new Set(selectedRequestIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRequestIds(next);
  };

  const toggleAllRequests = () => {
    if (!selectedCollection) return;
    if (selectedRequestIds.size === selectedCollection.requests.length) {
      setSelectedRequestIds(new Set());
    } else {
      setSelectedRequestIds(new Set(selectedCollection.requests.map(r => r.id)));
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

          {selectedCollection && (
            <>
              <div className="w-[1px] h-4 bg-border-strong" />
              <div className="flex items-center space-x-2 text-sm text-text-muted">
                <span className="font-medium text-text-primary">{selectedCollection.name}</span>
                <span className="text-text-secondary">({selectedRequestIds.size} of {selectedCollection.requests.length} selected)</span>
              </div>
            </>
          )}

          <div className="w-[1px] h-4 bg-border-strong" />
          <div className="w-48">
            <EnvironmentSelector onManageClick={onManageEnvClick} />
          </div>
        </div>
        <button
          onClick={() => {}}
          disabled={!selectedColId || selectedRequestIds.size === 0 || isRunning}
          className={`flex items-center space-x-2 px-6 py-2 rounded-md text-[13px] font-medium transition-all shadow-sm ${
            !selectedColId || selectedRequestIds.size === 0 || isRunning
              ? 'opacity-50 cursor-not-allowed bg-surface-hover text-text-muted'
              : 'bg-accent text-white hover:bg-accent-hover'
          }`}
        >
          <Play size={14} />
          <span>Launch Fleet Audit</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-4xl mx-auto">
          
          {!selectedColId ? (
            <div className="flex flex-col items-center justify-center text-text-muted mt-20">
              <Shield size={48} className="mb-4 opacity-20" />
              <h3 className="text-[13px] font-medium text-text-primary mb-2">Collection-Level Security Audit</h3>
              <p className="text-[12px] max-w-sm text-center leading-relaxed">
                Select a target collection from the left sidebar to configure the master auth tokens and execute the complete security matrix against its endpoints.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_350px] gap-8">
              
              {/* Left Column: Endpoints & Authentication */}
              <div className="space-y-8">
                
                {/* Endpoints List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[13px] font-semibold text-text-primary">1. Endpoints in Scope</h3>
                    <button 
                      onClick={toggleAllRequests}
                      className="text-[11px] font-medium text-accent hover:text-accent-hover"
                    >
                      {selectedRequestIds.size === selectedCollection?.requests.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  
                  <div className="border border-border-strong rounded-md bg-surface-bg overflow-hidden flex flex-col max-h-[300px]">
                    <div className="overflow-y-auto custom-scrollbar">
                      {selectedCollection?.requests.map(req => {
                        const isSelected = selectedRequestIds.has(req.id);
                        return (
                          <div 
                            key={req.id} 
                            onClick={() => toggleRequest(req.id)}
                            className="flex items-center space-x-3 px-4 py-2 border-b border-border-subtle last:border-0 hover:bg-surface-hover/20 cursor-pointer transition-colors"
                          >
                            <div className="text-accent">
                              {isSelected ? <CheckSquare size={14} /> : <Square size={14} className="text-text-muted" />}
                            </div>
                            <span className={`text-[10px] font-bold w-12 ${
                              req.method === 'GET' ? 'text-blue-400' :
                              req.method === 'POST' ? 'text-green-400' :
                              req.method === 'PUT' ? 'text-yellow-400' :
                              req.method === 'DELETE' ? 'text-red-400' : 'text-purple-400'
                            }`}>{req.method}</span>
                            <span className={`text-[12px] truncate flex-1 ${isSelected ? 'text-text-primary' : 'text-text-muted line-through'}`}>
                              {req.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Authentication Context */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[13px] font-semibold text-text-primary">2. Global Authentication Context</h3>
                  </div>
                  
                  <div className="space-y-4 bg-surface-bg p-4 border border-border-strong rounded-md">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-text-secondary">Master Auth Header (e.g. Authorization)</label>
                      <input 
                        type="text" 
                        value={config.authHeaderName}
                        onChange={e => setConfig({...config, authHeaderName: e.target.value})}
                        placeholder="Authorization"
                        className="w-full h-9 bg-app-bg border border-border-strong rounded px-3 text-[13px] font-mono focus:outline-none focus:border-accent placeholder-text-muted transition-colors"
                      />
                      <p className="text-[10px] text-text-muted flex items-center mt-1">
                        <Info size={10} className="mr-1" /> This header will be stripped during Broken Authentication testing.
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-border-subtle">
                      <label className="text-[11px] font-medium text-text-secondary">Secondary Attacker Token (For BOLA)</label>
                      <input 
                        type="text" 
                        value={config.attackerAuthHeader}
                        onChange={e => setConfig({...config, attackerAuthHeader: e.target.value})}
                        disabled={!config.testBOLA}
                        placeholder={config.testBOLA ? "Bearer eyJhbG..." : "Enable BOLA test to enter token..."}
                        className="w-full h-9 bg-app-bg border border-border-strong rounded px-3 text-[13px] font-mono focus:outline-none focus:border-accent placeholder-text-muted disabled:opacity-50 transition-colors"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Policies Matrix */}
              <div className="space-y-3">
                <h3 className="text-[13px] font-semibold text-text-primary">3. Security Matrix Policies</h3>
                <div className="border border-border-strong rounded-md bg-surface-bg p-4 flex flex-col">
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
