<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let userPhotoURL: string | null;
  export let userFullName: string;
  export let userGrupo: string;
  export let userRolLabel: string;
  export let userRolColor: string;
  export let userAvatarLetter: string;
  export let isDirector: boolean;
  export let isAtHome: boolean;

  const dispatch = createEventDispatcher();
</script>

<header class="header" class:sticky={isAtHome}>
  {#if !isAtHome}
    <button class="btn-back" on:click={() => dispatch('navigateHome')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      Volver
    </button>
  {/if}
  <div class="brand">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c4-4 8-7.5 8-12a8 8 0 1 0-16 0c0 4.5 4 8 8 12z"/><circle cx="12" cy="10" r="3"/></svg>
    DAGMA 360
  </div>
  <div class="header-right">
    <div class="user-chip" class:user-chip--director={isDirector}>
      <div class="user-avatar" class:user-avatar--director={isDirector}>
        {#if userPhotoURL}
          <img
            src={userPhotoURL}
            alt={userFullName}
            class="user-photo"
            referrerpolicy="no-referrer"
            on:error={() => { userPhotoURL = null; }}
          />
        {:else}
          {userAvatarLetter}
        {/if}
      </div>
      <div class="user-meta">
        <span class="user-name">{userFullName}</span>
        <span class="user-detail">{userGrupo} · <span style="color:{userRolColor};font-weight:500">{userRolLabel}</span></span>
      </div>
      <button class="btn-gear" on:click={() => dispatch('openProfile')} title="Configuración de perfil" aria-label="Editar perfil">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
    </div>
    <button class="btn-icon" on:click={() => dispatch('logout')} title="Cerrar sesión">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
    </button>
    <button class="btn-icon" on:click={() => dispatch('openSettings')} title="Ajustes de la app" aria-label="Abrir ajustes">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
    </button>
  </div>
</header>

<style>
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

  /* Director — marco dorado sutil */
  .user-chip--director {
    border-color: #c9972e;
    background: linear-gradient(135deg, #fffbf0 0%, #fff8e6 100%);
    box-shadow: 0 0 0 1px rgba(201, 151, 46, 0.18), 0 1px 4px rgba(184, 150, 46, 0.12);
  }

  .user-avatar--director {
    background: linear-gradient(135deg, #c9972e 0%, #e8b84b 100%);
    box-shadow: 0 0 0 2px rgba(201, 151, 46, 0.25);
  }

  .btn-gear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: var(--radius-sm);
    padding: 0;
    flex-shrink: 0;
    transition: color var(--transition), background var(--transition);
  }
  .btn-gear:hover { color: var(--primary); background: rgba(5,150,105,.08); }

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
    overflow: hidden;
    flex-shrink: 0;
  }

  .user-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
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

  @media (max-width: 640px) {
    .user-meta {
      display: none;
    }
    .user-chip {
      padding: 0.25rem 0.5rem;
      gap: 0.375rem;
    }
    .user-avatar {
      width: 34px;
      height: 34px;
      font-size: 0.875rem;
    }
    .btn-gear {
      width: 28px;
      height: 28px;
    }
  }
</style>
