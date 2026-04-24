<script lang="ts">
  import { onMount } from "svelte";
  import { Bar, Line, Doughnut } from "svelte-chartjs";
  import {
    Chart as ChartJS,
    registerables,
  } from "chart.js";
  ChartJS.register(...registerables);

  import {
    obtenerReportes,
    type ReporteIntervencion,
  } from "../../api/visitas";
  import { GRUPO_KEYS } from "../../lib/grupos";
  import KPICard from "./KPICard.svelte";
  import MapaIntervenciones from "./MapaIntervenciones.svelte";
  import MapaCoropletico from "./MapaCoropletico.svelte";

  // ── Utilidades de color por grupo ───────────────────────────────────────────
  function getGrupoColor(grupo: string | null | undefined): string {
    if (!grupo) return "#6b7280";
    const g = grupo.toLowerCase();
    if (g.includes("cuadrilla")) return "#10b981";
    if (g.includes("vivero"))    return "#3b82f6";
    if (g.includes("gobernanza")) return "#f59e0b";
    if (g.includes("ecosistema")) return "#8b5cf6";
    if (g.includes("umata"))     return "#ef4444";
    return "#6b7280";
  }

  function getGrupoLabel(grupo: string | null | undefined): string {
    if (!grupo) return "Sin grupo";
    const g = grupo.toLowerCase();
    if (g.includes("cuadrilla"))  return "Cuadrilla";
    if (g.includes("vivero"))     return "Vivero";
    if (g.includes("gobernanza")) return "Gobernanza";
    if (g.includes("ecosistema")) return "Ecosistemas";
    if (g.includes("umata"))      return "UMATA";
    return grupo;
  }

  // ── Estado ──────────────────────────────────────────────────────────────────
  let reportes: ReporteIntervencion[] = [];
  let filteredReportes: ReporteIntervencion[] = [];
  let loading = true;
  let error: string | null = null;
  let lastUpdated: Date | null = null;

  // ── Filtros ─────────────────────────────────────────────────────────────────
  let searchTerm = "";
  let selectedTipoIntervencion = "todos";
  let selectedGrupo = "todos";
  let dateFrom = "";
  let dateTo = "";
  let aggregationLevel: "comuna" | "barrio" = "comuna";
  let activeTab: "graficas" | "tabla" = "tabla";
  let activeMapView: "puntos" | "coropletico" = "coropletico";
  let selectedComuna = "todas";
  let selectedBarrio = "todos";

  // ── Paginación ───────────────────────────────────────────────────────────────
  let currentPage = 1;
  let pageSize = 15;
  $: totalPages = Math.max(1, Math.ceil(filteredReportes.length / pageSize));
  $: pagedReportes = filteredReportes.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  $: if (filteredReportes) currentPage = 1;

  // ── KPIs computados ─────────────────────────────────────────────────────────
  $: totalIntervenciones = filteredReportes.length;

  $: comunasConIntervenciones = new Set(
    filteredReportes.map((r) => r.comuna_corregimiento).filter(Boolean),
  ).size;

  $: coberturaComuna = comunasConIntervenciones > 0
    ? Math.round((comunasConIntervenciones / 37) * 100)
    : 0;

  $: individuosIntervenidos = filteredReportes.reduce(
    (sum, r) => sum + (r.numero_individuos_intervenidos ?? 0), 0,
  );

  $: totalPlantas = filteredReportes.reduce(
    (sum, r) => sum + (r.cantidad_total_plantas ?? 0), 0,
  );

  $: areaImpactada = filteredReportes.reduce((sum, r) => {
    if (r.unidades_impactadas && r.unidad_medida) return sum + r.unidades_impactadas;
    return sum;
  }, 0);

  $: areaUnidad = (() => {
    const units = filteredReportes
      .filter((r) => r.unidades_impactadas && r.unidad_medida)
      .map((r) => r.unidad_medida!);
    if (units.length === 0) return "unid.";
    const freq: Record<string, number> = {};
    units.forEach((u) => { freq[u] = (freq[u] || 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  })();

  $: intervencionesEstaSemana = (() => {
    const hace7 = new Date();
    hace7.setDate(hace7.getDate() - 7);
    return filteredReportes.filter((r) => {
      const d = r.fecha_registro ? new Date(r.fecha_registro) : null;
      return d && d >= hace7;
    }).length;
  })();

  $: gruposActivos = new Set(
    filteredReportes.map((r) => r.grupo).filter(Boolean),
  ).size;

  $: promedioComuna = comunasConIntervenciones > 0
    ? (totalIntervenciones / comunasConIntervenciones).toFixed(1)
    : "0";

  // ── Agregaciones ────────────────────────────────────────────────────────────
  $: tiposIntervencion = Array.from(
    new Set(reportes.map((r) => r.tipo_intervencion)),
  ).filter(Boolean).sort();

  $: gruposDisponibles = Array.from(
    new Set(reportes.map((r) => r.grupo).filter(Boolean)),
  ).sort();

  $: intervencionPorTipo = filteredReportes.reduce(
    (acc, r) => {
      if (r.tipo_intervencion) acc[r.tipo_intervencion] = (acc[r.tipo_intervencion] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  $: reportesPorGrupo = filteredReportes.reduce(
    (acc, r) => {
      const g = getGrupoLabel(r.grupo);
      acc[g] = (acc[g] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  $: topComunas = (() => {
    const byArea: Record<string, number> = {};
    filteredReportes.forEach((r) => {
      const area = r.comuna_corregimiento || "Sin geo-datos";
      byArea[area] = (byArea[area] || 0) + 1;
    });
    const sorted = Object.entries(byArea).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const max = sorted.length > 0 ? sorted[0][1] : 1;
    return sorted.map(([area, count]) => ({ area, count, pct: Math.round((count / max) * 100), sinGeo: area === "Sin geo-datos" }));
  })();

  // ── Distribución por barrio / vereda ─────────────────────────────────────
  $: topBarrios = (() => {
    const byBarrio: Record<string, number> = {};
    filteredReportes.forEach((r) => {
      if (r.barrio_vereda) {
        byBarrio[r.barrio_vereda] = (byBarrio[r.barrio_vereda] || 0) + 1;
      }
    });
    const sorted = Object.entries(byBarrio).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const max = sorted.length > 0 ? sorted[0][1] : 1;
    return sorted.map(([barrio, count]) => ({ barrio, count, pct: Math.round((count / max) * 100) }));
  })();

  // ── Calidad de datos geográficos ─────────────────────────────────────────
  $: sinGeoData = filteredReportes.filter((r) => !r.comuna_corregimiento).length;

  // ── Dropdowns disponibles ────────────────────────────────────────────────
  $: comunasDisponibles = Array.from(
    new Set(reportes.map((r) => r.comuna_corregimiento).filter(Boolean) as string[])
  ).sort();

  $: barriosDisponibles = Array.from(
    new Set(reportes.map((r) => r.barrio_vereda).filter(Boolean) as string[])
  ).sort();

  // ── Chart.js: Timeline por mes ───────────────────────────────────────────────
  let timelineLabels: string[] = [];
  let timelineData: number[] = [];
  $: {
    const byMonth: Record<string, number> = {};
    filteredReportes.forEach((r) => {
      const d = r.fecha_registro ? new Date(r.fecha_registro) : null;
      if (!d || isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonth[key] = (byMonth[key] || 0) + 1;
    });
    const sortedKeys = Object.keys(byMonth).sort();
    const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    timelineLabels = sortedKeys.map((k) => {
      const [y, m] = k.split("-");
      return `${MONTHS[parseInt(m) - 1]} '${y.slice(2)}`;
    });
    timelineData = sortedKeys.map((k) => byMonth[k]);
  }

  $: lineChartData = {
    labels: timelineLabels,
    datasets: [
      {
        label: "Intervenciones",
        data: timelineData,
        fill: true,
        backgroundColor: "rgba(16, 185, 129, 0.12)",
        borderColor: "#059669",
        borderWidth: 2.5,
        pointBackgroundColor: "#059669",
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.4,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: "index" as const, intersect: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, color: "#94a3b8", font: { size: 11 } },
        grid: { color: "#f1f5f9" },
        border: { display: false },
      },
      x: {
        ticks: { color: "#94a3b8", font: { size: 11 } },
        grid: { display: false },
        border: { display: false },
      },
    },
  };

  // ── Chart.js: Tipos de intervención (barras horizontales) ───────────────────
  $: {
    const sorted = Object.entries(intervencionPorTipo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    tiposBarData = {
      labels: sorted.map(([k]) => k),
      datasets: [
        {
          label: "Intervenciones",
          data: sorted.map(([, v]) => v),
          backgroundColor: [
            "#10b981","#3b82f6","#f59e0b","#8b5cf6",
            "#ef4444","#06b6d4","#f97316","#84cc16",
          ],
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    };
  }
  let tiposBarData: any = { labels: [], datasets: [] };

  const tiposBarOptions = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.raw} intervenciones` } },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { stepSize: 1, color: "#94a3b8", font: { size: 11 } },
        grid: { color: "#f1f5f9" },
        border: { display: false },
      },
      y: {
        ticks: { color: "#334155", font: { size: 12 } },
        grid: { display: false },
        border: { display: false },
      },
    },
  };

  // ── Chart.js: Donut por grupo ────────────────────────────────────────────────
  $: {
    const entries = Object.entries(reportesPorGrupo);
    gruposDonutData = {
      labels: entries.map(([k]) => k),
      datasets: [
        {
          data: entries.map(([, v]) => v),
          backgroundColor: entries.map(([k]) => getGrupoColor(k)),
          borderWidth: 2,
          borderColor: "#ffffff",
          hoverOffset: 8,
        },
      ],
    };
  }
  let gruposDonutData: any = { labels: [], datasets: [] };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          boxWidth: 12,
          padding: 14,
          color: "#334155",
          font: { size: 12 },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : "0";
            return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
          },
        },
      },
    },
    cutout: "65%",
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function getImpacto(r: ReporteIntervencion): number {
    if (r.numero_individuos_intervenidos != null) return r.numero_individuos_intervenidos;
    if (r.cantidad_total_plantas != null) return r.cantidad_total_plantas;
    if (r.unidades_impactadas != null) return r.unidades_impactadas;
    return 0;
  }

  function getImpactoLabel(r: ReporteIntervencion): string {
    const g = (r.grupo || "").toLowerCase();
    if (g.includes("cuadrilla")) return "individuos";
    if (g.includes("vivero"))    return "plantas";
    return "unid.";
  }

  function getDetalle(r: ReporteIntervencion): string {
    if (r.tipo_arbol) return r.tipo_arbol;
    if (r.tipos_plantas) {
      const e = Object.entries(r.tipos_plantas);
      if (e.length > 0) return e.map(([k, v]) => `${k} (${v})`).join(", ");
    }
    if (r.unidad_medida) return r.unidad_medida;
    if (r.descripcion_intervencion) return r.descripcion_intervencion;
    return "—";
  }

  function formatDate(val: string | undefined): string {
    if (!val) return "—";
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "2-digit" });
  }

  // ── Filtrado reactivo ────────────────────────────────────────────────────────
  $: filteredReportes = reportes.filter((r) => {
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      const match =
        r.tipo_arbol?.toLowerCase().includes(t) ||
        r.descripcion_intervencion?.toLowerCase().includes(t) ||
        r.observaciones?.toLowerCase().includes(t) ||
        r.registrado_por?.toLowerCase().includes(t) ||
        r.direccion?.toLowerCase().includes(t) ||
        r.tipo_intervencion?.toLowerCase().includes(t) ||
        r.barrio_vereda?.toLowerCase().includes(t) ||
        r.comuna_corregimiento?.toLowerCase().includes(t);
      if (!match) return false;
    }
    if (selectedTipoIntervencion !== "todos" && r.tipo_intervencion !== selectedTipoIntervencion) return false;
    if (selectedGrupo !== "todos" && r.grupo !== selectedGrupo) return false;
    if (selectedComuna !== "todas" && r.comuna_corregimiento !== selectedComuna) return false;
    if (selectedBarrio !== "todos" && r.barrio_vereda !== selectedBarrio) return false;
    if (dateFrom && r.fecha_registro) {
      if (new Date(r.fecha_registro) < new Date(dateFrom)) return false;
    }
    if (dateTo && r.fecha_registro) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59);
      if (new Date(r.fecha_registro) > to) return false;
    }
    return true;
  });

  // ── Carga de datos ───────────────────────────────────────────────────────────
  onMount(async () => {
    await cargarReportes();
  });

  async function cargarReportes() {
    loading = true;
    error = null;
    try {
      const resultados = await Promise.allSettled(
        GRUPO_KEYS.map((key) => obtenerReportes(key)),
      );
      let todos: ReporteIntervencion[] = [];
      resultados.forEach((r) => {
        if (r.status === "fulfilled" && r.value?.data) {
          todos = [...todos, ...r.value.data];
        }
      });
      if (todos.length === 0) {
        error = "No hay reportes de intervenciones disponibles.\n\nRegistre una intervención desde el módulo correspondiente.";
        reportes = [];
      } else {
        reportes = todos;
        lastUpdated = new Date();
      }
    } catch (err: any) {
      error = err.message || "Error al cargar los reportes";
      reportes = [];
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
    selectedComuna = "todas";
    selectedBarrio = "todos";
  }

  function hayFiltrosActivos(): boolean {
    return !!(
      searchTerm ||
      selectedTipoIntervencion !== "todos" ||
      selectedGrupo !== "todos" ||
      dateFrom ||
      dateTo ||
      selectedComuna !== "todas" ||
      selectedBarrio !== "todos"
    );
  }

  // ── Iconos SVG ───────────────────────────────────────────────────────────────
  const icons = {
    total: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h6"/></svg>`,
    cobertura: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>`,
    tree: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22V8M12 8c2-2 6-2 8 2s-2 6-8 6M12 8c-2-2-6-2-8 2s2 6 8 6"/></svg>`,
    plant: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 20h10M12 20v-6m0 0a4 4 0 004-4V4H8v6a4 4 0 004 4z"/></svg>`,
    area: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke-width="1.5"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    group: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    avg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9l-5 5-3-3-4 4"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>`,
    filter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
    map: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>`,
    chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="6" height="18" rx="1"/><rect x="9" y="8" width="6" height="13" rx="1"/><rect x="16" y="13" width="6" height="8" rx="1"/></svg>`,
    table: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"/><path d="M3 9h18M9 3v18"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };
</script>

<div class="dashboard">
  {#if loading}
    <!-- ── Loading ── -->
    <div class="state-overlay">
      <div class="spinner"></div>
      <p class="state-msg">Cargando intervenciones…</p>
    </div>

  {:else if error}
    <!-- ── Error ── -->
    <div class="state-overlay">
      <div class="state-icon error-icon">{@html icons.info}</div>
      <h2>Sin datos disponibles</h2>
      <p class="state-msg">{error}</p>
      <button class="btn-primary" on:click={cargarReportes}>
        {@html icons.refresh} Reintentar
      </button>
    </div>

  {:else}
    <!-- ═══════════════════════════════════════════════════════════════════════
         HEADER
    ════════════════════════════════════════════════════════════════════════════ -->
    <div class="dashboard-header">
      <div class="header-left">
        <div class="header-badge">DAGMA · Gestión Ambiental</div>
        <h1>Dashboard de Intervenciones</h1>
        <p class="subtitle">
          Análisis geográfico y estadístico de reportes · Todos los grupos operativos
          {#if lastUpdated}
            <span class="updated-at">· Actualizado: {lastUpdated.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>
          {/if}
        </p>
      </div>
      <div class="header-actions">
        {#if hayFiltrosActivos()}
          <button class="btn-ghost" on:click={limpiarFiltros}>
            {@html icons.close} Limpiar filtros
          </button>
        {/if}
        <button class="btn-secondary" on:click={cargarReportes}>
          {@html icons.refresh} Actualizar
        </button>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════
         FILTROS
    ════════════════════════════════════════════════════════════════════════════ -->
    <div class="filters-card">
      <div class="filters-header">
        <span class="filters-label">{@html icons.filter} Filtros</span>
        {#if hayFiltrosActivos()}
          <span class="filter-active-badge">{filteredReportes.length} de {reportes.length}</span>
        {/if}
      </div>
      <div class="filters-row">
        <div class="search-box">
          {@html icons.search}
          <input
            type="text"
            placeholder="Buscar descripción, especie, dirección, barrio…"
            bind:value={searchTerm}
          />
        </div>
        <select bind:value={selectedTipoIntervencion}>
          <option value="todos">Tipo: Todos</option>
          {#each tiposIntervencion as tipo}
            <option value={tipo}>{tipo}</option>
          {/each}
        </select>
        <select bind:value={selectedGrupo}>
          <option value="todos">Grupo: Todos</option>
          {#each gruposDisponibles as grupo}
            <option value={grupo}>{getGrupoLabel(grupo)}</option>
          {/each}
        </select>
        {#if comunasDisponibles.length > 0}
          <select bind:value={selectedComuna}>
            <option value="todas">Comuna: Todas</option>
            {#each comunasDisponibles as c}
              <option value={c}>{c}</option>
            {/each}
          </select>
        {/if}
        {#if barriosDisponibles.length > 0}
          <select bind:value={selectedBarrio}>
            <option value="todos">Barrio: Todos</option>
            {#each barriosDisponibles as b}
              <option value={b}>{b}</option>
            {/each}
          </select>
        {/if}
        <div class="date-range">
          <input type="date" bind:value={dateFrom} title="Fecha desde" />
          <span class="date-sep">–</span>
          <input type="date" bind:value={dateTo} title="Fecha hasta" />
        </div>
        <div class="aggregation-toggle">
          <button
            class="agg-btn"
            class:active={aggregationLevel === "comuna"}
            on:click={() => (aggregationLevel = "comuna")}
          >
            Comunas
          </button>
          <button
            class="agg-btn"
            class:active={aggregationLevel === "barrio"}
            on:click={() => (aggregationLevel = "barrio")}
          >
            Barrios
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════
         LAYOUT: KPIs + Mapa
    ════════════════════════════════════════════════════════════════════════════ -->
    <div class="kpi-map-layout">
      <!-- Columna izquierda: KPI cards -->
      <div class="kpi-col">
        <div class="section-label">Indicadores de Gestión</div>
        <div class="kpis-grid">
          <KPICard
            title="Total Intervenciones"
            value={totalIntervenciones.toLocaleString("es-CO")}
            subtitle="Registros en el período"
            icon={icons.total}
            color="green"
          />
          <KPICard
            title="Cobertura Territorial"
            value="{coberturaComuna}%"
            subtitle="{comunasConIntervenciones} de 37 comunas"
            icon={icons.cobertura}
            color="teal"
            trend={coberturaComuna >= 50 ? "up" : coberturaComuna >= 25 ? "neutral" : "down"}
            trendValue="{comunasConIntervenciones} comunas"
          />
          <KPICard
            title="Esta Semana"
            value={intervencionesEstaSemana.toLocaleString("es-CO")}
            subtitle="Últimos 7 días"
            icon={icons.calendar}
            color="amber"
            trend={intervencionesEstaSemana > 0 ? "up" : "neutral"}
            trendValue={intervencionesEstaSemana > 0 ? "Activo" : "Sin registro"}
          />
          <KPICard
            title="Promedio / Comuna"
            value={promedioComuna}
            subtitle="Intervenciones por comunidad"
            icon={icons.avg}
            color="indigo"
          />
        </div>

        <div class="section-label">Impacto Ambiental</div>
        <div class="kpis-grid kpis-impact">
          {#if individuosIntervenidos > 0}
            <KPICard
              title="Árboles Intervenidos"
              value={individuosIntervenidos.toLocaleString("es-CO")}
              subtitle="Individuos · Cuadrilla"
              icon={icons.tree}
              color="green"
            />
          {/if}
          {#if totalPlantas > 0}
            <KPICard
              title="Plantas Producidas"
              value={totalPlantas.toLocaleString("es-CO")}
              subtitle="Unidades · Vivero"
              icon={icons.plant}
              color="blue"
            />
          {/if}
          {#if areaImpactada > 0}
            <KPICard
              title="Área Intervenida"
              value={areaImpactada.toLocaleString("es-CO")}
              subtitle="Medido en {areaUnidad}"
              icon={icons.area}
              color="purple"
            />
          {/if}
          <KPICard
            title="Grupos Activos"
            value={gruposActivos}
            subtitle="Con reportes registrados"
            icon={icons.group}
            color="red"
          />
          {#if sinGeoData > 0}
            <KPICard
              title="Sin Geo-datos"
              value={sinGeoData}
              subtitle="Registros sin ubicación validada"
              icon={icons.info}
              color="amber"
              trend="neutral"
              trendValue="Revisar GPS"
            />
          {/if}
        </div>
      </div>

      <!-- Columna derecha: Mapa siempre visible -->
      <div class="map-side">
        <div class="map-card map-card-unified">
          <div class="map-card-header">
            <div class="map-header-left">
              {#if activeMapView === "puntos"}
                <h3>Intervenciones</h3>
                <p>{filteredReportes.filter(r => r.coordinates_data?.length === 2).length} registros con coordenadas</p>
              {:else}
                <h3>Densidad por {aggregationLevel === "comuna" ? "comuna / corregimiento" : "barrio / vereda"}</h3>
                <p>Concentración de intervenciones por zona</p>
              {/if}
            </div>
            <div class="map-view-tabs">
              <button
                class="map-view-tab"
                class:active={activeMapView === "puntos"}
                on:click={() => (activeMapView = "puntos")}
              >Puntos</button>
              <button
                class="map-view-tab"
                class:active={activeMapView === "coropletico"}
                on:click={() => (activeMapView = "coropletico")}
              >Coroplético</button>
            </div>
          </div>
          <div class="map-body map-body-unified">
            {#if activeMapView === "puntos"}
              <MapaIntervenciones {filteredReportes} />
            {:else}
              <MapaCoropletico {filteredReportes} {aggregationLevel} />
            {/if}
          </div>
          <div class="map-legend" class:choropleth-legend={activeMapView === "coropletico"}>
            {#if activeMapView === "puntos"}
              {#each [["Cuadrilla","#10b981"],["Vivero","#3b82f6"],["Gobernanza","#f59e0b"],["Ecosistemas","#8b5cf6"],["UMATA","#ef4444"]] as [g, c]}
                <span class="legend-item">
                  <span class="legend-dot" style="background:{c}"></span>{g}
                </span>
              {/each}
            {:else}
              <span class="legend-label">Menor</span>
              {#each ["#f1f5f9","#a7f3d0","#6ee7b7","#34d399","#10b981","#059669","#064e3b"] as c}
                <span class="legend-swatch" style="background:{c}"></span>
              {/each}
              <span class="legend-label">Mayor</span>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════
         TABS: Análisis / Tabla
    ════════════════════════════════════════════════════════════════════════════ -->
    <div class="tab-bar">
      <button
        class="tab-btn"
        class:active={activeTab === "tabla"}
        on:click={() => (activeTab = "tabla")}
      >
        {@html icons.table} Tabla ({filteredReportes.length})
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === "graficas"}
        on:click={() => (activeTab = "graficas")}
      >
        {@html icons.chart} Análisis
      </button>
    </div>

    <!-- ════ TAB: GRÁFICAS ════ -->
    {#if activeTab === "graficas"}
      <!-- Timeline -->
      <div class="chart-card full-width">
        <div class="chart-header">
          <div>
            <h3>Tendencia Temporal</h3>
            <p>Intervenciones registradas por mes</p>
          </div>
          {#if timelineData.length === 0}
            <span class="no-data-badge">Sin datos de fechas</span>
          {/if}
        </div>
        {#if timelineData.length > 0}
          <div class="chart-area" style="height: 220px;">
            <Line data={lineChartData} options={lineOptions} />
          </div>
        {:else}
          <div class="empty-chart">
            <p>Los reportes no tienen fechas registradas</p>
          </div>
        {/if}
      </div>

      <div class="charts-row">
        <!-- Tipos de intervención -->
        <div class="chart-card">
          <div class="chart-header">
            <div>
              <h3>Por Tipo de Intervención</h3>
              <p>Top {Math.min(8, Object.keys(intervencionPorTipo).length)} tipos</p>
            </div>
          </div>
          {#if Object.keys(intervencionPorTipo).length > 0}
            <div class="chart-area" style="height: {Math.min(8, Object.keys(intervencionPorTipo).length) * 42 + 20}px; min-height: 160px;">
              <Bar data={tiposBarData} options={tiposBarOptions} />
            </div>
          {:else}
            <div class="empty-chart"><p>Sin datos de tipos</p></div>
          {/if}
        </div>

        <!-- Distribución por grupo -->
        <div class="chart-card">
          <div class="chart-header">
            <div>
              <h3>Distribución por Grupo</h3>
              <p>{Object.keys(reportesPorGrupo).length} grupos con reportes</p>
            </div>
          </div>
          {#if Object.keys(reportesPorGrupo).length > 0}
            <div class="chart-area donut-area" style="height: 260px;">
              <Doughnut data={gruposDonutData} options={donutOptions} />
            </div>
          {:else}
            <div class="empty-chart"><p>Sin datos de grupos</p></div>
          {/if}
        </div>
      </div>

      <!-- Resumen por comunas -->
      <div class="chart-card full-width">
        <div class="chart-header">
          <div>
            <h3>Comunas / Corregimientos</h3>
            <p>{topComunas.filter(t => !t.sinGeo).length} con intervenciones
              {#if sinGeoData > 0}<span class="no-data-badge">{sinGeoData} sin geo-datos</span>{/if}
            </p>
          </div>
        </div>
        <div class="comunas-grid">
          {#each topComunas as { area, count, pct, sinGeo }}
            <div class="comuna-item" class:sin-geo={sinGeo}>
              <div class="comuna-name">{area}</div>
              <div class="comuna-bar-wrap">
                <div class="comuna-bar-fill" style="width: {sinGeo ? 0 : pct}%; {sinGeo ? 'background: var(--amber-500);' : ''}"></div>
              </div>
              <span class="comuna-count" style="{sinGeo ? 'color: var(--amber-600);' : ''}">{count}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Resumen por barrios / veredas -->
      {#if topBarrios.length > 0}
        <div class="chart-card full-width">
          <div class="chart-header">
            <div>
              <h3>Barrios / Veredas</h3>
              <p>Top {topBarrios.length} barrios con mayor concentración</p>
            </div>
          </div>
          <div class="comunas-grid">
            {#each topBarrios as { barrio, count, pct }}
              <div class="comuna-item">
                <div class="comuna-name">{barrio}</div>
                <div class="comuna-bar-wrap">
                  <div class="comuna-bar-fill" style="width: {pct}%; background: linear-gradient(90deg, var(--blue-500), var(--blue-600));"></div>
                </div>
                <span class="comuna-count" style="color: var(--blue-600);">{count}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}

    <!-- ════ TAB: TABLA ════ -->
    {#if activeTab === "tabla"}
      <div class="table-card">
        <div class="table-card-header">
          <h3>Reportes de Intervenciones <span class="count-badge">{filteredReportes.length}</span></h3>
          <div class="pagination-controls">
            <select bind:value={pageSize} on:change={() => (currentPage = 1)}>
              <option value={10}>10 / pág</option>
              <option value={15}>15 / pág</option>
              <option value={25}>25 / pág</option>
              <option value={50}>50 / pág</option>
            </select>
          </div>
        </div>
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
                <th class="center">Fotos</th>
              </tr>
            </thead>
            <tbody>
              {#each pagedReportes as reporte}
                <tr>
                  <td class="date-cell">{formatDate(reporte.fecha_registro)}</td>
                  <td>
                    <span
                      class="grupo-badge"
                      style="background: {getGrupoColor(reporte.grupo)}20; color: {getGrupoColor(reporte.grupo)}; border: 1px solid {getGrupoColor(reporte.grupo)}40;"
                    >
                      <span class="grupo-dot" style="background:{getGrupoColor(reporte.grupo)}"></span>
                      {getGrupoLabel(reporte.grupo)}
                    </span>
                  </td>
                  <td>
                    <span class="tipo-badge">{reporte.tipo_intervencion || "—"}</span>
                  </td>
                  <td class="detalle-cell">{getDetalle(reporte)}</td>
                  <td class="impact-cell">
                    {#if getImpacto(reporte) > 0}
                      <span class="impact-val">{getImpacto(reporte).toLocaleString("es-CO")}</span>
                      <span class="impact-unit">{getImpactoLabel(reporte)}</span>
                    {:else}
                      <span class="muted">—</span>
                    {/if}
                  </td>
                  <td class="location-cell">
                    {#if reporte.barrio_vereda || reporte.comuna_corregimiento}
                      <div class="location-lines">
                        {#if reporte.barrio_vereda}
                          <div class="loc-barrio">{reporte.barrio_vereda}</div>
                        {/if}
                        {#if reporte.comuna_corregimiento}
                          <div class="loc-comuna">{reporte.comuna_corregimiento}</div>
                        {/if}
                      </div>
                    {:else if reporte.direccion}
                      <span class="muted">{reporte.direccion}</span>
                    {:else if reporte.coordinates_data}
                      <span class="muted">{reporte.coordinates_data[1].toFixed(4)}, {reporte.coordinates_data[0].toFixed(4)}</span>
                    {:else}
                      <span class="muted">—</span>
                    {/if}
                  </td>
                  <td class="center">
                    {#if (reporte.photos_uploaded ?? 0) > 0}
                      <span class="photo-badge">{reporte.photos_uploaded}</span>
                    {:else}
                      <span class="muted">—</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <!-- Paginación -->
        <div class="pagination">
          <span class="pagination-info">
            {Math.min((currentPage - 1) * pageSize + 1, filteredReportes.length)}
            – {Math.min(currentPage * pageSize, filteredReportes.length)}
            de {filteredReportes.length}
          </span>
          <div class="pagination-controls">
            <button class="pg-btn" disabled={currentPage <= 1} on:click={() => (currentPage = 1)}>«</button>
            <button class="pg-btn" disabled={currentPage <= 1} on:click={() => currentPage--}>‹</button>
            <span class="pg-current">{currentPage} / {totalPages}</span>
            <button class="pg-btn" disabled={currentPage >= totalPages} on:click={() => currentPage++}>›</button>
            <button class="pg-btn" disabled={currentPage >= totalPages} on:click={() => (currentPage = totalPages)}>»</button>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>






<style>
  /* ── Layout ─────────────────────────────────────────────────────────────── */
  .dashboard {
    padding: var(--space-6);
    background: var(--surface-alt);
    min-height: 100vh;
  }

  /* ── Loading / Error ─────────────────────────────────────────────────────── */
  .state-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: var(--space-5);
    text-align: center;
    padding: var(--space-12) var(--space-8);
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid var(--border);
    border-top-color: var(--primary);
    border-radius: var(--radius-full);
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .state-msg {
    color: var(--text-secondary);
    font-size: var(--text-base);
    max-width: 420px;
    white-space: pre-line;
    margin: 0;
  }

  .state-icon {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .error-icon :global(svg) {
    width: 56px;
    height: 56px;
    color: var(--red-500);
  }

  .state-overlay h2 {
    margin: 0;
    font-size: var(--text-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--slate-800);
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-6);
    background: var(--primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-md);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    transition: all var(--transition);
  }

  .btn-primary:hover {
    background: var(--primary-dark);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(5,150,105,0.25);
  }

  .btn-primary :global(svg) { width: 18px; height: 18px; }

  /* ── Header ──────────────────────────────────────────────────────────────── */
  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: var(--space-6);
    gap: var(--space-4);
  }

  .header-left { display: flex; flex-direction: column; gap: var(--space-1); }

  .header-badge {
    display: inline-block;
    padding: 3px 10px;
    background: var(--green-100);
    color: var(--green-900);
    font-size: var(--text-xs);
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border-radius: var(--radius-full);
    border: 1px solid var(--green-200);
    width: fit-content;
    margin-bottom: var(--space-1);
  }

  .dashboard-header h1 {
    font-size: 1.625rem;
    font-weight: var(--font-weight-extrabold);
    color: var(--slate-900);
    margin: 0;
    line-height: var(--leading-tight);
  }

  .subtitle {
    color: var(--slate-500);
    font-size: var(--text-base);
    margin: 0;
  }

  .updated-at {
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .btn-ghost {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--red-600);
    font-size: var(--text-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all var(--transition);
  }

  .btn-ghost:hover { background: var(--red-50); border-color: var(--red-100); }
  .btn-ghost :global(svg) { width: 14px; height: 14px; }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--primary);
    font-size: var(--text-base);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    transition: all var(--transition);
    box-shadow: var(--shadow-sm);
  }

  .btn-secondary:hover {
    background: var(--green-50);
    border-color: var(--green-200);
    box-shadow: var(--shadow);
  }

  .btn-secondary :global(svg) { width: 16px; height: 16px; }

  /* ── Filtros ─────────────────────────────────────────────────────────────── */
  .filters-card {
    background: var(--surface);
    border-radius: var(--radius-lg);
    padding: var(--space-4) var(--space-5) var(--space-5);
    margin-bottom: var(--space-6);
    box-shadow: var(--shadow);
    border: 1px solid var(--border-light);
  }

  .filters-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .filters-label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-xs);
    font-weight: var(--font-weight-bold);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .filters-label :global(svg) { width: 14px; height: 14px; color: var(--text-muted); }

  .filter-active-badge {
    padding: 2px 8px;
    background: var(--blue-100);
    color: var(--blue-700);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    font-weight: var(--font-weight-semibold);
  }

  .filters-row {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    align-items: center;
  }

  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1 1 220px;
    min-width: 180px;
  }

  .search-box :global(svg) {
    position: absolute;
    left: 10px;
    width: 15px;
    height: 15px;
    color: var(--text-muted);
    pointer-events: none;
  }

  .search-box input {
    width: 100%;
    height: var(--input-height);
    padding: 0 var(--input-padding-x) 0 32px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: var(--text-base);
    outline: none;
    transition: border-color var(--transition), box-shadow var(--transition);
    color: var(--slate-700);
    background: var(--surface-alt);
  }

  .search-box input:focus {
    border-color: var(--primary);
    background: var(--surface);
    box-shadow: 0 0 0 3px rgba(5,150,105,0.1);
  }

  .filters-row select {
    height: var(--input-height);
    padding: 0 30px 0 var(--input-padding-x);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: var(--text-base);
    outline: none;
    background: var(--surface-alt);
    color: var(--slate-700);
    cursor: pointer;
    transition: border-color var(--transition);
    flex: 0 1 150px;
    min-width: 120px;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 9px center;
  }

  .filters-row select:focus {
    border-color: var(--primary);
    background-color: var(--surface);
    box-shadow: 0 0 0 3px rgba(5,150,105,0.1);
  }

  .date-range {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex: 0 0 auto;
  }

  .date-range input[type="date"] {
    height: var(--input-height);
    padding: 0 var(--input-padding-x);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: var(--text-sm);
    outline: none;
    background: var(--surface-alt);
    color: var(--slate-700);
    transition: border-color var(--transition);
  }

  .date-range input[type="date"]:focus {
    border-color: var(--primary);
    background: var(--surface);
    box-shadow: 0 0 0 3px rgba(5,150,105,0.1);
  }

  .date-sep { color: var(--text-muted); font-size: var(--text-base); }

  .aggregation-toggle {
    display: flex;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .agg-btn {
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    font-weight: var(--font-weight-medium);
    color: var(--slate-500);
    background: var(--surface-alt);
    border: none;
    cursor: pointer;
    transition: all var(--transition);
    height: var(--input-height);
  }

  .agg-btn:hover { background: var(--slate-100); color: var(--slate-700); }
  .agg-btn.active { background: var(--primary); color: white; font-weight: var(--font-weight-semibold); }

  /* ── Section labels ──────────────────────────────────────────────────────── */
  .section-label {
    font-size: var(--text-xs);
    font-weight: var(--font-weight-bold);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: var(--space-3);
    padding-left: 2px;
  }

  /* ── KPI + Map layout: mapa toma prioridad, KPIs ancho fijo mínimo ──────── */
  .kpi-map-layout {
    display: grid;
    grid-template-columns: minmax(280px, 360px) 1fr;
    gap: var(--space-4);
    align-items: stretch;
    margin-bottom: var(--space-4);
  }
  .kpi-col {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .map-side {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .map-side .map-card-unified {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
  .map-side .map-card-unified .map-body {
    flex: 1;
    min-height: 0;
  }

  .kpis-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .kpis-impact { margin-bottom: 0; }

  /* ── Tab bar ─────────────────────────────────────────────────────────────── */
  .tab-bar {
    display: flex;
    gap: var(--space-1);
    background: var(--surface);
    border-radius: var(--radius-md);
    padding: var(--space-1);
    margin-bottom: var(--space-5);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--border-light);
    width: fit-content;
  }

  .tab-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-5);
    font-size: var(--text-base);
    font-weight: var(--font-weight-medium);
    color: var(--text-secondary);
    background: transparent;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    transition: all var(--transition);
  }

  .tab-btn :global(svg) { width: 15px; height: 15px; }
  .tab-btn:hover:not(.active) { background: var(--surface-alt); color: var(--slate-700); }
  .tab-btn.active {
    background: var(--primary);
    color: white;
    font-weight: var(--font-weight-semibold);
    box-shadow: 0 2px 6px rgba(5,150,105,0.25);
  }

  /* ── Maps ────────────────────────────────────────────────────────────────── */
  .map-card-unified {
    margin-bottom: var(--space-4);
  }

  .map-card {
    background: var(--surface);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow);
    border: 1px solid var(--border-light);
    display: flex;
    flex-direction: column;
  }

  .map-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border-light);
    gap: var(--space-3);
  }

  .map-header-left { flex: 1; min-width: 0; }

  .map-card-header h3 {
    margin: 0 0 1px;
    font-size: var(--text-sm);
    font-weight: var(--font-weight-bold);
    color: var(--slate-800);
  }

  .map-card-header p {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .map-view-tabs {
    display: flex;
    gap: 2px;
    background: var(--surface-alt);
    border: 1px solid var(--border-light);
    border-radius: var(--radius);
    padding: 2px;
    flex-shrink: 0;
  }

  .map-view-tab {
    padding: 3px 14px;
    font-size: var(--text-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--text-muted);
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition);
    white-space: nowrap;
    letter-spacing: 0.01em;
  }

  .map-view-tab:hover:not(.active) { color: var(--slate-600); background: var(--slate-100); }
  .map-view-tab.active {
    background: var(--surface);
    color: var(--primary);
    font-weight: var(--font-weight-bold);
    box-shadow: var(--shadow-sm);
  }

  .map-body {
    flex: 1;
    min-height: 320px;
    position: relative;
  }

  .map-body-unified { min-height: 360px; }

  .map-legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-4);
    padding: var(--space-3) var(--space-5);
    border-top: 1px solid var(--border-light);
    background: var(--surface-alt);
  }

  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-sm);
    color: var(--text-secondary);
    font-weight: var(--font-weight-medium);
  }

  .legend-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .choropleth-legend { align-items: center; gap: var(--space-1); }
  .legend-label { font-size: var(--text-sm); color: var(--text-muted); }
  .legend-swatch { width: 18px; height: 10px; border-radius: var(--radius-xs); flex-shrink: 0; }

  /* ── Chart cards ─────────────────────────────────────────────────────────── */
  .chart-card {
    background: var(--surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    box-shadow: var(--shadow);
    border: 1px solid var(--border-light);
    margin-bottom: var(--space-4);
  }

  .chart-card.full-width { width: 100%; }

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--space-4);
    gap: var(--space-3);
  }

  .chart-header h3 { margin: 0 0 2px; font-size: var(--text-md); font-weight: var(--font-weight-bold); color: var(--slate-800); }
  .chart-header p { margin: 0; font-size: var(--text-sm); color: var(--text-muted); display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }

  .chart-area { position: relative; width: 100%; }
  .donut-area { display: flex; justify-content: center; }

  .no-data-badge {
    display: inline-block;
    padding: 2px 8px;
    background: var(--amber-100);
    color: var(--amber-700);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-weight-semibold);
    white-space: nowrap;
  }

  .empty-chart {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100px;
    color: var(--text-muted);
    font-size: var(--text-base);
  }

  .charts-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }

  /* ── Comunas grid ────────────────────────────────────────────────────────── */
  .comunas-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-1) var(--space-6);
  }

  .comuna-item {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--border-light);
  }

  .comuna-name {
    font-size: var(--text-sm);
    color: var(--slate-700);
    font-weight: var(--font-weight-medium);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .comuna-bar-wrap {
    width: 56px;
    height: 5px;
    background: var(--slate-100);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .comuna-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--primary-light), var(--primary));
    border-radius: var(--radius-full);
    transition: width 0.5s ease;
  }

  .comuna-count {
    font-size: var(--text-sm);
    font-weight: var(--font-weight-bold);
    color: var(--primary);
    min-width: 1.75rem;
    text-align: right;
  }

  /* ── Table card ──────────────────────────────────────────────────────────── */
  .table-card {
    background: var(--surface);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow);
    border: 1px solid var(--border-light);
  }

  .table-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--border-light);
  }

  .table-card-header h3 {
    margin: 0;
    font-size: var(--text-md);
    font-weight: var(--font-weight-bold);
    color: var(--slate-800);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .count-badge {
    display: inline-block;
    padding: 2px 8px;
    background: var(--slate-100);
    color: var(--slate-500);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    font-weight: var(--font-weight-semibold);
  }

  .table-wrapper { overflow-x: auto; }

  table { width: 100%; border-collapse: collapse; font-size: var(--text-base); }
  thead { background: var(--surface-alt); }

  th {
    text-align: left;
    padding: var(--space-3) var(--table-cell-px);
    font-size: var(--text-xs);
    font-weight: var(--font-weight-bold);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }

  th.center { text-align: center; }

  td {
    padding: var(--table-cell-py) var(--table-cell-px);
    border-bottom: 1px solid var(--border-light);
    color: var(--slate-700);
    vertical-align: middle;
  }

  td.center { text-align: center; }
  tbody tr:hover td { background: var(--surface-alt); }

  .date-cell { font-size: var(--text-sm); color: var(--text-secondary); white-space: nowrap; }

  .detalle-cell {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .impact-cell { white-space: nowrap; }
  .impact-val { font-weight: var(--font-weight-bold); color: var(--primary); font-size: var(--text-md); }
  .impact-unit { font-size: var(--text-xs); color: var(--text-muted); margin-left: var(--space-1); }

  .location-cell {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    max-width: 200px;
  }

  .location-lines {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .loc-barrio {
    font-size: var(--text-sm);
    font-weight: var(--font-weight-medium);
    color: var(--slate-700);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .loc-comuna {
    font-size: var(--text-xs);
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .muted { color: var(--text-disabled); font-size: var(--text-sm); }

  /* Filas sin datos geográficos */
  .sin-geo .comuna-name { color: var(--amber-600); font-style: italic; }

  /* ── Badges ──────────────────────────────────────────────────────────────── */
  .grupo-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 2px 8px;
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-weight-semibold);
    white-space: nowrap;
  }

  .grupo-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

  .tipo-badge {
    display: inline-block;
    padding: 2px 7px;
    background: var(--slate-100);
    color: var(--slate-600);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--font-weight-medium);
  }

  .photo-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    background: var(--blue-100);
    color: var(--blue-700);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-weight-bold);
  }

  /* ── Paginación ──────────────────────────────────────────────────────────── */
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3) var(--space-5);
    border-top: 1px solid var(--border-light);
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .pagination-info { font-size: var(--text-sm); color: var(--text-secondary); }

  .pagination-controls {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .pagination-controls select {
    height: 32px;
    padding: 0 var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    background: var(--surface);
    color: var(--slate-700);
    outline: none;
    cursor: pointer;
    appearance: none;
    padding-right: 24px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 6px center;
  }

  .pg-btn {
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--slate-700);
    font-size: var(--text-base);
    cursor: pointer;
    transition: all var(--transition);
  }

  .pg-btn:hover:not(:disabled) {
    background: var(--green-50);
    border-color: var(--primary);
    color: var(--primary);
  }

  .pg-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .pg-current {
    font-size: var(--text-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--slate-800);
    padding: 0 var(--space-1);
    min-width: 56px;
    text-align: center;
  }

  /* Responsive */
  @media (max-width: 1280px) {
    .kpi-map-layout { grid-template-columns: minmax(260px, 320px) 1fr; }
  }

  @media (max-width: 1024px) {
    .kpi-map-layout { grid-template-columns: 1fr; }
    .kpis-impact { margin-bottom: var(--space-3); }
    .map-side { min-height: 400px; }
  }

  @media (max-width: 1100px) {
    .charts-row { grid-template-columns: 1fr; }
    .comunas-grid { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 768px) {
    .dashboard { padding: var(--space-3); }
    .dashboard-header { flex-direction: column; align-items: flex-start; }
    .header-actions { width: 100%; justify-content: flex-end; }
    .tab-bar { width: 100%; }
    .tab-btn { flex: 1; justify-content: center; }
    .comunas-grid { grid-template-columns: 1fr; }
    .filters-row { flex-direction: column; }
    .search-box { flex: none; width: 100%; }
    .filters-row select { flex: none; width: 100%; }
    .date-range { width: 100%; }
    .date-range input[type="date"] { flex: 1; }
  }

  @media (max-width: 480px) {
    .kpis-grid { grid-template-columns: 1fr; }
    .dashboard-header h1 { font-size: var(--text-xl); }
  }
</style>
