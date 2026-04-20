<script lang="ts">
  import { onMount } from "svelte";
  import { ApiClient } from "../../lib/api-client";

  // ── Types ──

  interface Grupo {
    id: string;
    nombre: string;
    descripcion?: string;
    lider?: string;
    [key: string]: any;
  }

  interface PersonalOperativo {
    id: string;
    nombre_completo: string;
    email?: string;
    numero_contacto?: number;
    grupo?: string;
    [key: string]: any;
  }

  // ── State ──

  let grupos: Grupo[] = [];
  let personal: PersonalOperativo[] = [];
  let loadingGrupos = true;
  let loadingPersonal = true;
  let errorGrupos = "";
  let errorPersonal = "";

  let selectedGrupoId: string | null = null;
  $: selectedGrupo = grupos.find((g) => g.id === selectedGrupoId) ?? null;
  $: personalFiltrado = selectedGrupoId
    ? personal.filter((p) => p.grupo === selectedGrupo?.nombre)
    : personal;

  // ── Modal nuevo personal ──

  let showModal = false;
  let saving = false;
  let saveError = "";
  let saveSuccess = false;

  let form = {
    nombre_completo: "",
    email: "",
    numero_contacto: "",
    grupo: "",
  };

  function resetForm() {
    form = { nombre_completo: "", email: "", numero_contacto: "", grupo: selectedGrupoId ? (grupos.find(g => g.id === selectedGrupoId)?.nombre ?? "") : "" };
    saveError = "";
    saveSuccess = false;
  }

  function openModal() {
    resetForm();
    showModal = true;
  }

  function closeModal() {
    showModal = false;
  }

  async function fetchGrupos() {
    loadingGrupos = true;
    errorGrupos = "";
    try {
      const res = await ApiClient.get<any>("/grupos");
      // Handles both { data: [] } and plain array responses
      grupos = Array.isArray(res) ? res : res.data ?? res.grupos ?? [];
    } catch (e: any) {
      errorGrupos = e?.message ?? "Error al obtener grupos";
    } finally {
      loadingGrupos = false;
    }
  }

  async function fetchPersonal() {
    loadingPersonal = true;
    errorPersonal = "";
    try {
      const res = await ApiClient.get<any>("/personal_operativo");
      personal = Array.isArray(res) ? res : res.data ?? res.personal ?? [];
    } catch (e: any) {
      errorPersonal = e?.message ?? "Error al obtener personal operativo";
    } finally {
      loadingPersonal = false;
    }
  }

  async function handleSubmit() {
    if (!form.nombre_completo.trim()) {
      saveError = "El nombre completo es requerido";
      return;
    }
    saving = true;
    saveError = "";
    try {
      const payload: Record<string, any> = {
        nombre_completo: form.nombre_completo.trim(),
      };
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.numero_contacto) payload.numero_contacto = Number(form.numero_contacto);
      if (form.grupo.trim()) payload.grupo = form.grupo.trim();

      await ApiClient.post("/personal_operativo", payload);
      saveSuccess = true;
      await fetchPersonal();
      setTimeout(() => {
        closeModal();
      }, 1200);
    } catch (e: any) {
      saveError = e?.message ?? "Error al guardar personal";
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    fetchGrupos();
    fetchPersonal();
  });
</script>

<div class="page">
  <!-- Page header -->
  <div class="page-header">
    <div class="page-title-wrap">
      <div class="page-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <div>
        <h1 class="page-title">Grupos y Personal</h1>
        <p class="page-subtitle">Gestión de grupos operativos y personal asignado</p>
      </div>
    </div>
    <button class="btn-primary" on:click={openModal}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Agregar Personal
    </button>
  </div>

  <div class="layout">
    <!-- Sidebar: Grupos -->
    <aside class="sidebar">
      <div class="section-label">Grupos</div>

      {#if loadingGrupos}
        <div class="loading-list">
          {#each Array(5) as _}
            <div class="skeleton-item"></div>
          {/each}
        </div>
      {:else if errorGrupos}
        <div class="error-state">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {errorGrupos}
          <button class="btn-retry" on:click={fetchGrupos}>Reintentar</button>
        </div>
      {:else if grupos.length === 0}
        <div class="empty-state-sm">No hay grupos registrados</div>
      {:else}
        <button
          class="grupo-item"
          class:active={selectedGrupoId === null}
          on:click={() => (selectedGrupoId = null)}
        >
          <div class="grupo-dot all"></div>
          <span>Todos los grupos</span>
          <span class="grupo-count">{personal.length}</span>
        </button>
        {#each grupos as grupo (grupo.id)}
          {@const count = personal.filter((p) => p.grupo === grupo.nombre).length}
          <button
            class="grupo-item"
            class:active={selectedGrupoId === grupo.id}
            on:click={() => (selectedGrupoId = grupo.id)}
          >
            <div class="grupo-dot"></div>
            <span class="grupo-name">{grupo.nombre}</span>
            <span class="grupo-count">{count}</span>
          </button>
        {/each}
      {/if}
    </aside>

    <!-- Main: Personal -->
    <main class="main-panel">
      <div class="panel-header">
        <div class="panel-title">
          {#if selectedGrupo}
            Personal · <strong>{selectedGrupo.nombre}</strong>
          {:else}
            Todo el Personal Operativo
          {/if}
        </div>
        <span class="count-badge">{personalFiltrado.length}</span>
      </div>

      {#if loadingPersonal}
        <div class="loading-cards">
          {#each Array(4) as _}
            <div class="skeleton-card"></div>
          {/each}
        </div>
      {:else if errorPersonal}
        <div class="error-state centered">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {errorPersonal}
          <button class="btn-retry" on:click={fetchPersonal}>Reintentar</button>
        </div>
      {:else if personalFiltrado.length === 0}
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          <p>No hay personal registrado{selectedGrupo ? ` en ${selectedGrupo.nombre}` : ""}</p>
          <button class="btn-primary sm" on:click={openModal}>Agregar Personal</button>
        </div>
      {:else}
        <div class="personal-grid">
          {#each personalFiltrado as persona (persona.id)}
            <div class="persona-card">
              <div class="persona-avatar">
                {(persona.nombre_completo?.[0] ?? "?").toUpperCase()}
              </div>
              <div class="persona-info">
                <div class="persona-name">{persona.nombre_completo}</div>
                {#if persona.email}
                  <div class="persona-cargo">{persona.email}</div>
                {/if}
                {#if persona.numero_contacto}
                  <div class="persona-id">{persona.numero_contacto}</div>
                {/if}
              </div>
              <div class="persona-meta">
                {#if persona.grupo}
                  <span class="tag group-tag">{persona.grupo}</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </main>
  </div>
</div>

<!-- Modal: Nuevo Personal -->
{#if showModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click|self={closeModal}>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <h2 id="modal-title" class="modal-title">Nuevo Personal Operativo</h2>
        <button class="btn-icon-sm" on:click={closeModal} aria-label="Cerrar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <form class="modal-body" on:submit|preventDefault={handleSubmit}>
        <div class="field">
          <label for="nombre_completo" class="label">Nombre Completo <span class="required">*</span></label>
          <input
            id="nombre_completo"
            class="input"
            type="text"
            placeholder="Ej. Juan Pérez"
            bind:value={form.nombre_completo}
            required
          />
        </div>

        <div class="field">
          <label for="email" class="label">Correo electrónico</label>
          <input
            id="email"
            class="input"
            type="email"
            placeholder="correo@ejemplo.com"
            bind:value={form.email}
          />
        </div>

        <div class="field">
          <label for="numero_contacto" class="label">Número de contacto</label>
          <input
            id="numero_contacto"
            class="input"
            type="number"
            placeholder="Ej. 3001234567"
            bind:value={form.numero_contacto}
          />
        </div>

        {#if !selectedGrupoId}
        <div class="field">
          <label for="grupo" class="label">Grupo</label>
          <select id="grupo" class="input select" bind:value={form.grupo}>
            <option value="">— Sin asignar —</option>
            {#each grupos as g (g.id)}
              <option value={g.nombre}>{g.nombre}</option>
            {/each}
          </select>
        </div>
        {/if}

        {#if saveError}
          <div class="alert error">{saveError}</div>
        {/if}

        {#if saveSuccess}
          <div class="alert success">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Personal registrado con éxito
          </div>
        {/if}

        <div class="modal-actions">
          <button type="button" class="btn-secondary" on:click={closeModal} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" class="btn-primary" disabled={saving || saveSuccess}>
            {#if saving}
              <span class="spinner"></span> Guardando…
            {:else if saveSuccess}
              Guardado
            {:else}
              Guardar Personal
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  /* ── Layout ─────────────────────────────────────────── */
  .page {
    max-width: 1000px;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 3rem;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .page-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .page-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--primary) 12%, transparent);
    color: var(--primary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .page-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.025em;
    margin: 0;
  }

  .page-subtitle {
    font-size: 0.8125rem;
    color: var(--text-muted);
    margin: 0;
  }

  .layout {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 1rem;
    align-items: start;
  }

  @media (max-width: 640px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }

  /* ── Sidebar ─────────────────────────────────────────── */
  .sidebar {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .section-label {
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
    padding: 0.25rem 0.5rem 0.5rem;
  }

  .grupo-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0.625rem;
    border-radius: var(--radius-sm);
    background: transparent;
    border: none;
    cursor: pointer;
    width: 100%;
    text-align: left;
    color: var(--text-secondary);
    font-size: 0.8125rem;
    transition: background var(--transition), color var(--transition);
  }

  .grupo-item:hover {
    background: var(--surface-alt);
    color: var(--text-primary);
  }

  .grupo-item.active {
    background: color-mix(in srgb, var(--primary) 10%, transparent);
    color: var(--primary);
    font-weight: 600;
  }

  .grupo-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--border);
    flex-shrink: 0;
  }

  .grupo-dot.all {
    background: var(--text-muted);
  }

  .grupo-item.active .grupo-dot {
    background: var(--primary);
  }

  .grupo-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .grupo-count {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--text-muted);
    background: var(--surface-alt);
    border: 1px solid var(--border-light);
    border-radius: 999px;
    padding: 0.1rem 0.4rem;
    min-width: 20px;
    text-align: center;
  }

  .grupo-item.active .grupo-count {
    background: color-mix(in srgb, var(--primary) 15%, transparent);
    color: var(--primary);
    border-color: color-mix(in srgb, var(--primary) 25%, transparent);
  }

  /* ── Main Panel ───────────────────────────────────────── */
  .main-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1rem;
    border-bottom: 1px solid var(--border-light);
  }

  .panel-title {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .panel-title strong {
    color: var(--text-primary);
    font-weight: 600;
  }

  .count-badge {
    font-size: 0.6875rem;
    font-weight: 700;
    background: var(--surface-alt);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.15rem 0.5rem;
    color: var(--text-muted);
  }

  /* ── Personal Cards ──────────────────────────────────── */
  .personal-grid {
    display: flex;
    flex-direction: column;
  }

  .persona-card {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.875rem 1rem;
    border-bottom: 1px solid var(--border-light);
    transition: background var(--transition);
  }

  .persona-card:last-child {
    border-bottom: none;
  }

  .persona-card:hover {
    background: var(--surface-alt);
  }

  .persona-avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--primary) 15%, transparent);
    color: var(--primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .persona-info {
    flex: 1;
    min-width: 0;
  }

  .persona-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .persona-cargo {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: 1px;
  }

  .persona-id {
    font-size: 0.6875rem;
    color: var(--text-muted);
    margin-top: 1px;
    font-variant-numeric: tabular-nums;
  }

  .persona-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
  }

  .tag {
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 0.15rem 0.45rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface-alt);
    color: var(--text-muted);
  }

  .group-tag {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 25%, transparent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .tag-active {
    color: var(--success);
    border-color: color-mix(in srgb, var(--success) 30%, transparent);
    background: color-mix(in srgb, var(--success) 10%, transparent);
  }

  .tag-inactive {
    color: var(--text-muted);
  }

  /* ── States ──────────────────────────────────────────── */
  .loading-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .skeleton-item {
    height: 32px;
    border-radius: var(--radius-sm);
    background: var(--border-light);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .loading-cards {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .skeleton-card {
    height: 64px;
    border-bottom: 1px solid var(--border-light);
    background: linear-gradient(90deg, var(--surface-alt) 25%, var(--border-light) 50%, var(--surface-alt) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    font-size: 0.8125rem;
    color: var(--error);
    text-align: center;
  }

  .error-state.centered {
    padding: 2rem;
  }

  .empty-state-sm {
    padding: 1rem;
    font-size: 0.8125rem;
    color: var(--text-muted);
    text-align: center;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 3rem 1.5rem;
    color: var(--text-muted);
    text-align: center;
  }

  .empty-state p {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  /* ── Buttons ─────────────────────────────────────────── */
  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: background var(--transition);
    white-space: nowrap;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--primary-dark);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary.sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    background: var(--surface);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: background var(--transition), border-color var(--transition);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--surface-alt);
    border-color: var(--accent);
  }

  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-retry {
    font-size: 0.75rem;
    padding: 0.25rem 0.625rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--text-secondary);
  }

  .btn-icon-sm {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    background: transparent;
    border: 1px solid var(--border);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    transition: background var(--transition), color var(--transition);
  }

  .btn-icon-sm:hover {
    background: var(--surface-alt);
    color: var(--text-primary);
  }

  /* ── Modal ───────────────────────────────────────────── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 1rem;
    backdrop-filter: blur(2px);
  }

  .modal {
    background: var(--surface);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 440px;
    overflow: hidden;
    animation: modal-in 160ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes modal-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-light);
  }

  .modal-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .modal-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .field-row {
    display: flex;
    align-items: center;
  }

  .label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .required {
    color: var(--error);
  }

  .input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 0.875rem;
    color: var(--text-primary);
    background: var(--surface);
    transition: border-color var(--transition), box-shadow var(--transition);
    outline: none;
  }

  .input:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent);
  }

  .select {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    padding-right: 2rem;
    cursor: pointer;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    cursor: pointer;
  }

  .toggle {
    position: relative;
    width: 40px;
    height: 22px;
    border-radius: 999px;
    background: var(--border);
    border: none;
    cursor: pointer;
    transition: background var(--transition);
    padding: 0;
    flex-shrink: 0;
  }

  .toggle.on {
    background: var(--primary);
  }

  .toggle-thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    transition: transform var(--transition);
    box-shadow: 0 1px 2px rgba(0,0,0,0.15);
  }

  .toggle.on .toggle-thumb {
    transform: translateX(18px);
  }

  .alert {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    border-radius: var(--radius);
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .alert.error {
    background: color-mix(in srgb, var(--error) 10%, transparent);
    color: var(--error);
    border: 1px solid color-mix(in srgb, var(--error) 25%, transparent);
  }

  .alert.success {
    background: color-mix(in srgb, var(--success) 10%, transparent);
    color: var(--success);
    border: 1px solid color-mix(in srgb, var(--success) 25%, transparent);
  }

  .modal-actions {
    display: flex;
    gap: 0.625rem;
    justify-content: flex-end;
    padding-top: 0.25rem;
  }

  .spinner {
    display: inline-block;
    width: 13px;
    height: 13px;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
