import { describe, expect, it } from 'vitest';
import { getResponseStatusText } from './request';
import { formatPigeonError } from './errors';

describe('getResponseStatusText', () => {
  it('keeps the response status text when provided', () => {
    expect(getResponseStatusText(418, 'Custom status')).toBe('Custom status');
  });

  it('uses a standard label when the response status text is empty', () => {
    expect(getResponseStatusText(404, '')).toBe('Not Found');
    expect(getResponseStatusText(503, '   ')).toBe('Service Unavailable');
  });

  it('uses the status code when there is no known label', () => {
    expect(getResponseStatusText(599, '')).toBe('HTTP 599');
  });
});

describe('formatPigeonError', () => {
  it('explains generic connection failures and preserves the technical detail', () => {
    const technicalMessage = new Error('error sending request for url (https://api.example.com/resource)');
    const formatted = formatPigeonError(technicalMessage);

    expect(formatted).toContain('before the server returned an HTTP response');
    expect(formatted).toContain('network, VPN, proxy, firewall, or TLS');
    expect(formatted).toContain(`Technical details: ${technicalMessage.message}`);
  });

  it('keeps specific error messages intact', () => {
    expect(formatPigeonError(new Error('Request timed out after 30 seconds')))
      .toBe('[Error] Request timed out after 30 seconds');
  });
});