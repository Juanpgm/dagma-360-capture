<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { obtenerReportesAll } from '../../api/visitas';
  import { getActividadesPlanDistritoVerde } from '../../api/actividades';
  import { GRUPO_DISPLAY_NAMES, canonicalGrupoKey, type GrupoKey } from '../../lib/grupos';
  import { authStore, permissions } from '../../stores/authStore';
  import ReporteEditModal from '../dashboard/ReporteEditModal.svelte';
  import type { ReporteIntervencion, PaginationMeta } from '../../api/visitas';
  import type { ActividadPlanDistritoVerde } from '../../types/actividades';
  import { matchReporte, tipoIntervencionOptions } from '../../lib/reportesFilter';

  // ── Edit modal ──────────────────────────────────────────────────────────────
  let editReporte: ReporteIntervencion | null = null;
  let editModalOpen = false;

  function openEdit(r: ReporteIntervencion) {
    editReporte = r;
    editModalOpen = true;
  }

  function handleUpdated(event: CustomEvent<ReporteIntervencion>) {
    const updated = event.detail;
    // Update in activity cache
    for (const [actId, list] of reportesCache.entries()) {
      const idx = list.findIndex(r => r.id === updated.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updated };
        reportesCache.set(actId, [...list]);
        reportesCache = reportesCache;
        break;
      }
    }
    // Also update orphans
    orphanReportes = orphanReportes.map(r => r.id === updated.id ? { ...r, ...updated } : r);
    editModalOpen = false;
  }

  // ── Auth / grupo lock ────────────────────────────────────────────────────────
  $: canSeeAll = $permissions.canSeeAllGroups;
  $: lockedGrupo = canSeeAll ? '' : ($authStore.user?.grupo ?? '');
  $: if (lockedGrupo && filterGrupo !== lockedGrupo) { filterGrupo = lockedGrupo; }

  function grupoLabel(g: string): string {
    const key = canonicalGrupoKey(g);
    return GRUPO_DISPLAY_NAMES[key as GrupoKey] ?? g.charAt(0).toUpperCase() + g.slice(1);
  }

  // ── Constants ────────────────────────────────────────────────────────────────
  const GRUPOS = ['flora_urbana', 'vivero', 'gobernanza', 'ecosistemas', 'umata'];
  const GRUPO_COLORS: Record<string, string> = {
    flora_urbana: '#059669',
    vivero: '#10b981',
    gobernanza: '#6366f1',
    ecosistemas: '#0ea5e9',
    umata: '#f59e0b',
  };
  // Color palette for Tipo de Jornada sections (cycles by index)
  const JORNADA_PALETTE = ['#6366f1', '#059669', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

  const ESTADO_ACT_COLORS: Record<string, string> = {
    "Programada":   "#3b82f6",
    "En ejecución": "#f59e0b",
    "Finalizada":   "#10b981",
  };

  // ── Tree state ───────────────────────────────────────────────────────────────
  let actividades: ActividadPlanDistritoVerde[] = [];
  let loadingActividades = true;
  let treeError = '';

  // reportes cache: id_actividad → ReporteIntervencion[]
  let reportesCache: Map<string, ReporteIntervencion[]> = new Map();
  // loading state per activity
  let loadingReportes: Set<string> = new Set();
  // expanded state: tipo_jornada sections and activities
  let expandedJornadas: Set<string> = new Set();
  let expandedActividades: Set<string> = new Set();

  // Orphans (no id_actividad)
  let orphanReportes: ReporteIntervencion[] = [];
  let loadingOrphans = false;
  let orphansExpanded = false;
  let orphanPage = 1;
  let orphanHasMore = false;

  // ── Filters ──────────────────────────────────────────────────────────────────
  let filterGrupo = '';
  let filterTipoJornada = '';
  let filterTipoIntervencion = '';
  let filterFechaDesde = '';
  let filterFechaHasta = '';
  let filterEstado = '';
  let searchTerm = '';
  let debouncedSearch = '';
  let searchTimer: ReturnType<typeof setTimeout>;

  // ── Carousel / lightbox state ─────────────────────────────────────────────────
  let carouselIndices: Record<string, number> = {};
  let brokenImages: Record<string, boolean> = {};
  let loadedImages: Record<string, boolean> = {};
  let lightboxUrl = '';
  let lightboxAlt = '';

  // Activity detail panel (inside card) — renamed to avoid collision with tree-level expandedActividades
  let expandedActivityPanel: Set<string> = new Set();
  function toggleActivityPanel(id: string) {
    if (expandedActivityPanel.has(id)) expandedActivityPanel.delete(id);
    else expandedActivityPanel.add(id);
    expandedActivityPanel = expandedActivityPanel;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  onMount(async () => { await loadActividades(); });
  onDestroy(() => clearTimeout(searchTimer));

  // ── Load activities ───────────────────────────────────────────────────────────
  async function loadActividades() {
    loadingActividades = true;
    treeError = '';
    try {
      const grupo = lockedGrupo || filterGrupo || undefined;
      actividades = await getActividadesPlanDistritoVerde(grupo || undefined);
      // Auto-expand first tipo_jornada
      const firstKey = tipoJornadaKeys[0];
      if (firstKey) expandedJornadas.add(firstKey);
      expandedJornadas = expandedJornadas;
    } catch (e: any) {
      treeError = e?.message || 'Error al cargar actividades';
    } finally {
      loadingActividades = false;
    }
  }

  // ── Group by tipo_jornada (reactive) ─────────────────────────────────────────
  $: tipoJornadaMap = (() => {
    const map = new Map<string, ActividadPlanDistritoVerde[]>();
    let filtered = actividades;
    if (filterTipoJornada) filtered = filtered.filter(a => a.tipo_jornada === filterTipoJornada);
    if (filterEstado) filtered = filtered.filter(a => a.estado_actividad === filterEstado);
    if (filterFechaDesde) filtered = filtered.filter(a => {
      // fecha_actividad is "DD/MM/YYYY"
      const [d, m, y] = (a.fecha_actividad || '').split('/');
      if (!d || !m || !y) return true;
      return `${y}-${m}-${d}` >= filterFechaDesde;
    });
    if (filterFechaHasta) filtered = filtered.filter(a => {
      const [d, m, y] = (a.fecha_actividad || '').split('/');
      if (!d || !m || !y) return true;
      return `${y}-${m}-${d}` <= filterFechaHasta;
    });
    for (const act of filtered) {
      const key = act.tipo_jornada || 'Sin tipo';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(act);
    }
    return map;
  })();

  $: tipoJornadaKeys = [...tipoJornadaMap.keys()];

  $: allTipoJornadaOptions = (() => {
    const keys = new Set<string>();
    for (const a of actividades) keys.add(a.tipo_jornada || 'Sin tipo');
    return [...keys].sort();
  })();

  // Tipo de intervención options are derived from the reports already loaded
  // (cache + orphans); they grow as the user expands more activities.
  $: allTipoIntervencionOptions = tipoIntervencionOptions([
    ...[...reportesCache.values()].flat(),
    ...orphanReportes,
  ]);

  $: hasActiveFilters = !!(filterTipoJornada || filterTipoIntervencion || filterFechaDesde || filterFechaHasta || filterEstado || (canSeeAll && filterGrupo) || debouncedSearch);

  function clearFilters() {
    filterTipoJornada = '';
    filterTipoIntervencion = '';
    filterFechaDesde = '';
    filterFechaHasta = '';
    filterEstado = '';
    searchTerm = '';
    debouncedSearch = '';
    if (canSeeAll) filterGrupo = '';
  }

  // ── Tree expand/collapse ─────────────────────────────────────────────────────
  function toggleJornada(key: string) {
    if (expandedJornadas.has(key)) expandedJornadas.delete(key);
    else expandedJornadas.add(key);
    expandedJornadas = expandedJornadas;
  }

  async function toggleActividad(actId: string) {
    if (expandedActividades.has(actId)) {
      expandedActividades.delete(actId);
    } else {
      expandedActividades.add(actId);
      if (!reportesCache.has(actId) && !loadingReportes.has(actId)) {
        await loadReportesForActividad(actId);
      }
    }
    expandedActividades = expandedActividades;
  }

  async function loadReportesForActividad(actId: string) {
    loadingReportes.add(actId);
    loadingReportes = loadingReportes;
    try {
      const res = await obtenerReportesAll({ id_actividad: actId, per_page: 100 });
      reportesCache.set(actId, res.data);
      reportesCache = reportesCache;
    } catch (e) {
      reportesCache.set(actId, []);
      reportesCache = reportesCache;
    } finally {
      loadingReportes.delete(actId);
      loadingReportes = loadingReportes;
    }
  }

  // ── Orphans ──────────────────────────────────────────────────────────────────
  async function toggleOrphans() {
    orphansExpanded = !orphansExpanded;
    if (orphansExpanded && orphanReportes.length === 0) {
      await loadOrphans(1);
    }
  }

  async function loadOrphans(page: number) {
    loadingOrphans = true;
    try {
      const res = await obtenerReportesAll({ sin_actividad: true, page, per_page: 30 });
      if (page === 1) orphanReportes = res.data;
      else orphanReportes = [...orphanReportes, ...res.data];
      orphanHasMore = res.pagination.has_next;
      orphanPage = page;
    } catch (e) {
      // Keep existing
    } finally {
      loadingOrphans = false;
    }
  }

  // ── Filter / search helpers ───────────────────────────────────────────────────
  async function handleFilterChange() {
    reportesCache = new Map();
    expandedActividades = new Set();
    await loadActividades();
  }

  function handleSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      debouncedSearch = searchTerm;
    }, 300);
  }

  // Report-level filtering (search + tipo_intervencion) lives in a pure, tested
  // helper: src/lib/reportesFilter.ts → matchReporte / tipoIntervencionOptions.

  // ── Image / carousel helpers ──────────────────────────────────────────────────
  function handleImgError(url: string) {
    brokenImages = { ...brokenImages, [url]: true };
  }

  function handleImgLoad(url: string) {
    loadedImages = { ...loadedImages, [url]: true };
  }

  function carouselNext(id: string, total: number) {
    carouselIndices = { ...carouselIndices, [id]: ((carouselIndices[id] ?? 0) + 1) % total };
  }

  function carouselPrev(id: string, total: number) {
    carouselIndices = { ...carouselIndices, [id]: ((carouselIndices[id] ?? 0) - 1 + total) % total };
  }

  function setCarouselIndex(id: string, idx: number) {
    carouselIndices = { ...carouselIndices, [id]: idx };
  }

  function openLightbox(url: string, alt: string) { lightboxUrl = url; lightboxAlt = alt; }
  function closeLightbox() { lightboxUrl = ''; lightboxAlt = ''; }
  function handleLightboxKey(e: KeyboardEvent) { if (e.key === 'Escape') closeLightbox(); }

  // ── Formatting helpers ────────────────────────────────────────────────────────
  function formatDate(ts: string): string {
    if (!ts) return '—';
    // Handle compact format YYYYMMDD_HHMMSS
    const m = ts.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
    if (m) {
      const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
    }
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function getActEstadoColor(estado: string | null | undefined): string {
    return ESTADO_ACT_COLORS[estado ?? ""] ?? "#94a3b8";
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
</script>

<svelte:window on:keydown={handleLightboxKey} />

<div class="reconoc-wrap">
  <!-- Toolbar -->
  <div class="toolbar">
    <!-- Row 1: search + group -->
    <div class="toolbar-row toolbar-row-primary">
      <div class="search-wrap">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          class="search-input"
          type="text"
          placeholder="Buscar descripción, tipo, barrio…"
          bind:value={searchTerm}
          on:input={handleSearchInput}
        />
      </div>
      {#if canSeeAll}
        <select class="filter-chip" bind:value={filterGrupo} on:change={handleFilterChange}>
          <option value="">Todos los grupos</option>
          {#each GRUPOS as g}
            <option value={g}>{grupoLabel(g)}</option>
          {/each}
        </select>
      {/if}
    </div>

    <!-- Row 2: secondary filters -->
    <div class="toolbar-row toolbar-row-filters">
      <select class="filter-chip" bind:value={filterTipoJornada}>
        <option value="">Tipo de jornada</option>
        {#each allTipoJornadaOptions as tj}
          <option value={tj}>{tj}</option>
        {/each}
      </select>

      <select class="filter-chip" bind:value={filterEstado}>
        <option value="">Estado actividad</option>
        <option value="Programada">Programada</option>
        <option value="En ejecución">En ejecución</option>
        <option value="Finalizada">Finalizada</option>
      </select>

      <select class="filter-chip" bind:value={filterTipoIntervencion} disabled={allTipoIntervencionOptions.length === 0} title="Filtrar por tipo de intervención (disponible al desplegar actividades)">
        <option value="">Tipo de intervención</option>
        {#each allTipoIntervencionOptions as ti}
          <option value={ti}>{ti}</option>
        {/each}
      </select>

      <div class="date-range">
        <input class="filter-date" type="date" title="Fecha desde" bind:value={filterFechaDesde} />
        <span class="date-sep">→</span>
        <input class="filter-date" type="date" title="Fecha hasta" bind:value={filterFechaHasta} />
      </div>

      {#if hasActiveFilters}
        <button class="clear-filters-btn" on:click={clearFilters} title="Limpiar filtros">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Limpiar
        </button>
      {/if}
    </div>
  </div>

  {#if loadingActividades}
    <div class="center-state">
      <div class="spinner"></div>
      <p>Cargando actividades…</p>
    </div>
  {:else if treeError}
    <div class="center-state error-state">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p>{treeError}</p>
      <button class="retry-btn" on:click={loadActividades}>Reintentar</button>
    </div>
  {:else if tipoJornadaKeys.length === 0}
    <div class="center-state">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
      </svg>
      <p class="empty-msg">Sin actividades{filterGrupo ? ` para "${grupoLabel(filterGrupo)}"` : ''}{filterTipoJornada ? ` de tipo "${filterTipoJornada}"` : ''}.</p>
    </div>
  {:else}

    <!-- Level 1: Tipo de Jornada -->
    {#each tipoJornadaKeys as jornadaKey, jIdx (jornadaKey)}
      {@const acts = tipoJornadaMap.get(jornadaKey) ?? []}
      {@const isJornadaExpanded = expandedJornadas.has(jornadaKey)}
      {@const jColor = JORNADA_PALETTE[jIdx % JORNADA_PALETTE.length]}
      <div class="jornada-section" style="--jc: {jColor}">
        <button class="jornada-header" on:click={() => toggleJornada(jornadaKey)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span class="jornada-title">{jornadaKey}</span>
          <span class="jornada-count">{acts.length} {acts.length === 1 ? 'actividad' : 'actividades'}</span>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
            style="transform: rotate({isJornadaExpanded ? '180deg' : '0deg'}); transition: transform 150ms; flex-shrink: 0"
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {#if isJornadaExpanded}
          <!-- Level 2: Actividades -->
          {#each acts as act (act.id)}
            {@const isActExpanded = expandedActividades.has(act.id)}
            {@const actReportes = reportesCache.get(act.id) ?? []}
            {@const isLoadingAct = loadingReportes.has(act.id)}
            <div class="actividad-item">
              <button class="actividad-header" on:click={() => toggleActividad(act.id)}>
                <div class="act-info">
                  <span class="act-code-tree">{act.id}</span>
                  <span class="act-fecha">{act.fecha_actividad}</span>
                  {#if act.estado_actividad}
                    <span class="act-estado-pill" style="color:{getActEstadoColor(act.estado_actividad)}; border-color:{getActEstadoColor(act.estado_actividad)}60">
                      {act.estado_actividad}
                    </span>
                  {/if}
                  <span class="act-objetivo-tree">{act.objetivo_actividad}</span>
                </div>
                <svg
                  width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                  style="transform: rotate({isActExpanded ? '180deg' : '0deg'}); transition: transform 150ms; flex-shrink: 0; color: #94a3b8"
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {#if isActExpanded}
                {#if isLoadingAct}
                  <div class="act-spinner">
                    <div class="spinner spinner-sm"></div>
                  </div>
                {:else if actReportes.filter(r => matchReporte(r, { search: debouncedSearch, tipoIntervencion: filterTipoIntervencion })).length === 0}
                  <div class="act-empty">
                    {actReportes.length === 0 ? 'Sin reportes para esta actividad' : 'Sin resultados para los filtros aplicados'}
                  </div>
                {:else}
                  <!-- Level 3: Report cards -->
                  <div class="cards-list cards-list-indented">
                    {#each actReportes.filter(r => matchReporte(r, { search: debouncedSearch, tipoIntervencion: filterTipoIntervencion })).sort((a, b) => {
                      const da = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                      const db = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                      return db - da;
                    }) as r (r.id)}
                      {@const photos = r.photosUrl ?? []}
                      {@const curIdx = carouselIndices[r.id] ?? 0}
                      {@const currentPhoto = photos[curIdx] ?? ''}
                      {@const grupoColor = GRUPO_COLORS[canonicalGrupoKey(r.grupo)] ?? '#64748b'}
                      {@const impacto = getImpacto(r)}

                      <div class="reconoc-card">
                        <!-- Header -->
                        <div class="card-header">
                          <span class="req-id">INT-{r.numero_registro ?? '?'}</span>
                          <span class="card-date">{formatDate(r.timestamp)}</span>
                        </div>

                        <!-- Tags -->
                        <div class="card-tags">
                          {#if r.grupo}
                            <span class="tag-grupo" style="background:{grupoColor}18; color:{grupoColor}; border:1px solid {grupoColor}35">
                              {grupoLabel(r.grupo)}
                            </span>
                          {/if}
                          {#if r.tipo_intervencion}
                            <span class="tag-tipo">{r.tipo_intervencion}</span>
                          {/if}
                          {#if r.barrio_vereda || r.comuna_corregimiento}
                            <span class="tag-barrio">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/>
                              </svg>
                              {#if r.barrio_vereda && r.comuna_corregimiento}
                                {r.barrio_vereda} · {r.comuna_corregimiento}
                              {:else}
                                {r.barrio_vereda || r.comuna_corregimiento}
                              {/if}
                            </span>
                          {/if}
                        </div>

                        <!-- Descripción -->
                        {#if r.descripcion_intervencion}
                          <p class="card-desc">{r.descripcion_intervencion}</p>
                        {/if}

                        <!-- Carrusel -->
                        {#if photos.length > 0}
                          <div class="carousel-wrap">
                            <div class="carousel-img-area">
                              {#if brokenImages[currentPhoto]}
                                <div class="broken-placeholder">
                                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                                    <polyline points="21 15 16 10 5 21"/><line x1="2" y1="2" x2="22" y2="22"/>
                                  </svg>
                                  <span>Imagen no disponible</span>
                                </div>
                              {:else}
                                {#if !loadedImages[currentPhoto]}
                                  <div class="img-skeleton"></div>
                                {/if}
                                <button
                                  class="carousel-main-btn"
                                  class:loaded={loadedImages[currentPhoto]}
                                  on:click={() => openLightbox(currentPhoto, `INT-${r.numero_registro ?? '?'} · foto ${curIdx + 1}`)}
                                  title="Ver foto completa"
                                >
                                  <img
                                    src={currentPhoto}
                                    alt="Evidencia {curIdx + 1} de {photos.length}"
                                    loading="lazy"
                                    on:load={() => handleImgLoad(currentPhoto)}
                                    on:error={() => handleImgError(currentPhoto)}
                                  />
                                </button>
                              {/if}
                            </div>

                            {#if photos.length > 1}
                              <button class="carousel-nav carousel-prev" on:click|stopPropagation={() => carouselPrev(r.id, photos.length)} aria-label="Anterior">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                  <polyline points="15 18 9 12 15 6"/>
                                </svg>
                              </button>
                              <button class="carousel-nav carousel-next" on:click|stopPropagation={() => carouselNext(r.id, photos.length)} aria-label="Siguiente">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                  <polyline points="9 18 15 12 9 6"/>
                                </svg>
                              </button>
                            {/if}

                            <span class="carousel-counter">{curIdx + 1} / {photos.length}</span>
                          </div>

                          <!-- Thumbnails -->
                          {#if photos.length > 1}
                            <div class="thumbs-strip">
                              {#each photos as photo, ti (photo)}
                                {#if !brokenImages[photo]}
                                  <button
                                    class="thumb-btn"
                                    class:active={ti === curIdx}
                                    on:click={() => setCarouselIndex(r.id, ti)}
                                    title="Foto {ti + 1}"
                                  >
                                    <img
                                      src={photo}
                                      alt="Miniatura {ti + 1}"
                                      loading="lazy"
                                      on:error={() => handleImgError(photo)}
                                    />
                                  </button>
                                {/if}
                              {/each}
                            </div>
                          {/if}
                        {/if}

                        <!-- Actividad badge & panel (inside card) -->
                        {#if r.actividad_codigo}
                          {@const actPanelExpanded = expandedActivityPanel.has(r.id)}
                          <button
                            class="activity-badge"
                            type="button"
                            on:click={() => toggleActivityPanel(r.id)}
                            title="Ver datos de actividad"
                            aria-expanded={actPanelExpanded}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                              <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            {r.actividad_tipo_jornada ?? r.actividad_codigo}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"
                              style="transform: rotate({actPanelExpanded ? '180deg' : '0deg'}); transition: transform 150ms">
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </button>

                          {#if actPanelExpanded}
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
                                  <span class="act-label">Fecha</span>
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

                        <!-- Footer -->
                        <div class="card-footer" style="--c: {grupoColor}">
                          {#if impacto}
                            <span class="meta-impacto">
                              {impacto.value.toLocaleString("es-CO")} <em>{impacto.label}</em>
                            </span>
                          {/if}
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
                {/if}
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    {/each}

    <!-- Orphans section -->
    <div class="jornada-section orphans-section">
      <button class="jornada-header" on:click={toggleOrphans}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span class="jornada-title">Sin actividad asociada</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
          style="transform: rotate({orphansExpanded ? '180deg' : '0deg'}); transition: transform 150ms; flex-shrink: 0; margin-left: auto"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {#if orphansExpanded}
        {#if loadingOrphans && orphanReportes.length === 0}
          <div class="act-spinner">
            <div class="spinner spinner-sm"></div>
          </div>
        {:else if orphanReportes.length === 0}
          <div class="act-empty">No hay reportes sin actividad asociada</div>
        {:else}
          <div class="cards-list cards-list-indented">
            {#each orphanReportes.filter(r => matchReporte(r, { search: debouncedSearch, tipoIntervencion: filterTipoIntervencion })) as r (r.id)}
              {@const photos = r.photosUrl ?? []}
              {@const curIdx = carouselIndices[r.id] ?? 0}
              {@const currentPhoto = photos[curIdx] ?? ''}
              {@const grupoColor = GRUPO_COLORS[canonicalGrupoKey(r.grupo)] ?? '#64748b'}
              {@const impacto = getImpacto(r)}

              <div class="reconoc-card">
                <!-- Header -->
                <div class="card-header">
                  <span class="req-id">INT-{r.numero_registro ?? '?'}</span>
                  <span class="card-date">{formatDate(r.timestamp)}</span>
                </div>

                <!-- Tags -->
                <div class="card-tags">
                  {#if r.grupo}
                    <span class="tag-grupo" style="background:{grupoColor}18; color:{grupoColor}; border:1px solid {grupoColor}35">
                      {grupoLabel(r.grupo)}
                    </span>
                  {/if}
                  {#if r.tipo_intervencion}
                    <span class="tag-tipo">{r.tipo_intervencion}</span>
                  {/if}
                  {#if r.barrio_vereda || r.comuna_corregimiento}
                    <span class="tag-barrio">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/>
                      </svg>
                      {#if r.barrio_vereda && r.comuna_corregimiento}
                        {r.barrio_vereda} · {r.comuna_corregimiento}
                      {:else}
                        {r.barrio_vereda || r.comuna_corregimiento}
                      {/if}
                    </span>
                  {/if}
                </div>

                <!-- Descripción -->
                {#if r.descripcion_intervencion}
                  <p class="card-desc">{r.descripcion_intervencion}</p>
                {/if}

                <!-- Carrusel -->
                {#if photos.length > 0}
                  <div class="carousel-wrap">
                    <div class="carousel-img-area">
                      {#if brokenImages[currentPhoto]}
                        <div class="broken-placeholder">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/><line x1="2" y1="2" x2="22" y2="22"/>
                          </svg>
                          <span>Imagen no disponible</span>
                        </div>
                      {:else}
                        {#if !loadedImages[currentPhoto]}
                          <div class="img-skeleton"></div>
                        {/if}
                        <button
                          class="carousel-main-btn"
                          class:loaded={loadedImages[currentPhoto]}
                          on:click={() => openLightbox(currentPhoto, `INT-${r.numero_registro ?? '?'} · foto ${curIdx + 1}`)}
                          title="Ver foto completa"
                        >
                          <img
                            src={currentPhoto}
                            alt="Evidencia {curIdx + 1} de {photos.length}"
                            loading="lazy"
                            on:load={() => handleImgLoad(currentPhoto)}
                            on:error={() => handleImgError(currentPhoto)}
                          />
                        </button>
                      {/if}
                    </div>

                    {#if photos.length > 1}
                      <button class="carousel-nav carousel-prev" on:click|stopPropagation={() => carouselPrev(r.id, photos.length)} aria-label="Anterior">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="15 18 9 12 15 6"/>
                        </svg>
                      </button>
                      <button class="carousel-nav carousel-next" on:click|stopPropagation={() => carouselNext(r.id, photos.length)} aria-label="Siguiente">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </button>
                    {/if}

                    <span class="carousel-counter">{curIdx + 1} / {photos.length}</span>
                  </div>

                  <!-- Thumbnails -->
                  {#if photos.length > 1}
                    <div class="thumbs-strip">
                      {#each photos as photo, ti (photo)}
                        {#if !brokenImages[photo]}
                          <button
                            class="thumb-btn"
                            class:active={ti === curIdx}
                            on:click={() => setCarouselIndex(r.id, ti)}
                            title="Foto {ti + 1}"
                          >
                            <img
                              src={photo}
                              alt="Miniatura {ti + 1}"
                              loading="lazy"
                              on:error={() => handleImgError(photo)}
                            />
                          </button>
                        {/if}
                      {/each}
                    </div>
                  {/if}
                {/if}

                <!-- Actividad badge & panel (inside card) -->
                {#if r.actividad_codigo}
                  {@const actPanelExpanded = expandedActivityPanel.has(r.id)}
                  <button
                    class="activity-badge"
                    type="button"
                    on:click={() => toggleActivityPanel(r.id)}
                    title="Ver datos de actividad"
                    aria-expanded={actPanelExpanded}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    {r.actividad_tipo_jornada ?? r.actividad_codigo}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"
                      style="transform: rotate({actPanelExpanded ? '180deg' : '0deg'}); transition: transform 150ms">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>

                  {#if actPanelExpanded}
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
                          <span class="act-label">Fecha</span>
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

                <!-- Footer -->
                <div class="card-footer" style="--c: {grupoColor}">
                  {#if impacto}
                    <span class="meta-impacto">
                      {impacto.value.toLocaleString("es-CO")} <em>{impacto.label}</em>
                    </span>
                  {/if}
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

          {#if orphanHasMore}
            <div class="load-more-wrap">
              <button class="load-more-btn" on:click={() => loadOrphans(orphanPage + 1)} disabled={loadingOrphans}>
                {loadingOrphans ? 'Cargando…' : 'Cargar más'}
              </button>
            </div>
          {/if}
        {/if}
      {/if}
    </div>

  {/if}
</div>

<!-- Modal de edición -->
<ReporteEditModal
  bind:open={editModalOpen}
  reporte={editReporte}
  on:updated={handleUpdated}
  on:close={() => (editModalOpen = false)}
/>

<!-- Lightbox -->
{#if lightboxUrl}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="lightbox-overlay" on:click={closeLightbox}>
    <div class="lightbox-inner" on:click|stopPropagation>
      <button class="lightbox-close" on:click={closeLightbox} title="Cerrar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <img src={lightboxUrl} alt={lightboxAlt} />
    </div>
  </div>
{/if}

<style>
  .reconoc-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* ── Toolbar ── */
  .toolbar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .toolbar-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .toolbar-row-primary { flex-wrap: nowrap; }

  .toolbar-row-filters {
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .search-wrap {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .search-icon {
    position: absolute;
    left: 0.65rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted, #94a3b8);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.45rem 0.75rem 0.45rem 2.1rem;
    border: 1px solid var(--border, #e2e8f0);
    border-radius: 7px;
    font-size: 0.85rem;
    background: white;
    color: var(--text-primary, #0f172a);
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }

  .search-input:focus { border-color: var(--primary, #059669); }

  .filter-chip {
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--border, #e2e8f0);
    border-radius: 6px;
    font-size: 0.78rem;
    background: white;
    color: var(--text-secondary, #475569);
    cursor: pointer;
    outline: none;
    white-space: nowrap;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .filter-chip:focus { border-color: var(--primary, #059669); }

  .date-range {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: white;
    border: 1px solid var(--border, #e2e8f0);
    border-radius: 6px;
    padding: 0 0.4rem;
    overflow: hidden;
  }

  .date-sep {
    font-size: 0.7rem;
    color: #94a3b8;
    flex-shrink: 0;
  }

  .filter-date {
    padding: 0.35rem 0.25rem;
    border: none;
    font-size: 0.78rem;
    background: transparent;
    color: var(--text-primary, #0f172a);
    outline: none;
    cursor: pointer;
    width: 120px;
  }

  .clear-filters-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.65rem;
    border: 1px solid #fca5a5;
    border-radius: 6px;
    background: #fff1f2;
    color: #dc2626;
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .clear-filters-btn:hover { background: #fee2e2; }

  /* ── Estados centrales ── */
  .center-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    gap: 0.75rem;
    color: var(--text-muted, #94a3b8);
  }

  .error-state { color: var(--error, #dc2626); }

  .empty-msg { margin: 0; font-size: 0.9rem; }

  .retry-btn {
    padding: 0.4rem 1rem;
    border: 1px solid var(--error, #dc2626);
    border-radius: 6px;
    background: white;
    color: var(--error, #dc2626);
    cursor: pointer;
    font-size: 0.85rem;
  }

  .spinner {
    width: 30px;
    height: 30px;
    border: 3px solid var(--border, #e2e8f0);
    border-top-color: var(--primary, #059669);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  .spinner-sm {
    width: 20px;
    height: 20px;
    border-width: 2px;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Tree: Jornada sections ── */
  .jornada-section {
    margin-bottom: 0.375rem;
    border-left: 3px solid var(--jc, #6366f1);
    border-radius: 0 8px 8px 0;
    background: white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    overflow: hidden;
  }

  .jornada-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.6rem 0.875rem 0.6rem 0.75rem;
    background: transparent;
    border: none;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.825rem;
    color: #1e293b;
    text-align: left;
    transition: background 0.12s;
  }

  .jornada-header:hover { background: color-mix(in srgb, var(--jc, #6366f1) 6%, transparent); }

  .jornada-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .jornada-count {
    flex-shrink: 0;
    font-size: 0.7rem;
    font-weight: 500;
    color: white;
    background: var(--jc, #6366f1);
    padding: 1px 7px;
    border-radius: 9999px;
    white-space: nowrap;
  }

  /* ── Tree: Actividad items ── */
  .actividad-item {
    border-top: 1px solid #f1f5f9;
  }

  .actividad-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.45rem 0.875rem 0.45rem 0.875rem;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    overflow: hidden;
    transition: background 0.12s;
  }

  .actividad-header:hover { background: #f8fafc; }

  .act-info {
    display: flex;
    flex-wrap: nowrap;
    gap: 0.4rem;
    align-items: center;
    flex: 1;
    min-width: 0;
    font-size: 0.78rem;
    overflow: hidden;
  }

  .act-code-tree {
    font-weight: 600;
    color: #1e293b;
    font-family: ui-monospace, 'SF Mono', monospace;
    font-size: 0.72rem;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .act-fecha {
    color: #94a3b8;
    font-size: 0.72rem;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .act-estado-pill {
    padding: 1px 6px;
    border-radius: 9999px;
    border: 1px solid currentColor;
    font-size: 0.67rem;
    font-weight: 600;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .act-objetivo-tree {
    color: #64748b;
    font-size: 0.75rem;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .act-spinner {
    padding: 0.75rem;
    display: flex;
    justify-content: center;
  }

  .act-empty {
    padding: 0.5rem 0.875rem;
    font-size: 0.78rem;
    color: #94a3b8;
    font-style: italic;
  }

  /* ── Orphans section ── */
  .orphans-section {
    --jc: #b45309;
    margin-top: 0.75rem;
  }

  /* ── Cards ── */
  .cards-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .cards-list-indented {
    padding: 0.625rem 0.875rem 0.75rem;
    border-top: 1px solid #f1f5f9;
  }

  .reconoc-card {
    border: 1px solid var(--border, #e2e8f0);
    border-radius: 10px;
    padding: 0.875rem 1rem;
    background: var(--surface, #fff);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
    overflow: hidden;
  }

  /* Card header */
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .req-id {
    background: #dbeafe;
    color: #1d4ed8;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .card-date {
    font-size: 0.75rem;
    color: var(--text-muted, #94a3b8);
  }

  /* Tags */
  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .tag-grupo {
    padding: 2px 10px;
    border-radius: 20px;
    font-size: 0.72rem;
    font-weight: 600;
  }

  .tag-tipo {
    background: var(--surface-alt, #f8fafc);
    color: var(--text-secondary, #475569);
    padding: 2px 10px;
    border-radius: 20px;
    font-size: 0.72rem;
    border: 1px solid var(--border, #e2e8f0);
  }

  .tag-barrio {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--surface-alt, #f8fafc);
    color: var(--text-muted, #94a3b8);
    padding: 2px 10px;
    border-radius: 20px;
    font-size: 0.72rem;
    border: 1px solid var(--border, #e2e8f0);
  }

  /* Descripción */
  .card-desc {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-primary, #0f172a);
    line-height: 1.5;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  /* ── Carrusel ── */
  .carousel-wrap {
    position: relative;
    border-radius: 10px;
    overflow: hidden;
    margin-top: 0.25rem;
  }

  .carousel-img-area {
    position: relative;
    height: 300px;
    background: #111;
    overflow: hidden;
  }

  /* Skeleton shimmer */
  .img-skeleton {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, #1a1a1a 0%, #2e2e2e 50%, #1a1a1a 100%);
    background-size: 200% 100%;
    animation: shimmer 1.4s ease-in-out infinite;
  }

  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* Imagen principal (invisible hasta cargar) */
  .carousel-main-btn {
    position: absolute;
    inset: 0;
    padding: 0;
    border: none;
    background: none;
    cursor: zoom-in;
    opacity: 0;
    transition: opacity 0.25s ease;
  }

  .carousel-main-btn.loaded {
    opacity: 1;
  }

  .carousel-main-btn img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* Placeholder imagen rota */
  .broken-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: var(--surface-alt, #f8fafc);
    color: var(--text-muted, #94a3b8);
    font-size: 0.78rem;
  }

  /* Flechas de navegación */
  .carousel-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: 50%;
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #1e293b;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    transition: background 0.15s, transform 0.15s;
    z-index: 2;
  }

  .carousel-nav:hover {
    background: white;
    transform: translateY(-50%) scale(1.08);
  }

  .carousel-prev { left: 0.6rem; }
  .carousel-next { right: 0.6rem; }

  .carousel-counter {
    position: absolute;
    top: 0.6rem;
    right: 0.6rem;
    background: rgba(0, 0, 0, 0.55);
    color: white;
    border-radius: 4px;
    padding: 2px 7px;
    font-size: 0.7rem;
    font-weight: 600;
    z-index: 2;
    letter-spacing: 0.02em;
  }

  /* ── Thumbnails ── */
  .thumbs-strip {
    display: flex;
    gap: 5px;
    overflow-x: auto;
    padding: 0.4rem 0 0.1rem;
    scrollbar-width: none;
  }

  .thumbs-strip::-webkit-scrollbar { display: none; }

  .thumb-btn {
    flex-shrink: 0;
    width: 58px;
    height: 58px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    background: var(--border, #e2e8f0);
    transition: border-color 0.15s, transform 0.15s;
  }

  .thumb-btn:hover { transform: scale(1.05); }

  .thumb-btn.active {
    border-color: var(--primary, #059669);
  }

  .thumb-btn img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* ── Card footer ── */
  .card-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-light, #f1f5f9);
    margin-top: 0.125rem;
  }

  .footer-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.78rem;
    color: var(--text-secondary, #475569);
  }

  /* ── Load more ── */
  .load-more-wrap {
    display: flex;
    justify-content: center;
    padding: 0.75rem 0 0.25rem;
  }

  .load-more-btn {
    padding: 0.45rem 1.5rem;
    border: 1px solid var(--border, #e2e8f0);
    border-radius: 8px;
    background: white;
    color: var(--text-secondary, #475569);
    font-size: 0.82rem;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .load-more-btn:hover {
    background: var(--surface-alt, #f8fafc);
    border-color: var(--primary, #059669);
  }

  /* ── Lightbox ── */
  .lightbox-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.88);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .lightbox-inner {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
  }

  .lightbox-inner img {
    max-width: 90vw;
    max-height: 90vh;
    border-radius: 8px;
    display: block;
    object-fit: contain;
  }

  .lightbox-close {
    position: absolute;
    top: -2.5rem;
    right: 0;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s;
  }

  .lightbox-close:hover { color: white; }

  /* ── Edit button & impacto ── */
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

  .meta-impacto {
    font-size: 12px;
    font-weight: 700;
    color: var(--c);
    display: flex;
    gap: 3px;
    align-items: center;
  }
  .meta-impacto em { font-style: normal; font-weight: 400; color: #64748b; }

  /* ── Activity badge & panel (inside card) ── */
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
    margin-top: 0.25rem;
    margin-bottom: 0.25rem;
    width: fit-content;
  }
  .activity-badge:hover { background: #e0f2fe; }

  .activity-panel {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    animation: fadeIn 150ms ease;
    margin-bottom: 0.25rem;
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
</style>
