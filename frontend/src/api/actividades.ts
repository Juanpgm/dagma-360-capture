// API para actividades del Plan Distrito Verde
import { ApiClient } from '../lib/api-client';
import type { ActividadPlanDistritoVerde, ActividadesAPIResponse } from '../types/actividades';

/**
 * Obtiene todas las actividades del Plan Distrito Verde
 */
export async function getActividadesPlanDistritoVerde(): Promise<ActividadPlanDistritoVerde[]> {
  try {
    const response = await ApiClient.get<ActividadesAPIResponse>('/actividades_plan_distrito_verde');
    
    // La API devuelve { success, total, data }
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  } catch (error) {
    console.error('Error al obtener actividades:', error);
    throw error;
  }
}

/**
 * Genera URL de Google Maps con las coordenadas del punto de encuentro
 */
export function getGoogleMapsUrl(geometry: { coordinates: [number, number] }): string {
  const [longitude, latitude] = geometry.coordinates;
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
