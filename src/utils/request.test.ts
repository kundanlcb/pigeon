import { describe, expect, it } from 'vitest';
import { getResponseStatusText } from './request';

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