<script lang="ts">
  import { onMount } from "svelte";
  import {
    getNotificationsHealth,
    type NotificationsHealth,
  } from "../../api/notifications";

  let health: NotificationsHealth | null = null;
  let loading = true;
  let error = "";

  onMount(async () => {
    try {
      health = await getNotificationsHealth();
    } catch (e: any) {
      error = e?.message || "Error al consultar el estado.";
    } finally {
      loading = false;
    }
  });

  $: channel = health?.active_channel ?? "none";
  $: variant =
    channel === "gmail_api"
      ? "ok"
      : channel === "smtp"
        ? "warn"
        : "bad";
  $: label =
    channel === "gmail_api"
      ? "Gmail API"
      : channel === "smtp"
        ? "SMTP"
        : "Sin canal";
</script>

<div class="badge {variant}" data-testid="notif-health-badge" title={health?.sender || ""}>
  {#if loading}
    <span class="dot" />
    <span>Verificando…</span>
  {:else if error}
    <span class="dot bad" />
    <span>Sin datos</span>
  {:else}
    <span class="dot {variant}" />
    <span>{label}</span>
    {#if health?.sender}
      <span class="sender">· {health.sender}</span>
    {/if}
  {/if}
</div>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.65rem;
    border-radius: 999px;
    background: #f3f4f6;
    color: #374151;
    font-size: 0.8rem;
    border: 1px solid #e5e7eb;
    white-space: nowrap;
  }

  .badge.ok {
    background: #ecfdf5;
    color: #065f46;
    border-color: #a7f3d0;
  }

  .badge.warn {
    background: #fffbeb;
    color: #92400e;
    border-color: #fcd34d;
  }

  .badge.bad {
    background: #fef2f2;
    color: #991b1b;
    border-color: #fecaca;
  }

  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #9ca3af;
  }

  .dot.ok {
    background: #10b981;
  }
  .dot.warn {
    background: #f59e0b;
  }
  .dot.bad {
    background: #ef4444;
  }

  .sender {
    color: inherit;
    opacity: 0.85;
    font-size: 0.75rem;
  }
</style>
