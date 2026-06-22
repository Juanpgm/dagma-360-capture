<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { ReporteIntervencion } from "../../api/visitas";
  import ReporteEditModal from "./ReporteEditModal.svelte";
  import { authStore, permissions } from "../../stores/authStore";
  import { canonicalGrupoKey } from "../../lib/grupos";

  export let reportes: ReporteIntervencion[] = [];

  const dispatch = createEventDispatcher<{ updated: ReporteIntervencion }>();

  const PAGE_SIZE = 24;
  let visibleCount = PAGE_SIZE;

  $: visible = reportes.slice(0, visibleCount);
  $: hasMore = visibleCount < reportes.length;
  $: if (reportes) visibleCount = PAGE_SIZE; // reset when filter changes

  // ── Edit modal state ──
  let editReporte: ReporteIntervencion | null = null;
  let editModalOpen = false;

  function openEdit(r: ReporteIntervencion) {
    editReporte = r;
    editModalOpen = true;
  }

  function handleUpdated(event: CustomEvent<ReporteIntervencion>) {
    dispatch("updated", event.detail);
    editModalOpen = false;
  }

  // ── Colores por grupo ──
  const COLOR_MAP: Record<string, string> = {
    flora_urbana: "#10b981",
    vivero:     "#3b82f6",
    gobernanza: "#f59e0b",
    ecosistemas:"#8b5cf6",
    umata:      "#ef4444",
  };

  function getColor(grupo: string | null | undefined): string {
    const canonical = canonicalGrupoKey(grupo);
    return COLOR_MAP[canonical] ?? COLOR_MAP[(grupo ?? "").toLowerCase()] ?? "#6b7280";
  }

  function getLabel(grupo: string | null | undefined): string {
    if (!grupo) return "Sin grupo";
    if (canonicalGrupoKey(grupo) === "flora_urbana") return "Flora urbana";
    const g = grupo.toLowerCase();
    if (g.includes("vivero"))     return "Vivero";
    if (g.includes("gobernanza")) return "Gobernanza";
    if (g.includes("ecosistema")) return "Ecosistemas";
    if (g.includes("umata"))      return "UMATA";
    return grupo;
  }

  function formatDate(val: string | undefined): string {
    if (!val) return "—";
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
  }

  function relativeDay(val: string | undefined): string | null {
    if (!val) return null;
    const ms = Date.now() - new Date(val).getTime();
    const days = Math.floor(ms / 86_400_000);
    if (days === 0) return "Hoy";
    if (days === 1) return "Ayer";
    if (days < 7)  return `Hace ${days} días`;
    return null;
  }

  function getImpacto(r: ReporteIntervencion): { value: number; label: string } | null {
    if (r.numero_individuos_intervenidos != null)
      return { value: r.numero_individuos_intervenidos, label: "individuos" };
    if (r.cantidad_total_plantas != null)
      return { value: r.cantidad_total_plantas, label: "plantas" };
    if (r.unidades_impactadas != null)
      return { value: r.unidades_impactadas, label: r.unidad_medida ?? "unid." };
    return null;
  }

  function getDetalle(r: ReporteIntervencion): string | null {
    if (r.tipo_arbol) return r.tipo_arbol;
    if (r.tipos_plantas) {
      const e = Object.entries(r.tipos_plantas);
      if (e.length > 0) return e.map(([k, v]) => `${k} (${v})`).join(", ");
    }
    if (r.descripcion_intervencion) return r.descripcion_intervencion;
    return null;
  }

  function isRecent(val: string | undefined): boolean {
    if (!val) return false;
    return Date.now() - new Date(val).getTime() < 7 * 86_400_000;
  }

  // Estado de actividad → color y etiqueta
  const ESTADO_ACT_COLORS: Record<string, string> = {
    "Programada":    "#3b82f6",
    "En ejecución":  "#f59e0b",
    "Finalizada":    "#10b981",
  };
  function getActEstadoColor(estado: string | null | undefined): string {
    return ESTADO_ACT_COLORS[estado ?? ""] ?? "#94a3b8";
  }

  // En el panel de dashboard, editar se reserva a administrador o superior
  // ($permissions.canEdit). Los operadores editan sus propios reportes desde la
  // vista principal de Reportes. El backend enforcea la autorización por reporte.
  $: canEdit = $permissions.canEdit;

  // Expandir/colapsar info de actividad por tarjeta
  let expandedActivity: Set<string> = new Set();
  function toggleActivity(id: string) {
    if (expandedActivity.has(id)) expandedActivity.delete(id);
    else expandedActivity.add(id);
    expandedActivity = expandedActivity; // trigger reactivity
  }
</script>

<div class="list-wrap">
  {#if reportes.length === 0}
    <div class="empty-state">Sin reportes para los filtros aplicados</div>
  {:else}
    <div class="cards-grid">
      {#each visible as r, rIdx (r.id)}
        {@const color = getColor(r.grupo)}
        {@const impacto = getImpacto(r)}
        {@const detalle = getDetalle(r)}
        {@const rel = relativeDay(r.fecha_registro)}
        {@const hasActivity = !!r.actividad_codigo}
        {@const actExpanded = expandedActivity.has(r.id)}

        <div class="report-card" style="--c: {color}">
          <!-- ── Top row ── -->
          <div class="card-top">
            <span class="grupo-pill" style="color:{color}; background:{color}15; border-color:{color}28">
              {getLabel(r.grupo)}
            </span>
            <span class="record-num" title="Número de registro">#{reportes.length - rIdx}</span>
            <span class="card-date">
              {#if rel}<span class="rel-date">{rel}</span>{:else}{formatDate(r.fecha_registro)}{/if}
            </span>
            {#if isRecent(r.fecha_registro)}
              <span class="new-dot" title="Últimos 7 días"></span>
            {/if}
            {#if r.editado}
              <span class="edited-badge" title="Editado">✏️</span>
            {/if}
          </div>

          <!-- ── Tipo ── -->
          <div class="card-tipo">{r.tipo_intervencion || "Intervención"}</div>

          {#if detalle}
            <div class="card-detalle">{detalle}</div>
          {/if}

          <!-- ── Actividad badge ── -->
          {#if hasActivity}
            <button
              class="activity-badge"
              type="button"
              on:click={() => toggleActivity(r.id)}
              title="Ver datos de actividad"
              aria-expanded={actExpanded}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {r.actividad_tipo_jornada ?? r.actividad_codigo}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"
                style="transform: rotate({actExpanded ? '180deg' : '0deg'}); transition: transform 150ms">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {#if actExpanded}
              <div class="activity-panel">
                <div class="act-row">
                  <span class="act-label">Código</span>
                  <span class="act-value act-code">{r.actividad_codigo}</span>
                </div>
                {#if r.actividad_lider}
                  <div class="act-row">
                    <span class="act-label">Líder</span>
                    <span class="act-value">{r.actividad_lider}</span>
                  </div>
                {/if}
                {#if r.actividad_estado}
                  <div class="act-row">
                    <span class="act-label">Estado</span>
                    <span class="act-estado" style="color:{getActEstadoColor(r.actividad_estado)}; border-color:{getActEstadoColor(r.actividad_estado)}40">
                      {r.actividad_estado}
                    </span>
                  </div>
                {/if}
                {#if r.actividad_fecha}
                  <div class="act-row">
                    <span class="act-label">Fecha actividad</span>
                    <span class="act-value">{r.actividad_fecha}</span>
                  </div>
                {/if}
                {#if r.actividad_objetivo}
                  <div class="act-row act-row-full">
                    <span class="act-label">Objetivo</span>
                    <span class="act-value act-objetivo">{r.actividad_objetivo}</span>
                  </div>
                {/if}
              </div>
            {/if}
          {/if}

          <!-- ── Meta footer ── -->
          <div class="card-meta">
            {#if impacto}
              <span class="meta-impacto">
                {impacto.value.toLocaleString("es-CO")}<em>{impacto.label}</em>
              </span>
            {/if}
            {#if (r.photos_uploaded ?? 0) > 0}
              <span class="meta-photos">{r.photos_uploaded} foto{r.photos_uploaded !== 1 ? "s" : ""}</span>
            {/if}

            <!-- ── Botón editar ── -->
            <button
              class="btn-edit"
              type="button"
              title="Editar reporte"
              on:click={() => openEdit(r)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
              </svg>
            </button>
          </div>
        </div>
      {/each}
    </div>

    {#if hasMore}
      <button class="load-more" on:click={() => (visibleCount += PAGE_SIZE)}>
        Mostrar más · {reportes.length - visibleCount} restantes
      </button>
    {/if}
  {/if}
</div>

<!-- ── Modal de edición ── -->
<ReporteEditModal
  bind:open={editModalOpen}
  reporte={editReporte}
  on:updated={handleUpdated}
  on:close={() => (editModalOpen = false)}
/>

<style>
  .list-wrap {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #94a3b8;
    font-size: 0.875rem;
  }

  /* ── Grid ── */
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 10px;
  }

  /* ── Card ── */
  .report-card {
    background: #fff;
    border: 1px solid #e9eef4;
    border-left: 3px solid var(--c);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .report-card:hover {
    box-shadow: 0 3px 14px rgba(0, 0, 0, 0.07);
    border-color: #d1dae6;
  }

  /* ── Top row ── */
  .card-top {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .grupo-pill {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 2px 7px;
    border-radius: 999px;
    border: 1px solid;
    white-space: nowrap;
  }

  .record-num {
    font-size: 9px;
    font-weight: 700;
    color: white;
    background: #1e40af;
    padding: 2px 5px;
    border-radius: 4px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .card-date {
    font-size: 11px;
    color: #94a3b8;
    margin-left: auto;
    white-space: nowrap;
  }

  .rel-date { color: #10b981; font-weight: 600; }

  .new-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #10b981;
    flex-shrink: 0;
  }

  .edited-badge {
    font-size: 10px;
    opacity: 0.7;
    flex-shrink: 0;
  }

  /* ── Tipo ── */
  .card-tipo {
    font-size: 13px;
    font-weight: 600;
    color: #1e293b;
    line-height: 1.3;
  }

  /* ── Detalle ── */
  .card-detalle {
    font-size: 12px;
    color: #64748b;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ── Activity badge ── */
  .activity-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 6px;
    color: #0284c7;
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
    transition: background 120ms;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .activity-badge:hover { background: #e0f2fe; }

  /* ── Activity panel ── */
  .activity-panel {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    animation: fadeIn 150ms ease;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

  .act-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 11px;
  }
  .act-row-full { flex-direction: column; gap: 2px; }
  .act-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #94a3b8;
    flex-shrink: 0;
    min-width: 60px;
  }
  .act-value { color: #334155; font-weight: 500; }
  .act-code {
    font-family: ui-monospace, 'SF Mono', monospace;
    background: #e0f2fe;
    color: #0369a1;
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 10px;
  }
  .act-estado {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 999px;
    border: 1px solid;
    background: transparent;
  }
  .act-objetivo {
    font-size: 11px;
    color: #475569;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ── Meta footer ── */
  .card-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    margin-top: 2px;
    padding-top: 7px;
    border-top: 1px solid #f1f5f9;
  }

  .meta-impacto {
    font-size: 12px;
    font-weight: 700;
    color: var(--c);
    display: flex;
    gap: 3px;
  }
  .meta-impacto em { font-style: normal; font-weight: 400; color: #64748b; }
  .meta-ubicacion { font-size: 11px; color: #475569; }
  .meta-by { font-size: 11px; color: #94a3b8; margin-left: auto; }
  .meta-photos {
    font-size: 10.5px;
    color: #3b82f6;
    font-weight: 600;
    background: #dbeafe;
    padding: 1px 6px;
    border-radius: 999px;
  }

  /* ── Edit button ── */
  .btn-edit {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #fff;
    color: #64748b;
    cursor: pointer;
    transition: all 120ms;
    flex-shrink: 0;
    margin-left: auto;
  }
  .btn-edit:hover {
    background: #f0fdf4;
    border-color: #059669;
    color: #059669;
  }

  /* ── Load more ── */
  .load-more {
    align-self: center;
    padding: 8px 28px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: white;
    color: #475569;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .load-more:hover {
    border-color: #10b981;
    color: #059669;
    background: #f0fdf4;
  }
</style>
