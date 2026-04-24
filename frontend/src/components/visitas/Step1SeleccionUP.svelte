<script lang="ts">
  import { onMount } from "svelte";
  import type { ActividadPlanDistritoVerde } from "../../types/actividades";
  import { getGoogleMapsUrl } from "../../api/actividades";
  import type { GrupoKey } from "../../lib/grupos";
  import { GRUPO_DISPLAY_NAMES } from "../../lib/grupos";

  export let actividades: ActividadPlanDistritoVerde[];
  export let selectedActividad: ActividadPlanDistritoVerde | null;
  export let onSelect: (actividad: ActividadPlanDistritoVerde) => void;
  export let onLoadActividades: () => Promise<void>;
  export let isLoading: boolean;
  export let grupoFiltro: GrupoKey | null = null;

  let searchTerm = "";

  // Paginacion
  let currentPage = 1;
  let itemsPerPage = 10;

  type ColumnKey =
    | "tipo_direccion"
    | "lider_actividad"
    | "objetivo_actividad"
    | "fecha_hora"
    | "observaciones";

  const columns: { key: ColumnKey; label: string; width?: string }[] = [
    { key: "tipo_direccion", label: "Tipo / Direccion", width: "220px" },
    { key: "lider_actividad", label: "Lider", width: "180px" },
    { key: "objetivo_actividad", label: "Objetivo", width: "260px" },
    { key: "fecha_hora", label: "Fecha / Hora", width: "160px" },
    { key: "observaciones", label: "Observaciones", width: "260px" },
  ];

  function parseFecha(f: string): number {
    if (!f) return 0;
    const parts = f.split("/");
    if (parts.length !== 3) return 0;
    const [d, m, y] = parts;
    return new Date(+y, +m - 1, +d).getTime();
  }

  $: grupoDisplayName = grupoFiltro ? GRUPO_DISPLAY_NAMES[grupoFiltro] : null;

  $: actividadesFiltradas = actividades
    .filter((a) =>
      grupoDisplayName
        ? a.grupos_requeridos?.some(
            (g) => g.toLowerCase() === grupoDisplayName!.toLowerCase(),
          )
        : true,
    )
    .sort((a, b) => parseFecha(b.fecha_actividad) - parseFecha(a.fecha_actividad));

  $: filteredActividades = actividadesFiltradas.filter((actividad) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const direccion = actividad.punto_encuentro?.direccion || "";

    return (
      actividad.tipo_jornada?.toLowerCase().includes(term) ||
      direccion.toLowerCase().includes(term) ||
      actividad.lider_actividad?.toLowerCase().includes(term) ||
      actividad.objetivo_actividad?.toLowerCase().includes(term) ||
      actividad.fecha_actividad?.toLowerCase().includes(term) ||
      actividad.hora_encuentro?.toLowerCase().includes(term) ||
      actividad.observaciones?.toLowerCase().includes(term)
    );
  });

  $: totalPages = Math.ceil(filteredActividades.length / itemsPerPage);
  $: paginatedActividades = filteredActividades.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  $: if (searchTerm) {
    currentPage = 1;
  }

  onMount(async () => {
    if (actividades.length === 0) {
      await onLoadActividades();
    }
  });

  function openGoogleMaps(actividad: ActividadPlanDistritoVerde) {
    const geometry = actividad.punto_encuentro?.geometry;

    if (!geometry?.coordinates || geometry.coordinates.length < 2) {
      alert("La actividad no tiene coordenadas registradas.");
      return;
    }

    const url = getGoogleMapsUrl({
      coordinates: geometry.coordinates as [number, number],
    });
    window.open(url, "_blank");
  }

  function handleSelectActividad(actividad: ActividadPlanDistritoVerde) {
    onSelect(actividad);
  }

  function getDireccion(actividad: ActividadPlanDistritoVerde): string {
    return actividad.punto_encuentro?.direccion || "-";
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }
</script>

<div class="step-container">
  <div class="step-header">
    <div class="step-header-top">
      <div>
        <h2 class="step-title">Selección de Actividad</h2>
        <p class="step-description">
          {#if grupoDisplayName}
            Actividades del grupo <strong>{grupoDisplayName}</strong>
          {:else}
            Busque y seleccione la actividad a reconocer
          {/if}
        </p>
      </div>
      <button class="btn-reload" on:click={onLoadActividades} disabled={isLoading} title="Recargar actividades">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class:spinning={isLoading}>
          <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        Recargar
      </button>
    </div>
  </div>

  <div class="step-content">
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Cargando actividades{grupoDisplayName ? ` de ${grupoDisplayName}` : ""}…</p>
      </div>
    {:else if actividadesFiltradas.length === 0 && !searchTerm}
      <!-- Empty state: no activities loaded or no matching grupo -->
      <div class="empty-full">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted)">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <p class="empty-title">Sin actividades{grupoDisplayName ? ` para ${grupoDisplayName}` : ""}</p>
        <p class="empty-sub">Intenta recargar o cambia el grupo seleccionado.</p>
        <button class="btn-primary-sm" on:click={onLoadActividades}>Recargar</button>
      </div>
    {:else}
      <!-- Toolbar -->
      <div class="toolbar">
        <div class="search-wrap">
          <svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar por dirección, líder, objetivo…"
            bind:value={searchTerm}
            class="search-input"
          />
          {#if searchTerm}
            <button class="search-clear" on:click={() => searchTerm = ""} title="Limpiar">✕</button>
          {/if}
        </div>
        <span class="results-badge">
          {filteredActividades.length} resultado{filteredActividades.length !== 1 ? "s" : ""}
        </span>
      </div>

      {#if filteredActividades.length === 0}
        <div class="empty-search">
          <p>No hay actividades que coincidan con "<strong>{searchTerm}</strong>"</p>
          <button class="btn-ghost-sm" on:click={() => searchTerm = ""}>Limpiar búsqueda</button>
        </div>
      {:else}
        <!-- Desktop table -->
        <div class="table-container">
          <table class="act-table">
            <thead>
              <tr>
                <th>Tipo / Dirección</th>
                <th>Líder</th>
                <th>Objetivo</th>
                <th>Fecha / Hora</th>
                <th style="width:100px"></th>
              </tr>
            </thead>
            <tbody>
              {#each paginatedActividades as actividad (actividad.id)}
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <tr
                  class:selected={selectedActividad?.id === actividad.id}
                  on:click={() => handleSelectActividad(actividad)}
                  on:keydown={(e) => e.key === 'Enter' && handleSelectActividad(actividad)}
                  title="Seleccionar actividad"
                >
                  <td>
                    <div class="cell-stack">
                      <span class="cell-primary">{actividad.tipo_jornada || "—"}</span>
                      <span class="cell-secondary">{getDireccion(actividad)}</span>
                      {#if actividad.grupos_requeridos?.length}
                        <span class="cell-tags">
                          {#each actividad.grupos_requeridos as g}
                            <span class="tag">{g}</span>
                          {/each}
                        </span>
                      {/if}
                    </div>
                  </td>
                  <td><span class="cell-lider">{actividad.lider_actividad || "—"}</span></td>
                  <td><span class="cell-objetivo">{actividad.objetivo_actividad || "—"}</span></td>
                  <td>
                    <div class="cell-stack">
                      <span class="cell-fecha">{actividad.fecha_actividad || "—"}</span>
                      <span class="cell-secondary">{actividad.hora_encuentro || ""}</span>
                    </div>
                  </td>
                  <!-- svelte-ignore a11y-click-events-have-key-events -->
                  <!-- svelte-ignore a11y-no-static-element-interactions -->
                  <td class="cell-actions" on:click|stopPropagation>
                    <button
                      class="btn-maps"
                      on:click={() => openGoogleMaps(actividad)}
                      disabled={!actividad.punto_encuentro?.geometry}
                      title={actividad.punto_encuentro?.geometry ? "Ver en Maps" : "Sin coordenadas"}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 0C5.2 0 3 2.2 3 5c0 3.9 5 11 5 11s5-7.1 5-11c0-2.8-2.2-5-5-5zm0 7.5c-1.4 0-2.5-1.1-2.5-2.5S6.6 2.5 8 2.5s2.5 1.1 2.5 2.5S9.4 7.5 8 7.5z"/>
                      </svg>
                    </button>
                    <button class="btn-select" on:click={() => handleSelectActividad(actividad)}>
                      Seleccionar
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Mobile cards -->
        <div class="cards-mobile">
          {#each paginatedActividades as actividad (actividad.id)}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
            <div
              role="button"
              tabindex="0"
              class="act-card"
              class:selected={selectedActividad?.id === actividad.id}
              on:click={() => handleSelectActividad(actividad)}
              on:keydown={(e) => e.key === 'Enter' && handleSelectActividad(actividad)}
            >
              <div class="act-card-top">
                <div class="act-card-main">
                  <span class="act-tipo">{actividad.tipo_jornada || "—"}</span>
                  <span class="act-dir">{getDireccion(actividad)}</span>
                </div>
                <div class="act-card-date">
                  <span>{actividad.fecha_actividad || "—"}</span>
                  {#if actividad.hora_encuentro}<span class="act-hora">{actividad.hora_encuentro}</span>{/if}
                </div>
              </div>
              {#if actividad.lider_actividad}
                <div class="act-lider">👤 {actividad.lider_actividad}</div>
              {/if}
              {#if actividad.objetivo_actividad}
                <div class="act-objetivo">{actividad.objetivo_actividad}</div>
              {/if}
              <div class="act-card-footer">
                {#if actividad.grupos_requeridos?.length}
                  <div class="cell-tags">
                    {#each actividad.grupos_requeridos as g}<span class="tag">{g}</span>{/each}
                  </div>
                {:else}
                  <span></span>
                {/if}
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <div class="act-card-btns" on:click|stopPropagation role="none">
                  <button
                    class="btn-maps"
                    on:click={() => openGoogleMaps(actividad)}
                    disabled={!actividad.punto_encuentro?.geometry}
                    title="Ver en Maps"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0C5.2 0 3 2.2 3 5c0 3.9 5 11 5 11s5-7.1 5-11c0-2.8-2.2-5-5-5zm0 7.5c-1.4 0-2.5-1.1-2.5-2.5S6.6 2.5 8 2.5s2.5 1.1 2.5 2.5S9.4 7.5 8 7.5z"/>
                    </svg>
                  </button>
                  <button class="btn-select" on:click={() => handleSelectActividad(actividad)}>
                    Seleccionar
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>

        <!-- Pagination -->
        {#if totalPages > 1}
          <div class="pagination">
            <span class="pagination-info">
              {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredActividades.length)} de {filteredActividades.length}
            </span>
            <div class="pagination-controls">
              <button class="btn-page" on:click={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>‹</button>
              {#each Array(totalPages) as _, i}
                {#if totalPages <= 7 || i === 0 || i === totalPages - 1 || Math.abs(i + 1 - currentPage) <= 1}
                  <button class="btn-page-number" class:active={currentPage === i + 1} on:click={() => goToPage(i + 1)}>{i + 1}</button>
                {:else if i === 1 || i === totalPages - 2}
                  <span class="page-ellipsis">…</span>
                {/if}
              {/each}
              <button class="btn-page" on:click={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>›</button>
            </div>
          </div>
        {/if}
      {/if}
    {/if}
  </div>
</div>

<style>
  /* ── Layout ── */
  .step-container { padding: 0.75rem 0; width: 100%; }

  .step-header { margin-bottom: 1.25rem; }
  .step-header-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .step-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.2rem;
  }
  .step-description { font-size: 0.8125rem; color: var(--text-secondary); }
  .step-description strong { color: var(--primary); font-weight: 600; }

  .step-content { display: flex; flex-direction: column; gap: 0.875rem; }

  /* ── Reload button ── */
  .btn-reload {
    display: inline-flex; align-items: center; gap: 0.375rem;
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    background: var(--surface); color: var(--text-secondary);
    font-size: 0.75rem; font-weight: 500; cursor: pointer;
    transition: all var(--transition); white-space: nowrap; flex-shrink: 0;
  }
  .btn-reload:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); background: var(--green-50, #f0fdf4); }
  .btn-reload:disabled { opacity: 0.6; cursor: not-allowed; }
  :global(.spinning) { animation: spin 0.8s linear infinite; }

  /* ── Loading ── */
  .loading-state {
    display: flex; flex-direction: column; align-items: center;
    gap: 0.75rem; padding: 3rem 1rem;
    color: var(--text-secondary); font-size: 0.875rem;
  }
  .spinner {
    width: 28px; height: 28px;
    border: 3px solid var(--border); border-top-color: var(--primary);
    border-radius: 50%; animation: spin 0.75s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Empty states ── */
  .empty-full {
    display: flex; flex-direction: column; align-items: center;
    gap: 0.625rem; padding: 3rem 1.5rem; text-align: center;
    border: 1px dashed var(--border); border-radius: var(--radius-md, 8px);
    background: var(--surface-alt, #f8fafc);
  }
  .empty-title { font-weight: 600; color: var(--text-primary); font-size: 0.9375rem; }
  .empty-sub { font-size: 0.8125rem; color: var(--text-muted, #9ca3af); }
  .empty-search {
    display: flex; flex-direction: column; align-items: center;
    gap: 0.5rem; padding: 2rem; text-align: center;
    color: var(--text-secondary); font-size: 0.875rem;
  }

  /* ── Toolbar ── */
  .toolbar {
    display: flex; gap: 0.75rem; align-items: center;
  }
  .search-wrap {
    position: relative; flex: 1; display: flex; align-items: center;
  }
  .search-icon {
    position: absolute; left: 0.625rem; color: var(--text-muted, #9ca3af); pointer-events: none;
  }
  .search-input {
    width: 100%;
    padding: 0.5rem 2.25rem 0.5rem 2rem;
    border: 1px solid var(--border); border-radius: var(--radius-sm, 6px);
    font-size: 0.8125rem; background: var(--surface); color: var(--text-primary);
    transition: border-color 0.2s, box-shadow 0.2s;
    height: var(--input-height, 38px);
  }
  .search-input:focus {
    outline: none; border-color: var(--border-focus, var(--primary));
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent);
  }
  .search-clear {
    position: absolute; right: 0.5rem; background: none; border: none;
    color: var(--text-muted, #9ca3af); cursor: pointer; font-size: 0.75rem;
    padding: 0.25rem; border-radius: 3px;
    transition: color 0.15s;
  }
  .search-clear:hover { color: var(--text-primary); }

  .results-badge {
    padding: 0.3rem 0.625rem;
    background: var(--surface-alt, #f8fafc); border: 1px solid var(--border);
    border-radius: 999px; font-size: 0.75rem;
    color: var(--text-secondary); white-space: nowrap; font-weight: 500;
  }

  /* ── Desktop table ── */
  .table-container {
    overflow-x: auto;
    border: 1px solid var(--border); border-radius: var(--radius-md, 8px);
    background: var(--surface); box-shadow: var(--shadow, 0 1px 3px rgba(0,0,0,.08));
  }
  .act-table {
    width: 100%; border-collapse: collapse; font-size: 0.8125rem;
  }
  .act-table thead { background: var(--primary); }
  .act-table th {
    padding: 0.625rem 0.875rem;
    text-align: left; font-weight: 600; font-size: 0.75rem;
    color: white; white-space: nowrap;
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .act-table td {
    padding: 0.625rem 0.875rem;
    border-bottom: 1px solid var(--border-light, var(--border));
    color: var(--text-primary); vertical-align: middle;
  }
  .act-table tbody tr { cursor: pointer; transition: background 0.15s; }
  .act-table tbody tr:last-child td { border-bottom: none; }
  .act-table tbody tr:hover { background: var(--green-50, #f0fdf4); }
  .act-table tbody tr.selected { background: color-mix(in srgb, var(--primary) 8%, transparent); }
  .act-table tbody tr.selected:hover { background: color-mix(in srgb, var(--primary) 14%, transparent); }

  /* mobile cards hidden on desktop */
  .cards-mobile { display: none; }

  /* ── Cell styles ── */
  .cell-stack { display: flex; flex-direction: column; gap: 0.15rem; }
  .cell-primary { font-weight: 600; font-size: 0.8125rem; color: var(--text-primary); }
  .cell-secondary { font-size: 0.75rem; color: var(--text-secondary); }
  .cell-lider { font-size: 0.8125rem; color: var(--text-primary); }
  .cell-objetivo { font-size: 0.8125rem; color: var(--text-secondary); }
  .cell-fecha { font-weight: 500; font-size: 0.8125rem; color: var(--text-primary); }
  .cell-tags { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.2rem; }
  .tag {
    display: inline-block; padding: 0.1rem 0.45rem;
    background: color-mix(in srgb, var(--primary) 10%, transparent);
    color: var(--primary); border-radius: 999px;
    font-size: 0.65rem; font-weight: 600;
  }
  td.cell-actions {
    display: flex; gap: 0.375rem; align-items: center; justify-content: flex-end;
    border-bottom: none !important;
    min-width: 90px;
  }

  /* ── Action buttons ── */
  .btn-maps {
    display: inline-flex; align-items: center; justify-content: center;
    width: 30px; height: 30px; border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--border); background: var(--surface);
    color: var(--text-secondary); cursor: pointer;
    transition: all 0.15s; flex-shrink: 0;
  }
  .btn-maps:hover:not(:disabled) { background: var(--green-50, #f0fdf4); color: var(--primary); border-color: var(--primary-light, var(--primary)); }
  .btn-maps:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-select {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 0.375rem 0.75rem; border-radius: var(--radius-sm, 6px);
    background: var(--primary); color: white; border: none;
    font-size: 0.75rem; font-weight: 600; cursor: pointer;
    transition: background 0.15s; white-space: nowrap;
  }
  .btn-select:hover { background: var(--primary-dark); }

  .btn-primary-sm {
    padding: 0.5rem 1.25rem; border-radius: var(--radius-sm, 6px);
    background: var(--primary); color: white; border: none;
    font-size: 0.8125rem; font-weight: 600; cursor: pointer;
    transition: background 0.15s;
  }
  .btn-primary-sm:hover { background: var(--primary-dark); }
  .btn-ghost-sm {
    padding: 0.375rem 0.875rem; border-radius: var(--radius-sm, 6px);
    background: none; color: var(--primary); border: 1px solid var(--border);
    font-size: 0.8125rem; cursor: pointer; transition: all 0.15s;
  }
  .btn-ghost-sm:hover { background: var(--green-50, #f0fdf4); border-color: var(--primary); }

  /* ── Pagination ── */
  .pagination {
    display: flex; align-items: center; justify-content: space-between;
    gap: 0.75rem; padding: 0.625rem 0.75rem;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius-sm, 6px); flex-wrap: wrap;
  }
  .pagination-info { font-size: 0.75rem; color: var(--text-muted, #9ca3af); }
  .pagination-controls { display: flex; gap: 0.25rem; align-items: center; }
  .btn-page {
    min-width: 32px; height: 32px; padding: 0 0.5rem;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius-sm, 6px); font-size: 0.875rem;
    color: var(--text-primary); cursor: pointer; transition: all 0.15s;
  }
  .btn-page:hover:not(:disabled) { background: var(--surface-alt, #f8fafc); border-color: var(--primary-light, var(--primary)); }
  .btn-page:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-page-number {
    min-width: 32px; height: 32px; padding: 0 0.375rem;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius-sm, 6px); font-size: 0.8125rem;
    color: var(--text-primary); cursor: pointer; transition: all 0.15s;
  }
  .btn-page-number:hover { background: var(--surface-alt, #f8fafc); border-color: var(--primary-light, var(--primary)); }
  .btn-page-number.active { background: var(--primary); color: white; border-color: var(--primary); font-weight: 600; }
  .page-ellipsis { padding: 0 0.25rem; color: var(--text-muted, #9ca3af); font-size: 0.875rem; }

  /* ── Responsive: mobile cards ── */
  @media (max-width: 640px) {
    .table-container { display: none; }
    .cards-mobile { display: flex; flex-direction: column; gap: 0.5rem; }

    .act-card {
      padding: 0.75rem; border: 1px solid var(--border);
      border-radius: var(--radius-md, 8px); background: var(--surface);
      cursor: pointer; transition: all 0.15s;
    }
    .act-card:hover { border-color: var(--primary-light, var(--primary)); background: var(--green-50, #f0fdf4); }
    .act-card.selected { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 6%, transparent); }

    .act-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.375rem; }
    .act-card-main { flex: 1; }
    .act-tipo { display: block; font-weight: 700; font-size: 0.875rem; color: var(--text-primary); }
    .act-dir { display: block; font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.1rem; }
    .act-card-date { text-align: right; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); white-space: nowrap; }
    .act-hora { display: block; font-size: 0.7rem; color: var(--text-muted, #9ca3af); }
    .act-lider { font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem; }
    .act-objetivo { font-size: 0.75rem; color: var(--text-muted, #9ca3af); margin-bottom: 0.375rem; line-height: 1.4; }

    .act-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-light, var(--border)); }
    .act-card-btns { display: flex; gap: 0.375rem; align-items: center; }

    .toolbar { flex-direction: column; }
    .results-badge { align-self: flex-start; }

    .pagination { justify-content: center; }
    .pagination-info { width: 100%; text-align: center; }
  }
</style>
