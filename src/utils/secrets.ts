import { invoke } from '@tauri-apps/api/core';

export function createSecretReference(): string {
  return crypto.randomUUID();
}

import { PigeonError, type PigeonErrorCode } from './errors';

function handleKeychainError(err: unknown): never {
  if (typeof err === 'object' && err !== null && 'code' in err && 'message' in err) {
    const errorObj = err as { code: PigeonErrorCode; message: string; remediation?: string };
    throw new PigeonError(errorObj.message, errorObj.code, errorObj.remediation);
  }
  
  if (typeof err === 'string') {
    throw new PigeonError(err, 'KEYCHAIN_FAILURE');
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
