export const getQueryParams = (urlStr: string): Record<string, string> => {
  const params: Record<string, string> = {};
  const hashIndex = urlStr.indexOf('#');
  const urlWithoutHash = hashIndex === -1 ? urlStr : urlStr.slice(0, hashIndex);
  const qIndex = urlWithoutHash.indexOf('?');
  if (qIndex === -1) return params;
  
  const queryString = urlWithoutHash.slice(qIndex + 1);
  if (!queryString) return params;
  
  const pairs = queryString.split('&');
  for (const pair of pairs) {
    if (!pair) continue;
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) {
      params[pair] = '';
    } else {
      params[pair.slice(0, eqIndex)] = pair.slice(eqIndex + 1);
    }
  }
  return params;
};

export const setQueryParams = (urlStr: string, params: Record<string, string>): string => {
  const hashIndex = urlStr.indexOf('#');
  const hashStr = hashIndex === -1 ? '' : urlStr.slice(hashIndex);
  const urlWithoutHash = hashIndex === -1 ? urlStr : urlStr.slice(0, hashIndex);
  
  const qIndex = urlWithoutHash.indexOf('?');
  const baseUrl = qIndex === -1 ? urlWithoutHash : urlWithoutHash.slice(0, qIndex);
  
  const entries = Object.entries(params).filter(([k]) => k !== '');
  if (entries.length === 0) {
    return baseUrl + hashStr;
  }
  
  const queryString = entries.map(([k, v]) => `${k}=${v}`).join('&');
  return `${baseUrl}?${queryString}${hashStr}`;
};

export const removeDisabledQueryParams = (urlStr: string, disabledKeys: string[] = []): string => {
  if (!disabledKeys.length) return urlStr;
  
  const hashIndex = urlStr.indexOf('#');
  const hashStr = hashIndex === -1 ? '' : urlStr.slice(hashIndex);
  const urlWithoutHash = hashIndex === -1 ? urlStr : urlStr.slice(0, hashIndex);
  
  const qIndex = urlWithoutHash.indexOf('?');
  if (qIndex === -1) return urlStr;
  
  const baseUrl = urlWithoutHash.slice(0, qIndex);
  const queryString = urlWithoutHash.slice(qIndex + 1);
  if (!queryString) return urlStr;
  
  const pairs = queryString.split('&');
  const activePairs = pairs.filter(pair => {
    if (!pair) return false;
    const eqIndex = pair.indexOf('=');
    const key = eqIndex === -1 ? pair : pair.slice(0, eqIndex);
    return !disabledKeys.includes(key);
  });
  
  if (activePairs.length === 0) return baseUrl + hashStr;
  return `${baseUrl}?${activePairs.join('&')}${hashStr}`;
};

export const COMMON_HEADERS = ["Accept","Accept-Charset","Accept-Encoding","Accept-Language","Authorization","Cache-Control","Content-Type","Content-Length","Cookie","Host","Origin","Referer","User-Agent"];
