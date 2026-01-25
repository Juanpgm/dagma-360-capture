<script lang="ts">
  import { authStore } from "../stores/authStore";
  import VisitaVerificacion from "./visitas/VisitaVerificacion.svelte";
  import HistorialVisitas from "./visitas/HistorialVisitas.svelte";
  import ReportesParques from "./visitas/ReportesParques.svelte";
  import MapaParques from "./visitas/MapaParques.svelte";
  import MapaReportes from "./visitas/MapaReportes.svelte";

  type View = 'home' | 'visita' | 'historial' | 'reportes' | 'mapa-parques' | 'mapa-reportes';
  let currentView: View = 'home';

  const handleLogout = async () => {
    await authStore.logout();
  };

  function openVisita() {
    currentView = 'visita';
  }

  function openHistorial() {
    currentView = 'historial';
  }

  function openReportes() {
    currentView = 'reportes';
  }

  function openMapaParques() {
    currentView = 'mapa-parques';
  }

  function openMapaReportes() {
    currentView = 'mapa-reportes';
  }

  function goHome() {
    currentView = 'home';
  }
</script>

{#if currentView === 'visita'}
  <VisitaVerificacion onClose={goHome} />
{:else if currentView === 'historial'}
  <HistorialVisitas onClose={goHome} />
{:else if currentView === 'reportes'}
  <div class="view-container">
    <header class="header">
      <button class="btn-back" on:click={goHome}>← Volver</button>
      <h1>DAGMA Parques</h1>
      <button class="btn-logout" on:click={handleLogout}>Cerrar sesión</button>
    </header>
    <ReportesParques />
  </div>
{:else if currentView === 'mapa-parques'}
  <div class="view-container">
    <header class="header">
      <button class="btn-back" on:click={goHome}>← Volver</button>
      <h1>DAGMA Parques</h1>
      <button class="btn-logout" on:click={handleLogout}>Cerrar sesión</button>
    </header>
    <MapaParques />
  </div>
{:else if currentView === 'mapa-reportes'}
  <div class="view-container">
    <header class="header">
      <button class="btn-back" on:click={goHome}>← Volver</button>
      <h1>DAGMA Parques</h1>
      <button class="btn-logout" on:click={handleLogout}>Cerrar sesión</button>
    </header>
    <MapaReportes />
  </div>
{:else}
  <div class="home-container">
    <header class="header">
      <h1>DAGMA Parques</h1>
      <button class="btn-logout" on:click={handleLogout}>Cerrar sesión</button>
    </header>

    <div class="content">
      <div class="welcome">
        <h2>¡Bienvenido!</h2>
        <p>Sistema de Información de Parques</p>

        <div class="user-card">
          <div class="user-avatar">
            {#if $authStore.user?.photoURL}
              <img src={$authStore.user.photoURL} alt="Avatar" />
            {:else}
              <div class="avatar-placeholder">
                {($authStore.user?.email?.[0] || "U").toUpperCase()}
              </div>
            {/if}
          </div>

          <div class="user-details">
            <p class="user-name">
              {$authStore.user?.displayName ||
                $authStore.user?.email ||
                "Usuario"}
            </p>
            <p class="user-email">{$authStore.user?.email}</p>

            {#if $authStore.user?.roles?.length > 0}
              <div class="user-roles">
                <strong>Roles:</strong>
                {#each $authStore.user.roles as role}
                  <span class="badge">{role}</span>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Menú de acciones -->
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

          <button class="action-card secondary" on:click={openHistorial}>
            <div class="action-icon">📋</div>
            <h3 class="action-title">Historial Legacy</h3>
            <p class="action-description">Versión anterior</p>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .view-container {
    min-height: 100vh;
    min-height: 100dvh;
    background-color: var(--surface);
  }

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
  }

  .header h1 {
    color: var(--primary);
    font-size: 1.5rem;
    font-weight: 700;
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

  .content {
    padding: 2rem 1.5rem;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: calc(100vh - 80px);
  }

  .welcome {
    text-align: center;
    background: white;
    padding: 3rem;
    border-radius: 1rem;
    box-shadow: 0 4px 6px var(--shadow);
    max-width: 600px;
    width: 100%;
  }

  .welcome h2 {
    color: var(--text-primary);
    font-size: 2rem;
    margin-bottom: 1rem;
  }

  .welcome p {
    color: var(--text-secondary);
    font-size: 1rem;
    margin-bottom: 0.5rem;
  }

  .user-card {
    margin-top: 2rem;
    padding: 1.5rem;
    background-color: var(--surface);
    border-radius: 0.75rem;
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .user-avatar {
    flex-shrink: 0;
  }

  .user-avatar img,
  .avatar-placeholder {
    width: 64px;
    height: 64px;
    border-radius: 50%;
  }

  .avatar-placeholder {
    background: linear-gradient(
      135deg,
      var(--primary) 0%,
      var(--primary-dark) 100%
    );
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .user-details {
    flex: 1;
    text-align: left;
  }

  .user-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.25rem 0;
  }

  .user-email {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin: 0 0 0.5rem 0;
  }

  .user-roles {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .badge {
    background-color: var(--primary);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .actions-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-top: 2rem;
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

  .action-card.secondary {
    opacity: 0.7;
  }

  .action-card:hover:not(:disabled) {
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
    border-color: var(--primary);
  }

  .action-card:active:not(:disabled) {
    transform: translateY(0);
  }

  .action-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  @media (max-width: 640px) {
    .header {
      padding: 1rem;
    }

    .header h1 {
      font-size: 1.25rem;
    }

    .content {
      padding: 1.5rem 1rem;
    }

    .welcome {
      padding: 2rem 1.5rem;
    }

    .welcome h2 {
      font-size: 1.5rem;
    }

    .actions-grid {
      grid-template-columns: 1fr;
    }

    .user-card {
      flex-direction: column;
      text-align: center;
    }

    .user-details {
      text-align: center;
    }
  }
</style>
