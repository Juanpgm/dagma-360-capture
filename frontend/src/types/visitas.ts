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
  id: string | null;
  message: string;
  nombre_parque?: string | null;
  coordinates?: {
    type: string;
    coordinates: [number, number];
  } | null;
  photosUrl?: string[] | null;
  photos_uploaded?: number | null;
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

export interface ArbolEntry {
  especie: string; // "Nombre común (Nombre científico)"
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

export interface Reporte {
  id: string;
  nombre_parque: string;
  descripcion_intervencion: string;
  tipo_intervencion: string;
  fecha_registro: string;
  direccion: string;
  upid: string;
  observaciones?: string;
  photosUrl?: string[];
  photos_uploaded?: number;
}
