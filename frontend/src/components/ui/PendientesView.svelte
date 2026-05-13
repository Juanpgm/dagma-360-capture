<script lang="ts">
  import { onMount } from 'svelte';
  import {
    pendingCount,
    isSyncing,
    flushQueue,
    listQueue,
    discardItem,
  } from '../../lib/offline/offlineQueue';
  import { exportPendingBackup } from '../../lib/offline/exportBackup';
  import type { QueuedItem } from '../../lib/offline/db';

  export let open = false;
  export let onClose: () => void = () => {};

  let items: QueuedItem[] = [];
  let loading = false;

  async function reload() {
    loading = true;
    try { items = await listQueue(); }
    finally { loading = false; }
  }

  $: if (open) reload();

  async function retryAll() {
    await flushQueue({ force: true });
    await reload();
  }

  async function discard(id: string) {
    if (!confirm('¿Descartar este registro pendiente? Esta acción no se puede deshacer.')) return;
    await discardItem(id);
    await reload();
  }

  async function exportBackup() {
    await exportPendingBackup();
  }

  function describe(item: QueuedItem): string {
    if (item.kind === 'reporte_intervencion') {
      const tipo = item.fields['tipo_intervencion'] ?? '(sin tipo)';
      return `Reporte · ${item.grupoKey} · ${tipo} · ${item.fotoIds.length} foto(s)`;
    }
    return `Acción · ${item.method} ${item.endpoint}`;
  }

  function statusBadge(item: QueuedItem): string {
    if (item.status === 'failed') return 'fallido';
    if (item.status === 'syncing') return 'enviando…';
    if (item.attempts > 0) return `reintentando (${item.attempts})`;
    return 'pendiente';
  }
</script>

{#if open}
  <div class="overlay" role="dialog" aria-modal="true" on:click={onClose}>
    <div class="panel" on:click|stopPropagation>
      <header>
        <h2>Capturas pendientes</h2>
        <button class="close" on:click={onClose} aria-label="Cerrar">✕</button>
      </header>

      <div class="summary">
        <span>{$pendingCount} en cola</span>
        <div class="actions">
          <button class="btn-primary" on:click={retryAll} disabled={$isSyncing || $pendingCount === 0}>
            {$isSyncing ? 'Sincronizando…' : 'Reintentar todos'}
          </button>
          <button class="btn-secondary" on:click={exportBackup} disabled={$pendingCount === 0}>
            Exportar respaldo
          </button>
        </div>
      </div>

      {#if loading}
        <p class="empty">Cargando…</p>
      {:else if items.length === 0}
        <p class="empty">No hay capturas pendientes 🎉</p>
      {:else}
        <ul>
          {#each items as item (item.id)}
            <li class="item" class:failed={item.status === 'failed'}>
              <div class="item-main">
                <div class="item-title">{describe(item)}</div>
                <div class="item-meta">
                  <span class="badge badge-{item.status}">{statusBadge(item)}</span>
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                {#if item.lastError}
                  <div class="error">{item.lastError}</div>
                {/if}
              </div>
              <button class="btn-ghost" on:click={() => discard(item.id)} aria-label="Descartar">
                🗑
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed; inset: 0;
    background: rgba(15, 23, 42, 0.55);
    display: flex; align-items: flex-end; justify-content: center;
    z-index: 10000;
    font-family: 'Inter', sans-serif;
  }
  .panel {
    background: white;
    width: 100%;
    max-width: 600px;
    max-height: 85vh;
    border-radius: 16px 16px 0 0;
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  @media (min-width: 640px) {
    .overlay { align-items: center; }
    .panel { border-radius: 16px; }
  }
  header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 16px 20px; border-bottom: 1px solid #e5e7eb;
  }
  header h2 { margin: 0; font-size: 1.1rem; color: #047857; }
  .close { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #6b7280; }
  .summary {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 20px; background: #f9fafb;
  }
  .summary .actions { display: flex; gap: 8px; }
  .btn-primary {
    background: #059669; color: white; border: none;
    padding: 8px 14px; border-radius: 8px; font-weight: 600; cursor: pointer;
  }
  .btn-primary:hover:not(:disabled) { background: #047857; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary {
    background: white; color: #059669; border: 1px solid #059669;
    padding: 8px 14px; border-radius: 8px; font-weight: 600; cursor: pointer;
  }
  .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
  ul { list-style: none; padding: 0; margin: 0; overflow-y: auto; }
  .item {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 14px 20px; border-bottom: 1px solid #f3f4f6;
  }
  .item.failed { background: #fef2f2; }
  .item-main { flex: 1; min-width: 0; }
  .item-title { font-weight: 500; color: #1f2937; font-size: 0.95rem; }
  .item-meta {
    display: flex; gap: 10px; align-items: center;
    margin-top: 4px; font-size: 0.8rem; color: #6b7280;
  }
  .badge {
    padding: 2px 8px; border-radius: 999px; font-size: 0.72rem; font-weight: 600;
  }
  .badge-pending { background: #fef3c7; color: #92400e; }
  .badge-syncing { background: #dbeafe; color: #1e40af; }
  .badge-failed  { background: #fee2e2; color: #991b1b; }
  .error {
    margin-top: 6px; font-size: 0.78rem; color: #991b1b;
    background: #fef2f2; padding: 4px 8px; border-radius: 6px;
  }
  .btn-ghost {
    background: none; border: none; font-size: 1.1rem; cursor: pointer;
    color: #9ca3af; padding: 4px 8px;
  }
  .btn-ghost:hover { color: #dc2626; }
  .empty { text-align: center; padding: 40px 20px; color: #6b7280; }
</style>
