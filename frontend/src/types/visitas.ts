/**
 * Tipos y estructuras de datos para el Sistema de Verificación de Parques DAGMA
 */

// ============================================
// 1. TIPOS PARA DATOS DE LA API
// ============================================

/**
 * Intervención asociada a un parque
 */
export interface Intervencion {
  ano: number;
  frente_activo: string;
  avance_obra: number;
  url_proceso: string | null;
  referencia_contrato: string | null;
  referencia_proceso: string | null;
  fecha_inicio: string;
  fuera_rango: string | null;
  tipo_intervencion: string;
  presupuesto_base: number;
  fuente_financiacion: string;
  bpin: number;
  fecha_inicio_std: string;
  estado: string; // "En alistamiento", "En ejecución", "Suspendido", "Terminado"
  fecha_fin_std: string;
  intervencion_id: string;
  fecha_fin: string;
}

/**
 * Tipo de geometría GeoJSON soportada
 */
export type GeometryType = 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';

/**
 * Coordenadas GeoJSON (soporta todos los tipos)
 */
export type GeoJSONCoordinates = 
  | [number, number] // Point
  | [number, number][] // LineString, MultiPoint
  | [number, number][][] // Polygon, MultiLineString
  | [number, number][][][] // MultiPolygon
  | any; // Fallback para geometrías complejas

/**
 * Parque desde /init/parques - Soporta todas las geometrías GeoJSON
 */
export interface Parque {
  nombre_up_detalle: string | null;
  upid: string;
  _hash: string;
  updated_at: string;
  avance_obra: number;
  barrio_vereda_2: string | null;
  nombre_up: string;
  has_geometry: boolean;
  lat: string | null;
  created_at: string;
  lon: string | null;
  nombre_centro_gestor: string;
  intervenciones: Intervencion[];
  identificador: string;
  barrio_vereda: string | null;
  direccion: string | null;
  comuna_corregimiento_2: string | null;
  presupuesto_base: number;
  n_intervenciones: number;
  tipo_equipamiento: string;
  geometry: {
    type: GeometryType;
    coordinates: GeoJSONCoordinates;
  } | null;
  comuna_corregimiento: string | null;
  bpin: number;
  clase_up: string;
}

/**
 * Centro Gestor (mantenido por compatibilidad)
 */
export interface CentroGestor {
  label: string;
  value: string;
}

// Alias para compatibilidad con código existente
export type UnidadProyecto = Parque;

// ============================================
// 2. TIPOS PARA EL FORMULARIO DE RECONOCIMIENTO
// ============================================

/**
 * Coordenadas GPS
 */
export interface Coordenadas {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

/**
 * Datos completos del Reconocimiento de Parque
 * Este es el JSON final que se enviará al backend
 */
export interface ReconocimientoParque {
  // Paso 1: Selección de parque
  upid: string;
  nombre_up: string;
  direccion: string;
  
  // Paso 2: Formulario y GPS
  tipo_intervencion: string;
  descripcion_intervencion: string;
  observaciones?: string;
  coordenadas_gps: Coordenadas;
  coordinates_type: string; // 'Point', 'LineString', 'Polygon'
  coordinates_data: string; // JSON array de coordenadas
  
  // Paso 3: Fotos
  photos: File[]; // Archivos de fotos
  
  // Metadata
  fecha_registro: string; // ISO 8601
  usuario_id?: string;
}

// Alias para compatibilidad
export type VisitaVerificacion = ReconocimientoParque;
export type TipoVisita = 'verificacion' | 'comunicaciones'; // Mantener por compatibilidad
export type Estado360 = 'Antes' | 'Durante' | 'Después'; // Mantener por compatibilidad

// ============================================
// 3. ESTADO DEL STEPPER (3 PASOS)
// ============================================

/**
 * Paso activo del formulario (reducido a 3 pasos)
 */
export type StepNumber = 1 | 2 | 3;

/**
 * Estado completo del formulario progresivo
 */
export interface FormularioState {
  currentStep: StepNumber;
  completedSteps: Set<StepNumber>;
  
  // Datos del formulario
  data: Partial<ReconocimientoParque>;
  
  // Estado de carga
  isLoading: boolean;
  error: string | null;
  
  // Datos auxiliares cargados
  parques: Parque[];
  selectedParque: Parque | null;
}

// ============================================
// 4. TIPOS PARA VALIDACIÓN
// ============================================

// ============================================
// 4. TIPOS PARA VALIDACIÓN
// ============================================

/**
 * Resultado de validación de un paso
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Configuración de validación por paso
 */
export type StepValidation = {
  [K in StepNumber]: (data: Partial<ReconocimientoParque>) => ValidationResult;
};

// ============================================
// 5. TIPOS PARA REPORTES
// ============================================

/**
 * Reporte/Reconocimiento registrado desde /grupo-operativo/reportes
 */
export interface Reporte {
  id: string;
  upid: string;
  nombre_parque: string | null;
  tipo_intervencion: string | null;
  descripcion_intervencion: string | null;
  direccion: string | null;
  observaciones?: string;
  coordinates: {
    type: string;
    coordinates: [number, number] | [number, number][] | [number, number][][];
  };
  photosUrl: string[];
  photos_uploaded: number;
  fecha_registro: string; // ISO 8601
  usuario_id?: string;
}

/**
 * Respuesta del endpoint /init/parques
 */
export interface ParquesResponse {
  success: boolean;
  data: Parque[];
  count: number;
  timestamp: string;
  message: string;
}

/**
 * Respuesta del endpoint /grupo-operativo/reportes
 */
export interface ReportesResponse {
  success: boolean;
  data: Reporte[];
  count: number;
  timestamp: string;
}

/**
 * Respuesta del endpoint /grupo-operativo/reconocimiento (POST)
 */
export interface ReconocimientoResponse {
  success: boolean;
  id: string;
  message: string;
  coordinates: {
    type: string;
    coordinates: [number, number];
  };
  photosUrl: string[];
  photos_uploaded: number;
  timestamp: string;
}
