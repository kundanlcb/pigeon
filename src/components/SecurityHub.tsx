import { useState } from 'react';
import { Shield, Play, CheckSquare, Square } from 'lucide-react';
import { useStore } from '../store';
import { Dropdown } from './Dropdown';
import type { SecurityAuditConfig } from '../utils/security/engine';

export function SecurityHub() {
  const collections = useStore(state => state.collections);
  const [selectedColId, setSelectedColId] = useState<string | null>(null);
  const [config, setConfig] = useState<SecurityAuditConfig>({
    testBrokenAuth: true,
    testBOLA: false,
    testMassAssignment: true,
    testVerbTampering: true,
    testFuzzing: false,
    authHeaderName: 'Authorization',
    attackerAuthHeader: ''
  });

  const [isRunning] = useState(false);

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
        <div className="flex items-center space-x-3">
          <Shield className="text-accent" size={20} />
          <h2 className="text-sm font-semibold">DevSecOps Collection Scanner</h2>
        </div>
        <button
          onClick={() => {}}
          disabled={!selectedColId || isRunning}
          className={`flex items-center space-x-2 px-6 py-2 rounded-md text-[13px] font-medium transition-all shadow-sm ${
            !selectedColId || isRunning
              ? 'opacity-50 cursor-not-allowed bg-surface-hover text-text-muted'
              : 'bg-accent text-white hover:bg-accent-hover'
          }`}
        >
          <Play size={14} />
          <span>Launch Fleet Audit</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-3xl mx-auto space-y-10">
          
          {/* Target Selection */}
          <div className="space-y-3">
            <h3 className="text-[13px] font-semibold text-text-primary">1. Select Target Collection</h3>
            <div className="h-10 w-full max-w-md border border-border-strong rounded bg-surface-bg shadow-sm">
              <Dropdown
                value={selectedColId || ''}
                onChange={(val) => setSelectedColId(val)}
                options={[
                  { value: '', label: 'Select a Collection...' },
                  ...collections.map(c => ({ value: c.id, label: `${c.name} (${c.requests.length} endpoints)` }))
                ]}
                className="w-full h-full text-[13px] !border-0 bg-transparent px-2"
              />
            </div>
          </div>

          {/* Config Matrix */}
          <div className={`space-y-6 transition-opacity ${selectedColId ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
            <h3 className="text-[13px] font-semibold text-text-primary">2. Global Authentication Context</h3>
            
            <div className="border-y border-border-strong bg-surface-bg/30">
              <div className="grid grid-cols-[250px_1fr] border-b border-border-strong text-[11px] font-medium text-text-muted">
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
                    className="w-full h-full bg-transparent px-4 text-[13px] font-mono focus:outline-none placeholder-text-muted"
                  />
                </div>
                <div className="h-[40px]">
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

            <div className="pt-2 space-y-3">
              <h3 className="text-[13px] font-semibold text-text-primary">3. Security Matrix Policies</h3>
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

        </div>
      </div>
    </div>
  );
}
