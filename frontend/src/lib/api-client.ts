// Utilidad para hacer peticiones autenticadas a la API
import { authStore } from '../stores/authStore';
import { get } from 'svelte/store';
import { auth } from './firebase';


// Permite alternar entre proxy local o API externa
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

function resolveUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  if (API_BASE_URL.endsWith('/') && endpoint.startsWith('/')) {
    return API_BASE_URL + endpoint.slice(1);
  }
  return API_BASE_URL + endpoint;
}

/** Emits a browser event so any toast/notification component can display a permissions error */
function notifyForbidden() {
  window.dispatchEvent(new CustomEvent('api:forbidden', {
    detail: { message: 'No tienes permisos para realizar esta acción' }
  }));
}

interface ApiRequestOptions {
  requireAuth?: boolean;
  /** Time-to-live for caching this GET response, in ms. 0 / undefined = no cache, dedup only. */
  cacheMs?: number;
}

interface CacheEntry {
  expires: number;
  value: unknown;
}

/**
 * Cliente HTTP con autenticación automática
 */
export class ApiClient {
  /** In-flight GET requests — prevents duplicate simultaneous calls */
  private static _inflight = new Map<string, Promise<unknown>>();
  /** Optional response cache, opt-in per call via `cacheMs`. */
  private static _cache = new Map<string, CacheEntry>();

  /** Cached Firebase ID token + expiry (epoch ms). */
  private static _cachedToken: string | null = null;
  private static _cachedTokenExp = 0;
  /** Refresh el token cuando le quedan <= 60s. */
  private static readonly _TOKEN_SKEW_MS = 60_000;

  /** Invalida entradas de cache cuyo URL incluya el `prefix`. Llamar tras mutaciones. */
  static invalidate(prefix: string): void {
    const fullPrefix = resolveUrl(prefix);
    for (const key of ApiClient._cache.keys()) {
      if (key.startsWith(fullPrefix)) ApiClient._cache.delete(key);
    }
  }

  /** Limpia la cache completa (útil tras logout). */
  static clearCache(): void {
    ApiClient._cache.clear();
    ApiClient._cachedToken = null;
    ApiClient._cachedTokenExp = 0;
  }

  private static _decodeJwtExpMs(token: string): number {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return 0;
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
      const payload = JSON.parse(atob(padded));
      return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
    } catch {
      return 0;
    }
  }

  /** Devuelve un token válido, reutilizándolo hasta ~60s antes de expirar. */
  private static async _getValidToken(): Promise<string | null> {
    const now = Date.now();
    if (
      ApiClient._cachedToken &&
      ApiClient._cachedTokenExp - ApiClient._TOKEN_SKEW_MS > now
    ) {
      return ApiClient._cachedToken;
    }
    let token: string | null = null;
    if (auth.currentUser) {
      try {
        token = await auth.currentUser.getIdToken();
      } catch {
        // fallback abajo
      }
    }
    if (!token) {
      token = get(authStore).token;
    }
    if (!token) {
      token = await authStore.refreshToken();
    }
    if (token) {
      ApiClient._cachedToken = token;
      ApiClient._cachedTokenExp = ApiClient._decodeJwtExpMs(token) || (now + 55 * 60_000);
    }
    return token;
  }

  /**
   * Obtiene headers con autenticación.
   * Reutiliza el ID token de Firebase cacheado hasta su expiración (ver `_getValidToken`).
   */
  private static async getHeaders(requireAuth = true): Promise<HeadersInit> {
    if (!requireAuth) {
      return {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
    }

    const token = await ApiClient._getValidToken();

    if (!token) {
      throw new Error('No authentication token available');
    }

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * GET request with in-flight deduplication and opt-in TTL caching.
   */
  static async get<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const requestUrl = resolveUrl(endpoint);
    const cacheMs = options.cacheMs ?? 0;

    // Cache TTL hit (solo si cacheMs > 0)
    if (cacheMs > 0) {
      const cached = ApiClient._cache.get(requestUrl);
      if (cached && cached.expires > Date.now()) {
        return cached.value as T;
      }
    }

    // Reuse an in-flight request for the same URL to avoid duplicate network calls
    const existing = ApiClient._inflight.get(requestUrl) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = (async () => {
      try {
        const headers = await this.getHeaders(options.requireAuth ?? true);
        if (import.meta.env.DEV) console.log(`[API] GET ${requestUrl}`);

        const response = await fetch(requestUrl, { method: 'GET', headers });

        if (!response.ok) {
          if (response.status === 403) notifyForbidden();
          // Token expirado: limpia cache para forzar refresh en la siguiente request
          if (response.status === 401) {
            ApiClient._cachedToken = null;
            ApiClient._cachedTokenExp = 0;
          }
          if (import.meta.env.DEV) {
            const errorText = await response.text();
            console.error(`[API] Error response:`, errorText);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const value = (await response.json()) as T;
        if (cacheMs > 0) {
          ApiClient._cache.set(requestUrl, { value, expires: Date.now() + cacheMs });
        }
        return value;
      } catch (error) {
        if (import.meta.env.DEV) console.error(`[API] Request failed:`, error);
        throw error;
      } finally {
        ApiClient._inflight.delete(requestUrl);
      }
    })();

    ApiClient._inflight.set(requestUrl, promise as Promise<unknown>);
    return promise;
  }

  /**
   * POST request
   */
  static async post<T = any>(endpoint: string, data: any, options: ApiRequestOptions = {}): Promise<T> {
    const headers = await this.getHeaders(options.requireAuth ?? true);
    const requestUrl = resolveUrl(endpoint);
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      if (response.status === 403) notifyForbidden();
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    ApiClient._invalidateForEndpoint(endpoint);
    return response.json();
  }

  /**
   * PATCH request
   */
  static async patch<T = any>(endpoint: string, data: any, options: ApiRequestOptions = {}): Promise<T> {
    const headers = await this.getHeaders(options.requireAuth ?? true);
    const requestUrl = resolveUrl(endpoint);
    const response = await fetch(requestUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      if (response.status === 403) notifyForbidden();
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    ApiClient._invalidateForEndpoint(endpoint);
    return response.json();
  }

  /**
   * PUT request
   */
  static async put<T = any>(endpoint: string, data: any, options: ApiRequestOptions = {}): Promise<T> {
    const headers = await this.getHeaders(options.requireAuth ?? true);
    const requestUrl = resolveUrl(endpoint);
    const response = await fetch(requestUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      if (response.status === 403) notifyForbidden();
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    ApiClient._invalidateForEndpoint(endpoint);
    return response.json();
  }

  /**
   * DELETE request
   */
  static async delete<T = any>(endpoint: string, options: ApiRequestOptions = {}, body?: any): Promise<T> {
    const headers = await this.getHeaders(options.requireAuth ?? true);
    const requestUrl = resolveUrl(endpoint);
    const fetchOptions: RequestInit = {
      method: 'DELETE',
      headers,
    };
    if (body !== undefined) {
      fetchOptions.body = JSON.stringify(body);
    }
    const response = await fetch(requestUrl, fetchOptions);

    if (!response.ok) {
      if (response.status === 403) notifyForbidden();
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    ApiClient._invalidateForEndpoint(endpoint);
    return response.json();
  }

  /** Heuristica: invalida cache para el recurso base de un endpoint de mutacion. */
  private static _invalidateForEndpoint(endpoint: string): void {
    // Quita query string
    const path = endpoint.split('?')[0];
    // Recorta el ultimo segmento si parece un ID (no contiene barras adicionales)
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return;
    // Invalida el recurso base y el path completo
    const base = '/' + segments[0];
    ApiClient.invalidate(base);
  }
}
