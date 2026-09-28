import { dirname, join } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { exists, mkdir, readDir, readTextFile, remove, rename, watch, writeTextFile, type UnwatchFn } from '@tauri-apps/plugin-fs';
import { useStore, type Collection, type RequestItem } from '../store';
import {
  COLLECTION_MANIFEST_FILE,
  parseManifest,
  parseRequest,
  requestRelativePath,
  serializeManifest,
  serializeRequest,
  sortCollectionRequests,
  type CollectionFileError,
  type CollectionManifest
} from './collectionFormat';

export interface StorageConflict {
  requestId: string | null;
  path: string;
  localPath?: string | null;
  diskPath?: string | null;
  localText: string | null;
  diskText: string | null;
}

export interface CollectionStorageStatus {
  state: 'loading' | 'saved' | 'saving' | 'error' | 'conflict';
  message?: string;
  errors: CollectionFileError[];
  conflicts: StorageConflict[];
}

interface DiskRequest {
  request: RequestItem;
  path: string;
  text: string;
}

interface DiskCollection {
  manifest: CollectionManifest;
  manifestText: string;
  requests: Map<string, DiskRequest>;
  errors: CollectionFileError[];
  malformedPaths: Set<string>;
}

interface Runtime {
  path: string;
  manifestText: string;
  requests: Map<string, DiskRequest>;
  malformedPaths: Set<string>;
  errors: CollectionFileError[];
  conflicts: StorageConflict[];
  unwatch?: UnwatchFn;
  timer?: ReturnType<typeof setTimeout>;
  applyingDisk: boolean;
  syncing: boolean;
  pendingSync: boolean;
}

const runtimes = new Map<string, Runtime>();
const statuses = new Map<string, CollectionStorageStatus>();
const statusListeners = new Set<() => void>();
let statusSnapshot: Record<string, CollectionStorageStatus> = {};
let stopStoreSubscription: (() => void) | undefined;

function publishStatus(collectionId: string, status: CollectionStorageStatus): void {
  statuses.set(collectionId, status);
  statusSnapshot = Object.fromEntries(statuses);
  statusListeners.forEach(listener => listener());
}

export function subscribeCollectionStorageStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

export function getCollectionStorageStatusSnapshot(): Record<string, CollectionStorageStatus> {
  return statusSnapshot;
}

function setCollection(collectionId: string, update: (collection: Collection) => Collection): void {
  const runtime = runtimes.get(collectionId);
  const state = useStore.getState();
  if (runtime) runtime.applyingDisk = true;
  useStore.setState({
    collections: state.collections.map(collection => collection.id === collectionId ? update(collection) : collection)
  });
  if (runtime) runtime.applyingDisk = false;
}

function absolute(root: string, relative: string): Promise<string> {
  return join(root, ...relative.split('/'));
}

function relative(root: string, path: string): string {
  return path.slice(root.replace(/[\\/]+$/, '').length + 1).replace(/\\/g, '/');
}

async function writeAtomically(path: string, contents: string): Promise<void> {
  await mkdir(await dirname(path), { recursive: true });
  const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    await writeTextFile(temporaryPath, contents);
    await rename(temporaryPath, path);
  } catch (error) {
    if (await exists(temporaryPath)) await remove(temporaryPath).catch(() => {});
    throw error;
  }
}

async function removeIfPresent(path: string): Promise<void> {
  if (await exists(path)) await remove(path);
}

async function readDiskCollection(root: string): Promise<DiskCollection> {
  const manifestPath = await absolute(root, COLLECTION_MANIFEST_FILE);
  const manifestText = await readTextFile(manifestPath);
  const manifest = parseManifest(manifestText);
  const requests = new Map<string, DiskRequest>();
  const errors: CollectionFileError[] = [];
  const malformedPaths = new Set<string>();
  const requestsRoot = await absolute(root, 'requests');

  if (await exists(requestsRoot)) {
    const visit = async (directory: string): Promise<void> => {
      const entries = await readDir(directory);
      for (const entry of entries) {
        const path = await join(directory, entry.name);
        const relativePath = relative(root, path);
        if (entry.isSymlink) {
          errors.push({ path: relativePath, message: 'Symbolic links are not loaded from a collection.' });
          malformedPaths.add(relativePath);
        } else if (entry.isDirectory) {
          await visit(path);
        } else if (entry.isFile && entry.name.endsWith('.json')) {
          try {
            const text = await readTextFile(path);
            const request = parseRequest(text);
            const expectedPath = requestRelativePath(request, manifest.folders);
            if (expectedPath !== relativePath) throw new Error('Request file path does not match its ID or folder.');
            if (requests.has(request.id)) throw new Error(`Duplicate request ID: ${request.id}.`);
            requests.set(request.id, { request, path: relativePath, text });
          } catch (error) {
            errors.push({ path: relativePath, message: error instanceof Error ? error.message : String(error) });
            malformedPaths.add(relativePath);
          }
        }
      }
    };
    await visit(requestsRoot);
  }

  return { manifest, manifestText, requests, errors, malformedPaths };
}

function localRequestMap(collection: Collection): Map<string, DiskRequest> {
  const requests = new Map<string, DiskRequest>();
  for (const request of collection.requests) {
    requests.set(request.id, {
      request,
      path: requestRelativePath(request, collection.folders || []),
      text: serializeRequest(request)
    });
  }
  return requests;
}

function statusFor(runtime: Runtime): CollectionStorageStatus {
  if (runtime.conflicts.length) {
    return { state: 'conflict', message: 'Files changed both in Pigeon and on disk.', errors: runtime.errors, conflicts: runtime.conflicts };
  }
  if (runtime.errors.length) {
    return { state: 'error', message: 'Some collection files could not be loaded.', errors: runtime.errors, conflicts: [] };
  }
  return { state: 'saved', errors: [], conflicts: [] };
}

function installRuntime(collectionId: string, path: string, disk: DiskCollection): Runtime {
  const previous = runtimes.get(collectionId);
  previous?.unwatch?.();
  if (previous?.timer) clearTimeout(previous.timer);
  const runtime: Runtime = {
    path,
    manifestText: disk.manifestText,
    requests: disk.requests,
    malformedPaths: disk.malformedPaths,
    errors: disk.errors,
    conflicts: [],
    applyingDisk: false,
    syncing: false,
    pendingSync: false
  };
  runtimes.set(collectionId, runtime);
  void watch(path, () => {
    void reconcileFromDisk(collectionId);
  }, { recursive: true, delayMs: 350 }).then(unwatch => {
    if (runtimes.get(collectionId) === runtime) runtime.unwatch = unwatch;
    else unwatch();
  }).catch(error => {
    runtime.errors = [{ path, message: `Could not watch collection folder: ${String(error)}` }];
    publishStatus(collectionId, statusFor(runtime));
  });
  publishStatus(collectionId, statusFor(runtime));
  return runtime;
}

function scheduleSync(collectionId: string): void {
  const runtime = runtimes.get(collectionId);
  if (!runtime || runtime.conflicts.length) return;
  runtime.pendingSync = true;
  if (runtime.timer) clearTimeout(runtime.timer);
  publishStatus(collectionId, { state: 'saving', errors: runtime.errors, conflicts: [] });
  runtime.timer = setTimeout(() => void syncLocalChanges(collectionId), 400);
}

function drainPendingSync(collectionId: string, runtime: Runtime): void {
  if (!runtime.pendingSync || runtime.conflicts.length) return;
  runtime.pendingSync = false;
  scheduleSync(collectionId);
}

async function reconcileFromDisk(collectionId: string): Promise<void> {
  const runtime = runtimes.get(collectionId);
  if (!runtime) return;
  if (runtime.syncing) {
    runtime.pendingSync = true;
    return;
  }
  runtime.syncing = true;
  let syncAfterMerge = false;
  try {
    const disk = await readDiskCollection(runtime.path);
    const collection = useStore.getState().collections.find(item => item.id === collectionId);
    if (!collection) return;
    if (disk.manifest.id !== collectionId) throw new Error('Collection ID on disk does not match the attached collection.');
    const baseManifest = parseManifest(runtime.manifestText);
    const canonicalBaseManifest = serializeManifest({ ...collection, name: baseManifest.name, folders: baseManifest.folders });
    const localManifestText = serializeManifest(collection);
    const diskManifestText = serializeManifest({ ...collection, name: disk.manifest.name, folders: disk.manifest.folders });
    const localManifestChanged = localManifestText !== canonicalBaseManifest;
    const diskManifestChanged = diskManifestText !== canonicalBaseManifest;
    const conflicts: StorageConflict[] = [];
    let mergedName = collection.name;
    let mergedFolders = collection.folders || [];
    if (localManifestChanged && diskManifestChanged && localManifestText !== diskManifestText) {
      conflicts.push({ requestId: null, path: COLLECTION_MANIFEST_FILE, localText: localManifestText, diskText: disk.manifestText });
    } else if (diskManifestChanged && !localManifestChanged) {
      mergedName = disk.manifest.name;
      mergedFolders = disk.manifest.folders;
    }

    const localRequests = localRequestMap(collection);
    const mergedRequests = new Map(localRequests);
    const nextBaseline = new Map(runtime.requests);
    const allIds = new Set([...runtime.requests.keys(), ...localRequests.keys(), ...disk.requests.keys()]);

    for (const id of allIds) {
      const base = runtime.requests.get(id);
      const local = localRequests.get(id);
      const remote = disk.requests.get(id);
      if (!remote && base && disk.malformedPaths.has(base.path)) continue;
      const localChanged = base
        ? !local || local.path !== base.path || local.text !== base.text
        : !!local;
      const diskChanged = base
        ? !remote || remote.path !== base.path || remote.text !== base.text
        : !!remote;

      if (localChanged && diskChanged && (local?.path !== remote?.path || local?.text !== remote?.text)) {
        conflicts.push({
          requestId: id,
          path: remote?.path || base?.path || local?.path || '',
          localPath: local?.path || null,
          diskPath: remote?.path || null,
          localText: local?.text || null,
          diskText: remote?.text || null
        });
      } else if (diskChanged && !localChanged) {
        if (remote) mergedRequests.set(id, remote);
        else mergedRequests.delete(id);
        if (remote) nextBaseline.set(id, remote);
        else nextBaseline.delete(id);
      } else if (!localChanged && remote) {
        nextBaseline.set(id, remote);
      }
    }

    for (const [id, remote] of disk.requests) {
      if (!runtime.requests.has(id) && !localRequests.has(id)) {
        mergedRequests.set(id, remote);
        nextBaseline.set(id, remote);
      }
    }

    runtime.conflicts = conflicts;
    runtime.errors = disk.errors;
    runtime.malformedPaths = disk.malformedPaths;
    if (!conflicts.some(conflict => conflict.requestId === null)) {
      runtime.manifestText = disk.manifestText;
    }
    runtime.requests = nextBaseline;
    setCollection(collectionId, current => ({
      ...current,
      name: mergedName,
      folders: mergedFolders,
      requests: sortCollectionRequests([...mergedRequests.values()].map(entry => entry.request))
    }));
    publishStatus(collectionId, statusFor(runtime));
    syncAfterMerge = !runtime.conflicts.length;
  } catch (error) {
    runtime.errors = [{ path: runtime.path, message: error instanceof Error ? error.message : String(error) }];
    publishStatus(collectionId, statusFor(runtime));
  } finally {
    runtime.syncing = false;
  }
  drainPendingSync(collectionId, runtime);
  if (syncAfterMerge) await syncLocalChanges(collectionId, undefined, true);
}

async function syncLocalChanges(collectionId: string, knownCollection?: Collection, skipReconcile = false): Promise<void> {
  const runtime = runtimes.get(collectionId);
  const collection = knownCollection || useStore.getState().collections.find(item => item.id === collectionId);
  if (!runtime || !collection || runtime.conflicts.length) return;
  if (runtime.syncing) {
    runtime.pendingSync = true;
    return;
  }
  runtime.pendingSync = false;
  if (!skipReconcile) {
    await reconcileFromDisk(collectionId);
    return;
  }
  runtime.syncing = true;
  try {
    const current = useStore.getState().collections.find(item => item.id === collectionId);
    if (!current) return;
    const manifestText = serializeManifest(current);
    if (manifestText !== runtime.manifestText) {
      const manifestPath = await absolute(runtime.path, COLLECTION_MANIFEST_FILE);
      const diskText = await exists(manifestPath) ? await readTextFile(manifestPath) : null;
      if (diskText !== runtime.manifestText && diskText !== manifestText) {
        runtime.conflicts = [{ requestId: null, path: COLLECTION_MANIFEST_FILE, localText: manifestText, diskText }];
        publishStatus(collectionId, statusFor(runtime));
        return;
      }
      await writeAtomically(manifestPath, manifestText);
      runtime.manifestText = manifestText;
    }

    const desiredRequests = localRequestMap(current);
    for (const [id, desired] of desiredRequests) {
      const base = runtime.requests.get(id);
      if (base && base.path === desired.path && base.text === desired.text) continue;
      const targetPath = await absolute(runtime.path, desired.path);
      const targetText = await exists(targetPath) ? await readTextFile(targetPath) : null;
      const expectedText = base && base.path === desired.path ? base.text : null;
      if (targetText !== expectedText && targetText !== desired.text) {
        runtime.conflicts = [{ requestId: id, path: desired.path, localPath: desired.path, diskPath: targetText === null ? null : desired.path, localText: desired.text, diskText: targetText }];
        publishStatus(collectionId, statusFor(runtime));
        return;
      }
      await writeAtomically(targetPath, desired.text);
      if (base && base.path !== desired.path) {
        const oldPath = await absolute(runtime.path, base.path);
        const oldText = await exists(oldPath) ? await readTextFile(oldPath) : null;
        if (oldText === base.text) await removeIfPresent(oldPath);
        else if (oldText !== null) {
          runtime.conflicts = [{ requestId: id, path: base.path, localPath: desired.path, diskPath: base.path, localText: desired.text, diskText: oldText }];
          publishStatus(collectionId, statusFor(runtime));
          return;
        }
      }
      runtime.requests.set(id, desired);
    }

    for (const [id, base] of [...runtime.requests]) {
      if (desiredRequests.has(id)) continue;
      const oldPath = await absolute(runtime.path, base.path);
      const diskText = await exists(oldPath) ? await readTextFile(oldPath) : null;
      if (diskText !== null && diskText !== base.text) {
        runtime.conflicts = [{ requestId: id, path: base.path, localPath: null, diskPath: base.path, localText: null, diskText }];
        publishStatus(collectionId, statusFor(runtime));
        return;
      }
      await removeIfPresent(oldPath);
      runtime.requests.delete(id);
    }
    publishStatus(collectionId, statusFor(runtime));
  } catch (error) {
    runtime.errors = [{ path: runtime.path, message: error instanceof Error ? error.message : String(error) }];
    publishStatus(collectionId, statusFor(runtime));
  } finally {
    runtime.syncing = false;
  }
  drainPendingSync(collectionId, runtime);
}

async function attachFolder(collectionId: string, path: string): Promise<void> {
  const collection = useStore.getState().collections.find(item => item.id === collectionId);
  if (!collection) throw new Error('Collection no longer exists.');
  publishStatus(collectionId, { state: 'loading', errors: [], conflicts: [] });
  const manifestPath = await absolute(path, COLLECTION_MANIFEST_FILE);
  let disk: DiskCollection;
  if (await exists(manifestPath)) {
    disk = await readDiskCollection(path);
    if (disk.manifest.id !== collection.id) {
      throw new Error('That folder belongs to a different collection. Use Open Collection Folder instead.');
    }
    const localManifest = serializeManifest(collection);
    const parsedDiskManifest = serializeManifest({ ...collection, name: disk.manifest.name, folders: disk.manifest.folders });
    const sameRequests = collection.requests.length === disk.requests.size
      && collection.requests.every(request => {
        const diskRequest = disk.requests.get(request.id)?.request;
        return !!diskRequest && serializeRequest(diskRequest) === serializeRequest(request);
      });
    if (localManifest !== parsedDiskManifest || !sameRequests) {
      throw new Error('The folder contains edits not present in this local collection. Open it as a separate collection to avoid overwriting either copy.');
    }
  } else {
    const entries = await readDir(path);
    if (entries.length) throw new Error('Choose an empty folder, or use Open Collection Folder for an existing Pigeon collection.');
    const createdFiles: string[] = [];
    try {
      for (const request of sortCollectionRequests(collection.requests)) {
        const requestPath = requestRelativePath(request, collection.folders || []);
        const filePath = await absolute(path, requestPath);
        await writeAtomically(filePath, serializeRequest(request));
        createdFiles.push(filePath);
      }
      const manifestText = serializeManifest(collection);
      await writeAtomically(manifestPath, manifestText);
      createdFiles.push(manifestPath);
      disk = await readDiskCollection(path);
    } catch (error) {
      for (const file of createdFiles.reverse()) await removeIfPresent(file).catch(() => {});
      throw error;
    }
  }

  const runtime = installRuntime(collectionId, path, disk);
  runtime.applyingDisk = true;
  useStore.setState(state => ({
    collections: state.collections.map(item => item.id !== collectionId ? item : {
      ...item,
      name: disk.manifest.name,
      folders: disk.manifest.folders,
      requests: sortCollectionRequests([...disk.requests.values()].map(entry => entry.request)),
      storageMode: 'folder',
      folderPath: path
    })
  }));
  runtime.applyingDisk = false;
  publishStatus(collectionId, statusFor(runtime));
}

export async function chooseFolderForCollection(collectionId: string): Promise<void> {
  const selected = await open({ directory: true, recursive: true, multiple: false, title: 'Choose collection folder' });
  if (typeof selected !== 'string') return;
  try {
    await attachFolder(collectionId, selected);
  } catch (error) {
    publishStatus(collectionId, { state: 'error', message: error instanceof Error ? error.message : String(error), errors: [], conflicts: [] });
    throw error;
  }
}

export async function openCollectionFolder(): Promise<void> {
  const selected = await open({ directory: true, recursive: true, multiple: false, title: 'Open Pigeon collection folder' });
  if (typeof selected !== 'string') return;
  const disk = await readDiskCollection(selected);
  const state = useStore.getState();
  if (state.collections.some(collection => collection.id === disk.manifest.id)) {
    throw new Error('This collection is already open in Pigeon.');
  }
  const collection: Collection = {
    id: disk.manifest.id,
    name: disk.manifest.name,
    folders: disk.manifest.folders,
    requests: sortCollectionRequests([...disk.requests.values()].map(entry => entry.request)),
    isOpen: true,
    storageMode: 'folder',
    folderPath: selected
  };
  const runtime = installRuntime(collection.id, selected, disk);
  runtime.applyingDisk = true;
  useStore.setState(current => ({ collections: [...current.collections, collection] }));
  runtime.applyingDisk = false;
  publishStatus(collection.id, statusFor(runtime));
}

export async function switchToLocalStorage(collectionId: string): Promise<void> {
  const runtime = runtimes.get(collectionId);
  if (!runtime) throw new Error('Collection folder is not loaded yet.');
  if (runtime.syncing) throw new Error('Wait for the current collection save to finish before switching storage.');
  if (runtime.timer) clearTimeout(runtime.timer);
  await reconcileFromDisk(collectionId);
  if (runtime.conflicts.length) throw new Error('Resolve collection conflicts before switching to local storage.');
  if (runtime.errors.length) throw new Error('Resolve collection file errors before switching to local storage.');
  const collection = useStore.getState().collections.find(item => item.id === collectionId);
  if (!collection) throw new Error('Collection no longer exists.');
  runtime.unwatch?.();
  runtimes.delete(collectionId);
  useStore.setState(state => ({
    collections: state.collections.map(item => item.id === collectionId
      ? { ...item, storageMode: 'local', folderPath: undefined }
      : item)
  }));
  statuses.delete(collectionId);
  statusSnapshot = Object.fromEntries(statuses);
  statusListeners.forEach(listener => listener());
}

export async function resolveStorageConflict(collectionId: string, path: string, choice: 'reload' | 'keep'): Promise<void> {
  const runtime = runtimes.get(collectionId);
  const conflict = runtime?.conflicts.find(item => item.path === path);
  if (!runtime || !conflict) return;
  if (runtime.syncing) throw new Error('Wait for the current collection sync to finish before resolving this conflict.');
  const collection = useStore.getState().collections.find(item => item.id === collectionId);
  if (!collection) return;
  runtime.syncing = true;
  try {
    if (path === COLLECTION_MANIFEST_FILE) {
      const manifestPath = await absolute(runtime.path, path);
      const currentDiskText = await exists(manifestPath) ? await readTextFile(manifestPath) : null;
      if (currentDiskText !== conflict.diskText) {
        conflict.diskText = currentDiskText;
        publishStatus(collectionId, statusFor(runtime));
        throw new Error('The collection manifest changed again. Review the updated conflict before resolving it.');
      }
      if (choice === 'reload') {
        if (currentDiskText === null) throw new Error('The collection manifest was deleted on disk.');
        const manifest = parseManifest(currentDiskText);
        setCollection(collectionId, current => ({ ...current, name: manifest.name, folders: manifest.folders }));
        runtime.manifestText = currentDiskText;
      } else {
        const local = serializeManifest(collection);
        await writeAtomically(manifestPath, local);
        runtime.manifestText = local;
      }
    } else if (conflict.requestId) {
      const diskPath = conflict.diskPath || conflict.path;
      const absoluteDiskPath = await absolute(runtime.path, diskPath);
      const currentDiskText = await exists(absoluteDiskPath) ? await readTextFile(absoluteDiskPath) : null;
      if (currentDiskText !== conflict.diskText) {
        conflict.diskText = currentDiskText;
        publishStatus(collectionId, statusFor(runtime));
        throw new Error('The request file changed again. Review the updated conflict before resolving it.');
      }

      if (choice === 'reload') {
        if (currentDiskText === null) {
          setCollection(collectionId, current => ({ ...current, requests: current.requests.filter(request => request.id !== conflict.requestId) }));
          runtime.requests.delete(conflict.requestId);
        } else {
          const request = parseRequest(currentDiskText);
          const diskRequest = { request, path: diskPath, text: currentDiskText };
          setCollection(collectionId, current => ({
            ...current,
            requests: sortCollectionRequests([...current.requests.filter(item => item.id !== request.id), request])
          }));
          runtime.requests.set(request.id, diskRequest);
        }
      } else {
        const local = collection.requests.find(request => request.id === conflict.requestId);
        if (local) {
          const localPath = requestRelativePath(local, collection.folders || []);
          const localText = serializeRequest(local);
          const absoluteLocalPath = await absolute(runtime.path, localPath);
          if (localPath !== diskPath && await exists(absoluteLocalPath)) {
            const targetText = await readTextFile(absoluteLocalPath);
            if (targetText !== localText) throw new Error('The destination path contains different data. Resolve that file conflict first.');
          }
          await writeAtomically(absoluteLocalPath, localText);
          if (diskPath !== localPath && currentDiskText !== null) await removeIfPresent(absoluteDiskPath);
          runtime.requests.set(local.id, { request: local, path: localPath, text: localText });
        } else {
          if (currentDiskText !== null) await removeIfPresent(absoluteDiskPath);
          runtime.requests.delete(conflict.requestId);
        }
      }
    }
    runtime.conflicts = runtime.conflicts.filter(item => item.path !== path);
    publishStatus(collectionId, statusFor(runtime));
  } finally {
    runtime.syncing = false;
  }
  if (!runtime.conflicts.length) scheduleSync(collectionId);
}

export function startCollectionStorage(): () => void {
  stopStoreSubscription?.();
  stopStoreSubscription = useStore.subscribe((state, previous) => {
    if (state.collections === previous.collections) return;
    const currentIds = new Set(state.collections.map(collection => collection.id));
    let removedRuntime = false;
    for (const [collectionId, runtime] of runtimes) {
      if (currentIds.has(collectionId)) continue;
      if (runtime.timer) clearTimeout(runtime.timer);
      runtime.unwatch?.();
      runtimes.delete(collectionId);
      statuses.delete(collectionId);
      removedRuntime = true;
    }
    if (removedRuntime) {
      statusSnapshot = Object.fromEntries(statuses);
      statusListeners.forEach(listener => listener());
    }
    for (const collection of state.collections) {
      const runtime = runtimes.get(collection.id);
      if (collection.storageMode === 'folder' && collection.folderPath && runtime && !runtime.applyingDisk) {
        scheduleSync(collection.id);
      }
    }
  });

  for (const collection of useStore.getState().collections) {
    if (collection.storageMode !== 'folder' || !collection.folderPath) continue;
    publishStatus(collection.id, { state: 'loading', errors: [], conflicts: [] });
    void readDiskCollection(collection.folderPath).then(disk => {
      if (disk.manifest.id !== collection.id) throw new Error('Collection ID on disk does not match the saved collection.');
      const runtime = installRuntime(collection.id, collection.folderPath!, disk);
      runtime.applyingDisk = true;
      setCollection(collection.id, current => ({
        ...current,
        name: disk.manifest.name,
        folders: disk.manifest.folders,
        requests: sortCollectionRequests([...disk.requests.values()].map(entry => entry.request))
      }));
      runtime.applyingDisk = false;
      publishStatus(collection.id, statusFor(runtime));
    }).catch(error => {
      publishStatus(collection.id, { state: 'error', message: error instanceof Error ? error.message : String(error), errors: [], conflicts: [] });
    });
  }

  return () => {
    stopStoreSubscription?.();
    stopStoreSubscription = undefined;
    for (const runtime of runtimes.values()) {
      if (runtime.timer) clearTimeout(runtime.timer);
      runtime.unwatch?.();
    }
    runtimes.clear();
  };
}