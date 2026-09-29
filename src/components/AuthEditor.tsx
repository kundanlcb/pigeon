import { useState } from 'react';
import { Dropdown } from "./Dropdown";
import { createSecretReference, deleteSecret, setSecret } from '../utils/secrets';
import { useStore } from '../store';
import { deleteUnusedRequestSecrets, requestSecretIsShared } from '../utils/authSecrets';



import { resolveEnvVariables } from '../utils/env';
import { getOAuthCacheKey, invalidateOAuthToken, isOAuthTokenCached, resolveOAuth2ClientCredentials } from '../utils/oauth';

import type { Auth } from '../store';

interface AuthEditorProps {
  requestId: string;
  auth?: Auth;
}

type AuthSecretField = 'bearerToken' | 'basicPassword' | 'apiKeyValue' | 'clientSecret';

export function AuthEditor({ requestId, auth }: AuthEditorProps) {
  const currentAuth = auth || { type: 'none' };
  const [draftState, setDraftState] = useState<{
    requestId: string;
    values: Partial<Record<AuthSecretField, string>>;
  }>({ requestId, values: {} });
  const secretDrafts = draftState.requestId === requestId ? draftState.values : {};
  const [savingField, setSavingField] = useState<AuthSecretField | null>(null);
  const [fetchingToken, setFetchingToken] = useState(false);
  const [tokenCacheNonce, setTokenCacheNonce] = useState(0);
  const showToast = useStore(state => state.showToast);
  const updateRequestAuth = useStore(state => state.updateRequestAuth);
  const activeEnvironment = useStore(state => state.environments.find(e => e.id === state.activeEnvironmentId));

  const updateDraft = (field: AuthSecretField, value: string) => {
    setDraftState(previous => ({
      requestId,
      values: { ...(previous.requestId === requestId ? previous.values : {}), [field]: value }
    }));
  };

  const updateAuth = (updates: Partial<Auth>) => {
    updateRequestAuth(requestId, updates);
  };

  const saveSecret = async (field: AuthSecretField) => {
    const value = secretDrafts[field];
    if (!value) return;
    setSavingField(field);
    try {
      const reference = createSecretReference();
      await setSecret('request-auth', reference, value);
      const marker = `${field}InKeychain` as const;
      const refField = `${field}KeychainRef` as const;
      const state = useStore.getState();
      const liveRequest = state.collections.flatMap(collection => collection.requests).find(request => request.id === requestId);
      if (!liveRequest) {
        await deleteSecret('request-auth', reference);
        throw new Error('Request was removed before the credential could be attached.');
      }
      const oldReference = liveRequest.auth?.[refField];
      updateRequestAuth(requestId, { [field]: '', [marker]: true, [refField]: reference });
      if (oldReference) {
        await deleteUnusedRequestSecrets(useStore.getState().collections, [{
          ...liveRequest,
          auth: { ...(liveRequest.auth || { type: 'none' }), [refField]: oldReference }
        }]);
      }
      updateDraft(field, '');
      showToast('Credential saved to the system keychain', 'success');
    } catch (error) {
      showToast(`Failed to save credential: ${String(error)}`, 'error');
    } finally {
      setSavingField(null);
    }
  };

  const clearSecret = async (field: AuthSecretField) => {
    try {
      const marker = `${field}InKeychain` as const;
      const refField = `${field}KeychainRef` as const;
      const reference = currentAuth[refField];
      const state = useStore.getState();
      if (reference && !requestSecretIsShared(state.collections, requestId, reference)) {
        await deleteSecret('request-auth', reference);
      }
      updateRequestAuth(requestId, { [field]: '', [marker]: false, [refField]: undefined });
      updateDraft(field, '');
      showToast('Credential removed from the system keychain', 'success');
    } catch (error) {
      showToast(`Failed to remove credential: ${String(error)}`, 'error');
    }
  };

  const renderSecretActions = (field: AuthSecretField, saved: boolean) => (
    <div className="flex items-center gap-2 mt-2">
      {secretDrafts[field] ? (
        <button
          type="button"
          disabled={savingField === field}
          onClick={() => void saveSecret(field)}
          className="px-3 py-1.5 bg-accent text-white rounded text-xs disabled:opacity-50"
        >
          {savingField === field ? 'Saving...' : 'Save to Keychain'}
        </button>
      ) : null}
      {saved && (
        <>
          <span className="text-xs text-text-muted">Stored in system keychain</span>
          <button type="button" onClick={() => void clearSecret(field)} className="text-xs text-red-500 hover:text-red-400">
            Remove
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="flex h-full w-full">
      <div className="w-48 border-r border-border-subtle p-4 space-y-2 shrink-0">
        <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">Type</label>
        <Dropdown 
          value={currentAuth.type}
          onChange={(val: string) => updateAuth({ type: val as any })}
          options={[
            { value: 'none', label: 'No Auth' },
            { value: 'api_key', label: 'API Key' },
            { value: 'bearer', label: 'Bearer Token' },
            { value: 'basic', label: 'Basic Auth' },
            { value: 'oauth2_client_credentials', label: 'OAuth 2.0' }
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
                onChange={(e) => updateAuth({ apiKeyKey: e.target.value })}
                spellCheck={false}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-primary mb-1.5 block">Value</label>
              <input 
                type="password"
                className="w-full bg-surface-bg border border-border-strong rounded-lg px-3 py-2 text-[13px] font-mono text-text-primary outline-none focus:border-accent"
                placeholder="Value"
                value={secretDrafts.apiKeyValue ?? (currentAuth.apiKeyValueInKeychain ? '' : currentAuth.apiKeyValue || '')}
                onChange={(e) => updateDraft('apiKeyValue', e.target.value)}
                spellCheck={false}
              />
              {renderSecretActions('apiKeyValue', !!currentAuth.apiKeyValueInKeychain)}
            </div>
            <div>
              <label className="text-xs font-semibold text-text-primary mb-1.5 block">Add to</label>
              <Dropdown 
                value={currentAuth.apiKeyIn || 'header'}
                onChange={(val: string) => updateAuth({ apiKeyIn: val as any })}
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
                placeholder={currentAuth.bearerTokenInKeychain ? 'Enter a replacement token' : 'Enter Bearer token'}
                value={secretDrafts.bearerToken ?? (currentAuth.bearerTokenInKeychain ? '' : currentAuth.bearerToken || '')}
                onChange={(e) => updateDraft('bearerToken', e.target.value)}
                spellCheck={false}
              />
              {renderSecretActions('bearerToken', !!currentAuth.bearerTokenInKeychain)}
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
                onChange={(e) => updateAuth({ basicUsername: e.target.value })}
                spellCheck={false}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-primary mb-1.5 block">Password</label>
              <input 
                type="password"
                className="w-full bg-surface-bg border border-border-strong rounded-lg px-3 py-2 text-[13px] font-mono text-text-primary outline-none focus:border-accent"
                placeholder="Password"
                value={secretDrafts.basicPassword ?? (currentAuth.basicPasswordInKeychain ? '' : currentAuth.basicPassword || '')}
                onChange={(e) => updateDraft('basicPassword', e.target.value)}
                spellCheck={false}
              />
              {renderSecretActions('basicPassword', !!currentAuth.basicPasswordInKeychain)}
            </div>
          </div>
        )}

        {currentAuth.type === 'oauth2_client_credentials' && (() => {
          const resolvedTokenUrl = currentAuth.tokenUrl ? resolveEnvVariables(currentAuth.tokenUrl, activeEnvironment) : '';
          const resolvedClientId = currentAuth.clientId ? resolveEnvVariables(currentAuth.clientId, activeEnvironment) : '';
          const resolvedScope = currentAuth.scope ? resolveEnvVariables(currentAuth.scope, activeEnvironment) : undefined;
          const isCached = tokenCacheNonce >= 0 && resolvedTokenUrl && resolvedClientId
            ? isOAuthTokenCached(resolvedTokenUrl, resolvedClientId, resolvedScope)
            : false;

          const handleFetchTokenNow = async () => {
            setFetchingToken(true);
            try {
              await resolveOAuth2ClientCredentials({
                auth: {
                  ...currentAuth,
                  clientSecret: secretDrafts.clientSecret ?? currentAuth.clientSecret
                },
                activeEnvironment,
                forceFresh: true
              });
              setTokenCacheNonce(n => n + 1);
              showToast('OAuth2 token retrieved and cached in memory', 'success');
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              showToast(msg, 'error');
            } finally {
              setFetchingToken(false);
            }
          };

          const handleClearCachedToken = () => {
            if (resolvedTokenUrl && resolvedClientId) {
              const cacheKey = getOAuthCacheKey(resolvedTokenUrl, resolvedClientId, resolvedScope);
              invalidateOAuthToken(cacheKey);
              setTokenCacheNonce(n => n + 1);
              showToast('Cached OAuth token cleared', 'success');
            }
          };

          return (
            <div className="max-w-xl space-y-4">
              <div>
                <label className="text-xs font-semibold text-text-primary mb-1.5 block">Token URL</label>
                <input 
                  type="text"
                  className="w-full bg-surface-bg border border-border-strong rounded-lg px-3 py-2 text-[13px] font-mono text-text-primary outline-none focus:border-accent"
                  placeholder="https://auth.example.com/oauth/token"
                  value={currentAuth.tokenUrl || ''}
                  onChange={(e) => updateAuth({ tokenUrl: e.target.value })}
                  spellCheck={false}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-primary mb-1.5 block">Client ID</label>
                <input 
                  type="text"
                  className="w-full bg-surface-bg border border-border-strong rounded-lg px-3 py-2 text-[13px] font-mono text-text-primary outline-none focus:border-accent"
                  placeholder="Client ID"
                  value={currentAuth.clientId || ''}
                  onChange={(e) => updateAuth({ clientId: e.target.value })}
                  spellCheck={false}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-primary mb-1.5 block">Client Secret</label>
                <input 
                  type="password"
                  className="w-full bg-surface-bg border border-border-strong rounded-lg px-3 py-2 text-[13px] font-mono text-text-primary outline-none focus:border-accent"
                  placeholder={currentAuth.clientSecretInKeychain ? 'Enter a replacement secret' : 'Client Secret'}
                  value={secretDrafts.clientSecret ?? (currentAuth.clientSecretInKeychain ? '' : currentAuth.clientSecret || '')}
                  onChange={(e) => updateDraft('clientSecret', e.target.value)}
                  spellCheck={false}
                />
                {renderSecretActions('clientSecret', !!currentAuth.clientSecretInKeychain)}
              </div>
              <div>
                <label className="text-xs font-semibold text-text-primary mb-1.5 block">
                  Scope <span className="text-text-muted font-normal">(optional)</span>
                </label>
                <input 
                  type="text"
                  className="w-full bg-surface-bg border border-border-strong rounded-lg px-3 py-2 text-[13px] font-mono text-text-primary outline-none focus:border-accent"
                  placeholder="e.g. read:users write:orders"
                  value={currentAuth.scope || ''}
                  onChange={(e) => updateAuth({ scope: e.target.value })}
                  spellCheck={false}
                />
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-border-subtle mt-6">
                <div className="text-xs text-text-muted">
                  {isCached ? (
                    <span className="text-emerald-500 font-medium flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                      Access token cached in memory
                    </span>
                  ) : (
                    <span>Pigeon fetches and caches the access token automatically on send.</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isCached && (
                    <button
                      type="button"
                      onClick={handleClearCachedToken}
                      className="px-2.5 py-1 text-xs text-text-muted hover:text-text-primary border border-border-subtle rounded hover:bg-surface-subtle transition-colors"
                    >
                      Clear Token
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={fetchingToken || !currentAuth.tokenUrl || !currentAuth.clientId}
                    onClick={() => void handleFetchTokenNow()}
                    className="px-3 py-1.5 bg-accent text-white rounded text-xs font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
                  >
                    {fetchingToken ? 'Fetching Token...' : 'Fetch Token Now'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
