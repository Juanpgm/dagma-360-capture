<script lang="ts">
  import { onMount } from "svelte";
  import {
    obtenerReportes,
    type ReporteIntervencion,
  } from "../../api/visitas";
  import { GRUPO_KEYS } from "../../lib/grupos";
  import KPICard from "./KPICard.svelte";
  import MapaIntervenciones from "./MapaIntervenciones.svelte";
  import MapaCoropletico from "./MapaCoropletico.svelte";

  // Estado
  let reportes: ReporteIntervencion[] = [];
  let filteredReportes: ReporteIntervencion[] = [];
  let loading = true;
  let error: string | null = null;

  // Filtros
  let searchTerm = "";
  let selectedTipoIntervencion: string = "todos";
  let selectedGrupo: string = "todos";
  let dateFrom: string = "";
  let dateTo: string = "";
  let aggregationLevel: "comuna" | "barrio" = "comuna";

  // Paginación
  let currentPage = 1;
  let pageSize = 15;
  $: totalPages = Math.max(1, Math.ceil(filteredReportes.length / pageSize));
  $: pagedReportes = filteredReportes.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  // Reset página al cambiar filtros
  $: if (filteredReportes) currentPage = 1;

  // KPIs computados
  $: totalIntervenciones = filteredReportes.length;
  $: impactoPorUnidad = filteredReportes.reduce(
    (acc, r) => {
      const val = getImpacto(r);
      if (val === 0) return acc;
      const unit = getUnidadKey(r);
      acc[unit] = (acc[unit] || 0) + val;
      return acc;
    },
    {} as Record<string, number>,
  );
  $: tiposIntervencion = Array.from(
    new Set(reportes.map((r) => r.tipo_intervencion)),
  );
  $: gruposDisponibles = Array.from(
    new Set(reportes.map((r) => r.grupo).filter(Boolean)),
  ).sort();

  // Agregaciones para gráficas
  $: intervencionPorTipo = filteredReportes.reduce(
    (acc, r) => {
      acc[r.tipo_intervencion] = (acc[r.tipo_intervencion] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  $: reportesPorGrupo = filteredReportes.reduce(
    (acc, r) => {
      const g = r.grupo || "Sin grupo";
      acc[g] = (acc[g] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  $: topTiposIntervencion = Object.entries(intervencionPorTipo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Helpers para campos genéricos según grupo
  function getImpacto(r: ReporteIntervencion): number {
    if (r.numero_individuos_intervenidos != null)
      return r.numero_individuos_intervenidos;
    if (r.cantidad_total_plantas != null) return r.cantidad_total_plantas;
    if (r.unidades_impactadas != null) return r.unidades_impactadas;
    return 0;
  }

  function getUnidadKey(r: ReporteIntervencion): string {
    if (r.numero_individuos_intervenidos != null) return "Individuos";
    if (r.cantidad_total_plantas != null) return "Plantas";
    if (r.unidad_medida) return r.unidad_medida;
    if (r.unidades_impactadas != null) return "UND";
    return "UND";
  }

  const unidadIcons: Record<string, string> = {
    Individuos: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22V8M12 8c2-2 6-2 8 2s-2 6-8 6M12 8c-2-2-6-2-8 2s2 6 8 6"/></svg>`,
    Plantas: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 20h10M12 20v-6m0 0a4 4 0 004-4V4H8v6a4 4 0 004 4z"/></svg>`,
  };
  const defaultUnitIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9l-5 5-3-3-4 4"/></svg>`;

  function getDetalle(r: ReporteIntervencion): string {
    if (r.tipo_arbol) return r.tipo_arbol;
    if (r.tipos_plantas) {
      const entries = Object.entries(r.tipos_plantas);
      if (entries.length > 0)
        return entries.map(([k, v]) => `${k} (${v})`).join(", ");
    }
    if (r.unidad_medida) return r.unidad_medida;
    if (r.descripcion_intervencion) return r.descripcion_intervencion;
    return "N/A";
  }

  function getImpactoLabel(r: ReporteIntervencion): string {
    const grupo = (r.grupo || "").toLowerCase();
    if (grupo.includes("cuadrilla")) return "individuos";
    if (grupo.includes("vivero")) return "plantas";
    return "unidades";
  }

  // Aplicar filtros
  $: {
    filteredReportes = reportes.filter((reporte) => {
      // Búsqueda por texto
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchSearch =
          reporte.tipo_arbol?.toLowerCase().includes(term) ||
          reporte.descripcion_intervencion?.toLowerCase().includes(term) ||
          reporte.observaciones?.toLowerCase().includes(term) ||
          reporte.registrado_por?.toLowerCase().includes(term) ||
          reporte.direccion?.toLowerCase().includes(term);
        if (!matchSearch) return false;
      }

      // Filtro por tipo de intervención
      if (
        selectedTipoIntervencion !== "todos" &&
        reporte.tipo_intervencion !== selectedTipoIntervencion
      ) {
        return false;
      }

      // Filtro por grupo
      if (selectedGrupo !== "todos" && reporte.grupo !== selectedGrupo) {
        return false;
      }

      // Filtro por rango de fechas
      if (dateFrom && reporte.fecha_registro) {
        const reportDate = new Date(reporte.fecha_registro);
        const fromDate = new Date(dateFrom);
        if (reportDate < fromDate) return false;
      }

      if (dateTo && reporte.fecha_registro) {
        const reportDate = new Date(reporte.fecha_registro);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59);
        if (reportDate > toDate) return false;
      }

      return true;
    });
  }

  onMount(async () => {
    await cargarReportes();
  });

  async function cargarReportes() {
    try {
      loading = true;
      error = null;

      const resultados = await Promise.allSettled(
        GRUPO_KEYS.map((key) => obtenerReportes(key)),
      );

      let todosReportes: ReporteIntervencion[] = [];
      resultados.forEach((resultado) => {
        if (resultado.status === "fulfilled" && resultado.value?.data) {
          todosReportes = [...todosReportes, ...resultado.value.data];
        }
      });

      if (todosReportes.length === 0) {
        error = "No hay reportes de intervenciones disponibles.\n\nRegistre una intervención desde el módulo correspondiente para visualizar datos en el dashboard.";
        reportes = [];
        filteredReportes = [];
      } else {
        reportes = todosReportes;
        filteredReportes = reportes;
      }
    } catch (err: any) {
      error = err.message || "Error al cargar los reportes";
      reportes = [];
      filteredReportes = [];
    } finally {
      loading = false;
    }
  }

  function limpiarFiltros() {
    searchTerm = "";
    selectedTipoIntervencion = "todos";
    selectedGrupo = "todos";
    dateFrom = "";
    dateTo = "";
  }

  // SVG Icons
  const treeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 22V8M12 8c2-2 6-2 8 2s-2 6-8 6M12 8c-2-2-6-2-8 2s2 6 8 6"/>
  </svg>`;

  const chartIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M3 3v18h18"/><path d="M18 17V9l-5 5-3-3-4 4"/>
  </svg>`;

  const clipboardIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
    <rect x="9" y="3" width="6" height="4" rx="1"/>
    <path d="M9 12h6M9 16h6"/>
  </svg>`;
</script>

<div class="dashboard">
  {#if loading}
    <div class="loading-overlay">
      <div class="spinner"></div>
      <p>Cargando datos...</p>
    </div>
  {:else if error}
    <div class="error-overlay">
      <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <h2>Error al cargar datos</h2>
      <p>{error}</p>
      <button class="btn-retry" on:click={cargarReportes}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"
          />
        </svg>
        Reintentar
      </button>
    </div>
  {:else}
    <!-- Header con título -->
    <div class="dashboard-header">
      <div>
        <h1>Dashboard de Intervenciones</h1>
        <p class="subtitle">
          Análisis geográfico y estadístico de reportes de reconocimiento —
          Todos los grupos
        </p>
      </div>
      <button class="btn-refresh" on:click={cargarReportes}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"
          />
        </svg>
        Actualizar
      </button>
    </div>

    <!-- Filtros y controles -->
    <div class="filters-section">
      <div class="filters-row">
        <div class="search-box">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por descripción, operador, dirección..."
            bind:value={searchTerm}
          />
        </div>

        <select bind:value={selectedTipoIntervencion}>
          <option value="todos">Todos los tipos</option>
          {#each tiposIntervencion as tipo}
            <option value={tipo}>{tipo}</option>
          {/each}
        </select>

        <select bind:value={selectedGrupo}>
          <option value="todos">Todos los grupos</option>
          {#each gruposDisponibles as grupo}
            <option value={grupo}>{grupo}</option>
          {/each}
        </select>

        <input type="date" bind:value={dateFrom} placeholder="Desde" />
        <input type="date" bind:value={dateTo} placeholder="Hasta" />

        <button class="btn-clear" on:click={limpiarFiltros}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          Limpiar
        </button>
      </div>

      <div class="aggregation-toggle">
        <label>
          <input
            type="radio"
            name="aggregation"
            value="comuna"
            bind:group={aggregationLevel}
          />
          <span>Por Comuna</span>
        </label>
        <label>
          <input
            type="radio"
            name="aggregation"
            value="barrio"
            bind:group={aggregationLevel}
          />
          <span>Por Barrio</span>
        </label>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpis-grid">
      <KPICard
        title="Total Intervenciones"
        value={totalIntervenciones}
        subtitle="Registros filtrados"
        icon={clipboardIcon}
      />
      {#each Object.entries(impactoPorUnidad).sort((a, b) => b[1] - a[1]) as [unidad, total]}
        <KPICard
          title="Impacto ({unidad})"
          value={total.toLocaleString("es-CO")}
          subtitle={unidad === "Individuos"
            ? "Árboles intervenidos"
            : unidad === "Plantas"
              ? "Plantas en vivero"
              : `Medido en ${unidad}`}
          icon={unidadIcons[unidad] || defaultUnitIcon}
        />
      {/each}
      <KPICard
        title="Tipos de Intervención"
        value={Object.keys(intervencionPorTipo).length}
        subtitle="Categorías activas"
        icon={chartIcon}
      />
      <KPICard
        title="Grupos Activos"
        value={Object.keys(reportesPorGrupo).length}
        subtitle="Con reportes registrados"
        icon={chartIcon}
      />
    </div>

    <!-- Mapas lado a lado -->
    <div class="maps-grid">
      <MapaIntervenciones {filteredReportes} />
      <MapaCoropletico {filteredReportes} {aggregationLevel} />
    </div>

    <!-- Gráficas -->
    <div class="charts-grid">
      <div class="chart-card">
        <h3>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          Intervenciones por Tipo
        </h3>
        <div class="chart-bars">
          {#each Object.entries(intervencionPorTipo) as [tipo, count]}
            <div class="bar-item">
              <div class="bar-label">{tipo}</div>
              <div class="bar-container">
                <div
                  class="bar-fill"
                  style="width: {(count / totalIntervenciones) * 100}%"
                  class:poda={tipo === "Poda"}
                  class:tala={tipo === "Tala"}
                  class:mantenimiento={tipo === "Mantenimiento arbóreo"}
                ></div>
                <span class="bar-value">{count}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <div class="chart-card">
        <h3>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Reportes por Grupo
        </h3>
        <div class="chart-bars">
          {#each Object.entries(reportesPorGrupo).sort((a, b) => b[1] - a[1]) as [grupo, count]}
            <div class="bar-item">
              <div class="bar-label">{grupo}</div>
              <div class="bar-container">
                <div
                  class="bar-fill grupo-bar"
                  style="width: {(count /
                    Math.max(...Object.values(reportesPorGrupo))) *
                    100}%"
                ></div>
                <span class="bar-value">{count}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Tabla de reportes -->
    <div class="table-section">
      <h3>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M3 3h18v18H3z" /><path d="M3 9h18M9 3v18" />
        </svg>
        Reportes Recientes ({filteredReportes.length})
      </h3>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Grupo</th>
              <th>Tipo Intervención</th>
              <th>Detalle</th>
              <th>Impacto</th>
              <th>Ubicación</th>
            </tr>
          </thead>
          <tbody>
            {#each pagedReportes as reporte}
              <tr>
                <td
                  >{reporte.fecha_registro
                    ? new Date(reporte.fecha_registro).toLocaleDateString(
                        "es-CO",
                      )
                    : "N/A"}</td
                >
                <td>
                  <span class="badge grupo">{reporte.grupo || "N/A"}</span>
                </td>
                <td>
                  <span
                    class="badge"
                    class:poda={reporte.tipo_intervencion === "Poda"}
                    class:tala={reporte.tipo_intervencion === "Tala"}
                    class:mantenimiento={reporte.tipo_intervencion ===
                      "Mantenimiento arbóreo"}
                  >
                    {reporte.tipo_intervencion}
                  </span>
                </td>
                <td class="detalle-cell">{getDetalle(reporte)}</td>
                <td class="center"
                  >{getImpacto(reporte)} {getImpactoLabel(reporte)}</td
                >
                <td class="location-cell">
                  {#if reporte.direccion}
                    {reporte.direccion}
                  {:else if reporte.comuna}
                    Comuna {reporte.comuna}
                  {:else if reporte.barrio}
                    {reporte.barrio}
                  {:else if reporte.coordinates_data}
                    {reporte.coordinates_data[1].toFixed(4)}, {reporte.coordinates_data[0].toFixed(
                      4,
                    )}
                  {:else}
                    N/A
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <!-- Paginador -->
      <div class="pagination">
        <div class="pagination-info">
          Mostrando {Math.min(
            (currentPage - 1) * pageSize + 1,
            filteredReportes.length,
          )}
          – {Math.min(currentPage * pageSize, filteredReportes.length)}
          de {filteredReportes.length}
        </div>
        <div class="pagination-controls">
          <select bind:value={pageSize} on:change={() => (currentPage = 1)}>
            <option value={10}>10 / pág</option>
            <option value={15}>15 / pág</option>
            <option value={25}>25 / pág</option>
            <option value={50}>50 / pág</option>
          </select>
          <button
            class="pg-btn"
            disabled={currentPage <= 1}
            on:click={() => (currentPage = 1)}>«</button
          >
          <button
            class="pg-btn"
            disabled={currentPage <= 1}
            on:click={() => currentPage--}>‹</button
          >
          <span class="pg-current">{currentPage} / {totalPages}</span>
          <button
            class="pg-btn"
            disabled={currentPage >= totalPages}
            on:click={() => currentPage++}>›</button
          >
          <button
            class="pg-btn"
            disabled={currentPage >= totalPages}
            on:click={() => (currentPage = totalPages)}>»</button
          >
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .dashboard {
    padding: 1.5rem;
    background: #f8fafc;
    min-height: 100vh;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    gap: 1rem;
  }

  .dashboard-header h1 {
    font-size: 1.75rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 0.25rem 0;
  }

  .subtitle {
    color: #64748b;
    font-size: 0.875rem;
    margin: 0;
  }

  .btn-refresh {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #059669;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;
  }

  .btn-refresh:hover {
    background: #f0fdf4;
    border-color: #059669;
  }

  /* Filtros */
  .filters-section {
    background: white;
    border-radius: 12px;
    padding: 1.25rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .filters-row {
    display: grid;
    grid-template-columns: 2fr repeat(4, 1fr) auto;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .search-box {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-box svg {
    position: absolute;
    left: 0.75rem;
    color: #94a3b8;
    pointer-events: none;
  }

  .search-box input {
    width: 100%;
    padding: 0.625rem 0.75rem 0.625rem 2.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.2s;
  }

  .search-box input:focus {
    border-color: #059669;
  }

  .filters-row select,
  .filters-row input[type="date"] {
    padding: 0.625rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.875rem;
    outline: none;
    background: white;
    transition: border-color 0.2s;
  }

  .filters-row select:focus,
  .filters-row input[type="date"]:focus {
    border-color: #059669;
  }

  .btn-clear {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.625rem 1rem;
    background: #fee2e2;
    border: none;
    border-radius: 8px;
    color: #dc2626;
    font-weight: 500;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .btn-clear:hover {
    background: #fecaca;
  }

  .aggregation-toggle {
    display: flex;
    gap: 1rem;
  }

  .aggregation-toggle label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    color: #64748b;
  }

  .aggregation-toggle input[type="radio"] {
    cursor: pointer;
  }

  /* KPIs Grid */
  .kpis-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  /* Mapas */
  .maps-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
    min-height: 500px;
  }

  /* Gráficas */
  .charts-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .chart-card {
    background: white;
    border-radius: 12px;
    padding: 1.25rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .chart-card h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 1rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .chart-bars {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .bar-item {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .bar-label {
    font-size: 0.875rem;
    color: #475569;
    font-weight: 500;
  }

  .bar-container {
    position: relative;
    display: flex;
    align-items: center;
    height: 32px;
    background: #f1f5f9;
    border-radius: 6px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    transition: width 0.5s ease;
    border-radius: 6px;
  }

  .bar-fill.poda {
    background: linear-gradient(90deg, #10b981, #059669);
  }

  .bar-fill.tala {
    background: linear-gradient(90deg, #ef4444, #dc2626);
  }

  .bar-fill.mantenimiento {
    background: linear-gradient(90deg, #3b82f6, #2563eb);
  }

  .bar-fill.grupo-bar {
    background: linear-gradient(90deg, #7c3aed, #6d28d9);
  }

  .bar-value {
    position: absolute;
    right: 0.75rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #1e293b;
  }

  /* Tabla */
  .table-section {
    background: white;
    border-radius: 12px;
    padding: 1.25rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .table-section h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 1rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .table-wrapper {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  thead {
    background: #f8fafc;
  }

  th {
    text-align: left;
    padding: 0.75rem 1rem;
    font-weight: 600;
    color: #475569;
    border-bottom: 2px solid #e2e8f0;
    white-space: nowrap;
  }

  td {
    padding: 0.875rem 1rem;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
  }

  td.center {
    text-align: center;
  }

  td.detalle-cell {
    max-width: 250px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  td.location-cell {
    color: #64748b;
    font-size: 0.8125rem;
  }

  tbody tr:hover {
    background: #f8fafc;
  }

  .badge {
    display: inline-block;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .badge.poda {
    background: #d1fae5;
    color: #065f46;
  }

  .badge.tala {
    background: #fee2e2;
    color: #991b1b;
  }

  .badge.mantenimiento {
    background: #dbeafe;
    color: #1e40af;
  }

  .badge.grupo {
    background: #ede9fe;
    color: #5b21b6;
  }

  /* Paginación */
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid #e2e8f0;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .pagination-info {
    font-size: 0.8125rem;
    color: #64748b;
  }

  .pagination-controls {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .pagination-controls select {
    padding: 0.375rem 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8125rem;
    background: white;
    outline: none;
    margin-right: 0.5rem;
  }

  .pg-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: white;
    color: #334155;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .pg-btn:hover:not(:disabled) {
    background: #f0fdf4;
    border-color: #059669;
    color: #059669;
  }

  .pg-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .pg-current {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #1e293b;
    padding: 0 0.5rem;
  }

  /* Loading */
  .loading-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    gap: 1rem;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e2e8f0;
    border-top-color: #059669;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Error */
  .error-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    gap: 1rem;
    text-align: center;
    padding: 2rem;
  }

  .error-overlay svg {
    color: #ef4444;
    margin-bottom: 1rem;
  }

  .error-overlay h2 {
    color: #1e293b;
    margin: 0;
    font-size: 1.5rem;
  }

  .error-overlay p {
    color: #64748b;
    margin: 0.5rem 0 1.5rem;
    max-width: 500px;
  }

  .btn-retry {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: #059669;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-retry:hover {
    background: #047857;
    transform: translateY(-1px);
  }

  .btn-retry svg {
    animation: spin 2s linear infinite;
  }

  .btn-retry:hover svg {
    animation-play-state: paused;
  }

  /* Responsividad */
  @media (max-width: 1200px) {
    .maps-grid,
    .charts-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .dashboard {
      padding: 1rem;
    }

    .dashboard-header {
      flex-direction: column;
    }

    .filters-row {
      grid-template-columns: 1fr;
    }

    .kpis-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .maps-grid {
      min-height: 400px;
    }

    td.detalle-cell {
      max-width: 150px;
    }
  }

  @media (max-width: 480px) {
    .kpis-grid {
      grid-template-columns: 1fr;
    }

    .aggregation-toggle {
      flex-direction: column;
      gap: 0.5rem;
    }
  }
</style>
