<script lang="ts">
  import { onMount } from "svelte";
  import {
    getActividadesPlanDistritoVerde,
    getGoogleMapsUrl,
  } from "../../api/actividades";
  import type { ActividadPlanDistritoVerde } from "../../types/actividades";

  // Estado
  let actividades: ActividadPlanDistritoVerde[] = [];
  let filteredActividades: ActividadPlanDistritoVerde[] = [];
  let loading = true;
  let error = "";

  // Filtros
  let searchQuery = "";
  let selectedGrupo = "";
  let selectedTipoJornada = "";
  let selectedLider = "";
  let fechaDesde = "";
  let fechaHasta = "";

  // Opciones para filtros
  let grupos: string[] = [];
  let tiposJornada: string[] = [];
  let lideres: string[] = [];

  onMount(async () => {
    try {
      loading = true;
      error = "";

      console.log("[Convocatorias] Iniciando carga de actividades...");
      actividades = await getActividadesPlanDistritoVerde();
      console.log("[Convocatorias] Actividades cargadas:", actividades.length);

      // Extraer opciones únicas para filtros
      // Extraer todos los grupos de los arrays
      const allGrupos = actividades.flatMap((a) => a.grupos_requeridos || []);
      grupos = [...new Set(allGrupos)].sort();

      tiposJornada = [
        ...new Set(actividades.map((a) => a.tipo_jornada).filter(Boolean)),
      ].sort();
      lideres = [
        ...new Set(actividades.map((a) => a.lider_actividad).filter(Boolean)),
      ].sort();

      filteredActividades = actividades;
      console.log("[Convocatorias] Filtros configurados correctamente");
    } catch (err) {
      console.error("[Convocatorias] Error al cargar actividades:", err);
      error = "Error al cargar las actividades. Por favor, intenta de nuevo.";
    } finally {
      loading = false;
    }
  });

  // Aplicar filtros
  $: {
    filteredActividades = actividades.filter((actividad) => {
      // Filtro de búsqueda general
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchableText = [
          actividad.tipo_jornada,
          actividad.punto_encuentro?.direccion,
          actividad.objetivo_actividad,
          actividad.lider_actividad,
          actividad.observaciones,
          ...(actividad.grupos_requeridos || []),
        ]
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(query)) return false;
      }

      // Filtro por grupo (buscar en el array de grupos)
      if (
        selectedGrupo &&
        !actividad.grupos_requeridos?.includes(selectedGrupo)
      )
        return false;

      // Filtro por tipo de jornada
      if (selectedTipoJornada && actividad.tipo_jornada !== selectedTipoJornada)
        return false;

      // Filtro por líder
      if (selectedLider && actividad.lider_actividad !== selectedLider)
        return false;

      // Filtro por fecha desde
      if (fechaDesde) {
        const fechaAct = parseDateDDMMYYYY(actividad.fecha_actividad);
        const fechaD = new Date(fechaDesde);
        if (fechaAct < fechaD) return false;
      }

      // Filtro por fecha hasta
      if (fechaHasta) {
        const fechaAct = parseDateDDMMYYYY(actividad.fecha_actividad);
        const fechaH = new Date(fechaHasta);
        if (fechaAct > fechaH) return false;
      }

      return true;
    });
  }

  // Parsear fecha en formato DD/MM/YYYY
  function parseDateDDMMYYYY(dateString: string): Date {
    if (!dateString) return new Date();
    const [day, month, year] = dateString.split("/");
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  function formatDate(dateString: string): string {
    if (!dateString) return "-";
    try {
      const date = parseDateDDMMYYYY(dateString);
      return date.toLocaleDateString("es-CO", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  }

  function openGoogleMaps(geometry: { coordinates: [number, number] }) {
    const [longitude, latitude] = geometry.coordinates;

    // Intentar obtener la ubicación del usuario para mostrar direcciones
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Si se obtiene la ubicación, mostrar dirección desde la ubicación actual
          const { latitude: userLat, longitude: userLng } = position.coords;
          const url = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${latitude},${longitude}&travelmode=driving`;
          window.open(url, "_blank");
        },
        (error) => {
          // Si falla la geolocalización, solo mostrar el punto de destino
          console.warn("No se pudo obtener la ubicación:", error);
          const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
          window.open(url, "_blank");
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 300000, // 5 minutos de cache
        },
      );
    } else {
      // Si el navegador no soporta geolocalización, solo mostrar el destino
      const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      window.open(url, "_blank");
    }
  }

  function resetFilters() {
    searchQuery = "";
    selectedGrupo = "";
    selectedTipoJornada = "";
    selectedLider = "";
    fechaDesde = "";
    fechaHasta = "";
  }

  async function retry() {
    loading = true;
    error = "";
    try {
      console.log("[Convocatorias] Reintentando carga...");
      actividades = await getActividadesPlanDistritoVerde();

      const allGrupos = actividades.flatMap((a) => a.grupos_requeridos || []);
      grupos = [...new Set(allGrupos)].sort();
      tiposJornada = [
        ...new Set(actividades.map((a) => a.tipo_jornada).filter(Boolean)),
      ].sort();
      lideres = [
        ...new Set(actividades.map((a) => a.lider_actividad).filter(Boolean)),
      ].sort();
      filteredActividades = actividades;
    } catch (err) {
      console.error("[Convocatorias] Error al reintentar:", err);
      error = "Error al cargar las actividades. Por favor, intenta de nuevo.";
    } finally {
      loading = false;
    }
  }
</script>

<div class="convocatorias-container">
  <div class="convocatorias-content">
    <div class="header-section">
      <div>
        <h1 class="page-title">Plan Distrito Verde</h1>
        <p class="page-subtitle">
          Gestión de actividades y jornadas programadas
        </p>
      </div>
      <div class="stats">
        <div class="stat-item">
          <span class="stat-value">{filteredActividades.length}</span>
          <span class="stat-label">Actividades</span>
        </div>
      </div>
    </div>

    <!-- Controles de filtrado -->
    <div class="filters-section">
      <div class="search-bar">
        <input
          type="text"
          placeholder="Buscar en todas las columnas..."
          bind:value={searchQuery}
        />
      </div>

      <div class="filters-grid">
        <select bind:value={selectedGrupo}>
          <option value="">Todos los grupos</option>
          {#each grupos as grupo}
            <option value={grupo}>{grupo}</option>
          {/each}
        </select>

        <select bind:value={selectedTipoJornada}>
          <option value="">Todos los tipos</option>
          {#each tiposJornada as tipo}
            <option value={tipo}>{tipo}</option>
          {/each}
        </select>

        <select bind:value={selectedLider}>
          <option value="">Todos los líderes</option>
          {#each lideres as lider}
            <option value={lider}>{lider}</option>
          {/each}
        </select>

        <input type="date" bind:value={fechaDesde} placeholder="Fecha desde" />

        <input type="date" bind:value={fechaHasta} placeholder="Fecha hasta" />

        <button class="btn-reset" on:click={resetFilters}>
          Limpiar filtros
        </button>
      </div>
    </div>

    {#if loading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Cargando actividades...</p>
      </div>
    {:else if error}
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Error al cargar datos</h3>
        <p>{error}</p>
        <p class="error-hint">
          Verifica tu conexión a internet o revisa la consola del navegador
          (F12) para más detalles.
        </p>
        <button class="btn-retry" on:click={retry}> 🔄 Reintentar </button>
      </div>
    {:else if filteredActividades.length === 0}
      <div class="empty-state">
        <h3>No se encontraron actividades</h3>
        <p>Intenta ajustar los filtros de búsqueda</p>
      </div>
    {:else}
      <!-- Tabla de actividades -->
      <div class="table-container">
        <table class="actividades-table">
          <thead>
            <tr>
              <th>Información Básica</th>
              <th>Objetivo</th>
              <th>Grupos</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredActividades as actividad}
              <tr>
                <td class="info-cell">
                  <div class="info-stack">
                    <div class="info-item">
                      <span class="badge-tipo"
                        >{actividad.tipo_jornada || "-"}</span
                      >
                    </div>
                    <div class="info-item">
                      <span class="info-text direccion"
                        >{actividad.punto_encuentro?.direccion || "-"}</span
                      >
                    </div>
                    <div class="info-item">
                      <span class="info-label">Fecha Actividad:</span>
                      <span class="info-text"
                        >{formatDate(actividad.fecha_actividad)}</span
                      >
                    </div>
                    <div class="info-item">
                      <span class="info-label">Hora de encuentro:</span>
                      <span class="info-text"
                        >{actividad.hora_encuentro || "-"}</span
                      >
                    </div>
                    <div class="info-item">
                      <button
                        class="btn-location-inline"
                        on:click={() =>
                          openGoogleMaps(actividad.punto_encuentro.geometry)}
                        title="Ver ubicacion en Google Maps"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path
                            d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                          ></path>
                          <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        <span>Ver Ubicacion</span>
                      </button>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Líder:</span>
                      <span class="info-text"
                        >{actividad.lider_actividad || "-"}</span
                      >
                    </div>
                    <div class="info-item grupos-inline">
                      <details class="grupos-disclosure">
                        <summary>Grupos</summary>
                        <div class="grupos-container grupos-compact">
                          {#each actividad.grupos_requeridos || [] as grupo}
                            <span class="badge-grupo">{grupo}</span>
                          {/each}
                        </div>
                      </details>
                    </div>
                  </div>
                </td>
                <td class="objetivo-cell">
                  <div class="objetivo-content">
                    <div class="objetivo-text">
                      {actividad.objetivo_actividad || "-"}
                    </div>
                    <div class="observaciones-section">
                      <span class="observaciones-label">Observaciones:</span>
                      <span class="observaciones-text">
                        {actividad.observaciones || "N/A"}
                      </span>
                    </div>
                  </div>
                </td>
                <td class="grupos-cell">
                  <div class="grupos-container">
                    {#each actividad.grupos_requeridos || [] as grupo}
                      <span class="badge-grupo">{grupo}</span>
                    {/each}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<style>
  .convocatorias-container {
    min-height: calc(100vh - 80px);
    background-color: var(--surface);
    padding: 2rem 1.5rem;
  }

  .convocatorias-content {
    max-width: 1400px;
    margin: 0 auto;
  }

  /* Header */
  .header-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    gap: 2rem;
  }

  .page-title {
    color: var(--text-primary);
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .page-subtitle {
    color: var(--text-secondary);
    font-size: 1rem;
  }

  .stats {
    display: flex;
    gap: 1.5rem;
  }

  .stat-item {
    background: white;
    padding: 1rem 1.5rem;
    border-radius: 0.75rem;
    box-shadow: 0 2px 4px var(--shadow);
    border: 2px solid var(--border);
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 2rem;
    font-weight: 700;
    color: var(--primary);
    line-height: 1;
  }

  .stat-label {
    display: block;
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  /* Filtros */
  .filters-section {
    background: white;
    padding: 1.5rem;
    border-radius: 1rem;
    box-shadow: 0 2px 8px var(--shadow);
    margin-bottom: 2rem;
    border: 2px solid var(--border);
  }

  .search-bar {
    position: relative;
    margin-bottom: 1rem;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 1.25rem;
  }

  .search-bar input {
    width: 100%;
    padding: 0.875rem 1rem 0.875rem 3rem;
    border: 2px solid var(--border);
    border-radius: 0.75rem;
    font-size: 1rem;
    transition: all 0.2s;
    background: var(--surface);
  }

  .search-bar input:focus {
    outline: none;
    border-color: var(--primary);
    background: white;
  }

  .filters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
  }

  .filters-grid select,
  .filters-grid input[type="date"] {
    padding: 0.75rem 1rem;
    border: 2px solid var(--border);
    border-radius: 0.75rem;
    font-size: 0.875rem;
    background: var(--surface);
    cursor: pointer;
    transition: all 0.2s;
  }

  .filters-grid select:focus,
  .filters-grid input[type="date"]:focus {
    outline: none;
    border-color: var(--primary);
    background: white;
  }

  .btn-reset {
    padding: 0.75rem 1.5rem;
    background-color: var(--text-secondary);
    color: white;
    border: none;
    border-radius: 0.75rem;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-reset:hover {
    background-color: var(--text-primary);
    transform: translateY(-1px);
  }

  /* Estados */
  .loading-state,
  .error-state,
  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background: white;
    border-radius: 1rem;
    box-shadow: 0 2px 8px var(--shadow);
    border: 2px solid var(--border);
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-icon,
  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .loading-state p,
  .error-state p,
  .empty-state p {
    color: var(--text-secondary);
    margin-top: 0.5rem;
  }

  .error-state h3,
  .empty-state h3 {
    color: var(--text-primary);
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .error-hint {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 1rem !important;
    font-style: italic;
  }

  .btn-retry {
    margin-top: 1.5rem;
    padding: 0.75rem 2rem;
    background-color: var(--primary);
    color: white;
    border: none;
    border-radius: 0.75rem;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-retry:hover {
    background-color: var(--primary-dark);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--shadow);
  }

  .btn-retry:active {
    transform: translateY(0);
  }

  /* Tabla */
  .table-container {
    background: white;
    border-radius: 1rem;
    box-shadow: 0 2px 8px var(--shadow);
    overflow: hidden;
    border: 2px solid var(--border);
  }

  .actividades-table {
    width: 100%;
    border-collapse: collapse;
  }

  .actividades-table thead {
    background: linear-gradient(135deg, var(--primary-dark), var(--primary));
    color: white;
  }

  .actividades-table th {
    padding: 1rem 0.75rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .actividades-table tbody tr {
    border-bottom: 1px solid var(--border);
    transition: background-color 0.2s;
  }

  .actividades-table tbody tr:hover {
    background-color: var(--surface);
  }

  .actividades-table tbody tr:last-child {
    border-bottom: none;
  }

  .actividades-table td {
    padding: 1rem 0.75rem;
    font-size: 0.875rem;
    color: var(--text-primary);
    vertical-align: top;
  }

  /* Columna de información básica */
  .info-cell {
    min-width: 250px;
    width: 18%;
  }

  .info-stack {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .info-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
    font-weight: 600;
    min-width: 50px;
  }

  .info-text {
    color: var(--text-primary);
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .info-text.direccion {
    font-weight: 700;
    text-decoration: underline;
  }

  .badge-tipo {
    display: inline-block;
    padding: 0.375rem 0.75rem;
    background: var(--primary-light);
    color: white;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.75rem;
    white-space: nowrap;
  }

  /* Columna de objetivo - más ancha */
  .objetivo-cell {
    width: 50%;
    min-width: 400px;
    line-height: 1.6;
    color: var(--text-primary);
  }

  .objetivo-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .objetivo-text {
    font-weight: 500;
    line-height: 1.6;
  }

  .observaciones-section {
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .observaciones-label {
    color: var(--text-secondary);
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .observaciones-text {
    color: var(--text-secondary);
    font-style: italic;
    line-height: 1.5;
    font-size: 0.875rem;
  }

  /* Columna de grupos */
  .grupos-cell {
    width: 1%;
    min-width: 90px;
    max-width: 140px;
  }

  .grupos-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .badge-grupo {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    background: var(--text-secondary);
    color: white;
    border-radius: 0.375rem;
    font-weight: 600;
    font-size: 0.65rem;
    white-space: nowrap;
  }

  .grupos-inline {
    display: none;
  }

  .grupos-disclosure {
    width: 100%;
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 0.5rem;
    padding: 0.35rem 0.5rem;
  }

  .grupos-disclosure summary {
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .grupos-disclosure summary::marker {
    display: none;
  }

  .grupos-disclosure summary::after {
    content: "v";
    font-size: 0.75rem;
    margin-left: 0.5rem;
  }

  .grupos-disclosure[open] summary::after {
    content: "^";
  }

  .grupos-compact {
    margin-top: 0.4rem;
  }

  .btn-location-inline {
    background: rgba(5, 150, 105, 0.08);
    border: 1px solid rgba(5, 150, 105, 0.2);
    color: var(--primary-dark);
    padding: 0.35rem 0.7rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 1px 3px rgba(5, 150, 105, 0.15);
  }

  .btn-location-inline svg {
    width: 14px;
    height: 14px;
  }

  .btn-location-inline:hover {
    border-color: var(--primary);
    background: rgba(5, 150, 105, 0.14);
    color: var(--primary);
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(5, 150, 105, 0.18);
  }

  /* Responsive */
  @media (max-width: 1200px) {
    .table-container {
      overflow-x: auto;
    }

    .actividades-table {
      min-width: 1000px;
    }

    .objetivo-cell {
      min-width: 250px;
    }
  }

  @media (max-width: 768px) {
    .convocatorias-container {
      padding: 1rem;
    }

    .header-section {
      flex-direction: column;
    }

    .page-title {
      font-size: 1.5rem;
    }

    .filters-grid {
      grid-template-columns: 1fr;
    }

    .actividades-table th:nth-child(3),
    .grupos-cell {
      display: none;
    }

    .grupos-inline {
      display: flex;
    }
  }

  @media (max-width: 640px) {
    .actividades-table th:nth-child(3),
    .grupos-cell {
      display: none;
    }

    .grupos-inline {
      display: flex;
    }
  }
</style>
