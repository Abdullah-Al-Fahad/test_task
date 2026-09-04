import type { ServiceRequest } from '@/store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

/**
 * A thin, typed wrapper around the fetch API.
 * Automatically attaches the Authorization header when a token is provided,
 * and throws a descriptive error on non-2xx responses.
 */
async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers = new Headers(fetchOptions.headers ?? {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API Error ${response.status}: ${errorBody}`);
  }

  // Handle 204 No Content
  if (response.status === 204) return null as T;

  return response.json() as Promise<T>;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access: string;
  refresh: string;
  username: string;
  role: 'OPERATOR' | 'SUPERVISOR';
}

export async function login(username: string, password: string): Promise<TokenResponse> {
  return request<TokenResponse>('/api/token/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function register(
  username: string,
  password: string,
  role: 'OPERATOR' | 'SUPERVISOR'
): Promise<TokenResponse> {
  return request<TokenResponse>('/api/register/', {
    method: 'POST',
    body: JSON.stringify({ username, password, role }),
  });
}

// ─── Service Requests ────────────────────────────────────────────────────────

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function fetchRequests(token: string): Promise<ServiceRequest[]> {
  const data = await request<PaginatedResponse<ServiceRequest>>('/api/requests/', { token });
  return data.results;
}

export async function createRequest(
  token: string,
  payload: { customer_account: string; request_type: string }
): Promise<ServiceRequest> {
  return request<ServiceRequest>('/api/requests/', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export async function cancelRequest(token: string, id: string): Promise<void> {
  return request<void>(`/api/requests/${id}/cancel/`, {
    method: 'POST',
    token,
  });
}
