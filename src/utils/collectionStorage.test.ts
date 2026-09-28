import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Collection, RequestItem } from '../store';
import { serializeManifest, serializeRequest } from './collectionFormat';

const mocks = vi.hoisted(() => ({
  files: new Map<string, string>(),
  directories: new Set<string>(),
  watchers: new Map<string, (event: unknown) => void>(),
  selectedPath: '/collections/demo'
}));

vi.mock('@tauri-apps/api/path', () => ({
  join: async (...parts: string[]) => parts.join('/').replace(/\/+/g, '/'),
  dirname: async (path: string) => path.slice(0, path.lastIndexOf('/')) || '/'
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: async () => mocks.selectedPath
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: async (path: string) => mocks.files.has(path) || mocks.directories.has(path),
  mkdir: async (path: string) => {
    const pieces = path.split('/').filter(Boolean);
    let current = '';
    for (const piece of pieces) {
      current += `/${piece}`;
      mocks.directories.add(current);
    }
  },
  readDir: async (path: string) => {
    const prefix = `${path.replace(/\/$/, '')}/`;
    const entries = new Map<string, { name: string; isFile: boolean; isDirectory: boolean; isSymlink: boolean }>();
    for (const file of mocks.files.keys()) {
      if (!file.startsWith(prefix)) continue;
      const rest = file.slice(prefix.length);
      const name = rest.split('/')[0];
      entries.set(name, { name, isFile: !rest.includes('/'), isDirectory: rest.includes('/'), isSymlink: false });
    }
    for (const directory of mocks.directories) {
      if (!directory.startsWith(prefix)) continue;
      const rest = directory.slice(prefix.length);
      if (!rest) continue;
      const name = rest.split('/')[0];
      entries.set(name, { name, isFile: false, isDirectory: true, isSymlink: false });
    }
    return [...entries.values()];
  },
  readTextFile: async (path: string) => {
    const value = mocks.files.get(path);
    if (value === undefined) throw new Error(`File not found: ${path}`);
    return value;
  },
  writeTextFile: async (path: string, content: string) => {
    mocks.files.set(path, content);
    const parent = path.slice(0, path.lastIndexOf('/'));
    mocks.directories.add(parent);
  },
  rename: async (source: string, target: string) => {
    const value = mocks.files.get(source);
    if (value === undefined) throw new Error(`File not found: ${source}`);
    mocks.files.set(target, value);
    mocks.files.delete(source);
  },
  remove: async (path: string) => {
    mocks.files.delete(path);
    for (const file of [...mocks.files.keys()]) if (file.startsWith(`${path}/`)) mocks.files.delete(file);
    for (const directory of [...mocks.directories]) if (directory === path || directory.startsWith(`${path}/`)) mocks.directories.delete(directory);
  },
  watch: async (path: string, callback: (event: unknown) => void) => {
    mocks.watchers.set(path, callback);
    return () => mocks.watchers.delete(path);
  }
}));

import { useStore } from '../store';
import {
  getCollectionStorageStatusSnapshot,
  openCollectionFolder,
  resolveStorageConflict,
  startCollectionStorage
} from './collectionStorage';

const baseRequest: RequestItem = {
  id: 'request-1',
  name: 'Get user',
  method: 'GET',
  url: 'https://example.test/users/1',
  headers: {},
  folderId: null,
  order: 0
};

const fixture: Collection = {
  id: 'collection-1',
  name: 'Example API',
  requests: [baseRequest],
  folders: [],
  isOpen: true,
  storageMode: 'folder',
  folderPath: '/collections/demo'
};

function seedCollection(): void {
  mocks.files.clear();
  mocks.directories.clear();
  mocks.watchers.clear();
  mocks.selectedPath = '/collections/demo';
  mocks.directories.add('/collections/demo');
  mocks.directories.add('/collections/demo/requests');
  mocks.files.set('/collections/demo/collection.json', serializeManifest(fixture));
  mocks.files.set('/collections/demo/requests/request-1.json', serializeRequest(baseRequest));
  useStore.setState({ collections: [], activeRequestId: null, openRequestIds: [] });
}

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 30; index++) await Promise.resolve();
}

describe('folder-backed collection storage', () => {
  beforeEach(() => {
    seedCollection();
  });

  it('opens a folder collection and loads the manifest and requests into the existing store model', async () => {
    const stop = startCollectionStorage();
    await openCollectionFolder();
    const loaded = useStore.getState().collections[0];
    expect(loaded.id).toBe(fixture.id);
    expect(loaded.storageMode).toBe('folder');
    expect(loaded.requests).toEqual([baseRequest]);
    stop();
  });

  it('keeps valid requests available when another request file is malformed', async () => {
    mocks.files.set('/collections/demo/requests/broken.json', '{not-json');
    const stop = startCollectionStorage();
    await openCollectionFolder();
    const loaded = useStore.getState().collections[0];
    expect(loaded.requests.map(request => request.id)).toEqual(['request-1']);
    expect(getCollectionStorageStatusSnapshot()[fixture.id].errors).toHaveLength(1);
    stop();
  });

  it('surfaces concurrent local and disk edits and applies an explicit reload choice', async () => {
    const stop = startCollectionStorage();
    await openCollectionFolder();
    useStore.setState(state => ({
      collections: state.collections.map(collection => ({
        ...collection,
        requests: collection.requests.map(request => ({ ...request, url: 'https://local.test' }))
      }))
    }));
    const diskRequest = { ...baseRequest, url: 'https://external.test' };
    mocks.files.set('/collections/demo/requests/request-1.json', serializeRequest(diskRequest));
    mocks.watchers.get('/collections/demo')?.({ type: 'modify' });
    await flushPromises();
    const conflict = getCollectionStorageStatusSnapshot()[fixture.id].conflicts[0];
    expect(conflict?.requestId).toBe(baseRequest.id);
    await resolveStorageConflict(fixture.id, conflict.path, 'reload');
    expect(useStore.getState().collections[0].requests[0].url).toBe('https://external.test');
    stop();
  });

  it('keeps local edits when the user resolves a conflict with keep', async () => {
    const stop = startCollectionStorage();
    await openCollectionFolder();
    useStore.setState(state => ({
      collections: state.collections.map(collection => ({
        ...collection,
        requests: collection.requests.map(request => ({ ...request, url: 'https://local.test' }))
      }))
    }));
    const diskRequest = { ...baseRequest, url: 'https://external.test' };
    mocks.files.set('/collections/demo/requests/request-1.json', serializeRequest(diskRequest));
    mocks.watchers.get('/collections/demo')?.({ type: 'modify' });
    await flushPromises();
    const conflict = getCollectionStorageStatusSnapshot()[fixture.id].conflicts[0];
    await resolveStorageConflict(fixture.id, conflict.path, 'keep');
    await flushPromises();
    expect(useStore.getState().collections[0].requests[0].url).toBe('https://local.test');
    expect(JSON.parse(mocks.files.get('/collections/demo/requests/request-1.json')!).url).toBe('https://local.test');
    stop();
  });

  it('refuses to overwrite a second external edit after a conflict is shown', async () => {
    const stop = startCollectionStorage();
    await openCollectionFolder();
    useStore.setState(state => ({
      collections: state.collections.map(collection => ({
        ...collection,
        requests: collection.requests.map(request => ({ ...request, url: 'https://local.test' }))
      }))
    }));
    mocks.files.set('/collections/demo/requests/request-1.json', serializeRequest({ ...baseRequest, url: 'https://external.test' }));
    mocks.watchers.get('/collections/demo')?.({ type: 'modify' });
    await flushPromises();
    const conflict = getCollectionStorageStatusSnapshot()[fixture.id].conflicts[0];
    mocks.files.set('/collections/demo/requests/request-1.json', serializeRequest({ ...baseRequest, url: 'https://newer-external.test' }));
    await expect(resolveStorageConflict(fixture.id, conflict.path, 'keep')).rejects.toThrow(/changed again/i);
    expect(JSON.parse(mocks.files.get('/collections/demo/requests/request-1.json')!).url).toBe('https://newer-external.test');
    stop();
  });

  it('debounces local edits into a write to only the changed request file', async () => {
    vi.useFakeTimers();
    const stop = startCollectionStorage();
    await openCollectionFolder();
    await vi.advanceTimersByTimeAsync(450);
    useStore.setState(state => ({
      collections: state.collections.map(collection => ({
        ...collection,
        requests: collection.requests.map(request => ({ ...request, url: 'https://edited.test' }))
      }))
    }));
    await vi.advanceTimersByTimeAsync(450);
    await flushPromises();
    expect(JSON.parse(mocks.files.get('/collections/demo/requests/request-1.json')!).url).toBe('https://edited.test');
    expect(mocks.files.has('/collections/demo/collection.json')).toBe(true);
    stop();
    vi.useRealTimers();
  });

  it('creates the required request directory and file when folder mode is enabled on an empty folder', async () => {
    mocks.files.clear();
    mocks.directories.clear();
    mocks.directories.add('/collections/demo');
    useStore.setState({ collections: [{ ...fixture, storageMode: 'local', folderPath: undefined }] });
    const stop = startCollectionStorage();
    await import('./collectionStorage').then(module => module.chooseFolderForCollection(fixture.id));
    expect(mocks.files.has('/collections/demo/collection.json')).toBe(true);
    expect(mocks.files.has('/collections/demo/requests/request-1.json')).toBe(true);
    expect(useStore.getState().collections[0].storageMode).toBe('folder');
    stop();
  });
});
