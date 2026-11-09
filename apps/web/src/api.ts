import type { PosProduct } from './offline';

const apiBase = typeof import.meta.env.VITE_API_URL === 'string' ? import.meta.env.VITE_API_URL : '/api';

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
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<void> {
  const result = await apiRequest<{ accessToken: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(result.accessToken);
}

export async function fetchProducts(): Promise<PosProduct[]> {
  const result = await apiRequest<{ items: Array<PosProduct & { sellingPrice: string | number }> }>('/catalog/products?pageSize=100');
  return result.items.map((product) => ({ ...product, sellingPrice: Number(product.sellingPrice) }));
}

export async function syncSale(payload: Record<string, unknown>): Promise<unknown> {
  return apiRequest('/sales', { method: 'POST', body: JSON.stringify(payload) });
}
