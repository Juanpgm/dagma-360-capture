<script lang="ts">
  import { onMount } from "svelte";
  import Button from "../ui/Button.svelte";
  import Card from "../ui/Card.svelte";
  import Select from "../ui/Select.svelte";
  import type { Coordenadas, PlantaEntry, ArbolEntry } from "../../types/visitas";
  import type { GrupoFormType } from "../../lib/grupos";
  import type { ActividadPlanDistritoVerde } from "../../types/actividades";
  import {
    formatCoordinates,
    calculateDistanceToGeometry,
  } from "../../lib/geolocation";
  import { ESPECIES_ARBOLES } from "../../lib/arboles-valle-cauca";

  export let coordenadas: Coordenadas | undefined;
  export let tipoIntervencion: string | undefined;
  export let descripcionIntervencion: string | undefined;
  export let direccion: string | undefined;
  export let observaciones: string | undefined;
  export let selectedActividad: ActividadPlanDistritoVerde | undefined;
  export let onCaptureGPS: () => Promise<void>;
  export let isLoading: boolean;

  // ── Props grupo ──
  export let grupoFormType: GrupoFormType = "operativo";

  // ── Props CUADRILLA ──
  export let arbolesData: ArbolEntry[] = [{ especie: "", cantidad: 0 }];

  // ── Props VIVERO ──
  export let tiposPlantas: PlantaEntry[] = [{ nombre: "", cantidad: 0 }];

  // ── Props GOBERNANZA / ECOSISTEMAS / UMATA ──
  export let unidadesImpactadas: number | undefined = undefined;
  export let unidadMedida: string = "";

  // ── Tipos de intervención por grupo ──
  const TIPOS_INTERVENCION_CUADRILLA = [
    { label: "Poda", value: "Poda" },
    { label: "Tala", value: "Tala" },
    { label: "Mantenimiento arbóreo", value: "Mantenimiento arbóreo" },
  ];

  const TIPOS_INTERVENCION_VIVERO = [
    { label: "Siembra en sitio definitivo", value: "Siembra en sitio definitivo" },
    { label: "Trasplante", value: "Trasplante" },
    { label: "Mantenimiento de vivero", value: "Mantenimiento de vivero" },
    { label: "Distribución de material vegetal", value: "Distribución de material vegetal" },
    { label: "Preparación de sustratos", value: "Preparación de sustratos" },
  ];

  const TIPOS_INTERVENCION_GOBERNANZA = [
    { label: "Taller comunitario", value: "Taller comunitario" },
    { label: "Jornada de sensibilización ambiental", value: "Jornada de sensibilización ambiental" },
    { label: "Reunión de articulación interinstitucional", value: "Reunión de articulación interinstitucional" },
    { label: "Capacitación ambiental", value: "Capacitación ambiental" },
    { label: "Socialización de proyecto", value: "Socialización de proyecto" },
  ];

  const TIPOS_INTERVENCION_ECOSISTEMAS = [
    { label: "Restauración ecológica", value: "Restauración ecológica" },
    { label: "Monitoreo ambiental", value: "Monitoreo ambiental" },
    { label: "Control de especies invasoras", value: "Control de especies invasoras" },
    { label: "Revegetalización", value: "Revegetalización" },
    { label: "Limpieza de cuerpo hídrico", value: "Limpieza de cuerpo hídrico" },
    { label: "Recuperación de ronda hídrica", value: "Recuperación de ronda hídrica" },
  ];

  const TIPOS_INTERVENCION_UMATA = [
    { label: "Atención veterinaria", value: "Atención veterinaria" },
    { label: "Control sanitario pecuario", value: "Control sanitario pecuario" },
    { label: "Visita técnica predial", value: "Visita técnica predial" },
    { label: "Asistencia técnica agropecuaria", value: "Asistencia técnica agropecuaria" },
    { label: "Diagnóstico predial", value: "Diagnóstico predial" },
  ];

  // ── Opciones de unidad de medida (Ecosistemas) ──
  const UNIDADES_MEDIDA = [
    { label: "Metros cuadrados (m²)", value: "m2" },
    { label: "Hectáreas (ha)", value: "ha" },
    { label: "Kilómetros (km)", value: "km" },
    { label: "Unidades", value: "unidades" },
    { label: "Árboles", value: "arboles" },
    { label: "Toneladas", value: "toneladas" },
  ];

  // ── Helpers CUADRILLA: filas dinámicas de árboles ──
  function addArbolRow() {
    arbolesData = [...arbolesData, { especie: "", cantidad: 0 }];
  }

  function removeArbolRow(index: number) {
    if (arbolesData.length > 1) {
      arbolesData = arbolesData.filter((_, i) => i !== index);
    }
  }

  // ── Helpers VIVERO: filas dinámicas de plantas ──
  function addPlantaRow() {
    tiposPlantas = [...tiposPlantas, { nombre: "", cantidad: 0 }];
  }

  function removePlantaRow(index: number) {
    if (tiposPlantas.length > 1) {
      tiposPlantas = tiposPlantas.filter((_, i) => i !== index);
    }
  }

  let gpsError = "";
  let autoCaptureAttempted = false;
  let distanceToParque: number | null = null;
  let showDistanceWarning = false;
  let isAutoCaptureInProgress = false;

  // Recalcular distancia cuando cambien las coordenadas
  $: if (coordenadas && selectedActividad?.punto_encuentro?.geometry) {
    distanceToParque = calculateDistanceToGeometry(
      coordenadas,
      selectedActividad.punto_encuentro.geometry,
    );
    // TEMPORAL: Deshabilitada validación de distancia de 200m
    showDistanceWarning = false; // distanceToParque !== null && distanceToParque > 200;
  }

  onMount(async () => {
    // Capturar GPS automáticamente al entrar al paso
    if (!coordenadas && !autoCaptureAttempted) {
      autoCaptureAttempted = true;
      isAutoCaptureInProgress = true;
      await handleCaptureGPS();
      isAutoCaptureInProgress = false;
    }

    // Auto-completar direccion desde la actividad seleccionada si esta disponible
    if (selectedActividad?.punto_encuentro?.direccion && !direccion) {
      direccion = selectedActividad.punto_encuentro.direccion;
    }
  });

  async function handleCaptureGPS() {
    gpsError = "";

    try {
      await onCaptureGPS();
    } catch (error) {
      gpsError =
        error instanceof Error ? error.message : "Error al capturar GPS";
    }
  }

  function formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  }
</script>

<div class="step-container">
  <div class="step-content">
    <!-- GPS Card -->
    <Card padding="md">
      <div class="card-header">
        <h3 class="card-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:-2px;margin-right:6px"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>Ubicación GPS
        </h3>
        {#if coordenadas}
          <Button
            size="sm"
            variant="outline"
            onClick={handleCaptureGPS}
            disabled={isLoading}
          >
            {isLoading ? "Actualizando..." : "Actualizar"}
          </Button>
        {/if}
      </div>

      {#if isLoading && !coordenadas}
        <div class="gps-loading">
          <div class="spinner"></div>
          <p class="loading-text">
            {isAutoCaptureInProgress
              ? "Capturando ubicación automáticamente..."
              : "Obteniendo ubicación GPS..."}
          </p>
        </div>
      {:else if coordenadas}
        <div class="gps-success">
          <div class="gps-grid">
            <div class="gps-field">
              <label for="gps-lat">Latitud</label>
              <input
                id="gps-lat"
                type="text"
                value={coordenadas.latitude.toFixed(6)}
                readonly
              />
            </div>
            <div class="gps-field">
              <label for="gps-lng">Longitud</label>
              <input
                id="gps-lng"
                type="text"
                value={coordenadas.longitude.toFixed(6)}
                readonly
              />
            </div>
          </div>
          <div class="gps-info-row">
            {#if coordenadas.accuracy}
              <span class="info-badge">
                ✓ Precisión: ±{coordenadas.accuracy.toFixed(0)}m
              </span>
            {/if}
            {#if distanceToParque !== null}
              <span class="info-badge">
                📏 Distancia: {formatDistance(distanceToParque)}
              </span>
            {/if}
          </div>
        </div>
      {/if}

      {#if gpsError}
        <div class="error-box">
          <p class="error-text">⚠️ {gpsError}</p>
          <Button size="sm" onClick={handleCaptureGPS} disabled={isLoading}>
            {isLoading ? "Reintentando..." : "Reintentar"}
          </Button>
        </div>
      {/if}
    </Card>

    <!-- Formulario de Datos -->
    <Card padding="md">
      <h3 class="card-title">Datos del Reconocimiento</h3>

      <div class="form-fields">
        {#if grupoFormType === "cuadrilla"}
          <!-- ── Campos específicos CUADRILLA ── -->
          <div class="field">
            <Select
              label="Tipo de Intervención"
              bind:value={tipoIntervencion}
              options={TIPOS_INTERVENCION_CUADRILLA}
              placeholder="Seleccione tipo de intervención"
              required
            />
          </div>

          <div class="field">
            <!-- svelte-ignore a11y-label-has-associated-control -->
            <label>Árboles Intervenidos <span class="required">*</span></label>
            {#each arbolesData as arbol, i}
              <div class="planta-row">
                <select bind:value={arbol.especie} class="planta-nombre">
                  <option value="" disabled>Seleccionar especie</option>
                  {#each ESPECIES_ARBOLES as e}
                    <option value="{e.nombre_comun} ({e.nombre_cientifico})">
                      {e.nombre_comun} ({e.nombre_cientifico})
                    </option>
                  {/each}
                </select>
                <input
                  type="number"
                  min="1"
                  bind:value={arbol.cantidad}
                  placeholder="Cant."
                  class="planta-cantidad"
                />
                {#if arbolesData.length > 1}
                  <button
                    type="button"
                    class="remove-planta-btn"
                    on:click={() => removeArbolRow(i)}
                    title="Eliminar fila">✕</button
                  >
                {/if}
              </div>
            {/each}
            <button
              type="button"
              class="add-planta-btn"
              on:click={addArbolRow}
            >
              + Agregar otro árbol
            </button>
          </div>
        {:else if grupoFormType === "vivero"}
          <!-- ── Campos VIVERO: filas dinámicas de plantas ── -->
          <div class="field">
            <Select
              label="Tipo de Intervención"
              bind:value={tipoIntervencion}
              options={TIPOS_INTERVENCION_VIVERO}
              placeholder="Seleccione tipo de intervención"
              required
            />
          </div>

          <div class="field">
            <!-- svelte-ignore a11y-label-has-associated-control -->
            <label>Tipos de Plantas <span class="required">*</span></label>
            {#each tiposPlantas as planta, i}
              <div class="planta-row">
                <select bind:value={planta.nombre} class="planta-nombre">
                  <option value="" disabled>Seleccionar planta</option>
                  <option value="Cintas">Cintas</option>
                  <option value="Roelias">Roelias</option>
                  <option value="Ginger rosada">Ginger rosada</option>
                  <option value="Ginger variegada">Ginger variegada</option>
                  <option value="Verbenas">Verbenas</option>
                  <option value="Tapetes">Tapetes</option>
                  <option value="Cosmos">Cosmos</option>
                  <option value="Caricatura">Caricatura</option>
                  <option value="Malamadre">Malamadre</option>
                  <option value="Heliconia pajarito">Heliconia pajarito</option>
                </select>
                <input
                  type="number"
                  min="1"
                  bind:value={planta.cantidad}
                  placeholder="Cant."
                  class="planta-cantidad"
                />
                {#if tiposPlantas.length > 1}
                  <button
                    type="button"
                    class="remove-planta-btn"
                    on:click={() => removePlantaRow(i)}
                    title="Eliminar fila">✕</button
                  >
                {/if}
              </div>
            {/each}
            <button
              type="button"
              class="add-planta-btn"
              on:click={addPlantaRow}
            >
              + Agregar otra planta
            </button>
          </div>

          <div class="field">
            <label for="direccion-vivero">
              Dirección <span class="required">*</span>
            </label>
            <input
              id="direccion-vivero"
              type="text"
              bind:value={direccion}
              placeholder="Dirección del sitio"
              required
            />
          </div>
        {:else if grupoFormType === "gobernanza"}
          <!-- ── Campos GOBERNANZA ── -->
          <div class="field">
            <Select
              label="Tipo de Intervención"
              bind:value={tipoIntervencion}
              options={TIPOS_INTERVENCION_GOBERNANZA}
              placeholder="Seleccione tipo de intervención"
              required
            />
          </div>

          <div class="field">
            <label for="unidades-gobernanza">
              Comunidades / Personas Impactadas <span class="required">*</span>
            </label>
            <input
              id="unidades-gobernanza"
              type="number"
              min="1"
              bind:value={unidadesImpactadas}
              placeholder="Ej: 10"
              required
            />
          </div>

          <div class="field">
            <label for="direccion-gobernanza">
              Dirección <span class="required">*</span>
            </label>
            <input
              id="direccion-gobernanza"
              type="text"
              bind:value={direccion}
              placeholder="Dirección del sitio"
              required
            />
          </div>
        {:else if grupoFormType === "ecosistemas"}
          <!-- ── Campos ECOSISTEMAS ── -->
          <div class="field">
            <Select
              label="Tipo de Intervención"
              bind:value={tipoIntervencion}
              options={TIPOS_INTERVENCION_ECOSISTEMAS}
              placeholder="Seleccione tipo de intervención"
              required
            />
          </div>

          <div class="field">
            <Select
              label="Unidad de Medida"
              bind:value={unidadMedida}
              options={UNIDADES_MEDIDA}
              placeholder="Seleccione unidad de medida"
              required
            />
          </div>

          <div class="field">
            <label for="unidades-ecosistemas">
              Área / Cantidad Intervenida <span class="required">*</span>
            </label>
            <input
              id="unidades-ecosistemas"
              type="number"
              min="1"
              bind:value={unidadesImpactadas}
              placeholder="Ej: 10"
              required
            />
          </div>

          <div class="field">
            <label for="direccion-ecosistemas">
              Dirección <span class="required">*</span>
            </label>
            <input
              id="direccion-ecosistemas"
              type="text"
              bind:value={direccion}
              placeholder="Dirección del sitio"
              required
            />
          </div>
        {:else if grupoFormType === "umata"}
          <!-- ── Campos UMATA ── -->
          <div class="field">
            <Select
              label="Tipo de Intervención"
              bind:value={tipoIntervencion}
              options={TIPOS_INTERVENCION_UMATA}
              placeholder="Seleccione tipo de intervención"
              required
            />
          </div>

          <div class="field">
            <label for="unidades-umata">
              Predios / Animales Atendidos <span class="required">*</span>
            </label>
            <input
              id="unidades-umata"
              type="number"
              min="1"
              bind:value={unidadesImpactadas}
              placeholder="Ej: 10"
              required
            />
          </div>

          <div class="field">
            <label for="direccion-umata">
              Dirección <span class="required">*</span>
            </label>
            <input
              id="direccion-umata"
              type="text"
              bind:value={direccion}
              placeholder="Dirección del sitio"
              required
            />
          </div>
        {/if}

        <div class="field">
          <label for="descripcion">
            Descripción de Intervención <span class="required">*</span>
          </label>
          <textarea
            id="descripcion"
            bind:value={descripcionIntervencion}
            placeholder="Describa en detalle la intervención realizada o requerida..."
            rows="4"
            required
          ></textarea>
        </div>

        <div class="field">
          <label for="observaciones">Observaciones</label>
          <textarea
            id="observaciones"
            bind:value={observaciones}
            placeholder="Observaciones adicionales (opcional)..."
            rows="3"
          ></textarea>
        </div>
      </div>
    </Card>
  </div>
</div>

<style>
  .step-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .step-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Card Header */
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .card-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  /* GPS States */
  .gps-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 1rem;
    gap: 0.75rem;
  }

  .loading-text {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin: 0;
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .gps-success {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .gps-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .gps-field label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 0.25rem;
  }

  .gps-field input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    background: var(--surface);
    color: var(--text-primary);
  }

  .gps-info-row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .info-badge {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .error-box {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .error-text {
    color: #991b1b;
    font-size: 0.875rem;
    margin: 0;
  }

  /* Form Fields */
  .form-fields {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    margin-top: 0.75rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .field label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .required {
    color: #dc2626;
  }

  .field input[type="text"],
  .field input[type="number"],
  .field textarea {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.9375rem;
    font-family: inherit;
    color: var(--text-primary);
    background: white;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .field input[type="text"]:focus,
  .field input[type="number"]:focus,
  .field textarea:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--shadow);
  }

  .field textarea {
    resize: vertical;
    min-height: 80px;
  }

  @media (max-width: 640px) {
    .gps-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Vivero: filas dinámicas de plantas */
  .planta-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .planta-nombre {
    flex: 2;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.9375rem;
    font-family: inherit;
    color: var(--text-primary);
    background: white;
    appearance: auto;
    cursor: pointer;
  }

  .planta-cantidad {
    flex: 1;
    max-width: 80px;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.9375rem;
    font-family: inherit;
    color: var(--text-primary);
    background: white;
  }

  .planta-nombre:focus,
  .planta-cantidad:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--shadow);
  }

  .remove-planta-btn {
    background: none;
    border: 1px solid #fca5a5;
    color: #dc2626;
    border-radius: 6px;
    width: 32px;
    height: 32px;
    cursor: pointer;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .remove-planta-btn:hover {
    background: #fef2f2;
  }

  .add-planta-btn {
    background: none;
    border: 1px dashed var(--border);
    color: var(--primary);
    border-radius: 6px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    width: 100%;
    transition: background 0.15s ease;
  }

  .add-planta-btn:hover {
    background: var(--surface);
  }
</style>
