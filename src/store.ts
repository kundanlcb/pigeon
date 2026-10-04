import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deleteUnusedRequestSecrets, duplicateEnvironmentWithSecrets } from './utils/authSecrets';
import { type AuditFinding } from './utils/security/engine';

export interface RequestFindings {
  requestId: string;
  requestName: string;
  requestMethod: string;
  findings: AuditFinding[];
}

export interface SecurityScanRecord {
  id: string;
  timestamp: number;
  requestIds: string[];
  findings: RequestFindings[];
  logs: string[];
}

export interface TargetMetrics {
  total_requests: number;
  success_count: number;
  error_count: number;
  rps: number;
  p50_latency_ms: number;
  p90_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  status_codes: Record<number, number>;
}

export interface TelemetrySnapshot {
  time: string;
  path: string;
  rps: number;
  p50: number;
  p95: number;
  success: number;
  error: number;
  target_metrics?: Record<string, TargetMetrics>;
}

export interface LoadTestRecord {
  id: string;
  name: string;
  targetUrl: string;
  timestamp: number;
  durationSec: number;
  vus: number;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  rps: number;
  p95LatencyMs: number;
  telemetryLogs: TelemetrySnapshot[];
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type AuthType = 'none' | 'bearer' | 'basic' | 'api_key' | 'oauth2_client_credentials';

export interface Auth {
  type: AuthType;
  bearerToken?: string;
  bearerTokenInKeychain?: boolean;
  bearerTokenKeychainRef?: string;
  basicUsername?: string;
  basicPassword?: string;
  basicPasswordInKeychain?: boolean;
  basicPasswordKeychainRef?: string;
  apiKeyKey?: string;
  apiKeyValue?: string;
  apiKeyValueInKeychain?: boolean;
  apiKeyValueKeychainRef?: string;
  apiKeyIn?: 'header' | 'query';
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  clientSecretInKeychain?: boolean;
  clientSecretKeychainRef?: string;
  scope?: string;
}

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  secret?: boolean;
  secretStored?: boolean;
}

export interface Environment {
  id: string;
  name: string;
  variables: EnvironmentVariable[];
}

export type BodyType = 'none' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary' | 'graphql';
export type RawBodyLanguage = 'json' | 'text' | 'xml' | 'html' | 'javascript';

export interface KeyValPair {
  id: string;
  key: string;
  value: string;
  type?: 'text' | 'file';
  enabled: boolean;
}

export interface RequestBody {
  type: BodyType;
  raw?: string;
  rawLanguage?: RawBodyLanguage;
  formData?: KeyValPair[];
  urlencoded?: KeyValPair[];
  graphql?: { query: string; variables: string };
  binaryPath?: string;
}

export interface RequestItem {
  id: string;
  name: string;
  folderId?: string | null;
  order?: number;
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  disabledHeaders?: string[];
  disabledParams?: string[];
  body?: RequestBody | string; // keeping string for backwards compatibility
  auth?: Auth;
  authorizationHeaderInKeychain?: boolean;
  authorizationHeaderKeychainRef?: string;
  preRequestScript?: string;
  testScript?: string;
}

export interface HistoryItem {
  id: string;
  requestId?: string;
  request: RequestItem;
  timestamp: number;
}

export interface RunnerResult {
  requestId: string;
  requestName: string;
  iteration?: number;
  status: 'success' | 'error' | 'pending' | 'running';
  statusCode?: number;
  responseTime?: number;
  testResults: { name: string; passed: boolean; error?: string }[];
  error?: string;
}

export interface RunnerState {
  collectionId: string | null;
  isRunning: boolean;
  results: RunnerResult[];
  currentIndex: number;
}

export interface FlowNodeExtraction {
  id: string;
  path: string;
  variableName: string;
  source: 'body' | 'header';
}

export interface FlowNode {
  id: string;
  type: string; // 'requestNode', 'delayNode'
  position: { x: number; y: number };
  data: {
    requestId?: string;
    continueOnError?: boolean;
    extractions?: FlowNodeExtraction[];
    [key: string]: any;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
}

export interface Flow {
  id: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  collectionId?: string;
  continueOnError?: boolean;
  parallelExecution?: boolean;
}

export interface Collection {
  id: string;
  name: string;
  requests: RequestItem[];
  isOpen: boolean;
  storageMode?: 'local' | 'folder';
  folderPath?: string;
  folders?: CollectionFolder[];
}

export interface CollectionFolder {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
}

export interface AppSettings {
  insecureSSL: boolean;
  requestTimeout: number;
  maxRedirects: number;
}

interface AppState {
  theme: "dark" | "light";
  toggleTheme: () => void;
  collections: Collection[];
  activeRequestId: string | null;
  openRequestIds: string[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  toggleCollection: (id: string) => void;
  setActiveRequest: (id: string) => void;
  closeRequest: (id: string) => void;
  closeOtherRequests: (id: string) => void;
  closeAllRequests: () => void;
  closeRequestsToTheRight: (id: string) => void;
  getActiveRequest: () => RequestItem | undefined;
  updateActiveRequest: (updates: Partial<RequestItem>) => void;
  updateRequest: (id: string, updates: Partial<RequestItem>) => void;
  updateRequestAuth: (id: string, updates: Partial<Auth>) => void;
  addRequest: (collectionId: string, req: Omit<RequestItem, 'id'>) => void;
  renameRequest: (id: string, newName: string) => void;
  deleteRequest: (id: string) => void;
  duplicateRequest: (id: string) => void;
  addCollection: (name: string) => void;
  renameCollection: (id: string, newName: string) => void;
  deleteCollection: (id: string) => void;
  addCollectionFolder: (collectionId: string, name: string, parentId?: string | null) => void;
  renameCollectionFolder: (collectionId: string, folderId: string, name: string) => void;
  deleteCollectionFolder: (collectionId: string, folderId: string) => void;
  moveRequestToFolder: (requestId: string, folderId: string | null) => void;
  addEnvironment: (name: string) => void;
  updateEnvironment: (id: string, updates: Partial<Environment>) => void;
  deleteEnvironment: (id: string) => void;
  duplicateEnvironment: (id: string) => Promise<void>;
  setActiveEnvironment: (id: string | null) => void;
  openEnvironmentTab: (id: string) => void;
  importCollection: (collection: Collection) => void;
  importEnvironment: (env: Environment) => void;
  importWorkspace: (data: { collections: Collection[], environments: Environment[], flows: Flow[] }) => void;
  activeView: 'editor' | 'runner' | 'automation' | 'history' | 'source-control' | 'security' | 'performance';
  setActiveView: (view: 'editor' | 'runner' | 'automation' | 'history' | 'source-control' | 'security' | 'performance') => void;
  selectedSecurityRequestIds: string[];
  setSelectedSecurityRequestIds: (ids: string[]) => void;
  securityHistory: SecurityScanRecord[];
  activeSecurityScanId: string | null;
  setActiveSecurityScanId: (id: string | null) => void;
  addSecurityScan: (scan: SecurityScanRecord) => void;
  deleteSecurityScan: (id: string) => void;
  clearSecurityHistory: () => void;
  selectedPerformanceRequestIds: string[];
  setSelectedPerformanceRequestIds: (ids: string[]) => void;
  performanceHistory: LoadTestRecord[];
  activePerformanceTestId: string | null;
  setActivePerformanceTestId: (id: string | null) => void;
  addPerformanceTest: (record: LoadTestRecord) => void;
  deletePerformanceTest: (id: string) => void;
  clearPerformanceHistory: () => void;
  flows: Flow[];
  activeFlowId: string | null;
  addFlow: (name: string) => void;
  deleteFlow: (id: string) => void;
  setActiveFlow: (id: string) => void;
  updateFlow: (id: string, updates: Partial<Flow>) => void;
  runnerState: RunnerState;
  setRunnerState: (updates: Partial<RunnerState>) => void;
  toast: { message: string, type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
  appSettings: AppSettings;
  updateAppSettings: (settings: Partial<AppSettings>) => void;
  history: HistoryItem[];
  addHistoryItem: (request: RequestItem) => void;
  removeHistoryItem: (id: string) => void;
  clearHistory: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      appSettings: { insecureSSL: true, requestTimeout: 30000, maxRedirects: 10 },
      theme: "dark",
      activeView: 'editor',
      selectedSecurityRequestIds: [],
      securityHistory: [],
      activeSecurityScanId: null,
      selectedPerformanceRequestIds: [],
      performanceHistory: [],
      activePerformanceTestId: null,
      runnerState: { collectionId: null, isRunning: false, results: [], currentIndex: 0 },
      activeRequestId: 'req-1',
      openRequestIds: ['req-1'],
      history: [],
      flows: [],
      activeFlowId: null,
      environments: [
        {
          id: 'env-1',
          name: 'Global',
          variables: [
            { id: 'var-1', key: 'base_url', value: 'https://reqres.in/api', enabled: true }
          ]
        }
      ],
      activeEnvironmentId: 'env-1',
      collections: [
        {
          id: 'col-1',
          name: 'ReqRes Public API',
          isOpen: true,
          requests: [
            {
              id: 'req-1',
              name: 'List Users',
              method: 'GET',
              url: 'https://reqres.in/api/users?page=2',
              headers: {},
            },
            {
              id: 'req-2',
              name: 'Single User',
              method: 'GET',
              url: 'https://reqres.in/api/users/2',
              headers: {},
            },
            {
              id: 'req-3',
              name: 'Create User',
              method: 'POST',
              url: 'https://reqres.in/api/users',
              headers: {
                'Content-Type': 'application/json'
              },
              body: { type: 'raw', raw: '{\n  "name": "morpheus",\n  "job": "leader"\n}', rawLanguage: 'json' }
            },
            {
              id: 'req-4',
              name: 'Update User',
              method: 'PUT',
              url: 'https://reqres.in/api/users/2',
              headers: {
                'Content-Type': 'application/json'
              },
              body: { type: 'raw', raw: '{\n  "name": "morpheus",\n  "job": "zion resident"\n}', rawLanguage: 'json' }
            },
            {
              id: 'req-5',
              name: 'Modify User',
              method: 'PATCH',
              url: 'https://reqres.in/api/users/2',
              headers: {
                'Content-Type': 'application/json'
              },
              body: { type: 'raw', raw: '{\n  "job": "matrix hacker"\n}', rawLanguage: 'json' }
            },
            {
              id: 'req-6',
              name: 'Delete User',
              method: 'DELETE',
              url: 'https://reqres.in/api/users/2',
              headers: {},
            }
          ]
        }
      ] as Collection[],

      toggleCollection: (id) => set((state) => ({
        collections: state.collections.map(c => 
          c.id === id ? { ...c, isOpen: !c.isOpen } : c
        )
      })),

      setActiveRequest: (id) => set((state) => {
        const openRequestIds = state.openRequestIds.includes(id) 
          ? state.openRequestIds 
          : [...state.openRequestIds, id];
        return { activeRequestId: id, openRequestIds };
      }),

      closeRequest: (id) => set((state) => {
        const openRequestIds = state.openRequestIds.filter(reqId => reqId !== id);
        let activeRequestId = state.activeRequestId;
        if (activeRequestId === id) {
          const idx = state.openRequestIds.indexOf(id);
          if (openRequestIds.length > 0) {
            activeRequestId = openRequestIds[Math.max(0, idx - 1)];
          } else {
            activeRequestId = null;
          }
        }
        return { openRequestIds, activeRequestId };
      }),

      closeOtherRequests: (id) => set((state) => {
        const openRequestIds = state.openRequestIds.includes(id) ? [id] : [];
        return {
          openRequestIds,
          activeRequestId: openRequestIds.length > 0 ? id : null
        };
      }),

      closeAllRequests: () => set({
        openRequestIds: [],
        activeRequestId: null
      }),

      closeRequestsToTheRight: (id) => set((state) => {
        const idx = state.openRequestIds.indexOf(id);
        if (idx === -1) return state;
        const openRequestIds = state.openRequestIds.slice(0, idx + 1);
        let activeRequestId = state.activeRequestId;
        if (!activeRequestId || !openRequestIds.includes(activeRequestId)) {
          activeRequestId = id;
        }
        return { openRequestIds, activeRequestId };
      }),

      toggleTheme: () => set(state => { const t = state.theme === "dark" ? "light" : "dark"; document.documentElement.classList.toggle("light", t === "light"); return { theme: t }; }),

      getActiveRequest: () => {
        const state = get();
        for (const col of state.collections) {
          const req = col.requests.find(r => r.id === state.activeRequestId);
          if (req) return req;
        }
        const histReq = state.history.find(h => h.id === state.activeRequestId);
        if (histReq) return histReq.request;
        return undefined;
      },

      updateActiveRequest: (updates) => set((state) => {
        if (!state.activeRequestId) return state;
        return {
          collections: state.collections.map(col => ({
            ...col,
            requests: col.requests.map(req => 
              req.id === state.activeRequestId ? { ...req, ...updates } : req
            )
          })),
          history: state.history.map(h => 
            h.id === state.activeRequestId ? { ...h, request: { ...h.request, ...updates } } : h
          )
        };
      }),
      updateRequest: (id, updates) => set((state) => ({
        collections: state.collections.map(collection => ({
          ...collection,
          requests: collection.requests.map(request => request.id === id ? { ...request, ...updates } : request)
        }))
      })),
      updateRequestAuth: (id, updates) => set((state) => ({
        collections: state.collections.map(collection => ({
          ...collection,
          requests: collection.requests.map(request => request.id === id
            ? { ...request, auth: { ...(request.auth || { type: 'none' }), ...updates } }
            : request)
        }))
      })),
      addRequest: (collectionId, req) => set((state) => {
        const id = `req-${crypto.randomUUID()}`;
        const collection = state.collections.find(col => col.id === collectionId);
        const siblingOrders = collection?.requests
          .filter(request => (request.folderId || null) === (req.folderId || null))
          .map(request => request.order ?? 0) || [];
        const newReq: RequestItem = {
          ...req,
          id,
          folderId: req.folderId || null,
          order: req.order ?? (siblingOrders.length ? Math.max(...siblingOrders) + 1 : 0)
        };
        
        return {
          collections: state.collections.map(col => 
            col.id === collectionId ? { ...col, requests: [...col.requests, newReq], isOpen: true } : col
          ),
          activeRequestId: id,
          openRequestIds: state.openRequestIds.includes(id) ? state.openRequestIds : [...state.openRequestIds, id]
        };
      }),
      renameRequest: (id, newName) => set((state) => ({
        collections: state.collections.map(col => ({
          ...col,
          requests: col.requests.map(req => 
            req.id === id ? { ...req, name: newName } : req
          )
        }))
      })),
      deleteRequest: (id) => {
        let removedRequest: RequestItem | undefined;
        set((state) => {
        // Close the request if it's open
        const openRequestIds = state.openRequestIds.filter(reqId => reqId !== id);
        let activeRequestId = state.activeRequestId;
        if (activeRequestId === id) {
          const idx = state.openRequestIds.indexOf(id);
          activeRequestId = openRequestIds.length > 0 ? openRequestIds[Math.max(0, idx - 1)] : null;
        }
        
        removedRequest = state.collections.flatMap(collection => collection.requests).find(request => request.id === id);
        return {
          collections: state.collections.map(col => ({
            ...col,
            requests: col.requests.filter(req => req.id !== id)
          })),
          openRequestIds,
          activeRequestId
        };
        });
        if (removedRequest) {
          void deleteUnusedRequestSecrets(get().collections, [removedRequest]).catch(error =>
            get().showToast(`Could not remove unused request credentials: ${String(error)}`, 'error')
          );
        }
      },
      duplicateRequest: (id) => set((state) => {
        let duplicatedReq: RequestItem | null = null;
        let targetColId: string | null = null;
        
        for (const col of state.collections) {
          const req = col.requests.find(r => r.id === id);
          if (req) {
            const siblingOrders = col.requests
              .filter(request => (request.folderId || null) === (req.folderId || null))
              .map(request => request.order ?? 0);
            duplicatedReq = {
              ...req,
              id: `req-${crypto.randomUUID()}`,
              name: `${req.name} Copy`,
              order: siblingOrders.length ? Math.max(...siblingOrders) + 1 : 0
            };
            targetColId = col.id;
            break;
          }
        }
        
        if (!duplicatedReq || !targetColId) return state;
        
        return {
          collections: state.collections.map(col => 
            col.id === targetColId ? { ...col, requests: [...col.requests, duplicatedReq!] } : col
          )
        };
      }),
      addCollection: (name) => set((state) => ({
        collections: [...state.collections, {
          id: `col-${Date.now()}`,
          name,
          isOpen: true,
          requests: [],
          folders: [],
          storageMode: 'local'
        }]
      })),
      renameCollection: (id, newName) => set((state) => ({
        collections: state.collections.map(col => 
          col.id === id ? { ...col, name: newName } : col
        )
      })),
      deleteCollection: (id) => {
        let removedRequests: RequestItem[] = [];
        set((state) => {
        const colToDelete = state.collections.find(c => c.id === id);
        if (!colToDelete) return state;
        removedRequests = colToDelete.requests;
        const requestIdsToDelete = colToDelete.requests.map(r => r.id);
        
        const openRequestIds = state.openRequestIds.filter(reqId => !requestIdsToDelete.includes(reqId));
        let activeRequestId = state.activeRequestId;
        if (activeRequestId && requestIdsToDelete.includes(activeRequestId)) {
          activeRequestId = openRequestIds.length > 0 ? openRequestIds[openRequestIds.length - 1] : null;
        }

        return {
          collections: state.collections.filter(c => c.id !== id),
          openRequestIds,
          activeRequestId
        };
        });
        void deleteUnusedRequestSecrets(get().collections, removedRequests).catch(error =>
          get().showToast(`Could not remove unused request credentials: ${String(error)}`, 'error')
        );
      },
      addCollectionFolder: (collectionId, name, parentId = null) => set((state) => ({
        collections: state.collections.map(collection => {
          if (collection.id !== collectionId) return collection;
          const folders = collection.folders || [];
          const siblingOrders = folders.filter(folder => folder.parentId === parentId).map(folder => folder.order);
          return {
            ...collection,
            folders: [...folders, {
              id: `folder-${crypto.randomUUID()}`,
              name,
              parentId,
              order: siblingOrders.length ? Math.max(...siblingOrders) + 1 : 0
            }],
            isOpen: true
          };
        })
      })),
      renameCollectionFolder: (collectionId, folderId, name) => set((state) => ({
        collections: state.collections.map(collection => collection.id !== collectionId
          ? collection
          : {
              ...collection,
              folders: (collection.folders || []).map(folder => folder.id === folderId ? { ...folder, name } : folder)
            })
      })),
      deleteCollectionFolder: (collectionId, folderId) => {
        let removedRequests: RequestItem[] = [];
        set((state) => {
        const collection = state.collections.find(item => item.id === collectionId);
        if (!collection) return state;
        const folders = collection.folders || [];
        const removedFolderIds = new Set([folderId]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const folder of folders) {
            if (folder.parentId && removedFolderIds.has(folder.parentId) && !removedFolderIds.has(folder.id)) {
              removedFolderIds.add(folder.id);
              changed = true;
            }
          }
        }
        removedRequests = collection.requests
          .filter(request => request.folderId && removedFolderIds.has(request.folderId))
        const removedRequestIds = new Set(removedRequests.map(request => request.id));
        const openRequestIds = state.openRequestIds.filter(id => !removedRequestIds.has(id));
        const activeRequestId = state.activeRequestId && removedRequestIds.has(state.activeRequestId)
          ? openRequestIds.at(-1) || null
          : state.activeRequestId;
        return {
          collections: state.collections.map(item => item.id !== collectionId
            ? item
            : {
                ...item,
                folders: folders.filter(folder => !removedFolderIds.has(folder.id)),
                requests: item.requests.filter(request => !removedRequestIds.has(request.id))
              }),
          openRequestIds,
          activeRequestId
        };
        });
        void deleteUnusedRequestSecrets(get().collections, removedRequests).catch(error =>
          get().showToast(`Could not remove unused request credentials: ${String(error)}`, 'error')
        );
      },
      moveRequestToFolder: (requestId, folderId) => set((state) => ({
        collections: state.collections.map(collection => {
          const request = collection.requests.find(item => item.id === requestId);
          if (!request || (folderId && !(collection.folders || []).some(folder => folder.id === folderId))) return collection;
          const siblingOrders = collection.requests
            .filter(item => item.id !== requestId && (item.folderId || null) === folderId)
            .map(item => item.order ?? 0);
          return {
            ...collection,
            requests: collection.requests.map(item => item.id !== requestId ? item : {
              ...item,
              folderId,
              order: siblingOrders.length ? Math.max(...siblingOrders) + 1 : 0
            })
          };
        })
      })),
      addEnvironment: (name) => set((state) => ({
        environments: [...state.environments, {
          id: `env-${Date.now()}`,
          name,
          variables: [{ id: `var-${Date.now()}-${Math.random()}`, key: '', value: '', enabled: true }]
        }]
      })),
      updateEnvironment: (id, updates) => set((state) => ({
        environments: state.environments.map(env => 
          env.id === id ? { ...env, ...updates } : env
        )
      })),
      deleteEnvironment: (id) => set((state) => ({
        environments: state.environments.filter(env => env.id !== id),
        activeEnvironmentId: state.activeEnvironmentId === id ? null : state.activeEnvironmentId
      })),
      duplicateEnvironment: async (id) => {
        const environment = get().environments.find(item => item.id === id);
        if (!environment) return;
        try {
          const duplicate = await duplicateEnvironmentWithSecrets(environment);
          set(state => ({ environments: [...state.environments, duplicate] }));
        } catch (error) {
          get().showToast(`Could not duplicate environment: ${String(error)}`, 'error');
        }
      },
      setActiveEnvironment: (id) => set(() => ({
        activeEnvironmentId: id
      })),
      openEnvironmentTab: (id) => set((state) => ({
        activeRequestId: id,
        openRequestIds: state.openRequestIds.includes(id) ? state.openRequestIds : [...state.openRequestIds, id]
      })),
      importCollection: (collection) => set((state) => {
        const newCol = { ...collection, id: `col-${crypto.randomUUID()}`, storageMode: 'local' as const, folderPath: undefined, isOpen: true };
        const folderIdMap = new Map((collection.folders || []).map(folder => [folder.id, `folder-${crypto.randomUUID()}`]));
        newCol.folders = (collection.folders || []).map(folder => ({
          ...folder,
          id: folderIdMap.get(folder.id)!,
          parentId: folder.parentId ? folderIdMap.get(folder.parentId) || null : null
        }));
        newCol.requests = newCol.requests.map((request, index) => ({
          ...request,
          id: `req-${crypto.randomUUID()}`,
          folderId: request.folderId ? folderIdMap.get(request.folderId) || null : null,
          order: request.order ?? index
        }));
        return { collections: [...state.collections, newCol] };
      }),
      importEnvironment: (env) => set((state) => ({ environments: [...state.environments, env] })),
      importWorkspace: (data) => set((state) => {
        if (!data || !Array.isArray(data.collections)) return state;
        return {
          collections: data.collections,
          environments: Array.isArray(data.environments) ? data.environments : state.environments,
          flows: Array.isArray(data.flows) ? data.flows : state.flows,
          activeRequestId: null,
          openRequestIds: [],
          activeEnvironmentId: Array.isArray(data.environments) && data.environments.length > 0 ? data.environments[0].id : null,
          activeFlowId: null,
        };
      }),
      setActiveView: (view) => set({ activeView: view }),
      setSelectedSecurityRequestIds: (ids) => set({ selectedSecurityRequestIds: ids }),
      setActiveSecurityScanId: (id) => set({ activeSecurityScanId: id }),
      addSecurityScan: (scan) => set((state) => ({ securityHistory: [scan, ...state.securityHistory] })),
      deleteSecurityScan: (id) => set((state) => ({ 
        securityHistory: state.securityHistory.filter(s => s.id !== id),
        activeSecurityScanId: state.activeSecurityScanId === id ? null : state.activeSecurityScanId
      })),
      clearSecurityHistory: () => set({ securityHistory: [], activeSecurityScanId: null }),
      setSelectedPerformanceRequestIds: (ids) => set({ selectedPerformanceRequestIds: ids }),
      setActivePerformanceTestId: (id) => set({ activePerformanceTestId: id }),
      addPerformanceTest: (record) => set(state => ({ performanceHistory: [record, ...state.performanceHistory] })),
      deletePerformanceTest: (id) => set(state => ({ performanceHistory: state.performanceHistory.filter(r => r.id !== id) })),
      clearPerformanceHistory: () => set({ performanceHistory: [] }),
      
      addFlow: (name) => set((state) => {
        const newFlow = { id: `flow-${Date.now()}`, name, nodes: [], edges: [] };
        return { flows: [...state.flows, newFlow], activeFlowId: newFlow.id };
      }),
      deleteFlow: (id) => set((state) => ({ 
        flows: state.flows.filter(f => f.id !== id),
        activeFlowId: state.activeFlowId === id ? null : state.activeFlowId
      })),
      setActiveFlow: (id) => set({ activeFlowId: id, activeView: 'automation' }),
      updateFlow: (id, updates) => set((state) => ({
        flows: state.flows.map(f => f.id === id ? { ...f, ...updates } : f)
      })),
      
      setRunnerState: (updates) => set((state) => ({ runnerState: { ...state.runnerState, ...updates } })),
      toast: null,
      showToast: (message, type = 'info') => {
        set({ toast: { message, type } });
        setTimeout(() => {
          set((state) => (state.toast?.message === message ? { toast: null } : state));
        }, 3000);
      },
      hideToast: () => set({ toast: null }),
      updateAppSettings: (settings) => set((state) => ({ appSettings: { ...state.appSettings, ...settings } })),
      addHistoryItem: (request) => set((state) => {
        const now = Date.now();
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
        const id = `hist-${crypto.randomUUID()}`;
        const newHistoryItem: HistoryItem = {
          id,
          requestId: request.id,
          request: { ...request, id },
          timestamp: now
        };
        const currentHistory = state.history || [];
        const filteredHistory = currentHistory.filter(h => h.timestamp > thirtyDaysAgo);
        return {
          history: [newHistoryItem, ...filteredHistory]
        };
      }),
      removeHistoryItem: (id) => set((state) => ({
        history: (state.history || []).filter(h => h.id !== id)
      })),
      clearHistory: () => set({ history: [] })
    }),
    {
      name: 'pigeon-store',
      version: 2,
      partialize: (state) => {
        const { performanceHistory, securityHistory, runnerState, toast, ...rest } = state;
        return {
          ...rest,
          collections: rest.collections.map(collection => collection.storageMode === 'folder'
            ? { ...collection, requests: [] }
            : collection)
        } as unknown as AppState;
      },
      migrate: (persistedState: unknown, version: number) => {
        let state = persistedState as any;
        
        if (version < 2) {
          // Migration to v2: ensure history array exists, collection storageMode, folders, and request orders are set
          state = {
            ...state,
            history: state.history || [],
            collections: (state.collections || []).map((collection: any) => ({
              ...collection,
              storageMode: collection.storageMode || 'local',
              folders: collection.folders || [],
              requests: (collection.requests || []).map((request: any, order: number) => ({
                ...request,
                folderId: request.folderId || null,
                order: request.order ?? order
              }))
            }))
          };
        }
        
        return state as AppState;
      },
    }
  )
);
