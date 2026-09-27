import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type AuthType = 'none' | 'bearer' | 'basic' | 'api_key';

export interface Auth {
  type: AuthType;
  bearerToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  apiKeyKey?: string;
  apiKeyValue?: string;
  apiKeyIn?: 'header' | 'query';
}

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface Environment {
  id: string;
  name: string;
  variables: EnvironmentVariable[];
}

export interface RequestItem {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: string;
  auth?: Auth;
  preRequestScript?: string;
  testScript?: string;
}

export interface RunnerResult {
  requestId: string;
  requestName: string;
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

export interface Collection {
  id: string;
  name: string;
  requests: RequestItem[];
  isOpen: boolean;
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
  getActiveRequest: () => RequestItem | undefined;
  updateActiveRequest: (updates: Partial<RequestItem>) => void;
  addRequest: (collectionId: string, req: Omit<RequestItem, 'id'>) => void;
  renameRequest: (id: string, newName: string) => void;
  deleteRequest: (id: string) => void;
  duplicateRequest: (id: string) => void;
  addCollection: (name: string) => void;
  renameCollection: (id: string, newName: string) => void;
  deleteCollection: (id: string) => void;
  addEnvironment: (name: string) => void;
  updateEnvironment: (id: string, updates: Partial<Environment>) => void;
  deleteEnvironment: (id: string) => void;
  duplicateEnvironment: (id: string) => void;
  setActiveEnvironment: (id: string | null) => void;
  openEnvironmentTab: (id: string) => void;
  importCollection: (collection: Collection) => void;
  importEnvironment: (env: Environment) => void;
  activeView: 'editor' | 'runner';
  setActiveView: (view: 'editor' | 'runner') => void;
  runnerState: RunnerState;
  setRunnerState: (updates: Partial<RunnerState>) => void;
  toast: { message: string, type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      activeView: 'editor',
      runnerState: { collectionId: null, isRunning: false, results: [], currentIndex: 0 },
      activeRequestId: 'req-1',
      openRequestIds: ['req-1'],
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
              body: '{\n  "name": "morpheus",\n  "job": "leader"\n}'
            },
            {
              id: 'req-4',
              name: 'Update User',
              method: 'PUT',
              url: 'https://reqres.in/api/users/2',
              headers: {
                'Content-Type': 'application/json'
              },
              body: '{\n  "name": "morpheus",\n  "job": "zion resident"\n}'
            },
            {
              id: 'req-5',
              name: 'Modify User',
              method: 'PATCH',
              url: 'https://reqres.in/api/users/2',
              headers: {
                'Content-Type': 'application/json'
              },
              body: '{\n  "job": "matrix hacker"\n}'
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

      toggleTheme: () => set(state => { const t = state.theme === "dark" ? "light" : "dark"; document.documentElement.classList.toggle("light", t === "light"); return { theme: t }; }),

      getActiveRequest: () => {
        const state = get();
        for (const col of state.collections) {
          const req = col.requests.find(r => r.id === state.activeRequestId);
          if (req) return req;
        }
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
          }))
        };
      }),
      addRequest: (collectionId, req) => set((state) => {
        const id = `req-${Date.now()}`;
        const newReq: RequestItem = { ...req, id };
        
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
      deleteRequest: (id) => set((state) => {
        // Close the request if it's open
        const openRequestIds = state.openRequestIds.filter(reqId => reqId !== id);
        let activeRequestId = state.activeRequestId;
        if (activeRequestId === id) {
          const idx = state.openRequestIds.indexOf(id);
          activeRequestId = openRequestIds.length > 0 ? openRequestIds[Math.max(0, idx - 1)] : null;
        }
        
        return {
          collections: state.collections.map(col => ({
            ...col,
            requests: col.requests.filter(req => req.id !== id)
          })),
          openRequestIds,
          activeRequestId
        };
      }),
      duplicateRequest: (id) => set((state) => {
        let duplicatedReq: RequestItem | null = null;
        let targetColId: string | null = null;
        
        for (const col of state.collections) {
          const req = col.requests.find(r => r.id === id);
          if (req) {
            duplicatedReq = { ...req, id: `req-${Date.now()}`, name: `${req.name} Copy` };
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
          requests: []
        }]
      })),
      renameCollection: (id, newName) => set((state) => ({
        collections: state.collections.map(col => 
          col.id === id ? { ...col, name: newName } : col
        )
      })),
      deleteCollection: (id) => set((state) => {
        const colToDelete = state.collections.find(c => c.id === id);
        if (!colToDelete) return state;
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
      }),
      addEnvironment: (name) => set((state) => ({
        environments: [...state.environments, {
          id: `env-${Date.now()}`,
          name,
          variables: []
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
      duplicateEnvironment: (id) => set((state) => {
        const envToDuplicate = state.environments.find(e => e.id === id);
        if (!envToDuplicate) return state;
        const newEnv = {
          ...envToDuplicate,
          id: `env-${Date.now()}`,
          name: `${envToDuplicate.name} Copy`,
          variables: envToDuplicate.variables.map(v => ({ ...v, id: `var-${Date.now()}-${Math.random()}` }))
        };
        return { environments: [...state.environments, newEnv] };
      }),
      setActiveEnvironment: (id) => set(() => ({
        activeEnvironmentId: id
      })),
      openEnvironmentTab: (id) => set((state) => ({
        activeRequestId: id,
        openRequestIds: state.openRequestIds.includes(id) ? state.openRequestIds : [...state.openRequestIds, id]
      })),
      importCollection: (collection) => set((state) => {
        const newCol = { ...collection, id: `col-${Date.now()}` };
        // also regenerate request IDs to avoid collisions
        newCol.requests = newCol.requests.map((r, i) => ({ ...r, id: `req-${Date.now()}-${i}` }));
        return { collections: [...state.collections, newCol] };
      }),
      importEnvironment: (env) => set((state) => ({
        environments: [...state.environments, { ...env, id: `env-${Date.now()}` }]
      })),
      setActiveView: (view) => set({ activeView: view }),
      setRunnerState: (updates) => set((state) => ({ runnerState: { ...state.runnerState, ...updates } })),
      toast: null,
      showToast: (message, type = 'info') => {
        set({ toast: { message, type } });
        setTimeout(() => {
          set((state) => (state.toast?.message === message ? { toast: null } : state));
        }, 3000);
      },
      hideToast: () => set({ toast: null })
    }),
    {
      name: 'pigeon-store',
    }
  )
);
