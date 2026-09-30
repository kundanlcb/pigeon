export interface PigeonContext {
  env: {
    get: (key: string) => string | undefined;
    set: (key: string, value: string) => void;
  };
  request: {
    headers: Record<string, string>;
    url: string;
    method: string;
    body: any;
  };
  response?: {
    status: number;
    json: () => any;
    text: () => string;
    headers: Record<string, string>;
  };
  test?: (name: string, fn: () => void) => void;
  expect?: (val: any) => any;
}

let sandboxIframe: HTMLIFrameElement | null = null;
let messageResolvers: Record<string, { resolve: (val: any) => void, reject: (err: any) => void }> = {};
let messageIdCounter = 0;

const sandboxHTML = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body>
  <script>
    window.addEventListener('message', async (event) => {
      const { id, script, contextData } = event.data;
      if (!id || !script) return;
      
      const results = [];
      const envDict = contextData.env || {};
      
      const context = {
        env: {
          get: (k) => envDict[k],
          set: (k, v) => { envDict[k] = v; }
        },
        request: contextData.request,
        response: contextData.response
      };

      if (context.response) {
        context.response.json = () => JSON.parse(contextData.response.bodyText || '{}');
        context.response.text = () => contextData.response.bodyText || '';
      }
      
      context.test = (name, fn) => {
        try {
          fn();
          results.push({ name, passed: true });
        } catch (error) {
          results.push({ name, passed: false, error: error.message });
        }
      };

      context.expect = (val) => ({
        toEqual: (expected) => {
          if (val !== expected) throw new Error(\`Expected \${expected} but got \${val}\`);
        },
        toBeGreaterThan: (expected) => {
          if (val <= expected) throw new Error(\`Expected \${val} to be greater than \${expected}\`);
        },
        toBeLessThan: (expected) => {
          if (val >= expected) throw new Error(\`Expected \${val} to be less than \${expected}\`);
        },
        toContain: (expected) => {
          if (typeof val === 'string' || Array.isArray(val)) {
            if (!val.includes(expected)) throw new Error(\`Expected \${val} to contain \${expected}\`);
          } else {
            throw new Error(\`Expected \${val} to contain \${expected}, but it is not a string or array\`);
          }
        }
      });

      try {
        const fn = new Function('pigeon', script);
        fn(context);
        
        event.source.postMessage({ 
          id, 
          type: 'success', 
          envDict,
          request: context.request, 
          results 
        }, event.origin);
      } catch (e) {
        event.source.postMessage({ id, type: 'error', error: e.message }, event.origin);
      }
    });
  </script>
</body>
</html>`;

function initSandbox() {
  if (sandboxIframe) return;
  sandboxIframe = document.createElement('iframe');
  sandboxIframe.style.display = 'none';
  sandboxIframe.sandbox = 'allow-scripts'; // Strict sandbox! No allow-same-origin
  const blob = new Blob([sandboxHTML], { type: 'text/html' });
  sandboxIframe.src = URL.createObjectURL(blob);
  document.body.appendChild(sandboxIframe);

  window.addEventListener('message', (event) => {
    if (event.source !== sandboxIframe?.contentWindow) return;
    const { id, type, error, envDict, request, results } = event.data;
    if (messageResolvers[id]) {
      if (type === 'error') {
        messageResolvers[id].reject(new Error(error));
      } else {
        messageResolvers[id].resolve({ envDict, request, results });
      }
      delete messageResolvers[id];
    }
  });
}

export const runPreRequestScript = async (script: string, context: PigeonContext, allVars: Record<string, string>) => {
  if (!script) return;
  initSandbox();
  
  const id = String(++messageIdCounter);
  const p = new Promise<{ envDict: Record<string, string>, request: any }>((resolve, reject) => {
    messageResolvers[id] = { resolve, reject };
  });
  
  sandboxIframe!.contentWindow!.postMessage({
    id,
    script,
    contextData: {
      env: allVars,
      request: context.request,
    }
  }, '*');
  
  try {
    const { envDict, request } = await p;
    // Apply changes back to original context
    for (const [k, v] of Object.entries(envDict)) {
      if (allVars[k] !== v) {
        context.env.set(k, v as string);
        allVars[k] = v as string;
      }
    }
    Object.assign(context.request, request);
  } catch (error) {
    console.error('Error executing pre-request script:', error);
    throw new Error(`Pre-request Script Error: ${(error as Error).message}`);
  }
};

export const runTestScript = async (script: string, context: PigeonContext, allVars: Record<string, string>): Promise<{ name: string; passed: boolean; error?: string }[]> => {
  if (!script) return [];
  initSandbox();
  
  const id = String(++messageIdCounter);
  const p = new Promise<{ envDict: Record<string, string>, results: any[] }>((resolve, reject) => {
    messageResolvers[id] = { resolve, reject };
  });
  
  sandboxIframe!.contentWindow!.postMessage({
    id,
    script,
    contextData: {
      env: allVars,
      request: context.request,
      response: context.response ? {
        status: context.response.status,
        headers: context.response.headers,
        bodyText: context.response.text()
      } : undefined
    }
  }, '*');
  
  try {
    const { envDict, results } = await p;
    for (const [k, v] of Object.entries(envDict)) {
      if (allVars[k] !== v) {
        context.env.set(k, v as string);
        allVars[k] = v as string;
      }
    }
    return results;
  } catch (error: any) {
    console.error('Error executing test script:', error);
    return [{ name: 'Script Execution', passed: false, error: error.message }];
  }
};
