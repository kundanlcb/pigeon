// @ts-nocheck
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

describe('Sandbox Inner Execution Logic', () => {
  it('should correctly evaluate the sandbox HTML script and handle mutations', () => {
    // Read sandbox.ts to extract the sandboxHTML content
    const sandboxTs = fs.readFileSync(path.join(__dirname, 'sandbox.ts'), 'utf8');
    const htmlMatch = sandboxTs.match(/const sandboxHTML = `([\s\S]*?)`;/);
    expect(htmlMatch).toBeTruthy();
    
    const scriptMatch = htmlMatch![1].match(/<script>([\s\S]*?)<\/script>/s);
    expect(scriptMatch).toBeTruthy();
    
    // This is the actual code that runs inside the iframe
    const rawIframeScript = scriptMatch![1].replace(/\\\$/g, '$').replace(/\\`/g, '`');
    
    // We simulate the iframe environment using Node's vm module
    let postedMessage: any = null;
    const mockWindow = {
      addEventListener: (evt: string, handler: Function) => {
        if (evt === 'message') {
          // Simulate the parent sending a script to execute
          handler({
            data: {
              id: 'test-id-123',
              script: `
                pigeon.env.set("FOO", "baz");
                pigeon.env.set("NEW", "val");
              `,
              contextData: {
                env: { 'FOO': 'bar' },
                request: { url: 'http://example.com' }
              }
            },
            source: {
              postMessage: (msg: any) => {
                postedMessage = msg;
              }
            },
            origin: '*'
          });
        }
      }
    };

    // Evaluate the sandbox logic
    vm.runInNewContext(rawIframeScript, { window: mockWindow });

    // Verify the sandbox correctly executed the script and responded
    expect(postedMessage).toBeTruthy();
    expect(postedMessage.id).toBe('test-id-123');
    expect(postedMessage.type).toBe('success');
    expect(postedMessage.envDict).toEqual({ 'FOO': 'baz', 'NEW': 'val' });
    expect(postedMessage.request.url).toBe('http://example.com');
  });

  it('should correctly evaluate test blocks and handle expects', () => {
    const sandboxTs = fs.readFileSync(path.join(__dirname, 'sandbox.ts'), 'utf8');
    const htmlMatch = sandboxTs.match(/const sandboxHTML = `([\s\S]*?)`;/);
    const scriptMatch = htmlMatch![1].match(/<script>([\s\S]*?)<\/script>/s);
    const rawIframeScript = scriptMatch![1].replace(/\\\$/g, '$').replace(/\\`/g, '`');
    
    let postedMessage: any = null;
    const mockWindow = {
      addEventListener: (_evt: string, handler: Function) => {
        handler({
          data: {
            id: 'test-id-124',
            script: `
              pigeon.test("Success test", () => {
                 pigeon.expect(200).toEqual(200);
                 pigeon.expect("hello").toContain("ell");
              });
              pigeon.test("Failing test", () => {
                 pigeon.expect(400).toEqual(200);
              });
            `,
            contextData: {
              env: {},
              request: { url: 'http://example.com' }
            }
          },
          source: { postMessage: (msg: any) => { postedMessage = msg; } }
        });
      }
    };

    vm.runInNewContext(rawIframeScript, { window: mockWindow });

    expect(postedMessage).toBeTruthy();
    expect(postedMessage.type).toBe('success');
    expect(postedMessage.results).toHaveLength(2);
    expect(postedMessage.results[0].passed).toBe(true);
    expect(postedMessage.results[1].passed).toBe(false);
    expect(postedMessage.results[1].error).toContain('Expected 200 but got 400');
  });
});
