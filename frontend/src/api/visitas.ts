/**
 * Servicio API para el módulo de Verificación de Parques DAGMA
 */

import { ApiClient } from '../lib/api-client';
import type {
  Parque,
  ParquesResponse,
  ReportesResponse,
  ReconocimientoResponse,
  ReconocimientoParque
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
        formData.append('photos', file);
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
