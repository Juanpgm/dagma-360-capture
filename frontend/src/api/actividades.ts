// API para actividades del Plan Distrito Verde
import { ApiClient } from '../lib/api-client';
import type {
  ActividadPlanDistritoVerde,
  ActividadesAPIResponse,
  ConvocarActividadRequest,
  ConvocarActividadResponse,
} from '../types/actividades';

const LIDERES_GRUPO_URL = '/api/personal_operativo';

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
 * Obtiene actividades del Plan Distrito Verde — sin caché.
 * Usa fetch directo con cache:'no-store' y cache-buster para evitar
 * cualquier caché (browser HTTP cache, Service Worker, ApiClient._inflight).
 */
export async function getActividadesPlanDistritoVerde(grupo?: string): Promise<ActividadPlanDistritoVerde[]> {
  const ts = Date.now();
  const params = new URLSearchParams({ _t: String(ts) });
  if (grupo) params.set('grupo', grupo);
  const url = `/api/actividades?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

  const json: ActividadesAPIResponse = await response.json();
  if (json.success && json.data) {
    return json.data.sort((a, b) => {
      const fechaA = a.marca_temporal ? new Date(a.marca_temporal).getTime() : 0;
      const fechaB = b.marca_temporal ? new Date(b.marca_temporal).getTime() : 0;
      return fechaB - fechaA;
    });
  }
  return [];
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
  const httpResponse = await fetch(LIDERES_GRUPO_URL, {
    method: 'GET',
    headers: { accept: 'application/json' },
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
    .filter((item: LiderGrupoOption | null): item is LiderGrupoOption => !!item);

  const unique = new Map<string, LiderGrupoOption>();
  parsed.forEach((item: LiderGrupoOption) => {
    const key = `${item.nombre}::${item.grupo}`.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, item);
    }
  });

  return [...unique.values()].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es'),
  );
}

/**
 * Convoca una nueva actividad
 */
export async function convocarActividad(
  payload: ConvocarActividadRequest,
): Promise<ConvocarActividadResponse> {
  try {
    return await ApiClient.post<ConvocarActividadResponse>(
      '/programar_actividad',
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
      `/actividades/${encodeURIComponent(id)}`,
      { requireAuth: false },
    );
  } catch (error) {
    console.error('Error al eliminar actividad:', error);
    throw error;
  }
}

/**
 * Obtiene catálogo de personal operativo
 */
export interface PersonalOperativoItem {
  id: string;
  nombre_completo: string;
  grupo: string;
  email: string;
  numero_contacto: string;
}

export async function getPersonalOperativo(): Promise<PersonalOperativoItem[]> {
  const httpResponse = await fetch(LIDERES_GRUPO_URL, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });

  if (!httpResponse.ok) {
    throw new Error(`HTTP ${httpResponse.status}: ${httpResponse.statusText}`);
  }

  const response = await httpResponse.json();
  const rows = Array.isArray(response)
    ? response
    : Array.isArray(response?.data)
    ? response.data
    : [];

  return rows
    .filter((item: any) => item && item.nombre_completo)
    .map((item: any): PersonalOperativoItem => ({
      id: item.id || '',
      nombre_completo: (item.nombre_completo || '').toString().trim(),
      grupo: (item.grupo || 'Sin grupo').toString().trim(),
      email: (item.email || '').toString().trim(),
      numero_contacto: (item.numero_contacto || '').toString().trim(),
    }));
}

/**
 * Crea un nuevo miembro de personal operativo via POST /personal_operativo.
 */
export interface CrearPersonalOperativoRequest {
  nombre_completo: string;
  email: string;
  numero_contacto: number;
  grupo: string;
}

export interface CrearPersonalOperativoResponse {
  status?: string;
  message?: string;
  data?: {
    id: string;
    nombre_completo: string;
    email: string;
    numero_contacto: number;
    grupo: string;
  };
  timestamp?: string;
}

export async function crearPersonalOperativo(
  persona: CrearPersonalOperativoRequest,
): Promise<CrearPersonalOperativoResponse> {
  try {
    const url = '/api/personal_operativo';
    console.log('[crearPersonalOperativo] POST', url, JSON.stringify(persona));
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(persona),
      cache: 'no-store',
    });
    const text = await response.text();
    console.log('[crearPersonalOperativo] Response:', response.status, text);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    return JSON.parse(text);
  } catch (error) {
    console.error('Error al crear personal operativo:', error);
    throw error;
  }
}

/**
 * Reemplaza el personal_asignado completo de una actividad via PUT /actividades/{id}.
 * Envía { personal_asignado: [...] } como body para sobreescribir en Firestore.
 */
export interface ReemplazarPersonalItem {
  nombre_completo: string;
  email: string;
  numero_contacto: number;
  grupo: string;
}

export interface ReemplazarPersonalResponse {
  success?: boolean;
  message?: string;
  id?: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

export async function reemplazarPersonalAsignado(
  actividadId: string,
  personal: ReemplazarPersonalItem[],
): Promise<ReemplazarPersonalResponse> {
  try {
    const url = `/api/actividades/${encodeURIComponent(actividadId)}`;
    const body = { personal_asignado: personal };
    console.log('[reemplazarPersonalAsignado] PUT', url, JSON.stringify(body));
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const text = await response.text();
    console.log('[reemplazarPersonalAsignado] Response:', response.status, text);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    return JSON.parse(text);
  } catch (error) {
    console.error('Error al reemplazar personal asignado:', error);
    throw error;
  }
}

/**
 * Agrega UN integrante al personal_asignado de una actividad.
 * Obtiene la lista actual via GET, agrega la persona, y envía el array completo
 * via PUT /actividades/{id}.
 */
export interface AgregarPersonalItem {
  nombre_completo: string;
  email: string;
  numero_contacto: number;
  grupo: string;
}

export interface AgregarPersonalResponse {
  success?: boolean;
  message?: string;
  id?: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

export async function agregarPersonalAsignado(
  actividadId: string,
  persona: AgregarPersonalItem,
): Promise<AgregarPersonalResponse> {
  try {
    // 1. GET current activity to read existing personal_asignado
    const actividad = await getActividadPorId(actividadId);
    const currentPersonal: ReemplazarPersonalItem[] = ((actividad?.personal_asignado || []) as any[])
      .filter((item: any) => item && item.nombre_completo)
      .map((item: any) => ({
        nombre_completo: item.nombre_completo,
        email: item.email || '',
        numero_contacto: parseInt(String(item.numero_contacto || item.telefono || '0').replace(/\D/g, '')) || 0,
        grupo: item.grupo || '',
      }));

    // 2. Append new person (avoid duplicates by email)
    const emailNuevo = persona.email.toLowerCase().trim();
    const yaExiste = currentPersonal.some(
      (p) => p.email.toLowerCase().trim() === emailNuevo,
    );
    const personalFinal = yaExiste ? currentPersonal : [...currentPersonal, persona];

    // 3. PUT via /actividades/{id}
    const url = `/api/actividades/${encodeURIComponent(actividadId)}`;
    const body = { personal_asignado: personalFinal };
    console.log('[agregarPersonalAsignado] PUT', url, JSON.stringify(body));
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const text = await response.text();
    console.log('[agregarPersonalAsignado] Response:', response.status, text);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    return JSON.parse(text);
  } catch (error) {
    console.error('Error al agregar personal asignado:', error);
    throw error;
  }
}

/**
 * Obtiene una actividad específica por su ID, sin caché.
 * Usa el parámetro ?id= del GET /actividades.
 */
export async function getActividadPorId(
  actividadId: string,
): Promise<ActividadPlanDistritoVerde | null> {
  const ts = Date.now();
  const params = new URLSearchParams({ id: actividadId, _t: String(ts) });
  const url = `/api/actividades?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

  const json: ActividadesAPIResponse = await response.json();
  if (json.success && json.data && json.data.length > 0) {
    return json.data[0];
  }
  return null;
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
      `/actividades/${encodeURIComponent(id)}`,
      payload,
      { requireAuth: false },
    );
  } catch (error) {
    console.error('Error al modificar actividad:', error);
    throw error;
  }
}
