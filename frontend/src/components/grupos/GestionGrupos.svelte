<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { ApiClient } from "../../lib/api-client";
  import { getUsers } from "../../api/admin";
  import { authStore, permissions } from "../../stores/authStore";
  import CambiarRolModal from "./CambiarRolModal.svelte";
   import { normalizeRole, ROLE_LABELS, ROLE_COLORS } from "../../lib/permissions";
  import { verificarRegistroPersonalOperativo } from '../../api/verificarPersonal';
  import { GRUPO_DISPLAY_NAMES, type GrupoKey } from "../../lib/grupos";
  import { getAsistenciasResumen, type AsistenciaResumenItem } from '../../api/actividades';

  function grupoLabel(g: string | null | undefined): string {
    if (!g) return '';
    return GRUPO_DISPLAY_NAMES[g as GrupoKey] ?? g.charAt(0).toUpperCase() + g.slice(1);
  }
  function onAvatarError(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    if (img) img.style.display = 'none';
  }
  // Estado para verificación de registro
  let verificando = false;
  let verificacionMap = new Map<string, boolean>(); // id → registrado

  async function verificarPersonal() {
    verificando = true;
    try {
      // El endpoint verifica TODO el personal; filtramos por grupo si hay uno seleccionado
      const grupo = selectedGrupo?.nombre;
      verificacionMap = await verificarRegistroPersonalOperativo(grupo);
    } catch (e: any) {
      console.warn('verificarPersonal error:', e?.message);
    } finally {
      verificando = false;
    }
  }

  // Local mapping to avoid Svelte type errors
  const ROLE_LABELS_MAP = {
    operador: ROLE_LABELS.operador,
    lider: ROLE_LABELS.lider,
    administrador: ROLE_LABELS.administrador,
    desarrollador: ROLE_LABELS.desarrollador
  };

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

  interface UsuarioSistema {
    id: string;        // igual al uid de Firebase Auth
    uid: string;
    nombre_completo: string;
    full_name?: string;
    email?: string;
    cellphone?: string;
    grupo?: string;
    nombre_centro_gestor?: string;
    role?: string;
    rol?: string;
    [key: string]: any;
  }

  // ── State ──

  let grupos: Grupo[] = [];
  let personal: PersonalOperativo[] = [];
  let usuarios: UsuarioSistema[] = [];
  let loadingGrupos = true;
  let loadingPersonal = true;
  let loadingUsuarios = true;
  let errorGrupos = "";
  let errorPersonal = "";
  let errorUsuarios = "";

  let selectedGrupoId: string | null = null;
  $: selectedGrupo = grupos.find((g) => g.id === selectedGrupoId) ?? null;
  $: personalFiltrado = selectedGrupoId
    ? personal.filter((p) => p.grupo === selectedGrupo?.nombre)
    : personal;
  $: usuariosFiltrado = selectedGrupoId
    ? usuarios.filter((u) => (u.grupo ?? u.nombre_centro_gestor) === selectedGrupo?.nombre)
    : usuarios;

  // ── Permissions ──

  /** Grupos visibles para el usuario: líder ve solo su grupo, admin/dev ven todos */
  $: gruposVisibles = $permissions.canSeeAllGroups
    ? grupos
    : grupos.filter((g) => g.nombre === $authStore.user?.grupo);

  /** Líder: auto-select su propio grupo al cargar */
  $: if (!$permissions.canSeeAllGroups && gruposVisibles.length > 0 && selectedGrupoId === null) {
    selectedGrupoId = gruposVisibles[0].id;
  }

  // ── Tab activa: operarios | usuarios | asistencias ──
  let activeTab: 'operarios' | 'usuarios' | 'asistencias' = 'operarios';

  // ── Asistencias ──
  let asistencias: AsistenciaResumenItem[] = [];
  let loadingAsistencias = false;
  let errorAsistencias = '';

  $: asistenciasFiltradas = selectedGrupo
    ? asistencias.filter(a => a.grupos_participantes.some(g => g.toLowerCase() === (selectedGrupo?.nombre ?? '').toLowerCase()))
    : asistencias;

  async function fetchAsistencias() {
    loadingAsistencias = true;
    errorAsistencias = '';
    try {
      asistencias = await getAsistenciasResumen();
    } catch (e: any) {
      errorAsistencias = e?.message ?? 'Error al obtener asistencias';
    } finally {
      loadingAsistencias = false;
    }
  }

  // ── Modal cambiar rol ──

  let showRolModal = false;
  let rolModalPersona: UsuarioSistema | null = null;

  function openRolModal(usuario: UsuarioSistema) {
    rolModalPersona = usuario;
    showRolModal = true;
  }

  function closeRolModal() {
    showRolModal = false;
    rolModalPersona = null;
  }

  async function handleRolChanged() {
    closeRolModal();
    await fetchUsuarios();
  }

  // ── Modal nuevo personal ──

  let showModal = false;
  let saving = false;
  let saveError = "";
  let saveSuccess = false;
  let _closeModalTimeout: ReturnType<typeof setTimeout>;

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

  async function fetchUsuarios() {
    loadingUsuarios = true;
    errorUsuarios = "";
    try {
      const data = await getUsers();
      usuarios = data.map((u) => ({
        ...u,
        id: u.uid ?? u.id ?? "",
        uid: u.uid ?? u.id ?? "",
        nombre_completo: u.nombre_completo ?? u.full_name ?? u.displayName ?? u.email ?? "—",
      }));
    } catch (e: any) {
      errorUsuarios = e?.message ?? "Error al obtener usuarios del sistema";
    } finally {
      loadingUsuarios = false;
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
      _closeModalTimeout = setTimeout(() => {
        closeModal();
      }, 1200);
    } catch (e: any) {
      saveError = e?.message ?? "Error al guardar personal";
    } finally {
      saving = false;
    }
  }

  onMount(async () => {
    await fetchGrupos();
    await fetchPersonal();
    await fetchUsuarios();
    await fetchAsistencias();
    await tick();
    verificarPersonal();
  });

  onDestroy(() => {
    clearTimeout(_closeModalTimeout);
  });

  // Helper to normalize role string to Role type for label lookup
  /**
   * @param {string} r
   * @returns {'operador'|'lider'|'administrador'|'desarrollador'}
   */
  function toRole(r: string) {
    return ['operador','lider','administrador','desarrollador'].includes(r) ? r as 'operador'|'lider'|'administrador'|'desarrollador' : 'operador';
  }
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
    {#if $permissions.canAssignInGroup($authStore.user?.grupo ?? '') || $permissions.canSeeAllGroups}
    <button class="btn-primary" on:click={openModal}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Agregar Personal
    </button>
    {/if}
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
        {#if $permissions.canSeeAllGroups}
        <button
          class="grupo-item"
          class:active={selectedGrupoId === null}
          on:click={() => (selectedGrupoId = null)}
        >
          <div class="grupo-dot all"></div>
          <span>Todos los grupos</span>
          <span class="grupo-count">{personal.length + usuarios.length}</span>
        </button>
        {/if}
        {#each gruposVisibles as grupo (grupo.id)}
          {@const count = personal.filter((p) => p.grupo === grupo.nombre).length + usuarios.filter((u) => (u.grupo ?? u.nombre_centro_gestor) === grupo.nombre).length}
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
            Todo el Personal
          {/if}
        </div>
        <span class="count-badge">{personalFiltrado.length + usuariosFiltrado.length}</span>
      </div>
      <div class="panel-tabs">
        <button
          class="panel-tab"
          class:active={activeTab === 'operarios'}
          on:click={() => activeTab = 'operarios'}
        >
          Operarios
          {#if personalFiltrado.length > 0}<span class="tab-count">{personalFiltrado.length}</span>{/if}
        </button>
        {#if $permissions.canManageUsers}
          <button
            class="panel-tab"
            class:active={activeTab === 'usuarios'}
            on:click={() => activeTab = 'usuarios'}
          >
            Usuarios del Sistema
            {#if usuariosFiltrado.length > 0}<span class="tab-count">{usuariosFiltrado.length}</span>{/if}
          </button>
        {/if}
        <button
          class="panel-tab"
          class:active={activeTab === 'asistencias'}
          on:click={() => { activeTab = 'asistencias'; }}
        >
          Asistencias
          {#if asistenciasFiltradas.length > 0}<span class="tab-count">{asistenciasFiltradas.length}</span>{/if}
        </button>
      </div>

      {#if loadingPersonal || loadingUsuarios}
        <div class="loading-cards">
          {#each Array(4) as _}
            <div class="skeleton-card"></div>
          {/each}
        </div>
      {:else if errorPersonal || errorUsuarios}
        <div class="error-state centered">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {errorPersonal || errorUsuarios}
          <button class="btn-retry" on:click={() => { fetchPersonal(); fetchUsuarios(); }}>Reintentar</button>
        </div>
      {:else if personalFiltrado.length === 0 && usuariosFiltrado.length === 0}
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
        <!-- ── Operarios (personal_operativo) ── -->
        {#if activeTab === 'operarios' && personalFiltrado.length > 0}
          <div class="personal-grid">
            {#each personalFiltrado as persona (persona.id)}
              <div class="persona-card">
                <div class="persona-avatar">
                  {#if persona.photoURL}
                    <img src={persona.photoURL} alt={persona.nombre_completo} class="avatar-img" referrerpolicy="no-referrer" on:error={onAvatarError} />
                  {:else}
                    {(persona.nombre_completo?.[0] ?? "?").toUpperCase()}
                  {/if}
                </div>
                <div class="persona-info">
                  <div class="persona-name">{persona.nombre_completo}</div>
                  <div class="persona-sub">
                    {#if persona.grupo}<span class="sub-grupo">{grupoLabel(persona.grupo)}</span><span class="sub-sep">·</span>{/if}
                    <span class="sub-role sub-role-operador">operador</span>
                  </div>
                  {#if persona.email}
                    <div class="persona-cargo">{persona.email}</div>
                  {/if}
                  {#if persona.numero_contacto}
                    <div class="persona-id">{persona.numero_contacto}</div>
                  {/if}
                  {#if verificacionMap.has(persona.id)}
                    {#if verificacionMap.get(persona.id)}
                      <span class="badge-app badge-app-si">✔ En app</span>
                    {:else}
                      <span class="badge-app badge-app-no">✖ Sin registro</span>
                    {/if}
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <!-- ── Asistencias de actividades ── -->
        {#if activeTab === 'asistencias'}
          {#if loadingAsistencias}
            <div class="loading-cards">
              {#each Array(3) as _}<div class="skeleton-card"></div>{/each}
            </div>
          {:else if errorAsistencias}
            <div class="error-state centered">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {errorAsistencias}
              <button class="btn-retry" on:click={fetchAsistencias}>Reintentar</button>
            </div>
          {:else if asistenciasFiltradas.length === 0}
            <div class="empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              <p>No hay registros de asistencia{selectedGrupo ? ` para ${selectedGrupo.nombre}` : ''}</p>
            </div>
          {:else}
            <div class="asistencias-list">
              {#each asistenciasFiltradas as rec (rec.actividad_id)}
                {@const pct = rec.asistencia_general}
                {@const pctColor = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'}
                <details class="asistencia-row">
                  <summary class="asistencia-summary">
                    <div class="asi-left">
                      <!-- Fecha de la actividad (cuándo se desarrolló) -->
                      {#if rec.fecha_actividad}
                        <span class="asi-fecha-act">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          {rec.fecha_actividad}{#if rec.hora_encuentro} · {rec.hora_encuentro}{/if}
                        </span>
                      {/if}
                      <!-- Tipo de jornada -->
                      {#if rec.tipo_jornada}
                        <span class="asi-tipo">{rec.tipo_jornada}</span>
                      {/if}
                      <!-- Lugar -->
                      {#if rec.barrio_vereda || rec.comunas_corregimiento}
                        <span class="asi-lugar">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          {[rec.barrio_vereda, rec.comunas_corregimiento].filter(Boolean).join(', ')}
                        </span>
                      {/if}
                      {#if rec.grupos_participantes.length > 0}
                        <span class="asi-grupos">{rec.grupos_participantes.map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(' · ')}</span>
                      {/if}
                    </div>
                    <div class="asi-right">
                      {#if rec.alertas > 0}
                        <span class="asi-alertas" title="Alertas">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          {rec.alertas}
                        </span>
                      {/if}
                      <span class="asi-stat">{rec.asistentes}/{rec.total_personal}</span>
                      <span class="asi-pct" style="color:{pctColor};">{pct}%</span>
                      <svg class="asi-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                  </summary>

                  <!-- Detalle expandible -->
                  <div class="asistencia-detail">
                    <!-- Info de la actividad -->
                    <div class="act-info-block">
                      {#if rec.direccion}
                        <div class="act-info-row">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          <span>{rec.direccion}</span>
                        </div>
                      {/if}
                      {#if rec.objetivo_actividad}
                        <div class="act-info-row">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          <span>{rec.objetivo_actividad}</span>
                        </div>
                      {/if}
                      {#if rec.estado_actividad}
                        <div class="act-info-row">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                          <span>Estado: <strong>{rec.estado_actividad}</strong></span>
                        </div>
                      {/if}
                    </div>

                    <!-- Personal con observaciones de campo -->
                    <div class="act-personal-header">Personal asignado</div>
                    {#each rec.personal_asignado as p (p.nombre_completo)}
                      <div class="asistencia-persona" class:ausente={p.validacion === false}>
                        <span class="ap-status" title={p.validacion ? 'Asistió' : 'Ausente'}>
                          {#if p.validacion}
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          {:else}
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          {/if}
                        </span>
                        <div class="ap-body">
                          <div class="ap-topline">
                            <span class="ap-name">{p.nombre_completo ?? '—'}</span>
                            {#if p.grupo}<span class="ap-grupo">{grupoLabel(p.grupo)}</span>{/if}
                            {#if p.alerta}<span class="ap-alerta">⚠ {p.alerta}</span>{/if}
                          </div>
                          {#if p.observacion}
                            <div class="ap-obs-campo">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                              {p.observacion}
                            </div>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                </details>
              {/each}
            </div>
          {/if}
        {/if}

        <!-- ── Usuarios del sistema (admin/users, con control de rol) ── -->
        {#if activeTab === 'usuarios' && $permissions.canManageUsers && usuariosFiltrado.length > 0}
          <div class="personal-grid">
            {#each usuariosFiltrado as usuario (usuario.id)}
              <div class="persona-card" class:can-edit={$permissions.canChangeRoles}>
                {#if $permissions.canChangeRoles}
                  <button class="btn-edit-rol" on:click={() => openRolModal(usuario)} title="Cambiar rol">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                {/if}
                <div class="persona-avatar">
                  {#if usuario.photoURL}
                    <img src={usuario.photoURL} alt={usuario.nombre_completo} class="avatar-img" referrerpolicy="no-referrer" on:error={onAvatarError} />
                  {:else}
                    {(usuario.nombre_completo?.[0] ?? "?").toUpperCase()}
                  {/if}
                </div>
                <div class="persona-info">
                  <div class="persona-name">{usuario.nombre_completo}</div>
                  {#if usuario.grupo || usuario.nombre_centro_gestor || usuario.role || usuario.rol}
                    <div class="persona-sub">
                      {#if usuario.grupo ?? usuario.nombre_centro_gestor}<span class="sub-grupo">{grupoLabel(usuario.grupo ?? usuario.nombre_centro_gestor)}</span>{/if}
                      {#if (usuario.grupo ?? usuario.nombre_centro_gestor) && (usuario.role || usuario.rol)}<span class="sub-sep">·</span>{/if}
                      {#if usuario.role || usuario.rol}
                        {@const rolNorm = normalizeRole(usuario.role ?? usuario.rol ?? 'operador')}
                        <span class="sub-role" style="color:{ROLE_COLORS[rolNorm]};font-weight:500">{ROLE_LABELS[rolNorm]}</span>
                      {/if}
                    </div>
                  {/if}
                  {#if usuario.email}
                    <div class="persona-cargo">{usuario.email}</div>
                  {/if}
                  {#if usuario.cellphone}
                    <div class="persona-id">{usuario.cellphone}</div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </main>
  </div>
</div>

<!-- Modal: Cambiar Rol -->
{#if showRolModal && rolModalPersona}
  <CambiarRolModal
    persona={rolModalPersona}
    currentUserPermissions={{
      assignableRoles: $permissions.assignableRoles,
      canChangeRoles: $permissions.canChangeRoles
    }}
    on:close={closeRolModal}
    on:changed={handleRolChanged}
  />
{/if}

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
    overflow: hidden;
  }
  .persona-avatar .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    display: block;
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

  .badge-app {
    display: inline-block;
    margin-top: 4px;
    padding: 2px 7px;
    border-radius: 999px;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .badge-app-si {
    background: #e0f2fe;
    color: #0369a1;
  }
  .badge-app-no {
    background: #fff1f2;
    color: #e11d48;
  }

  /* Inline sub-line: grupo · rol */
  .persona-sub {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    margin-top: 2px;
    font-size: 0.6875rem;
    color: var(--text-muted);
  }
  .sub-sep { opacity: 0.35; }
  .sub-grupo { color: var(--text-secondary); }
  .sub-role { font-weight: 500; text-transform: capitalize; }

  /* ── Panel tabs ─────────────────────────────────────── */
  .panel-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border-light);
    padding: 0 1rem;
    background: var(--surface-alt);
  }
  .panel-tab {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.625rem 0.875rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-muted);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: color var(--transition), border-color var(--transition);
    margin-bottom: -1px;
  }
  .panel-tab:hover {
    color: var(--text-secondary);
  }
  .panel-tab.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }
  .tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    font-size: 0.6875rem;
    font-weight: 600;
    background: color-mix(in srgb, var(--primary) 12%, transparent);
    color: var(--primary);
  }
  .panel-tab.active .tab-count {
    background: var(--primary);
    color: white;
  }

  /* ── Asistencias tab ─────────────────────────────────── */
  .asistencias-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.25rem 0;
  }

  .asistencia-row {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--surface);
  }

  .asistencia-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.7rem 1rem;
    cursor: pointer;
    user-select: none;
    list-style: none;
    transition: background 0.15s;
  }
  .asistencia-summary::-webkit-details-marker { display: none; }
  .asistencia-summary:hover { background: color-mix(in srgb, var(--primary) 4%, transparent); }

  .asi-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    flex: 1;
    min-width: 0;
  }

  .asi-fecha-act {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
  }

  .asi-tipo {
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 10%, transparent);
    padding: 0.15rem 0.5rem;
    border-radius: 99px;
    white-space: nowrap;
  }

  .asi-lugar {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.72rem;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .asi-grupos {
    font-size: 0.7rem;
    color: var(--text-muted);
    background: color-mix(in srgb, var(--primary) 8%, transparent);
    padding: 0.15rem 0.45rem;
    border-radius: 99px;
  }

  .asi-right {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    white-space: nowrap;
  }

  .asi-stat {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .asi-pct {
    font-size: 0.875rem;
    font-weight: 600;
    min-width: 3ch;
    text-align: right;
  }

  .asi-alertas {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: #d97706;
    background: #fef3c7;
    padding: 0.1rem 0.4rem;
    border-radius: 99px;
  }

  .asi-chevron {
    opacity: 0.4;
    transition: transform 0.2s;
  }
  details[open] .asi-chevron { transform: rotate(180deg); }

  .asistencia-detail {
    border-top: 1px solid var(--border);
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: color-mix(in srgb, var(--surface) 60%, var(--background));
  }

  /* Activity info block */
  .act-info-block {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
    margin-bottom: 0.25rem;
  }

  .act-info-row {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }
  .act-info-row svg { flex-shrink: 0; margin-top: 2px; }

  .act-personal-header {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    padding: 0.2rem 0;
  }

  /* Individual person rows */
  .asistencia-persona {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.35rem 0;
    font-size: 0.8125rem;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
  }
  .asistencia-persona:last-child { border-bottom: none; }
  .asistencia-persona.ausente .ap-name { color: var(--text-muted); }

  .ap-status { display: flex; align-items: center; flex-shrink: 0; padding-top: 2px; }

  .ap-body {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    flex: 1;
    min-width: 0;
  }

  .ap-topline {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .ap-name {
    font-weight: 500;
  }

  .ap-grupo {
    font-size: 0.7rem;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .ap-alerta {
    font-size: 0.7rem;
    color: #b45309;
    background: #fef3c7;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    white-space: nowrap;
  }

  .ap-obs-campo {
    display: flex;
    align-items: flex-start;
    gap: 0.3rem;
    font-size: 0.74rem;
    color: var(--text-secondary);
    font-style: italic;
    line-height: 1.4;
  }
  .ap-obs-campo svg { flex-shrink: 0; margin-top: 2px; opacity: 0.6; }

  /* Floating edit-rol button — appears on card hover */
  .persona-card {
    position: relative;
  }
  .btn-edit-rol {
    position: absolute;
    top: 0.45rem;
    right: 0.45rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s, background 0.15s, color 0.15s, border-color 0.15s;
    flex-shrink: 0;
  }
  .persona-card.can-edit:hover .btn-edit-rol {
    opacity: 1;
  }
  .btn-edit-rol:hover {
    background: color-mix(in srgb, var(--primary) 10%, transparent);
    color: var(--primary);
    border-color: color-mix(in srgb, var(--primary) 25%, transparent);
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
