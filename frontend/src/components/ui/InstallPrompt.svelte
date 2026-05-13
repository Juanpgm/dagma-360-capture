<script lang="ts">
  import { onMount } from 'svelte';
  import { isIOS, isStandalone } from '../../lib/offline/platform';

  let deferredPrompt: any = null;
  let showAndroidPrompt = false;
  let showIosHint = false;
  let dismissed = false;

  function loadDismissed(): boolean {
    try { return localStorage.getItem('dagma-install-dismissed') === '1'; }
    catch { return false; }
  }
  function saveDismissed() {
    try { localStorage.setItem('dagma-install-dismissed', '1'); } catch {/* ignore */}
  }

  onMount(() => {
    if (isStandalone()) return;
    dismissed = loadDismissed();
    if (dismissed) return;

    if (isIOS()) {
      // Mostrar hint manual después de un pequeño delay
      setTimeout(() => { showIosHint = true; }, 1500);
      return;
    }

    const handler = (e: any) => {
      e.preventDefault();
      deferredPrompt = e;
      showAndroidPrompt = true;
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      showAndroidPrompt = false;
      showIosHint = false;
      deferredPrompt = null;
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  });

  async function installAndroid() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch {/* ignore */}
    deferredPrompt = null;
    showAndroidPrompt = false;
  }

  function dismiss() {
    showAndroidPrompt = false;
    showIosHint = false;
    dismissed = true;
    saveDismissed();
  }
</script>

{#if showAndroidPrompt}
  <div class="install-banner" role="dialog" aria-label="Instalar aplicación">
    <div class="install-text">
      <strong>Instalar DAGMA 360</strong>
      <span>Acceso rápido desde tu pantalla de inicio · funciona sin conexión</span>
    </div>
    <div class="install-actions">
      <button class="btn-primary" on:click={installAndroid}>Instalar</button>
      <button class="btn-ghost" on:click={dismiss} aria-label="Cerrar">✕</button>
    </div>
  </div>
{/if}

{#if showIosHint}
  <div class="install-banner" role="dialog" aria-label="Cómo instalar en iPhone">
    <div class="install-text">
      <strong>Añadir DAGMA 360 a tu iPhone</strong>
      <span>
        Toca <span class="icon-share">⬆️</span> <em>Compartir</em> y elige
        <em>«Añadir a pantalla de inicio»</em>.
      </span>
    </div>
    <button class="btn-ghost" on:click={dismiss} aria-label="Cerrar">✕</button>
  </div>
{/if}

<style>
  .install-banner {
    position: fixed;
    bottom: 16px;
    left: 16px;
    right: 16px;
    max-width: 480px;
    margin: 0 auto;
    background: #059669;
    color: white;
    padding: 14px 16px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 9999;
    font-family: 'Inter', sans-serif;
  }
  .install-text { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .install-text strong { font-size: 0.95rem; }
  .install-text span { font-size: 0.85rem; opacity: 0.92; }
  .install-text em { font-style: normal; font-weight: 600; }
  .install-actions { display: flex; gap: 6px; align-items: center; }
  .btn-primary {
    background: white; color: #047857; border: none;
    padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer;
  }
  .btn-primary:hover { background: #f0fdf4; }
  .btn-ghost {
    background: transparent; color: white; border: none;
    padding: 6px 10px; cursor: pointer; font-size: 1rem; opacity: 0.85;
  }
  .btn-ghost:hover { opacity: 1; }
  .icon-share { font-size: 1rem; }
</style>
