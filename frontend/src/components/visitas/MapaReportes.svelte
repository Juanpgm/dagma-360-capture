<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getReportes } from '../../api/visitas';
  import type { Reporte } from '../../types/visitas';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';

  let mapContainer: HTMLDivElement;
  let map: L.Map | null = null;
  let reportes: Reporte[] = [];
  let loading = false;
  let error: string | null = null;
  let markers: L.Marker[] = [];

  // Colores por tipo de intervención
  const colorMap: Record<string, string> = {
    'Mantenimiento': '#3b82f6',
    'Mejoramiento': '#10b981',
    'Limpieza': '#f59e0b',
    'Poda': '#8b5cf6',
    'Reparación': '#ef4444',
    'Inspección': '#6366f1',
    'Otro': '#6b7280'
  };

  onMount(async () => {
    await loadReportes();
    initMap();
  });

  onDestroy(() => {
    if (map) {
      map.remove();
      map = null;
    }
  });

  async function loadReportes() {
    loading = true;
    error = null;

    try {
      const response = await getReportes();
      reportes = response.reportes || [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error al cargar reportes';
      console.error('Error loading reportes:', err);
    } finally {
      loading = false;
    }
  }

  function initMap() {
    if (!mapContainer) return;

    // Crear mapa centrado en Cali
    map = L.map(mapContainer).setView([3.4516, -76.5320], 12);

    // Agregar capa de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Agregar marcadores de reportes
    addReporteMarkers();
  }

  function addReporteMarkers() {
    if (!map) return;

    // Limpiar marcadores anteriores
    markers.forEach(marker => marker.remove());
    markers = [];

    const bounds: L.LatLngBounds[] = [];

    reportes.forEach(reporte => {
      let lat: number | null = null;
      let lng: number | null = null;

      // Obtener coordenadas del reporte
      if (reporte.coordenadas) {
        if (typeof reporte.coordenadas === 'string') {
          try {
            const coords = JSON.parse(reporte.coordenadas);
            lat = coords.latitude || coords[1];
            lng = coords.longitude || coords[0];
          } catch {
            // Ignorar si no se puede parsear
          }
        } else if (typeof reporte.coordenadas === 'object') {
          lat = (reporte.coordenadas as any).latitude || (reporte.coordenadas as any)[1];
          lng = (reporte.coordenadas as any).longitude || (reporte.coordenadas as any)[0];
        }
      }

      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        const color = colorMap[reporte.tipo_intervencion] || colorMap['Otro'];
        
        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-pin" style="background-color: ${color}"></div>`,
            iconSize: [24, 36],
            iconAnchor: [12, 36]
          })
        });

        // Popup con información del reporte
        const fecha = new Date(reporte.fecha).toLocaleDateString('es-CO', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const fotosHtml = reporte.fotos && reporte.fotos.length > 0
          ? `<div class="fotos-preview">
               ${reporte.fotos.slice(0, 3).map(url => 
                 `<img src="${url}" alt="Foto" class="foto-thumbnail" />`
               ).join('')}
               ${reporte.fotos.length > 3 ? `<span class="fotos-more">+${reporte.fotos.length - 3}</span>` : ''}
             </div>`
          : '<p class="no-fotos">Sin fotos</p>';

        marker.bindPopup(`
          <div class="popup-content">
            <h4>${reporte.nombre_parque || 'Parque'}</h4>
            <p class="fecha">${fecha}</p>
            <p><strong>Tipo:</strong> <span class="tipo-badge" style="background-color: ${color}20; color: ${color}">${reporte.tipo_intervencion}</span></p>
            <p class="descripcion">${reporte.descripcion || 'Sin descripción'}</p>
            ${reporte.observaciones ? `<p class="observaciones"><strong>Obs:</strong> ${reporte.observaciones}</p>` : ''}
            ${fotosHtml}
          </div>
        `, {
          maxWidth: 300
        });

        marker.addTo(map!);
        markers.push(marker);
        bounds.push(L.latLngBounds([lat, lng], [lat, lng]));
      }
    });

    // Ajustar vista para mostrar todos los marcadores
    if (bounds.length > 0 && map) {
      const group = new L.FeatureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  function recenterMap() {
    if (map && markers.length > 0) {
      const group = new L.FeatureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }
</script>

<div class="mapa-container">
  <div class="header">
    <div class="header-text">
      <h1 class="title">Mapa de Reportes</h1>
      <p class="subtitle">Visualización de {reportes.length} reconocimientos realizados</p>
    </div>
    <button class="btn-recenter" on:click={recenterMap}>
      🎯 Centrar Mapa
    </button>
  </div>

  <div class="legend">
    <h4>Tipos de Intervención</h4>
    <div class="legend-items">
      {#each Object.entries(colorMap) as [tipo, color]}
        <div class="legend-item">
          <div class="legend-color" style="background-color: {color}"></div>
          <span>{tipo}</span>
        </div>
      {/each}
    </div>
  </div>

  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Cargando mapa...</p>
    </div>
  {:else if error}
    <div class="error">
      <p>{error}</p>
    </div>
  {:else}
    <div class="map-wrapper">
      <div bind:this={mapContainer} class="map"></div>
    </div>
  {/if}
</div>

<style>
  :global(.custom-marker) {
    background: none;
    border: none;
  }

  :global(.marker-pin) {
    width: 24px;
    height: 36px;
    position: relative;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  :global(.marker-pin::after) {
    content: '';
    width: 12px;
    height: 12px;
    position: absolute;
    background: white;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
  }

  :global(.leaflet-popup-content) {
    margin: 0;
    padding: 0;
  }

  :global(.popup-content) {
    padding: 0.75rem;
    min-width: 250px;
  }

  :global(.popup-content h4) {
    margin: 0 0 0.25rem 0;
    color: #047857;
    font-size: 1rem;
    font-weight: 700;
  }

  :global(.popup-content .fecha) {
    margin: 0 0 0.5rem 0;
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global(.popup-content p) {
    margin: 0.25rem 0;
    font-size: 0.875rem;
    color: #374151;
  }

  :global(.popup-content .descripcion) {
    margin: 0.5rem 0;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  :global(.popup-content .observaciones) {
    font-size: 0.8125rem;
    color: #6b7280;
    font-style: italic;
  }

  :global(.tipo-badge) {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  :global(.fotos-preview) {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
    flex-wrap: wrap;
  }

  :global(.foto-thumbnail) {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: 4px;
    cursor: pointer;
    transition: transform 0.2s;
  }

  :global(.foto-thumbnail:hover) {
    transform: scale(1.1);
  }

  :global(.fotos-more) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 60px;
    background: #f3f4f6;
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 600;
    color: #6b7280;
  }

  :global(.no-fotos) {
    color: #9ca3af;
    font-size: 0.875rem;
    font-style: italic;
  }

  .mapa-container {
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: calc(100vh - 3rem);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .header-text {
    flex: 1;
  }

  .title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #047857;
    margin: 0 0 0.25rem 0;
  }

  .subtitle {
    font-size: 1rem;
    color: #6b7280;
    margin: 0;
  }

  .btn-recenter {
    padding: 0.625rem 1.25rem;
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .btn-recenter:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(5, 150, 105, 0.3);
  }

  .legend {
    background: white;
    padding: 1rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .legend h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .legend-items {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .legend-color {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .legend-item span {
    font-size: 0.8125rem;
    color: #6b7280;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
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
    to { transform: rotate(360deg); }
  }

  .error {
    padding: 2rem;
    text-align: center;
    color: #991b1b;
    background: #fee2e2;
    border-radius: 8px;
  }

  .map-wrapper {
    flex: 1;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .map {
    width: 100%;
    height: 100%;
    min-height: 500px;
  }

  @media (max-width: 768px) {
    .mapa-container {
      padding: 1rem;
    }

    .header {
      flex-direction: column;
      align-items: flex-start;
    }

    .btn-recenter {
      width: 100%;
    }

    .legend-items {
      flex-direction: column;
      gap: 0.5rem;
    }
  }
</style>
