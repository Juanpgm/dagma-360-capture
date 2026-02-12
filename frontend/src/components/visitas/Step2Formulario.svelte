<script lang="ts">
  import { onMount } from "svelte";
  import Button from "../ui/Button.svelte";
  import Card from "../ui/Card.svelte";
  import type { Coordenadas, Parque } from "../../types/visitas";
  import {
    formatCoordinates,
    calculateDistanceToGeometry,
  } from "../../lib/geolocation";

  export let coordenadas: Coordenadas | undefined;
  export let tipoIntervencion: string | undefined;
  export let descripcionIntervencion: string | undefined;
  export let direccion: string | undefined;
  export let observaciones: string | undefined;
  export let selectedParque: Parque | undefined;
  export let onCaptureGPS: () => Promise<void>;
  export let isLoading: boolean;

  let gpsError = "";
  let autoCaptureAttempted = false;
  let distanceToParque: number | null = null;
  let showDistanceWarning = false;
  let isAutoCaptureInProgress = false;

  // Tipos de intervención disponibles
  const tiposIntervencion = [
    "Mantenimiento",
    "Mejoramiento",
    "Limpieza",
    "Poda",
    "Reparación",
    "Inspección",
    "Otro",
  ];

  // Recalcular distancia cuando cambien las coordenadas
  $: if (coordenadas && selectedParque?.geometry) {
    distanceToParque = calculateDistanceToGeometry(
      coordenadas,
      selectedParque.geometry,
    );
    // TEMPORAL: Deshabilitada validación de distancia de 200m
    showDistanceWarning = false; // distanceToParque !== null && distanceToParque > 200;
  } else if (coordenadas && selectedParque?.lat && selectedParque?.lon) {
    // Fallback a lat/lon si no hay geometry
    const lat = parseFloat(selectedParque.lat);
    const lon = parseFloat(selectedParque.lon);
    if (!isNaN(lat) && !isNaN(lon)) {
      const R = 6371e3; // Radio de la Tierra en metros
      const φ1 = (coordenadas.latitude * Math.PI) / 180;
      const φ2 = (lat * Math.PI) / 180;
      const Δφ = ((lat - coordenadas.latitude) * Math.PI) / 180;
      const Δλ = ((lon - coordenadas.longitude) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      distanceToParque = R * c;
      // TEMPORAL: Deshabilitada validación de distancia de 200m
      showDistanceWarning = false; // distanceToParque > 200;
    }
  }

  onMount(async () => {
    // Capturar GPS automáticamente al entrar al paso
    if (!coordenadas && !autoCaptureAttempted) {
      autoCaptureAttempted = true;
      isAutoCaptureInProgress = true;
      await handleCaptureGPS();
      isAutoCaptureInProgress = false;
    }

    // Auto-completar dirección desde el parque seleccionado si está disponible
    if (selectedParque?.direccion && !direccion) {
      direccion = selectedParque.direccion;
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
        <div class="field">
          <label for="tipo">
            Tipo de Intervención <span class="required">*</span>
          </label>
          <select id="tipo" bind:value={tipoIntervencion} required>
            <option value="">Seleccione un tipo...</option>
            {#each tiposIntervencion as tipo}
              <option value={tipo}>{tipo}</option>
            {/each}
          </select>
        </div>

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
          <label for="direccion">
            Dirección <span class="required">*</span>
          </label>
          <input
            id="direccion"
            type="text"
            bind:value={direccion}
            placeholder="Dirección del lugar de la intervención..."
            required
          />
          {#if selectedParque?.direccion && direccion !== selectedParque.direccion}
            <button
              type="button"
              class="btn-restore"
              on:click={() => (direccion = selectedParque.direccion || "")}
            >
              📍 Usar dirección del parque
            </button>
          {/if}
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
    color: #1e293b;
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
    color: #64748b;
    font-size: 0.875rem;
    margin: 0;
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid #e2e8f0;
    border-top-color: #2563eb;
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
    color: #64748b;
    margin-bottom: 0.25rem;
  }

  .gps-field input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    background: #f8fafc;
    color: #1e293b;
  }

  .gps-info-row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .info-badge {
    background: #f0f9ff;
    border: 1px solid #bfdbfe;
    color: #1e40af;
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
    color: #1e293b;
  }

  .required {
    color: #dc2626;
  }

  .field select,
  .field input[type="text"],
  .field textarea {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.9375rem;
    font-family: inherit;
    color: #1e293b;
    background: white;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .field select:focus,
  .field input[type="text"]:focus,
  .field textarea:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .field textarea {
    resize: vertical;
    min-height: 80px;
  }

  .btn-restore {
    margin-top: 0.375rem;
    padding: 0.375rem 0.625rem;
    font-size: 0.8125rem;
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-restore:hover {
    background: #e2e8f0;
    border-color: #cbd5e1;
  }

  @media (max-width: 640px) {
    .gps-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
