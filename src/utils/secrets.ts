import { invoke } from '@tauri-apps/api/core';

export function createSecretReference(): string {
  return crypto.randomUUID();
}

export async function setSecret(scope: string, key: string, value: string): Promise<void> {
  if (!('__TAURI_INTERNALS__' in window)) {
    throw new Error('System keychain is only available in the desktop app.');
  }
  await invoke('set_secret', { scope, key, value });
}

export async function getSecret(scope: string, key: string): Promise<string | null> {
  if (!('__TAURI_INTERNALS__' in window)) {
    throw new Error('System keychain is only available in the desktop app.');
  }
  return await invoke('get_secret', { scope, key });
}

export async function deleteSecret(scope: string, key: string): Promise<void> {
  if (!('__TAURI_INTERNALS__' in window)) {
    console.warn('Tauri API not available. Cannot delete secrets from the OS keychain.');
    return;
  }
  await invoke('delete_secret', { scope, key });
}
