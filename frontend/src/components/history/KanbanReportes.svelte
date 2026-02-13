<script lang="ts">
  import { onMount } from "svelte";
  import { reportesStore } from "../../stores/reportesStore";
  import {
    KANBAN_COLUMNS_REPORTES,
    getPrioridadColor,
  } from "../../types/reportes";
  import type {
    ReporteConSeguimiento,
    EstadoReporte,
    PrioridadReporte,
  } from "../../types/reportes";
  import Button from "../ui/Button.svelte";

  let selectedReporte: ReporteConSeguimiento | null = null;
  let showDetailPanel = false;
  let viewMode: "kanban" | "tabla" = "kanban";

  // Avance form
  let showAvanceForm = false;
  let avanceNuevoEstado: EstadoReporte = "notificado";
  let avanceDescripcion = "";
  let avancePorcentaje = 0;
  let avanceEncargado = "";
  let guardandoAvance = false;
  let mensajeExito = "";
  let mensajeError = "";

  onMount(async () => {
    await reportesStore.cargarReportes();
  });

  $: allReportes = $reportesStore.reportes;
  $: loading = $reportesStore.loading;
  $: error = $reportesStore.error;

  $: groupedByEstado = (() => {
    const grouped: Record<EstadoReporte, ReporteConSeguimiento[]> = {
      notificado: [],
      asignado: [],
      "en-proceso": [],
      resuelto: [],
    };
    for (const reporte of allReportes) {
      grouped[reporte.estado].push(reporte);
    }
    return grouped;
  })();

  function selectReporte(reporte: ReporteConSeguimiento) {
    selectedReporte = reporte;
    showDetailPanel = true;
    showAvanceForm = false;
  }

  function closeDetail() {
    showDetailPanel = false;
    selectedReporte = null;
  }

  function openAvanceForm() {
    if (!selectedReporte) return;
    avanceNuevoEstado = getNextEstado(selectedReporte.estado);
    avanceDescripcion = "";
    // Sugerir incremento de porcentaje basado en el estado actual
    const incremento = selectedReporte.porcentaje_avance < 100 ? 15 : 0;
    avancePorcentaje = Math.min(
      100,
      selectedReporte.porcentaje_avance + incremento,
    );
    avanceEncargado = selectedReporte.encargado || "";
    guardandoAvance = false;
    mensajeExito = "";
    showAvanceForm = true;
  }

  function getNextEstado(current: EstadoReporte): EstadoReporte {
    const order: EstadoReporte[] = [
      "notificado",
      "asignado",
      "en-proceso",
      "resuelto",
    ];
    const idx = order.indexOf(current);
    return idx < order.length - 1 ? order[idx + 1] : current;
  }

  async function guardarAvance() {
    if (!selectedReporte || !avanceDescripcion.trim()) {
      mensajeError =
        "Por favor, ingrese una descripción de la gestión realizada.";
      return;
    }

    if (avanceDescripcion.trim().length < 10) {
      mensajeError = "La descripción debe tener al menos 10 caracteres.";
      return;
    }

    guardandoAvance = true;
    mensajeExito = "";
    mensajeError = "";

    try {
      // Registrar el cambio de estado
      reportesStore.cambiarEstadoReporte(
        selectedReporte.id,
        avanceNuevoEstado,
        avanceDescripcion.trim(),
        "Usuario actual", // TODO: Usar usuario autenticado
        avancePorcentaje,
      );

      // Asignar encargado si cambió
      if (avanceEncargado && avanceEncargado !== selectedReporte.encargado) {
        reportesStore.asignarEncargado(
          selectedReporte.id,
          avanceEncargado.trim(),
        );
      }

      // Actualizar referencia al reporte seleccionado
      selectedReporte =
        allReportes.find((r) => r.id === selectedReporte!.id) || null;

      // Mostrar mensaje de éxito
      mensajeExito = "Avance registrado exitosamente";

      // Cerrar formulario después de 1.5 segundos
      setTimeout(() => {
        showAvanceForm = false;
        mensajeExito = "";
      }, 1500);
    } catch (error) {
      console.error("Error al guardar avance:", error);
      mensajeError =
        "Error al guardar el avance. Por favor, intente nuevamente.";
    } finally {
      guardandoAvance = false;
    }
  }

  function getPrioridadStyle(prioridad: PrioridadReporte): {
    backgroundColor: string;
    color: string;
  } {
    const bgColor = getPrioridadColor(prioridad);
    return { backgroundColor: bgColor, color: "white" };
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getSelectedReporteEstadoColor(): string {
    if (!selectedReporte) return "#94a3b8";
    const reporte = selectedReporte; // Type narrowing
    const column = KANBAN_COLUMNS_REPORTES.find((c) => c.id === reporte.estado);
    return column?.color || "#94a3b8";
  }

  // Stats
  $: totalReportes = allReportes.length;
  $: avgAvance =
    totalReportes > 0
      ? Math.round(
          allReportes.reduce((sum, r) => sum + r.porcentaje_avance, 0) /
            totalReportes,
        )
      : 0;
</script>

<div class="view" class:has-panel={showDetailPanel}>
  <header class="view-header">
    <button class="back-btn" on:click={() => window.history.back()}
      >← Volver</button
    >
    <h2 class="view-title">Seguimiento de Reconocimientos</h2>
    <div class="header-controls">
      <div class="view-toggle">
        <button
          class="toggle-btn"
          class:active={viewMode === "kanban"}
          on:click={() => (viewMode = "kanban")}>▦ Kanban</button
        >
        <button
          class="toggle-btn"
          class:active={viewMode === "tabla"}
          on:click={() => (viewMode = "tabla")}>☰ Tabla</button
        >
      </div>
      <span class="stat">{totalReportes} reportes</span>
      <span class="stat">⌀ {avgAvance}%</span>
    </div>
  </header>

  {#if loading}
    <div class="loading-center">
      <div class="spinner"></div>
      <p>Cargando reportes...</p>
    </div>
  {:else if error}
    <div class="error-center">
      <p>❌ {error}</p>
      <Button size="sm" on:click={() => reportesStore.cargarReportes()}
        >Reintentar</Button
      >
    </div>
  {:else if viewMode === "kanban"}
    <!-- KANBAN VIEW -->
    <div class="kanban-container">
      <div class="kanban-board">
        {#each KANBAN_COLUMNS_REPORTES as col (col.id)}
          {@const colReportes = groupedByEstado[col.id] || []}
          <div class="kanban-column">
            <div class="column-header" style="border-color: {col.color}">
              <span class="column-icon">{col.icon}</span>
              <span class="column-title">{col.title}</span>
              <span class="column-count" style="background: {col.color}"
                >{colReportes.length}</span
              >
            </div>
            <div class="column-body">
              {#each colReportes as reporte (reporte.id)}
                <button
                  class="kanban-card"
                  class:selected={selectedReporte?.id === reporte.id}
                  on:click={() => selectReporte(reporte)}
                >
                  <div class="kcard-top">
                    <span
                      class="kcard-prioridad"
                      style="background: {getPrioridadColor(
                        reporte.prioridad,
                      )}; color: white;">{reporte.prioridad}</span
                    >
                    <span class="kcard-id">{reporte.id.slice(0, 8)}...</span>
                  </div>
                  <h4 class="kcard-title">
                    {reporte.nombre_parque || "Parque sin nombre"}
                  </h4>
                  <p class="kcard-desc">
                    {(
                      reporte.descripcion_intervencion || "Sin descripción"
                    ).slice(0, 80)}{(
                      reporte.descripcion_intervencion || "Sin descripción"
                    ).length > 80
                      ? "..."
                      : ""}
                  </p>
                  <div class="kcard-footer">
                    <span class="kcard-tipo"
                      >{reporte.tipo_intervencion || "Sin especificar"}</span
                    >
                    <div class="kcard-avance">
                      <div class="mini-bar">
                        <div
                          class="mini-fill"
                          style="width: {reporte.porcentaje_avance}%"
                        ></div>
                      </div>
                      <span>{reporte.porcentaje_avance}%</span>
                    </div>
                  </div>
                  {#if reporte.encargado}
                    <div class="kcard-encargado">👤 {reporte.encargado}</div>
                  {/if}
                </button>
              {:else}
                <div class="empty-column">Sin reportes</div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <!-- TABLA VIEW -->
    <div class="tabla-container">
      <div class="tabla-wrapper">
        <table class="req-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th>Parque</th>
              <th>Tipo</th>
              <th>Descripción</th>
              <th>Avance</th>
              <th>Encargado</th>
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each allReportes as reporte (reporte.id)}
              <tr
                class="tabla-row"
                class:selected-row={selectedReporte?.id === reporte.id}
              >
                <td class="td-id">{reporte.id.slice(0, 8)}...</td>
                <td>
                  <span
                    class="tabla-estado"
                    style="background: {KANBAN_COLUMNS_REPORTES.find(
                      (c) => c.id === reporte.estado,
                    )?.color || '#94a3b8'}"
                  >
                    {reporte.estado}
                  </span>
                </td>
                <td
                  ><span
                    class="tabla-prioridad"
                    style="background: {getPrioridadColor(
                      reporte.prioridad,
                    )}; color: white;">{reporte.prioridad}</span
                  ></td
                >
                <td class="td-parque"
                  >{reporte.nombre_parque || "Parque sin nombre"}</td
                >
                <td class="td-tipo"
                  >{reporte.tipo_intervencion || "Sin especificar"}</td
                >
                <td class="td-desc">
                  {(
                    reporte.descripcion_intervencion || "Sin descripción"
                  ).slice(0, 60)}{(
                    reporte.descripcion_intervencion || "Sin descripción"
                  ).length > 60
                    ? "..."
                    : ""}
                </td>
                <td>
                  <div class="tabla-avance">
                    <div class="mini-bar" style="width: 50px;">
                      <div
                        class="mini-fill"
                        style="width: {reporte.porcentaje_avance}%"
                      ></div>
                    </div>
                    <span class="tabla-pct">{reporte.porcentaje_avance}%</span>
                  </div>
                </td>
                <td class="td-encargado">{reporte.encargado || "—"}</td>
                <td class="td-fecha"
                  >{formatDate(reporte.fecha_registro).split(",")[0]}</td
                >
                <td
                  ><button
                    class="tabla-detail-btn"
                    on:click={() => selectReporte(reporte)}>Ver →</button
                  ></td
                >
              </tr>
            {:else}
              <tr><td colspan="10" class="empty-table">No hay reportes</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <!-- DETAIL PANEL -->
  {#if showDetailPanel && selectedReporte}
    <div
      class="detail-overlay"
      on:click={closeDetail}
      on:keydown={(e) => e.key === "Escape" && closeDetail()}
      role="button"
      tabindex="0"
    ></div>
    <aside class="detail-panel">
      <div class="panel-header">
        <h3>Detalle del Reporte</h3>
        <button class="close-panel" on:click={closeDetail}>✕</button>
      </div>
      <div class="panel-body">
        <!-- Estado y Prioridad -->
        <div class="panel-row">
          <span class="panel-label">Estado</span>
          <span
            class="panel-estado"
            style="background: {getSelectedReporteEstadoColor()}; color: white; padding: 0.25rem 0.75rem; border-radius: 4px;"
          >
            {selectedReporte.estado}
          </span>
        </div>
        <div class="panel-row">
          <span class="panel-label">Prioridad</span>
          <span
            class="panel-prioridad"
            style="background: {getPrioridadColor(
              selectedReporte.prioridad,
            )}; color: white;">{selectedReporte.prioridad}</span
          >
        </div>
        <div class="panel-row">
          <span class="panel-label">Avance</span>
          <div class="panel-avance">
            <div class="panel-avance-bar">
              <div
                class="panel-avance-fill"
                style="width: {selectedReporte.porcentaje_avance}%"
              ></div>
            </div>
            <strong>{selectedReporte.porcentaje_avance}%</strong>
          </div>
        </div>
        {#if selectedReporte.encargado}
          <div class="panel-row">
            <span class="panel-label">Encargado</span>
            <span>{selectedReporte.encargado}</span>
          </div>
        {/if}

        <hr />

        <!-- Información del Parque -->
        <h4>🏞️ Información del Parque</h4>
        <div class="panel-info">
          {selectedReporte.nombre_parque || "Parque sin nombre"}
        </div>
        <div class="panel-info-sm">
          📍 {selectedReporte.direccion || "Sin dirección"}
        </div>
        <div class="panel-info-sm">ID: {selectedReporte.upid || "Sin ID"}</div>

        <hr />

        <!-- Intervención -->
        <h4>🔧 Intervención</h4>
        <div class="panel-tags">
          <span class="panel-tag"
            >{selectedReporte.tipo_intervencion || "Sin especificar"}</span
          >
        </div>
        <p class="panel-desc">
          {selectedReporte.descripcion_intervencion || "Sin descripción"}
        </p>
        {#if selectedReporte.observaciones}
          <p class="panel-obs">💬 {selectedReporte.observaciones}</p>
        {/if}

        <hr />

        <!-- Evidencias Fotográficas -->
        {#if selectedReporte.photosUrl && selectedReporte.photosUrl.length > 0}
          <h4>
            Evidencias Fotográficas ({selectedReporte.photos_uploaded})
          </h4>
          <div class="photos-grid">
            {#each selectedReporte.photosUrl as photo}
              <a href={photo} target="_blank" rel="noopener noreferrer">
                <img src={photo} alt="Evidencia" class="photo-thumb" />
              </a>
            {/each}
          </div>
          <hr />
        {/if}

        <!-- Historial -->
        <h4>Historial de Gestión ({selectedReporte.historial.length})</h4>
        <div class="timeline">
          {#each [...selectedReporte.historial].reverse() as entry (entry.id)}
            <div class="timeline-item">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div class="timeline-head">
                  <strong>{entry.autor}</strong>
                  <span class="timeline-date">{formatDate(entry.fecha)}</span>
                </div>
                <p class="timeline-desc">{entry.descripcion}</p>
                {#if entry.estado_anterior !== entry.estado_nuevo}
                  <span class="timeline-transition">
                    {entry.estado_anterior} → {entry.estado_nuevo}
                  </span>
                {/if}
                {#if entry.evidencias.length > 0}
                  <div class="timeline-evidencias">
                    {#each entry.evidencias as ev}
                      <span class="evidence-chip">
                        [{ev.tipo}] {ev.descripcion}
                      </span>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        <hr />

        <!-- Avance Form -->
        {#if !showAvanceForm}
          <Button on:click={openAvanceForm}
            >+ Registrar Avance / Cambiar Estado</Button
          >
        {:else}
          <div class="avance-form">
            <h4>Nuevo Registro de Avance</h4>

            {#if mensajeExito}
              <div class="mensaje-exito">
                {mensajeExito}
              </div>
            {/if}

            {#if mensajeError}
              <div class="mensaje-error">
                {mensajeError}
              </div>
            {/if}

            <div class="field">
              <label for="avance-estado">Nuevo Estado *</label>
              <select
                id="avance-estado"
                bind:value={avanceNuevoEstado}
                disabled={guardandoAvance}
              >
                <option value="notificado">Notificado</option>
                <option value="asignado">Asignado</option>
                <option value="en-proceso">En Proceso</option>
                <option value="resuelto">Resuelto</option>
              </select>
            </div>
            <div class="field">
              <label for="avance-descripcion">
                Descripción de la Gestión *
                <span class="field-hint">(mínimo 10 caracteres)</span>
              </label>
              <textarea
                id="avance-descripcion"
                bind:value={avanceDescripcion}
                rows="4"
                placeholder="Describa detalladamente: ¿Qué gestión se realizó? ¿Con quién se comunicó? ¿Qué se acordó? ¿Cuáles son los próximos pasos?"
                disabled={guardandoAvance}
              ></textarea>
              <div class="char-count">
                {avanceDescripcion.length} caracteres
              </div>
            </div>
            <div class="field">
              <label for="avance-encargado">
                Encargado del Centro Gestor
                <span class="field-hint">(opcional)</span>
              </label>
              <input
                id="avance-encargado"
                type="text"
                bind:value={avanceEncargado}
                placeholder="Nombre del funcionario responsable"
                disabled={guardandoAvance}
              />
            </div>
            <div class="field">
              <label for="avance-porcentaje">
                Porcentaje de Avance: <strong>{avancePorcentaje}%</strong>
              </label>
              <input
                id="avance-porcentaje"
                type="range"
                min="0"
                max="100"
                step="5"
                bind:value={avancePorcentaje}
                disabled={guardandoAvance}
              />
              <div class="avance-marks">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
            <div class="avance-actions">
              <Button
                variant="secondary"
                size="sm"
                on:click={() => (showAvanceForm = false)}
                disabled={guardandoAvance}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                on:click={guardarAvance}
                disabled={!avanceDescripcion.trim() || guardandoAvance}
              >
                {guardandoAvance ? "Guardando..." : "Guardar Avance"}
              </Button>
            </div>
          </div>
        {/if}
      </div>
    </aside>
  {/if}
</div>

<style>
  .view {
    min-height: 100vh;
    background: #f1f5f9;
    display: flex;
    flex-direction: column;
  }
  .view-header {
    background: white;
    border-bottom: 1px solid #e2e8f0;
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    position: sticky;
    top: 0;
    z-index: 200;
  }
  .back-btn {
    background: none;
    border: none;
    color: #2563eb;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
  .view-title {
    font-size: 1.1rem;
    font-weight: 700;
    flex: 1;
  }
  .header-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .view-toggle {
    display: flex;
    gap: 0.25rem;
    background: #f1f5f9;
    border-radius: 6px;
    padding: 0.15rem;
  }
  .toggle-btn {
    background: none;
    border: none;
    padding: 0.35rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s;
  }
  .toggle-btn.active {
    background: white;
    color: #2563eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  .stat {
    font-size: 0.75rem;
    color: #64748b;
    font-weight: 600;
  }

  .loading-center,
  .error-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 60vh;
    gap: 1rem;
  }
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e2e8f0;
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Kanban */
  .kanban-container {
    flex: 1;
    overflow-x: auto;
    padding: 0.75rem;
  }
  .kanban-board {
    display: flex;
    gap: 0.6rem;
    min-width: max-content;
    height: calc(100vh - 120px);
  }
  .kanban-column {
    width: 260px;
    min-width: 260px;
    display: flex;
    flex-direction: column;
    background: #f8fafc;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
  }
  .column-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem 0.75rem;
    border-bottom: 3px solid;
    font-size: 0.8rem;
    font-weight: 700;
    color: #1e293b;
  }
  .column-icon {
    font-size: 1rem;
  }
  .column-title {
    flex: 1;
  }
  .column-count {
    color: white;
    font-size: 0.65rem;
    padding: 0.1rem 0.4rem;
    border-radius: 99px;
    font-weight: 700;
  }
  .column-body {
    flex: 1;
    overflow-y: auto;
    padding: 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  /* Kanban Card */
  .kanban-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.6rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s;
    width: 100%;
    border-left: 3px solid transparent;
  }
  .kanban-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }
  .kanban-card.selected {
    border-left-color: #2563eb;
    box-shadow: 0 0 0 2px #93c5fd;
  }
  .kcard-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.3rem;
  }
  .kcard-prioridad {
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
  }
  .kcard-id {
    font-size: 0.6rem;
    color: #94a3b8;
    font-family: monospace;
  }
  .kcard-title {
    font-size: 0.85rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 0.25rem;
  }
  .kcard-desc {
    font-size: 0.75rem;
    color: #334155;
    margin: 0 0 0.35rem;
    line-height: 1.3;
  }
  .kcard-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .kcard-tipo {
    font-size: 0.65rem;
    color: #64748b;
  }
  .kcard-avance {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .mini-bar {
    width: 40px;
    height: 4px;
    background: #e2e8f0;
    border-radius: 2px;
    overflow: hidden;
  }
  .mini-fill {
    height: 100%;
    background: #2563eb;
    border-radius: 2px;
  }
  .kcard-avance span {
    font-size: 0.6rem;
    font-weight: 700;
    color: #475569;
  }
  .kcard-encargado {
    font-size: 0.62rem;
    color: #0d9488;
    font-weight: 600;
    margin-top: 0.25rem;
  }
  .empty-column {
    text-align: center;
    padding: 2rem 0.5rem;
    color: #94a3b8;
    font-size: 0.75rem;
  }

  /* Tabla */
  .tabla-container {
    flex: 1;
    overflow: auto;
    padding: 0.75rem;
  }
  .tabla-wrapper {
    overflow-x: auto;
  }
  .req-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
    background: white;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
  }
  .req-table thead {
    background: #f8fafc;
  }
  .req-table th {
    padding: 0.6rem 0.5rem;
    text-align: left;
    font-weight: 700;
    color: #475569;
    font-size: 0.72rem;
    border-bottom: 2px solid #e2e8f0;
    white-space: nowrap;
  }
  .req-table td {
    padding: 0.55rem 0.5rem;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
  }
  .tabla-row {
    transition: background 0.1s;
    cursor: default;
  }
  .tabla-row:hover {
    background: #f8fafc;
  }
  .selected-row {
    background: #eff6ff !important;
  }
  .td-id {
    font-family: monospace;
    font-size: 0.65rem;
    color: #94a3b8;
  }
  .tabla-estado {
    color: white;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: capitalize;
    white-space: nowrap;
  }
  .tabla-prioridad {
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
  }
  .td-parque {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
    color: #1e293b;
  }
  .td-tipo {
    max-width: 120px;
    font-size: 0.75rem;
    color: #475569;
  }
  .td-desc {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #334155;
  }
  .tabla-avance {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .tabla-pct {
    font-size: 0.65rem;
    font-weight: 700;
    color: #475569;
  }
  .td-encargado {
    font-size: 0.75rem;
    color: #64748b;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .td-fecha {
    font-size: 0.7rem;
    color: #94a3b8;
    white-space: nowrap;
  }
  .tabla-detail-btn {
    background: none;
    border: none;
    color: #2563eb;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.75rem;
    white-space: nowrap;
  }
  .tabla-detail-btn:hover {
    text-decoration: underline;
  }
  .empty-table {
    text-align: center;
    padding: 2rem;
    color: #94a3b8;
  }

  /* Detail Panel */
  .detail-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 300;
  }
  .detail-panel {
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;
    width: 420px;
    max-width: 90vw;
    background: white;
    z-index: 301;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }
  .panel-header h3 {
    margin: 0;
    font-size: 1rem;
  }
  .close-panel {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: #64748b;
  }
  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }
  .panel-body hr {
    border: none;
    border-top: 1px solid #f1f5f9;
    margin: 0.75rem 0;
  }
  .panel-body h4 {
    font-size: 0.85rem;
    font-weight: 700;
    margin: 0 0 0.35rem;
    color: #1e293b;
  }
  .panel-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.4rem;
  }
  .panel-label {
    font-size: 0.75rem;
    color: #94a3b8;
    font-weight: 600;
  }
  .panel-estado {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: capitalize;
  }
  .panel-prioridad {
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
  }
  .panel-avance {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .panel-avance-bar {
    width: 100px;
    height: 8px;
    background: #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
  }
  .panel-avance-fill {
    height: 100%;
    background: #2563eb;
    border-radius: 4px;
  }
  .panel-info {
    font-size: 0.85rem;
    font-weight: 600;
    color: #1e293b;
  }
  .panel-info-sm {
    font-size: 0.75rem;
    color: #64748b;
  }
  .panel-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .panel-tag {
    background: #eff6ff;
    color: #1e40af;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 600;
  }
  .panel-desc {
    font-size: 0.85rem;
    color: #334155;
    line-height: 1.5;
    margin: 0;
  }
  .panel-obs {
    font-size: 0.8rem;
    color: #64748b;
    font-style: italic;
    margin: 0.25rem 0 0;
  }

  /* Photos */
  .photos-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .photo-thumb {
    width: 100%;
    height: 80px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  /* Timeline */
  .timeline {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-top: 0.5rem;
  }
  .timeline-item {
    display: flex;
    gap: 0.6rem;
    position: relative;
    padding-bottom: 0.75rem;
  }
  .timeline-item:not(:last-child)::before {
    content: "";
    position: absolute;
    left: 5px;
    top: 14px;
    bottom: 0;
    width: 2px;
    background: #e2e8f0;
  }
  .timeline-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #2563eb;
    flex-shrink: 0;
    margin-top: 3px;
  }
  .timeline-content {
    flex: 1;
    min-width: 0;
  }
  .timeline-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .timeline-head strong {
    font-size: 0.75rem;
    color: #1e293b;
  }
  .timeline-date {
    font-size: 0.65rem;
    color: #94a3b8;
  }
  .timeline-desc {
    font-size: 0.78rem;
    color: #475569;
    margin: 0.15rem 0;
    line-height: 1.4;
  }
  .timeline-transition {
    display: inline-block;
    font-size: 0.65rem;
    background: #f0f7ff;
    color: #2563eb;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    font-weight: 600;
    margin-top: 0.15rem;
  }
  .timeline-evidencias {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.25rem;
  }
  .evidence-chip {
    font-size: 0.65rem;
    background: #f1f5f9;
    padding: 0.15rem 0.4rem;
    border-radius: 3px;
  }

  /* Avance form */
  .avance-form {
    background: #f8fafc;
    padding: 0.75rem;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }
  .avance-form h4 {
    margin-bottom: 0.75rem;
  }
  .mensaje-exito {
    background: #dcfce7;
    color: #166534;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    text-align: center;
  }
  .mensaje-error {
    background: #fee2e2;
    color: #991b1b;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    text-align: center;
  }
  .field {
    margin-bottom: 0.75rem;
  }
  .field label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: #475569;
    margin-bottom: 0.25rem;
  }
  .field-hint {
    font-size: 0.7rem;
    font-weight: 400;
    color: #94a3b8;
    font-style: italic;
  }
  .field input,
  .field select,
  .field textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.8rem;
    font-family: inherit;
    transition: border-color 0.2s;
  }
  .field input:focus,
  .field select:focus,
  .field textarea:focus {
    outline: none;
    border-color: #2563eb;
  }
  .field input:disabled,
  .field select:disabled,
  .field textarea:disabled {
    background: #f1f5f9;
    color: #94a3b8;
    cursor: not-allowed;
  }
  .field input[type="range"] {
    padding: 0;
  }
  .char-count {
    font-size: 0.7rem;
    color: #94a3b8;
    margin-top: 0.25rem;
    text-align: right;
  }
  .avance-marks {
    display: flex;
    justify-content: space-between;
    font-size: 0.65rem;
    color: #94a3b8;
    margin-top: 0.25rem;
    padding: 0 0.25rem;
  }
  .avance-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  @media (max-width: 768px) {
    .kanban-column {
      width: 220px;
      min-width: 220px;
    }
    .detail-panel {
      width: 100vw;
      max-width: 100vw;
    }
  }
</style>
