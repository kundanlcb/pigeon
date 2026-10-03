import { invoke } from '@tauri-apps/api/core';

export function createSecretReference(): string {
  return crypto.randomUUID();
}

export class KeychainError extends Error {
  code: 'UNAVAILABLE' | 'ACCESS_DENIED' | 'ERROR';

  constructor(code: 'UNAVAILABLE' | 'ACCESS_DENIED' | 'ERROR', message: string) {
    super(message);
    this.code = code;
    this.name = 'KeychainError';
  }
}

function handleKeychainError(err: unknown): never {
  if (typeof err === 'string') {
    if (err.startsWith('KEYCHAIN_UNAVAILABLE')) {
      throw new KeychainError('UNAVAILABLE', 'No system keychain available — secret not saved');
    }
    if (err.startsWith('KEYCHAIN_ACCESS_DENIED')) {
      throw new KeychainError('ACCESS_DENIED', 'Could not access stored credential — request not sent');
    }
    throw new KeychainError('ERROR', err.replace(/^KEYCHAIN_ERROR:\s*/, ''));
  }
  throw err;
}

export async function setSecret(scope: string, key: string, value: string): Promise<void> {
  if (!('__TAURI_INTERNALS__' in window)) {
    throw new Error('System keychain is only available in the desktop app.');
  }
  await invoke('set_secret', { scope, key, value }).catch(handleKeychainError);
}

export async function getSecret(scope: string, key: string): Promise<string | null> {
  if (!('__TAURI_INTERNALS__' in window)) {
    throw new Error('System keychain is only available in the desktop app.');
  }
  return await invoke<string | null>('get_secret', { scope, key }).catch(handleKeychainError);
}

export async function deleteSecret(scope: string, key: string): Promise<void> {
  if (!('__TAURI_INTERNALS__' in window)) {
    console.warn('Tauri API not available. Cannot delete secrets from the OS keychain.');
    return;
  }
  await invoke('delete_secret', { scope, key }).catch(handleKeychainError);
}
