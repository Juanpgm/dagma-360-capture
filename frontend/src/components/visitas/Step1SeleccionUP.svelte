<script lang="ts">
  import { onMount } from "svelte";
  import type { ActividadPlanDistritoVerde } from "../../types/actividades";
  import { getGoogleMapsUrl } from "../../api/actividades";

  export let actividades: ActividadPlanDistritoVerde[];
  export let selectedActividad: ActividadPlanDistritoVerde | null;
  export let onSelect: (actividad: ActividadPlanDistritoVerde) => void;
  export let onLoadActividades: () => Promise<void>;
  export let isLoading: boolean;
  export let userGrupo: string | string[] | null = null;

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

  const normalizeGroupValue = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const splitGroupValue = (value: string) =>
    value
      .split(/[;,/|]/g)
      .map((item) => item.trim())
      .filter(Boolean);

  const toGroupStrings = (value: unknown): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.flatMap((item) => toGroupStrings(item));
    }
    if (typeof value === "string" || typeof value === "number") {
      return splitGroupValue(String(value));
    }
    if (typeof value === "object") {
      const nested =
        (value as { grupo?: string; nombre?: string; name?: string }).grupo ||
        (value as { nombre?: string }).nombre ||
        (value as { name?: string }).name ||
        "";
      return nested ? splitGroupValue(String(nested)) : [];
    }
    return [];
  };

  $: normalizedUserGroups = toGroupStrings(userGrupo)
    .map((grupo) => normalizeGroupValue(grupo))
    .filter(Boolean);

  $: actividadesPorGrupo = normalizedUserGroups.length
    ? actividades.filter((actividad) => {
        const normalizedActivityGroups = toGroupStrings(
          actividad.grupos_requeridos || [],
        ).map((grupo) => normalizeGroupValue(grupo));
        return normalizedActivityGroups.some((grupo) =>
          normalizedUserGroups.includes(grupo),
        );
      })
    : [];

  $: filteredActividades = actividadesPorGrupo.filter((actividad) => {
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
    <h2 class="step-title">Seleccion de Actividad</h2>
    <p class="step-description">Busque y seleccione la actividad a reconocer</p>
  </div>

  <div class="step-content">
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Cargando Actividades</p>
      </div>
    {:else}
      <div class="toolbar">
        <input
          type="text"
          placeholder="Buscar por direccion, lider, objetivo..."
          bind:value={searchTerm}
          class="search-input"
        />

        <div class="toolbar-actions">
          <span class="results-count">
            {filteredActividades.length} actividad(es)
          </span>
        </div>
      </div>

      <div class="table-container">
        <table class="projects-table">
          <thead>
            <tr>
              {#each columns as column}
                <th style="width: {column.width || 'auto'}">{column.label}</th>
              {/each}
              <th style="width: 140px">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#if filteredActividades.length === 0}
              <tr>
                <td colspan={columns.length + 1} class="empty-state">
                  {normalizedUserGroups.length === 0
                    ? "No se pudo determinar el grupo del usuario"
                    : "No se encontraron actividades para tu grupo"}
                </td>
              </tr>
            {:else}
              {#each paginatedActividades as actividad}
                <tr class:selected={selectedActividad?.id === actividad.id}>
                  <td>
                    <div class="cell-stack">
                      <span class="cell-primary"
                        >{actividad.tipo_jornada || "-"}</span
                      >
                      <span class="cell-secondary"
                        >{getDireccion(actividad)}</span
                      >
                      <span class="cell-tertiary">
                        {actividad.grupos_requeridos?.length
                          ? actividad.grupos_requeridos.join(", ")
                          : "-"}
                      </span>
                    </div>
                  </td>
                  <td>{actividad.lider_actividad || "-"}</td>
                  <td>{actividad.objetivo_actividad || "-"}</td>
                  <td>
                    <div class="cell-stack">
                      <span class="cell-primary"
                        >{actividad.fecha_actividad || "-"}</span
                      >
                      <span class="cell-secondary"
                        >{actividad.hora_encuentro || "-"}</span
                      >
                    </div>
                  </td>
                  <td>{actividad.observaciones || "-"}</td>
                  <td class="actions-cell">
                    <div class="actions-cell-inner">
                      <button
                        class="btn-action btn-maps"
                        on:click={() => openGoogleMaps(actividad)}
                        disabled={!actividad.punto_encuentro?.geometry}
                        title={actividad.punto_encuentro?.geometry
                          ? "Abrir en Google Maps"
                          : "Sin coordenadas"}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                        >
                          <path
                            d="M8 0C5.2 0 3 2.2 3 5c0 3.9 5 11 5 11s5-7.1 5-11c0-2.8-2.2-5-5-5zm0 7.5c-1.4 0-2.5-1.1-2.5-2.5S6.6 2.5 8 2.5s2.5 1.1 2.5 2.5S9.4 7.5 8 7.5z"
                          />
                        </svg>
                      </button>
                      <button
                        class="btn-action btn-select"
                        on:click={() => handleSelectActividad(actividad)}
                      >
                        Seleccionar
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>

      {#if filteredActividades.length > 0}
        <div class="pagination">
          <div class="pagination-info">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} -
            {Math.min(currentPage * itemsPerPage, filteredActividades.length)} de
            {filteredActividades.length}
          </div>

          <div class="pagination-controls">
            <button
              class="btn-page"
              on:click={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              ‹ Anterior
            </button>

            <div class="page-numbers">
              {#each Array(totalPages) as _, i}
                {#if totalPages <= 5 || i === 0 || i === totalPages - 1 || Math.abs(i + 1 - currentPage) <= 1}
                  <button
                    class="btn-page-number"
                    class:active={currentPage === i + 1}
                    on:click={() => goToPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                {:else if i === 1 || i === totalPages - 2}
                  <span class="page-ellipsis">...</span>
                {/if}
              {/each}
            </div>

            <button
              class="btn-page"
              on:click={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Siguiente ›
            </button>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .step-container {
    padding: 1rem;
    width: 100%;
    max-width: 100%;
  }

  .step-header {
    margin-bottom: 1.5rem;
  }

  .step-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .step-description {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .step-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem 1rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    gap: 1rem;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .search-input {
    flex: 1;
    min-width: 250px;
    padding: 0.625rem 0.875rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.875rem;
    transition: border-color 0.2s;
    background: white;
    color: var(--text-primary);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--shadow);
  }

  .toolbar-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
  }

  /* GPS Indicator */
  .gps-indicator {
    display: flex;
    align-items: center;
  }

  .gps-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
    white-space: nowrap;
  }

  .gps-status.capturing {
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #fbbf24;
  }

  .gps-status.active {
    background: #d1fae5;
    color: #065f46;
    border: 1px solid #10b981;
  }

  .gps-status.inactive {
    background: #f3f4f6;
    color: #6b7280;
    border: 1px solid #d1d5db;
  }

  .spinner-small {
    width: 14px;
    height: 14px;
    border: 2px solid #fbbf24;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  .btn-retry {
    padding: 0.125rem 0.5rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 0.75rem;
    color: #4b5563;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-retry:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .btn-toggle-columns {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-toggle-columns:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .results-count {
    font-size: 0.875rem;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  /* Column Selector */
  .column-selector {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 1rem;
  }

  .column-selector-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.75rem;
  }

  .column-options {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.5rem;
  }

  .column-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
  }

  .column-option input[type="checkbox"] {
    cursor: pointer;
  }

  /* Table */
  .table-container {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: white;
    box-shadow: 0 1px 3px var(--shadow);
  }

  .projects-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .projects-table thead {
    background: var(--primary-dark);
    border-bottom: 2px solid var(--primary-dark);
  }

  .projects-table th {
    padding: 0.75rem 0.875rem;
    text-align: left;
    font-weight: 600;
    color: #ffffff;
    white-space: nowrap;
    position: sticky;
    top: 0;
    background: var(--primary-dark);
    z-index: 10;
  }

  .projects-table td {
    padding: 0.75rem 0.875rem;
    border-bottom: 1px solid var(--border);
    color: var(--text-primary);
    vertical-align: middle;
  }

  .projects-table tbody tr {
    transition: background-color 0.15s;
  }

  .projects-table tbody tr:hover {
    background: var(--surface);
  }

  .projects-table tbody tr.selected {
    background: #ecfdf5;
  }

  .projects-table tbody tr.selected:hover {
    background: #d1fae5;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem !important;
    color: var(--text-secondary);
    font-style: italic;
  }

  .projects-table td.actions-cell {
    border-bottom: none;
    vertical-align: middle;
  }

  .actions-cell-inner {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
  }

  .btn-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.5rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
    white-space: nowrap;
  }

  .btn-maps {
    background: var(--surface);
    color: var(--primary-dark);
    border-color: var(--border);
    padding: 0.5rem;
  }

  .btn-maps:hover:not(:disabled) {
    background: #dcfce7;
    border-color: var(--primary-light);
  }

  .btn-maps:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-select {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
    padding: 0.5rem 0.75rem;
  }

  .btn-select:hover {
    background: var(--primary-dark);
    border-color: var(--primary-dark);
  }

  /* Paginación */
  .pagination {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: center;
    padding: 0.75rem;
    background: white;
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .pagination-info {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .pagination-controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
  }

  .btn-page {
    padding: 0.5rem 0.875rem;
    background: white;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-page:hover:not(:disabled) {
    background: var(--surface);
    border-color: var(--primary-light);
  }

  .btn-page:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-numbers {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }

  .btn-page-number {
    min-width: 36px;
    height: 36px;
    padding: 0.5rem;
    background: white;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-page-number:hover {
    background: var(--surface);
    border-color: var(--primary-light);
  }

  .btn-page-number.active {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
  }

  .page-ellipsis {
    padding: 0 0.25rem;
    color: var(--text-secondary);
  }

  .cell-stack {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .cell-primary {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .cell-secondary {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .cell-tertiary {
    font-size: 0.7rem;
    color: var(--text-secondary);
  }

  /* Status Badges */
  .badge {
    display: inline-block;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .badge-success {
    background-color: #d1fae5;
    color: #065f46;
  }

  .badge-warning {
    background-color: #fef3c7;
    color: #92400e;
  }

  .badge-info {
    background-color: #dbeafe;
    color: #1e40af;
  }

  .badge-secondary {
    background-color: #f3f4f6;
    color: #374151;
  }

  .badge-default {
    background-color: #e5e7eb;
    color: #6b7280;
  }

  /* Selected Preview */
  /* Responsive */
  @media (max-width: 768px) {
    .toolbar {
      flex-direction: column;
      align-items: stretch;
    }

    .search-input {
      min-width: 100%;
    }

    .toolbar-actions {
      justify-content: space-between;
    }

    .column-options {
      grid-template-columns: 1fr;
    }

    .table-container {
      font-size: 0.75rem;
    }

    .projects-table th,
    .projects-table td {
      padding: 0.5rem 0.25rem;
      font-size: 0.75rem;
    }

    .btn-action {
      padding: 0.375rem;
      font-size: 0.7rem;
    }

    .btn-select {
      padding: 0.375rem 0.5rem;
    }

    .pagination {
      font-size: 0.8125rem;
    }

    .btn-page,
    .btn-page-number {
      padding: 0.375rem 0.5rem;
      font-size: 0.8125rem;
      min-width: 32px;
      height: 32px;
    }
  }
</style>
