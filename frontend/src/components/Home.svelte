<script lang="ts">
  import { authStore, permissions } from "../stores/authStore";
  import { GRUPO_DISPLAY_NAMES, type GrupoKey } from "../lib/grupos";

  type View = "home" | "visita" | "reportes" | "convocatorias" | "dashboard" | "grupos";
  let currentView: View = "home";

  // Lazy-loaded view components
  let VisitaVerificacion: any = null;
  let KanbanReportes: any = null;
  let Convocatorias: any = null;
  let Dashboard: any = null;
  let GestionGrupos: any = null;

  const viewLoaders: Record<string, () => Promise<{ default: any }>> = {
    visita:        () => import("./visitas/VisitaVerificacion.svelte"),
    reportes:      () => import("./history/KanbanReportes.svelte"),
    convocatorias: () => import("./convocatorias/Convocatorias.svelte"),
    dashboard:     () => import("./dashboard/Dashboard.svelte"),
    grupos:        () => import("./grupos/GestionGrupos.svelte"),
  };

  const handleLogout: () => Promise<void> = async () => {
    try {
      await authStore.logout();
    } catch (e) {
      console.error('Error al cerrar sesión:', e);
    }
  };

  let navigationError: string | null = null;

  async function navigate(view: View): Promise<void> {
    if (view === "grupos" && !$permissions.canManageUsers) return;
    navigationError = null;
    if (view !== "home" && viewLoaders[view]) {
      try {
        const mod = await viewLoaders[view]();
        if (view === "visita")        VisitaVerificacion = mod.default;
        if (view === "reportes")      KanbanReportes     = mod.default;
        if (view === "convocatorias") Convocatorias      = mod.default;
        if (view === "dashboard")     Dashboard          = mod.default;
        if (view === "grupos")        GestionGrupos      = mod.default;
      } catch (e) {
        console.error("Error al cargar módulo:", view, e);
        navigationError = "No se pudo cargar el módulo. Intenta de nuevo.";
        return;
      }
    }
    currentView = view;
  }

  $: currentUser = $authStore.user;
  $: userFullName =
    currentUser?.full_name ||
    currentUser?.nombre_completo ||
    currentUser?.displayName ||
    currentUser?.email ||
    "Usuario";
  $: userGrupo = (() => { const g = currentUser?.grupo || "No asignado"; return GRUPO_DISPLAY_NAMES[g as GrupoKey] ?? g.charAt(0).toUpperCase() + g.slice(1); })();
  import { normalizeRole, ROLE_LABELS, ROLE_COLORS } from "../lib/permissions";
  $: userRolRaw =
    currentUser?.rol ||
    currentUser?.role ||
    (Array.isArray(currentUser?.roles) && currentUser.roles.length > 0
      ? currentUser.roles[0]
      : "operador");
  $: userRolNorm = normalizeRole(userRolRaw);
  $: userRolLabel = ROLE_LABELS[userRolNorm] || "No asignado";
  $: userRolColor = ROLE_COLORS[userRolNorm] || "#64748b";
  $: userAvatarLetter = (
    userFullName?.[0] ||
    currentUser?.email?.[0] ||
    "U"
  ).toUpperCase();
</script>

{#if currentView === "visita"}
  {#if VisitaVerificacion}
    <svelte:component this={VisitaVerificacion} onClose={() => navigate("home")} />
  {:else}
    <div class="loading-view">Cargando…</div>
  {/if}
{:else}
  <div class="shell">
    <header class="header" class:sticky={currentView === "home"}>
      {#if currentView !== "home"}
        <button class="btn-back" on:click={() => navigate("home")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Volver
        </button>
      {/if}
      <div class="brand">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c4-4 8-7.5 8-12a8 8 0 1 0-16 0c0 4.5 4 8 8 12z"/><circle cx="12" cy="10" r="3"/></svg>
        DAGMA 360
      </div>
      <div class="header-right">
        <div class="user-chip">
          <div class="user-avatar">{userAvatarLetter}</div>
          <div class="user-meta">
            <span class="user-name">{userFullName}</span>
            <span class="user-detail">{userGrupo} · <span style="color:{userRolColor};font-weight:500">{userRolLabel}</span></span>
          </div>
        </div>
        <button class="btn-icon" on:click={handleLogout} title="Cerrar sesión">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </header>

    {#if currentView === "reportes"}
      {#if KanbanReportes}
        <svelte:component this={KanbanReportes} />
      {:else}
        <div class="loading-view">Cargando…</div>
      {/if}
    {:else if currentView === "convocatorias"}
      {#if Convocatorias}
        <svelte:component this={Convocatorias} />
      {:else}
        <div class="loading-view">Cargando…</div>
      {/if}
    {:else if currentView === "dashboard"}
      {#if Dashboard}
        <svelte:component this={Dashboard} />
      {:else}
        <div class="loading-view">Cargando…</div>
      {/if}
    {:else if currentView === "grupos"}
      {#if GestionGrupos}
        <svelte:component this={GestionGrupos} />
      {:else}
        <div class="loading-view">Cargando…</div>
      {/if}
    {:else}
      <main class="home-content">
        {#if navigationError}
          <div class="nav-error">{navigationError}</div>
        {/if}
        <section class="welcome">
          <h2>Bienvenido</h2>
          <p>Gestión ambiental integral</p>
        </section>

        <div class="actions-list">
          <section class="banner" on:click={() => navigate("convocatorias")} on:keydown={(e) => e.key === 'Enter' && navigate("convocatorias")} role="button" tabindex="0">
            <div class="banner-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div class="banner-text">
              <span class="banner-title">Programación — Plan Distrito Verde</span>
              <span class="banner-sub">Consulta las actividades programadas</span>
            </div>
            <svg class="banner-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </section>
          <button class="action-card primary" on:click={() => navigate("visita")}>
            <div class="action-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 1.5 1.5 0 0 1 0-3"/><path d="M14.5 10a4 4 0 0 0 0-8"/><path d="M8.5 10a4 4 0 0 1 0-8"/><path d="M2 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 0 1 0-5C3.5 5 3 3.5 3 2"/><path d="M12 22V10"/><path d="M2 10h20"/></svg>
            </div>
            <div class="action-text">
              <span class="action-title">Intervención</span>
              <span class="action-desc">Registrar intervención ambiental</span>
            </div>
            <svg class="action-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>

          <button class="action-card" on:click={() => navigate("reportes")}>
            <div class="action-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <div class="action-text">
              <span class="action-title">Reportes</span>
              <span class="action-desc">Historial de intervenciones</span>
            </div>
            <svg class="action-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>

          <button class="action-card" on:click={() => navigate("dashboard")}>
            <div class="action-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </div>
            <div class="action-text">
              <span class="action-title">Dashboard</span>
              <span class="action-desc">Panel analítico</span>
            </div>
            <svg class="action-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>

          {#if $permissions.canManageUsers}
          <button class="action-card" on:click={() => navigate("grupos")}>
            <div class="action-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div class="action-text">
              <span class="action-title">Grupos y Personal</span>
              <span class="action-desc">Gestionar grupos y personal</span>
            </div>
            <svg class="action-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
          {/if}
        </div>
      </main>
    {/if}
  </div>
{/if}

<style>
  .nav-error {
    background: #fee2e2;
    color: #dc2626;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin: 0 1rem 0.75rem;
    font-size: 0.875rem;
  }

  .loading-view {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .shell {
    min-height: 100vh;
    min-height: 100dvh;
    background-color: var(--background);
  }

  /* Header */
  .header {
    background: var(--surface);
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .header.sticky {
    position: sticky;
    top: 0;
    z-index: 10;
    backdrop-filter: blur(12px);
    background: rgba(255, 255, 255, 0.9);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-primary);
    font-size: 1.125rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    margin-right: auto;
  }
  .brand svg {
    color: var(--primary);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .user-chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.625rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--surface-alt);
  }

  .user-avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.8125rem;
  }

  .user-meta {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  .user-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.8125rem;
  }

  .user-detail {
    color: var(--text-muted);
    font-size: 0.6875rem;
  }

  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: none;
    color: var(--text-secondary);
    border: 1px solid var(--border);
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius);
    font-weight: 500;
    font-size: 0.8125rem;
    transition: all var(--transition);
  }
  .btn-back:hover {
    background: var(--surface-alt);
    color: var(--text-primary);
  }

  .btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: none;
    color: var(--text-muted);
    transition: all var(--transition);
  }
  .btn-icon:hover {
    color: var(--error);
    border-color: var(--error);
    background: rgba(220, 38, 38, 0.04);
  }

  /* Home Content */
  .home-content {
    max-width: 720px;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 3rem;
  }

  .banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition);
    width: 100%;
    text-align: left;
  }
  .banner:hover {
    border-color: var(--primary);
    box-shadow: var(--shadow);
  }
  .banner-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius);
    background: var(--surface-alt);
    color: var(--primary);
    flex-shrink: 0;
  }
  .banner-text {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .banner-title {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-primary);
  }
  .banner-sub {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .banner-arrow {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .welcome {
    margin-bottom: 1.25rem;
  }
  .welcome h2 {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.2rem;
  }
  .welcome p {
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .actions-list {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .action-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition);
    text-align: left;
    width: 100%;
  }
  .action-card:hover {
    border-color: var(--primary);
    box-shadow: var(--shadow);
  }
  .action-card.primary {
    border-color: var(--primary);
    background: rgba(5, 150, 105, 0.03);
  }
  .action-card.primary:hover {
    background: rgba(5, 150, 105, 0.06);
  }

  .action-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius);
    background: var(--surface-alt);
    color: var(--text-secondary);
    flex-shrink: 0;
  }
  .action-card.primary .action-icon {
    background: rgba(5, 150, 105, 0.08);
    color: var(--primary);
  }

  .action-text {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .action-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.3;
  }

  .action-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.4;
  }

  .action-arrow {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    .user-meta {
      display: none;
    }
    .home-content {
      padding: 1rem;
    }
  }
</style>
