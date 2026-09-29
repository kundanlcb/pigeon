import type { Auth, Environment } from '../store';
import { resolveEnvVariables } from './env';
import { getSecret } from './secrets';

export interface OAuthTokenCacheEntry {
  accessToken: string;
  expiresAt: number;
}

// In-memory cache for OAuth2 access tokens
const tokenCache = new Map<string, OAuthTokenCacheEntry>();

export function getOAuthCacheKey(tokenUrl: string, clientId: string, scope?: string): string {
  return `${tokenUrl.trim()}:::${clientId.trim()}:::${(scope || '').trim()}`;
}

export function getCachedOAuthToken(cacheKey: string): string | null {
  const entry = tokenCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    tokenCache.delete(cacheKey);
    return null;
  }
  return entry.accessToken;
}

export function setCachedOAuthToken(cacheKey: string, accessToken: string, expiresInSeconds: number): void {
  // Apply a 60s safety margin to avoid mid-flight expiration
  const validForSeconds = Math.max(0, expiresInSeconds - 60);
  const expiresAt = Date.now() + validForSeconds * 1000;
  tokenCache.set(cacheKey, { accessToken, expiresAt });
}

export function invalidateOAuthToken(cacheKey: string): void {
  tokenCache.delete(cacheKey);
}

export function clearOAuthTokenCache(): void {
  tokenCache.clear();
}

export function isOAuthTokenCached(tokenUrl: string, clientId: string, scope?: string): boolean {
  const key = getOAuthCacheKey(tokenUrl, clientId, scope);
  return getCachedOAuthToken(key) !== null;
}

export interface FetchOAuthTokenOptions {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  fetchFn?: typeof fetch;
  dangerOptions?: any;
  timeout?: number;
}

export interface FetchOAuthTokenResult {
  accessToken: string;
  expiresIn: number;
  cacheKey: string;
}

async function defaultFetch(url: string, init: any): Promise<Response> {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
      return await tauriFetch(url, init);
    } catch {
      // Fallback to window.fetch if plugin-http cannot be loaded
    }
  }
  if (typeof fetch !== 'undefined') {
    return await fetch(url, init);
  }
  throw new Error('No fetch implementation available');
}

export async function fetchOAuthToken(options: FetchOAuthTokenOptions): Promise<FetchOAuthTokenResult> {
  const { tokenUrl, clientId, clientSecret, scope, fetchFn, dangerOptions, timeout } = options;

  const bodyParams = new URLSearchParams();
  bodyParams.append('grant_type', 'client_credentials');
  bodyParams.append('client_id', clientId);
  bodyParams.append('client_secret', clientSecret);
  if (scope && scope.trim()) {
    bodyParams.append('scope', scope.trim());
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json, text/plain, */*'
  };

  const requestInit: any = {
    method: 'POST',
    headers,
    body: bodyParams.toString()
  };

  if (timeout) {
    requestInit.connectTimeout = timeout;
  }
  if (dangerOptions) {
    requestInit.danger = dangerOptions;
  }

  let res: Response;
  try {
    const doFetch = fetchFn || defaultFetch;
    res = await doFetch(tokenUrl, requestInit);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`OAuth token fetch failed: ${message}`);
  }

  if (!res.ok) {
    let detail = '';
    try {
      const text = await res.text();
      try {
        const parsed = JSON.parse(text);
        if (parsed.error_description) {
          detail = `: ${parsed.error_description}`;
        } else if (parsed.error) {
          detail = `: ${parsed.error}`;
        } else if (parsed.message) {
          detail = `: ${parsed.message}`;
        } else if (text) {
          detail = `: ${text.slice(0, 120)}`;
        }
      } catch {
        if (text) detail = `: ${text.slice(0, 120)}`;
      }
    } catch {}

    const statusText = res.statusText ? ` ${res.statusText}` : '';
    throw new Error(`OAuth token fetch failed: ${res.status}${statusText}${detail}`);
  }

  let data: any;
  try {
    const text = await res.text();
    data = JSON.parse(text);
  } catch {
    throw new Error('OAuth token fetch failed: response is not valid JSON');
  }

  if (!data || typeof data !== 'object' || !data.access_token) {
    throw new Error('OAuth token fetch failed: response missing access_token');
  }

  const accessToken = String(data.access_token);
  const expiresIn = typeof data.expires_in === 'number' && !isNaN(data.expires_in) && data.expires_in > 0
    ? data.expires_in
    : 3600;

  const cacheKey = getOAuthCacheKey(tokenUrl, clientId, scope);
  setCachedOAuthToken(cacheKey, accessToken, expiresIn);

  return {
    accessToken,
    expiresIn,
    cacheKey
  };
}

export interface ResolveOAuthOptions {
  auth: Auth;
  activeEnvironment?: Environment | null;
  localVars?: Record<string, string>;
  fetchFn?: typeof fetch;
  dangerOptions?: any;
  timeout?: number;
  forceFresh?: boolean;
}

export interface OAuthResolutionResult {
  accessToken: string;
  fromCache: boolean;
  cacheKey: string;
  resolvedConfig: {
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    scope?: string;
  };
}

export async function resolveOAuth2ClientCredentials(options: ResolveOAuthOptions): Promise<OAuthResolutionResult> {
  const { auth, activeEnvironment, localVars, fetchFn, dangerOptions, timeout, forceFresh = false } = options;

  if (auth.type !== 'oauth2_client_credentials') {
    throw new Error('Invalid auth type for OAuth2 Client Credentials');
  }

  const tokenUrl = resolveEnvVariables(auth.tokenUrl || '', activeEnvironment, localVars).trim();
  if (!tokenUrl) {
    throw new Error('Token URL is required for OAuth2 Client Credentials.');
  }

  const clientId = resolveEnvVariables(auth.clientId || '', activeEnvironment, localVars).trim();
  if (!clientId) {
    throw new Error('Client ID is required for OAuth2 Client Credentials.');
  }

  let rawSecret = auth.clientSecret || '';
  if (auth.clientSecretInKeychain) {
    const stored = await getSecret('request-auth', auth.clientSecretKeychainRef || '');
    if (!stored) {
      throw new Error('Client secret is missing from the system keychain. Re-enter it in the Auth tab.');
    }
    rawSecret = stored;
  }
  const clientSecret = resolveEnvVariables(rawSecret, activeEnvironment, localVars);
  const scope = auth.scope ? resolveEnvVariables(auth.scope, activeEnvironment, localVars).trim() : undefined;

  const cacheKey = getOAuthCacheKey(tokenUrl, clientId, scope);
  const resolvedConfig = { tokenUrl, clientId, clientSecret, scope };

  if (!forceFresh) {
    const cachedToken = getCachedOAuthToken(cacheKey);
    if (cachedToken) {
      return {
        accessToken: cachedToken,
        fromCache: true,
        cacheKey,
        resolvedConfig
      };
    }
  }

  const fresh = await fetchOAuthToken({
    tokenUrl,
    clientId,
    clientSecret,
    scope,
    fetchFn,
    dangerOptions,
    timeout
  });

  return {
    accessToken: fresh.accessToken,
    fromCache: false,
    cacheKey,
    resolvedConfig
  };
}
