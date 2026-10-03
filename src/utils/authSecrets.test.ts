import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Collection, Environment, RequestItem } from '../store';
import { useStore } from '../store';

const keychain = vi.hoisted(() => ({
  values: new Map<string, string>(),
  failWrites: false,
  deleteSecret: vi.fn(async (scope: string, key: string) => {
    keychain.values.delete(`${scope}:${key}`);
  })
}));

vi.mock('./secrets', () => ({
  createSecretReference: () => crypto.randomUUID(),
  setSecret: async (scope: string, key: string, value: string) => {
    if (keychain.failWrites) throw new Error('Keychain unavailable');
    keychain.values.set(`${scope}:${key}`, value);
  },
  getSecret: async (scope: string, key: string) => keychain.values.get(`${scope}:${key}`) ?? null,
  deleteSecret: keychain.deleteSecret
}));

import {
  deleteUnusedRequestSecrets,
  duplicateEnvironmentWithSecrets,
  secureImportedCollection,
  secureImportedEnvironment
} from './authSecrets';

const request: RequestItem = {
  id: 'request-1',
  name: 'Authenticated request',
  method: 'GET',
  url: 'https://example.test',
  headers: { Authorization: 'Bearer header-secret' },
  auth: { type: 'bearer', bearerToken: 'auth-secret' }
};

const collection: Collection = {
  id: 'collection-1',
  name: 'Example',
  requests: [request],
  isOpen: true
};

describe('Keychain secret boundaries', () => {
  beforeEach(() => {
    keychain.values.clear();
    keychain.failWrites = false;
    keychain.deleteSecret.mockClear();
  });

  it('moves imported auth fields to the keychain but keeps Authorization as a normal header', async () => {
    const secured = await secureImportedCollection(collection);
    const securedRequest = secured.requests[0];
    expect(securedRequest.auth?.bearerToken).toBe('');
    expect(securedRequest.auth?.bearerTokenInKeychain).toBe(true);
    expect(securedRequest.authorizationHeaderInKeychain).toBeUndefined();
    expect(securedRequest.headers).toEqual({ Authorization: 'Bearer header-secret' });
    expect(keychain.values.size).toBe(1);
  });

  it('preserves environment references and rolls back partial imports after keychain failure', async () => {
    keychain.failWrites = true;
    await expect(secureImportedCollection(collection)).rejects.toThrow('Keychain unavailable');
    expect(keychain.values.size).toBe(0);

    keychain.failWrites = false;
    const templateCollection = {
      ...collection,
      requests: [{ ...request, auth: { type: 'bearer' as const, bearerToken: '{{access_token}}' }, headers: {} }]
    };
    const secured = await secureImportedCollection(templateCollection);
    expect(secured.requests[0].auth?.bearerToken).toBe('{{access_token}}');
    expect(secured.requests[0].auth?.bearerTokenInKeychain).toBeUndefined();
  });

  it('secures secret-like environment imports and copies keychain values to a new environment ID', async () => {
    const imported: Environment = {
      id: 'source',
      name: 'Development',
      variables: [
        { id: 'var-1', key: 'api_token', value: 'token-value', enabled: true },
        { id: 'var-2', key: 'base_url', value: 'https://example.test', enabled: true }
      ]
    };
    const secured = await secureImportedEnvironment(imported);
    expect(secured.id).not.toBe(imported.id);
    expect(secured.variables[0]).toMatchObject({ secret: true, value: '' });
    expect(secured.variables[1].value).toBe('https://example.test');

    const secretKey = `${secured.id}:api_token`;
    expect(keychain.values.get(secretKey)).toBe('token-value');
    const duplicate = await duplicateEnvironmentWithSecrets(secured);
    expect(duplicate.id).not.toBe(secured.id);
    expect(keychain.values.get(`${duplicate.id}:api_token`)).toBe('token-value');
  });

  it('removes a deleted request credential only when no remaining request shares it', async () => {
    const secured = await secureImportedCollection(collection);
    const secretRequest = secured.requests[0];
    const reference = secretRequest.auth?.bearerTokenKeychainRef;
    expect(reference).toBeTruthy();

    const otherRequest = { ...secretRequest, id: 'request-2' };
    await deleteUnusedRequestSecrets([{ ...collection, requests: [otherRequest] }], [secretRequest]);
    expect(keychain.values.has(`request-auth:${reference}`)).toBe(true);

    await deleteUnusedRequestSecrets([{ ...collection, requests: [] }], [secretRequest]);
    expect(keychain.values.has(`request-auth:${reference}`)).toBe(false);
  });

  it('merges auth updates into the captured request without replacing newer fields', () => {
    const first = { ...request, auth: { type: 'bearer' as const, bearerTokenInKeychain: true, bearerTokenKeychainRef: 'ref-1' } };
    const second = { ...request, id: 'request-2', auth: { type: 'basic' as const, basicUsername: 'other-user' } };
    useStore.setState({ collections: [{ ...collection, requests: [first, second] }] });
    useStore.getState().updateRequestAuth(first.id, { apiKeyIn: 'query' });
    const [updatedFirst, unchangedSecond] = useStore.getState().collections[0].requests;
    expect(updatedFirst.auth).toMatchObject({
      type: 'bearer',
      bearerTokenInKeychain: true,
      bearerTokenKeychainRef: 'ref-1',
      apiKeyIn: 'query'
    });
    expect(unchangedSecond.auth).toEqual(second.auth);
    useStore.setState({ collections: [] });
  });

  it('does not duplicate secret variables when duplicating an environment', async () => {
    const environment: Environment = {
      id: 'env-1',
      name: 'Test Env',
      variables: [
        { id: 'var-1', key: 'plain_var', value: 'plain-value', enabled: true },
        { id: 'var-2', key: 'secret_var', value: '', secret: true, secretStored: true, enabled: true },
        { id: 'var-3', key: 'another_secret', value: '', secret: true, secretStored: true, enabled: true },
      ]
    };
    keychain.values.set('env-1:secret_var', 'secret-val-1');
    keychain.values.set('env-1:another_secret', 'secret-val-2');

    const duplicate = await duplicateEnvironmentWithSecrets(environment);
    expect(duplicate.variables).toHaveLength(3);
    const plain = duplicate.variables.find(v => v.key === 'plain_var');
    const secret1 = duplicate.variables.find(v => v.key === 'secret_var');
    const secret2 = duplicate.variables.find(v => v.key === 'another_secret');

    expect(plain?.value).toBe('plain-value');
    expect(secret1?.secretStored).toBe(true);
    expect(secret2?.secretStored).toBe(true);
  });
});
