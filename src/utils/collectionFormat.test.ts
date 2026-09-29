import { describe, expect, it } from 'vitest';
import type { Collection, RequestItem } from '../store';
import {
  parseManifest,
  parseRequest,
  requestRelativePath,
  serializePortableEnvironment,
  serializeManifest,
  serializePortableCollection,
  serializeRequest,
  stableJson
} from './collectionFormat';
import { getEnabledRequestHeaders } from './request';
import { removeDisabledQueryParams } from './url';

const collection: Collection = {
  id: 'collection-1',
  name: 'Example API',
  isOpen: true,
  folders: [
    { id: 'folder-2', name: 'Users', parentId: 'folder-1', order: 0 },
    { id: 'folder-1', name: 'API', parentId: null, order: 0 }
  ],
  requests: []
};

const request: RequestItem = {
  id: 'request-1',
  name: 'Get user',
  method: 'GET',
  url: 'https://example.test/users/1',
  headers: {},
  folderId: 'folder-2',
  order: 2
};

describe('collection file format', () => {
  it('serializes object keys deterministically while preserving array order', () => {
    expect(stableJson({ z: 1, a: [{ b: 2, a: 1 }] })).toBe(stableJson({ a: [{ a: 1, b: 2 }], z: 1 }));
    expect(stableJson({ values: ['second', 'first'] })).not.toBe(stableJson({ values: ['first', 'second'] }));
  });

  it('round-trips a nested, ordered folder manifest', () => {
    const parsed = parseManifest(serializeManifest(collection));
    expect(parsed.id).toBe(collection.id);
    expect(parsed.folders.map(folder => folder.id)).toEqual(['folder-1', 'folder-2']);
    expect(parsed.folders[1].parentId).toBe('folder-1');
  });

  it('rejects folder cycles and unsafe identifiers', () => {
    expect(() => serializeManifest({
      ...collection,
      folders: [
        { id: 'folder-1', name: 'One', parentId: 'folder-2', order: 0 },
        { id: 'folder-2', name: 'Two', parentId: 'folder-1', order: 0 }
      ]
    })).toThrow(/cycle/i);
    expect(() => requestRelativePath({ ...request, id: '../outside' }, collection.folders || [])).toThrow(/ID/i);
  });

  it('places each request in the directory matching its nested folder path', () => {
    expect(requestRelativePath(request, collection.folders || []))
      .toBe('requests/api--folder-1/users--folder-2/request-1.json');
  });

  it('omits keychain-backed auth values and refuses unsaved plaintext credentials', () => {
    const safe = serializeRequest({
      ...request,
      auth: {
        type: 'bearer',
        bearerToken: 'never-write-this',
        bearerTokenInKeychain: true,
        bearerTokenKeychainRef: 'credential-ref'
      }
    });
    expect(safe).not.toContain('never-write-this');
    expect(JSON.parse(safe).auth).not.toHaveProperty('bearerToken');
    expect(JSON.parse(safe).auth.bearerTokenKeychainRef).toBe('credential-ref');
    expect(() => serializeRequest({ ...request, auth: { type: 'bearer', bearerToken: 'plaintext' } }))
      .toThrow(/system keychain/i);
    expect(() => parseRequest(JSON.stringify({
      ...request,
      auth: { type: 'bearer', bearerToken: 'plaintext' }
    }))).toThrow(/plaintext/i);
    expect(serializeRequest({ ...request, auth: { type: 'bearer', bearerToken: '{{api_token}}' } }))
      .toContain('{{api_token}}');

    const safeOAuth = serializeRequest({
      ...request,
      auth: {
        type: 'oauth2_client_credentials',
        tokenUrl: 'https://auth.example.com/oauth/token',
        clientId: 'my-app',
        clientSecret: 'never-write-oauth-secret',
        clientSecretInKeychain: true,
        clientSecretKeychainRef: 'oauth-secret-ref'
      }
    });
    expect(safeOAuth).not.toContain('never-write-oauth-secret');
    expect(JSON.parse(safeOAuth).auth).not.toHaveProperty('clientSecret');
    expect(JSON.parse(safeOAuth).auth.clientSecretKeychainRef).toBe('oauth-secret-ref');
    expect(() => serializeRequest({
      ...request,
      auth: {
        type: 'oauth2_client_credentials',
        tokenUrl: 'https://auth.example.com/oauth/token',
        clientId: 'my-app',
        clientSecret: 'raw-secret'
      }
    })).toThrow(/system keychain/i);
  });

  it('validates request shape and normalizes missing folder metadata', () => {
    const parsed = parseRequest(JSON.stringify({ ...request, folderId: undefined, order: undefined }));
    expect(parsed.folderId).toBeNull();
    expect(parsed.order).toBe(0);
    expect(() => parseRequest(JSON.stringify({ ...request, id: '../outside' }))).toThrow(/ID/i);
  });

  it('omits secret environment values from portable exports', () => {
    const contents = serializePortableEnvironment({
      id: 'environment-1',
      name: 'Development',
      variables: [
        { id: 'variable-1', key: 'api_token', value: 'do-not-export', enabled: true, secret: true },
        { id: 'variable-2', key: 'base_url', value: 'https://example.test', enabled: true }
      ]
    });
    const exported = JSON.parse(contents);
    expect(contents).not.toContain('do-not-export');
    expect(exported.variables[0]).not.toHaveProperty('value');
    expect(exported.variables[1].value).toBe('https://example.test');
  });

  it('keeps normal Authorization headers and strips opted-in Keychain secrets from portable collections', () => {
    const normalHeaders = serializePortableCollection({
      ...collection,
      requests: [{ ...request, headers: { Authorization: 'Bearer portable-value' } }]
    });
    expect(JSON.parse(normalHeaders).requests[0].headers.Authorization).toBe('Bearer portable-value');

    const contents = serializePortableCollection({
      ...collection,
      requests: [{
        ...request,
        headers: {},
        authorizationHeaderInKeychain: true,
        authorizationHeaderKeychainRef: 'local-reference',
        auth: {
          type: 'bearer',
          bearerTokenInKeychain: true,
          bearerTokenKeychainRef: 'auth-reference'
        }
      }]
    });
    expect(contents).not.toContain('local-reference');
    expect(contents).not.toContain('auth-reference');
    const exportedSecretRequest = JSON.parse(contents).requests[0];
    expect(exportedSecretRequest.authorizationHeaderInKeychain).toBe(false);
    expect(exportedSecretRequest).not.toHaveProperty('authorizationHeaderKeychainRef');
    expect(exportedSecretRequest.headers).toEqual({});
  });

  it('allows literal Authorization headers in folder-backed request files unless marked secret', () => {
    const normalRequest = { ...request, headers: { Authorization: 'Bearer plain-value' } };
    expect(JSON.parse(serializeRequest(normalRequest)).headers.Authorization).toBe('Bearer plain-value');
    expect(parseRequest(serializeRequest(normalRequest)).headers.Authorization).toBe('Bearer plain-value');
    expect(() => serializeRequest({
      ...normalRequest,
      authorizationHeaderInKeychain: true,
      authorizationHeaderKeychainRef: 'secret-reference'
    })).toThrow(/must not also contain/i);
    expect(() => parseRequest(JSON.stringify({
      ...normalRequest,
      authorizationHeaderInKeychain: true,
      authorizationHeaderKeychainRef: 'secret-reference'
    }))).toThrow(/keychain-backed/i);
  });

  it('keeps unchecked request headers and query parameters out of outgoing requests', () => {
    const requestWithDisabledValues = {
      ...request,
      headers: { 'X-Trace': 'keep', Authorization: 'drop' },
      disabledHeaders: ['authorization'],
      disabledParams: ['verbose']
    };
    expect(getEnabledRequestHeaders(requestWithDisabledValues)).toEqual({ 'X-Trace': 'keep' });
    expect(removeDisabledQueryParams('https://example.test/search?verbose=true&page=2', requestWithDisabledValues.disabledParams))
      .toBe('https://example.test/search?page=2');
  });
});