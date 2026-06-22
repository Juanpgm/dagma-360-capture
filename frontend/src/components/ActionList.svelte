<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let permissions: { canManageUsers: boolean; canAccessUserAdmin: boolean; canSendAnnouncements: boolean };
  export let navigationError: string | null;

  const dispatch = createEventDispatcher();
</script>

<main class="home-content">
  {#if navigationError}
    <div class="nav-error">{navigationError}</div>
  {/if}
  <section class="welcome">
    <h2>Bienvenido</h2>
    <p>Gestión ambiental integral</p>
  </section>

  <div class="actions-list">
    <button class="action-card" on:click={() => dispatch('navigate', { view: 'convocatorias' })}>
      <div class="action-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <div class="action-text">
        <span class="action-title">Programación — Plan Distrito Verde</span>
        <span class="action-desc">Consulta las actividades programadas</span>
      </div>
      <svg class="action-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </button>
    <button class="action-card" on:click={() => dispatch('navigate', { view: 'visita' })}>
      <div class="action-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 1.5 1.5 0 0 1 0-3"/><path d="M14.5 10a4 4 0 0 0 0-8"/><path d="M8.5 10a4 4 0 0 1 0-8"/><path d="M2 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 0 1 0-5C3.5 5 3 3.5 3 2"/><path d="M12 22V10"/><path d="M2 10h20"/></svg>
      </div>
      <div class="action-text">
        <span class="action-title">Intervención</span>
        <span class="action-desc">Registrar intervención ambiental</span>
      </div>
      <svg class="action-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </button>

    <button class="action-card" on:click={() => dispatch('navigate', { view: 'reportes' })}>
      <div class="action-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      </div>
      <div class="action-text">
        <span class="action-title">Reportes</span>
        <span class="action-desc">Historial de intervenciones</span>
      </div>
      <svg class="action-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </button>

    <button class="action-card" on:click={() => dispatch('navigate', { view: 'dashboard' })}>
      <div class="action-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      </div>
      <div class="action-text">
        <span class="action-title">Dashboard</span>
        <span class="action-desc">Panel analítico</span>
      </div>
      <svg class="action-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </button>

    {#if permissions.canManageUsers}
    <button class="action-card" on:click={() => dispatch('navigate', { view: 'grupos' })}>
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

    {#if permissions.canAccessUserAdmin}
    <button class="action-card" on:click={() => dispatch('navigate', { view: 'usuarios' })}>
      <div class="action-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="4"/>
          <path d="M20 21a8 8 0 1 0-16 0"/>
          <path d="m16 18 2 2 4-4"/>
        </svg>
      </div>
      <div class="action-text">
        <span class="action-title">Gestión de Usuarios</span>
        <span class="action-desc">Administrar cuentas y privilegios</span>
      </div>
      <svg class="action-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </button>
    {/if}
    {#if permissions.canSendAnnouncements}
    <button class="action-card" on:click={() => dispatch('navigate', { view: 'anuncios' })} data-testid="home-card-anuncios">
      <div class="action-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 11v3a4 4 0 0 0 4 4h.5l3 4v-4h6a4 4 0 0 0 4-4v-3a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4z"/>
          <line x1="7" y1="11" x2="17" y2="11"/>
        </svg>
      </div>
      <div class="action-text">
        <span class="action-title">Anuncios</span>
        <span class="action-desc">Envía notificaciones a usuarios y grupos</span>
      </div>
      <svg class="action-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </button>
    {/if}
  </div>
</main>

<style>
  .nav-error {
    background: #fee2e2;
    color: #dc2626;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin: 0 1rem 0.75rem;
    font-size: 0.875rem;
  }

  /* Home Content */
  .home-content {
    max-width: 720px;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 3rem;
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
    .home-content {
      padding: 1rem;
    }
  }
</style>
