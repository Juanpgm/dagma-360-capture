/**
 * Store Svelte para gestionar el estado del formulario de Reconocimientos de Parques DAGMA
 */

import { writable, derived, get } from 'svelte/store';
import type {
  FormularioState,
  ReconocimientoParque,
  StepNumber,
  Parque
} from '../types/visitas';
import { getCurrentPosition, checkGeolocationPermission, isGeolocationAvailable } from '../lib/geolocation';
import { getParques } from '../api/visitas';

/**
 * Estado inicial del formulario
 */
const initialState: FormularioState = {
  currentStep: 1,
  completedSteps: new Set<StepNumber>(),
  data: {
    tipo_intervencion: '',
    descripcion_intervencion: '',
    observaciones: '',
    photos: [],
    fecha_registro: new Date().toISOString()
  },
  isLoading: false,
  error: null,
  parques: [],
  selectedParque: null
};

/**
 * Store principal del formulario
 */
function createVisitaStore() {
  const { subscribe, set, update } = writable<FormularioState>(initialState);

  return {
    subscribe,
    
    /**
     * Resetea el formulario al estado inicial
     */
    reset: () => {
      set({
        ...initialState,
        data: {
          tipo_intervencion: '',
          descripcion_intervencion: '',
          observaciones: '',
          photos: [],
          fecha_registro: new Date().toISOString()
        },
        completedSteps: new Set<StepNumber>()
      });
    },

    /**
     * Navega al siguiente paso
     */
    nextStep: () => {
      update(state => {
        const nextStep = Math.min(state.currentStep + 1, 3) as StepNumber;
        
        // Crear nuevo Set con el paso actual agregado (inmutabilidad)
        const newCompletedSteps = new Set(state.completedSteps);
        newCompletedSteps.add(state.currentStep);
        
        console.log('nextStep - Agregando paso', state.currentStep, 'a completados. Nuevos completados:', Array.from(newCompletedSteps));
        
        return {
          ...state,
          currentStep: nextStep,
          completedSteps: newCompletedSteps
        };
      });
    },

    /**
     * Navega al paso anterior
     */
    previousStep: () => {
      update(state => ({
        ...state,
        currentStep: Math.max(state.currentStep - 1, 1) as StepNumber
      }));
    },

    /**
     * Va a un paso específico
     */
    goToStep: (step: StepNumber) => {
      update(state => ({ ...state, currentStep: step }));
    },

    /**
     * Actualiza los datos del formulario
     */
    updateData: (partialData: Partial<ReconocimientoParque>) => {
      update(state => ({
        ...state,
        data: { ...state.data, ...partialData }
      }));
    },

    /**
     * Selecciona un Parque
     */
    selectParque: (parque: Parque) => {
      update(state => ({
        ...state,
        selectedParque: parque,
        data: {
          ...state.data,
          upid: parque.upid,
          nombre_up: parque.nombre_up,
          direccion: parque.direccion || ''
        }
      }));
    },

    /**
     * Verifica los permisos de geolocalización antes de capturar GPS
     * Retorna el estado del permiso: 'granted', 'denied', 'prompt', 'unavailable'
     */
    checkGPSPermission: async (): Promise<'granted' | 'denied' | 'prompt' | 'unavailable'> => {
      if (!isGeolocationAvailable()) {
        return 'unavailable';
      }
      
      try {
        const status = await checkGeolocationPermission();
        return status;
      } catch (error) {
        console.error('Error al verificar permisos GPS:', error);
        return 'prompt';
      }
    },

    /**
     * Captura coordenadas GPS automáticamente
     */
    captureGPS: async () => {
      update(state => ({ ...state, isLoading: true, error: null }));
      
      try {
        const coords = await getCurrentPosition();
        
        // Formatear coordenadas como JSON array string
        const coordinatesData = JSON.stringify([coords.longitude, coords.latitude]);
        
        update(state => ({
          ...state,
          isLoading: false,
          data: {
            ...state.data,
            coordenadas_gps: coords,
            coordinates_type: 'Point',
            coordinates_data: coordinatesData
          }
        }));
      } catch (error) {
        update(state => ({
          ...state,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Error al capturar GPS'
        }));
      }
    },

    /**
     * Agrega fotos al reconocimiento
     */
    addPhotos: (files: File[]) => {
      update(state => ({
        ...state,
        data: {
          ...state.data,
          photos: [...(state.data.photos || []), ...files]
        }
      }));
    },

    /**
     * Elimina una foto por índice
     */
    removePhoto: (index: number) => {
      update(state => ({
        ...state,
        data: {
          ...state.data,
          photos: (state.data.photos || []).filter((_, i) => i !== index)
        }
      }));
    },

    /**
     * Carga la lista de parques desde el API
     */
    loadParques: async () => {
      update(state => ({ ...state, isLoading: true, error: null }));
      
      try {
        const parques = await getParques();
        
        update(state => ({
          ...state,
          isLoading: false,
          parques
        }));
      } catch (error) {
        update(state => ({
          ...state,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Error al cargar parques'
        }));
      }
    },

    /**
     * Establece la lista de parques
     */
    setParques: (parques: Parque[]) => {
      update(state => ({ ...state, parques }));
    },

    /**
     * Establece estado de error
     */
    setError: (error: string | null) => {
      update(state => ({ ...state, error }));
    },

    /**
     * Establece estado de carga
     */
    setLoading: (isLoading: boolean) => {
      update(state => ({ ...state, isLoading }));
    }
  };
}

/**
 * Store global del formulario de reconocimientos
 */
export const visitaStore = createVisitaStore();

/**
 * Derived stores útiles
 */

// Progreso del formulario (0-100%)
export const formProgress = derived(
  visitaStore,
  $store => (($store.completedSteps.size / 3) * 100)
);

// Verifica si el paso actual está completo
// NOTA: Para el paso 3, la validación de fotos se hace en el componente padre
// porque las fotos se manejan con bind:photoFiles fuera del store
export const isCurrentStepValid = derived(
  visitaStore,
  $store => {
    const { currentStep, data, selectedParque } = $store;
    
    switch (currentStep) {
      case 1:
        // Paso 1: Debe haber un parque seleccionado
        return !!selectedParque;
      
      case 2:
        // Paso 2: Formulario + GPS
        return !!data.tipo_intervencion &&
               !!data.descripcion_intervencion &&
               !!data.coordenadas_gps;
      
      case 3:
        // Paso 3: La validación de fotos se hace en el componente con photoFiles
        // Por ahora siempre retornamos true, la validación real es en el submit
        return true;
      
      default:
        return false;
    }
  }
);

// Nombres de los pasos para el stepper UI (3 pasos)
export const stepNames = [
  'Selección de Parque',
  'Datos y GPS',
  'Evidencia Fotográfica'
];

