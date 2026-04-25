<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { obtenerReportesAll } from '../../api/visitas';
  import { GRUPO_DISPLAY_NAMES, type GrupoKey } from '../../lib/grupos';

  function grupoLabel(g: string): string {
    return GRUPO_DISPLAY_NAMES[g as GrupoKey] ?? g.charAt(0).toUpperCase() + g.slice(1);
  }
  import type { ReporteIntervencion, PaginationMeta } from '../../api/visitas';

  const GRUPOS = ['cuadrilla', 'vivero', 'gobernanza', 'ecosistemas', 'umata'];
  const GRUPO_COLORS: Record<string, string> = {
    cuadrilla: '#059669',
    vivero: '#10b981',
    gobernanza: '#6366f1',
    ecosistemas: '#0ea5e9',
    umata: '#f59e0b',
  };
  const PAGE_SIZE = 30;

  let reportes: ReporteIntervencion[] = [];
  let loading = true;
  let loadingMore = false;
  let error = '';
  let searchTerm = '';
  let debouncedSearch = '';
  let filterGrupo = '';
  let currentPage = 1;
  let pagination: PaginationMeta | null = null;

  let carouselIndices: Record<string, number> = {};
  let brokenImages: Record<string, boolean> = {};
  let loadedImages: Record<string, boolean> = {};
  let lightboxUrl = '';
  let lightboxAlt = '';
  let searchTimer: ReturnType<typeof setTimeout>;

  onMount(async () => { await loadData(); });
  onDestroy(() => clearTimeout(searchTimer));

  async function loadData() {
    loading = true;
    error = '';
    currentPage = 1;
    reportes = [];
    try {
      const res = await obtenerReportesAll({
        ...(filterGrupo ? { grupo: filterGrupo } : {}),
        page: 1,
        per_page: PAGE_SIZE,
        slim: true,
      });
      reportes = res.data;
      pagination = res.pagination;
    } catch (e: any) {
      error = e?.message || 'Error al cargar reconocimientos';
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (!pagination?.has_next || loadingMore) return;
    loadingMore = true;
    try {
      const nextPage = currentPage + 1;
      const res = await obtenerReportesAll({
        ...(filterGrupo ? { grupo: filterGrupo } : {}),
        page: nextPage,
        per_page: PAGE_SIZE,
        slim: true,
      });
      reportes = [...reportes, ...res.data];
      pagination = res.pagination;
      currentPage = nextPage;
    } catch (e: any) {
      // Non-fatal: keep existing results
    } finally {
      loadingMore = false;
    }
  }

  function handleSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      debouncedSearch = searchTerm;
    }, 300);
  }

  async function handleFilterChange() {
    await loadData();
  }

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

  // Client-side search on already-loaded records, sorted most recent first
  $: filtered = reportes
    .filter((r) => {
      if (!debouncedSearch) return true;
      const t = debouncedSearch.toLowerCase();
      return (
        (r.descripcion_intervencion || '').toLowerCase().includes(t) ||
        (r.tipo_intervencion || '').toLowerCase().includes(t) ||
        (r.barrio_vereda || '').toLowerCase().includes(t) ||
        (r.comuna_corregimiento || '').toLowerCase().includes(t) ||
        (r.direccion || '').toLowerCase().includes(t)
      );
    })
    .sort((a, b) => {
      const da = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const db = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return db - da;
    });

  $: totalCount = pagination?.total ?? reportes.length;
  $: hasMore = pagination?.has_next ?? false;
</script>

<svelte:window on:keydown={handleLightboxKey} />

<div class="reconoc-wrap">
  <!-- Toolbar -->
  <div class="toolbar">
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
    <select class="grupo-select" bind:value={filterGrupo} on:change={handleFilterChange}>
      <option value="">Todos los grupos</option>
      {#each GRUPOS as g}
        <option value={g}>{grupoLabel(g)}</option>
      {/each}
    </select>
    <span class="result-count">{totalCount} {totalCount === 1 ? 'registro' : 'registros'}</span>
  </div>

  {#if loading}
    <div class="center-state">
      <div class="spinner"></div>
      <p>Cargando reconocimientos…</p>
    </div>
  {:else if error}
    <div class="center-state error-state">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p>{error}</p>
      <button class="retry-btn" on:click={loadData}>Reintentar</button>
    </div>
  {:else if filtered.length === 0}
    <div class="center-state">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
      </svg>
      <p class="empty-msg">Sin resultados{filterGrupo ? ` para "${filterGrupo}"` : ''}{debouncedSearch ? ` con "${debouncedSearch}"` : ''}.</p>
    </div>
  {:else}
    <div class="cards-list">
      {#each filtered as r, i (r.id)}
        {@const photos = r.photosUrl ?? []}
        {@const curIdx = carouselIndices[r.id] ?? 0}
        {@const currentPhoto = photos[curIdx] ?? ''}
        {@const grupoColor = GRUPO_COLORS[r.grupo?.toLowerCase() ?? ''] ?? '#64748b'}

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

          <!-- Footer -->
          <div class="card-footer">
            {#if r.registrado_por}
              <span class="footer-item">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                {r.registrado_por}
              </span>
            {/if}
            {#if r.direccion}
              <span class="footer-item">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {r.direccion}
              </span>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    {#if hasMore}
      <div class="load-more-wrap">
        <button class="load-more-btn" on:click={loadMore} disabled={loadingMore}>
          {#if loadingMore}
            Cargando…
          {:else}
            Cargar más · {totalCount - reportes.length} restantes
          {/if}
        </button>
      </div>
    {/if}
  {/if}
</div>

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
    gap: 1rem;
  }

  /* ── Toolbar ── */
  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .search-wrap {
    position: relative;
    flex: 1;
    min-width: 180px;
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
    padding: 0.5rem 0.75rem 0.5rem 2.1rem;
    border: 1px solid var(--border, #e2e8f0);
    border-radius: 8px;
    font-size: 0.875rem;
    background: white;
    color: var(--text-primary, #0f172a);
    outline: none;
    transition: border-color 0.15s;
  }

  .search-input:focus {
    border-color: var(--primary, #059669);
  }

  .grupo-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border, #e2e8f0);
    border-radius: 8px;
    font-size: 0.875rem;
    background: white;
    color: var(--text-primary, #0f172a);
    cursor: pointer;
    outline: none;
  }

  .result-count {
    font-size: 0.8rem;
    color: var(--text-muted, #94a3b8);
    white-space: nowrap;
  }

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

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Cards ── */
  .cards-list {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .reconoc-card {
    border: 1px solid var(--border, #e2e8f0);
    border-radius: 12px;
    padding: 1.125rem 1.25rem;
    background: var(--surface, #fff);
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
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
    font-size: 0.875rem;
    color: var(--text-primary, #0f172a);
    line-height: 1.55;
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
</style>
