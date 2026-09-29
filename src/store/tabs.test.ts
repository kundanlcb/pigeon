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
