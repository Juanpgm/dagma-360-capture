<script lang="ts">
  import { onMount } from "svelte";
  import Button from "../ui/Button.svelte";
  import Card from "../ui/Card.svelte";
  import Select from "../ui/Select.svelte";
  import type { Coordenadas } from "../../types/visitas";
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

  // ── Props para CUADRILLA ──
  export let isCuadrilla: boolean = false;
  export let individuosIntervenidos: number | undefined = undefined;
  export let nombreCientifico: string | undefined = undefined;
  export let nombreComun: string | undefined = undefined;

  // ── Opciones CUADRILLA ──
  const TIPOS_INTERVENCION_CUADRILLA = [
    { label: "Poda", value: "Poda" },
    { label: "Tala", value: "Tala" },
    { label: "Mantenimiento arbóreo", value: "Mantenimiento arbóreo" },
  ];

  const opcionesEspecies = ESPECIES_ARBOLES.map((e) => ({
    label: `${e.nombre_comun} (${e.nombre_cientifico})`,
    value: e.nombre_cientifico,
  }));

  // Cuando se selecciona una especie, también asignar nombre común
  $: if (isCuadrilla && nombreCientifico) {
    const match = ESPECIES_ARBOLES.find(
      (e) => e.nombre_cientifico === nombreCientifico,
    );
    if (match) nombreComun = match.nombre_comun;
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
        <h3 class="card-title">📍 Ubicación GPS</h3>
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
              ? "📍 Capturando ubicación automáticamente..."
              : "📍 Obteniendo ubicación GPS..."}
          </p>
        </div>
      {:else if coordenadas}
        <div class="gps-success">
          <div class="gps-grid">
            <div class="gps-field">
              <label>Latitud</label>
              <input
                type="text"
                value={coordenadas.latitude.toFixed(6)}
                readonly
              />
            </div>
            <div class="gps-field">
              <label>Longitud</label>
              <input
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
            {isLoading ? "Reintentando..." : "📍 Reintentar"}
          </Button>
        </div>
      {/if}
    </Card>

    <!-- Formulario de Datos -->
    <Card padding="md">
      <h3 class="card-title">📝 Datos del Reconocimiento</h3>

      <div class="form-fields">
        {#if isCuadrilla}
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
            <Select
              label="Especie de Árbol"
              bind:value={nombreCientifico}
              options={opcionesEspecies}
              placeholder="Buscar especie..."
              searchable
              required
            />
          </div>

          <div class="field">
            <label for="individuos">
              Número de Individuos Intervenidos <span class="required">*</span>
            </label>
            <input
              id="individuos"
              type="number"
              min="1"
              bind:value={individuosIntervenidos}
              placeholder="Ej: 5"
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
</style>
