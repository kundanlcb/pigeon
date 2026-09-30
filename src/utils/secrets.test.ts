// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setSecret, getSecret, deleteSecret, createSecretReference } from './secrets';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

describe('Secrets Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate Tauri desktop environment
    if (typeof window === 'undefined') {
      (global as any).window = {};
    }
    (window as any).__TAURI_INTERNALS__ = true;
    vi.stubGlobal('crypto', { randomUUID: () => 'mock-uuid-1234' });
  });

  it('should generate a secret reference', () => {
    const ref = createSecretReference();
    expect(ref).toBeDefined();
    expect(typeof ref).toBe('string');
    expect(ref.length).toBeGreaterThan(0);
  });

  it('should invoke set_secret successfully', async () => {
    (invoke as any).mockResolvedValue(undefined);
    await expect(setSecret('env-123', 'MY_API_KEY', 'super_secret')).resolves.not.toThrow();
    expect(invoke).toHaveBeenCalledWith('set_secret', {
      scope: 'env-123',
      key: 'MY_API_KEY',
      value: 'super_secret'
    });
  });

  it('should invoke get_secret successfully and return the value', async () => {
    (invoke as any).mockResolvedValue('super_secret');
    const value = await getSecret('env-123', 'MY_API_KEY');
    expect(invoke).toHaveBeenCalledWith('get_secret', {
      scope: 'env-123',
      key: 'MY_API_KEY'
    });
    expect(value).toBe('super_secret');
  });

  it('should invoke delete_secret successfully', async () => {
    (invoke as any).mockResolvedValue(undefined);
    await expect(deleteSecret('env-123', 'MY_API_KEY')).resolves.not.toThrow();
    expect(invoke).toHaveBeenCalledWith('delete_secret', {
      scope: 'env-123',
      key: 'MY_API_KEY'
    });
  });

  it('should throw error when setting secret if not in Tauri environment', async () => {
    delete (window as any).__TAURI_INTERNALS__;
    await expect(setSecret('env-123', 'MY_API_KEY', 'super_secret')).rejects.toThrow('System keychain is only available in the desktop app.');
  });

  it('should throw error when getting secret if not in Tauri environment', async () => {
    delete (window as any).__TAURI_INTERNALS__;
    await expect(getSecret('env-123', 'MY_API_KEY')).rejects.toThrow('System keychain is only available in the desktop app.');
  });
});
