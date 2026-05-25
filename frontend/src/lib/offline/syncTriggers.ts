// Triggers de sincronización para la cola offline.
// Importante: en iOS Safari NO existe Background Sync. Usamos múltiples
// disparadores en el hilo principal para cubrir todos los escenarios.
import { flushQueue, refreshPendingCount } from './offlineQueue';

let _started = false;
let _pollTimer: ReturnType<typeof setInterval> | null = null;

const POLL_MS = 30_000;

// Module-level handler references so they can be removed in stopOfflineSync()
const _onOnline = () => { void flushQueue(); };
const _onVisibilityChange = () => {
  if (document.visibilityState === 'visible' && navigator.onLine) {
    void flushQueue();
  }
};
const _onFocus = () => { if (navigator.onLine) void flushQueue(); };
const _onPageShow = () => { if (navigator.onLine) void flushQueue(); };
const _onBeforeUnload = (e: BeforeUnloadEvent) => {
  if ((window as any).__dagmaPendingCount > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
};
let _swMessageHandler: ((event: MessageEvent) => void) | null = null;

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
  window.addEventListener('online', _onOnline);

  // 3) La pestaña vuelve a ser visible (clave en iOS donde el bfcache puede congelar la app)
  document.addEventListener('visibilitychange', _onVisibilityChange);

  // 4) Foco — refuerza el caso anterior en escritorio
  window.addEventListener('focus', _onFocus);

  // 5) pageshow — dispara incluso desde bfcache (iOS Safari)
  window.addEventListener('pageshow', _onPageShow);

  // 6) Polling cuando hay pendientes
  startPolling();

  // 7) Mensajes del SW (sync event o flush manual)
  if ('serviceWorker' in navigator) {
    _swMessageHandler = (event: MessageEvent) => {
      if (event.data?.type === 'DAGMA_FLUSH_QUEUE') {
        void flushQueue();
      }
    };
    navigator.serviceWorker.addEventListener('message', _swMessageHandler);
  }

  // 8) beforeunload: avisar si hay pendientes
  window.addEventListener('beforeunload', _onBeforeUnload);
}

export function stopOfflineSync() {
  stopPolling();
  window.removeEventListener('online', _onOnline);
  document.removeEventListener('visibilitychange', _onVisibilityChange);
  window.removeEventListener('focus', _onFocus);
  window.removeEventListener('pageshow', _onPageShow);
  window.removeEventListener('beforeunload', _onBeforeUnload);
  if (_swMessageHandler && 'serviceWorker' in navigator) {
    navigator.serviceWorker.removeEventListener('message', _swMessageHandler);
    _swMessageHandler = null;
  }
  _started = false;
}
