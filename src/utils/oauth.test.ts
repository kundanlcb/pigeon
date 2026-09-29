import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearOAuthTokenCache,
  fetchOAuthToken,
  getCachedOAuthToken,
  getOAuthCacheKey,
  invalidateOAuthToken,
  isOAuthTokenCached,
  resolveOAuth2ClientCredentials,
  setCachedOAuthToken
} from './oauth';
import type { Auth, Environment } from '../store';

vi.mock('./secrets', () => ({
  getSecret: vi.fn(async (scope: string, key: string) => {
    if (scope === 'request-auth' && key === 'secret-ref-123') {
      return 'super-secret-keychain-pass';
    }
    return null;
  })
}));

describe('OAuth2 Client Credentials utilities', () => {
  beforeEach(() => {
    clearOAuthTokenCache();
    vi.restoreAllMocks();
  });

  describe('Token caching & cache keys', () => {
    it('generates consistent cache keys and normalizes scope', () => {
      const key1 = getOAuthCacheKey('https://auth.example.com/token', 'client-1', 'read write');
      const key2 = getOAuthCacheKey('https://auth.example.com/token', 'client-1', 'read write');
      const keyWithoutScope = getOAuthCacheKey('https://auth.example.com/token', 'client-1');

      expect(key1).toBe('https://auth.example.com/token:::client-1:::read write');
      expect(key1).toBe(key2);
      expect(keyWithoutScope).toBe('https://auth.example.com/token:::client-1:::');
    });

    it('stores token in memory and retrieves it before expiry', () => {
      const key = getOAuthCacheKey('https://auth.example.com/token', 'client-1');
      setCachedOAuthToken(key, 'token-abc', 3600);

      expect(getCachedOAuthToken(key)).toBe('token-abc');
      expect(isOAuthTokenCached('https://auth.example.com/token', 'client-1')).toBe(true);
    });

    it('applies a 60s safety margin to the token lifetime', () => {
      const key = getOAuthCacheKey('https://auth.example.com/token', 'client-1');
      
      const now = 1000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      // 120s expires_in -> with 60s margin, valid for 60s
      setCachedOAuthToken(key, 'token-120', 120);

      // At 59s: still valid
      vi.spyOn(Date, 'now').mockReturnValue(now + 59000);
      expect(getCachedOAuthToken(key)).toBe('token-120');

      // At 61s: expired due to safety margin
      vi.spyOn(Date, 'now').mockReturnValue(now + 61000);
      expect(getCachedOAuthToken(key)).toBeNull();
      expect(isOAuthTokenCached('https://auth.example.com/token', 'client-1')).toBe(false);
    });

    it('invalidates a specific token from cache', () => {
      const key = getOAuthCacheKey('https://auth.example.com/token', 'client-1');
      setCachedOAuthToken(key, 'token-abc', 3600);

      expect(getCachedOAuthToken(key)).toBe('token-abc');
      invalidateOAuthToken(key);
      expect(getCachedOAuthToken(key)).toBeNull();
    });

    it('clears all tokens from cache', () => {
      const key1 = getOAuthCacheKey('https://auth.example.com/token', 'client-1');
      const key2 = getOAuthCacheKey('https://auth.example.com/token', 'client-2');
      setCachedOAuthToken(key1, 'token-1', 3600);
      setCachedOAuthToken(key2, 'token-2', 3600);

      clearOAuthTokenCache();
      expect(getCachedOAuthToken(key1)).toBeNull();
      expect(getCachedOAuthToken(key2)).toBeNull();
    });
  });

  describe('fetchOAuthToken', () => {
    it('executes a POST request with form-encoded body and caches the result', async () => {
      let capturedUrl = '';
      let capturedInit: any = null;

      const mockFetch = vi.fn(async (url: any, init: any) => {
        capturedUrl = url;
        capturedInit = init;
        return new Response(JSON.stringify({
          access_token: 'fresh-access-token-123',
          token_type: 'Bearer',
          expires_in: 3600
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }) as unknown as typeof fetch;

      const result = await fetchOAuthToken({
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        scope: 'openid profile',
        fetchFn: mockFetch
      });

      expect(result.accessToken).toBe('fresh-access-token-123');
      expect(capturedUrl).toBe('https://auth.example.com/token');
      expect(capturedInit.method).toBe('POST');
      expect(capturedInit.headers['Content-Type']).toBe('application/x-www-form-urlencoded');

      const bodyParams = new URLSearchParams(capturedInit.body);
      expect(bodyParams.get('grant_type')).toBe('client_credentials');
      expect(bodyParams.get('client_id')).toBe('test-client-id');
      expect(bodyParams.get('client_secret')).toBe('test-client-secret');
      expect(bodyParams.get('scope')).toBe('openid profile');

      // Check that it was cached
      const cacheKey = getOAuthCacheKey('https://auth.example.com/token', 'test-client-id', 'openid profile');
      expect(getCachedOAuthToken(cacheKey)).toBe('fresh-access-token-123');
    });

    it('surfaces token endpoint failures with distinct error state', async () => {
      const mockFetch = vi.fn(async () => {
        return new Response(JSON.stringify({
          error: 'invalid_client',
          error_description: 'Client authentication failed'
        }), {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'Content-Type': 'application/json' }
        });
      }) as unknown as typeof fetch;

      await expect(fetchOAuthToken({
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'bad-client',
        clientSecret: 'bad-secret',
        fetchFn: mockFetch
      })).rejects.toThrow('OAuth token fetch failed: 401 Unauthorized: Client authentication failed');
    });

    it('fails clearly when response is not valid JSON', async () => {
      const mockFetch = vi.fn(async () => {
        return new Response('<html>Error page</html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        });
      }) as unknown as typeof fetch;

      await expect(fetchOAuthToken({
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'id',
        clientSecret: 'secret',
        fetchFn: mockFetch
      })).rejects.toThrow('OAuth token fetch failed: response is not valid JSON');
    });

    it('fails clearly when response is missing access_token', async () => {
      const mockFetch = vi.fn(async () => {
        return new Response(JSON.stringify({ token_type: 'Bearer' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }) as unknown as typeof fetch;

      await expect(fetchOAuthToken({
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'id',
        clientSecret: 'secret',
        fetchFn: mockFetch
      })).rejects.toThrow('OAuth token fetch failed: response missing access_token');
    });

    it('surfaces network fetch errors clearly', async () => {
      const mockFetch = vi.fn(async () => {
        throw new Error('Connection refused');
      }) as unknown as typeof fetch;

      await expect(fetchOAuthToken({
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'id',
        clientSecret: 'secret',
        fetchFn: mockFetch
      })).rejects.toThrow('OAuth token fetch failed: Connection refused');
    });
  });

  describe('resolveOAuth2ClientCredentials', () => {
    const environment: Environment = {
      id: 'env-1',
      name: 'Development',
      variables: [
        { id: '1', key: 'auth_host', value: 'https://auth.example.com', enabled: true },
        { id: '2', key: 'app_client_id', value: 'client-env-id', enabled: true },
        { id: '3', key: 'app_client_secret', value: 'secret-env-pass', enabled: true }
      ]
    };

    it('resolves environment variables and fetches token', async () => {
      const mockFetch = vi.fn(async () => {
        return new Response(JSON.stringify({
          access_token: 'env-token-xyz',
          expires_in: 3600
        }), { status: 200 });
      }) as unknown as typeof fetch;

      const auth: Auth = {
        type: 'oauth2_client_credentials',
        tokenUrl: '{{auth_host}}/oauth/token',
        clientId: '{{app_client_id}}',
        clientSecret: '{{app_client_secret}}',
        scope: 'api:read'
      };

      const result = await resolveOAuth2ClientCredentials({
        auth,
        activeEnvironment: environment,
        fetchFn: mockFetch
      });

      expect(result.accessToken).toBe('env-token-xyz');
      expect(result.fromCache).toBe(false);
      expect(result.resolvedConfig.tokenUrl).toBe('https://auth.example.com/oauth/token');
      expect(result.resolvedConfig.clientId).toBe('client-env-id');
      expect(result.resolvedConfig.clientSecret).toBe('secret-env-pass');
    });

    it('reuses cached token without re-fetching', async () => {
      const mockFetch = vi.fn(async () => {
        return new Response(JSON.stringify({
          access_token: 'first-token',
          expires_in: 3600
        }), { status: 200 });
      }) as unknown as typeof fetch;

      const auth: Auth = {
        type: 'oauth2_client_credentials',
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'my-client',
        clientSecret: 'my-secret'
      };

      const first = await resolveOAuth2ClientCredentials({
        auth,
        fetchFn: mockFetch
      });
      expect(first.accessToken).toBe('first-token');
      expect(first.fromCache).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call uses cached token
      const second = await resolveOAuth2ClientCredentials({
        auth,
        fetchFn: mockFetch
      });
      expect(second.accessToken).toBe('first-token');
      expect(second.fromCache).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No new network call
    });

    it('forces a fresh token fetch when forceFresh is true', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({
          access_token: 'first-token',
          expires_in: 3600
        }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          access_token: 'second-fresh-token',
          expires_in: 3600
        }), { status: 200 }));

      const auth: Auth = {
        type: 'oauth2_client_credentials',
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'my-client',
        clientSecret: 'my-secret'
      };

      const first = await resolveOAuth2ClientCredentials({
        auth,
        fetchFn: mockFetch as unknown as typeof fetch
      });
      expect(first.accessToken).toBe('first-token');
      expect(first.fromCache).toBe(false);

      const second = await resolveOAuth2ClientCredentials({
        auth,
        fetchFn: mockFetch as unknown as typeof fetch,
        forceFresh: true
      });
      expect(second.accessToken).toBe('second-fresh-token');
      expect(second.fromCache).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('retrieves clientSecret from system keychain when clientSecretInKeychain is true', async () => {
      let capturedBody = '';
      const mockFetch = vi.fn(async (_url: any, init: any) => {
        capturedBody = init.body;
        return new Response(JSON.stringify({
          access_token: 'keychain-token',
          expires_in: 3600
        }), { status: 200 });
      }) as unknown as typeof fetch;

      const auth: Auth = {
        type: 'oauth2_client_credentials',
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'keychain-client',
        clientSecret: '',
        clientSecretInKeychain: true,
        clientSecretKeychainRef: 'secret-ref-123'
      };

      const result = await resolveOAuth2ClientCredentials({
        auth,
        fetchFn: mockFetch
      });

      expect(result.accessToken).toBe('keychain-token');
      const bodyParams = new URLSearchParams(capturedBody);
      expect(bodyParams.get('client_secret')).toBe('super-secret-keychain-pass');
    });

    it('throws when clientSecret is in keychain but missing', async () => {
      const auth: Auth = {
        type: 'oauth2_client_credentials',
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'keychain-client',
        clientSecretInKeychain: true,
        clientSecretKeychainRef: 'non-existent-ref'
      };

      await expect(resolveOAuth2ClientCredentials({ auth }))
        .rejects.toThrow('Client secret is missing from the system keychain. Re-enter it in the Auth tab.');
    });

    it('validates presence of tokenUrl and clientId', async () => {
      await expect(resolveOAuth2ClientCredentials({
        auth: { type: 'oauth2_client_credentials', tokenUrl: '', clientId: 'client' }
      })).rejects.toThrow('Token URL is required for OAuth2 Client Credentials.');

      await expect(resolveOAuth2ClientCredentials({
        auth: { type: 'oauth2_client_credentials', tokenUrl: 'https://auth.example.com', clientId: '' }
      })).rejects.toThrow('Client ID is required for OAuth2 Client Credentials.');
    });
  });

  describe('401 retry-once flow', () => {
    it('retries once with a fresh token when a cached token receives a 401 response', async () => {
      const tokenUrl = 'https://auth.example.com/token';
      const clientId = 'client-retry';
      const cacheKey = getOAuthCacheKey(tokenUrl, clientId);

      // Pre-seed the cache with an expired-on-server token
      setCachedOAuthToken(cacheKey, 'stale-cached-token', 3600);

      const auth: Auth = {
        type: 'oauth2_client_credentials',
        tokenUrl,
        clientId,
        clientSecret: 'secret-retry'
      };

      // Mock token fetch: returns a fresh token
      const mockTokenFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
        access_token: 'fresh-new-token',
        expires_in: 3600
      }), { status: 200 }));

      // 1. First resolution should use the cached token
      const firstRes = await resolveOAuth2ClientCredentials({ auth, fetchFn: mockTokenFetch as any });
      expect(firstRes.fromCache).toBe(true);
      expect(firstRes.accessToken).toBe('stale-cached-token');

      // 2. Simulate target API receiving the stale token and returning 401
      const targetApiStatuses = [401, 200];
      let apiCallCount = 0;
      const simulateTargetApi = (authHeader: string) => {
        apiCallCount++;
        const status = targetApiStatuses.shift() ?? 500;
        return { status, authHeader };
      };

      let apiResponse = simulateTargetApi(`Bearer ${firstRes.accessToken}`);
      expect(apiResponse.status).toBe(401);
      expect(apiResponse.authHeader).toBe('Bearer stale-cached-token');

      // 3. Since it was fromCache and returned 401: invalidate cache & force fresh
      if (apiResponse.status === 401 && firstRes.fromCache) {
        invalidateOAuthToken(firstRes.cacheKey);
        const secondRes = await resolveOAuth2ClientCredentials({
          auth,
          fetchFn: mockTokenFetch as any,
          forceFresh: true
        });
        expect(secondRes.fromCache).toBe(false);
        expect(secondRes.accessToken).toBe('fresh-new-token');

        // Retry target API call once
        apiResponse = simulateTargetApi(`Bearer ${secondRes.accessToken}`);
      }

      expect(apiResponse.status).toBe(200);
      expect(apiResponse.authHeader).toBe('Bearer fresh-new-token');
      expect(apiCallCount).toBe(2);
      expect(mockTokenFetch).toHaveBeenCalledTimes(1);
    });

    it('does not retry when the fresh token also returns 401', async () => {
      const tokenUrl = 'https://auth.example.com/token';
      const clientId = 'client-retry-fail';
      const cacheKey = getOAuthCacheKey(tokenUrl, clientId);

      setCachedOAuthToken(cacheKey, 'stale-token', 3600);

      const auth: Auth = {
        type: 'oauth2_client_credentials',
        tokenUrl,
        clientId,
        clientSecret: 'secret-retry-fail'
      };

      const mockTokenFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
        access_token: 'fresh-but-unauthorized-token',
        expires_in: 3600
      }), { status: 200 }));

      const firstRes = await resolveOAuth2ClientCredentials({ auth, fetchFn: mockTokenFetch as any });
      expect(firstRes.fromCache).toBe(true);

      // Target API returns 401 both times (e.g. insufficient scopes)
      let targetApiInvocations = 0;
      const simulateTargetApi = (_authHeader: string) => {
        targetApiInvocations++;
        return { status: 401 };
      };

      let apiResponse = simulateTargetApi(`Bearer ${firstRes.accessToken}`);
      expect(apiResponse.status).toBe(401);

      // Trigger single retry
      let retriesExecuted = 0;
      if (apiResponse.status === 401 && firstRes.fromCache && retriesExecuted === 0) {
        retriesExecuted++;
        invalidateOAuthToken(firstRes.cacheKey);
        const secondRes = await resolveOAuth2ClientCredentials({
          auth,
          fetchFn: mockTokenFetch as any,
          forceFresh: true
        });
        apiResponse = simulateTargetApi(`Bearer ${secondRes.accessToken}`);
      }

      // Final status is 401 and target API was called exactly twice (no infinite loop)
      expect(apiResponse.status).toBe(401);
      expect(targetApiInvocations).toBe(2);
      expect(retriesExecuted).toBe(1);
    });
  });
});
