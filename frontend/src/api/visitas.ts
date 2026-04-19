import type {
  ReconocimientoResponse,
  IntervencionCommonData,
} from '../types/visitas';
import type { GrupoKey } from '../lib/grupos';

// ── Types ──

export interface ReporteIntervencion {
  id: string;
  registrado_por: string | null;
  grupo: string | null;
  observaciones: string;
  coordinates: {
    type: string;
    coordinates: string;
  };
  tipo_intervencion: string;
  id_actividad: string | null;
  descripcion_intervencion: string | null;
  timestamp: string;
  photos_uploaded: number;
  photosUrl: string[];
  barrio_vereda: string;
  comuna_corregimiento: string;
  tipo_arbol?: string | null;
  numero_individuos_intervenidos?: number | null;
  tipos_plantas?: Record<string, number> | null;
  cantidad_total_plantas?: number | null;
  unidades_impactadas?: number | null;
  unidad_medida?: string | null;
  direccion?: string | null;
  coordinates_data?: [number, number];
  fecha_registro?: string;
  comuna?: string;
  barrio?: string;
}

export interface ReportesIntervencionResponse {
  success: boolean;
  total: number;
  data: ReporteIntervencion[];
}

// ── Helpers ──

function buildApiUrl(path: string): string {
  return import.meta.env.DEV
    ? `/api${path}`
    : `${import.meta.env.VITE_API_URL}${path}`;
}

function appendCommonFields(formData: FormData, data: IntervencionCommonData): void {
  formData.append('tipo_intervencion', data.tipo_intervencion);
  formData.append('descripcion_intervencion', data.descripcion_intervencion);
  formData.append('registrado_por', data.registrado_por || '');
  formData.append('grupo', data.grupo || '');
  formData.append('id_actividad', data.id_actividad || '');
  formData.append('observaciones', data.observaciones || '');
  formData.append('coordinates_type', data.coordinates_type || 'Point');
  formData.append('coordinates_data', data.coordinates_data);
}

function appendPhotos(formData: FormData, photoFiles: File[]): void {
  photoFiles.forEach((file) => {
    formData.append('photos[]', file);
  });
}

function parseErrorResponse(errorData: any, status: number, statusText: string): string {
  if (errorData.detail) {
    if (typeof errorData.detail === 'string') return errorData.detail;
    if (Array.isArray(errorData.detail)) {
      return errorData.detail.map((err: any) => `${err.loc?.join('.')} - ${err.msg}`).join(', ');
    }
    return JSON.stringify(errorData.detail);
  }
  return errorData.message || errorData.error || `Error ${status}: ${statusText}`;
}

function normalizeReporte(reporte: ReporteIntervencion): ReporteIntervencion {
  let coordinates_data: [number, number] = [-76.532, 3.4516];
  if (reporte.coordinates?.coordinates) {
    const val = reporte.coordinates.coordinates;
    if (Array.isArray(val) && val.length === 2) {
      coordinates_data = [Number(val[0]), Number(val[1])];
    } else if (typeof val === 'string') {
      const parts = val.split(' ');
      if (parts.length === 2) {
        coordinates_data = [parseFloat(parts[0]), parseFloat(parts[1])];
      }
    }
  }
  return {
    ...reporte,
    coordinates_data,
    fecha_registro: reporte.timestamp,
    comuna: reporte.comuna_corregimiento,
    barrio: reporte.barrio_vereda,
  };
}

// ── POST: Registrar intervención (unificado) ──

export interface RegistrarIntervencionParams {
  common: IntervencionCommonData;
  direccion?: string;
  // Cuadrilla
  arboles_data?: string;
  // Vivero
  tipos_plantas?: string;
  // Gobernanza / UMATA
  unidades_impactadas?: number;
  // Ecosistemas
  unidad_medida?: string;
}

export async function registrarIntervencion(
  grupoKey: GrupoKey,
  params: RegistrarIntervencionParams,
  photoFiles: File[] = []
): Promise<ReconocimientoResponse> {
  if (!params.common.tipo_intervencion) throw new Error('El tipo de intervención es requerido');
  if (!params.common.descripcion_intervencion) throw new Error('La descripción es requerida');
  if (!params.common.coordinates_data) throw new Error('Las coordenadas GPS son requeridas');
  if (!photoFiles.length) throw new Error('Debe incluir al menos una foto');

  const formData = new FormData();
  appendCommonFields(formData, params.common);

  if (params.direccion) formData.append('direccion', params.direccion);

  // Campos específicos por grupo
  if (params.arboles_data) formData.append('arboles_data', params.arboles_data);
  if (params.tipos_plantas) formData.append('tipos_plantas', params.tipos_plantas);
  if (params.unidades_impactadas != null) formData.append('unidades_impactadas', params.unidades_impactadas.toString());
  if (params.unidad_medida) formData.append('unidad_medida', params.unidad_medida);

  appendPhotos(formData, photoFiles);

  const url = buildApiUrl(`/grupos/${grupoKey}/reporte_intervencion`);
  const token = localStorage.getItem('auth_token');

  const response = await fetch(url, {
    method: 'POST',
    headers: { ...(token && { 'Authorization': `Bearer ${token}` }) },
    body: formData,
  });

  if (!response.ok) {
    let errorData: any = {};
    try { errorData = await response.json(); } catch {
      const text = await response.text().catch(() => '');
      throw new Error(`Error ${response.status}: ${response.statusText} - ${text}`);
    }
    throw new Error(parseErrorResponse(errorData, response.status, response.statusText));
  }

  const result: ReconocimientoResponse = await response.json();
  if (!result.success) throw new Error(result.message || 'Error al registrar intervención');
  return result;
}

// ── GET: Obtener reportes de intervención (unificado) ──

export async function obtenerReportes(
  grupoKey: GrupoKey,
  filters?: { id?: string; id_actividad?: string; grupo?: string }
): Promise<ReportesIntervencionResponse> {
  let url = buildApiUrl(`/grupos/${grupoKey}/reportes_intervenciones`);
  const params = new URLSearchParams();
  if (filters?.id) params.append('id', filters.id);
  if (filters?.id_actividad) params.append('id_actividad', filters.id_actividad);
  if (filters?.grupo) params.append('grupo', filters.grupo);
  const qs = params.toString();
  if (qs) url += `?${qs}`;

  const token = localStorage.getItem('auth_token');

  const response = await fetch(url, {
    method: 'GET',
    headers: { ...(token && { 'Authorization': `Bearer ${token}` }) },
  });

  if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);

  const responseData = await response.json();
  const normalizedData = (responseData.data || []).map(normalizeReporte);
  return { ...responseData, data: normalizedData };
}
