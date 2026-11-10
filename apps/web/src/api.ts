import type { PosProduct } from './offline';

const configuredApi = typeof import.meta.env.VITE_API_URL === 'string' ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : '';
const apiBase = configuredApi ? (configuredApi.endsWith('/api') ? configuredApi : `${configuredApi}/api`) : '/api';

export function getToken(): string | null {
  const token = sessionStorage.getItem('pos-access-token');
  const expiresAt = Number(sessionStorage.getItem('pos-session-expires') ?? 0);
  if (!token || (expiresAt > 0 && expiresAt <= Date.now())) {
    sessionStorage.removeItem('pos-access-token');
    sessionStorage.removeItem('pos-session-expires');
    return null;
  }
  return token;
}

export function setToken(token: string): void {
  sessionStorage.setItem('pos-access-token', token);
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { exp?: number };
    if (payload.exp) sessionStorage.setItem('pos-session-expires', String(payload.exp * 1000));
  } catch {
    sessionStorage.removeItem('pos-session-expires');
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const raw = await response.text();
    let message: string | undefined;
    try {
      const error = JSON.parse(raw) as { message?: string | string[] };
      message = Array.isArray(error.message) ? error.message.join(', ') : error.message;
    } catch { /* The API may return a non-JSON proxy error. */ }
    throw new Error(message ?? `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export type SessionUser = { id: string; tenantId: string; branchIds: string[]; permissions: string[] };

export function getSessionUser(): SessionUser | null {
  try { return JSON.parse(sessionStorage.getItem('pos-user') ?? 'null') as SessionUser | null; } catch { return null; }
}

export function clearSession(): void {
  sessionStorage.removeItem('pos-user');
  sessionStorage.removeItem('pos-access-token');
  sessionStorage.removeItem('pos-session-expires');
}

export async function login(email: string, password: string, tenantSlug: string): Promise<SessionUser> {
  const result = await apiRequest<{ accessToken: string; user: SessionUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, tenantSlug }),
  });
  setToken(result.accessToken);
  sessionStorage.setItem('pos-user', JSON.stringify(result.user));
  return result.user;
}

export async function fetchProducts(): Promise<PosProduct[]> {
  const result = await apiRequest<{ items: Array<PosProduct & { sellingPrice: string | number }> }>('/catalog/products?pageSize=100');
  return result.items.map((product) => ({ ...product, sellingPrice: Number(product.sellingPrice) }));
}

export async function syncSale(payload: Record<string, unknown>): Promise<unknown> {
  return apiRequest('/sales', { method: 'POST', body: JSON.stringify(payload) });
}

export async function paySale(saleId: string, amount: number, method = 'cash'): Promise<unknown> {
  return apiRequest('/payments', {
    method: 'POST',
    body: JSON.stringify({ saleId, amount, method, idempotencyKey: `payment-${saleId}` }),
  });
}
