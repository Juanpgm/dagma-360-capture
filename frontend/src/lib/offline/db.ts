// IndexedDB schema y acceso de bajo nivel para la cola offline de DAGMA 360.
// Usa `idb` (Promise-based wrapper sobre IndexedDB).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export const DB_NAME = 'dagma360-offline';
export const DB_VERSION = 1;

/**
 * Tipos de items en la cola.
 * - 'reporte_intervencion': POST multipart con fotos a /grupos/{key}/reporte_intervencion
 * - 'json_post': POST con body JSON (asistencias, asignaciones, etc.)
 */
export type QueueKind = 'reporte_intervencion' | 'json_post';

export interface QueuedReporte {
  id: string;
  kind: 'reporte_intervencion';
  grupoKey: string;
  /** Campos de formulario serializables (todo excepto los Blobs de fotos) */
  fields: Record<string, string | number>;
  /** IDs en el store `fotos` que corresponden a este reporte */
  fotoIds: string[];
  createdAt: number;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'syncing' | 'failed';
}

export interface QueuedJsonAction {
  id: string;
  kind: 'json_post';
  endpoint: string;             // path relativo, ej. '/asistencia_actividades'
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  payload: unknown;
  /** Si requiere Bearer token de Firebase */
  requiresAuth: boolean;
  createdAt: number;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'syncing' | 'failed';
}

export type QueuedItem = QueuedReporte | QueuedJsonAction;

export interface StoredFoto {
  id: string;
  reporteId: string;
  blob: Blob;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: number;
}

interface DagmaOfflineDB extends DBSchema {
  queue: {
    key: string;
    value: QueuedItem;
    indexes: { 'by-status': string; 'by-createdAt': number };
  };
  fotos: {
    key: string;
    value: StoredFoto;
    indexes: { 'by-reporteId': string };
  };
}

let _dbPromise: Promise<IDBPDatabase<DagmaOfflineDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<DagmaOfflineDB>> {
  if (!_dbPromise) {
    _dbPromise = openDB<DagmaOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const queue = db.createObjectStore('queue', { keyPath: 'id' });
        queue.createIndex('by-status', 'status');
        queue.createIndex('by-createdAt', 'createdAt');

        const fotos = db.createObjectStore('fotos', { keyPath: 'id' });
        fotos.createIndex('by-reporteId', 'reporteId');
      },
    });
  }
  return _dbPromise;
}

export function newId(): string {
  // crypto.randomUUID disponible en navegadores modernos; fallback random
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}
