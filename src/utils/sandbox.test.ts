import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vm from 'vm';
import { runPreRequestScript, runTestScript, sandboxScript, type PigeonContext } from './sandbox';

describe('Sandbox API Execution', () => {
  let originalWindow: any;
  let originalDocument: any;
  let originalURL: any;
  let originalBlob: any;

  beforeEach(() => {
    originalWindow = global.window;
    originalDocument = global.document;
    originalURL = global.URL;
    originalBlob = global.Blob;

    const parentListeners: Record<string, Function[]> = {};
    let iframeContentWindow: any = null;

    global.window = {
      addEventListener: (evt: string, handler: Function) => {
        if (!parentListeners[evt]) parentListeners[evt] = [];
        parentListeners[evt].push(handler);
      }
    } as any;

    global.URL = {
      createObjectURL: () => 'blob:mock-url'
    } as any;
    
    global.Blob = class Blob {
      constructor(public parts: any[], public options: any) {}
    } as any;

    global.document = {
      createElement: (tag: string) => {
        if (tag === 'iframe') {
          const iframe = {
            style: {},
            sandbox: '',
            src: '',
            get contentWindow() {
              return iframeContentWindow;
            }
          };
          
          iframeContentWindow = {
            postMessage: (msg: any, _targetOrigin: string) => {
              const mockIframeWindow = {
                addEventListener: (evt: string, handler: Function) => {
                  if (evt === 'message') {
                    // Trigger the message event inside the iframe asynchronously 
                    // to match real postMessage behavior
                    Promise.resolve().then(() => {
                      handler({
                        data: JSON.parse(JSON.stringify(msg)),
                        source: {
                          postMessage: (responseMsg: any, _origin: string) => {
                            Promise.resolve().then(() => {
                              parentListeners['message']?.forEach(l => l({
                                source: iframeContentWindow,
                                data: JSON.parse(JSON.stringify(responseMsg))
                              }));
                            });
                          }
                        },
                        origin: '*'
                      });
                    });
                  }
                }
              };
              vm.runInNewContext(sandboxScript, { window: mockIframeWindow });
            }
          };
          return iframe;
        }
        return {};
      },
      body: {
        appendChild: () => {}
      }
    } as any;
  });

  afterEach(() => {
    global.window = originalWindow;
    global.document = originalDocument;
    global.URL = originalURL;
    global.Blob = originalBlob;
    
    // Reset internal sandbox state
    import('./sandbox').then(m => m.resetSandbox());
  });

  it('should run pre-request script and mutate environment', async () => {
    const context: PigeonContext = {
      env: {
        get: () => undefined,
        set: vi.fn()
      },
      request: {
        headers: {},
        url: 'http://example.com',
        method: 'GET',
        body: null
      }
    };

    const allVars = { 'FOO': 'bar' };
    const script = `
      pigeon.env.set("FOO", "baz");
      pigeon.env.set("NEW", "val");
    `;

    await runPreRequestScript(script, context, allVars);

    expect(allVars).toEqual({ 'FOO': 'baz', 'NEW': 'val' });
    expect(context.env.set).toHaveBeenCalledWith('FOO', 'baz');
    expect(context.env.set).toHaveBeenCalledWith('NEW', 'val');
  });

  it('should run test script and handle expects', async () => {
    const context: PigeonContext = {
      env: {
        get: () => undefined,
        set: vi.fn()
      },
      request: {
        headers: {},
        url: 'http://example.com',
        method: 'GET',
        body: null
      },
      response: {
        status: 200,
        text: () => '',
        json: () => ({}),
        headers: {}
      }
    };

    const script = `
      pigeon.test("Success test", () => {
         pigeon.expect(200).toEqual(200);
         pigeon.expect("hello").toContain("ell");
      });
      pigeon.test("Failing test", () => {
         pigeon.expect(400).toEqual(200);
      });
    `;

    const results = await runTestScript(script, context, {});

    expect(results).toHaveLength(2);
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(false);
    expect(results[1].error).toContain('Expected 200 but got 400');
  });
});
