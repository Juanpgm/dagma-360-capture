<script lang="ts">
  import { onMount } from 'svelte';
  import { pendingCount, flushQueue } from '../../lib/offline/offlineQueue';

  export let open = false;
  export let onClose: () => void = () => {};

  const appVersion = __APP_VERSION__;
  const apiUrl = import.meta.env.VITE_API_BASE_URL as string | undefined ?? '(Vercel proxy)';

  let swState: 'idle' | 'checking' | 'update-available' | 'up-to-date' = 'idle';
  let syncing = false;
  let syncResult: { ok: number; failed: number; remaining: number } | null = null;

  function close() { open = false; onClose(); }

  async function forceUpdate() {
    swState = 'checking';
    syncResult = null;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) { swState = 'up-to-date'; return; }

      await reg.update();

      const waiting = reg.waiting;
      if (waiting) {
        swState = 'update-available';
        waiting.addEventListener('statechange', () => {
          if ((waiting as ServiceWorker).state === 'activated') window.location.reload();
        });
        waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        // Puede que todavía esté descargando — esperar el evento updatefound
        swState = 'checking';
        const timeout = setTimeout(() => { swState = 'up-to-date'; }, 8000);
        reg.addEventListener('updatefound', () => {
          clearTimeout(timeout);
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed') {
              swState = 'update-available';
              newSW.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      }
    } catch (err) {
      console.error('Error forzando actualización SW:', err);
      swState = 'idle';
    }
  }

  async function syncNow() {
    syncing = true;
    syncResult = null;
    try {
      syncResult = await flushQueue({ force: true });
    } finally {
      syncing = false;
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" on:click={close}></div>
  <div class="settings-panel" role="dialog" aria-label="Configuración de la app" aria-modal="true">
    <div class="panel-header">
      <div class="panel-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        Configuración
      </div>
      <button class="btn-close" on:click={close} aria-label="Cerrar configuración">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="panel-body">

      <!-- Info de versión -->
      <section class="section">
        <h3 class="section-title">Información de la app</h3>
        <div class="info-row">
          <span class="info-label">Versión</span>
          <span class="info-value badge-version">v{appVersion}</span>
        </div>
        <div class="info-row">
          <span class="info-label">API</span>
          <span class="info-value text-mono">{apiUrl}</span>
        </div>
      </section>

      <!-- Actualización -->
      <section class="section">
        <h3 class="section-title">Actualización</h3>
        <p class="section-desc">
          Si la app muestra datos o pantallas desactualizados, usa el botón para descargar
          e instalar la versión más reciente.
        </p>
        <button class="btn-action btn-update" on:click={forceUpdate} disabled={swState === 'checking'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          {#if swState === 'checking'}Buscando actualización…
          {:else if swState === 'update-available'}Instalando…
          {:else if swState === 'up-to-date'}Ya tienes la versión más reciente
          {:else}Forzar actualización
          {/if}
        </button>
        {#if swState === 'up-to-date'}
          <p class="feedback-ok">La app ya está al día.</p>
        {:else if swState === 'update-available'}
          <p class="feedback-ok">Actualizando — la página se recargará en un momento.</p>
        {/if}
      </section>

      <!-- Sincronización offline -->
      <section class="section">
        <h3 class="section-title">Datos pendientes</h3>
        <div class="info-row">
          <span class="info-label">Reportes en cola</span>
          <span class="info-value badge-pending" class:badge-ok={$pendingCount === 0}>
            {$pendingCount}
          </span>
        </div>
        {#if $pendingCount > 0}
          <p class="section-desc">
            Hay {$pendingCount} reporte{$pendingCount > 1 ? 's' : ''} guardado{$pendingCount > 1 ? 's' : ''}
            localmente. Pulsa el botón para intentar enviarlos ahora.
          </p>
          <button class="btn-action btn-sync" on:click={syncNow} disabled={syncing}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
            {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
          {#if syncResult}
            <p class="feedback-ok">
              Enviados: {syncResult.ok} · Fallidos: {syncResult.failed} · Pendientes: {syncResult.remaining}
            </p>
          {/if}
        {:else}
          <p class="section-desc">No hay reportes pendientes de envío.</p>
        {/if}
      </section>

    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0 0 0 / 0.4);
    z-index: 900;
  }

  .settings-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(360px, 100vw);
    background: #fff;
    z-index: 901;
    display: flex;
    flex-direction: column;
    box-shadow: -4px 0 24px rgba(0 0 0 / 0.15);
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e5e7eb;
    background: #f8fafc;
    flex-shrink: 0;
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 0.95rem;
    color: #1e293b;
  }

  .btn-close {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.35rem;
    border-radius: 6px;
    color: #64748b;
    display: flex;
    align-items: center;
    transition: background 0.15s, color 0.15s;
  }
  .btn-close:hover { background: #f1f5f9; color: #1e293b; }

  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
    margin: 0;
  }

  .section-desc {
    font-size: 0.85rem;
    color: #64748b;
    margin: 0;
    line-height: 1.5;
  }

  .info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f1f5f9;
  }

  .info-label {
    font-size: 0.85rem;
    color: #475569;
  }

  .info-value {
    font-size: 0.85rem;
    color: #1e293b;
    font-weight: 500;
  }

  .text-mono {
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
    color: #64748b;
    max-width: 200px;
    word-break: break-all;
    text-align: right;
  }

  .badge-version {
    background: #ecfdf5;
    color: #059669;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 600;
    border: 1px solid #a7f3d0;
  }

  .badge-pending {
    background: #fef3c7;
    color: #92400e;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 700;
    border: 1px solid #fcd34d;
    min-width: 1.5rem;
    text-align: center;
  }

  .badge-ok {
    background: #ecfdf5;
    color: #059669;
    border-color: #a7f3d0;
  }

  .btn-action {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    border: none;
    border-radius: 8px;
    font-size: 0.88rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    width: 100%;
    justify-content: center;
  }

  .btn-action:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .btn-update {
    background: #1e3a5f;
    color: #fff;
  }
  .btn-update:hover:not(:disabled) { background: #15325a; }

  .btn-sync {
    background: #059669;
    color: #fff;
  }
  .btn-sync:hover:not(:disabled) { background: #047857; }

  .feedback-ok {
    font-size: 0.82rem;
    color: #059669;
    margin: 0;
    text-align: center;
  }
</style>
