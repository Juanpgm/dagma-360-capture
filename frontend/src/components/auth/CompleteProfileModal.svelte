<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { completeGoogleProfile, type PartialGoogleUser } from "../../api/auth";
  import { GRUPO_KEYS, GRUPO_DISPLAY_NAMES, GRUPO_DESCRIPTIONS, type GrupoKey } from "../../lib/grupos";

  export let partialUser: PartialGoogleUser;

  const dispatch = createEventDispatcher<{
    completed: { access_token: string; token_type: string; user: any };
    cancel: void;
  }>();

  let selectedGrupo: GrupoKey | "" = "";
  let fullName = partialUser.full_name || partialUser.displayName || "";
  let cellphone = "";
  let saving = false;
  let error = "";

  async function handleSubmit() {
    if (!selectedGrupo) {
      error = "Debes seleccionar un grupo para continuar";
      return;
    }
    if (!fullName.trim()) {
      error = "El nombre es obligatorio";
      return;
    }
    saving = true;
    error = "";
    try {
      const response = await completeGoogleProfile(partialUser.idToken, {
        grupo: selectedGrupo,
        full_name: fullName.trim() || undefined,
        cellphone: cellphone.trim() || undefined,
      });
      dispatch("completed", { access_token: response.access_token, token_type: response.token_type, user: response.user ?? {} });
    } catch (e: any) {
      error = e?.message ?? "Error al guardar el perfil. Intenta de nuevo.";
    } finally {
      saving = false;
    }
  }
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="cpm-title">
  <div class="modal">
    <!-- Header -->
    <div class="modal-header">
      <div class="header-icon">👤</div>
      <div>
        <h2 id="cpm-title" class="modal-title">Completa tu perfil</h2>
        <p class="modal-subtitle">Necesitamos un par de datos antes de continuar</p>
      </div>
    </div>

    <!-- Google identity (read-only) -->
    <div class="google-identity">
      {#if partialUser.photoURL}
        <img class="google-avatar" src={partialUser.photoURL} alt={partialUser.displayName} referrerpolicy="no-referrer" />
      {:else}
        <div class="google-avatar-placeholder">{(partialUser.displayName[0] ?? "?").toUpperCase()}</div>
      {/if}
      <div class="google-info">
        <span class="google-name">{partialUser.displayName}</span>
        <span class="google-email">{partialUser.email}</span>
      </div>
      <div class="google-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Google
      </div>
    </div>

    <div class="modal-body">
      <!-- Nombre -->
      <div class="field">
        <label class="field-label" for="cpm-name">Nombre completo *</label>
        <input
          id="cpm-name"
          class="field-input"
          type="text"
          bind:value={fullName}
          disabled={saving}
          placeholder="Tu nombre completo"
        />
      </div>

      <!-- Teléfono -->
      <div class="field">
        <label class="field-label" for="cpm-phone">Teléfono (opcional)</label>
        <input
          id="cpm-phone"
          class="field-input"
          type="tel"
          bind:value={cellphone}
          disabled={saving}
          placeholder="3001234567"
        />
      </div>

      <!-- Grupo (requerido) -->
      <div class="field">
        <!-- svelte-ignore a11y-label-has-associated-control -->
        <label class="field-label" id="grupo-label">Grupo de trabajo *</label>
        <p class="field-hint">Selecciona el grupo al que perteneces en DAGMA</p>
        <div class="grupo-grid" role="group" aria-labelledby="grupo-label">
          {#each GRUPO_KEYS as g}
            <button
              type="button"
              class="grupo-card"
              class:selected={selectedGrupo === g}
              disabled={saving}
              on:click={() => { selectedGrupo = g; }}
            >
              <span class="grupo-name">{GRUPO_DISPLAY_NAMES[g]}</span>
              <span class="grupo-desc">{GRUPO_DESCRIPTIONS[g]}</span>
            </button>
          {/each}
        </div>
      </div>

      {#if error}
        <div class="msg-error">{error}</div>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" on:click={() => dispatch("cancel")} disabled={saving}>
        Cancelar
      </button>
      <button
        class="btn-primary"
        on:click={handleSubmit}
        disabled={saving || !selectedGrupo}
      >
        {saving ? "Guardando..." : "Continuar"}
      </button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 500;
    padding: 1rem;
  }

  .modal {
    background: var(--surface);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 480px;
    box-shadow: var(--shadow-xl);
    display: flex;
    flex-direction: column;
    max-height: 92dvh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1.5rem 1.5rem 1rem;
    border-bottom: 1px solid var(--border);
  }

  .header-icon {
    font-size: 2rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .modal-title {
    font-size: var(--text-lg);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .modal-subtitle {
    font-size: var(--text-sm);
    color: var(--text-muted);
    margin: 0.125rem 0 0;
  }

  /* Google identity strip */
  .google-identity {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1.5rem;
    background: var(--surface-alt);
    border-bottom: 1px solid var(--border);
  }

  .google-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 2px solid var(--border);
  }

  .google-avatar-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1rem;
    flex-shrink: 0;
  }

  .google-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .google-name {
    font-weight: 600;
    font-size: var(--text-sm);
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .google-email {
    font-size: var(--text-xs);
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .google-badge {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  /* Body */
  .modal-body {
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
  }

  .field-label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 0.375rem;
  }

  .field-hint {
    font-size: var(--text-xs);
    color: var(--text-muted);
    margin: -0.25rem 0 0.5rem;
  }

  .field-input {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: var(--text-sm);
    background: var(--surface);
    color: var(--text-primary);
    transition: border-color var(--transition);
  }

  .field-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
  }

  /* Grupo grid */
  .grupo-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .grupo-card {
    padding: 0.75rem;
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-alt);
    text-align: left;
    cursor: pointer;
    transition: all var(--transition);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .grupo-card:hover:not(:disabled) {
    border-color: var(--primary);
    background: rgba(5, 150, 105, 0.04);
  }

  .grupo-card.selected {
    border-color: var(--primary);
    background: rgba(5, 150, 105, 0.08);
  }

  .grupo-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .grupo-name {
    font-weight: 700;
    font-size: var(--text-sm);
    color: var(--text-primary);
  }

  .grupo-card.selected .grupo-name {
    color: var(--primary-dark);
  }

  .grupo-desc {
    font-size: var(--text-xs);
    color: var(--text-muted);
    line-height: 1.3;
  }

  /* Messages */
  .msg-error {
    padding: 0.625rem 0.75rem;
    background: rgba(220, 38, 38, 0.05);
    color: var(--error);
    border: 1px solid rgba(220, 38, 38, 0.2);
    border-radius: var(--radius);
    font-size: var(--text-sm);
  }

  /* Footer */
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border);
  }

  .btn-primary {
    background: var(--primary);
    color: white;
    border: none;
    border-radius: var(--radius);
    padding: 0.625rem 1.25rem;
    font-weight: 600;
    font-size: var(--text-sm);
    cursor: pointer;
    transition: background var(--transition);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--primary-dark);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--surface-alt);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.625rem 1.25rem;
    font-weight: 500;
    font-size: var(--text-sm);
    cursor: pointer;
    transition: background var(--transition);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--border);
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
