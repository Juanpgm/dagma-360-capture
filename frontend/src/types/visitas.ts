/**
 * Tipos y estructuras de datos para el Sistema de Verificación DAGMA
 * Endpoints unificados: POST/GET /grupos/{key}/reporte_intervencion(es)
 */

import type { ActividadPlanDistritoVerde } from './actividades';

// ============================================
// 1. TIPOS PARA EL FORMULARIO
// ============================================

export interface Coordenadas {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface ReconocimientoParque {
  upid: string;
  nombre_up: string;
  direccion: string;
  tipo_intervencion: string;
  descripcion_intervencion: string;
  observaciones?: string;
  coordenadas_gps: Coordenadas;
  coordinates_type: string;
  coordinates_data: string;
  photos: File[];
  fecha_registro: string;
  usuario_id?: string;
}

// ============================================
// 2. ESTADO DEL STEPPER (3 PASOS)
// ============================================

export type StepNumber = 1 | 2 | 3;

export interface FormularioState {
  currentStep: StepNumber;
  completedSteps: Set<StepNumber>;
  data: Partial<ReconocimientoParque>;
  isLoading: boolean;
  error: string | null;
  actividades: ActividadPlanDistritoVerde[];
  selectedActividad: ActividadPlanDistritoVerde | null;
}

// ============================================
// 3. VALIDACIÓN
// ============================================

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export type StepValidation = {
  [K in StepNumber]: (data: Partial<ReconocimientoParque>) => ValidationResult;
};

// ============================================
// 4. RESPUESTAS API
// ============================================

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

// ============================================
// 5. TIPOS PARA INTERVENCIONES POR GRUPO
// ============================================

import type { GrupoFormType } from '../lib/grupos';
export type { GrupoFormType };

export interface PlantaEntry {
  nombre: string;
  cantidad: number;
}

export interface IntervencionCommonData {
  tipo_intervencion: string;
  descripcion_intervencion: string;
  registrado_por: string;
  grupo: string;
  id_actividad: string;
  observaciones: string;
  coordinates_type: string;
  coordinates_data: string;
}
