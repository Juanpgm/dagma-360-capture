<script lang="ts">
  /**
   * ReporteEditModal — Edición completa de un reporte de intervención.
   *
   * Tab 1 — Datos generales: tipo_intervencion, descripcion_intervencion, observaciones, direccion
   * Tab 2 — Coordenadas: delega en CoordsEditorModal (Leaflet + sat)
   */
  import { createEventDispatcher } from "svelte";
  import type { ReporteIntervencion } from "../../api/visitas";
  import {
    actualizarCamposReporte,
    actualizarCoordenadas,
  } from "../../api/visitas";
  import type { GrupoKey } from "../../lib/grupos";
  import CoordsEditorModal from "../visitas/CoordsEditorModal.svelte";
  import type { Coordenadas } from "../../types/visitas";

  // ── Props ──
  export let open = false;
  export let reporte: ReporteIntervencion | null = null;

  // ── Events ──
  const dispatch = createEventDispatcher<{ updated: ReporteIntervencion; close: void }>();

  // ── State ──
  type Tab = "datos" | "coordenadas";
  let activeTab: Tab = "datos";

  // Campos editables — se inicializan cuando el modal se abre
  let tipoIntervencion = "";
  let descripcion = "";
  let observaciones = "";
  let direccion = "";

  let saving = false;
  let savingCoords = false;
  let errorMsg = "";
  let successMsg = "";

  let latInput = "";
  let lngInput = "";

  // CoordsEditorModal state
  let coordsModalOpen = false;
  let coordsActuales: Coordenadas | undefined;

  // ── Sync campos cuando cambia el reporte ──
  $: if (open && reporte) {
    tipoIntervencion = reporte.tipo_intervencion ?? "";
    descripcion = reporte.descripcion_intervencion ?? "";
    observaciones = reporte.observaciones ?? "";
    direccion = reporte.direccion ?? "";
    errorMsg = "";
    successMsg = "";
    activeTab = "datos";

    // Coordenadas actuales para CoordsEditorModal
    const cd = reporte.coordinates_data;
    if (Array.isArray(cd) && cd.length === 2) {
      coordsActuales = {
        latitude: cd[1],
        longitude: cd[0],
        accuracy: undefined,
        timestamp: Date.now(),
        source: reporte.ultima_edicion_coords ? "manual" : "gps",
        manuallyEdited: !!reporte.ultima_edicion_coords,
      };
      latInput = cd[1].toString();
      lngInput = cd[0].toString();
    } else {
      coordsActuales = undefined;
      latInput = "";
      lngInput = "";
    }
  }

  function handleClose() {
    open = false;
    coordsModalOpen = false;
    dispatch("close");
  }

  // ── Guardar campos de texto ──
  async function handleSaveDatos() {
    if (!reporte) return;
    const grupoKey = (reporte.grupo ?? "").toLowerCase() as GrupoKey;
    if (!grupoKey) {
      errorMsg = "No se puede determinar el grupo del reporte.";
      return;
    }

    saving = true;
    errorMsg = "";
    successMsg = "";

    try {
      const result = await actualizarCamposReporte(grupoKey, reporte.id, {
        tipo_intervencion: tipoIntervencion.trim() || undefined,
        descripcion_intervencion: descripcion.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
        direccion: direccion.trim() || undefined,
      });

      successMsg = "¡Reporte actualizado correctamente!";
      dispatch("updated", result.data);
      setTimeout(() => { successMsg = ""; }, 3000);
    } catch (err: any) {
      errorMsg = err?.message ?? "Error actualizando reporte.";
    } finally {
      saving = false;
    }
  }

  // ── Guardar coordenadas ──
  function handleOpenCoordsModal() {
    coordsModalOpen = true;
  }

  async function handleSaveCoordenadas(next: Coordenadas) {
    if (!reporte) return;
    const grupoKey = (reporte.grupo ?? "").toLowerCase() as GrupoKey;

    savingCoords = true;
    errorMsg = "";
    successMsg = "";

    try {
      const result = await actualizarCoordenadas(
        grupoKey,
        reporte.id,
        next.latitude,
        next.longitude
      );

      coordsActuales = next;
      successMsg = `Coordenadas actualizadas → ${next.latitude.toFixed(6)}, ${next.longitude.toFixed(6)}`;

      // Patch local del reporte para que la UI refleje el cambio
      const updatedReporte: ReporteIntervencion = {
        ...reporte,
        coordinates: result.coordinates as any,
        coordinates_data: [result.coordinates.coordinates[0], result.coordinates.coordinates[1]],
        ultima_edicion_coords: new Date().toISOString(),
        ...(result.comuna_corregimiento ? { comuna_corregimiento: result.comuna_corregimiento } : {}),
        ...(result.barrio_vereda ? { barrio_vereda: result.barrio_vereda } : {}),
      };
      dispatch("updated", updatedReporte);
      setTimeout(() => { successMsg = ""; }, 3000);
    } catch (err: any) {
      errorMsg = err?.message ?? "Error actualizando coordenadas.";
    } finally {
      savingCoords = false;
    }
  }
</script>

{#if open && reporte}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" on:click={handleClose}></div>

  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-label="Editar reporte de intervención"
  >
    <!-- ── Header ── -->
    <div class="modal-header">
      <div class="header-left">
        <div class="header-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
          </svg>
        </div>
        <div>
          <h2>Editar Reporte</h2>
          {#if reporte.numero_registro}
            <p class="header-sub">Registro #{reporte.numero_registro} · {(reporte.grupo ?? '').toUpperCase()}</p>
          {:else}
            <p class="header-sub">{(reporte.grupo ?? '').toUpperCase()}</p>
          {/if}
        </div>
      </div>
      <button class="btn-close" type="button" on:click={handleClose} aria-label="Cerrar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- ── Tabs ── -->
    <div class="tabs">
      <button
        class="tab"
        class:active={activeTab === "datos"}
        on:click={() => (activeTab = "datos")}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h6"/>
        </svg>
        Datos generales
      </button>
      <button
        class="tab"
        class:active={activeTab === "coordenadas"}
        on:click={() => (activeTab = "coordenadas")}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        Coordenadas
      </button>
    </div>

    <!-- ── Mensajes de estado ── -->
    {#if errorMsg}
      <div class="banner banner-error">{errorMsg}</div>
    {/if}
    {#if successMsg}
      <div class="banner banner-success">{successMsg}</div>
    {/if}

    <!-- ══════════ TAB: DATOS GENERALES ══════════ -->
    {#if activeTab === "datos"}
      <div class="tab-content">
        <div class="form-group">
          <label for="edit-tipo">Tipo de intervención</label>
          <input
            id="edit-tipo"
            type="text"
            bind:value={tipoIntervencion}
            placeholder="Ej: Poda de mantenimiento"
            maxlength="200"
          />
        </div>

        <div class="form-group">
          <label for="edit-desc">Descripción de la intervención</label>
          <textarea
            id="edit-desc"
            bind:value={descripcion}
            placeholder="Descripción detallada de la actividad realizada…"
            rows="4"
            maxlength="3000"
          ></textarea>
          <span class="char-count">{descripcion.length}/3000</span>
        </div>

        <div class="form-group">
          <label for="edit-obs">Observaciones</label>
          <textarea
            id="edit-obs"
            bind:value={observaciones}
            placeholder="Observaciones adicionales, novedades…"
            rows="3"
            maxlength="2000"
          ></textarea>
        </div>

        <div class="form-group">
          <label for="edit-dir">Dirección</label>
          <input
            id="edit-dir"
            type="text"
            bind:value={direccion}
            placeholder="Ej: Calle 5 # 10-20, Barrio El Lido"
            maxlength="500"
          />
        </div>

        <div class="form-actions">
          <button class="btn btn-outline" type="button" on:click={handleClose} disabled={saving}>
            Cancelar
          </button>
          <button class="btn btn-primary" type="button" on:click={handleSaveDatos} disabled={saving}>
            {#if saving}
              <span class="spinner-sm"></span> Guardando…
            {:else}
              Guardar cambios
            {/if}
          </button>
        </div>
      </div>

    <!-- ══════════ TAB: COORDENADAS ══════════ -->
    {:else if activeTab === "coordenadas"}
      <div class="tab-content">
        <div class="coords-info">
          {#if coordsActuales}
            <div class="coords-current">
              <span class="coords-dot" class:manual={reporte.ultima_edicion_coords}></span>
              <span>
                <strong>Lat:</strong> {coordsActuales.latitude.toFixed(6)}
                &nbsp;·&nbsp;
                <strong>Lng:</strong> {coordsActuales.longitude.toFixed(6)}
              </span>
              {#if reporte.ultima_edicion_coords}
                <span class="badge-edit">Editadas</span>
              {:else}
                <span class="badge-gps">GPS</span>
              {/if}
            </div>
          {:else}
            <p class="no-coords">Este reporte no tiene coordenadas registradas.</p>
          {/if}

          {#if reporte.comuna_corregimiento}
            <div class="coords-geo">
              {reporte.comuna_corregimiento}
              {#if reporte.barrio_vereda} · {reporte.barrio_vereda}{/if}
            </div>
          {/if}
        </div>

        <!-- Inputs rápidos para edición numérica directa -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: 0.25rem;">
          <div class="form-group">
            <label for="direct-lat">Latitud rápida</label>
            <input
              id="direct-lat"
              type="text"
              bind:value={latInput}
              placeholder="Ej: 3.451600"
            />
          </div>
          <div class="form-group">
            <label for="direct-lng">Longitud rápida</label>
            <input
              id="direct-lng"
              type="text"
              bind:value={lngInput}
              placeholder="Ej: -76.532000"
            />
          </div>
        </div>

        <div class="form-actions" style="margin-top: 0.25rem; display: flex; gap: 0.5rem;">
          <button
            class="btn btn-outline"
            style="flex: 1;"
            type="button"
            on:click={handleOpenCoordsModal}
            disabled={savingCoords}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            Mapa interactivo
          </button>
          
          <button
            class="btn btn-primary"
            style="flex: 1;"
            type="button"
            disabled={savingCoords || !latInput || !lngInput}
            on:click={() => {
              const latVal = parseFloat(latInput);
              const lngVal = parseFloat(lngInput);
              if (isNaN(latVal) || latVal < -90 || latVal > 90) {
                errorMsg = "Latitud inválida (-90 a 90)";
                return;
              }
              if (isNaN(lngVal) || lngVal < -180 || lngVal > 180) {
                errorMsg = "Longitud inválida (-180 a 180)";
                return;
              }
              handleSaveCoordenadas({
                latitude: latVal,
                longitude: lngVal,
                timestamp: Date.now(),
                source: "manual",
                manuallyEdited: true
              });
            }}
          >
            {#if savingCoords}
              <span class="spinner-sm"></span> Guardando…
            {:else}
              Guardar Coordenadas
            {/if}
          </button>
        </div>

        <p class="coords-hint" style="margin-top: 0.5rem;">
          Si ya tienes las coordenadas, puedes cambiarlas numéricamente arriba y hacer clic en **Guardar Coordenadas**. Si deseas localizarlas visualmente, haz clic en **Mapa interactivo**. Al guardar, se recalculará automáticamente la comuna y barrio correspondientes.
        </p>
      </div>
    {/if}
  </div>
{/if}

<!-- CoordsEditorModal se monta fuera del modal principal para evitar z-index conflicts -->
<CoordsEditorModal
  bind:open={coordsModalOpen}
  coordenadas={coordsActuales}
  onClose={() => (coordsModalOpen = false)}
  onSave={handleSaveCoordenadas}
/>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1090;
    backdrop-filter: blur(2px);
  }

  .modal {
    position: fixed;
    z-index: 1091;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(560px, 96vw);
    max-height: 90vh;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── Header ── */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.1rem 1.25rem 0.9rem;
    border-bottom: 1px solid #f1f5f9;
    background: linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%);
    gap: 0.75rem;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .header-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: #059669;
    color: #fff;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  .modal-header h2 {
    font-size: 1rem;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
  }
  .header-sub {
    font-size: 0.75rem;
    color: #64748b;
    margin: 0;
    margin-top: 1px;
  }
  .btn-close {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 6px;
    cursor: pointer;
    color: #475569;
    display: grid;
    place-items: center;
    transition: background 120ms;
    flex-shrink: 0;
  }
  .btn-close:hover { background: #e2e8f0; }

  /* ── Tabs ── */
  .tabs {
    display: flex;
    border-bottom: 1px solid #e2e8f0;
    background: #fafafa;
    padding: 0 1rem;
    gap: 0;
  }
  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0.7rem 1rem;
    border: none;
    background: transparent;
    font-size: 0.82rem;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: color 120ms, border-color 120ms;
    margin-bottom: -1px;
  }
  .tab:hover { color: #334155; }
  .tab.active { color: #059669; border-bottom-color: #059669; font-weight: 600; }

  /* ── Banners ── */
  .banner {
    font-size: 0.82rem;
    padding: 0.6rem 1.25rem;
    font-weight: 500;
  }
  .banner-error { background: #fef2f2; color: #b91c1c; border-bottom: 1px solid #fecaca; }
  .banner-success { background: #f0fdf4; color: #15803d; border-bottom: 1px solid #bbf7d0; }

  /* ── Tab content ── */
  .tab-content {
    padding: 1.25rem;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* ── Form ── */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    position: relative;
  }
  .form-group label {
    font-size: 0.78rem;
    font-weight: 600;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .form-group input,
  .form-group textarea {
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 0.6rem 0.75rem;
    font-size: 0.9rem;
    color: #1e293b;
    background: #fff;
    transition: border-color 120ms, box-shadow 120ms;
    resize: vertical;
    font-family: inherit;
  }
  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #059669;
    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);
  }
  .char-count {
    font-size: 0.68rem;
    color: #94a3b8;
    text-align: right;
    position: absolute;
    bottom: 6px;
    right: 10px;
    pointer-events: none;
  }

  /* ── Actions ── */
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    padding-top: 0.25rem;
    margin-top: auto;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0.55rem 1.25rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 150ms;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary {
    background: #059669;
    color: #fff;
    border-color: #059669;
  }
  .btn-primary:hover:not(:disabled) { background: #047857; }
  .btn-outline {
    background: #fff;
    color: #475569;
    border-color: #d1d5db;
  }
  .btn-outline:hover:not(:disabled) { border-color: #94a3b8; }
  .btn-block { width: 100%; justify-content: center; }

  /* ── Coords tab ── */
  .coords-info {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 0.9rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .coords-current {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    color: #334155;
  }
  .coords-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #3b82f6;
    flex-shrink: 0;
  }
  .coords-dot.manual { background: #f59e0b; }
  .badge-edit {
    font-size: 0.68rem;
    font-weight: 700;
    background: #fef3c7;
    color: #b45309;
    border: 1px solid #fde68a;
    border-radius: 999px;
    padding: 1px 6px;
  }
  .badge-gps {
    font-size: 0.68rem;
    font-weight: 700;
    background: #dbeafe;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
    border-radius: 999px;
    padding: 1px 6px;
  }
  .coords-geo { font-size: 0.78rem; color: #64748b; }
  .no-coords { font-size: 0.85rem; color: #94a3b8; margin: 0; }
  .coords-hint {
    font-size: 0.78rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0;
  }

  /* ── Spinner ── */
  .spinner-sm {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 560px) {
    .modal { width: 100vw; max-height: 100vh; border-radius: 0; top: 0; left: 0; transform: none; }
  }
</style>
