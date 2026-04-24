<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";
  import type { ActividadPlanDistritoVerde } from "../../types/actividades";
  import {
    getAlertasTipos,
    getAsistenciaActividad,
    registrarAsistencia,
    actualizarAsistenciaItems,
    type AlertaTipoOption,
    type AlertaTipoValue,
    type AsistenciaPersonaItem,
    type AsistenciaRecord,
  } from "../../api/actividades";

  // ── Props ──────────────────────────────────────────────────────────────────

  function onAvatarError(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    if (img) img.style.display = 'none';
  }
  export let actividad: ActividadPlanDistritoVerde;
  export let onClose: () => void;
  export let onGuardado: (record: AsistenciaRecord) => void;

  const dispatch = createEventDispatcher();

  // ── Estado ─────────────────────────────────────────────────────────────────
  type ItemEditable = {
    nombre_completo: string;
    email: string;
    grupo: string;
    uid: string | null;
    validacion: boolean | null; // null = sin marcar
    observacion: string;
    alerta: AlertaTipoValue | null;
    photoURL?: string | null;
  };

  let items: ItemEditable[] = [];
  let alertasTipos: AlertaTipoOption[] = [];
  let existingRecord: AsistenciaRecord | null = null;
  let loading = true;
  let saving = false;
  let error = "";
  let successMsg = "";
  let expandedObs: Record<string, boolean> = {}; // email -> abierta obs

  // ── Métricas reactivas ────────────────────────────────────────────────────
  $: totalPersonal = items.length;
  $: presentes = items.filter((i) => i.validacion === true).length;
  $: ausentes = items.filter((i) => i.validacion === false).length;
  $: sinMarcar = items.filter((i) => i.validacion === null).length;
  $: porcentaje =
    totalPersonal > 0 ? Math.round((presentes / totalPersonal) * 100) : 0;

  $: puedeGuardar = sinMarcar === 0 && items.length > 0 && !saving;

  // ── Ciclo de vida ─────────────────────────────────────────────────────────
  onMount(async () => {
    loading = true;
    error = "";
    try {
      const [tipos, asistencia] = await Promise.allSettled([
        getAlertasTipos(),
        getAsistenciaActividad(actividad.id),
      ]);

      if (tipos.status === "fulfilled") alertasTipos = tipos.value;

      if (asistencia.status === "fulfilled" && asistencia.value) {
        existingRecord = asistencia.value.data;
        // Pre-llenar con datos del registro existente
        items = buildItemsFromRecord(existingRecord);
      } else {
        // Nueva asistencia: inicializar desde personal_asignado de la actividad
        items = buildItemsFromActividad();
      }
    } catch (e: any) {
      error = e?.message || "Error al cargar la asistencia";
    } finally {
      loading = false;
    }
  });

  // ── Helpers de construcción ───────────────────────────────────────────────
  function buildItemsFromActividad(): ItemEditable[] {
    const personal = (actividad.personal_asignado || []) as any[];
    return personal
      .filter((p: any) => p && p.nombre_completo)
      .map((p: any): ItemEditable => ({
        nombre_completo: p.nombre_completo || "",
        email: p.email || "",
        grupo: (p.grupo || "").charAt(0).toUpperCase() + (p.grupo || "").slice(1),
        uid: p.uid || null,
        validacion: null,
        observacion: "",
        alerta: null,
      }));
  }

  function buildItemsFromRecord(record: AsistenciaRecord): ItemEditable[] {
    return record.personal_asignado.map((p): ItemEditable => ({
      nombre_completo: p.nombre_completo,
      email: p.email || "",
      grupo: (p.grupo || "").charAt(0).toUpperCase() + (p.grupo || "").slice(1),
      uid: p.uid || null,
      validacion: p.validacion,
      observacion: p.observacion || "",
      alerta: p.alerta || null,
    }));
  }

  // ── Acciones de usuario ───────────────────────────────────────────────────
  function marcarPresente(email: string) {
    items = items.map((i) =>
      i.email === email
        ? { ...i, validacion: true, alerta: null }
        : i
    );
  }

  function marcarAusente(email: string) {
    items = items.map((i) =>
      i.email === email ? { ...i, validacion: false } : i
    );
  }

  function setAlerta(email: string, value: AlertaTipoValue | null) {
    items = items.map((i) =>
      i.email === email ? { ...i, alerta: value } : i
    );
  }

  function handleAlertaChange(email: string, event: Event) {
    const v = (event.target as HTMLSelectElement).value;
    setAlerta(email, v ? (v as AlertaTipoValue) : null);
  }

  function handleObservacionInput(email: string, event: Event) {
    setObservacion(email, (event.target as HTMLTextAreaElement).value);
  }

  function setObservacion(email: string, value: string) {
    items = items.map((i) =>
      i.email === email ? { ...i, observacion: value } : i
    );
  }

  function toggleObs(email: string) {
    expandedObs = { ...expandedObs, [email]: !expandedObs[email] };
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  async function guardar() {
    if (!puedeGuardar) return;
    saving = true;
    error = "";
    successMsg = "";

    const personal: AsistenciaPersonaItem[] = items.map((i) => ({
      nombre_completo: i.nombre_completo,
      email: i.email,
      uid: i.uid,
      grupo: i.grupo,
      validacion: i.validacion as boolean,
      observacion: i.observacion || null,
      alerta: i.alerta,
    }));

    try {
      let result;
      if (existingRecord) {
        // PATCH: actualizar individualmente
        const patches = items.map((i) => ({
          email: i.email,
          validacion: i.validacion as boolean,
          observacion: i.observacion || null,
          alerta: i.alerta,
        }));
        result = await actualizarAsistenciaItems(actividad.id, patches);
      } else {
        // POST: crear nuevo registro
        result = await registrarAsistencia(actividad.id, personal);
      }

      successMsg = `Asistencia guardada: ${result.metricas.asistentes}/${result.metricas.total_personal} presentes`;
      existingRecord = result.data;
      onGuardado(result.data);
    } catch (e: any) {
      error = e?.message || "Error al guardar la asistencia";
    } finally {
      saving = false;
    }
  }

  // Cerrar con Escape
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }

  function labelAlerta(val: AlertaTipoValue | null): string {
    if (!val) return "";
    return alertasTipos.find((t) => t.value === val)?.label || val;
  }

  function colorValidacion(v: boolean | null): string {
    if (v === true) return "#16a34a";
    if (v === false) return "#dc2626";
    return "#9ca3af";
  }
</script>

<svelte:window on:keydown={onKeyDown} />

<!-- Backdrop -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<div
  class="modal-backdrop"
  role="presentation"
  on:click|self={onClose}
>
  <div
    class="modal-container"
    role="dialog"
    aria-modal="true"
    aria-label="Tomar asistencia de la actividad"
  >
    <!-- Header -->
    <div class="modal-header">
      <div class="modal-title-block">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
        <div>
          <h2>Asistencia</h2>
          <p class="modal-subtitle">{actividad.tipo_jornada} — {actividad.fecha_actividad}</p>
        </div>
      </div>
      <button class="btn-close" on:click={onClose} aria-label="Cerrar modal">✕</button>
    </div>

    <!-- Body -->
    <div class="modal-body">
      {#if loading}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Cargando asistencia…</p>
        </div>
      {:else if items.length === 0}
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
          <p>No hay personal asignado a esta actividad.</p>
        </div>
      {:else}
        <!-- Métricas rápidas -->
        <div class="metricas-bar">
          <span class="metrica-chip presente">{presentes} presentes</span>
          <span class="metrica-chip ausente">{ausentes} ausentes</span>
          {#if sinMarcar > 0}
            <span class="metrica-chip pendiente">{sinMarcar} sin marcar</span>
          {/if}
          <span class="metrica-porcentaje">{porcentaje}%</span>
          <div class="progreso-bar">
            <div class="progreso-fill" style="width:{porcentaje}%"></div>
          </div>
        </div>

        {#if existingRecord}
          <p class="registro-previo-aviso">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>
            Registro existente — los cambios que hagas actualizarán el registro anterior.
          </p>
        {/if}

        <!-- Lista de personal -->
        <ul class="personal-list">
          {#each items as item (item.email)}
            <li class="personal-item" class:ausente-item={item.validacion === false}>
              <!-- Info persona -->
              <div class="persona-info">
                <div class="persona-avatar" style="background:{colorValidacion(item.validacion)}22; color:{colorValidacion(item.validacion)}">
                  {#if item.photoURL}
                    <img src={item.photoURL} alt={item.nombre_completo} class="avatar-img" referrerpolicy="no-referrer" on:error={onAvatarError} />
                  {:else}
                    {item.nombre_completo.charAt(0).toUpperCase()}
                  {/if}
                </div>
                <div class="persona-datos">
                  <span class="persona-nombre">{item.nombre_completo}</span>
                  <span class="persona-grupo">{item.grupo}</span>
                </div>
              </div>

              <!-- Botones presencia -->
              <div class="presencia-btns">
                <button
                  type="button"
                  class="btn-presencia presente"
                  class:activo={item.validacion === true}
                  on:click={() => marcarPresente(item.email)}
                  title="Marcar como presente"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                </button>
                <button
                  type="button"
                  class="btn-presencia ausente"
                  class:activo={item.validacion === false}
                  on:click={() => marcarAusente(item.email)}
                  title="Marcar como ausente"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <!-- Detalles de ausencia -->
              {#if item.validacion === false}
                <div class="ausencia-detalle">
                  <label class="campo-label">
                    Tipo de novedad
                    <select
                      class="select-alerta"
                      value={item.alerta ?? ""}
                      on:change={(e) => handleAlertaChange(item.email, e)}
                    >
                      <option value="">— Sin alerta —</option>
                      {#each alertasTipos as tipo}
                        <option value={tipo.value}>{tipo.label}</option>
                      {/each}
                    </select>
                  </label>
                  <label class="campo-label">
                    Observación
                    <textarea
                      class="textarea-obs"
                      placeholder="Describe la situación…"
                      rows="2"
                      value={item.observacion}
                      on:input={(e) => handleObservacionInput(item.email, e)}
                    ></textarea>
                  </label>
                </div>
              {:else if item.validacion === true}
                <!-- Observación colapsable para presentes -->
                <div class="obs-presente">
                  <button type="button" class="btn-obs-toggle" on:click={() => toggleObs(item.email)}>
                    {expandedObs[item.email] ? "▲ Ocultar nota" : "▼ Agregar nota"}
                  </button>
                  {#if expandedObs[item.email]}
                    <textarea
                      class="textarea-obs"
                      placeholder="Nota opcional…"
                      rows="2"
                      value={item.observacion}
                      on:input={(e) => handleObservacionInput(item.email, e)}
                    ></textarea>
                  {/if}
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}

      <!-- Mensajes de estado -->
      {#if error}
        <div class="msg-error">{error}</div>
      {/if}
      {#if successMsg}
        <div class="msg-success">{successMsg}</div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="modal-footer">
      <button type="button" class="btn-cancelar" on:click={onClose} disabled={saving}>
        Cancelar
      </button>
      <button
        type="button"
        class="btn-guardar"
        disabled={!puedeGuardar}
        on:click={guardar}
      >
        {#if saving}
          <svg class="spinner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          Guardando…
        {:else if sinMarcar > 0}
          Faltan {sinMarcar} por marcar
        {:else}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>
          Guardar Asistencia
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    padding: 1rem;
  }

  .modal-container {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    width: 100%;
    max-width: 560px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Header */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    background: #f8fafc;
    flex-shrink: 0;
  }
  .modal-title-block {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #166534;
  }
  .modal-title-block svg { color: #16a34a; flex-shrink: 0; }
  .modal-title-block h2 { margin: 0; font-size: 1.1rem; font-weight: 700; color: #111827; }
  .modal-subtitle { margin: 0.1rem 0 0; font-size: 0.8rem; color: #6b7280; }
  .btn-close {
    background: none; border: none; cursor: pointer; font-size: 1.1rem;
    color: #6b7280; padding: 0.25rem 0.5rem; border-radius: 6px;
    transition: background 0.15s;
  }
  .btn-close:hover { background: #f3f4f6; color: #111827; }

  /* Body */
  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Loading / empty */
  .loading-state, .empty-state {
    display: flex; flex-direction: column; align-items: center;
    gap: 0.75rem; padding: 2rem 0; color: #9ca3af;
  }
  .spinner {
    width: 28px; height: 28px; border: 3px solid #e5e7eb;
    border-top-color: #16a34a; border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Métricas */
  .metricas-bar {
    display: flex; align-items: center; gap: 0.5rem;
    flex-wrap: wrap; padding: 0.75rem 1rem; background: #f0fdf4;
    border-radius: 8px; border: 1px solid #bbf7d0;
  }
  .metrica-chip {
    font-size: 0.75rem; font-weight: 600; padding: 0.2rem 0.6rem;
    border-radius: 999px;
  }
  .metrica-chip.presente { background: #dcfce7; color: #16a34a; }
  .metrica-chip.ausente  { background: #fee2e2; color: #dc2626; }
  .metrica-chip.pendiente { background: #fef9c3; color: #92400e; }
  .metrica-porcentaje { font-size: 1rem; font-weight: 700; color: #16a34a; margin-left: auto; }
  .progreso-bar {
    width: 100%; height: 6px; background: #e5e7eb; border-radius: 999px; overflow: hidden;
  }
  .progreso-fill {
    height: 100%; background: #16a34a; border-radius: 999px; transition: width 0.3s;
  }

  .registro-previo-aviso {
    display: flex; align-items: center; gap: 0.4rem;
    font-size: 0.78rem; color: #6b7280; margin: 0;
  }

  /* Lista */
  .personal-list {
    list-style: none; margin: 0; padding: 0;
    display: flex; flex-direction: column; gap: 0.75rem;
  }
  .personal-item {
    border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.875rem 1rem;
    display: flex; flex-direction: column; gap: 0.6rem;
    transition: border-color 0.15s;
  }
  .personal-item.ausente-item { border-color: #fca5a5; background: #fff8f8; }

  /* Persona header row */
  .persona-info { display: flex; align-items: center; gap: 0.75rem; }
  .persona-avatar {
    width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 0.9rem; overflow: hidden;
  }
  .persona-avatar .avatar-img {
    width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;
  }
  .persona-datos { display: flex; flex-direction: column; }
  .persona-nombre { font-weight: 600; font-size: 0.9rem; color: #111827; }
  .persona-grupo { font-size: 0.75rem; color: #6b7280; }

  /* Botones presencia */
  .presencia-btns { display: flex; gap: 0.5rem; margin-left: auto; align-self: flex-start; margin-top: -36px; }
  .btn-presencia {
    display: flex; align-items: center; justify-content: center;
    width: 36px; height: 36px; border-radius: 8px; border: 2px solid transparent;
    cursor: pointer; transition: all 0.15s; background: #f3f4f6;
  }
  .btn-presencia.presente { color: #16a34a; }
  .btn-presencia.presente:hover, .btn-presencia.presente.activo {
    background: #dcfce7; border-color: #16a34a;
  }
  .btn-presencia.ausente { color: #dc2626; }
  .btn-presencia.ausente:hover, .btn-presencia.ausente.activo {
    background: #fee2e2; border-color: #dc2626;
  }

  /* Detalle ausencia */
  .ausencia-detalle {
    display: flex; flex-direction: column; gap: 0.5rem;
    padding: 0.75rem; background: #fef2f2; border-radius: 8px; border: 1px solid #fca5a5;
  }
  .campo-label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.78rem; font-weight: 600; color: #374151; }
  .select-alerta {
    font-size: 0.82rem; padding: 0.4rem 0.6rem; border: 1px solid #fca5a5;
    border-radius: 6px; background: #fff; color: #111827;
  }
  .textarea-obs {
    font-size: 0.82rem; padding: 0.4rem 0.6rem; border: 1px solid #d1d5db;
    border-radius: 6px; resize: vertical; font-family: inherit; color: #111827;
  }
  .select-alerta:focus, .textarea-obs:focus { outline: none; border-color: #16a34a; }

  /* Obs presente */
  .obs-presente { display: flex; flex-direction: column; gap: 0.4rem; }
  .btn-obs-toggle {
    background: none; border: none; cursor: pointer; font-size: 0.75rem;
    color: #6b7280; text-align: left; padding: 0;
  }
  .btn-obs-toggle:hover { color: #374151; }

  /* Mensajes */
  .msg-error {
    padding: 0.75rem 1rem; background: #fee2e2; border: 1px solid #fca5a5;
    border-radius: 8px; color: #991b1b; font-size: 0.85rem;
  }
  .msg-success {
    padding: 0.75rem 1rem; background: #dcfce7; border: 1px solid #86efac;
    border-radius: 8px; color: #166534; font-size: 0.85rem;
  }

  /* Footer */
  .modal-footer {
    display: flex; justify-content: flex-end; gap: 0.75rem;
    padding: 1rem 1.5rem; border-top: 1px solid #e5e7eb; background: #f8fafc;
    flex-shrink: 0;
  }
  .btn-cancelar {
    padding: 0.55rem 1.2rem; border: 1px solid #d1d5db; border-radius: 8px;
    background: #fff; cursor: pointer; font-size: 0.875rem; color: #374151;
    transition: background 0.15s;
  }
  .btn-cancelar:hover:not(:disabled) { background: #f3f4f6; }
  .btn-cancelar:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-guardar {
    display: flex; align-items: center; gap: 0.4rem;
    padding: 0.55rem 1.4rem; border: none; border-radius: 8px;
    background: #16a34a; color: #fff; cursor: pointer; font-size: 0.875rem;
    font-weight: 600; transition: background 0.15s;
  }
  .btn-guardar:hover:not(:disabled) { background: #15803d; }
  .btn-guardar:disabled { background: #86efac; cursor: not-allowed; color: #166534; }

  .spinner-icon {
    animation: spin 0.8s linear infinite;
  }
</style>
