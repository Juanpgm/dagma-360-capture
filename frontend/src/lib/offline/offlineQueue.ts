// Cola offline: enqueue + flush con reintentos y backoff exponencial.
// Expone un store Svelte reactivo con el número de pendientes.
import { writable, type Readable } from 'svelte/store';
import { auth } from '../firebase';
import { authStore } from '../../stores/authStore';
import { get } from 'svelte/store';
import {
  getDB,
  newId,
  type QueuedItem,
  type QueuedReporte,
  type QueuedJsonAction,
  type StoredFoto,
} from './db';
import { requestPersistentStorage } from './platform';

const MAX_ATTEMPTS = 6;
/** Backoff exponencial en ms: 5s, 15s, 45s, 2min, 6min, 18min */
const BACKOFF_MS = [5_000, 15_000, 45_000, 120_000, 360_000, 1_080_000];

// ── Store reactivo ──
const _pendingCount = writable<number>(0);
const _isSyncing   = writable<boolean>(false);
const _lastError   = writable<string | null>(null);

export const pendingCount: Readable<number>     = { subscribe: _pendingCount.subscribe };
export const isSyncing:   Readable<boolean>     = { subscribe: _isSyncing.subscribe };
export const lastSyncError: Readable<string | null> = { subscribe: _lastError.subscribe };

export async function refreshPendingCount(): Promise<number> {
  const db = await getDB();
  const count = await db.count('queue');
  _pendingCount.set(count);
  // Expone globalmente para listeners no-Svelte (beforeunload, etc.)
  if (typeof window !== 'undefined') (window as any).__dagmaPendingCount = count;
  return count;
}

// ── Auth helper ──
async function getAuthToken(): Promise<string | null> {
  try {
    if (auth?.currentUser) {
      const t = await auth.currentUser.getIdToken();
      if (t) return t;
    }
  } catch {/* ignore */}
  const s = get(authStore);
  if (s?.token) return s.token;
  return sessionStorage.getItem('authToken');
}

function buildApiUrl(endpoint: string): string {
  // Reproduce lo que hacen los clientes de API existentes (proxy Vite + Vercel).
  if (endpoint.startsWith('http')) return endpoint;
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api';
  if (endpoint.startsWith('/')) return apiBase + endpoint;
  return apiBase + '/' + endpoint;
}

// ── Enqueue: reporte de intervencion ──
export interface EnqueueReporteInput {
  grupoKey: string;
  fields: Record<string, string | number>;
  fotos: File[];
}

export async function enqueueReporte(input: EnqueueReporteInput): Promise<string> {
  const db = await getDB();
  const reporteId = newId();
  const tx = db.transaction(['queue', 'fotos'], 'readwrite');

  const fotoIds: string[] = [];
  for (const file of input.fotos) {
    if (!(file instanceof File) || file.size === 0) continue;
    const fotoId = newId();
    const stored: StoredFoto = {
      id: fotoId,
      reporteId,
      blob: file,                       // Guardamos el Blob original
      filename: file.name || `foto_${fotoIds.length}.jpg`,
      mimeType: file.type || 'image/jpeg',
      size: file.size,
      createdAt: Date.now(),
    };
    await tx.objectStore('fotos').add(stored);
    fotoIds.push(fotoId);
  }

  const item: QueuedReporte = {
    id: reporteId,
    kind: 'reporte_intervencion',
    grupoKey: input.grupoKey,
    fields: input.fields,
    fotoIds,
    createdAt: Date.now(),
    attempts: 0,
    status: 'pending',
  };
  await tx.objectStore('queue').add(item);
  try {
    await tx.done;
  } catch (txErr) {
    console.error('[offlineQueue] Error guardando reporte en IndexedDB:', txErr);
    throw new Error('No se pudo encolar el reporte offline. Verifique el almacenamiento del dispositivo.');
  }

  await requestPersistentStorage();
  await refreshPendingCount();
  void registerBackgroundSync();
  return reporteId;
}

// ── Enqueue: acción JSON genérica ──
export async function enqueueJsonAction(input: {
  endpoint: string;
  method?: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  payload: unknown;
  requiresAuth?: boolean;
}): Promise<string> {
  const db = await getDB();
  const id = newId();
  const item: QueuedJsonAction = {
    id,
    kind: 'json_post',
    endpoint: input.endpoint,
    method: input.method ?? 'POST',
    payload: input.payload,
    requiresAuth: input.requiresAuth ?? true,
    createdAt: Date.now(),
    attempts: 0,
    status: 'pending',
  };
  await db.add('queue', item);
  await requestPersistentStorage();
  await refreshPendingCount();
  void registerBackgroundSync();
  return id;
}

// ── Background Sync (Chrome Android) ──
async function registerBackgroundSync() {
  try {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
    const reg = await navigator.serviceWorker.ready;
    // @ts-ignore — sync no está en los tipos estándar
    if (reg.sync && typeof reg.sync.register === 'function') {
      // @ts-ignore
      await reg.sync.register('dagma-sync');
    }
  } catch {/* ignore */}
}

// ── Flush con reintentos ──
let _flushing = false;
let _retryTimer: ReturnType<typeof setTimeout> | null = null;

export async function flushQueue(options?: { force?: boolean }): Promise<{ ok: number; failed: number; remaining: number }> {
  if (_flushing) return { ok: 0, failed: 0, remaining: await refreshPendingCount() };
  if (!navigator.onLine && !options?.force) {
    await refreshPendingCount();
    return { ok: 0, failed: 0, remaining: get(_pendingCount) };
  }

  _flushing = true;
  _isSyncing.set(true);
  _lastError.set(null);
  let ok = 0;
  let failed = 0;

  try {
    const db = await getDB();
    const items = await db.getAll('queue');
    // Ordenar por createdAt asc
    items.sort((a, b) => a.createdAt - b.createdAt);

    for (const item of items) {
      // Si tiene attempts y aún no toca reintentar (backoff), saltar
      const now = Date.now();
      const wait = BACKOFF_MS[Math.min(item.attempts, BACKOFF_MS.length - 1)];
      const earliest = item.createdAt + (item.attempts > 0 ? wait : 0);
      if (!options?.force && item.attempts > 0 && now < (item as any)._nextAttemptAt) continue;
      if (!options?.force && item.attempts > 0 && earliest > now && (item as any)._nextAttemptAt === undefined) continue;

      try {
        await markItem(item.id, { status: 'syncing' });
        if (item.kind === 'reporte_intervencion') {
          await sendReporte(item);
        } else {
          await sendJsonAction(item);
        }
        await removeItem(item.id);
        ok++;
      } catch (err: any) {
        failed++;
        const message = err?.message ?? String(err);
        const nextAttempts = item.attempts + 1;
        if (nextAttempts >= MAX_ATTEMPTS) {
          await markItem(item.id, { status: 'failed', attempts: nextAttempts, lastError: message });
        } else {
          await markItem(item.id, {
            status: 'pending',
            attempts: nextAttempts,
            lastError: message,
            _nextAttemptAt: Date.now() + BACKOFF_MS[Math.min(nextAttempts, BACKOFF_MS.length - 1)],
          } as any);
        }
        _lastError.set(message);
      }
    }
  } finally {
    const remaining = await refreshPendingCount();
    _flushing = false;
    _isSyncing.set(false);
    // Si quedan pendientes, programar reintento
    if (remaining > 0 && navigator.onLine) {
      scheduleNextRetry();
    }
    return { ok, failed, remaining };
  }
}

async function markItem(id: string, patch: Partial<QueuedItem> & { _nextAttemptAt?: number }) {
  const db = await getDB();
  const tx = db.transaction('queue', 'readwrite');
  const current = await tx.store.get(id);
  if (current) {
    await tx.store.put({ ...(current as any), ...patch });
  }
  await tx.done;
}

async function removeItem(id: string) {
  const db = await getDB();
  const tx = db.transaction(['queue', 'fotos'], 'readwrite');
  const item = await tx.objectStore('queue').get(id);
  if (item && item.kind === 'reporte_intervencion') {
    for (const fotoId of item.fotoIds) {
      await tx.objectStore('fotos').delete(fotoId);
    }
  }
  await tx.objectStore('queue').delete(id);
  await tx.done;
}

export async function discardItem(id: string): Promise<void> {
  await removeItem(id);
  await refreshPendingCount();
}

export async function listQueue(): Promise<QueuedItem[]> {
  const db = await getDB();
  const all = await db.getAll('queue');
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getFotoBlob(fotoId: string): Promise<Blob | null> {
  const db = await getDB();
  const foto = await db.get('fotos', fotoId);
  return foto?.blob ?? null;
}

// ── Senders ──
async function sendReporte(item: QueuedReporte): Promise<void> {
  const db = await getDB();
  const fotos: StoredFoto[] = [];
  for (const fotoId of item.fotoIds) {
    const f = await db.get('fotos', fotoId);
    if (f) fotos.push(f);
  }
  if (fotos.length === 0) {
    throw new Error('No hay fotos asociadas al reporte pendiente');
  }

  const formData = new FormData();
  for (const [k, v] of Object.entries(item.fields)) {
    formData.append(k, String(v));
  }
  // Workaround Pydantic v2 / python-multipart: duplicar foto si hay solo una
  const files = fotos.length === 1 ? [fotos[0], fotos[0]] : fotos;
  files.forEach((foto, idx) => {
    formData.append('photos', foto.blob, foto.filename || `foto_${idx}.jpg`);
  });

  const token = await getAuthToken();
  const url = buildApiUrl(`/grupos/${item.grupoKey}/reporte_intervencion`);
  const response = await fetch(url, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  const result = await response.json().catch(() => ({}));
  if (result && result.success === false) {
    throw new Error(result.message || 'Backend rechazó el reporte');
  }
}

async function sendJsonAction(item: QueuedJsonAction): Promise<void> {
  const token = item.requiresAuth ? await getAuthToken() : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = buildApiUrl(item.endpoint);
  const response = await fetch(url, {
    method: item.method,
    headers,
    body: JSON.stringify(item.payload ?? {}),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
}

function scheduleNextRetry() {
  if (_retryTimer) clearTimeout(_retryTimer);
  _retryTimer = setTimeout(() => {
    void flushQueue();
  }, 30_000);
}
