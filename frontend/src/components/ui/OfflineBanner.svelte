<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { pendingCount, isSyncing, flushQueue } from '../../lib/offline/offlineQueue';

  let online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  let showUpdate = false;

  function setOnline() { online = true; }
  function setOffline() { online = false; }

  function onUpdate() { showUpdate = true; }
  function applyUpdate() {
    const fn = (window as any).__dagmaUpdateSW;
    if (typeof fn === 'function') fn(true);
  }

  onMount(() => {
    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);
    window.addEventListener('dagma:sw-update-available', onUpdate);
  });
  onDestroy(() => {
    window.removeEventListener('online', setOnline);
    window.removeEventListener('offline', setOffline);
    window.removeEventListener('dagma:sw-update-available', onUpdate);
  });

  async function syncNow() {
    await flushQueue({ force: true });
  }
</script>

{#if !online}
  <div class="banner banner-offline" role="status">
    <span class="dot"></span>
    <span>Sin conexión · tus capturas se guardarán y se enviarán al volver en línea</span>
  </div>
{:else if $pendingCount > 0}
  <div class="banner banner-pending" role="status">
    <span>
      📤 {$pendingCount} {$pendingCount === 1 ? 'captura pendiente' : 'capturas pendientes'} de sincronizar
    </span>
    <button on:click={syncNow} disabled={$isSyncing}>
      {$isSyncing ? 'Sincronizando…' : 'Sincronizar ahora'}
    </button>
  </div>
{/if}

{#if showUpdate}
  <div class="banner banner-update" role="status">
    <span>🔄 Nueva versión disponible</span>
    <button on:click={applyUpdate}>Actualizar</button>
  </div>
{/if}

<style>
  .banner {
    position: fixed;
    top: 0; left: 0; right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 10px 16px;
    font-family: 'Inter', sans-serif;
    font-size: 0.88rem;
    z-index: 9998;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  }
  .banner-offline { background: #b91c1c; color: white; }
  .banner-pending { background: #f59e0b; color: #1f2937; }
  .banner-update  { background: #2563eb; color: white; }

  .banner button {
    background: rgba(255, 255, 255, 0.95);
    color: #1f2937;
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
  }
  .banner button:disabled { opacity: 0.6; cursor: not-allowed; }
  .dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: white; box-shadow: 0 0 0 4px rgba(255,255,255,0.25);
    animation: pulse 1.5s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
</style>
