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
}

/**
 * Cliente HTTP con autenticación automática
 */
export class ApiClient {
  /** In-flight GET requests — prevents duplicate simultaneous calls */
  private static _inflight = new Map<string, Promise<unknown>>();

  /**
   * Obtiene headers con autenticación.
   * Siempre intenta obtener un token fresco de Firebase (auto-renovado).
   */
  private static async getHeaders(requireAuth = true): Promise<HeadersInit> {
    if (!requireAuth) {
      return {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
    }

    // Intentar token fresco de Firebase (se auto-renueva si expira en <5 min)
    let token: string | null = null;
    if (auth.currentUser) {
      try {
        token = await auth.currentUser.getIdToken();
        // Actualizar el store con el token fresco
        authStore.refreshToken && void auth.currentUser.getIdToken(false);
      } catch {
        // Fallo al obtener token de Firebase, caer a store
      }
    }

    // Fallback: token del store (puede estar en cache)
    if (!token) {
      token = get(authStore).token;
    }

    // Último recurso: forzar refresh
    if (!token) {
      token = await authStore.refreshToken();
    }

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
   * GET request with in-flight deduplication
   */
  static async get<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const requestUrl = resolveUrl(endpoint);

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
          if (import.meta.env.DEV) {
            const errorText = await response.text();
            console.error(`[API] Error response:`, errorText);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json() as Promise<T>;
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

    return response.json();
  }
}
