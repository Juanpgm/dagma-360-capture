// Triggers de sincronización para la cola offline.
// Importante: en iOS Safari NO existe Background Sync. Usamos múltiples
// disparadores en el hilo principal para cubrir todos los escenarios.
import { flushQueue, refreshPendingCount } from './offlineQueue';

let _started = false;
let _pollTimer: ReturnType<typeof setInterval> | null = null;

const POLL_MS = 30_000;

function startPolling() {
  if (_pollTimer) return;
  _pollTimer = setInterval(() => {
    if (navigator.onLine) void flushQueue();
  }, POLL_MS);
}

function stopPolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

export function startOfflineSync() {
  if (_started) return;
  _started = true;

  // 1) Refresco inicial del contador + intento de flush al cargar
  void refreshPendingCount().then((count) => {
    if (count > 0 && navigator.onLine) void flushQueue();
  });

  // 2) Vuelta de la conexión
  window.addEventListener('online', () => {
    void flushQueue();
  });

  // 3) La pestaña vuelve a ser visible (clave en iOS donde el bfcache puede congelar la app)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      void flushQueue();
    }
  });

  // 4) Foco — refuerza el caso anterior en escritorio
  window.addEventListener('focus', () => {
    if (navigator.onLine) void flushQueue();
  });

  // 5) pageshow — dispara incluso desde bfcache (iOS Safari)
  window.addEventListener('pageshow', () => {
    if (navigator.onLine) void flushQueue();
  });

  // 6) Polling cuando hay pendientes
  startPolling();

  // 7) Mensajes del SW (sync event o flush manual)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'DAGMA_FLUSH_QUEUE') {
        void flushQueue();
      }
    });
  }

  // 8) beforeunload: avisar si hay pendientes
  window.addEventListener('beforeunload', (e) => {
    // Solo si hay pendientes — leemos del store implícitamente
    // (importamos el store reactivo desde fuera para evitar ciclos)
    // Hacemos un check rápido usando una variable global expuesta por el store.
    if ((window as any).__dagmaPendingCount > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

export function stopOfflineSync() {
  stopPolling();
  _started = false;
}
