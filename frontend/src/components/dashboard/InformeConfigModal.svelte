<script lang="ts">
  /**
   * InformeConfigModal — Configuración y previsualización del informe institucional.
   * Paso 1: Filtros (período, grupos, opciones)
   * Paso 2: Previsualización + descarga
   */
  import { createEventDispatcher } from "svelte";
  import type { ReporteIntervencion } from "../../api/visitas";
  import {
    generarInforme,
    calcularFechasPeriodo,
    type PeriodPreset,
    type InformeConfig,
  } from "../../lib/pdf/generarInforme";
  import { GRUPO_KEYS, GRUPO_DISPLAY_NAMES, normalizeGrupo, canonicalGrupoKey } from "../../lib/grupos";

  export let open = false;
  /** Recibe todos los reportes sin pre-filtrar para que el modal controle los filtros */
  export let reportes: ReporteIntervencion[] = [];

  const dispatch = createEventDispatcher<{ close: void }>();

  // ── State ──────────────────────────────────────────────────────────────────
  let step: 1 | 2 = 1;
  let generating = false;
  let errorMsg = "";

  // Formulario
  let titulo = "Informe de Gestión Ambiental";
  let periodo: PeriodPreset = "mes";
  let fechaDesde = "";
  let fechaHasta = "";
  let gruposIncluidos: string[] = [...GRUPO_KEYS];
  let incluirFotos = true;
  let incluirDescripciones = true;
  let agruparPor: InformeConfig["agruparPor"] = "grupo";

  // ── Sincronizar fechas al cambiar preset ───────────────────────────────────
  $: if (periodo !== "personalizado") {
    const { desde, hasta } = calcularFechasPeriodo(periodo);
    fechaDesde = desde;
    fechaHasta = hasta;
  }

  // ── Filtrado reactivo ──────────────────────────────────────────────────────
  // Normaliza el grupo del reporte igual que normalize_grupo del backend
  function grupoMatchesIncluidos(rGrupo: string | undefined | null): boolean {
    const norm = normalizeGrupo(rGrupo);
    // Compara si el grupo normalizado del reporte contiene alguno de los seleccionados
    return gruposIncluidos.some((key) => norm.includes(normalizeGrupo(key)));
  }

  $: filtradosPreview = (() => {
    const desde = fechaDesde ? new Date(fechaDesde + "T00:00:00") : null;
    const hasta  = fechaHasta ? new Date(fechaHasta + "T23:59:59") : null;

    return reportes.filter((r) => {
      // Filtro por grupo
      if (!grupoMatchesIncluidos(r.grupo)) return false;

      // Filtro por fecha — intentar varios campos de fecha conocidos
      const rawFecha =
        r.timestamp ??
        (r as any).fecha_registro ??
        (r as any).fecha_hora ??
        (r as any).created_at;

      if (rawFecha && (desde || hasta)) {
        const ts = new Date(rawFecha);
        if (!isNaN(ts.getTime())) {
          if (desde && ts < desde) return false;
          if (hasta && ts > hasta) return false;
        }
      }

      return true;
    });
  })();

  $: previewStats = (() => {
    const porGrupo: Record<string, number> = {};
    const comunas = new Set<string>();
    let fotos = 0;

    for (const r of filtradosPreview) {
      const g = normalizeGrupo(r.grupo) || "sin grupo";
      porGrupo[g] = (porGrupo[g] ?? 0) + 1;
      if (r.comuna_corregimiento) comunas.add(r.comuna_corregimiento);
      fotos += r.photos_uploaded ?? 0;
    }
    return {
      total: filtradosPreview.length,
      porGrupo,
      comunas: comunas.size,
      fotos,
    };
  })();

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getGrupoDisplayName(normalizedKey: string): string {
    // Intenta match exacto primero, luego por inclusión
    const exact = (GRUPO_DISPLAY_NAMES as Record<string, string>)[normalizedKey];
    if (exact) return exact;
    for (const key of GRUPO_KEYS) {
      if (normalizedKey.includes(normalizeGrupo(key))) {
        return (GRUPO_DISPLAY_NAMES as Record<string, string>)[key] ?? normalizedKey;
      }
    }
    return normalizedKey;
  }

  function getGrupoColor(normalizedKey: string): string {
    if (canonicalGrupoKey(normalizedKey) === "flora_urbana") return "var(--primary)";
    if (normalizedKey.includes("vivero"))      return "var(--blue-500)";
    if (normalizedKey.includes("gobernanza"))  return "var(--amber-500)";
    if (normalizedKey.includes("ecosistema")) return "var(--purple-500)";
    if (normalizedKey.includes("umata"))       return "var(--red-500)";
    return "var(--slate-400)";
  }

  function toggleGrupo(key: string) {
    if (gruposIncluidos.includes(key)) {
      gruposIncluidos = gruposIncluidos.filter((g) => g !== key);
    } else {
      gruposIncluidos = [...gruposIncluidos, key];
    }
  }

  function handleClose() {
    open = false;
    step = 1;
    errorMsg = "";
    dispatch("close");
  }

  async function handleGenerar() {
    if (filtradosPreview.length === 0) {
      errorMsg = "No hay reportes con los filtros seleccionados.";
      return;
    }
    generating = true;
    errorMsg = "";
    try {
      const config: InformeConfig = {
        titulo,
        periodo,
        fechaDesde,
        fechaHasta,
        gruposIncluidos,
        incluirFotos,
        incluirDescripciones,
        agruparPor,
      };
      await generarInforme({ reportes: filtradosPreview, config });
      handleClose();
    } catch (err: any) {
      errorMsg = err?.message ?? "Error generando el PDF.";
    } finally {
      generating = false;
    }
  }

  const PERIOD_OPTS: { value: PeriodPreset; label: string }[] = [
    { value: "semana",        label: "Últimos 7 días" },
    { value: "mes",           label: "Último mes" },
    { value: "trimestre",     label: "Último trimestre" },
    { value: "semestre",      label: "Último semestre" },
    { value: "anio",          label: "Año en curso" },
    { value: "personalizado", label: "Personalizado" },
  ];

  // Icono SVG de documento (sin emoji)
  const iconDoc = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
</script>

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click={handleClose}></div>

  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-label="Configurar informe institucional"
  >
    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <div class="modal-header">
      <div class="modal-header-left">
        <div class="modal-header-icon">
          {@html iconDoc}
        </div>
        <div>
          <h4 class="modal-title">Generar Informe Institucional</h4>
          <p class="modal-subtitle">
            {step === 1 ? "Paso 1 — Configurar alcance y filtros" : "Paso 2 — Previsualización y descarga"}
          </p>
        </div>
      </div>
      <button class="btn-icon" type="button" on:click={handleClose} aria-label="Cerrar modal">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- ── Stepper ─────────────────────────────────────────────────────────── -->
    <div class="stepper">
      <div class="step-item" class:is-active={step === 1} class:is-done={step > 1}>
        <span class="step-num">{step > 1 ? "✓" : "1"}</span>
        <span class="step-label">Filtros</span>
      </div>
      <div class="step-connector"></div>
      <div class="step-item" class:is-active={step === 2}>
        <span class="step-num">2</span>
        <span class="step-label">Previsualización</span>
      </div>
    </div>

    <!-- ── Error banner ────────────────────────────────────────────────────── -->
    {#if errorMsg}
      <div class="error-banner">{errorMsg}</div>
    {/if}

    <!-- ══════════════════════════ PASO 1 ══════════════════════════════════ -->
    {#if step === 1}
      <div class="modal-body">

        <!-- Título -->
        <div class="field">
          <label class="field-label" for="inf-titulo">Título del informe</label>
          <input
            id="inf-titulo"
            type="text"
            bind:value={titulo}
            placeholder="Informe de Gestión Ambiental"
            maxlength="120"
          />
        </div>

        <!-- Período -->
        <div class="field">
          <label class="field-label">Período de análisis</label>
          <div class="period-grid">
            {#each PERIOD_OPTS as opt}
              <button
                class="period-opt"
                class:is-active={periodo === opt.value}
                type="button"
                on:click={() => (periodo = opt.value)}
              >{opt.label}</button>
            {/each}
          </div>
        </div>

        <!-- Rango personalizado -->
        {#if periodo === "personalizado"}
          <div class="date-row">
            <div class="field">
              <label class="field-label" for="inf-desde">Desde</label>
              <input id="inf-desde" type="date" bind:value={fechaDesde} />
            </div>
            <div class="field">
              <label class="field-label" for="inf-hasta">Hasta</label>
              <input id="inf-hasta" type="date" bind:value={fechaHasta} />
            </div>
          </div>
        {:else if fechaDesde && fechaHasta}
          <p class="range-hint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {fechaDesde} — {fechaHasta}
          </p>
        {/if}

        <!-- Grupos operativos -->
        <div class="field">
          <label class="field-label">Grupos operativos incluidos</label>
          <div class="chip-row">
            {#each GRUPO_KEYS as key}
              <button
                type="button"
                class="chip"
                class:is-selected={gruposIncluidos.includes(key)}
                style="--chip-color: {getGrupoColor(key)}"
                on:click={() => toggleGrupo(key)}
              >
                {GRUPO_DISPLAY_NAMES[key]}
              </button>
            {/each}
          </div>
        </div>

        <!-- Opciones adicionales -->
        <div class="field">
          <label class="field-label">Contenido del informe</label>
          <div class="check-list">
            <label class="check-row">
              <input type="checkbox" bind:checked={incluirFotos} />
              <span>Incluir evidencias fotográficas</span>
            </label>
            <label class="check-row">
              <input type="checkbox" bind:checked={incluirDescripciones} />
              <span>Incluir descripciones de intervenciones</span>
            </label>
          </div>
        </div>

      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm" type="button" on:click={handleClose}>Cancelar</button>
        <button
          class="btn btn-primary btn-sm"
          type="button"
          on:click={() => { step = 2; errorMsg = ""; }}
          disabled={gruposIncluidos.length === 0}
        >
          Continuar
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

    <!-- ══════════════════════════ PASO 2 ══════════════════════════════════ -->
    {:else if step === 2}
      <div class="modal-body">

        <!-- KPIs de preview -->
        <div class="preview-kpis">
          <div class="kpi-box">
            <span class="kpi-val">{previewStats.total}</span>
            <span class="kpi-label">Reportes</span>
          </div>
          <div class="kpi-box">
            <span class="kpi-val">{previewStats.comunas}</span>
            <span class="kpi-label">Comunas</span>
          </div>
          <div class="kpi-box">
            <span class="kpi-val">{previewStats.fotos}</span>
            <span class="kpi-label">Fotos</span>
          </div>
          <div class="kpi-box">
            <span class="kpi-val">{gruposIncluidos.length}</span>
            <span class="kpi-label">Grupos</span>
          </div>
        </div>

        <!-- Barras por grupo -->
        {#if Object.keys(previewStats.porGrupo).length > 0}
          <div class="section-block">
            <span class="section-label">Distribución por grupo</span>
            <div class="group-bars">
              {#each Object.entries(previewStats.porGrupo).sort(([, a], [, b]) => b - a) as [g, count]}
                {@const pct = previewStats.total > 0 ? Math.round((count / previewStats.total) * 100) : 0}
                {@const color = getGrupoColor(g)}
                <div class="bar-row">
                  <span class="bar-name" style="color:{color}">{getGrupoDisplayName(g)}</span>
                  <div class="bar-track">
                    <div class="bar-fill" style="width:{pct}%; background:{color}"></div>
                  </div>
                  <span class="bar-count">{count}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Contenido del PDF -->
        <div class="section-block">
          <span class="section-label">El PDF incluirá</span>
          <ul class="content-list">
            <li>Portada institucional DAGMA</li>
            <li>Resumen ejecutivo con indicadores y tablas</li>
            <li>Distribución territorial por comuna y barrio</li>
            <li>Detalle por grupo operativo ({gruposIncluidos.length} grupos seleccionados)</li>
            {#if incluirFotos}<li>Evidencias fotográficas</li>{/if}
            {#if incluirDescripciones}<li>Descripciones de intervenciones</li>{/if}
          </ul>
        </div>

        <!-- Período aplicado -->
        <div class="range-summary">
          <span class="field-label">Período:</span>
          {#if fechaDesde && fechaHasta}
            {fechaDesde} — {fechaHasta}
          {:else}
            Todos los registros disponibles
          {/if}
        </div>

      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm" type="button" on:click={() => (step = 1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><polyline points="15 18 9 12 15 6"/></svg>
          Volver
        </button>
        <button
          class="btn btn-primary btn-sm"
          type="button"
          on:click={handleGenerar}
          disabled={generating || previewStats.total === 0}
        >
          {#if generating}
            <span class="spinner-xs"></span>
            Generando...
          {:else}
            {@html iconDoc}
            Descargar PDF
          {/if}
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* ── Overlay ────────────────────────────────────────────────────────────── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    z-index: 1080;
    backdrop-filter: blur(3px);
  }

  /* ── Modal shell ─────────────────────────────────────────────────────────── */
  .modal {
    position: fixed;
    z-index: 1081;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(540px, 96vw);
    max-height: 88vh;
    background: var(--surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── Header ─────────────────────────────────────────────────────────────── */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--border-light);
    background: var(--surface-alt);
    gap: var(--space-3);
  }

  .modal-header-left {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .modal-header-icon {
    width: 32px;
    height: 32px;
    border-radius: var(--radius);
    background: var(--primary);
    color: #fff;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .modal-header-icon :global(svg) {
    width: 14px;
    height: 14px;
  }

  .modal-title {
    font-size: var(--text-base);
    font-weight: var(--font-weight-bold);
    color: var(--slate-900);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .modal-subtitle {
    font-size: var(--text-sm);
    color: var(--text-muted);
    margin: 1px 0 0;
  }

  .btn-icon {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-muted);
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: all var(--transition);
    min-height: unset;
    padding: 0;
    flex-shrink: 0;
  }

  .btn-icon:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
  }

  /* ── Stepper ─────────────────────────────────────────────────────────────── */
  .stepper {
    display: flex;
    align-items: center;
    padding: var(--space-3) var(--space-5);
    border-bottom: 1px solid var(--border-light);
    gap: var(--space-2);
  }

  .step-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-muted);
    font-weight: var(--font-weight-medium);
  }

  .step-item.is-active {
    color: var(--primary);
    font-weight: var(--font-weight-semibold);
  }

  .step-item.is-done {
    color: var(--primary);
  }

  .step-num {
    width: 20px;
    height: 20px;
    border-radius: var(--radius-full);
    background: var(--surface-alt);
    border: 1px solid var(--border);
    color: var(--text-muted);
    display: grid;
    place-items: center;
    font-size: var(--text-xs);
    font-weight: var(--font-weight-bold);
    flex-shrink: 0;
  }

  .step-item.is-active .step-num {
    background: var(--primary);
    border-color: var(--primary);
    color: #fff;
  }

  .step-item.is-done .step-num {
    background: var(--primary);
    border-color: var(--primary);
    color: #fff;
    font-size: var(--text-2xs);
  }

  .step-label {
    white-space: nowrap;
  }

  .step-connector {
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* ── Error banner ────────────────────────────────────────────────────────── */
  .error-banner {
    padding: var(--space-2) var(--space-5);
    background: var(--red-50);
    color: var(--red-700);
    font-size: var(--text-sm);
    font-weight: var(--font-weight-medium);
    border-bottom: 1px solid var(--red-100);
  }

  /* ── Body ────────────────────────────────────────────────────────────────── */
  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  /* ── Form fields ─────────────────────────────────────────────────────────── */
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .field-label {
    font-size: var(--text-xs);
    font-weight: var(--font-weight-bold);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .field input[type="text"],
  .field input[type="date"] {
    height: var(--input-height);
    padding: 0 var(--input-padding-x);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: var(--text-base);
    color: var(--text-primary);
    background: var(--surface-alt);
    transition: border-color var(--transition), box-shadow var(--transition);
  }

  .field input:focus {
    border-color: var(--border-focus);
    background: var(--surface);
    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
    outline: none;
  }

  /* ── Period grid ─────────────────────────────────────────────────────────── */
  .period-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-1);
  }

  .period-opt {
    padding: var(--space-2) var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-alt);
    color: var(--text-secondary);
    font-size: var(--text-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all var(--transition);
    text-align: center;
    min-height: unset;
    height: var(--input-height);
  }

  .period-opt:hover:not(.is-active) {
    border-color: var(--primary);
    color: var(--primary);
    background: var(--green-50);
  }

  .period-opt.is-active {
    background: var(--primary);
    color: #fff;
    border-color: var(--primary);
    font-weight: var(--font-weight-semibold);
  }

  /* ── Date range personalizado ────────────────────────────────────────────── */
  .date-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .range-hint {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-sm);
    color: var(--primary);
    font-weight: var(--font-weight-medium);
    margin: 0;
  }

  /* ── Chips de grupo ──────────────────────────────────────────────────────── */
  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .chip {
    padding: 3px 10px;
    border-radius: var(--radius-full);
    border: 1.5px solid var(--chip-color, var(--border));
    background: transparent;
    color: var(--chip-color, var(--text-secondary));
    font-size: var(--text-sm);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    transition: all var(--transition);
    opacity: 0.5;
    min-height: unset;
    height: 26px;
  }

  .chip.is-selected {
    background: var(--chip-color, var(--primary));
    color: #fff;
    opacity: 1;
  }

  .chip:hover {
    opacity: 0.85;
  }

  /* ── Checkboxes ─────────────────────────────────────────────────────────── */
  .check-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .check-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    user-select: none;
    font-size: var(--text-base);
    color: var(--text-secondary);
  }

  .check-row input {
    width: 14px;
    height: 14px;
    accent-color: var(--primary);
    cursor: pointer;
    flex-shrink: 0;
  }

  /* ── Preview KPIs ────────────────────────────────────────────────────────── */
  .preview-kpis {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-2);
  }

  .kpi-box {
    background: var(--green-50);
    border: 1px solid var(--green-200);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .kpi-val {
    font-size: var(--text-2xl);
    font-weight: var(--font-weight-extrabold);
    color: var(--primary);
    line-height: var(--leading-none);
  }

  .kpi-label {
    font-size: var(--text-xs);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: var(--font-weight-semibold);
  }

  /* ── Section block ───────────────────────────────────────────────────────── */
  .section-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .section-label {
    font-size: var(--text-xs);
    font-weight: var(--font-weight-bold);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* ── Barras por grupo ────────────────────────────────────────────────────── */
  .group-bars {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .bar-row {
    display: grid;
    grid-template-columns: 88px 1fr 32px;
    align-items: center;
    gap: var(--space-2);
  }

  .bar-name {
    font-size: var(--text-sm);
    font-weight: var(--font-weight-semibold);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bar-track {
    height: 6px;
    background: var(--surface-alt);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: var(--radius-full);
    transition: width 0.4s ease;
    min-width: 2px;
  }

  .bar-count {
    font-size: var(--text-sm);
    font-weight: var(--font-weight-bold);
    color: var(--text-secondary);
    text-align: right;
  }

  /* ── Content list ────────────────────────────────────────────────────────── */
  .content-list {
    background: var(--surface-alt);
    border: 1px solid var(--border-light);
    border-radius: var(--radius);
    padding: var(--space-3) var(--space-4);
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    list-style: none;
  }

  .content-list li {
    font-size: var(--text-base);
    color: var(--text-secondary);
    padding-left: var(--space-3);
    position: relative;
  }

  .content-list li::before {
    content: "·";
    position: absolute;
    left: 0;
    color: var(--primary);
    font-weight: var(--font-weight-bold);
  }

  /* ── Range summary ───────────────────────────────────────────────────────── */
  .range-summary {
    font-size: var(--text-sm);
    color: var(--text-muted);
    background: var(--surface-alt);
    border: 1px solid var(--border-light);
    border-radius: var(--radius);
    padding: var(--space-2) var(--space-3);
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  /* ── Footer ──────────────────────────────────────────────────────────────── */
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-5);
    border-top: 1px solid var(--border-light);
    background: var(--surface-alt);
  }

  /* ── Spinner pequeño ─────────────────────────────────────────────────────── */
  .spinner-xs {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: var(--radius-full);
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Responsive ──────────────────────────────────────────────────────────── */
  @media (max-width: 560px) {
    .modal {
      width: 100vw;
      max-height: 100dvh;
      border-radius: 0;
      top: 0;
      left: 0;
      transform: none;
    }
    .period-grid { grid-template-columns: repeat(2, 1fr); }
    .preview-kpis { grid-template-columns: repeat(2, 1fr); }
    .date-row { grid-template-columns: 1fr; }
  }
</style>
