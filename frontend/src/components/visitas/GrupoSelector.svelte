<script lang="ts">
  import {
    GRUPO_KEYS,
    GRUPO_DISPLAY_NAMES,
    GRUPO_DESCRIPTIONS,
    type GrupoKey,
  } from "../../lib/grupos";
  import Button from "../ui/Button.svelte";

  export let onSelect: (grupo: GrupoKey) => void;
  export let onCancel: () => void;

  let selected: GrupoKey | null = null;

  function handleConfirm() {
    if (selected) onSelect(selected);
  }

  // SVG icons per group (inline, 32×32 viewBox, stroke-based matching the app's design system)
  const GRUPO_ICONS: Record<GrupoKey, string> = {
    cuadrilla: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2C10 2 8 4 8 7c0 2 1 3.5 2.5 4.3C8 12.2 6 14.8 6 18h12c0-3.2-2-5.8-4.5-6.7C15 10.5 16 9 16 7c0-3-2-5-4-5z"/>
      <line x1="12" y1="11.3" x2="12" y2="12.3"/>
    </svg>`,
    vivero: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22V12"/>
      <path d="M12 12C12 12 7 9 7 5a5 5 0 0 1 10 0c0 4-5 7-5 7z"/>
      <path d="M12 16c0 0-3-2-5-1"/>
      <path d="M12 19c0 0 3-2 5-1"/>
    </svg>`,
    gobernanza: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="9" cy="7" r="3"/>
      <circle cx="17" cy="7" r="3"/>
      <path d="M3 19c0-3.3 2.7-6 6-6h6c3.3 0 6 2.7 6 6"/>
    </svg>`,
    ecosistemas: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 22c0 0 4-8 10-8s10 8 10 8"/>
      <path d="M12 14c0 0 0-6 5-10"/>
      <path d="M12 14c0 0 0-4-4-7"/>
    </svg>`,
    umata: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9l4-4 4 4 4-4 4 4"/>
      <path d="M5 20h14a2 2 0 0 0 2-2v-7H3v7a2 2 0 0 0 2 2z"/>
      <circle cx="9" cy="16" r="1.5"/>
      <circle cx="15" cy="16" r="1.5"/>
    </svg>`,
  };
</script>

<div class="selector-container">
  <div class="selector-header">
    <button class="back-btn" on:click={onCancel} aria-label="Cancelar">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
    <h1 class="header-title">Nuevo Reporte</h1>
  </div>

  <div class="selector-body">
    <div class="section-label">Selecciona el grupo operativo</div>

    <div class="grupos-grid">
      {#each GRUPO_KEYS as key}
        <button
          type="button"
          class="grupo-card"
          class:selected={selected === key}
          on:click={() => (selected = key)}
        >
          <div class="grupo-icon" class:icon-selected={selected === key}>
            {@html GRUPO_ICONS[key]}
          </div>
          <div class="grupo-info">
            <span class="grupo-name">{GRUPO_DISPLAY_NAMES[key]}</span>
            <span class="grupo-desc">{GRUPO_DESCRIPTIONS[key]}</span>
          </div>
          <div class="check-circle" class:visible={selected === key}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        </button>
      {/each}
    </div>

    <div class="footer-action">
      <Button
        variant="primary"
        size="lg"
        fullWidth={true}
        disabled={!selected}
        onClick={handleConfirm}
      >
        Continuar
      </Button>
    </div>
  </div>
</div>

<style>
  .selector-container {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background: #f9fafb;
  }

  /* Header */
  .selector-header {
    background: white;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #f3f4f6;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 56px;
  }

  .back-btn {
    background: transparent;
    border: none;
    color: #4b5563;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }

  .back-btn:hover {
    background: #f3f4f6;
  }

  .header-title {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  /* Body */
  .selector-body {
    flex: 1;
    padding: 1.5rem 1rem 2rem;
    max-width: 560px;
    margin: 0 auto;
    width: 100%;
  }

  .section-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 0.875rem;
  }

  /* Group cards */
  .grupos-grid {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    margin-bottom: 2rem;
  }

  .grupo-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: white;
    border: 1.5px solid #e5e7eb;
    border-radius: 12px;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
    text-align: left;
    width: 100%;
    -webkit-tap-highlight-color: transparent;
    position: relative;
  }

  .grupo-card:hover {
    border-color: #a7f3d0;
    box-shadow: 0 1px 6px rgba(5, 150, 105, 0.08);
  }

  .grupo-card.selected {
    border-color: #059669;
    background: #f0fdf4;
    box-shadow: 0 0 0 1px rgba(5, 150, 105, 0.15);
  }

  /* Icon */
  .grupo-icon {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    background: #f3f4f6;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6b7280;
    flex-shrink: 0;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .grupo-icon.icon-selected {
    background: #dcfce7;
    color: #059669;
  }

  /* Info */
  .grupo-info {
    flex: 1;
    min-width: 0;
  }

  .grupo-name {
    display: block;
    font-size: 0.9375rem;
    font-weight: 600;
    color: #111827;
    margin-bottom: 0.2rem;
  }

  .grupo-desc {
    display: block;
    font-size: 0.8125rem;
    color: #6b7280;
    line-height: 1.4;
  }

  /* Check indicator */
  .check-circle {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #059669;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    opacity: 0;
    transform: scale(0.7);
    transition: opacity 0.15s ease, transform 0.15s ease;
  }

  .check-circle.visible {
    opacity: 1;
    transform: scale(1);
  }

  /* Footer */
  .footer-action {
    position: sticky;
    bottom: 1.5rem;
  }
</style>
