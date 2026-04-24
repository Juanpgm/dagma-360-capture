<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import { changeUserRole } from "../../api/admin";
  import { ROLE_LABELS, ROLE_COLORS, normalizeRole } from "../../lib/permissions";
  import type { Role } from "../../lib/permissions";

  export let persona: { uid?: string; id?: string; nombre_completo?: string; email?: string; role?: string; rol?: string; roles?: string[]; photoURL?: string | null };
  export let currentUserPermissions: { assignableRoles: Role[]; canChangeRoles: boolean };

  const dispatch = createEventDispatcher<{ close: void; changed: void }>();

  const uid = persona.uid ?? persona.id ?? "";
  const currentRole = normalizeRole(persona.role ?? persona.rol ?? persona.roles);

  let selectedRole: Role = currentRole;

  function onAvatarError(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    if (img) img.style.display = 'none';
  }
  let saving = false;
  let errorMsg = "";
  let successMsg = "";
  let _changedTimeout: ReturnType<typeof setTimeout>;

  async function handleSubmit() {
    if (selectedRole === currentRole) {
      dispatch("close");
      return;
    }
    // Solo desarrollador puede asignar/quitar desarrollador
    if ((selectedRole === 'desarrollador' || currentRole === 'desarrollador') && !currentUserPermissions.assignableRoles.includes('desarrollador')) {
      errorMsg = 'Solo un desarrollador puede asignar o quitar el rol Desarrollador';
      return;
    }
    saving = true;
    errorMsg = "";
    try {
      await changeUserRole(uid, selectedRole);
      successMsg = `Rol actualizado a "${ROLE_LABELS[selectedRole]}"`;
      _changedTimeout = setTimeout(() => dispatch("changed"), 1000);
    } catch (e: any) {
      errorMsg = e?.message ?? "Error al cambiar el rol";
    } finally {
      saving = false;
    }
  }

  onDestroy(() => {
    clearTimeout(_changedTimeout);
  });
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div class="overlay" on:click|self={() => dispatch("close")} on:keydown={(e) => e.key === 'Escape' && dispatch('close')} role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="modal">
    <div class="modal-header">
      <h2 id="modal-title" class="modal-title">Cambiar Rol</h2>
      <button class="btn-close" on:click={() => dispatch("close")} aria-label="Cerrar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="modal-body">
      <div class="persona-row">
        <div class="persona-avatar">
          {#if persona.photoURL}
            <img src={persona.photoURL} alt={persona.nombre_completo} class="avatar-img" referrerpolicy="no-referrer" on:error={onAvatarError} />
          {:else}
            {(persona.nombre_completo?.[0] ?? "?").toUpperCase()}
          {/if}
        </div>
        <div>
          <div class="persona-name">{persona.nombre_completo ?? "—"}</div>
          {#if persona.email}<div class="persona-email">{persona.email}</div>{/if}
        </div>
      </div>

      <div class="field">
        <label class="label" for="rol-select">Nuevo Rol</label>
        <div class="role-options">
          {#each currentUserPermissions.assignableRoles as role}
            <button
              type="button"
              class="role-option"
              class:selected={selectedRole === role}
              class:current={role === currentRole}
              style="--role-color: {ROLE_COLORS[role]}"
              on:click={() => { selectedRole = role; }}
              disabled={saving}
            >
              <span class="role-dot" style="background:{ROLE_COLORS[role]}"></span>
              <span class="role-name">{ROLE_LABELS[role]}</span>
              {#if role === currentRole}<span class="current-badge">actual</span>{/if}
            </button>
          {/each}
        </div>
      </div>

      {#if errorMsg}
        <div class="alert error">{errorMsg}</div>
      {/if}
      {#if successMsg}
        <div class="alert success">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          {successMsg}
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" on:click={() => dispatch("close")} disabled={saving}>Cancelar</button>
      <button class="btn-primary" on:click={handleSubmit} disabled={saving || selectedRole === currentRole || !!successMsg}>
        {#if saving}<span class="spinner"></span> Guardando…{:else}Confirmar{/if}
      </button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 500;
    padding: 1rem;
  }

  .modal {
    background: var(--surface);
    border-radius: var(--radius-lg, 12px);
    width: 100%;
    max-width: 400px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem 0.75rem;
    border-bottom: 1px solid var(--border);
  }

  .modal-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .btn-close {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    border-radius: var(--radius-sm);
  }
  .btn-close:hover { background: var(--surface-alt); }

  .modal-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .persona-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--surface-alt);
    border-radius: var(--radius-sm);
  }

  .persona-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.9rem;
    flex-shrink: 0;
    overflow: hidden;
  }
  .persona-avatar .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    display: block;
  }

  .persona-name { font-weight: 600; font-size: 0.9rem; color: var(--text-primary); }
  .persona-email { font-size: 0.775rem; color: var(--text-muted); }

  .label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
    display: block;
  }

  .role-options {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .role-option {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.625rem 0.875rem;
    border-radius: var(--radius-sm);
    border: 1.5px solid var(--border);
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
  }

  .role-option:hover:not(:disabled) {
    border-color: var(--role-color);
    background: color-mix(in srgb, var(--role-color) 8%, transparent);
  }

  .role-option.selected {
    border-color: var(--role-color);
    background: color-mix(in srgb, var(--role-color) 10%, transparent);
  }

  .role-option:disabled { opacity: 0.6; cursor: not-allowed; }

  .role-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .role-name {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .current-badge {
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    background: var(--surface-alt);
    border: 1px solid var(--border);
    padding: 0.1rem 0.35rem;
    border-radius: 999px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.625rem;
    padding: 0.875rem 1.25rem;
    border-top: 1px solid var(--border);
    background: var(--surface-alt);
  }

  .btn-primary {
    background: var(--primary);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    transition: opacity 0.15s;
  }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-secondary:hover:not(:disabled) { background: var(--surface-alt); }
  .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

  .alert {
    padding: 0.625rem 0.875rem;
    border-radius: var(--radius-sm);
    font-size: 0.8125rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .alert.error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
  .alert.success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    display: inline-block;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
