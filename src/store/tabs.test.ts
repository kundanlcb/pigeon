import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../store';

describe('Tab management store actions', () => {
  beforeEach(() => {
    useStore.setState({
      openRequestIds: ['req-1', 'req-2', 'req-3', 'env-1', 'req-4'],
      activeRequestId: 'req-2'
    });
  });

  it('closes a single request and adjusts activeRequestId', () => {
    useStore.getState().closeRequest('req-2');
    const state = useStore.getState();
    expect(state.openRequestIds).toEqual(['req-1', 'req-3', 'env-1', 'req-4']);
    expect(state.activeRequestId).toBe('req-1');
  });

  it('closes other requests and keeps only the specified tab open and active', () => {
    useStore.getState().closeOtherRequests('env-1');
    const state = useStore.getState();
    expect(state.openRequestIds).toEqual(['env-1']);
    expect(state.activeRequestId).toBe('env-1');
  });

  it('closes all requests and clears activeRequestId', () => {
    useStore.getState().closeAllRequests();
    const state = useStore.getState();
    expect(state.openRequestIds).toEqual([]);
    expect(state.activeRequestId).toBeNull();
  });

  it('closes requests to the right of the target tab', () => {
    useStore.getState().closeRequestsToTheRight('req-2');
    const state = useStore.getState();
    expect(state.openRequestIds).toEqual(['req-1', 'req-2']);
    expect(state.activeRequestId).toBe('req-2');
  });

  it('adjusts activeRequestId if active tab was to the right and was closed', () => {
    useStore.setState({ activeRequestId: 'req-4' });
    useStore.getState().closeRequestsToTheRight('req-2');
    const state = useStore.getState();
    expect(state.openRequestIds).toEqual(['req-1', 'req-2']);
    expect(state.activeRequestId).toBe('req-2');
  });
});

describe('Duplication store actions', () => {
  it('duplicates a request and makes it active in tabs', () => {
    useStore.setState({
      collections: [{
        id: 'col-1',
        name: 'Test Collection',
        isOpen: true,
        requests: [
          { id: 'req-original', name: 'My Request', method: 'GET', url: 'https://example.com', headers: {} }
        ],
        folders: []
      }],
      openRequestIds: ['req-original'],
      activeRequestId: 'req-original'
    });

    useStore.getState().duplicateRequest('req-original');
    const state = useStore.getState();
    const col = state.collections[0];
    expect(col.requests).toHaveLength(2);
    const duplicated = col.requests.find(r => r.id !== 'req-original');
    expect(duplicated).toBeDefined();
    expect(duplicated?.name).toBe('My Request Copy');
    expect(state.activeRequestId).toBe(duplicated?.id);
    expect(state.openRequestIds).toContain(duplicated?.id);
  });

  it('duplicates a folder along with its subfolders and requests', () => {
    useStore.setState({
      collections: [{
        id: 'col-1',
        name: 'Test Collection',
        isOpen: true,
        folders: [
          { id: 'folder-root', name: 'Parent Folder', parentId: null, order: 0 },
          { id: 'folder-child', name: 'Child Folder', parentId: 'folder-root', order: 0 }
        ],
        requests: [
          { id: 'req-1', name: 'Req in root folder', method: 'GET', url: '', headers: {}, folderId: 'folder-root' },
          { id: 'req-2', name: 'Req in child folder', method: 'POST', url: '', headers: {}, folderId: 'folder-child' }
        ]
      }]
    });

    useStore.getState().duplicateCollectionFolder('col-1', 'folder-root');
    const state = useStore.getState();
    const col = state.collections[0];
    expect(col.folders).toHaveLength(4);
    expect(col.requests).toHaveLength(4);

    const dupParent = col.folders?.find(f => f.name === 'Parent Folder Copy');
    expect(dupParent).toBeDefined();

    const dupChild = col.folders?.find(f => f.parentId === dupParent?.id);
    expect(dupChild).toBeDefined();
    expect(dupChild?.name).toBe('Child Folder');

    const dupReq1 = col.requests.find(r => r.folderId === dupParent?.id);
    expect(dupReq1).toBeDefined();
    expect(dupReq1?.name).toBe('Req in root folder');

    const dupReq2 = col.requests.find(r => r.folderId === dupChild?.id);
    expect(dupReq2).toBeDefined();
    expect(dupReq2?.name).toBe('Req in child folder');
  });
});
