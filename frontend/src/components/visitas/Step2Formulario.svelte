<script lang="ts">
  import { onMount } from 'svelte';
  import Input from '../ui/Input.svelte';
  import Textarea from '../ui/Textarea.svelte';
  import Select from '../ui/Select.svelte';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';
  import type { Coordenadas, Parque } from '../../types/visitas';
  import { formatCoordinates, calculateDistanceToGeometry } from '../../lib/geolocation';
  
  export let coordenadas: Coordenadas | undefined;
  export let tipoIntervencion: string | undefined;
  export let descripcionIntervencion: string | undefined;
  export let observaciones: string | undefined;
  export let selectedParque: Parque | undefined;
  export let onCaptureGPS: () => Promise<void>;
  export let isLoading: boolean;

  let gpsError = '';
  let autoCaptureAttempted = false;
  let distanceToParque: number | null = null;
  let showDistanceWarning = false;
  let isAutoCaptureInProgress = false;

  // Tipos de intervención disponibles
  const tiposIntervencion = [
    'Mantenimiento',
    'Mejoramiento',
    'Limpieza',
    'Poda',
    'Reparación',
    'Inspección',
    'Otro'
  ];

  // Recalcular distancia cuando cambien las coordenadas
  $: if (coordenadas && selectedParque?.geometry) {
    distanceToParque = calculateDistanceToGeometry(coordenadas, selectedParque.geometry);
    showDistanceWarning = distanceToParque !== null && distanceToParque > 200;
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

      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      distanceToParque = R * c;
      showDistanceWarning = distanceToParque > 200;
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
  });

  async function handleCaptureGPS() {
    gpsError = '';
    
    try {
      await onCaptureGPS();
    } catch (error) {
      gpsError = error instanceof Error ? error.message : 'Error al capturar GPS';
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
  <div class="step-header">
    <h2 class="step-title">Datos de Reconocimiento</h2>
    <p class="step-description">
      Registre la ubicación GPS y los datos del reconocimiento del parque
    </p>
  </div>

  <div class="step-content">
    <!-- GPS -->
    <Card variant="outlined" padding="sm">
      <div class="gps-section">
        <div class="section-header">
          <h4>📍 Coordenadas GPS</h4>
          {#if coordenadas}
            <Button size="sm" variant="outline" onClick={handleCaptureGPS} disabled={isLoading}>
              {isLoading ? '...' : 'Actualizar'}
            </Button>
          {:else if gpsError}
            <Button size="sm" onClick={handleCaptureGPS} disabled={isLoading}>
              {isLoading ? '...' : 'Reintentar'}
            </Button>
          {/if}
        </div>

        {#if isLoading && !coordenadas}
          <div class="gps-loading">
            <div class="spinner"></div>
            <p>{isAutoCaptureInProgress ? 'Capturando ubicación automáticamente...' : 'Obteniendo ubicación GPS...'}</p>
          </div>
        {:else if coordenadas}
          <div class="gps-info">
            <div class="gps-grid">
              <Input
                label="Latitud"
                value={coordenadas.latitude.toFixed(6)}
                readonly={true}
              />
              <Input
                label="Longitud"
                value={coordenadas.longitude.toFixed(6)}
                readonly={true}
              />
            </div>
            <div class="gps-meta">
              {#if coordenadas.accuracy}
                <span class="gps-accuracy">
                  Precisión: ±{coordenadas.accuracy.toFixed(0)}m
                </span>
              {/if}
              {#if distanceToParque !== null}
                <span class="gps-distance" class:warning={showDistanceWarning}>
                  Distancia al parque: {formatDistance(distanceToParque)}
                </span>
              {/if}
            </div>
          </div>

          {#if showDistanceWarning}
            <div class="warning-message">
              ⚠️ Está a más de 200m del parque. Verifique que esté en la ubicación correcta.
            </div>
          {/if}
        {/if}

        {#if gpsError}
          <div class="error-message">
            {gpsError}
            <div style="margin-top: 0.5rem;">
              <Button size="sm" onClick={handleCaptureGPS} disabled={isLoading}>
                {isLoading ? 'Reintentando...' : 'Reintentar Captura'}
              </Button>
            </div>
          </div>
        {/if}
      </div>
    </Card>

    <!-- Formulario de Verificación -->
    <div class="form-section">
      <Select
        label="Tipo de Intervención"
        bind:value={tipoIntervencion}
        options={tiposIntervencion.map(t => ({ value: t, label: t }))}
        placeholder="Seleccione el tipo de intervención"
        required={true}
      />

      <Textarea
        label="Descripción de Intervención"
        bind:value={descripcionIntervencion}
        placeholder="Describa la intervención realizada o requerida..."
        rows={4}
        required={true}
      />

      <Textarea
        label="Observaciones"
        bind:value={observaciones}
        placeholder="Observaciones adicionales (opcional)..."
        rows={3}
      />
    </div>
  </div>
</div>

<style>
  .step-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .step-header {
    text-align: left;
  }

  .step-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #047857;
    margin: 0 0 0.5rem 0;
  }

  .step-description {
    color: #6b7280;
    margin: 0;
    font-size: 0.9375rem;
  }

  .step-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .gps-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .section-header h4 {
    font-size: 1rem;
    font-weight: 600;
    color: #047857;
    margin: 0;
  }

  .gps-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;
    gap: 1rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e5e7eb;
    border-top-color: #059669;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .gps-loading p {
    color: #6b7280;
    margin: 0;
  }

  .gps-info {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .gps-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .gps-meta {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    font-size: 0.875rem;
  }

  .gps-accuracy {
    color: #059669;
    font-weight: 500;
  }

  .gps-distance {
    color: #6b7280;
    font-weight: 500;
  }

  .gps-distance.warning {
    color: #d97706;
  }

  .warning-message {
    background: #fef3c7;
    border: 1px solid #fbbf24;
    border-radius: 6px;
    padding: 0.875rem;
    color: #92400e;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .error-message {
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 6px;
    padding: 0.875rem;
    color: #991b1b;
    font-size: 0.875rem;
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  @media (max-width: 768px) {
    .gps-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
