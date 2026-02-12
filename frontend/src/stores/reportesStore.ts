/**
 * Store de Seguimiento de Reportes/Reconocimientos
 * Gestiona reportes con estados y seguimiento de avances
 * Conectado con el endpoint /grupo-operativo/reportes
 */

import { writable, derived } from 'svelte/store';
import type {
  ReporteConSeguimiento,
  EstadoReporte,
  PrioridadReporte,
  RegistroAvanceReporte,
  EvidenciaReporte,
} from '../types/reportes';
import { getReportes } from '../api/visitas';
import { generateAvanceId } from '../types/reportes';

/* ============================================================
 *  STATE
 * ============================================================ */
interface ReportesState {
  reportes: ReporteConSeguimiento[];
  loading: boolean;
  error: string | null;
}

const initialState: ReportesState = {
  reportes: [],
  loading: false,
  error: null,
};

/* ============================================================
 *  STORE PRINCIPAL
 * ============================================================ */
function createReportesStore() {
  const { subscribe, update, set } = writable<ReportesState>(initialState);

  return {
    subscribe,

    /**
     * Carga los reportes desde la API y los convierte a ReporteConSeguimiento
     */
    cargarReportes: async () => {
      update((state) => ({ ...state, loading: true, error: null }));
      
      try {
        const response = await getReportes();
        
        if (response.success) {
          // Convertir reportes básicos a reportes con seguimiento
          const reportesConSeguimiento: ReporteConSeguimiento[] = response.data.map((reporte) => ({
            ...reporte,
            nombre_parque: reporte.nombre_parque || 'Parque sin nombre',
            tipo_intervencion: reporte.tipo_intervencion || 'Sin especificar',
            descripcion_intervencion: reporte.descripcion_intervencion || 'Sin descripción',
            direccion: reporte.direccion || 'Sin dirección',
            estado: 'notificado' as EstadoReporte, // Estado inicial por defecto
            prioridad: 'media' as PrioridadReporte,
            porcentaje_avance: 0,
            historial: [
              {
                id: generateAvanceId(),
                reporte_id: reporte.id,
                fecha: reporte.fecha_registro,
                autor: 'Sistema',
                descripcion: 'Reporte creado y notificado',
                estado_anterior: 'notificado' as EstadoReporte,
                estado_nuevo: 'notificado' as EstadoReporte,
                porcentaje: 0,
                evidencias: [],
              },
            ],
            updated_at: reporte.fecha_registro,
          }));
          
          update((state) => ({
            ...state,
            reportes: reportesConSeguimiento,
            loading: false,
          }));
        } else {
          throw new Error('No se pudieron cargar los reportes');
        }
      } catch (error) {
        console.error('Error al cargar reportes:', error);
        update((state) => ({
          ...state,
          loading: false,
          error: 'Error al cargar los reportes',
        }));
      }
    },

    /**
     * Cambia el estado de un reporte y registra el avance
     */
    cambiarEstadoReporte: (
      reporteId: string,
      nuevoEstado: EstadoReporte,
      descripcion: string,
      autor: string,
      porcentaje: number,
      evidencias: EvidenciaReporte[] = []
    ) => {
      update((state) => {
        const reporteIndex = state.reportes.findIndex((r) => r.id === reporteId);
        if (reporteIndex === -1) return state;

        const reporte = state.reportes[reporteIndex];
        const estadoAnterior = reporte.estado;

        const nuevoAvance: RegistroAvanceReporte = {
          id: generateAvanceId(),
          reporte_id: reporteId,
          fecha: new Date().toISOString(),
          autor,
          descripcion,
          estado_anterior: estadoAnterior,
          estado_nuevo: nuevoEstado,
          porcentaje,
          evidencias,
        };

        const reporteActualizado: ReporteConSeguimiento = {
          ...reporte,
          estado: nuevoEstado,
          porcentaje_avance: porcentaje,
          historial: [...reporte.historial, nuevoAvance],
          updated_at: new Date().toISOString(),
        };

        const nuevosReportes = [...state.reportes];
        nuevosReportes[reporteIndex] = reporteActualizado;

        return {
          ...state,
          reportes: nuevosReportes,
        };
      });
    },

    /**
     * Asigna un encargado a un reporte
     */
    asignarEncargado: (reporteId: string, encargado: string) => {
      update((state) => {
        const reporteIndex = state.reportes.findIndex((r) => r.id === reporteId);
        if (reporteIndex === -1) return state;

        const reporteActualizado = {
          ...state.reportes[reporteIndex],
          encargado,
          updated_at: new Date().toISOString(),
        };

        const nuevosReportes = [...state.reportes];
        nuevosReportes[reporteIndex] = reporteActualizado;

        return {
          ...state,
          reportes: nuevosReportes,
        };
      });
    },

    /**
     * Cambia la prioridad de un reporte
     */
    cambiarPrioridad: (reporteId: string, prioridad: PrioridadReporte) => {
      update((state) => {
        const reporteIndex = state.reportes.findIndex((r) => r.id === reporteId);
        if (reporteIndex === -1) return state;

        const reporteActualizado = {
          ...state.reportes[reporteIndex],
          prioridad,
          updated_at: new Date().toISOString(),
        };

        const nuevosReportes = [...state.reportes];
        nuevosReportes[reporteIndex] = reporteActualizado;

        return {
          ...state,
          reportes: nuevosReportes,
        };
      });
    },

    /**
     * Asigna un centro gestor a un reporte
     */
    asignarCentroGestor: (reporteId: string, centroGestor: string) => {
      update((state) => {
        const reporteIndex = state.reportes.findIndex((r) => r.id === reporteId);
        if (reporteIndex === -1) return state;

        const reporteActualizado = {
          ...state.reportes[reporteIndex],
          centro_gestor: centroGestor,
          updated_at: new Date().toISOString(),
        };

        const nuevosReportes = [...state.reportes];
        nuevosReportes[reporteIndex] = reporteActualizado;

        return {
          ...state,
          reportes: nuevosReportes,
        };
      });
    },

    /**
     * Limpia el estado
     */
    reset: () => {
      set(initialState);
    },
  };
}

export const reportesStore = createReportesStore();

/* ============================================================
 *  DERIVED STORES
 * ============================================================ */

/**
 * Reportes agrupados por estado (para vista Kanban)
 */
export const reportesPorEstado = derived(reportesStore, ($store) => {
  const grouped: Record<EstadoReporte, ReporteConSeguimiento[]> = {
    notificado: [],
    radicado: [],
    'en-gestion': [],
    asignado: [],
    'en-proceso': [],
    resuelto: [],
    cerrado: [],
  };

  for (const reporte of $store.reportes) {
    grouped[reporte.estado].push(reporte);
  }

  return grouped;
});

/**
 * Reportes activos (no cerrados)
 */
export const reportesActivos = derived(reportesStore, ($store) =>
  $store.reportes.filter((r) => r.estado !== 'cerrado')
);

/**
 * Estadísticas de reportes
 */
export const estadisticasReportes = derived(reportesStore, ($store) => {
  const total = $store.reportes.length;
  const porEstado = {
    notificado: 0,
    radicado: 0,
    'en-gestion': 0,
    asignado: 0,
    'en-proceso': 0,
    resuelto: 0,
    cerrado: 0,
  };

  const porPrioridad = {
    baja: 0,
    media: 0,
    alta: 0,
    urgente: 0,
  };

  let avancePromedio = 0;

  for (const reporte of $store.reportes) {
    porEstado[reporte.estado]++;
    porPrioridad[reporte.prioridad]++;
    avancePromedio += reporte.porcentaje_avance;
  }

  avancePromedio = total > 0 ? Math.round(avancePromedio / total) : 0;

  return {
    total,
    porEstado,
    porPrioridad,
    avancePromedio,
  };
});
