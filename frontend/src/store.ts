import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Domain Types ────────────────────────────────────────────────────────────

export type RequestStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface ServiceRequest {
  id: string;
  customer_account: string;
  request_type: string;
  status: RequestStatus;
  progress: number;
  operator_username?: string;
  created_at?: string;
  updated_at?: string;
  logs: string[];
}

// ─── State Shape ─────────────────────────────────────────────────────────────

interface AuthState {
  token: string | null;
  username: string | null;
  role: 'OPERATOR' | 'SUPERVISOR' | null;
}

interface RequestState {
  requests: ServiceRequest[];
}

interface Actions {
  // Auth
  setAuth: (auth: AuthState) => void;
  clearAuth: () => void;
  // Requests
  setRequests: (requests: ServiceRequest[]) => void;
  upsertRequest: (req: Partial<ServiceRequest> & { id: string; log_message?: string }) => void;
}

type AppStore = AuthState & RequestState & Actions;

// ─── Store ───────────────────────────────────────────────────────────────────

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      // Auth state
      token: null,
      username: null,
      role: null,

      // Request state
      requests: [],

      // Actions
      setAuth: (auth) => set(auth),
      clearAuth: () => set({ token: null, username: null, role: null, requests: [] }),
      setRequests: (requests) => set({ requests: requests.map(r => ({ ...r, logs: r.logs || [] })) }),

      /**
       * Upserts a request by ID.
       * If the request already exists, merges the partial update (used for
       * real-time WebSocket progress events). If it doesn't exist, appends it.
       */
      upsertRequest: (partial) =>
        set((state) => {
          const exists = state.requests.some((r) => r.id === partial.id);
          const logMsg = partial.log_message;
          
          if (exists) {
            return {
              requests: state.requests.map((r) => {
                if (r.id !== partial.id) return r;
                const newLogs = logMsg ? [...(r.logs || []), logMsg] : r.logs || [];
                return { ...r, ...partial, logs: newLogs };
              }),
            };
          }
          
          const newReq = { ...partial, logs: logMsg ? [logMsg] : [] } as ServiceRequest;
          return { requests: [newReq, ...state.requests] };
        }),
    }),
    {
      name: 'nexusflow-auth',
      // Only persist auth — requests are loaded fresh from API on mount
      partialize: (state) => ({
        token: state.token,
        username: state.username,
        role: state.role,
      }),
    }
  )
);
