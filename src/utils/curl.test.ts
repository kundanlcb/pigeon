import { describe, expect, it } from 'vitest';
import { parseCurl } from './curl';

describe('parseCurl', () => {
  it('imports a cURL cookie flag as a Cookie header for XSRF-protected form posts', () => {
    const request = parseCurl(`curl --url 'https://example.atlassian.net/servicedesk/customer/portal/1003/create/1006' \\
      -H 'content-type: application/x-www-form-urlencoded' \\
      -b 'atlassian.xsrf.token=csrf-token; tenant.session.token=session-token' \\
      --data-raw 'summary=Need%20access&atl_token=csrf-token'`);

    expect(request).toMatchObject({
      method: 'POST',
      url: 'https://example.atlassian.net/servicedesk/customer/portal/1003/create/1006',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        Cookie: 'atlassian.xsrf.token=csrf-token; tenant.session.token=session-token'
      },
      body: 'summary=Need%20access&atl_token=csrf-token'
    });
  });

  it('combines repeated cookie flags into one Cookie header', () => {
    const request = parseCurl("curl 'https://api.example.com' -b 'first=value' --cookie 'second=value'");
    expect(request.headers).toEqual({ Cookie: 'first=value; second=value' });
  });

  it('accepts non-breaking-space indentation from rich-text cURL copies', () => {
    const request = parseCurl('curl\u00a0--cookie \'atlassian.xsrf.token=csrf-token\'\u00a0--url \'https://example.atlassian.net/request\'\u00a0--data-raw \'atl_token=csrf-token\'');

    expect(request).toMatchObject({
      method: 'POST',
      url: 'https://example.atlassian.net/request',
      headers: { Cookie: 'atlassian.xsrf.token=csrf-token' },
      body: 'atl_token=csrf-token'
    });
  });

  it('ignores a --cookie value that names a cookie-jar file instead of literal cookie text', () => {
    const request = parseCurl("curl 'https://api.example.com' --cookie cookies.txt");
    expect(request.headers).toEqual({});
  });

  it('exports exportCurl with Bearer Authorization header when OAuth2 token is cached', async () => {
    const { exportCurl } = await import('./curl');
    const { setCachedOAuthToken, getOAuthCacheKey, clearOAuthTokenCache } = await import('./oauth');
    
    clearOAuthTokenCache();
    const tokenUrl = 'https://auth.example.com/oauth/token';
    const clientId = 'client-xyz';
    const cacheKey = getOAuthCacheKey(tokenUrl, clientId);
    setCachedOAuthToken(cacheKey, 'test-access-token-999', 3600);

    const curlCmd = exportCurl({
      id: 'req-1',
      name: 'Get Protected Data',
      method: 'GET',
      url: 'https://api.example.com/data',
      headers: {},
      auth: {
        type: 'oauth2_client_credentials',
        tokenUrl,
        clientId
      }
    });

    expect(curlCmd).toContain("-H 'Authorization: Bearer test-access-token-999'");
  });
});
