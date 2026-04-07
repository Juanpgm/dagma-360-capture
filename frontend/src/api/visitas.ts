/**
 * Servicio API para el módulo de Verificación de Parques DAGMA
 */

import { ApiClient } from '../lib/api-client';
import type {
  Parque,
  ParquesResponse,
  ReportesResponse,
  ReconocimientoResponse,
  ReconocimientoParque,
  IntervencionViveroData,
  IntervencionGobernanzaData,
  IntervencionEcosistemasData,
  IntervencionUmataData,
} from '../types/visitas';

/**
 * Parsea una geometría WKT (Well-Known Text) a GeoJSON
 * Soporta: POINT, LINESTRING, POLYGON, MULTIPOINT, MULTILINESTRING, MULTIPOLYGON
 */
function parseWKTGeometry(wktString: string): Parque['geometry'] | null {
  if (!wktString || typeof wktString !== 'string') return null;

  // Normalizar: remover saltos de línea y espacios extras
  let wkt = wktString.trim().replace(/\s+/g, ' ').replace(/\n/g, ' ');

  console.log('🔍 Parsing WKT:', wkt.substring(0, 80) + '...');

  // POLYGON - Tipo más común en datos urbanos
  if (wkt.startsWith('POLYGON')) {
    try {
      const match = wkt.match(/POLYGON\s*\(\(([\d\s.,\-]+)\)\)/);
      if (match) {
        const coords = parseCoordinates(match[1]);
        if (coords.length >= 3) {
          console.log(`✓ POLYGON: ${coords.length} puntos`);
          return {
            type: 'Polygon',
            coordinates: [coords]
          };
        }
      }
    } catch (e) {
      console.error('❌ Error parsing POLYGON:', e);
    }
  }

  // MULTIPOLYGON - Múltiples polígonos
  if (wkt.startsWith('MULTIPOLYGON')) {
    try {
      const match = wkt.match(/MULTIPOLYGON\s*\(\(\((.*)\)\)\)/);
      if (match) {
        const polygonsStr = match[1];
        // Dividir por ),( para separar polígonos
        const polygons = polygonsStr.split('),(').map((poly, idx, arr) => {
          let clean = poly.replace(/^\(\(/, '').replace(/\)\)$/, '').replace(/^\(/, '').replace(/\)$/, '');
          return parseCoordinates(clean);
        }).filter(p => p.length >= 3);

        if (polygons.length > 0) {
          console.log(`✓ MULTIPOLYGON: ${polygons.length} polígonos`);
          return {
            type: 'MultiPolygon',
            coordinates: polygons
          };
        }
      }
    } catch (e) {
      console.error('❌ Error parsing MULTIPOLYGON:', e);
    }
  }

  // LINESTRING
  if (wkt.startsWith('LINESTRING')) {
    try {
      const match = wkt.match(/LINESTRING\s*\(([\d\s.,\-]+)\)/);
      if (match) {
        const coords = parseCoordinates(match[1]);
        if (coords.length >= 2) {
          console.log(`✓ LINESTRING: ${coords.length} puntos`);
          return {
            type: 'LineString',
            coordinates: coords
          };
        }
      }
    } catch (e) {
      console.error('❌ Error parsing LINESTRING:', e);
    }
  }

  // MULTILINESTRING
  if (wkt.startsWith('MULTILINESTRING')) {
    try {
      const match = wkt.match(/MULTILINESTRING\s*\((.*)\)$/);
      if (match) {
        const content = match[1];
        const lineStrings = content.split('),(').map((line) => {
          line = line.replace(/^\(/, '').replace(/\)$/, '');
          return parseCoordinates(line);
        }).filter(l => l.length >= 2);

        if (lineStrings.length > 0) {
          console.log(`✓ MULTILINESTRING: ${lineStrings.length} líneas`);
          return {
            type: 'MultiLineString',
            coordinates: lineStrings
          };
        }
      }
    } catch (e) {
      console.error('❌ Error parsing MULTILINESTRING:', e);
    }
  }

  // POINT
  if (wkt.startsWith('POINT')) {
    try {
      const match = wkt.match(/POINT\s*\(([\d\s.,\-]+)\)/);
      if (match) {
        const coords = parseCoordinates(match[1]);
        if (coords.length === 1) {
          console.log(`✓ POINT`);
          return {
            type: 'Point',
            coordinates: coords[0]
          };
        }
      }
    } catch (e) {
      console.error('❌ Error parsing POINT:', e);
    }
  }

  // MULTIPOINT
  if (wkt.startsWith('MULTIPOINT')) {
    try {
      const match = wkt.match(/MULTIPOINT\s*\(([\d\s.,\-()]+)\)/);
      if (match) {
        // Remover paréntesis internos si existen
        let coordStr = match[1].replace(/\(/g, '').replace(/\)/g, '');
        const coords = parseCoordinates(coordStr);
        if (coords.length >= 1) {
          console.log(`✓ MULTIPOINT: ${coords.length} puntos`);
          return {
            type: 'MultiPoint',
            coordinates: coords
          };
        }
      }
    } catch (e) {
      console.error('❌ Error parsing MULTIPOINT:', e);
    }
  }

  console.warn('⚠️  No se pudo parsear WKT:', wkt.substring(0, 60));
  return null;
}

/**
 * Parsea una cadena de coordenadas en formato WKT
 * Ejemplo: "-76.485, 3.483 -76.486, 3.484"
 */
function parseCoordinates(coordStr: string): [number, number][] {
  return coordStr
    .split(',')
    .map(pair => {
      const [lng, lat] = pair.trim().split(/\s+/);
      const lngNum = parseFloat(lng);
      const latNum = parseFloat(lat);
      return (!isNaN(lngNum) && !isNaN(latNum)) ? [lngNum, latNum] as [number, number] : null;
    })
    .filter((c): c is [number, number] => c !== null);
}

/**
 * Transforma un objeto de la API externa al formato Parque
 */
function transformToParque(data: any): Parque {
  const geometry = parseWKTGeometry(data.geometry);
  
  const parque: Parque = {
    nombre_up_detalle: data.proyecto_p || null,
    upid: data.id || data.mat_inmob_ || data.id_shp || '',
    _hash: data.id || '',
    updated_at: new Date().toISOString(),
    avance_obra: 0,
    barrio_vereda_2: data.Tramo || null,
    nombre_up: data.proyecto_p || data.mat_inmob_ || 'Sin nombre',
    has_geometry: !!geometry,
    lat: null,
    created_at: new Date().toISOString(),
    lon: null,
    nombre_centro_gestor: '',
    intervenciones: [],
    identificador: data.id_shp_p || data.id_shp || '',
    barrio_vereda: data.BARRIO || null,
    direccion: data.direccion_ || null,
    comuna_corregimiento_2: null,
    presupuesto_base: 0,
    n_intervenciones: 0,
    tipo_equipamiento: 'Parque',
    geometry: geometry,
    comuna_corregimiento: data.COMUNA || null,
    bpin: 0,
    clase_up: 'Parque'
  };
  
  if (geometry) {
    console.log(`✓ Transformado ${parque.nombre_up}: geometry type = ${geometry.type}`);
  } else {
    console.warn(`⚠ ${parque.nombre_up}: geometry no parseada`);
  }
  
  return parque;
}

/**
 * Obtiene el listado de Parques desde /init/parques del backend
 * Endpoint: GET /init/parques
 * Intenta con fetch directo (sin dependencia de ApiClient)
 */
export async function getParques(): Promise<Parque[]> {
  // En desarrollo: usa el proxy /api -> https://railway.app
  // En producción: usa la URL completa de VITE_API_URL
  const API_URL = import.meta.env.DEV 
    ? '/api/init/parques'
    : `${import.meta.env.VITE_API_URL}/init/parques`;
  
  try {
    console.log('🚀 Iniciando carga de parques desde:', API_URL);
    
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log('📬 Respuesta HTTP status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error HTTP:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📥 Estructura de respuesta:', {
      success: data.success,
      dataType: Array.isArray(data) ? 'array' : typeof data.data,
      dataLength: Array.isArray(data) ? data.length : data.data?.length
    });

    // Manejar diferentes estructuras de respuesta
    let parquesData: any[] = [];
    
    if (Array.isArray(data)) {
      // Si es un array directo
      parquesData = data;
    } else if (data.success && Array.isArray(data.data)) {
      // Si es { success: true, data: [...] }
      parquesData = data.data;
    } else if (data.data && Array.isArray(data.data)) {
      // Fallback a data.data
      parquesData = data.data;
    } else {
      console.error('❌ No se pudo extraer array de parques de respuesta:', data);
      throw new Error('Formato de respuesta inesperado');
    }

    console.log(`📄 Transformando ${parquesData.length} parques...`);

    const parques = parquesData.map((item: any, idx: number) => {
      try {
        const parque = transformToParque(item);
        if (idx < 3 || idx === parquesData.length - 1) {
          console.log(`  [${idx}] ${parque.nombre_up} - Geometría: ${parque.geometry?.type || 'NONE'} - ID: ${parque.upid}`);
        }
        return parque;
      } catch (itemError) {
        console.error(`  ❌ Error transformando parque ${idx}:`, itemError);
        throw itemError;
      }
    });

    const conGeometria = parques.filter(p => p.geometry).length;
    console.log(`✅ Parques cargados exitosamente:`, {
      total: parques.length,
      conGeometria: conGeometria,
      sin_geometria: parques.length - conGeometria
    });

    if (parques.length === 0) {
      console.warn('⚠️  Se cargaron 0 parques');
    }

    return parques;
  } catch (error) {
    console.error('❌ Error al cargar parques:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('   Detalles:', errorMsg);
    throw new Error(`No se pudieron cargar los parques: ${errorMsg}`);
  }
}

/**
 * Registra un reconocimiento de parque con fotos
 * Endpoint: POST /grupo-operativo/reconocimiento
 * 
 * @param reconocimiento - Datos del reconocimiento
 * @param photoFiles - Archivos de fotos
 * @returns Respuesta del servidor con URLs de fotos
 */
export async function registrarReconocimiento(
  reconocimiento: Partial<ReconocimientoParque>,
  photoFiles: File[] = []
): Promise<ReconocimientoResponse> {
  try {
    const formData = new FormData();
    
    // Validar campos requeridos
    if (!reconocimiento.tipo_intervencion) {
      throw new Error('El tipo de intervención es requerido');
    }
    if (!reconocimiento.descripcion_intervencion) {
      throw new Error('La descripción de intervención es requerida');
    }
    if (!reconocimiento.direccion) {
      throw new Error('La dirección es requerida');
    }
    if (!reconocimiento.coordinates_data) {
      throw new Error('Las coordenadas GPS son requeridas');
    }
    if (!photoFiles || photoFiles.length === 0) {
      throw new Error('Debe incluir al menos una foto');
    }
    
    // Campos requeridos del API
    formData.append('tipo_intervencion', reconocimiento.tipo_intervencion);
    formData.append('descripcion_intervencion', reconocimiento.descripcion_intervencion);
    formData.append('direccion', reconocimiento.direccion);
    formData.append('coordinates_type', reconocimiento.coordinates_type || 'Point');
    formData.append('coordinates_data', reconocimiento.coordinates_data);
    
    // Incluir nombre_parque/nombre_up si está disponible
    if (reconocimiento.nombre_up) {
      formData.append('nombre_parque', reconocimiento.nombre_up);
    }
    
    // Incluir upid si está disponible
    if (reconocimiento.upid) {
      formData.append('upid', reconocimiento.upid);
    }
    
    // Campos opcionales
    if (reconocimiento.observaciones) {
      formData.append('observaciones', reconocimiento.observaciones);
    } else {
      // Enviar string vacío si no hay observaciones
      formData.append('observaciones', '');
    }
    
    // Fotos - El backend las sube a S3
    if (photoFiles && photoFiles.length > 0) {
      photoFiles.forEach((file) => {
        formData.append('photos[]', file);
      });
    }
    
    // Hacer la petición POST usando fetch directamente porque necesitamos FormData
    // En desarrollo: usa el proxy /api -> https://railway.app
    // En producción: usa la URL completa de VITE_API_URL
    const API_URL = import.meta.env.DEV 
      ? '/api/grupo-operativo/reconocimiento'
      : `${import.meta.env.VITE_API_URL}/grupo-operativo/reconocimiento`;
    
    const token = localStorage.getItem('auth_token');
    
    console.log('📤 Enviando reconocimiento a:', API_URL);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }
    
    const result: ReconocimientoResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Error al registrar el reconocimiento');
    }
    
    console.log('Reconocimiento registrado exitosamente:', result);
    return result;
    
  } catch (error) {
    console.error('Error al registrar reconocimiento:', error);
    throw error instanceof Error ? error : new Error('No se pudo registrar el reconocimiento');
  }
}

/**
 * Registra una intervención de CUADRILLA (poda, tala, mantenimiento arbóreo)
 * Endpoint: POST /grupo-cuadrilla/reporte_intervencion
 * 
 * @param data - Datos de la intervención
 * @param photoFiles - Archivos de fotos
 * @returns Respuesta del servidor
 */
export async function registrarIntervencionCuadrilla(
  data: {
    tipo_arbol: string;
    registrado_por: string;
    grupo: string;
    observaciones: string;
    numero_individuos_intervenidos: number;
    coordinates_data: string;
    tipo_intervencion: string;
    id_actividad: string;
    descripcion_intervencion: string;
    coordinates_type: string;
  },
  photoFiles: File[] = []
): Promise<ReconocimientoResponse> {
  try {
    const formData = new FormData();
    
    // Validar campos requeridos
    if (!data.tipo_arbol) throw new Error('Tipo de árbol es requerido');
    if (!data.tipo_intervencion) throw new Error('Tipo de intervención es requerido');
    if (!data.numero_individuos_intervenidos || data.numero_individuos_intervenidos < 1) {
      throw new Error('Número de individuos intervenidos es requerido');
    }
    if (!data.descripcion_intervencion) throw new Error('Descripción es requerida');
    if (!data.coordinates_data) throw new Error('Coordenadas GPS son requeridas');
    if (!photoFiles || photoFiles.length === 0) {
      throw new Error('Debe incluir al menos una foto');
    }
    
    // Validar que photoFiles contenga objetos File válidos
    console.log('🔍 Validando photoFiles:', {
      esArray: Array.isArray(photoFiles),
      longitud: photoFiles.length,
      tipo: typeof photoFiles,
      contenido: photoFiles.map((f, i) => ({
        index: i,
        nombre: f?.name,
        tamaño: f?.size,
        tipo: f?.type,
        esFile: f instanceof File,
        esBlob: f instanceof Blob
      }))
    });
    
    if (!Array.isArray(photoFiles)) {
      throw new Error('photoFiles debe ser un array');
    }
    
    const invalidFiles = photoFiles.filter(f => !(f instanceof File));
    if (invalidFiles.length > 0) {
      throw new Error(`Se encontraron ${invalidFiles.length} elementos que no son archivos File válidos`);
    }
    
    // TEMPORALMENTE: Revertir a campos individuales (JSON string no funcionó)
    // Usar array notation photos[] para que FastAPI lo interprete como lista
    formData.append('tipo_arbol', data.tipo_arbol);
    formData.append('registrado_por', data.registrado_por || '');
    formData.append('grupo', data.grupo || '');
    formData.append('observaciones', data.observaciones || '');
    formData.append('numero_individuos_intervenidos', data.numero_individuos_intervenidos.toString());
    formData.append('coordinates_data', data.coordinates_data);
    formData.append('tipo_intervencion', data.tipo_intervencion);
    formData.append('id_actividad', data.id_actividad);
    formData.append('descripcion_intervencion', data.descripcion_intervencion);
    formData.append('coordinates_type', data.coordinates_type || 'Point');
    
    // Agregar fotos con array notation [] - esto ayuda a algunos backends a reconocerlo como lista
    console.log(`📸 Agregando ${photoFiles.length} foto(s) con array notation`);
    photoFiles.forEach((file, index) => {
      console.log(`  - Foto ${index}: ${file.name} (${file.size} bytes, tipo: ${file.type})`);
      // CAMBIO CRÍTICO: Usar 'photos[]' en lugar de 'photos'
      formData.append('photos[]', file);
    });
    
    // Log del FormData para debugging
    console.log('📦 Contenido del FormData:');
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`  ${key}: [File] ${value.name} (${value.size} bytes)`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }
    
    // Log detallado para debugging
    console.log('📋 Datos a enviar:', {
      tipo_arbol: data.tipo_arbol,
      registrado_por: data.registrado_por,
      grupo: data.grupo,
      observaciones: data.observaciones,
      numero_individuos_intervenidos: data.numero_individuos_intervenidos,
      coordinates_data: data.coordinates_data,
      tipo_intervencion: data.tipo_intervencion,
      id_actividad: data.id_actividad,
      descripcion_intervencion: data.descripcion_intervencion,
      coordinates_type: data.coordinates_type,
      fotos: photoFiles.length
    });
    
    // Determinar URL según entorno
    const API_URL = import.meta.env.DEV 
      ? '/api/grupo-cuadrilla/reporte_intervencion'
      : `${import.meta.env.VITE_API_URL}/grupo-cuadrilla/reporte_intervencion`;
    
    const token = localStorage.getItem('auth_token');
    
    console.log('📤 Enviando intervención CUADRILLA a:', API_URL);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: formData
    });
    
    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch (parseError) {
        const textError = await response.text().catch(() => '');
        console.error('❌ Error del servidor (texto):', textError);
        throw new Error(`Error ${response.status}: ${response.statusText} - ${textError}`);
      }
      
      console.error('❌ Error del servidor CUADRILLA:', {
        status: response.status,
        statusText: response.statusText,
        errorData: JSON.stringify(errorData, null, 2)
      });
      
      // Extraer mensaje de error
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      
      if (errorData.detail) {
        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          // FastAPI validation errors
          errorMessage = errorData.detail.map((err: any) => 
            `${err.loc?.join('.')} - ${err.msg}`
          ).join(', ');
        } else {
          errorMessage = JSON.stringify(errorData.detail);
        }
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
      
      throw new Error(errorMessage);
    }
    
    const result: ReconocimientoResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Error al registrar la intervención');
    }
    
    console.log('✅ Intervención CUADRILLA registrada:', result);
    return result;
    
  } catch (error) {
    console.error('❌ Error al registrar intervención CUADRILLA:', error);
    throw error instanceof Error ? error : new Error('No se pudo registrar la intervención');
  }
}

/**
 * Obtiene el listado de reportes/reconocimientos registrados
 * Endpoint: GET /grupo-operativo/reportes
 */
export async function getReportes(): Promise<ReportesResponse> {
  try {
    const response = await ApiClient.get<ReportesResponse>('/grupo-operativo/reportes');
    
    console.log('API Response Reportes:', response);
    
    if (!response.success) {
      throw new Error('Respuesta inválida del servidor');
    }
    
    return response;
    
  } catch (error) {
    console.error('Error al obtener reportes:', error);
    throw new Error('No se pudieron cargar los reportes');
  }
}

/**
 * Prepara los archivos de fotos para el envío
 * Esta función convierte File objects a un formato compatible con FormData
 * 
 * @param photos - Array de archivos File o URLs
 * @returns Array de archivos File listos para FormData
 */
export function preparePhotosForUpload(photos: (File | string)[]): File[] {
  return photos.filter((photo): photo is File => photo instanceof File);
}

/**
 * Obtiene todos los reportes de intervenciones del grupo CUADRILLA
 * GET /grupo-cuadrilla/reportes_intervenciones
 */
export interface ReporteIntervencion {
  id: string;
  registrado_por: string | null;
  grupo: string | null;
  observaciones: string;
  coordinates: {
    type: string;
    coordinates: string; // "lng lat" format
  };
  tipo_intervencion: string;
  id_actividad: string | null;
  descripcion_intervencion: string | null;
  timestamp: string;
  photos_uploaded: number;
  photosUrl: string[];
  barrio_vereda: string;
  comuna_corregimiento: string;
  // Campos específicos de Cuadrilla
  tipo_arbol?: string | null;
  numero_individuos_intervenidos?: number | null;
  // Campos específicos de Vivero
  tipos_plantas?: Record<string, number> | null;
  cantidad_total_plantas?: number | null;
  // Campos específicos de Gobernanza / Ecosistemas / UMATA
  unidades_impactadas?: number | null;
  unidad_medida?: string | null;
  // Campo compartido por Vivero, Gobernanza, Ecosistemas, UMATA
  direccion?: string | null;
  // Campos calculados para compatibilidad
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

export async function obtenerReportesIntervenciones(): Promise<ReportesIntervencionResponse> {
  try {
    const API_URL = import.meta.env.DEV 
      ? '/api/grupo-cuadrilla/reportes_intervenciones'
      : `${import.meta.env.VITE_API_URL}/grupo-cuadrilla/reportes_intervenciones`;
    
    const token = localStorage.getItem('auth_token');
    
    console.log('📊 Obteniendo reportes de intervenciones...');
    
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    const responseData = await response.json();
    console.log('✓ Reportes obtenidos:', responseData);
    
    // Normalizar los datos para agregar campos calculados
    const normalizedData = responseData.data.map((reporte: ReporteIntervencion) => {
      // Parsear coordenadas - puede ser string "lng lat" o array [lng, lat]
      let coordinates_data: [number, number] = [-76.532, 3.4516]; // Default Cali
      
      if (reporte.coordinates?.coordinates) {
        const coordsValue = reporte.coordinates.coordinates;
        
        // Si es un array [lng, lat]
        if (Array.isArray(coordsValue) && coordsValue.length === 2) {
          coordinates_data = [Number(coordsValue[0]), Number(coordsValue[1])];
        } 
        // Si es un string "lng lat"
        else if (typeof coordsValue === 'string') {
          const coords = coordsValue.split(' ');
          if (coords.length === 2) {
            coordinates_data = [parseFloat(coords[0]), parseFloat(coords[1])];
          }
        }
      }
      
      return {
        ...reporte,
        coordinates_data,
        fecha_registro: reporte.timestamp,
        // Alias para compatibilidad
        comuna: reporte.comuna_corregimiento,
        barrio: reporte.barrio_vereda,
        photos: reporte.photosUrl
      };
    });
    
    return {
      ...responseData,
      data: normalizedData
    };
  } catch (error) {
    console.error('❌ Error al obtener reportes de intervenciones:', error);
    throw error;
  }
}

// ============================================
// FUNCIONES GENÉRICAS PARA GRUPOS ADICIONALES
// ============================================

/**
 * Helper: Construye la URL según entorno (dev proxy vs prod)
 */
function buildApiUrl(path: string): string {
  return import.meta.env.DEV
    ? `/api${path}`
    : `${import.meta.env.VITE_API_URL}${path}`;
}

/**
 * Helper: Envía un reporte de intervención genérico (FormData) a un endpoint de grupo.
 * Reutiliza la lógica de fetch + token + error handling.
 */
async function postIntervencionGrupo(
  endpoint: string,
  formData: FormData,
  grupoLabel: string
): Promise<ReconocimientoResponse> {
  const API_URL = buildApiUrl(endpoint);
  const token = localStorage.getItem('auth_token');

  console.log(`📤 Enviando intervención ${grupoLabel} a:`, API_URL);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    body: formData,
  });

  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch {
      const textError = await response.text().catch(() => '');
      throw new Error(`Error ${response.status}: ${response.statusText} - ${textError}`);
    }

    let errorMessage = `Error ${response.status}: ${response.statusText}`;
    if (errorData.detail) {
      if (typeof errorData.detail === 'string') {
        errorMessage = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        errorMessage = errorData.detail
          .map((err: any) => `${err.loc?.join('.')} - ${err.msg}`)
          .join(', ');
      } else {
        errorMessage = JSON.stringify(errorData.detail);
      }
    } else if (errorData.message) {
      errorMessage = errorData.message;
    }
    throw new Error(errorMessage);
  }

  const result: ReconocimientoResponse = await response.json();
  if (!result.success) {
    throw new Error(result.message || `Error al registrar intervención ${grupoLabel}`);
  }

  console.log(`✅ Intervención ${grupoLabel} registrada:`, result);
  return result;
}

/**
 * Helper: Agrega campos comunes de intervención al FormData.
 */
function appendCommonFields(
  formData: FormData,
  data: {
    tipo_intervencion: string;
    descripcion_intervencion: string;
    registrado_por: string;
    grupo: string;
    id_actividad: string;
    observaciones: string;
    coordinates_type: string;
    coordinates_data: string;
  }
): void {
  formData.append('tipo_intervencion', data.tipo_intervencion);
  formData.append('descripcion_intervencion', data.descripcion_intervencion);
  formData.append('registrado_por', data.registrado_por || '');
  formData.append('grupo', data.grupo || '');
  formData.append('id_actividad', data.id_actividad || '');
  formData.append('observaciones', data.observaciones || '');
  formData.append('coordinates_type', data.coordinates_type || 'Point');
  formData.append('coordinates_data', data.coordinates_data);
}

/**
 * Helper: Agrega fotos al FormData.
 * Usa 'photos[]' (array notation) para que FastAPI/python-multipart
 * lo interprete correctamente como lista de archivos.
 */
function appendPhotos(formData: FormData, photoFiles: File[]): void {
  photoFiles.forEach((file) => {
    formData.append('photos[]', file);
  });
}

// ── VIVERO ──

/**
 * POST /grupo-vivero/reporte_intervencion
 */
export async function registrarIntervencionVivero(
  data: IntervencionViveroData,
  photoFiles: File[] = []
): Promise<ReconocimientoResponse> {
  const formData = new FormData();
  appendCommonFields(formData, data);
  formData.append('tipos_plantas', data.tipos_plantas);
  formData.append('direccion', data.direccion || '');
  appendPhotos(formData, photoFiles);
  return postIntervencionGrupo('/grupo-vivero/reporte_intervencion', formData, 'VIVERO');
}

/**
 * GET /grupo-vivero/reportes_intervenciones
 */
export async function obtenerReportesVivero(
  filters?: { id?: string; id_actividad?: string; grupo?: string }
): Promise<ReportesIntervencionResponse> {
  return fetchReportesGrupo('/grupo-vivero/reportes_intervenciones', filters);
}

// ── GOBERNANZA ──

/**
 * POST /grupo-gobernanza/reporte_intervencion
 */
export async function registrarIntervencionGobernanza(
  data: IntervencionGobernanzaData,
  photoFiles: File[] = []
): Promise<ReconocimientoResponse> {
  const formData = new FormData();
  appendCommonFields(formData, data);
  formData.append('unidades_impactadas', data.unidades_impactadas.toString());
  formData.append('direccion', data.direccion || '');
  appendPhotos(formData, photoFiles);
  return postIntervencionGrupo('/grupo-gobernanza/reporte_intervencion', formData, 'GOBERNANZA');
}

/**
 * GET /grupo-gobernanza/reportes_intervenciones
 */
export async function obtenerReportesGobernanza(
  filters?: { id?: string; id_actividad?: string; grupo?: string }
): Promise<ReportesIntervencionResponse> {
  return fetchReportesGrupo('/grupo-gobernanza/reportes_intervenciones', filters);
}

// ── ECOSISTEMAS ──

/**
 * POST /grupo-ecosistemas/reporte_intervencion
 */
export async function registrarIntervencionEcosistemas(
  data: IntervencionEcosistemasData,
  photoFiles: File[] = []
): Promise<ReconocimientoResponse> {
  const formData = new FormData();
  appendCommonFields(formData, data);
  formData.append('unidad_medida', data.unidad_medida);
  formData.append('unidades_impactadas', data.unidades_impactadas.toString());
  formData.append('direccion', data.direccion || '');
  appendPhotos(formData, photoFiles);
  return postIntervencionGrupo('/grupo-ecosistemas/reporte_intervencion', formData, 'ECOSISTEMAS');
}

/**
 * GET /grupo-ecosistemas/reportes_intervenciones
 */
export async function obtenerReportesEcosistemas(
  filters?: { id?: string; id_actividad?: string; grupo?: string }
): Promise<ReportesIntervencionResponse> {
  return fetchReportesGrupo('/grupo-ecosistemas/reportes_intervenciones', filters);
}

// ── UMATA ──

/**
 * POST /grupo-umata/reporte_intervencion
 */
export async function registrarIntervencionUmata(
  data: IntervencionUmataData,
  photoFiles: File[] = []
): Promise<ReconocimientoResponse> {
  const formData = new FormData();
  appendCommonFields(formData, data);
  formData.append('unidades_impactadas', data.unidades_impactadas.toString());
  formData.append('direccion', data.direccion || '');
  appendPhotos(formData, photoFiles);
  return postIntervencionGrupo('/grupo-umata/reporte_intervencion', formData, 'UMATA');
}

/**
 * GET /grupo-umata/reportes_intervenciones
 */
export async function obtenerReportesUmata(
  filters?: { id?: string; id_actividad?: string; grupo?: string }
): Promise<ReportesIntervencionResponse> {
  return fetchReportesGrupo('/grupo-umata/reportes_intervenciones', filters);
}

// ── Helper GET genérico para reportes de grupo ──

async function fetchReportesGrupo(
  endpoint: string,
  filters?: { id?: string; id_actividad?: string; grupo?: string }
): Promise<ReportesIntervencionResponse> {
  try {
    let url = buildApiUrl(endpoint);
    const params = new URLSearchParams();
    if (filters?.id) params.append('id', filters.id);
    if (filters?.id_actividad) params.append('id_actividad', filters.id_actividad);
    if (filters?.grupo) params.append('grupo', filters.grupo);
    const qs = params.toString();
    if (qs) url += `?${qs}`;

    const token = localStorage.getItem('auth_token');
    console.log(`📊 Obteniendo reportes desde ${endpoint}...`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const responseData = await response.json();
    console.log(`✓ Reportes obtenidos de ${endpoint}:`, responseData);

    const normalizedData = (responseData.data || []).map((reporte: ReporteIntervencion) => {
      let coordinates_data: [number, number] = [-76.532, 3.4516];
      if (reporte.coordinates?.coordinates) {
        const coordsValue = reporte.coordinates.coordinates;
        if (Array.isArray(coordsValue) && coordsValue.length === 2) {
          coordinates_data = [Number(coordsValue[0]), Number(coordsValue[1])];
        } else if (typeof coordsValue === 'string') {
          const coords = coordsValue.split(' ');
          if (coords.length === 2) {
            coordinates_data = [parseFloat(coords[0]), parseFloat(coords[1])];
          }
        }
      }
      return {
        ...reporte,
        coordinates_data,
        fecha_registro: reporte.timestamp,
        comuna: reporte.comuna_corregimiento,
        barrio: reporte.barrio_vereda,
        photos: reporte.photosUrl,
      };
    });

    return { ...responseData, data: normalizedData };
  } catch (error) {
    console.error(`❌ Error al obtener reportes de ${endpoint}:`, error);
    throw error;
  }
}
