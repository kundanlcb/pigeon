import type { Collection, CollectionFolder, Environment, RequestItem } from '../store';

export const COLLECTION_FORMAT_VERSION = 1;
export const COLLECTION_MANIFEST_FILE = 'collection.json';

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export interface CollectionManifest {
  formatVersion: number;
  id: string;
  name: string;
  folders: CollectionFolder[];
}

export interface CollectionFileError {
  path: string;
  message: string;
}

export function stableJson(value: unknown): string {
  const sortObjectKeys = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sortObjectKeys);
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.entries(input)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, child]) => [key, sortObjectKeys(child)]));
    }
    return input;
  };

  return `${JSON.stringify(sortObjectKeys(value), null, 2)}\n`;
}

function validateId(id: unknown, label: string): asserts id is string {
  if (typeof id !== 'string' || !SAFE_ID.test(id)) {
    throw new Error(`${label} must contain only letters, numbers, underscores, or hyphens.`);
  }
}

export function serializeManifest(collection: Collection): string {
  validateId(collection.id, 'Collection ID');
  const folderList = collection.folders || [];
  validateFolders(folderList);
  const sortChildren = (parentId: string | null): CollectionFolder[] => folderList
    .filter(folder => folder.parentId === parentId)
    .sort((left, right) => left.order - right.order || compareText(left.id, right.id))
    .flatMap(folder => [folder, ...sortChildren(folder.id)]);
  const folders = sortChildren(null);
  return stableJson({
    formatVersion: COLLECTION_FORMAT_VERSION,
    id: collection.id,
    name: collection.name,
    folders
  } satisfies CollectionManifest);
}

export function parseManifest(text: string): CollectionManifest {
  const value = JSON.parse(text) as Partial<CollectionManifest>;
  if (value.formatVersion !== COLLECTION_FORMAT_VERSION) {
    throw new Error(`Unsupported collection format version: ${String(value.formatVersion)}.`);
  }
  validateId(value.id, 'Collection ID');
  if (typeof value.name !== 'string' || !Array.isArray(value.folders)) {
    throw new Error('Collection manifest is missing its name or folder list.');
  }
  validateFolders(value.folders);
  return {
    formatVersion: COLLECTION_FORMAT_VERSION,
    id: value.id,
    name: value.name,
    folders: value.folders
  };
}

function validateFolders(folders: CollectionFolder[]): void {
  const folderIds = new Set<string>();
  for (const folder of folders) {
    validateId(folder.id, 'Folder ID');
    if (folderIds.has(folder.id)) throw new Error(`Duplicate folder ID: ${folder.id}.`);
    if (typeof folder.name !== 'string' || !Number.isInteger(folder.order)) {
      throw new Error(`Folder ${folder.id} has invalid metadata.`);
    }
    if (folder.parentId !== null) validateId(folder.parentId, 'Parent folder ID');
    folderIds.add(folder.id);
  }

  for (const folder of folders) {
    if (folder.parentId && !folderIds.has(folder.parentId)) {
      throw new Error(`Folder ${folder.id} references a missing parent.`);
    }
    const seen = new Set([folder.id]);
    let parentId = folder.parentId;
    while (parentId) {
      if (seen.has(parentId)) throw new Error(`Folder hierarchy contains a cycle at ${parentId}.`);
      seen.add(parentId);
      parentId = folders.find(candidate => candidate.id === parentId)?.parentId || null;
    }
  }
}

export function serializeRequest(request: RequestItem): string {
  const serialized: RequestItem = { ...request };
  const authorizationHeader = Object.keys(request.headers).find(key => key.toLowerCase() === 'authorization');
  if (authorizationHeader) {
    const value = request.headers[authorizationHeader];
    if (request.authorizationHeaderInKeychain) {
      throw new Error('A keychain-backed Authorization header must not also contain a header value.');
    }
    if (value && !/^\{\{\s*[^{}]+\s*\}\}$/.test(value.trim())) {
      throw new Error('Save literal Authorization header values to the system keychain before enabling folder storage.');
    }
  }
  if (request.authorizationHeaderInKeychain && !request.authorizationHeaderKeychainRef) {
    throw new Error('Authorization header is marked as keychain-backed but has no keychain reference.');
  }
  if (request.auth) {
    const auth = { ...request.auth };
    const secretFields = [
      ['bearerToken', 'bearerTokenInKeychain', 'bearerTokenKeychainRef'],
      ['basicPassword', 'basicPasswordInKeychain', 'basicPasswordKeychainRef'],
      ['apiKeyValue', 'apiKeyValueInKeychain', 'apiKeyValueKeychainRef']
    ] as const;
    for (const [valueField, markerField, referenceField] of secretFields) {
      const rawValue = auth[valueField];
      if (auth[markerField]) {
        if (!auth[referenceField]) throw new Error(`Keychain-backed ${valueField} is missing its keychain reference.`);
        delete auth[valueField];
      } else if (rawValue && !/^\{\{\s*[^{}]+\s*\}\}$/.test(rawValue.trim())) {
        throw new Error(`Save ${valueField} to the system keychain before enabling folder storage.`);
      }
      if (auth[referenceField] !== undefined) validateId(auth[referenceField], 'Keychain reference');
    }
    serialized.auth = auth;
  }
  return stableJson(serialized);
}

export function serializePortableCollection(collection: Collection): string {
  const requests = sortCollectionRequests(collection.requests).map(request => {
    if (!request.auth) return request;
    const auth = { ...request.auth };
    const secretFields = [
      ['bearerToken', 'bearerTokenInKeychain', 'bearerTokenKeychainRef'],
      ['basicPassword', 'basicPasswordInKeychain', 'basicPasswordKeychainRef'],
      ['apiKeyValue', 'apiKeyValueInKeychain', 'apiKeyValueKeychainRef']
    ] as const;
    for (const [valueField, markerField, referenceField] of secretFields) {
      const value = auth[valueField];
      if (auth[markerField] || (value && !/^\{\{\s*[^{}]+\s*\}\}$/.test(value.trim()))) {
        delete auth[valueField];
        delete auth[referenceField];
        auth[markerField] = false;
      }
    }
    const headers = Object.fromEntries(Object.entries(request.headers).filter(([key, value]) =>
      key.toLowerCase() !== 'authorization' || /^\{\{\s*[^{}]+\s*\}\}$/.test(value.trim())
    ));
    return {
      ...request,
      headers,
      authorizationHeaderInKeychain: false,
      authorizationHeaderKeychainRef: undefined,
      auth
    };
  });
  return stableJson({
    id: collection.id,
    name: collection.name,
    folders: collection.folders || [],
    requests
  });
}

export function serializePortableEnvironment(environment: Environment): string {
  return stableJson({
    name: environment.name,
    variables: environment.variables.map(variable => variable.secret
      ? { id: variable.id, key: variable.key, enabled: variable.enabled, secret: true }
      : variable)
  });
}

export function parseRequest(text: string): RequestItem {
  const value = JSON.parse(text) as Partial<RequestItem>;
  validateId(value.id, 'Request ID');
  if (typeof value.name !== 'string' || typeof value.url !== 'string'
    || typeof value.method !== 'string' || !HTTP_METHODS.has(value.method)
    || !value.headers || typeof value.headers !== 'object' || Array.isArray(value.headers)) {
    throw new Error('Request file is missing required request fields.');
  }
  if (value.folderId !== undefined && value.folderId !== null) validateId(value.folderId, 'Request folder ID');
  if (value.order !== undefined && !Number.isInteger(value.order)) throw new Error('Request order must be an integer.');
  const authorizationHeader = Object.keys(value.headers).find(key => key.toLowerCase() === 'authorization');
  if (authorizationHeader) {
    const headerValue = value.headers[authorizationHeader];
    if (value.authorizationHeaderInKeychain) throw new Error('Request contains a value for a keychain-backed Authorization header.');
    if (headerValue && !/^\{\{\s*[^{}]+\s*\}\}$/.test(headerValue.trim())) {
      throw new Error('Request contains a plaintext Authorization header; save it to the system keychain first.');
    }
  }
  if (value.authorizationHeaderKeychainRef !== undefined) validateId(value.authorizationHeaderKeychainRef, 'Keychain reference');
  if (value.authorizationHeaderInKeychain && !value.authorizationHeaderKeychainRef) {
    throw new Error('Request is missing the keychain reference for its Authorization header.');
  }
  if (value.auth) {
    const secretFields = [
      ['bearerToken', 'bearerTokenInKeychain', 'bearerTokenKeychainRef'],
      ['basicPassword', 'basicPasswordInKeychain', 'basicPasswordKeychainRef'],
      ['apiKeyValue', 'apiKeyValueInKeychain', 'apiKeyValueKeychainRef']
    ] as const;
    for (const [valueField, markerField, referenceField] of secretFields) {
      const rawValue = value.auth[valueField];
      if (rawValue && !value.auth[markerField] && !/^\{\{\s*[^{}]+\s*\}\}$/.test(rawValue.trim())) {
        throw new Error(`Request contains a plaintext ${valueField}; save it to the system keychain first.`);
      }
      if (value.auth[markerField] && rawValue !== undefined) {
        throw new Error(`Request contains a value for keychain-backed ${valueField}.`);
      }
      const reference = value.auth[referenceField];
      if (reference !== undefined) validateId(reference, 'Keychain reference');
      if (value.auth[markerField] && !reference) throw new Error(`Request is missing the keychain reference for ${valueField}.`);
    }
  }
  return {
    ...value,
    folderId: value.folderId || null,
    order: value.order ?? 0,
    headers: value.headers
  } as RequestItem;
}

function pathSegment(value: string): string {
  const normalized = value.normalize('NFKD').toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'folder';
}

function folderPathSegments(folders: CollectionFolder[], folderId: string | null | undefined): string[] {
  if (!folderId) return [];
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  const segments: string[] = [];
  const visited = new Set<string>();
  let folder = byId.get(folderId);
  while (folder) {
    validateId(folder.id, 'Folder ID');
    if (visited.has(folder.id)) throw new Error(`Folder hierarchy contains a cycle at ${folder.id}.`);
    visited.add(folder.id);
    segments.unshift(`${pathSegment(folder.name)}--${folder.id}`);
    folder = folder.parentId ? byId.get(folder.parentId) : undefined;
  }
  if (!visited.has(folderId)) throw new Error(`Request references an unknown folder: ${folderId}.`);
  return segments;
}

export function requestRelativePath(request: RequestItem, folders: CollectionFolder[]): string {
  validateId(request.id, 'Request ID');
  return ['requests', ...folderPathSegments(folders, request.folderId), `${request.id}.json`].join('/');
}

export function sortCollectionRequests(requests: RequestItem[]): RequestItem[] {
  return [...requests].sort((left, right) =>
    (left.order ?? 0) - (right.order ?? 0) || compareText(left.id, right.id));
}