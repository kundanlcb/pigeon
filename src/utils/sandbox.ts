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

export const runPreRequestScript = (script: string, context: PigeonContext) => {
  if (!script) return;
  try {
    const fn = new Function('pigeon', script);
    fn(context);
  } catch (error) {
    console.error('Error executing pre-request script:', error);
    throw new Error(`Pre-request Script Error: ${(error as Error).message}`);
  }
};

export const runTestScript = (script: string, context: PigeonContext): { name: string; passed: boolean; error?: string }[] => {
  if (!script) return [];
  const results: { name: string; passed: boolean; error?: string }[] = [];
  
  context.test = (name: string, fn: () => void) => {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (error: any) {
      results.push({ name, passed: false, error: error.message });
    }
  };

  context.expect = (val: any) => ({
    toEqual: (expected: any) => {
      if (val !== expected) throw new Error(`Expected ${expected} but got ${val}`);
    },
    toBeGreaterThan: (expected: number) => {
      if (val <= expected) throw new Error(`Expected ${val} to be greater than ${expected}`);
    },
    toBeLessThan: (expected: number) => {
      if (val >= expected) throw new Error(`Expected ${val} to be less than ${expected}`);
    },
    toContain: (expected: any) => {
      if (!val.includes(expected)) throw new Error(`Expected ${val} to contain ${expected}`);
    }
  });

  try {
    const fn = new Function('pigeon', script);
    fn(context);
  } catch (error) {
    console.error('Error executing test script:', error);
    results.push({ name: 'Script Execution', passed: false, error: (error as Error).message });
  }

  return results;
};
