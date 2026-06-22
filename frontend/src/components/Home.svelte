<script lang="ts">
  import { onMount } from "svelte";
  import { authStore, permissions } from "../stores/authStore";
  import { GRUPO_DISPLAY_NAMES, type GrupoKey } from "../lib/grupos";
  import AppHeader from "./AppHeader.svelte";
  import ActionList from "./ActionList.svelte";

  type View = "home" | "visita" | "reportes" | "convocatorias" | "dashboard" | "grupos" | "usuarios" | "anuncios";
  let currentView: View = "home";

  // Lazy-loaded view components
  let VisitaVerificacion: any = null;
  let KanbanReportes: any = null;
  let Convocatorias: any = null;
  let Dashboard: any = null;
  let GestionGrupos: any = null;
  let GestionUsuarios: any = null;
  let Anuncios: any = null;

  const viewLoaders: Record<string, () => Promise<{ default: any }>> = {
    visita:        () => import("./visitas/VisitaVerificacion.svelte"),
    reportes:      () => import("./history/KanbanReportes.svelte"),
    convocatorias: () => import("./convocatorias/Convocatorias.svelte"),
    dashboard:     () => import("./dashboard/Dashboard.svelte"),
    grupos:        () => import("./grupos/GestionGrupos.svelte"),
    usuarios:      () => import("./admin/GestionUsuarios.svelte"),
    anuncios:      () => import("./admin/Anuncios.svelte"),
  };

  const handleLogout: () => Promise<void> = async () => {
    try {
      await authStore.logout();
    } catch (e) {
      console.error('Error al cerrar sesión:', e);
    }
  };

  // Deep-link desde correos de notificación: ?view=convocatorias (u otras vistas).
  // La URL puede incluir este parámetro antes del login; cuando Home monta ya está autenticado.
  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get("view") as View | null;
    if (viewParam && viewLoaders[viewParam]) {
      navigate(viewParam);
    }
  });

  let navigationError: string | null = null;
  let showProfileModal = false;
  let UserProfileModal: any = null;
  let showSettings = false;
  import SettingsModal from "./ui/SettingsModal.svelte";

  async function openProfileModal() {
    if (!UserProfileModal) {
      const mod = await import("./admin/UserProfileModal.svelte");
      UserProfileModal = mod.default;
    }
    showProfileModal = true;
  }

  function handleProfileUpdated(e: CustomEvent<{ photoURL?: string; full_name?: string; cellphone?: string }>) {
    if (e.detail?.photoURL) userPhotoURL = e.detail.photoURL;
  }

  async function navigate(view: View): Promise<void> {
    if (view === "grupos" && !$permissions.canManageUsers) return;
    if (view === "usuarios" && !$permissions.canAccessUserAdmin) return;
    if (view === "anuncios" && !$permissions.canSendAnnouncements) return;
    navigationError = null;
    if (view !== "home" && viewLoaders[view]) {
      try {
        const mod = await viewLoaders[view]();
        if (view === "visita")        VisitaVerificacion = mod.default;
        if (view === "reportes")      KanbanReportes     = mod.default;
        if (view === "convocatorias") Convocatorias      = mod.default;
        if (view === "dashboard")     Dashboard          = mod.default;
        if (view === "grupos")        GestionGrupos      = mod.default;
        if (view === "usuarios")      GestionUsuarios    = mod.default;
        if (view === "anuncios")      Anuncios           = mod.default;
      } catch (e) {
        console.error("Error al cargar módulo:", view, e);
        navigationError = "No se pudo cargar el módulo. Intenta de nuevo.";
        return;
      }
    }
    currentView = view;
  }

  $: currentUser = $authStore.user;
  $: userPhotoURL = currentUser?.photoURL ?? null;
  $: userFullName =
    currentUser?.full_name ||
    currentUser?.nombre_completo ||
    currentUser?.displayName ||
    currentUser?.email ||
    "Usuario";
  $: userGrupo = (() => { const g = currentUser?.grupo || "No asignado"; return GRUPO_DISPLAY_NAMES[g as GrupoKey] ?? g.charAt(0).toUpperCase() + g.slice(1); })();
  import { normalizeRole, ROLE_LABELS, ROLE_COLORS } from "../lib/permissions";
  $: userRolRaw =
    currentUser?.role ||
    currentUser?.rol ||
    (Array.isArray(currentUser?.roles) && currentUser.roles.length > 0
      ? currentUser.roles[0]
      : "operador");
  $: userRolNorm = normalizeRole(userRolRaw);
  $: userRolLabel = ROLE_LABELS[userRolNorm] || "No asignado";
  $: userRolColor = ROLE_COLORS[userRolNorm] || "#64748b";
  $: isDirector = userRolNorm === 'director';
  $: userAvatarLetter = (
    userFullName?.[0] ||
    currentUser?.email?.[0] ||
    "U"
  ).toUpperCase();

  // TS type assertions (`as View`) are not valid inside Svelte markup
  // expressions, so the cast lives here in the script instead.
  function navigateFromEvent(view: string): void {
    navigate(view as View);
  }
</script>

{#if currentView === "visita"}
  {#if VisitaVerificacion}
    <svelte:component this={VisitaVerificacion} onClose={() => navigate("home")} />
  {:else}
    <div class="loading-view">Cargando…</div>
  {/if}
{:else}
  <div class="shell">
    <AppHeader
      {userPhotoURL}
      {userFullName}
      {userGrupo}
      {userRolLabel}
      {userRolColor}
      {userAvatarLetter}
      {isDirector}
      isAtHome={currentView === "home"}
      on:logout={handleLogout}
      on:openProfile={openProfileModal}
      on:openSettings={() => showSettings = true}
      on:navigateHome={() => navigate("home")}
    />

    {#if showProfileModal && UserProfileModal}
      <svelte:component
        this={UserProfileModal}
        on:close={() => showProfileModal = false}
        on:updated={handleProfileUpdated}
      />
    {/if}

    <SettingsModal bind:open={showSettings} onClose={() => showSettings = false} />

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
    {:else if currentView === "usuarios"}
      {#if GestionUsuarios}
        <svelte:component this={GestionUsuarios} />
      {:else}
        <div class="loading-view">Cargando…</div>
      {/if}
    {:else if currentView === "anuncios"}
      {#if Anuncios}
        <svelte:component this={Anuncios} />
      {:else}
        <div class="loading-view">Cargando…</div>
      {/if}
    {:else}
      <ActionList
        permissions={$permissions}
        {navigationError}
        on:navigate={(e) => navigateFromEvent(e.detail.view)}
      />
    {/if}
  </div>
{/if}

<style>
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
</style>
