/**
 * Tipos para el módulo de Seguimiento de Reportes/Reconocimientos
 * Inspirado en el sistema de seguimiento de requerimientos
 */

import type { Reporte } from './visitas';

/* ============================================================
 *  ESTADOS DE REPORTES
 * ============================================================ */
export type EstadoReporte =
  | 'notificado'
  | 'asignado'
  | 'en-proceso'
  | 'resuelto';

export type PrioridadReporte = 'baja' | 'media' | 'alta' | 'urgente';

/* ============================================================
 *  REPORTE CON SEGUIMIENTO
 * ============================================================ */
export interface ReporteConSeguimiento extends Reporte {
  estado: EstadoReporte;
  prioridad: PrioridadReporte;
  porcentaje_avance: number;
  encargado?: string;
  centro_gestor?: string;
  historial: RegistroAvanceReporte[];
  updated_at: string;
}

/* ============================================================
 *  HISTORIAL DE AVANCES
 * ============================================================ */
export interface RegistroAvanceReporte {
  id: string;
  reporte_id: string;
  fecha: string;
  autor: string;
  descripcion: string;
  estado_anterior: EstadoReporte;
  estado_nuevo: EstadoReporte;
  porcentaje: number;
  evidencias: EvidenciaReporte[];
}

export interface EvidenciaReporte {
  tipo: 'foto' | 'documento';
  url: string;
  descripcion: string;
}

/* ============================================================
 *  COLUMNAS KANBAN
 * ============================================================ */
export interface KanbanColumnReporte {
  id: EstadoReporte;
  title: string;
  color: string;
  icon: string;
}

export const KANBAN_COLUMNS_REPORTES: KanbanColumnReporte[] = [
  { id: 'notificado', title: 'Notificados', color: '#6b7280', icon: '🔔' },
  { id: 'asignado', title: 'Asignados', color: '#8b5cf6', icon: '👤' },
  { id: 'en-proceso', title: 'En Proceso', color: '#ec4899', icon: '🔄' },
  { id: 'resuelto', title: 'Resueltos', color: '#10b981', icon: '✅' },
];

/* ============================================================
 *  FUNCIONES DE UTILIDAD
 * ============================================================ */
export function getPrioridadColor(prioridad: PrioridadReporte): string {
  switch (prioridad) {
    case 'baja':
      return '#10b981';
    case 'media':
      return '#f59e0b';
    case 'alta':
      return '#ef4444';
    case 'urgente':
      return '#dc2626';
    default:
      return '#94a3b8';
  }
}

export function getEstadoColor(estado: EstadoReporte): string {
  const column = KANBAN_COLUMNS_REPORTES.find((col) => col.id === estado);
  return column?.color || '#94a3b8';
}

export function generateReporteId(): string {
  return `rep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateAvanceId(): string {
  return `avance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
