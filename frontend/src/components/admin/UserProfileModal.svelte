<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { authStore } from "../../stores/authStore";
  import { selfUpdateMyProfile, uploadProfilePhoto } from "../../api/admin";
  import { GRUPO_DISPLAY_NAMES } from "../../lib/grupos";
  import { ROLE_LABELS, ROLE_COLORS, normalizeRole } from "../../lib/permissions";

  const dispatch = createEventDispatcher<{ close: void; updated: { full_name?: string; cellphone?: string; photoURL?: string } }>();

  $: user = $authStore.user;

  // Form state
  let fullName = "";
  let cellphone = "";
  let previewURL: string | null = null;
  let selectedFile: File | null = null;
  let fileInput: HTMLInputElement;

  // UI state
  let savingProfile = false;
  let savingPhoto = false;
  let profileSuccess = "";
  let profileError = "";
  let photoSuccess = "";
  let photoError = "";

  onMount(() => {
    fullName = user?.full_name || user?.nombre_completo || user?.displayName || "";
    cellphone = user?.cellphone || "";
  });

  $: currentPhotoURL = user?.photoURL ?? null;
  $: avatarLetter = (fullName?.[0] || user?.email?.[0] || "U").toUpperCase();
  $: roleKey = normalizeRole(user?.rol || user?.role || (Array.isArray(user?.roles) ? user?.roles?.[0] : "") || "operador");
  $: roleLabel = ROLE_LABELS[roleKey] ?? roleKey;
  $: roleColor = ROLE_COLORS[roleKey] ?? "#64748b";
  $: grupoLabel = (() => {
    const g = user?.grupo;
    if (!g) return "Sin grupo asignado";
    return GRUPO_DISPLAY_NAMES[g as any] ?? (g.charAt(0).toUpperCase() + g.slice(1));
  })();

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      photoError = "La imagen no puede superar 5 MB.";
      return;
    }
    selectedFile = file;
    photoError = "";
    photoSuccess = "";
    const reader = new FileReader();
    reader.onload = (ev) => { previewURL = ev.target?.result as string; };
    reader.readAsDataURL(file);
  }

  async function saveProfile() {
    if (!fullName.trim()) {
      profileError = "El nombre no puede estar vacío.";
      return;
    }
    savingProfile = true;
    profileError = "";
    profileSuccess = "";
    try {
      await selfUpdateMyProfile({
        full_name: fullName.trim(),
        cellphone: cellphone.trim() || undefined,
      });
      profileSuccess = "Perfil actualizado correctamente.";
      // Update local store
      authStore.updateUser({ full_name: fullName.trim(), cellphone: cellphone.trim() });
      dispatch("updated", { full_name: fullName.trim(), cellphone: cellphone.trim() });
    } catch (e: any) {
      profileError = e?.message ?? "Error al guardar el perfil.";
    } finally {
      savingProfile = false;
    }
  }

  async function savePhoto() {
    if (!selectedFile) return;
    savingPhoto = true;
    photoError = "";
    photoSuccess = "";
    try {
      const res = await uploadProfilePhoto(selectedFile);
      photoSuccess = "Foto actualizada correctamente.";
      previewURL = null;
      selectedFile = null;
      if (fileInput) fileInput.value = "";
      // Update local store
      authStore.updateUser({ photoURL: res.photoURL });
      dispatch("updated", { photoURL: res.photoURL });
    } catch (e: any) {
      photoError = e?.message ?? "Error al subir la foto.";
    } finally {
      savingPhoto = false;
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains("modal-overlay")) dispatch("close");
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") dispatch("close");
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="modal-overlay" on:click={handleOverlayClick} role="dialog" aria-modal="true" aria-label="Editar perfil">
  <div class="modal-card">
    <!-- Header -->
    <div class="modal-header">
      <h2 class="modal-title">Mi Perfil</h2>
      <button class="btn-close" on:click={() => dispatch("close")} aria-label="Cerrar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="modal-body">
      <!-- ─── Foto de perfil ───────────────────────────────── -->
      <section class="section">
        <h3 class="section-title">Foto de perfil</h3>

        <div class="photo-area">
          <!-- Avatar grande con overlay de cambiar -->
          <div class="avatar-wrap">
            {#if previewURL}
              <img src={previewURL} alt="Vista previa" class="avatar-img" />
              <div class="avatar-overlay preview-badge">Vista previa</div>
            {:else if currentPhotoURL}
              <img src={currentPhotoURL} alt={fullName} class="avatar-img" referrerpolicy="no-referrer" />
              <button class="avatar-overlay" on:click={() => fileInput?.click()} title="Cambiar foto">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </button>
            {:else}
              <div class="avatar-initials">{avatarLetter}</div>
              <button class="avatar-overlay" on:click={() => fileInput?.click()} title="Subir foto">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </button>
            {/if}
          </div>

          <div class="photo-actions">
            <p class="photo-hint">JPG, PNG o WebP · máx. 5 MB</p>
            <button class="btn-secondary btn-sm" on:click={() => fileInput?.click()} disabled={savingPhoto}>
              {currentPhotoURL && !previewURL ? "Cambiar foto" : "Seleccionar foto"}
            </button>
            {#if previewURL && selectedFile}
              <button class="btn-primary btn-sm" on:click={savePhoto} disabled={savingPhoto}>
                {savingPhoto ? "Subiendo…" : "Guardar foto"}
              </button>
              <button class="btn-ghost btn-sm" on:click={() => { previewURL = null; selectedFile = null; if (fileInput) fileInput.value = ""; }}>
                Cancelar
              </button>
            {/if}
          </div>
        </div>

        <input
          bind:this={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="file-hidden"
          on:change={handleFileChange}
        />

        {#if photoSuccess}<p class="msg-success">{photoSuccess}</p>{/if}
        {#if photoError}<p class="msg-error">{photoError}</p>{/if}
      </section>

      <!-- ─── Datos de cuenta (read-only) ───────────────────── -->
      <section class="section">
        <h3 class="section-title">Cuenta</h3>
        <div class="readonly-grid">
          <div class="readonly-field">
            <span class="field-label">Correo</span>
            <span class="field-value">{user?.email ?? "—"}</span>
          </div>
          <div class="readonly-field">
            <span class="field-label">Rol</span>
            <span class="field-value">
              <span class="badge-role" style="color:{roleColor};background:{roleColor}18;border-color:{roleColor}35">{roleLabel}</span>
            </span>
          </div>
          <div class="readonly-field">
            <span class="field-label">Grupo</span>
            <span class="field-value">{grupoLabel}</span>
          </div>
        </div>
      </section>

      <!-- ─── Datos editables ──────────────────────────────── -->
      <section class="section">
        <h3 class="section-title">Datos personales</h3>

        <div class="field-group">
          <label class="field-label" for="upm-fullname">Nombre completo</label>
          <input
            id="upm-fullname"
            class="field-input"
            type="text"
            bind:value={fullName}
            placeholder="Tu nombre completo"
            disabled={savingProfile}
          />
        </div>

        <div class="field-group">
          <label class="field-label" for="upm-phone">Teléfono</label>
          <input
            id="upm-phone"
            class="field-input"
            type="tel"
            bind:value={cellphone}
            placeholder="Número de contacto (opcional)"
            disabled={savingProfile}
          />
        </div>

        {#if profileSuccess}<p class="msg-success">{profileSuccess}</p>{/if}
        {#if profileError}<p class="msg-error">{profileError}</p>{/if}

        <div class="form-actions">
          <button class="btn-secondary" on:click={() => dispatch("close")} disabled={savingProfile}>
            Cancelar
          </button>
          <button class="btn-primary" on:click={saveProfile} disabled={savingProfile}>
            {savingProfile ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </section>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    backdrop-filter: blur(2px);
  }

  .modal-card {
    background: var(--surface);
    border-radius: var(--radius-lg, 12px);
    box-shadow: 0 20px 60px rgba(0,0,0,.25);
    width: 100%;
    max-width: 460px;
    max-height: 90vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem 0;
    position: sticky;
    top: 0;
    background: var(--surface);
    z-index: 1;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border);
  }

  .modal-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .btn-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all var(--transition);
  }
  .btn-close:hover { background: var(--surface-alt); color: var(--text-primary); }

  .modal-body {
    padding: 1.25rem 1.5rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .section {}

  .section-title {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: .07em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 0 0 .875rem;
  }

  /* Photo area */
  .photo-area {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  .avatar-wrap {
    position: relative;
    width: 80px;
    height: 80px;
    flex-shrink: 0;
    border-radius: 50%;
    overflow: hidden;
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    display: block;
  }

  .avatar-initials {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--primary);
    color: white;
    font-size: 2rem;
    font-weight: 700;
    border-radius: 50%;
  }

  .avatar-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,.45);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    border: none;
    opacity: 0;
    transition: opacity .2s;
    font-size: .65rem;
    font-weight: 600;
    letter-spacing: .03em;
  }
  .avatar-wrap:hover .avatar-overlay { opacity: 1; }
  .preview-badge { opacity: 1; font-size: .65rem; pointer-events: none; }

  .photo-actions {
    display: flex;
    flex-direction: column;
    gap: .5rem;
    align-items: flex-start;
  }

  .photo-hint {
    font-size: var(--text-xs, 0.75rem);
    color: var(--text-muted);
    margin: 0;
  }

  .file-hidden {
    display: none;
  }

  /* Read-only grid */
  .readonly-grid {
    display: flex;
    flex-direction: column;
    gap: .625rem;
    background: var(--surface-alt);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: .875rem 1rem;
  }

  .readonly-field {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  /* Fields */
  .field-group {
    display: flex;
    flex-direction: column;
    gap: .375rem;
    margin-bottom: .75rem;
  }

  .field-label {
    font-size: var(--text-xs, .75rem);
    font-weight: 600;
    color: var(--text-secondary);
    min-width: 80px;
  }

  .field-value {
    font-size: var(--text-sm, .875rem);
    color: var(--text-primary);
  }

  .field-input {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: .5rem .75rem;
    font-size: var(--text-sm, .875rem);
    color: var(--text-primary);
    background: var(--surface);
    transition: border-color var(--transition);
    width: 100%;
  }
  .field-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(5,150,105,.1);
  }
  .field-input:disabled { opacity: .6; cursor: not-allowed; }

  /* Badges */
  .badge-role {
    display: inline-flex;
    align-items: center;
    font-size: .68rem;
    font-weight: 700;
    padding: .2rem .6rem;
    border-radius: 999px;
    border: 1px solid;
    letter-spacing: .04em;
    text-transform: uppercase;
  }

  /* Messages */
  .msg-success {
    font-size: var(--text-xs, .75rem);
    color: #059669;
    background: rgba(5,150,105,.08);
    border: 1px solid rgba(5,150,105,.2);
    border-radius: var(--radius-sm);
    padding: .375rem .75rem;
    margin: 0;
  }
  .msg-error {
    font-size: var(--text-xs, .75rem);
    color: var(--error, #dc2626);
    background: rgba(220,38,38,.06);
    border: 1px solid rgba(220,38,38,.15);
    border-radius: var(--radius-sm);
    padding: .375rem .75rem;
    margin: 0;
  }

  /* Buttons */
  .form-actions {
    display: flex;
    gap: .625rem;
    justify-content: flex-end;
    margin-top: .25rem;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: .375rem;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: var(--radius);
    padding: .625rem 1.125rem;
    font-weight: 600;
    font-size: var(--text-sm);
    cursor: pointer;
    transition: background var(--transition);
  }
  .btn-primary:hover:not(:disabled) { background: var(--primary-dark, #047857); }
  .btn-primary:disabled { opacity: .55; cursor: not-allowed; }

  .btn-secondary {
    background: var(--surface-alt);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: .625rem 1.125rem;
    font-weight: 500;
    font-size: var(--text-sm);
    cursor: pointer;
    transition: background var(--transition);
  }
  .btn-secondary:hover:not(:disabled) { background: var(--border); }
  .btn-secondary:disabled { opacity: .5; cursor: not-allowed; }

  .btn-ghost {
    background: transparent;
    color: var(--text-muted);
    border: 1px solid transparent;
    border-radius: var(--radius);
    padding: .375rem .75rem;
    font-size: var(--text-xs, .75rem);
    cursor: pointer;
    transition: all var(--transition);
  }
  .btn-ghost:hover { color: var(--error); }

  .btn-sm { padding: .4rem .875rem; font-size: var(--text-xs, .75rem); }
</style>
