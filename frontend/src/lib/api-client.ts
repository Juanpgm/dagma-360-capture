// Utilidad para hacer peticiones autenticadas a la API
import { authStore } from '../stores/authStore';
import { get } from 'svelte/store';

// En desarrollo: usa el proxy /api -> https://railway.app
// En producción: usa la URL completa de VITE_API_URL
const API_BASE_URL = import.meta.env.DEV 
  ? '/api'
  : (import.meta.env.VITE_API_URL || 'https://web-production-2d737.up.railway.app');

function resolveUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  return `${API_BASE_URL}${endpoint}`;
}

interface ApiRequestOptions {
  requireAuth?: boolean;
}

/**
 * Cliente HTTP con autenticación automática
 */
export class ApiClient {
  /**
   * Obtiene headers con autenticación
   */
  private static async getHeaders(requireAuth = true): Promise<HeadersInit> {
    const state = get(authStore);

    if (!requireAuth) {
      return {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
    }
    
    if (!state.token) {
      // Intentar refrescar token
      const newToken = await authStore.refreshToken();
      if (!newToken) {
        throw new Error('No authentication token available');
      }
      return {
        'Authorization': `Bearer ${newToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
    }

    return {
      'Authorization': `Bearer ${state.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * GET request
   */
  static async get<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    try {
      const headers = await this.getHeaders(options.requireAuth ?? true);
      const requestUrl = resolveUrl(endpoint);
      console.log(`[API] GET ${requestUrl}`);
      
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers
      });

      console.log(`[API] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[API] Error response:`, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[API] Response data:`, data);
      return data;
    } catch (error) {
      console.error(`[API] Request failed:`, error);
      throw error;
    }
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
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * DELETE request
   */
  static async delete<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const headers = await this.getHeaders(options.requireAuth ?? true);
    const requestUrl = resolveUrl(endpoint);
    const response = await fetch(requestUrl, {
      method: 'DELETE',
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
}
