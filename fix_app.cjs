const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Add import
if (!code.includes('KeyValueEditor')) {
  code = code.replace("import { useState, useEffect } from 'react';", "import { useState, useEffect } from 'react';\nimport { KeyValueEditor } from './KeyValueEditor';");
}

// 2. Add query param helpers at the top level
const helpers = `
const getQueryParams = (urlStr: string): Record<string, string> => {
  try {
    const url = new URL(urlStr);
    const params: Record<string, string> = {};
    url.searchParams.forEach((val, key) => { params[key] = val; });
    return params;
  } catch { return {}; }
};
const setQueryParams = (urlStr: string, params: Record<string, string>): string => {
  try {
    const url = new URL(urlStr);
    const keys = Array.from(url.searchParams.keys());
    keys.forEach(k => url.searchParams.delete(k));
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
    return url.toString();
  } catch { return urlStr; }
};
`;
if (!code.includes('getQueryParams')) {
  code = code.replace("export default function App() {", helpers + "\nexport default function App() {");
}

// 3. Update activeTab state
code = code.replace(
  /const \[activeTab, setActiveTab\] = useState<'req-headers' \| 'req-body' \| 'pre-request'>\('req-headers'\);/g,
  "const [activeTab, setActiveTab] = useState<'req-params' | 'req-headers' | 'req-body' | 'pre-request'>('req-params');"
);

// 4. Add Params tab to UI
const paramsTabHtml = `
                  <button 
                    onClick={() => setActiveTab('req-params')}
                    className={\`py-3 font-medium transition-colors relative \${activeTab === 'req-params' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}\`}
                  >
                    Params
                    {activeTab === 'req-params' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-accent"></div>}
                  </button>
`;
if (!code.includes("setActiveTab('req-params')")) {
  code = code.replace(
    `<button \n                    onClick={() => setActiveTab('req-headers')}`,
    paramsTabHtml + `                  <button \n                    onClick={() => setActiveTab('req-headers')}`
  );
}

// 5. Replace Headers and Params tab content
const oldHeadersBlock = /\{activeTab === 'req-headers' && \([\s\S]*?\}\)/;
const newTabsContent = `{activeTab === 'req-params' && (
                    <KeyValueEditor 
                      items={getQueryParams(activeRequest?.url || '')} 
                      onChange={(newParams) => {
                        const newUrl = setQueryParams(activeRequest?.url || '', newParams);
                        setLocalUrl(newUrl);
                        updateActiveRequest({ url: newUrl });
                      }} 
                    />
                  )}
                  {activeTab === 'req-headers' && (
                    <KeyValueEditor 
                      items={activeRequest?.headers || {}} 
                      onChange={(newHeaders) => updateActiveRequest({ headers: newHeaders })} 
                    />
                  )}`;
code = code.replace(oldHeadersBlock, newTabsContent);

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx updated');
