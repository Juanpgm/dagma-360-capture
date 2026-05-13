import './app.css';
import App from './App.svelte';
import { registerSW } from 'virtual:pwa-register';
import { startOfflineSync } from './lib/offline/syncTriggers';
import { requestPersistentStorage } from './lib/offline/platform';

// Expone una función a la UI para forzar el "update now" cuando se detecte una nueva versión.
const updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('dagma:sw-update-available'));
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('dagma:sw-offline-ready'));
  },
  onRegisteredSW(_swUrl, registration) {
    // Periodic check de updates cada 30 min mientras la app esté abierta
    if (registration) {
      setInterval(() => registration.update().catch(() => undefined), 30 * 60 * 1000);
    }
  },
});

(window as any).__dagmaUpdateSW = updateSW;

// Arranca triggers de sincronización offline y solicita storage persistente.
startOfflineSync();
void requestPersistentStorage();

const app = new App({
  target: document.getElementById('app')!,
});

export default app;
