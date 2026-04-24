<script lang="ts">
  import type { ReporteIntervencion } from "../../api/visitas";

  export let reportes: ReporteIntervencion[] = [];

  const PAGE_SIZE = 24;
  let visibleCount = PAGE_SIZE;

  $: visible = reportes.slice(0, visibleCount);
  $: hasMore = visibleCount < reportes.length;
  $: if (reportes) visibleCount = PAGE_SIZE; // reset when filter changes

  const COLOR_MAP: Record<string, string> = {
    cuadrilla:  "#10b981",
    vivero:     "#3b82f6",
    gobernanza: "#f59e0b",
    ecosistemas:"#8b5cf6",
    umata:      "#ef4444",
  };

  function getColor(grupo: string | null | undefined): string {
    return COLOR_MAP[(grupo ?? "").toLowerCase()] ?? "#6b7280";
  }

  function getLabel(grupo: string | null | undefined): string {
    if (!grupo) return "Sin grupo";
    const g = grupo.toLowerCase();
    if (g.includes("cuadrilla"))  return "Cuadrilla";
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

  function getUbicacion(r: ReporteIntervencion): string | null {
    const parts = [r.barrio_vereda, r.comuna_corregimiento].filter(Boolean);
    if (parts.length > 0) return parts.join(" · ");
    if (r.direccion) return r.direccion;
    return null;
  }

  function isRecent(val: string | undefined): boolean {
    if (!val) return false;
    return Date.now() - new Date(val).getTime() < 7 * 86_400_000;
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
        {@const ubicacion = getUbicacion(r)}
        {@const rel = relativeDay(r.fecha_registro)}

        <div class="report-card" style="--c: {color}">
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
          </div>

          <div class="card-tipo">{r.tipo_intervencion || "Intervención"}</div>

          {#if detalle}
            <div class="card-detalle">{detalle}</div>
          {/if}

          <div class="card-meta">
            {#if impacto}
              <span class="meta-impacto">
                {impacto.value.toLocaleString("es-CO")}<em>{impacto.label}</em>
              </span>
            {/if}
            {#if ubicacion}
              <span class="meta-ubicacion">{ubicacion}</span>
            {/if}
            {#if r.registrado_por}
              <span class="meta-by">{r.registrado_por}</span>
            {/if}
            {#if (r.photos_uploaded ?? 0) > 0}
              <span class="meta-photos">{r.photos_uploaded} foto{r.photos_uploaded !== 1 ? "s" : ""}</span>
            {/if}
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

  .rel-date {
    color: #10b981;
    font-weight: 600;
  }

  .new-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #10b981;
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

  .meta-impacto em {
    font-style: normal;
    font-weight: 400;
    color: #64748b;
  }

  .meta-ubicacion {
    font-size: 11px;
    color: #475569;
  }

  .meta-by {
    font-size: 11px;
    color: #94a3b8;
    margin-left: auto;
  }

  .meta-photos {
    font-size: 10.5px;
    color: #3b82f6;
    font-weight: 600;
    background: #dbeafe;
    padding: 1px 6px;
    border-radius: 999px;
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
