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

  const token = sessionStorage.getItem('authToken') || localStorage.getItem('token');
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, {
    method: 'GET',
    headers,
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
  const response = await ApiClient.get<any>('/personal_operativo');

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
  const response = await ApiClient.get<any>('/personal_operativo');
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
  return ApiClient.post<CrearPersonalOperativoResponse>('/personal_operativo', persona);
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
  const body = { personal_asignado: personal };
  return ApiClient.put<ReemplazarPersonalResponse>(
    `/actividades/${encodeURIComponent(actividadId)}`,
    body,
  );
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
    const body = { personal_asignado: personalFinal };
    return ApiClient.put<AgregarPersonalResponse>(
      `/actividades/${encodeURIComponent(actividadId)}`,
      body,
    );
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

  const json: ActividadesAPIResponse = await ApiClient.get<ActividadesAPIResponse>(`/actividades?${params.toString()}`);
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

// ── Asistencia a Actividades ──────────────────────────────────────────────────

export type AlertaTipoValue =
  | 'accidente_laboral'
  | 'fuerza_mayor'
  | 'llamado_atencion'
  | 'abandono_sin_justificacion'
  | 'llegada_tarde'
  | 'retiro_voluntario'
  | 'otro';

export interface AlertaTipoOption {
  value: AlertaTipoValue;
  label: string;
}

export interface AsistenciaPersonaItem {
  nombre_completo: string;
  email: string;
  uid?: string | null;
  grupo?: string | null;
  /** true = asistió, false = ausente */
  validacion: boolean;
  observacion?: string | null;
  alerta?: AlertaTipoValue | null;
}

export interface AsistenciaMetricas {
  total_personal: number;
  asistentes: number;
  ausentes: number;
  asistencia_general: number;
}

export interface AsistenciaRecord {
  actividad_id: string;
  personal_asignado: AsistenciaPersonaItem[];
  total_personal: number;
  asistentes: number;
  ausentes: number;
  asistencia_general: number;
  marca_temporal: string;
  ultima_modificacion?: string;
  registrado_por: string;
}

export interface AsistenciaResponse {
  status: string;
  data: AsistenciaRecord;
  metricas: AsistenciaMetricas;
}

/** GET /alertas_tipos — catálogo de tipos de alerta predefinidos */
export async function getAlertasTipos(): Promise<AlertaTipoOption[]> {
  try {
    const result = await ApiClient.get<AlertaTipoOption[]>('/alertas_tipos', { requireAuth: false });
    return Array.isArray(result) ? result : [];
  } catch {
    // Fallback hardcoded si el endpoint no responde
    return [
      { value: 'accidente_laboral',        label: 'Accidente Laboral' },
      { value: 'fuerza_mayor',             label: 'Retiro por Fuerza Mayor' },
      { value: 'llamado_atencion',         label: 'Llamado de Atención' },
      { value: 'abandono_sin_justificacion', label: 'Abandono sin Justificación' },
      { value: 'llegada_tarde',            label: 'Llegada Tarde' },
      { value: 'retiro_voluntario',        label: 'Retiro Voluntario' },
      { value: 'otro',                     label: 'Otro' },
    ];
  }
}

/**
 * GET /asistencia_actividades?actividad_id=xxx
 * Retorna null si no existe registro aún (404).
 */
export async function getAsistenciaActividad(actividadId: string): Promise<AsistenciaResponse | null> {
  try {
    const result = await ApiClient.get<AsistenciaResponse>(
      `/asistencia_actividades?actividad_id=${encodeURIComponent(actividadId)}&_t=${Date.now()}`,
    );
    return result;
  } catch (err: any) {
    if (err?.status === 404 || err?.message?.includes('404')) return null;
    throw err;
  }
}

/**
 * POST /asistencia_actividades — crea o sobreescribe el registro de asistencia.
 */
export async function registrarAsistencia(
  actividadId: string,
  personal: AsistenciaPersonaItem[],
): Promise<AsistenciaResponse> {
  return ApiClient.post<AsistenciaResponse>('/asistencia_actividades', {
    actividad_id: actividadId,
    personal_asignado: personal,
  });
}

/**
 * PATCH /asistencia_actividades/{actividad_id} — actualiza parcialmente uno o varios integrantes.
 */
export async function actualizarAsistenciaItems(
  actividadId: string,
  personal: Array<{ email: string; validacion?: boolean; observacion?: string | null; alerta?: AlertaTipoValue | null }>,
): Promise<AsistenciaResponse> {
  return ApiClient.patch<AsistenciaResponse>(
    `/asistencia_actividades/${encodeURIComponent(actividadId)}`,
    { personal },
  );
}

export interface AsistenciaPersonaResumen {
  nombre_completo: string;
  grupo: string | null;
  validacion: boolean | null;
  observacion: string | null;
  alerta: AlertaTipoValue | null;
}

export interface AsistenciaResumenItem {
  actividad_id: string;
  fecha_registro: string | null;
  total_personal: number;
  asistentes: number;
  ausentes: number;
  alertas: number;
  asistencia_general: number;
  grupos_participantes: string[];
  personal_asignado: AsistenciaPersonaResumen[];
  // Activity info from plan_distrito_verde
  fecha_actividad: string | null;
  hora_encuentro: string | null;
  tipo_jornada: string | null;
  objetivo_actividad: string | null;
  estado_actividad: string | null;
  direccion: string | null;
  comunas_corregimiento: string | null;
  barrio_vereda: string | null;
}

export interface AsistenciasResumenResponse {
  status: string;
  total: number;
  data: AsistenciaResumenItem[];
  timestamp: string;
}

/** GET /asistencias_resumen — lista todos los registros de asistencia, opcionalmente por grupo */
export async function getAsistenciasResumen(grupo?: string): Promise<AsistenciaResumenItem[]> {
  const params = grupo ? `?grupo=${encodeURIComponent(grupo)}` : '';
  try {
    const res = await ApiClient.get<AsistenciasResumenResponse>(`/asistencias_resumen${params}`);
    return res.data ?? [];
  } catch {
    return [];
  }
}
