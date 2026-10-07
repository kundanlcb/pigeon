import { fetch } from '@tauri-apps/plugin-http';
import { getSecret } from '../secrets';

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'PASS';
export type TestCategory = 'BOLA' | 'MASS_ASSIGNMENT' | 'BROKEN_AUTH' | 'VERB_TAMPERING' | 'FUZZING';

export interface AuditFinding {
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  statusCode?: number;
  responseTime?: number;
  id: string;
  category: TestCategory;
  title: string;
  description: string;
  risk: RiskLevel;
  remediation: string;
  payloadSent?: string;
}

export interface SecurityAuditContext {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  authorizationHeaderKeychainRef?: string;
}

export interface SecurityAuditConfig {
  authHeaderName: string;
  testBOLA: boolean;
  attackerAuthHeader: string;
  testBrokenAuth: boolean;
  testMassAssignment: boolean;
  testVerbTampering: boolean;
  testFuzzing: boolean;
}

const sendAuditRequest = async (url: string, method: string, headers: Record<string, string>, body?: any, signal?: AbortSignal) => {
  try {
    if (signal?.aborted) throw { name: 'AbortError', message: 'Manual abort' };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for non-prod environments
    
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        controller.abort();
      });
    }

    const startTime = Date.now();
    const requestPromise = fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    const response = await requestPromise;
    clearTimeout(timeoutId);
    
    const responseText = await response.text();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    return { status: response.status, body: responseText, duration: Date.now() - startTime, headers: responseHeaders };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { status: 0, body: 'Request timed out or aborted', duration: 60000, headers: {} };
    }
    return { status: 0, body: String(err), duration: 0, headers: {} };
  }
};

export async function runSecurityAudit(
  base: SecurityAuditContext,
  config: SecurityAuditConfig,
  onProgress: (msg: string) => void,
  abortSignal?: AbortSignal
): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];

  const checkAbort = () => {
    if (abortSignal?.aborted) throw new Error('Audit manually aborted by user.');
  };
  
  // Resolve keychain auth header for baseline if needed
  const resolvedBase = { ...base, headers: { ...base.headers } };
  const hasAuthHeader = Object.keys(resolvedBase.headers).some(key => key.toLowerCase() === config.authHeaderName.toLowerCase());
  if (base.authorizationHeaderKeychainRef && !hasAuthHeader) {
    try {
      const secret = await getSecret('request-auth', base.authorizationHeaderKeychainRef!);
      if (secret) {
        // Find existing auth header name or default to configured
        const existingAuthKey = Object.keys(resolvedBase.headers).find(
          key => key.toLowerCase() === config.authHeaderName.toLowerCase()
        ) || config.authHeaderName;
        resolvedBase.headers[existingAuthKey] = secret;
      } else {
        onProgress('[!] Warning: Authorization header could not be resolved from system keychain.');
      }
    } catch (e) {
      onProgress(`[!] Warning: Failed to access system keychain - ${e}`);
    }
  }

  // 0. Pre-flight Liveness Check
  checkAbort();
  onProgress('[*] Establishing baseline connection (Pre-flight)...');
  const baselineRes = await sendAuditRequest(resolvedBase.url, resolvedBase.method, resolvedBase.headers, resolvedBase.body, abortSignal);
  if (baselineRes.status === 0) {
    findings.push({
      id: 'baseline-fail',
      category: 'BOLA', // Reusing category type
      title: 'Baseline Connection Failed',
      description: `The security engine could not establish a connection to ${resolvedBase.url}. The request may have timed out, or the server is completely unresponsive.`,
      risk: 'CRITICAL',
      remediation: 'Ensure the server is running and the URL is correct before attempting a security audit.',
      payloadSent: `Error Details: ${baselineRes.body}`, requestHeaders: resolvedBase.headers, requestBody: resolvedBase.body, responseHeaders: baselineRes.headers, responseBody: baselineRes.body, statusCode: baselineRes.status, responseTime: baselineRes.duration});
    onProgress(`[!] Audit Aborted: Target Unreachable (${baselineRes.body}).`);
    return findings;
  }
  onProgress(`[✓] Baseline connection successful [${baselineRes.status}] (${baselineRes.duration}ms).`);

  // 1. Broken Object Level Authorization (BOLA)
  checkAbort();
  if (config.testBOLA && config.attackerAuthHeader) {
    onProgress('[*] Queueing BOLA / IDOR test...');
    const bolaHeaders = { ...resolvedBase.headers };
    
    // Remove the original auth header case-insensitively so the attacker token takes precedence
    const bolaHeaderKeyToRemove = Object.keys(bolaHeaders).find(
      key => key.toLowerCase() === config.authHeaderName.toLowerCase()
    );
    if (bolaHeaderKeyToRemove) {
      delete bolaHeaders[bolaHeaderKeyToRemove];
    }
    
    bolaHeaders[config.authHeaderName] = config.attackerAuthHeader;
    const bolaRes = await sendAuditRequest(resolvedBase.url, resolvedBase.method, bolaHeaders, resolvedBase.body, abortSignal);
    
    if (bolaRes.status >= 200 && bolaRes.status < 300) {
      onProgress(`[!] BOLA test failed: Endpoint accepted secondary token [${bolaRes.status}]`);
      findings.push({
        id: 'bola-1',
        category: 'BOLA',
        title: 'Broken Object Level Authorization (IDOR)',
        description: 'The server accepted a request for a resource using a different user\'s token.',
        risk: 'CRITICAL',
        remediation: 'Ensure the backend verifies that the requested resource ID belongs to the user associated with the provided token.',
        payloadSent: `Headers: { ${config.authHeaderName}: ${config.attackerAuthHeader.substring(0, 15)}... }`, requestHeaders: bolaHeaders, requestBody: resolvedBase.body, responseHeaders: bolaRes.headers, responseBody: bolaRes.body, statusCode: bolaRes.status, responseTime: bolaRes.duration});
    } else {
      findings.push({
        id: 'bola-pass',
        category: 'BOLA',
        title: 'BOLA / IDOR Check',
        description: `Server correctly rejected the secondary token with status ${bolaRes.status}.`,
        risk: 'PASS',
        remediation: '', requestHeaders: bolaHeaders, requestBody: resolvedBase.body, responseHeaders: bolaRes.headers, responseBody: bolaRes.body, statusCode: bolaRes.status, responseTime: bolaRes.duration});
      onProgress(`[✓] BOLA test passed: Server rejected secondary token [${bolaRes.status}]`);
    }
  } else if (!config.testBOLA) {
    onProgress('[-] Skipping BOLA test (Disabled).');
  }

  // 2. Broken Authentication
  checkAbort();
  if (config.testBrokenAuth) {
    onProgress(`[*] Queueing Broken Authentication test (Stripping ${config.authHeaderName})...`);
    const noAuthHeaders = { ...resolvedBase.headers };
    
    // Attempt to remove the configured auth header (case-insensitive)
    const headerKeyToRemove = Object.keys(noAuthHeaders).find(
      key => key.toLowerCase() === config.authHeaderName.toLowerCase()
    );
    if (headerKeyToRemove) {
      delete noAuthHeaders[headerKeyToRemove];
    }
    
    const noAuthRes = await sendAuditRequest(resolvedBase.url, resolvedBase.method, noAuthHeaders, resolvedBase.body, abortSignal);
    if (noAuthRes.status >= 200 && noAuthRes.status < 300) {
      onProgress(`[!] Broken Authentication test failed: Endpoint allowed unauthenticated access [${noAuthRes.status}]`);
      findings.push({
        id: 'auth-1',
        category: 'BROKEN_AUTH',
        title: 'Missing Authentication',
        description: `The endpoint returned a successful response even when the ${config.authHeaderName} header was completely removed.`,
        risk: 'CRITICAL',
        remediation: 'Enforce strict authentication middleware on this endpoint.',
        payloadSent: `Headers: (Removed ${config.authHeaderName})`, requestHeaders: noAuthHeaders, requestBody: resolvedBase.body, responseHeaders: noAuthRes.headers, responseBody: noAuthRes.body, statusCode: noAuthRes.status, responseTime: noAuthRes.duration});
    } else {
      onProgress(`[✓] Broken Authentication test passed: Server rejected missing auth [${noAuthRes.status}]`);
      findings.push({
        id: 'auth-pass',
        category: 'BROKEN_AUTH',
        title: 'Authentication Check',
        description: `Server rejected unauthenticated request with status ${noAuthRes.status}.`,
        risk: 'PASS',
        remediation: '', requestHeaders: noAuthHeaders, requestBody: resolvedBase.body, responseHeaders: noAuthRes.headers, responseBody: noAuthRes.body, statusCode: noAuthRes.status, responseTime: noAuthRes.duration});
    }
  } else {
    onProgress('[-] Skipping Broken Authentication test (Disabled).');
  }

  // 3. Mass Assignment
  checkAbort();
  if (config.testMassAssignment && resolvedBase.method !== 'GET' && resolvedBase.body && typeof resolvedBase.body === 'object') {
    onProgress('[*] Queueing Mass Assignment test...');
    const maliciousBody = { 
      ...resolvedBase.body, 
      is_admin: true, 
      role: 'admin',
      permissions: 'superadmin' 
    };
    const massRes = await sendAuditRequest(resolvedBase.url, resolvedBase.method, resolvedBase.headers, maliciousBody, abortSignal);
    if (massRes.status >= 200 && massRes.status < 300) {
      onProgress(`[!] Mass Assignment test failed: Server accepted injected privilege flags [${massRes.status}]`);
      findings.push({
        id: 'mass-1',
        category: 'MASS_ASSIGNMENT',
        title: 'Mass Assignment / Property Injection',
        description: 'The server accepted an injected payload containing restricted privilege flags (e.g. is_admin: true).',
        risk: 'HIGH',
        remediation: 'Use strict schema validation (e.g., Zod or Joi) to explicitly reject unknown or protected properties.',
        payloadSent: JSON.stringify(maliciousBody, null, 2), requestHeaders: resolvedBase.headers, requestBody: resolvedBase.body, responseHeaders: baselineRes.headers, responseBody: baselineRes.body, statusCode: baselineRes.status, responseTime: baselineRes.duration});
    } else {
      onProgress(`[✓] Mass Assignment test passed: Server rejected injected flags [${massRes.status}]`);
    }
  } else if (!config.testMassAssignment) {
    onProgress('[-] Skipping Mass Assignment test (Disabled).');
  } else {
    onProgress('[-] Skipping Mass Assignment test (Not applicable to GET/empty requests).');
  }

  // 4. Verb Tampering
  checkAbort();
  if (config.testVerbTampering) {
    onProgress('[*] Queueing HTTP Verb Tampering tests...');
    const verbsToTest = ['DELETE', 'PUT', 'PATCH'].filter(v => v !== resolvedBase.method);
    let verbFailures = 0;
    for (const verb of verbsToTest) {
      checkAbort();
      onProgress(`    [*] Testing method: ${verb}...`);
      const verbRes = await sendAuditRequest(resolvedBase.url, verb, resolvedBase.headers, resolvedBase.body, abortSignal);
      if (verbRes.status >= 200 && verbRes.status < 300) {
        verbFailures++;
        onProgress(`    [!] Verb Tampering failed: Endpoint unexpectedly allowed ${verb} [${verbRes.status}]`);
        findings.push({
          id: `verb-${verb}`,
          category: 'VERB_TAMPERING',
          title: `Broken Function Level Auth (${verb})`,
          description: `The endpoint unexpectedly allowed a ${verb} request.`,
          risk: 'HIGH',
          remediation: `Ensure routing strictly denies ${verb} methods for this path unless explicitly authorized.`,
          payloadSent: `Method: ${verb}`, requestHeaders: resolvedBase.headers, requestBody: resolvedBase.body, responseHeaders: baselineRes.headers, responseBody: baselineRes.body, statusCode: baselineRes.status, responseTime: baselineRes.duration});
      } else {
        onProgress(`    [✓] Server correctly rejected ${verb} [${verbRes.status}]`);
      }
    }
    if (verbFailures === 0) {
      onProgress(`[✓] Verb Tampering tests passed.`);
    }
  } else {
    onProgress('[-] Skipping HTTP Verb Tampering tests (Disabled).');
  }

  // 5. 1-Click Fuzzer
  checkAbort();
  if (config.testFuzzing) {
    onProgress('[*] Queueing 1-Click Fuzzer (Edge-case payloads)...');
    const fuzzedBodies = [
      null,
      {},
      { id: "' OR 1=1 --" },
      { test: "A".repeat(10000) }
    ];
    
    if (resolvedBase.method !== 'GET') {
      let fuzzerCrashes = 0;
      let executed = 0;
      await Promise.all(fuzzedBodies.map(async (fuzzBody) => {
        checkAbort();
        const res = await sendAuditRequest(resolvedBase.url, resolvedBase.method, resolvedBase.headers, fuzzBody, abortSignal);
        executed++;
        onProgress(`    [*] Fuzz payload ${executed}/${fuzzedBodies.length} completed [${res.status}].`);
        if (res.status >= 500) fuzzerCrashes++;
      }));
      
      if (fuzzerCrashes > 0) {
        onProgress(`[!] Fuzzer test failed: Server crashed ${fuzzerCrashes} time(s).`);
        findings.push({
          id: 'fuzz-1',
          category: 'FUZZING',
          title: 'Server Instability Detected',
          description: `The server crashed (${fuzzerCrashes} times) and returned a 500 Error when presented with malformed edge-case payloads.`,
          risk: 'MEDIUM',
          remediation: 'Implement robust global error handling to prevent 500 crashes and avoid leaking stack traces.', requestHeaders: resolvedBase.headers, requestBody: resolvedBase.body, responseHeaders: baselineRes.headers, responseBody: baselineRes.body, statusCode: baselineRes.status, responseTime: baselineRes.duration});
      } else {
        onProgress(`[✓] Fuzzer test passed: No crashes detected.`);
        findings.push({
          id: 'fuzz-pass',
          category: 'FUZZING',
          title: 'Fuzzing Check',
          description: 'Server gracefully handled all malformed edge-case payloads without crashing.',
          risk: 'PASS',
          remediation: '', requestHeaders: resolvedBase.headers, requestBody: resolvedBase.body, responseHeaders: baselineRes.headers, responseBody: baselineRes.body, statusCode: baselineRes.status, responseTime: baselineRes.duration});
      }
    } else {
      onProgress('[-] Skipping Fuzzer test (Not applicable to GET requests).');
    }
  } else {
    onProgress('[-] Skipping 1-Click Fuzzer (Disabled).');
  }

  onProgress('[🏁] Audit Matrix Execution Complete.');
  return findings;
}
