export const getQueryParams = (urlStr: string): Record<string, string> => {
  try {
    const url = new URL(urlStr);
    const params: Record<string, string> = {};
    url.searchParams.forEach((val, key) => { params[key] = val; });
    return params;
  } catch { return {}; }
};

export const setQueryParams = (urlStr: string, params: Record<string, string>): string => {
  try {
    const url = new URL(urlStr);
    const keys = Array.from(url.searchParams.keys());
    keys.forEach(k => url.searchParams.delete(k));
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
    return url.toString();
  } catch { return urlStr; }
};

export const removeDisabledQueryParams = (urlStr: string, disabledKeys: string[] = []): string => {
  if (!disabledKeys.length) return urlStr;
  try {
    const url = new URL(urlStr);
    disabledKeys.forEach(key => url.searchParams.delete(key));
    return url.toString();
  } catch {
    return urlStr;
  }
};

export const COMMON_HEADERS = ["Accept","Accept-Charset","Accept-Encoding","Accept-Language","Authorization","Cache-Control","Content-Type","Content-Length","Cookie","Host","Origin","Referer","User-Agent"];
