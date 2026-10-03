export type PigeonErrorCode = 
  | 'AUTH_FAILURE'
  | 'NETWORK_FAILURE'
  | 'VALIDATION_FAILURE'
  | 'SCRIPT_FAILURE'
  | 'KEYCHAIN_FAILURE'
  | 'STORAGE_FAILURE'
  | 'UNKNOWN_ERROR';

export class PigeonError extends Error {
  code: PigeonErrorCode;
  remediation?: string;

  constructor(message: string, code: PigeonErrorCode = 'UNKNOWN_ERROR', remediation?: string) {
    super(message);
    this.name = 'PigeonError';
    this.code = code;
    this.remediation = remediation;
  }
}

export function formatPigeonError(error: unknown): string {
  if (error instanceof PigeonError) {
    let msg = `[${error.code}] ${error.message}`;
    if (error.remediation) {
      msg += `\n\nHint: ${error.remediation}`;
    }
    return msg;
  }
  
  if (error instanceof Error) {
    if (error.name === 'AbortError') return 'Request was cancelled by the user.';
    
    const technicalMessage = error.message;
    const isConnectionFailure = /error sending request for url|failed to fetch/i.test(technicalMessage);
    
    if (isConnectionFailure) {
      return [
        'The request failed before the server returned an HTTP response.',
        'Check that the API host is reachable and that your network, VPN, proxy, firewall, or TLS settings allow the connection.',
        `Technical details: ${technicalMessage}`,
      ].join('\n\n');
    }
    
    return `[${error.name || 'UNKNOWN_ERROR'}] ${error.message}`;
  }
  
  return `[UNKNOWN_ERROR] ${String(error)}`;
}
