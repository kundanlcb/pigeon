import { type RequestItem, type Environment } from '../store';
import { resolveEnvVariables } from './env';

const HTTP_STATUS_LABELS: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  413: 'Content Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export function getResponseStatusText(status: number, statusText: string): string {
  return statusText.trim() || HTTP_STATUS_LABELS[status] || `HTTP ${status}`;
}



export function prepareRequestBody(request: RequestItem, activeEnvironment?: Environment | null, localVars?: Record<string, string>): { body: any, headers: Record<string, string> } {
  const extraHeaders: Record<string, string> = {};
  
  if (request.method === 'GET' || !request.body) {
    return { body: undefined, headers: extraHeaders };
  }

  let bodyData = request.body;

  // Backward compatibility for string body
  if (typeof bodyData === 'string') {
    return { 
      body: resolveEnvVariables(bodyData, activeEnvironment, localVars), 
      headers: extraHeaders 
    };
  }

  if (bodyData.type === 'none') {
    return { body: undefined, headers: extraHeaders };
  }

  if (bodyData.type === 'raw') {
    let content = bodyData.raw || '';
    content = resolveEnvVariables(content, activeEnvironment, localVars);
    
    if (bodyData.rawLanguage === 'json') extraHeaders['Content-Type'] = 'application/json';
    else if (bodyData.rawLanguage === 'html') extraHeaders['Content-Type'] = 'text/html';
    else if (bodyData.rawLanguage === 'xml') extraHeaders['Content-Type'] = 'application/xml';
    else if (bodyData.rawLanguage === 'javascript') extraHeaders['Content-Type'] = 'application/javascript';
    else extraHeaders['Content-Type'] = 'text/plain';

    return { body: content, headers: extraHeaders };
  }

  if (bodyData.type === 'x-www-form-urlencoded') {
    const params = new URLSearchParams();
    (bodyData.urlencoded || []).filter(p => p.enabled && p.key).forEach(p => {
      params.append(resolveEnvVariables(p.key, activeEnvironment, localVars), resolveEnvVariables(p.value, activeEnvironment, localVars));
    });
    extraHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
    return { body: params.toString(), headers: extraHeaders };
  }

  if (bodyData.type === 'form-data') {
    const formData = new FormData();
    (bodyData.formData || []).filter(p => p.enabled && p.key).forEach(p => {
      formData.append(resolveEnvVariables(p.key, activeEnvironment, localVars), resolveEnvVariables(p.value, activeEnvironment, localVars));
      // Note: We don't support files yet, so everything is appended as string.
    });
    // Do NOT set Content-Type for FormData, the browser/fetch will set it automatically with the correct boundary!
    return { body: formData, headers: extraHeaders };
  }

  if (bodyData.type === 'graphql') {
    const q = resolveEnvVariables(bodyData.graphql?.query || '', activeEnvironment, localVars);
    const v = resolveEnvVariables(bodyData.graphql?.variables || '{}', activeEnvironment, localVars);
    let varsObj = {};
    try { varsObj = JSON.parse(v); } catch(e) {}
    
    const payload = JSON.stringify({ query: q, variables: varsObj });
    extraHeaders['Content-Type'] = 'application/json';
    return { body: payload, headers: extraHeaders };
  }

  return { body: undefined, headers: extraHeaders };
}

export function getEnabledRequestHeaders(request: RequestItem): Record<string, string> {
  const disabled = new Set((request.disabledHeaders || []).map(key => key.toLowerCase()));
  return Object.fromEntries(Object.entries(request.headers || {})
    .filter(([key]) => !disabled.has(key.toLowerCase())));
}
