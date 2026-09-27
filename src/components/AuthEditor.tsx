import { Dropdown } from "./Dropdown";



import type { Auth } from '../store';

interface AuthEditorProps {
  auth?: Auth;
  onChange: (auth: Auth) => void;
}

export function AuthEditor({ auth, onChange }: AuthEditorProps) {
  const currentAuth = auth || { type: 'none' };

  return (
    <div className="flex h-full w-full">
      <div className="w-48 border-r border-border-subtle p-4 space-y-2 shrink-0">
        <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">Type</label>
        <Dropdown 
          value={currentAuth.type}
          onChange={(val: string) => onChange({ ...currentAuth, type: val as any })}
          options={[
            { value: 'none', label: 'No Auth' },
            { value: 'api_key', label: 'API Key' },
            { value: 'bearer', label: 'Bearer Token' },
            { value: 'basic', label: 'Basic Auth' }
          ]}
          className="w-full bg-surface-bg border border-border-strong rounded-lg px-3 py-2 text-[13px] text-text-primary"
        />
        
        <div className="text-xs text-text-muted mt-4 pt-4 border-t border-border-subtle leading-relaxed">
          The authorization header will be automatically generated when you send the request.
        </div>
      </div>
      
      <div className="flex-1 p-6 overflow-y-auto">
        {currentAuth.type === 'none' && (
          <div className="flex items-center justify-center h-full text-sm text-text-muted italic">
            This request does not use any authorization.
          </div>
        )}

        {currentAuth.type === 'api_key' && (
          <div className="max-w-xl space-y-4">
            <div>
              <label className="text-xs font-semibold text-text-primary mb-1.5 block">Key</label>
              <input 
                type="text"
                className="w-full bg-surface-bg border border-border-strong rounded-lg px-3 py-2 text-[13px] font-mono text-text-primary outline-none focus:border-accent"
                placeholder="Key"
                value={currentAuth.apiKeyKey || ''}
                onChange={(e) => onChange({ ...currentAuth, apiKeyKey: e.target.value })}
                spellCheck={false}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-primary mb-1.5 block">Value</label>
              <input 
                type="text"
                className="w-full bg-surface-bg border border-border-strong rounded-lg px-3 py-2 text-[13px] font-mono text-text-primary outline-none focus:border-accent"
                placeholder="Value"
                value={currentAuth.apiKeyValue || ''}
                onChange={(e) => onChange({ ...currentAuth, apiKeyValue: e.target.value })}
                spellCheck={false}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-primary mb-1.5 block">Add to</label>
              <Dropdown 
                value={currentAuth.apiKeyIn || 'header'}
                onChange={(val: string) => onChange({ ...currentAuth, apiKeyIn: val as any })}
                options={[
                  { value: 'header', label: 'Header' },
                  { value: 'query', label: 'Query Params' }
                ]}
                className="w-full bg-surface-bg border border-border-strong rounded-lg px-3 py-2 text-[13px] text-text-primary"
              />
            </div>
          </div>
        )}
        
        {currentAuth.type === 'bearer' && (
          <div className="max-w-xl space-y-4">
            <div>
              <label className="text-xs font-semibold text-text-primary mb-1.5 block">Token</label>
              <textarea 
                className="w-full bg-surface-bg border border-border-strong rounded-lg p-3 text-[13px] font-mono text-text-primary outline-none focus:border-accent min-h-32 resize-y"
                placeholder="Enter Bearer token"
                value={currentAuth.bearerToken || ''}
                onChange={(e) => onChange({ ...currentAuth, bearerToken: e.target.value })}
                spellCheck={false}
              />
            </div>
          </div>
        )}

        {currentAuth.type === 'basic' && (
          <div className="max-w-xl space-y-4">
            <div>
              <label className="text-xs font-semibold text-text-primary mb-1.5 block">Username</label>
              <input 
                type="text"
                className="w-full bg-surface-bg border border-border-strong rounded-lg px-3 py-2 text-[13px] font-mono text-text-primary outline-none focus:border-accent"
                placeholder="Username"
                value={currentAuth.basicUsername || ''}
                onChange={(e) => onChange({ ...currentAuth, basicUsername: e.target.value })}
                spellCheck={false}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-primary mb-1.5 block">Password</label>
              <input 
                type="password"
                className="w-full bg-surface-bg border border-border-strong rounded-lg px-3 py-2 text-[13px] font-mono text-text-primary outline-none focus:border-accent"
                placeholder="Password"
                value={currentAuth.basicPassword || ''}
                onChange={(e) => onChange({ ...currentAuth, basicPassword: e.target.value })}
                spellCheck={false}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
