import type { ReconocimientoResponse } from '../types/visitas';
import type { GrupoKey } from '../lib/grupos';
import { ApiClient } from '../lib/api-client';
import { authStore } from '../stores/authStore';
import { get } from 'svelte/store';
import { auth } from '../lib/firebase';

// ── Types ──

export interface ReporteIntervencion {
  id: string;
  registrado_por: string | null;
  grupo: string | null;
  observaciones: string;
  coordinates?: {
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
  documentos_con_enlaces?: Array<{
    filename?: string;
    s3_key?: string;
    s3_url?: string;
    content_type?: string;
    size?: number;
    url_visualizar?: string;   // presigned inline — use for display
    url_presigned?: string;    // alias of url_visualizar
    url_descarga?: string;     // presigned attachment
    url_expiration_seconds?: number;
  }>;
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

// ── Pagination types (new unified endpoint) ──

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ObtenerReportesAllFilters {
  grupo?: string;
  id_actividad?: string;
  page?: number;
  per_page?: number;
  slim?: boolean;
}

export interface PaginatedReportesAllResponse {
  data: ReporteIntervencion[];
  pagination: PaginationMeta;
  totals: Record<string, number>;
  total_general: number;
}

// ── Helpers ──

// Permite alternar entre proxy local o API externa
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
function buildApiUrl(path: string): string {
  if (API_BASE.endsWith('/') && path.startsWith('/')) {
    return API_BASE + path.slice(1);
  }
  return API_BASE + path;
}

// MIME types accepted by the backend
const BACKEND_ALLOWED_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic',
]);

// Extensions that the browser cannot decode in a canvas (pass through as-is)
const PASSTHROUGH_EXT = /\.(heic|heif|avif|dng|raw|cr2|nef)$/i;

/** Convert any image File to JPEG via Canvas (for formats the backend rejects, e.g. AVIF).
 *  Falls back to the original file if conversion fails or takes too long (5s timeout).
 */
function convertToJpeg(file: File): Promise<File> {
  // If the file extension suggests an undecoded format, skip canvas conversion
  if (PASSTHROUGH_EXT.test(file.name)) return Promise.resolve(file);

  return new Promise((resolve) => {
    let settled = false;
    const done = (result: File) => {
      if (!settled) { settled = true; resolve(result); }
    };

    // Safety timeout: if canvas never fires onload/onerror, resolve after 5s
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      done(file);
    }, 5000);

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          const jpegName = file.name.replace(/\.[^.]+$/, '.jpg');
          done(blob ? new File([blob], jpegName, { type: 'image/jpeg' }) : file);
        }, 'image/jpeg', 0.92);
      } catch {
        URL.revokeObjectURL(url);
        done(file);
      }
    };
    img.onerror = () => { clearTimeout(timeout); URL.revokeObjectURL(url); done(file); };
    img.src = url;
  });
}

async function appendPhotos(formData: FormData, photoFiles: File[]): Promise<void> {
  // Defensive filter: drop any entry that is not a valid non-empty File so the backend
  // never receives an empty/undefined value for the `photos` field.
  const validFiles = photoFiles.filter((f) => f instanceof File && f.size > 0);

  // Convert unsupported formats (e.g. AVIF) to JPEG before sending.
  const normalizedFiles = await Promise.all(
    validFiles.map((f) => BACKEND_ALLOWED_MIME.has(f.type) ? Promise.resolve(f) : convertToJpeg(f))
  );

  // Workaround: FastAPI + Pydantic v2 bug — a single UploadFile is NOT automatically
  // coerced to List[UploadFile]. python-multipart only returns a list when the key
  // appears ≥2 times in the multipart body.  Sending the first file twice when there
  // is only one photo ensures the field is always parsed as a list (never None).
  const files = normalizedFiles.length === 1 ? [normalizedFiles[0], normalizedFiles[0]] : normalizedFiles;
  files.forEach((file, idx) => {
    formData.append('photos', file, file.name || `photo_${idx}.jpg`);
  });
}

function parseErrorResponse(errorData: any, status: number, statusText: string): string {
  if (errorData.detail) {
    if (typeof errorData.detail === 'string') {
      // Backend Python error: len(None) means a required field arrived as null.
      // Surface a friendlier message so the user knows what to check.
      if (errorData.detail.includes("NoneType") || errorData.detail.includes("has no len")) {
        return 'Error del servidor: un campo requerido llegó vacío. Verifique que las fotos y todos los campos estén completos.';
      }
      return errorData.detail;
    }
    if (Array.isArray(errorData.detail)) {
      return errorData.detail.map((err: any) => `${err.loc?.join('.')} - ${err.msg}`).join(', ');
    }
    return JSON.stringify(errorData.detail);
  }
  return errorData.message || errorData.error || `Error ${status}: ${statusText}`;
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;

function normalizeReporte(reporte: ReporteIntervencion): ReporteIntervencion {
  // ── Coordinates ──
  let coordinates_data: [number, number] = [-76.532, 3.4516];
  // `coordinates` is absent when slim=true — guard before accessing
  if (reporte.coordinates?.coordinates) {
    const val = reporte.coordinates.coordinates as unknown;
    if (Array.isArray(val) && val.length === 2) {
      coordinates_data = [Number(val[0]), Number(val[1])];
    } else if (typeof val === 'string') {
      const parts = val.split(' ');
      if (parts.length === 2) {
        coordinates_data = [parseFloat(parts[0]), parseFloat(parts[1])];
      }
    }
  }

  // ── Photo URLs ──
  // `photosUrl` contains raw S3 URLs (unsigned, returns 403).
  // `documentos_con_enlaces[].url_visualizar` contains valid presigned URLs.
  // When documentos_con_enlaces is available, use it as the photo source.
  let photosUrl = reporte.photosUrl ?? [];
  if (Array.isArray(reporte.documentos_con_enlaces) && reporte.documentos_con_enlaces.length > 0) {
    const presigned = reporte.documentos_con_enlaces
      .filter((d) => !d.filename || IMAGE_EXT.test(d.filename))
      .map((d) => d.url_visualizar || d.url_presigned || '')
      .filter((url) => url.length > 0);
    if (presigned.length > 0) {
      photosUrl = presigned;
    }
  }

  return {
    ...reporte,
    photosUrl,
    coordinates_data,
    fecha_registro: reporte.timestamp,
    comuna: reporte.comuna_corregimiento,
    barrio: reporte.barrio_vereda,
  };
}

// ── POST: params flat (matches multipart body 1:1) ──

export interface RegistrarIntervencionParams {
  // Common fields
  tipo_intervencion: string;
  descripcion_intervencion: string;
  direccion?: string;
  registrado_por?: string;
  grupo?: string;
  id_actividad?: string;
  observaciones?: string;
  coordinates_type?: string;
  coordinates_data?: string;
  // Group-specific (all optional — backend ignores irrelevant ones)
  arboles_data?: string;        // [cuadrilla]              JSON array '[{"especie":"Ceiba","cantidad":5}]'
  tipos_plantas?: string;       // [vivero]                 JSON dict  '{"Guayacán":10}'
  unidades_impactadas?: number; // [gobernanza,umata,ecosistemas]
  unidad_medida?: string;       // [ecosistemas]
}

export async function registrarIntervencion(
  grupoKey: GrupoKey,
  params: RegistrarIntervencionParams,
  photoFiles: File[] = []
): Promise<ReconocimientoResponse> {
  if (!params.tipo_intervencion) throw new Error('El tipo de intervención es requerido');
  if (!params.descripcion_intervencion) throw new Error('La descripción es requerida');
  if (!params.coordinates_data) throw new Error('Las coordenadas GPS son requeridas');
  // Filter to valid files before the count check so we don't mislead the user
  const validPhotoFiles = photoFiles.filter((f) => f instanceof File && f.size > 0);
  if (!validPhotoFiles.length) throw new Error('Debe incluir al menos una foto válida');

  const formData = new FormData();

  // Common fields
  formData.append('tipo_intervencion', params.tipo_intervencion);
  formData.append('descripcion_intervencion', params.descripcion_intervencion);
  if (params.direccion) formData.append('direccion', params.direccion);
  if (params.registrado_por) formData.append('registrado_por', params.registrado_por);
  if (params.grupo) formData.append('grupo', params.grupo);
  if (params.id_actividad) formData.append('id_actividad', params.id_actividad);
  if (params.observaciones) formData.append('observaciones', params.observaciones);
  formData.append('coordinates_type', params.coordinates_type ?? 'Point');
  formData.append('coordinates_data', params.coordinates_data);

  // Group-specific fields
  if (params.arboles_data) formData.append('arboles_data', params.arboles_data);
  if (params.tipos_plantas) formData.append('tipos_plantas', params.tipos_plantas);
  if (params.unidades_impactadas != null) formData.append('unidades_impactadas', String(params.unidades_impactadas));
  if (params.unidad_medida) formData.append('unidad_medida', params.unidad_medida);

  await appendPhotos(formData, validPhotoFiles);

  const url = buildApiUrl(`/grupos/${grupoKey}/reporte_intervencion`);

  // Obtener token fresco de Firebase (se auto-renueva si está próximo a expirar)
  let token: string | null = null;
  if (auth.currentUser) {
    try { token = await auth.currentUser.getIdToken(); } catch { /* ignore */ }
  }
  if (!token) token = get(authStore).token;
  if (!token) token = localStorage.getItem('token') || sessionStorage.getItem('authToken');
  if (!token) token = await authStore.refreshToken();

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

  // Usa ApiClient centralizado para autenticación y manejo de errores
  const raw = await ApiClient.get<any>(url, { requireAuth: true });

  // Defensive: backend returns { success, total, data } or variations — normalise.
  let dataArray: ReporteIntervencion[] = [];
  if (Array.isArray(raw)) {
    dataArray = raw;
  } else if (Array.isArray(raw?.data)) {
    dataArray = raw.data;
  }

  const normalizedData = dataArray.map(normalizeReporte);
  const responseData: ReportesIntervencionResponse = {
    success: raw?.success ?? true,
    total: raw?.total ?? normalizedData.length,
    data: normalizedData,
  };
  return responseData;
}

// ── GET: Todos los reportes de intervención (endpoint unificado) ──

export async function obtenerReportesAll(
  filters?: ObtenerReportesAllFilters
): Promise<PaginatedReportesAllResponse> {
  let url = buildApiUrl('/reportes_intervenciones');
  const params = new URLSearchParams();
  if (filters?.grupo) params.append('grupo', filters.grupo);
  if (filters?.id_actividad) params.append('id_actividad', filters.id_actividad);
  if (filters?.page != null) params.append('page', String(filters.page));
  if (filters?.per_page != null) params.append('per_page', String(filters.per_page));
  if (filters?.slim != null) params.append('slim', String(filters.slim));
  const qs = params.toString();
  if (qs) url += `?${qs}`;

  const res = await ApiClient.get<any>(url, { requireAuth: true });

  // Backend now returns a flat array sorted by timestamp desc
  const rawData: ReporteIntervencion[] = Array.isArray(res?.data) ? res.data : [];
  const normalized = rawData.map((item) => normalizeReporte(item));

  const pagination: PaginationMeta = res?.pagination ?? {
    page: 1,
    per_page: normalized.length,
    total: normalized.length,
    total_pages: 1,
    has_next: false,
    has_prev: false,
  };

  return {
    data: normalized,
    pagination,
    totals: res?.totals ?? {},
    total_general: res?.total_general ?? normalized.length,
  };
}
