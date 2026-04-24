<script lang="ts">
  import { onMount } from "svelte";
  import {
    getUsers,
    changeUserRole,
    changeUserGrupo,
    updateUserProfile,
    resetUserPassword,
    deleteUser,
    createUser,
    type UserRecord,
  } from "../../api/admin";
  import { authStore, permissions } from "../../stores/authStore";
  import {
    normalizeRole,
    ROLE_LABELS,
    ROLE_COLORS,
    assignableRoles,
    type Role,
  } from "../../lib/permissions";
  import { GRUPO_DISPLAY_NAMES, GRUPO_KEYS, getGruposConIds, type GrupoKey, type GrupoConId } from "../../lib/grupos";

  // ─── State ────────────────────────────────────────────────────────────────
  let users: UserRecord[] = [];
  let loading = true;
  let error = "";
  let searchTerm = "";
  let filterRole = "";
  let filterGrupo = "";

  // Modal state
  type ModalType = "edit" | "role" | "grupo" | "password" | "delete" | "create" | null;
  let modalType: ModalType = null;
  let selectedUser: UserRecord | null = null;

  // Form fields
  let fName = "";
  let fCellphone = "";
  let fRole: Role = "operador";
  let fGrupo = "";
  let fNewPassword = "";
  let fConfirmPassword = "";
  let fEmail = "";
  let fCreateName = "";
  let fCreateCellphone = "";
  let fCreateGrupo = "";
  let fCreatePassword = "";

  let saving = false;
  let modalError = "";
  let modalSuccess = "";

  let gruposAPI: GrupoConId[] = GRUPO_KEYS.map(k => ({ id: k, nombre: GRUPO_DISPLAY_NAMES[k] }));

  $: perms = $permissions;
  $: currentUser = $authStore.user;
  $: isDev = perms.isDev;
  $: isAdmin = perms.isAdmin || perms.isDev;
  $: myRoles = assignableRoles(currentUser);

  function displayName(u: UserRecord) {
    return u.full_name || u.nombre_completo || u.displayName || u.email || "—";
  }
  function displayRole(u: UserRecord) {
    return normalizeRole(u.role ?? u.rol ?? u.roles);
  }
  function grupoLabel(g: string | null | undefined) {
    if (!g) return "—";
    return GRUPO_DISPLAY_NAMES[g as GrupoKey] ?? g.charAt(0).toUpperCase() + g.slice(1);
  }
  function avatarLetter(u: UserRecord) {
    return (displayName(u)[0] ?? u.email?.[0] ?? "?").toUpperCase();
  }

  const ROLE_ORDER: Record<string, number> = {
    desarrollador: 0,
    administrador: 1,
    lider: 2,
    operador: 3,
  };

  $: filtered = users
    .filter((u) => {
      const term = searchTerm.toLowerCase();
      const matchTerm =
        !term ||
        displayName(u).toLowerCase().includes(term) ||
        (u.email ?? "").toLowerCase().includes(term) ||
        (u.grupo ?? "").toLowerCase().includes(term);
      const matchRole = !filterRole || displayRole(u) === filterRole;
      const matchGrupo = !filterGrupo || u.grupo === filterGrupo;
      return matchTerm && matchRole && matchGrupo;
    })
    .sort((a, b) => {
      const ra = ROLE_ORDER[displayRole(a)] ?? 9;
      const rb = ROLE_ORDER[displayRole(b)] ?? 9;
      if (ra !== rb) return ra - rb;
      return displayName(a).localeCompare(displayName(b), "es");
    });

  async function loadUsers() {
    loading = true;
    error = "";
    try {
      users = await getUsers();
    } catch (e: any) {
      error = e?.message ?? "Error al cargar usuarios";
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    loadUsers();
    const apiGrupos = await getGruposConIds();
    if (apiGrupos.length > 0) gruposAPI = apiGrupos;
  });

  // ─── Modal helpers ─────────────────────────────────────────────────────────
  function openModal(type: ModalType, user?: UserRecord) {
    modalType = type;
    selectedUser = user ?? null;
    modalError = "";
    modalSuccess = "";
    saving = false;

    if (type === "edit" && user) {
      fName = user.full_name || user.nombre_completo || "";
      fCellphone = user.cellphone || "";
    }
    if (type === "role" && user) {
      fRole = displayRole(user);
    }
    if (type === "grupo" && user) {
      fGrupo = user.grupo || "";
    }
    if (type === "password") {
      fNewPassword = "";
      fConfirmPassword = "";
    }
    if (type === "create") {
      fEmail = "";
      fCreateName = "";
      fCreateCellphone = "";
      fCreateGrupo = gruposAPI[0]?.id || GRUPO_KEYS[0];
      fCreatePassword = "";
    }
  }

  function closeModal() {
    modalType = null;
    selectedUser = null;
    modalError = "";
    modalSuccess = "";
  }

  // ─── Actions ───────────────────────────────────────────────────────────────
  async function handleEditProfile() {
    if (!selectedUser) return;
    saving = true;
    modalError = "";
    try {
      await updateUserProfile(selectedUser.uid, { full_name: fName, cellphone: fCellphone });
      modalSuccess = "Perfil actualizado";
      selectedUser.full_name = fName;
      selectedUser.cellphone = fCellphone;
      users = [...users];
      setTimeout(closeModal, 1000);
    } catch (e: any) {
      modalError = e?.message ?? "Error al actualizar";
    } finally {
      saving = false;
    }
  }

  async function handleChangeRole() {
    if (!selectedUser) return;
    if (fRole === displayRole(selectedUser)) { closeModal(); return; }
    saving = true;
    modalError = "";
    try {
      await changeUserRole(selectedUser.uid, fRole);
      modalSuccess = `Rol cambiado a ${ROLE_LABELS[fRole]}. El usuario debe re-autenticarse.`;
      selectedUser.role = fRole;
      users = [...users];
      setTimeout(closeModal, 1500);
    } catch (e: any) {
      modalError = e?.message ?? "Error al cambiar rol";
    } finally {
      saving = false;
    }
  }

  async function handleChangeGrupo() {
    if (!selectedUser) return;
    saving = true;
    modalError = "";
    try {
      await changeUserGrupo(selectedUser.uid, fGrupo);
      modalSuccess = `Grupo cambiado a ${grupoLabel(fGrupo)}`;
      selectedUser.grupo = fGrupo;
      users = [...users];
      setTimeout(closeModal, 1000);
    } catch (e: any) {
      modalError = e?.message ?? "Error al cambiar grupo";
    } finally {
      saving = false;
    }
  }

  async function handleResetPassword() {
    if (!selectedUser) return;
    if (!fNewPassword || fNewPassword !== fConfirmPassword) {
      modalError = "Las contraseñas no coinciden o están vacías";
      return;
    }
    if (fNewPassword.length < 6) {
      modalError = "La contraseña debe tener al menos 6 caracteres";
      return;
    }
    saving = true;
    modalError = "";
    try {
      await resetUserPassword(selectedUser.uid, fNewPassword);
      modalSuccess = "Contraseña restablecida exitosamente";
      setTimeout(closeModal, 1000);
    } catch (e: any) {
      modalError = e?.message ?? "Error al restablecer contraseña";
    } finally {
      saving = false;
    }
  }

  async function handleDeleteUser() {
    if (!selectedUser) return;
    saving = true;
    modalError = "";
    try {
      await deleteUser(selectedUser.uid);
      users = users.filter((u) => u.uid !== selectedUser!.uid);
      closeModal();
    } catch (e: any) {
      modalError = e?.message ?? "Error al eliminar usuario";
    } finally {
      saving = false;
    }
  }

  async function handleCreateUser() {
    if (!fEmail || !fCreatePassword || !fCreateName || !fCreateGrupo) {
      modalError = "Completa todos los campos requeridos";
      return;
    }
    saving = true;
    modalError = "";
    try {
      await createUser({
        email: fEmail,
        password: fCreatePassword,
        full_name: fCreateName,
        cellphone: fCreateCellphone,
        grupo: fCreateGrupo,
      });
      modalSuccess = "Usuario creado. Recargando lista...";
      setTimeout(async () => { await loadUsers(); closeModal(); }, 1000);
    } catch (e: any) {
      modalError = e?.message ?? "Error al crear usuario";
    } finally {
      saving = false;
    }
  }
</script>

<div class="gu-container">
  <!-- Header -->
  <div class="gu-header">
    <div>
      <h1 class="gu-title">Gestión de Usuarios</h1>
      <p class="gu-subtitle">Administración de cuentas y privilegios del sistema</p>
    </div>
    {#if isAdmin}
      <button class="btn-primary" on:click={() => openModal("create")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nuevo usuario
      </button>
    {/if}
  </div>

  <!-- Toolbar -->
  <div class="gu-toolbar">
    <input class="search-input" type="search" placeholder="Buscar por nombre, correo o grupo…" bind:value={searchTerm} />
    <select class="filter-select" bind:value={filterRole}>
      <option value="">Todos los roles</option>
      {#each Object.entries(ROLE_LABELS) as [k, v]}
        <option value={k}>{v}</option>
      {/each}
    </select>
    <select class="filter-select" bind:value={filterGrupo}>
      <option value="">Todos los grupos</option>
      {#each gruposAPI as g}
        <option value={g.id}>{g.nombre}</option>
      {/each}
    </select>
    <button class="btn-icon-sm" on:click={loadUsers} title="Actualizar" disabled={loading}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
    </button>
  </div>

  <p class="gu-count">{filtered.length} usuario{filtered.length !== 1 ? "s" : ""}</p>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Cargando usuarios…</span>
    </div>
  {:else if error}
    <div class="error-state">{error}</div>
  {:else if filtered.length === 0}
    <div class="empty-state">No se encontraron usuarios</div>
  {:else}
    <div class="users-table-wrap">
      <table class="users-table">
        <thead>
          <tr>
            <th class="col-user">Usuario</th>
            <th class="col-grupo">Grupo</th>
            <th class="col-role">Rol</th>
            <th class="col-phone">Teléfono</th>
            {#if isAdmin}<th class="col-actions">Acciones</th>{/if}
          </tr>
        </thead>
        <tbody>
          {#each filtered as user (user.uid)}
            {@const role = displayRole(user)}
            {@const roleColor = ROLE_COLORS[role] ?? "#64748b"}
            {@const isSelf = user.uid === currentUser?.uid}
            <tr class="user-row" class:is-self={isSelf}>
              <!-- Avatar + Name + Email -->
              <td class="col-user">
                <div class="user-identity">
                  <div class="user-avatar" style="--rc:{roleColor}">
                    {#if user.photoURL}
                      <img src={user.photoURL} alt={displayName(user)} class="avatar-img" referrerpolicy="no-referrer" />
                    {:else}
                      {avatarLetter(user)}
                    {/if}
                  </div>
                  <div class="user-text">
                    <span class="user-name">
                      {displayName(user)}
                      {#if isSelf}<span class="self-tag">(tú)</span>{/if}
                    </span>
                    <span class="user-email">{user.email ?? "—"}</span>
                  </div>
                </div>
              </td>

              <!-- Grupo -->
              <td class="col-grupo">
                {#if user.grupo}
                  <span class="badge-grupo">{grupoLabel(user.grupo)}</span>
                {:else}
                  <span class="text-muted">—</span>
                {/if}
              </td>

              <!-- Role -->
              <td class="col-role">
                <span class="badge-role" style="color:{roleColor};background:{roleColor}18;border-color:{roleColor}35">
                  {ROLE_LABELS[role] ?? role}
                </span>
              </td>

              <!-- Phone -->
              <td class="col-phone">
                <span class="text-secondary">{user.cellphone ?? "—"}</span>
              </td>

              <!-- Actions -->
              {#if isAdmin}
                <td class="col-actions">
                  {#if !isSelf}
                    <div class="action-row">
                      <button class="act" title="Editar perfil" on:click={() => openModal("edit", user)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      {#if myRoles.length > 0}
                        <button class="act" title="Cambiar rol" on:click={() => openModal("role", user)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        </button>
                      {/if}
                      <button class="act" title="Cambiar grupo" on:click={() => openModal("grupo", user)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      </button>
                      <button class="act" title="Restablecer contraseña" on:click={() => openModal("password", user)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      </button>
                      <button class="act act--danger" title="Eliminar usuario" on:click={() => openModal("delete", user)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  {:else}
                    <span class="text-muted" style="font-size:.75rem">tu cuenta</span>
                  {/if}
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- ─── Modals ─────────────────────────────────────────────────────────────── -->
{#if modalType}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
  <div class="overlay" on:click|self={closeModal} role="dialog" aria-modal="true">
    <div class="modal">
      <!-- Edit Profile -->
      {#if modalType === "edit" && selectedUser}
        <div class="modal-header">
          <h2 class="modal-title">Editar perfil — {displayName(selectedUser)}</h2>
          <button class="btn-close" on:click={closeModal}>✕</button>
        </div>
        <div class="modal-body">
          <label class="field-label" for="edit-name">Nombre completo</label>
          <input id="edit-name" class="field-input" type="text" bind:value={fName} disabled={saving} />
          <label class="field-label" for="edit-phone" style="margin-top:.75rem">Teléfono</label>
          <input id="edit-phone" class="field-input" type="tel" bind:value={fCellphone} disabled={saving} />
          {#if modalError}<div class="msg-error">{modalError}</div>{/if}
          {#if modalSuccess}<div class="msg-success">{modalSuccess}</div>{/if}
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" on:click={closeModal} disabled={saving}>Cancelar</button>
          <button class="btn-primary" on:click={handleEditProfile} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>

      <!-- Change Role -->
      {:else if modalType === "role" && selectedUser}
        <div class="modal-header">
          <h2 class="modal-title">Cambiar rol — {displayName(selectedUser)}</h2>
          <button class="btn-close" on:click={closeModal}>✕</button>
        </div>
        <div class="modal-body">
          <p class="modal-hint">Rol actual: <strong>{ROLE_LABELS[displayRole(selectedUser)]}</strong></p>
          {#if !isDev && displayRole(selectedUser) === "desarrollador"}
            <div class="msg-warning">Solo un desarrollador puede modificar a otro desarrollador.</div>
          {:else}
            <div class="role-grid">
              {#each myRoles as r}
                <button
                  class="role-option"
                  class:selected={fRole === r}
                  style="--rc: {ROLE_COLORS[r]}"
                  on:click={() => (fRole = r)}
                  disabled={saving || (!isDev && r === "desarrollador")}
                >{ROLE_LABELS[r]}</button>
              {/each}
            </div>
          {/if}
          {#if modalError}<div class="msg-error">{modalError}</div>{/if}
          {#if modalSuccess}<div class="msg-success">{modalSuccess}</div>{/if}
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" on:click={closeModal} disabled={saving}>Cancelar</button>
          <button class="btn-primary" on:click={handleChangeRole} disabled={saving || (!isDev && displayRole(selectedUser) === "desarrollador")}>
            {saving ? "Guardando…" : "Aplicar cambio"}
          </button>
        </div>

      <!-- Change Grupo -->
      {:else if modalType === "grupo" && selectedUser}
        <div class="modal-header">
          <h2 class="modal-title">Cambiar grupo — {displayName(selectedUser)}</h2>
          <button class="btn-close" on:click={closeModal}>✕</button>
        </div>
        <div class="modal-body">
          <p class="modal-hint">Grupo actual: <strong>{grupoLabel(selectedUser.grupo)}</strong></p>
          <div class="role-grid">
            {#each gruposAPI as g}
              <button
                class="role-option"
                class:selected={fGrupo === g.id}
                style="--rc: var(--primary)"
                on:click={() => (fGrupo = g.id)}
                disabled={saving}
              >{g.nombre}</button>
            {/each}
          </div>
          {#if modalError}<div class="msg-error">{modalError}</div>{/if}
          {#if modalSuccess}<div class="msg-success">{modalSuccess}</div>{/if}
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" on:click={closeModal} disabled={saving}>Cancelar</button>
          <button class="btn-primary" on:click={handleChangeGrupo} disabled={saving}>
            {saving ? "Guardando…" : "Aplicar cambio"}
          </button>
        </div>

      <!-- Reset Password -->
      {:else if modalType === "password" && selectedUser}
        <div class="modal-header">
          <h2 class="modal-title">Restablecer contraseña — {displayName(selectedUser)}</h2>
          <button class="btn-close" on:click={closeModal}>✕</button>
        </div>
        <div class="modal-body">
          <label class="field-label" for="reset-pwd">Nueva contraseña</label>
          <input id="reset-pwd" class="field-input" type="password" bind:value={fNewPassword} disabled={saving} placeholder="Mínimo 6 caracteres" />
          <label class="field-label" for="reset-pwd-confirm" style="margin-top:.75rem">Confirmar contraseña</label>
          <input id="reset-pwd-confirm" class="field-input" type="password" bind:value={fConfirmPassword} disabled={saving} />
          {#if modalError}<div class="msg-error">{modalError}</div>{/if}
          {#if modalSuccess}<div class="msg-success">{modalSuccess}</div>{/if}
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" on:click={closeModal} disabled={saving}>Cancelar</button>
          <button class="btn-primary btn--danger" on:click={handleResetPassword} disabled={saving}>
            {saving ? "Guardando…" : "Restablecer"}
          </button>
        </div>

      <!-- Delete User -->
      {:else if modalType === "delete" && selectedUser}
        <div class="modal-header">
          <h2 class="modal-title">Eliminar usuario</h2>
          <button class="btn-close" on:click={closeModal}>✕</button>
        </div>
        <div class="modal-body">
          <p class="modal-hint">¿Estás seguro de eliminar a <strong>{displayName(selectedUser)}</strong> ({selectedUser.email})?</p>
          <p class="modal-hint" style="color:var(--error)">Esta acción es irreversible. Se elimina de Firebase Auth y Firestore.</p>
          {#if modalError}<div class="msg-error">{modalError}</div>{/if}
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" on:click={closeModal} disabled={saving}>Cancelar</button>
          <button class="btn-primary btn--danger" on:click={handleDeleteUser} disabled={saving}>
            {saving ? "Eliminando…" : "Eliminar definitivamente"}
          </button>
        </div>

      <!-- Create User -->
      {:else if modalType === "create"}
        <div class="modal-header">
          <h2 class="modal-title">Crear nuevo usuario</h2>
          <button class="btn-close" on:click={closeModal}>✕</button>
        </div>
        <div class="modal-body">
          <label class="field-label" for="create-name">Nombre completo *</label>
          <input id="create-name" class="field-input" type="text" bind:value={fCreateName} disabled={saving} />
          <label class="field-label" for="create-email" style="margin-top:.75rem">Correo electrónico *</label>
          <input id="create-email" class="field-input" type="email" bind:value={fEmail} disabled={saving} />
          <label class="field-label" for="create-phone" style="margin-top:.75rem">Teléfono</label>
          <input id="create-phone" class="field-input" type="tel" bind:value={fCreateCellphone} disabled={saving} />
          <label class="field-label" for="create-grupo" style="margin-top:.75rem">Grupo *</label>
          <select id="create-grupo" class="field-input" bind:value={fCreateGrupo} disabled={saving}>
            {#each gruposAPI as g}
              <option value={g.id}>{g.nombre}</option>
            {/each}
          </select>
          <label class="field-label" for="create-pwd" style="margin-top:.75rem">Contraseña inicial *</label>
          <input id="create-pwd" class="field-input" type="password" bind:value={fCreatePassword} disabled={saving} placeholder="Mínimo 6 caracteres" />
          <p class="modal-hint" style="margin-top:.5rem;font-size:.75rem">El usuario se creará con rol Operador. Cambia el rol después si es necesario.</p>
          {#if modalError}<div class="msg-error">{modalError}</div>{/if}
          {#if modalSuccess}<div class="msg-success">{modalSuccess}</div>{/if}
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" on:click={closeModal} disabled={saving}>Cancelar</button>
          <button class="btn-primary" on:click={handleCreateUser} disabled={saving}>
            {saving ? "Creando…" : "Crear usuario"}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .gu-container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
  }

  .gu-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .gu-title {
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .gu-subtitle {
    font-size: var(--text-sm);
    color: var(--text-muted);
    margin: 0.25rem 0 0;
  }

  .gu-toolbar {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }

  .search-input {
    flex: 1;
    min-width: 180px;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: var(--text-sm);
    background: var(--surface);
    color: var(--text-primary);
  }

  .filter-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: var(--text-sm);
    background: var(--surface);
    color: var(--text-primary);
    cursor: pointer;
  }

  .btn-icon-sm {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text-secondary);
    cursor: pointer;
    transition: background var(--transition);
  }

  .btn-icon-sm:hover { background: var(--surface-alt); }
  .btn-icon-sm:disabled { opacity: .5; cursor: not-allowed; }

  .gu-count {
    font-size: var(--text-sm);
    color: var(--text-muted);
    margin: 0 0 1rem;
  }

  .loading-state, .empty-state, .error-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: .75rem;
    padding: 3rem 1rem;
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  .error-state { color: var(--error); }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* Table layout */
  .users-table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    background: var(--surface);
  }

  .users-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  .users-table thead {
    background: var(--surface-alt);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .users-table th {
    padding: 0.625rem 1rem;
    text-align: left;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }

  .users-table td {
    padding: 0.75rem 1rem;
    vertical-align: middle;
    border-bottom: 1px solid var(--border);
  }

  .user-row:last-child td { border-bottom: none; }

  .user-row {
    transition: background var(--transition);
  }

  .user-row:hover { background: var(--surface-alt); }

  .user-row.is-self { background: rgba(5,150,105,.03); }

  /* Column widths */
  .col-user   { min-width: 220px; }
  .col-grupo  { min-width: 110px; }
  .col-role   { min-width: 110px; }
  .col-phone  { min-width: 110px; color: var(--text-secondary); font-size: var(--text-xs); }
  .col-actions { min-width: 140px; }

  /* Identity cell */
  .user-identity {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--rc) 12%, white);
    border: 1.5px solid color-mix(in srgb, var(--rc) 35%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: .8125rem;
    color: var(--rc);
    flex-shrink: 0;
    overflow: hidden;
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }

  .user-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .user-name {
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .self-tag {
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--primary);
    background: rgba(5,150,105,.08);
    border-radius: 999px;
    padding: 0 .375rem;
  }

  .user-email {
    font-size: var(--text-xs);
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Badges */
  .badge-role {
    display: inline-flex;
    align-items: center;
    font-size: 0.68rem;
    font-weight: 700;
    padding: .2rem .6rem;
    border-radius: 999px;
    border: 1px solid;
    letter-spacing: .04em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .badge-grupo {
    display: inline-flex;
    align-items: center;
    font-size: 0.75rem;
    font-weight: 500;
    padding: .25rem .625rem;
    border-radius: var(--radius-sm);
    background: var(--surface-alt);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    white-space: nowrap;
  }

  .text-muted { color: var(--text-muted); font-size: var(--text-xs); }
  .text-secondary { color: var(--text-secondary); }

  /* Inline action buttons */
  .action-row {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    opacity: 0;
    transition: opacity var(--transition);
  }

  .user-row:hover .action-row,
  .user-row:focus-within .action-row {
    opacity: 1;
  }

  .act {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all var(--transition);
    flex-shrink: 0;
  }

  .act:hover {
    background: var(--surface);
    border-color: var(--primary);
    color: var(--primary);
  }

  .act--danger:hover {
    border-color: var(--error);
    color: var(--error);
    background: rgba(220,38,38,.04);
  }

  /* Buttons */
  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: .375rem;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: var(--radius);
    padding: .625rem 1rem;
    font-weight: 600;
    font-size: var(--text-sm);
    cursor: pointer;
    transition: background var(--transition);
  }

  .btn-primary:hover:not(:disabled) { background: var(--primary-dark); }
  .btn-primary:disabled { opacity: .55; cursor: not-allowed; }
  .btn-primary.btn--danger { background: var(--error); }
  .btn-primary.btn--danger:hover:not(:disabled) { background: #b91c1c; }

  .btn-secondary {
    background: var(--surface-alt);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: .625rem 1rem;
    font-weight: 500;
    font-size: var(--text-sm);
    cursor: pointer;
    transition: background var(--transition);
  }

  .btn-secondary:hover:not(:disabled) { background: var(--border); }
  .btn-secondary:disabled { opacity: .5; cursor: not-allowed; }

  /* Modal */
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 1rem;
  }

  .modal {
    background: var(--surface);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 440px;
    box-shadow: var(--shadow-xl);
    display: flex;
    flex-direction: column;
    max-height: 90dvh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem 1rem;
    border-bottom: 1px solid var(--border);
  }

  .modal-title {
    font-size: var(--text-base);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .btn-close {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 1rem;
    padding: .25rem;
    border-radius: var(--radius-sm);
  }

  .btn-close:hover { color: var(--text-primary); }

  .modal-body {
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: .5rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border);
  }

  .field-label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: .25rem;
  }

  .field-input {
    width: 100%;
    padding: .5rem .75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: var(--text-sm);
    background: var(--surface);
    color: var(--text-primary);
    box-sizing: border-box;
  }

  .field-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(5,150,105,.1);
  }

  .modal-hint {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0 0 .75rem;
  }

  .role-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: .5rem;
    margin-top: .5rem;
  }

  .role-option {
    padding: .625rem .75rem;
    border: 2px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-alt);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition);
    color: var(--text-secondary);
    text-align: center;
  }

  .role-option:hover:not(:disabled) {
    border-color: var(--rc);
    color: var(--rc);
    background: color-mix(in srgb, var(--rc) 8%, white);
  }

  .role-option.selected {
    border-color: var(--rc);
    color: var(--rc);
    background: color-mix(in srgb, var(--rc) 12%, white);
    font-weight: 700;
  }

  .role-option:disabled { opacity: .4; cursor: not-allowed; }

  .msg-error {
    margin-top: .75rem;
    padding: .625rem .75rem;
    background: rgba(220,38,38,.05);
    color: var(--error);
    border: 1px solid rgba(220,38,38,.15);
    border-radius: var(--radius);
    font-size: var(--text-sm);
  }

  .msg-success {
    margin-top: .75rem;
    padding: .625rem .75rem;
    background: rgba(5,150,105,.05);
    color: var(--primary-dark);
    border: 1px solid rgba(5,150,105,.15);
    border-radius: var(--radius);
    font-size: var(--text-sm);
  }

  .msg-warning {
    padding: .625rem .75rem;
    background: rgba(217,119,6,.05);
    color: var(--warning);
    border: 1px solid rgba(217,119,6,.15);
    border-radius: var(--radius);
    font-size: var(--text-sm);
  }
</style>
