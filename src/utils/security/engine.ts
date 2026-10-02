import { fetch } from '@tauri-apps/plugin-http';

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'PASS';
export type TestCategory = 'BOLA' | 'MASS_ASSIGNMENT' | 'BROKEN_AUTH' | 'VERB_TAMPERING' | 'FUZZING';

export interface AuditFinding {
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
}

const sendAuditRequest = async (url: string, method: string, headers: Record<string, string>, body?: any) => {
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const responseText = await response.text();
    return { status: response.status, body: responseText };
  } catch (err: any) {
    return { status: 0, body: String(err) };
  }
};

export async function runSecurityAudit(
  base: SecurityAuditContext,
  attackerAuthHeader: string,
  onProgress: (msg: string) => void
): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];

  // 1. Broken Object Level Authorization (BOLA)
  if (attackerAuthHeader) {
    onProgress('Testing BOLA / IDOR...');
    const bolaHeaders = { ...base.headers, 'Authorization': attackerAuthHeader };
    const bolaRes = await sendAuditRequest(base.url, base.method, bolaHeaders, base.body);
    
    if (bolaRes.status >= 200 && bolaRes.status < 300) {
      findings.push({
        id: 'bola-1',
        category: 'BOLA',
        title: 'Broken Object Level Authorization (IDOR)',
        description: 'The server accepted a request for a resource using a different user\'s token.',
        risk: 'CRITICAL',
        remediation: 'Ensure the backend verifies that the requested resource ID belongs to the user associated with the provided token.',
        payloadSent: `Headers: { Authorization: ${attackerAuthHeader.substring(0, 15)}... }`
      });
    } else {
      findings.push({
        id: 'bola-pass',
        category: 'BOLA',
        title: 'BOLA / IDOR Check',
        description: `Server correctly rejected the secondary token with status ${bolaRes.status}.`,
        risk: 'PASS',
        remediation: '',
      });
    }
  }

  // 2. Broken Authentication
  onProgress('Testing Broken Authentication (Missing Auth)...');
  const noAuthHeaders = { ...base.headers };
  delete noAuthHeaders['Authorization'];
  delete noAuthHeaders['authorization'];
  
  const noAuthRes = await sendAuditRequest(base.url, base.method, noAuthHeaders, base.body);
  if (noAuthRes.status >= 200 && noAuthRes.status < 300) {
    findings.push({
      id: 'auth-1',
      category: 'BROKEN_AUTH',
      title: 'Missing Authentication',
      description: 'The endpoint returned a successful response even when the Authorization header was completely removed.',
      risk: 'CRITICAL',
      remediation: 'Enforce strict authentication middleware on this endpoint.',
      payloadSent: 'Headers: (Removed Authorization)'
    });
  } else {
    findings.push({
      id: 'auth-pass',
      category: 'BROKEN_AUTH',
      title: 'Authentication Check',
      description: `Server rejected unauthenticated request with status ${noAuthRes.status}.`,
      risk: 'PASS',
      remediation: '',
    });
  }

  // 3. Mass Assignment
  if (base.method !== 'GET' && base.body && typeof base.body === 'object') {
    onProgress('Testing Mass Assignment...');
    const maliciousBody = { 
      ...base.body, 
      is_admin: true, 
      role: 'admin',
      permissions: 'superadmin' 
    };
    const massRes = await sendAuditRequest(base.url, base.method, base.headers, maliciousBody);
    if (massRes.status >= 200 && massRes.status < 300) {
      findings.push({
        id: 'mass-1',
        category: 'MASS_ASSIGNMENT',
        title: 'Mass Assignment / Property Injection',
        description: 'The server accepted an injected payload containing restricted privilege flags (e.g. is_admin: true).',
        risk: 'HIGH',
        remediation: 'Use strict schema validation (e.g., Zod or Joi) to explicitly reject unknown or protected properties.',
        payloadSent: JSON.stringify(maliciousBody, null, 2)
      });
    }
  }

  // 4. Verb Tampering
  onProgress('Testing HTTP Verb Tampering...');
  const verbsToTest = ['DELETE', 'PUT', 'PATCH'].filter(v => v !== base.method);
  for (const verb of verbsToTest) {
    const verbRes = await sendAuditRequest(base.url, verb, base.headers, base.body);
    if (verbRes.status >= 200 && verbRes.status < 300) {
      findings.push({
        id: `verb-${verb}`,
        category: 'VERB_TAMPERING',
        title: `Broken Function Level Auth (${verb})`,
        description: `The endpoint unexpectedly allowed a ${verb} request.`,
        risk: 'HIGH',
        remediation: `Ensure routing strictly denies ${verb} methods for this path unless explicitly authorized.`,
        payloadSent: `Method: ${verb}`
      });
    }
  }

  // 5. 1-Click Fuzzer
  onProgress('Fuzzing endpoint stability...');
  const fuzzedBodies = [
    null,
    {},
    { id: "' OR 1=1 --" },
    { test: "A".repeat(10000) }
  ];
  
  if (base.method !== 'GET') {
    let fuzzerCrashes = 0;
    await Promise.all(fuzzedBodies.map(async (fuzzBody) => {
      const res = await sendAuditRequest(base.url, base.method, base.headers, fuzzBody);
      if (res.status >= 500) fuzzerCrashes++;
    }));
    
    if (fuzzerCrashes > 0) {
      findings.push({
        id: 'fuzz-1',
        category: 'FUZZING',
        title: 'Server Instability Detected',
        description: `The server crashed (${fuzzerCrashes} times) and returned a 500 Error when presented with malformed edge-case payloads.`,
        risk: 'MEDIUM',
        remediation: 'Implement robust global error handling to prevent 500 crashes and avoid leaking stack traces.',
      });
    } else {
      findings.push({
        id: 'fuzz-pass',
        category: 'FUZZING',
        title: 'Fuzzing Check',
        description: 'Server gracefully handled all malformed edge-case payloads without crashing.',
        risk: 'PASS',
        remediation: '',
      });
    }
  }

  onProgress('Audit Complete.');
  return findings;
}
