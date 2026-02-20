// API para actividades del Plan Distrito Verde
import { ApiClient } from '../lib/api-client';
import type {
  ActividadPlanDistritoVerde,
  ActividadesAPIResponse,
  ConvocarActividadRequest,
  ConvocarActividadResponse,
} from '../types/actividades';

const ACTIVIDADES_API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://web-production-2d737.up.railway.app';
const LIDERES_GRUPO_URL =
  'https://web-production-2d737.up.railway.app/lideres_grupo';

export interface LiderGrupoOption {
  nombre: string;
  grupo: string;
}

export interface EliminarActividadResponse {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

export interface ModificarActividadResponse {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

/**
 * Obtiene todas las actividades del Plan Distrito Verde
 * Retorna ordenadas de la más reciente a la más antigua según marca_temporal
 */
export async function getActividadesPlanDistritoVerde(): Promise<ActividadPlanDistritoVerde[]> {
  try {
    const response = await ApiClient.get<ActividadesAPIResponse>('/actividades_plan_distrito_verde');
    
    // La API devuelve { success, total, data }
    if (response.success && response.data) {
      // Ordenar por marca_temporal de forma descendente (más reciente primero)
      const actividades = response.data;
      return actividades.sort((a, b) => {
        const fechaA = a.marca_temporal ? new Date(a.marca_temporal).getTime() : 0;
        const fechaB = b.marca_temporal ? new Date(b.marca_temporal).getTime() : 0;
        return fechaB - fechaA; // Descendente (más reciente primero)
      });
    }
    
    return [];
  } catch (error) {
    console.error('Error al obtener actividades:', error);
    throw error;
  }
}

/**
 * Genera URL de Google Maps con las coordenadas del punto de encuentro
 */
export function getGoogleMapsUrl(geometry: { coordinates: [number, number] }): string {
  const [longitude, latitude] = geometry.coordinates;
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/**
 * Obtiene catálogo de líderes de grupo
 */
export async function getLideresGrupo(): Promise<LiderGrupoOption[]> {
  try {
    const httpResponse = await fetch(LIDERES_GRUPO_URL, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });

    if (!httpResponse.ok) {
      throw new Error(`HTTP ${httpResponse.status}: ${httpResponse.statusText}`);
    }

    const response = await httpResponse.json();

    const rows = Array.isArray(response)
      ? response
      : Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.lideres)
      ? response.lideres
      : [];

    const parsed = rows
      .map((item: any): LiderGrupoOption | null => {
        if (typeof item === 'string') {
          const nombre = item.trim();
          return nombre ? { nombre, grupo: 'Sin grupo' } : null;
        }
        if (item && typeof item === 'object') {
          const nombre = (
            item.lider_grupo ||
            item.nombre_completo ||
            item.full_name ||
            item.nombre ||
            item.name ||
            item.lider ||
            ''
          )
            .toString()
            .trim();

          const grupo = (item.grupo || item.group || 'Sin grupo')
            .toString()
            .trim();

          return nombre ? { nombre, grupo: grupo || 'Sin grupo' } : null;
        }
        return null;
      })
      .filter((item): item is LiderGrupoOption => !!item);

    const unique = new Map<string, LiderGrupoOption>();
    parsed.forEach((item) => {
      const key = `${item.nombre}::${item.grupo}`.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, item);
      }
    });

    return [...unique.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es'),
    );
  } catch (error) {
    console.error('Error al obtener líderes de grupo:', error);
    return [];
  }
}

/**
 * Convoca una nueva actividad
 */
export async function convocarActividad(
  payload: ConvocarActividadRequest,
): Promise<ConvocarActividadResponse> {
  try {
    return await ApiClient.post<ConvocarActividadResponse>(
      `${ACTIVIDADES_API_BASE_URL}/programar_actividad`,
      payload,
      { requireAuth: false },
    );
  } catch (error) {
    console.error('Error al convocar actividad:', error);
    throw error;
  }
}

/**
 * Elimina una actividad del Plan Distrito Verde por id
 */
export async function eliminarActividadPlanDistritoVerde(
  id: string,
): Promise<EliminarActividadResponse> {
  try {
    return await ApiClient.delete<EliminarActividadResponse>(
      `${ACTIVIDADES_API_BASE_URL}/plan_distrito_verde/${encodeURIComponent(id)}`,
      { requireAuth: false },
    );
  } catch (error) {
    console.error('Error al eliminar actividad:', error);
    throw error;
  }
}

/**
 * Modifica una actividad del Plan Distrito Verde por id
 */
export async function modificarActividadPlanDistritoVerde(
  id: string,
  payload: Record<string, unknown>,
): Promise<ModificarActividadResponse> {
  try {
    return await ApiClient.put<ModificarActividadResponse>(
      `${ACTIVIDADES_API_BASE_URL}/plan_distrito_verde/${encodeURIComponent(id)}`,
      payload,
      { requireAuth: false },
    );
  } catch (error) {
    console.error('Error al modificar actividad:', error);
    throw error;
  }
}
