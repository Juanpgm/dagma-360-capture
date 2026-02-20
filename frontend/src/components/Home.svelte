<script lang="ts">
  import { authStore } from "../stores/authStore";
  import VisitaVerificacion from "./visitas/VisitaVerificacion.svelte";
  import KanbanReportes from "./history/KanbanReportes.svelte";
  import MapaParques from "./visitas/MapaParques.svelte";
  import MapaReportes from "./visitas/MapaReportes.svelte";
  import Convocatorias from "./convocatorias/Convocatorias.svelte";

  type View =
    | "home"
    | "visita"
    | "reportes"
    | "mapa-parques"
    | "mapa-reportes"
    | "convocatorias";
  let currentView: View = "home";

  const handleLogout: () => Promise<void> = async () => {
    await authStore.logout();
  };

  function openVisita(): void {
    currentView = "visita";
  }

  function openReportes(): void {
    currentView = "reportes";
  }

  function openMapaParques(): void {
    currentView = "mapa-parques";
  }

  function openMapaReportes(): void {
    currentView = "mapa-reportes";
  }

  function openConvocatorias(): void {
    currentView = "convocatorias";
  }

  function goHome(): void {
    currentView = "home";
  }

  $: currentUser = $authStore.user;
  $: userFullName =
    currentUser?.full_name ||
    currentUser?.nombre_completo ||
    currentUser?.displayName ||
    currentUser?.email ||
    "Usuario";
  $: userGrupo = currentUser?.grupo || "No asignado";
  $: userRol =
    currentUser?.rol ||
    currentUser?.role ||
    (Array.isArray(currentUser?.roles) && currentUser.roles.length > 0
      ? currentUser.roles[0]
      : "No asignado");
  $: userAvatarLetter = (
    userFullName?.[0] ||
    currentUser?.email?.[0] ||
    "U"
  ).toUpperCase();
</script>

{#if currentView === "visita"}
  <VisitaVerificacion onClose={goHome} />
{:else if currentView === "reportes"}
  <KanbanReportes />
{:else if currentView === "mapa-parques"}
  <div class="view-container">
    <header class="header">
      <button class="btn-back" on:click={goHome}>← Volver</button>
      <div class="brand">DAGMA Parques</div>
      <div class="header-right">
        <div class="user-chip">
          <div class="user-avatar">
            {userAvatarLetter}
          </div>
          <div class="user-meta">
            <span class="user-name">{userFullName}</span>
            <div class="user-subline">
              <span class="user-detail"
                ><strong>Grupo:</strong> {userGrupo}</span
              >
              <span class="user-detail"><strong>Rol:</strong> {userRol}</span>
            </div>
          </div>
        </div>
        <button class="btn-logout" on:click={handleLogout}>
          Cerrar sesion
        </button>
      </div>
    </header>
    <MapaParques />
  </div>
{:else if currentView === "mapa-reportes"}
  <div class="view-container">
    <header class="header">
      <button class="btn-back" on:click={goHome}>← Volver</button>
      <div class="brand">DAGMA Parques</div>
      <div class="header-right">
        <div class="user-chip">
          <div class="user-avatar">
            {userAvatarLetter}
          </div>
          <div class="user-meta">
            <span class="user-name">{userFullName}</span>
            <div class="user-subline">
              <span class="user-detail"
                ><strong>Grupo:</strong> {userGrupo}</span
              >
              <span class="user-detail"><strong>Rol:</strong> {userRol}</span>
            </div>
          </div>
        </div>
        <button class="btn-logout" on:click={handleLogout}>
          Cerrar sesion
        </button>
      </div>
    </header>
    <MapaReportes />
  </div>
{:else if currentView === "convocatorias"}
  <div class="view-container">
    <header class="header">
      <button class="btn-back" on:click={goHome}>← Volver</button>
      <div class="brand">DAGMA Parques</div>
      <div class="header-right">
        <div class="user-chip">
          <div class="user-avatar">
            {userAvatarLetter}
          </div>
          <div class="user-meta">
            <span class="user-name">{userFullName}</span>
            <div class="user-subline">
              <span class="user-detail"
                ><strong>Grupo:</strong> {userGrupo}</span
              >
              <span class="user-detail"><strong>Rol:</strong> {userRol}</span>
            </div>
          </div>
        </div>
        <button class="btn-logout" on:click={handleLogout}>
          Cerrar sesion
        </button>
      </div>
    </header>
    <Convocatorias />
  </div>
{:else}
  <div class="home-container">
    <header class="header header-home">
      <div class="brand">DAGMA Parques</div>
      <div class="header-right">
        <div class="user-chip">
          <div class="user-avatar">
            {userAvatarLetter}
          </div>
          <div class="user-meta">
            <span class="user-name">{userFullName}</span>
            <div class="user-subline">
              <span class="user-detail"
                ><strong>Grupo:</strong> {userGrupo}</span
              >
              <span class="user-detail"><strong>Rol:</strong> {userRol}</span>
            </div>
          </div>
        </div>
        <button class="btn-logout" on:click={handleLogout}>
          Cerrar sesion
        </button>
      </div>
    </header>

    <div class="convocatorias-banner">
      <div class="banner-text">
        <h3>Programación - Plan Distrito Verde</h3>
        <p>Consulta las actividades programadas y sus detalles</p>
      </div>
      <button class="btn-convocatorias" on:click={openConvocatorias}>
        Ver Programación
      </button>
    </div>

    <div class="content">
      <div class="welcome">
        <h2>Bienvenido</h2>
        <p>Sistema de Informacion de Parques</p>

        <div class="actions-grid">
          <button class="action-card primary" on:click={openVisita}>
            <div class="action-icon">🌳</div>
            <h3 class="action-title">Reconocimiento</h3>
            <p class="action-description">Registrar reconocimiento</p>
          </button>

          <button class="action-card" on:click={openReportes}>
            <div class="action-icon">📊</div>
            <h3 class="action-title">Reportes</h3>
            <p class="action-description">Historial de reconocimientos</p>
          </button>

          <button class="action-card" on:click={openMapaParques}>
            <div class="action-icon">🗺️</div>
            <h3 class="action-title">Mapa de Parques</h3>
            <p class="action-description">Visualizar parques en mapa</p>
          </button>

          <button class="action-card" on:click={openMapaReportes}>
            <div class="action-icon">📍</div>
            <h3 class="action-title">Mapa de Reportes</h3>
            <p class="action-description">Reconocimientos en mapa</p>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .view-container,
  .home-container {
    min-height: 100vh;
    min-height: 100dvh;
    background-color: var(--surface);
  }

  .header {
    background-color: white;
    padding: 1rem 1.5rem;
    box-shadow: 0 1px 3px var(--shadow);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .header-home {
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .brand {
    color: var(--primary);
    font-size: 1.5rem;
    font-weight: 700;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .user-chip {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    background: var(--surface);
    padding: 0.5rem 0.75rem;
    border-radius: 0.9rem;
    border: 1px solid var(--border);
  }

  .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(
      135deg,
      var(--primary) 0%,
      var(--primary-dark) 100%
    );
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
  }

  .user-meta {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    line-height: 1.2;
  }

  .user-name {
    font-weight: 700;
    color: var(--text-primary);
    font-size: 0.85rem;
  }

  .user-detail {
    color: var(--text-secondary);
    font-size: 0.74rem;
  }

  .user-subline {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .btn-back {
    background-color: transparent;
    color: var(--primary);
    border: 1px solid var(--primary);
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    transition: all 0.2s;
    cursor: pointer;
  }

  .btn-back:hover {
    background-color: var(--primary);
    color: white;
  }

  .btn-logout {
    background-color: transparent;
    color: var(--error);
    border: 1px solid var(--error);
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .btn-logout:hover {
    background-color: var(--error);
    color: white;
  }

  .convocatorias-banner {
    margin: 1.5rem;
    padding: 1.25rem 1.5rem;
    background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
    border-radius: 1rem;
    border: 2px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .banner-text h3 {
    color: var(--primary-dark);
    font-size: 1.1rem;
    margin-bottom: 0.25rem;
  }

  .banner-text p {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .btn-convocatorias {
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 0.75rem;
    padding: 0.75rem 1.25rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-convocatorias:hover {
    background: var(--primary-dark);
    transform: translateY(-1px);
  }

  .content {
    padding: 1rem 1.5rem 2.5rem;
    display: flex;
    justify-content: center;
  }

  .welcome {
    text-align: center;
    background: white;
    padding: 2.5rem;
    border-radius: 1rem;
    box-shadow: 0 4px 6px var(--shadow);
    max-width: 900px;
    width: 100%;
  }

  .welcome h2 {
    color: var(--text-primary);
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .welcome p {
    color: var(--text-secondary);
    font-size: 1rem;
    margin-bottom: 1.5rem;
  }

  .actions-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  .action-card {
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    padding: 1.5rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .action-card.primary {
    background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
    border-color: #059669;
  }

  .action-card:hover:not(:disabled) {
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
    border-color: var(--primary);
  }

  .action-icon {
    font-size: 3rem;
    margin-bottom: 0.75rem;
  }

  .action-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .action-description {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin: 0;
  }

  @media (max-width: 768px) {
    .header {
      flex-direction: column;
      align-items: stretch;
    }

    .header-right {
      justify-content: space-between;
      flex-wrap: wrap;
    }

    .convocatorias-banner {
      flex-direction: column;
      align-items: flex-start;
      margin: 1rem;
    }

    .actions-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
