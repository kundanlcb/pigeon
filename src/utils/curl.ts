import type { RequestItem, HttpMethod } from '../store';
import { getEnabledRequestHeaders } from './request';
import { removeDisabledQueryParams } from './url';
import { getCachedOAuthToken, getOAuthCacheKey } from './oauth';

export function parseCurl(curlCommand: string): Partial<RequestItem> {
  const result: Partial<RequestItem> = {
    method: 'GET',
    headers: {},
    url: ''
  };

  // Remove newlines and backslashes
  const cleanCmd = curlCommand.replace(/\\\n/g, ' ').replace(/\n/g, ' ').trim();
  
  // Very basic tokenizer for quoted strings and spaces
  const args: string[] = [];
  let currentArg = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < cleanCmd.length; i++) {
    const char = cleanCmd[i];
    if ((char === "'" || char === '"') && (i === 0 || cleanCmd[i-1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (quoteChar === char) {
        inQuotes = false;
      } else {
        currentArg += char;
      }
    } else if (/\s/.test(char) && !inQuotes) {
      if (currentArg) {
        args.push(currentArg);
        currentArg = '';
      }
    } else {
      currentArg += char;
    }
  }
  if (currentArg) args.push(currentArg);

  let startIndex = -1;
  if (args[0] === 'curl' || args[0] === 'curl.exe') {
    startIndex = 1;
  } else if (args[0] === 'postman' && args[1] === 'request') {
    startIndex = 2;
  }

  if (startIndex === -1) {
    throw new Error('Invalid command format. Expected curl command.');
  }

  for (let i = startIndex; i < args.length; i++) {
    const arg = args[i];
    
    // Support HTTP methods directly (e.g. postman request POST ...)
    if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(arg.toUpperCase())) {
      result.method = arg.toUpperCase() as HttpMethod;
      continue;
    }

    if (arg === '-X' || arg === '--request') {
      result.method = (args[i + 1] || 'GET').toUpperCase() as HttpMethod;
      i++;
    } else if (arg === '-H' || arg === '--header') {
      const headerStr = args[i + 1];
      if (headerStr) {
        const colonIdx = headerStr.indexOf(':');
        if (colonIdx !== -1) {
          result.headers![headerStr.substring(0, colonIdx).trim()] = headerStr.substring(colonIdx + 1).trim();
        }
      }
      i++;
    } else if (arg === '-d' || arg === '--data' || arg === '--data-raw' || arg === '--data-binary' || arg === '--body') {
      result.body = args[i + 1] || '';
      if (result.method === 'GET') result.method = 'POST';
      i++;
    } else if (arg === '-b' || arg === '--cookie') {
      const cookieArg = args[i + 1];
      // A cookie arg without '=' names a cookie-jar file to read, not literal cookie text.
      if (cookieArg && cookieArg.includes('=')) {
        const existingKey = Object.keys(result.headers!).find(key => key.toLowerCase() === 'cookie');
        const key = existingKey || 'Cookie';
        result.headers![key] = existingKey ? `${result.headers![key]}; ${cookieArg}` : cookieArg;
      }
      i++;
    } else if (arg === '--url') {
      result.url = args[i + 1] || result.url;
      i++;
    } else if (!arg.startsWith('-') && !result.url) {
      result.url = arg;
    }
  }

  return result;
}

export function exportCurl(req: RequestItem): string {
  const url = removeDisabledQueryParams(req.url, req.disabledParams);
  let cmd = `curl -X ${req.method} '${url}'`;
  
  if (req.headers) {
    for (const [k, v] of Object.entries(getEnabledRequestHeaders(req))) {
      cmd += ` \\\n  -H '${k}: ${v}'`;
    }
  }

  if (req.auth) {
    if (req.auth.type === 'bearer' && req.auth.bearerToken) {
      cmd += ` \\\n  -H 'Authorization: Bearer ${req.auth.bearerToken}'`;
    } else if (req.auth.type === 'basic' && (req.auth.basicUsername || req.auth.basicPassword)) {
      const creds = btoa(`${req.auth.basicUsername || ''}:${req.auth.basicPassword || ''}`);
      cmd += ` \\\n  -H 'Authorization: Basic ${creds}'`;
    } else if (req.auth.type === 'api_key' && req.auth.apiKeyKey && req.auth.apiKeyIn === 'header') {
      cmd += ` \\\n  -H '${req.auth.apiKeyKey}: ${req.auth.apiKeyValue}'`;
    } else if (req.auth.type === 'oauth2_client_credentials') {
      if (req.auth.tokenUrl && req.auth.clientId) {
        const cacheKey = getOAuthCacheKey(req.auth.tokenUrl, req.auth.clientId, req.auth.scope);
        const token = getCachedOAuthToken(cacheKey);
        if (token) {
          cmd += ` \\\n  -H 'Authorization: Bearer ${token}'`;
        }
      }
    }
  }

  if (req.method !== 'GET' && req.body) {
    let bodyStr = '';
    if (typeof req.body === 'string') {
      bodyStr = req.body;
    } else if (req.body.type === 'raw') {
      bodyStr = req.body.raw || '';
    } else if (req.body.type === 'graphql') {
      let vars = {};
      try { vars = JSON.parse(req.body.graphql?.variables || '{}'); } catch(e) {}
      bodyStr = JSON.stringify({ query: req.body.graphql?.query, variables: vars });
    } else if (req.body.type === 'x-www-form-urlencoded') {
      const p = new URLSearchParams();
      req.body.urlencoded?.forEach(k => { if (k.enabled) p.append(k.key, k.value); });
      bodyStr = p.toString();
    }
    
    if (bodyStr) {
      const safeBody = bodyStr.replace(/'/g, "'\\''");
      cmd += ` \\\n  -d '${safeBody}'`;
    }
  }

  return cmd;
}
