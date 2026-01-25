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
 * Obtiene el listado de Parques desde /init/parques
 * Endpoint: GET /init/parques
 */
export async function getParques(): Promise<Parque[]> {
  try {
    const response = await ApiClient.get<ParquesResponse>('/init/parques');
    
    console.log('API Response Parques:', response);
    
    if (!response.success || !response.data) {
      throw new Error('Respuesta inválida del servidor');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error al cargar parques:', error);
    throw new Error('No se pudieron cargar los parques');
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
    
    // Campos requeridos del API
    formData.append('tipo_intervencion', reconocimiento.tipo_intervencion || '');
    formData.append('descripcion_intervencion', reconocimiento.descripcion_intervencion || '');
    formData.append('direccion', reconocimiento.direccion || '');
    formData.append('coordinates_type', reconocimiento.coordinates_type || 'Point');
    formData.append('coordinates_data', reconocimiento.coordinates_data || '[-76.5225, 3.4516]');
    
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
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://gestorproyectoapi-production.up.railway.app';
    const token = localStorage.getItem('auth_token');
    
    const response = await fetch(`${API_BASE_URL}/grupo-operativo/reconocimiento`, {
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

// ============================================
// FUNCIONES DE COMPATIBILIDAD (LEGACY)
// ============================================

// Alias para compatibilidad con código existente
export const fetchUnidadesProyecto = getParques;
export const fetchCentrosGestores = async () => [];
export const createVisitaVerificacion = registrarReconocimiento;
export const fetchHistorialVisitas = getReportes;
