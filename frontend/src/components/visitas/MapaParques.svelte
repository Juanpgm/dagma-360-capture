<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getParques } from '../../api/visitas';
  import type { Parque } from '../../types/visitas';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';

  let mapContainer: HTMLDivElement;
  let map: L.Map | null = null;
  let parques: Parque[] = [];
  let loading = false;
  let error: string | null = null;
  let markers: L.Marker[] = [];

  onMount(async () => {
    await loadParques();
    initMap();
  });

  onDestroy(() => {
    if (map) {
      map.remove();
      map = null;
    }
  });

  async function loadParques() {
    loading = true;
    error = null;

    try {
      parques = await getParques();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error al cargar parques';
      console.error('Error loading parques:', err);
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

    // Agregar marcadores de parques
    addParqueMarkers();
  }

  function addParqueMarkers() {
    if (!map) return;

    // Limpiar marcadores anteriores
    markers.forEach(marker => marker.remove());
    markers = [];

    const bounds: L.LatLngBounds[] = [];

    parques.forEach(parque => {
      let lat: number | null = null;
      let lng: number | null = null;

      // Intentar obtener coordenadas desde geometry
      if (parque.geometry?.coordinates) {
        if (parque.geometry.type === 'Point') {
          lng = parque.geometry.coordinates[0];
          lat = parque.geometry.coordinates[1];
        } else if (parque.geometry.type === 'Polygon' || parque.geometry.type === 'MultiLineString') {
          // Calcular centroide aproximado
          const coords = Array.isArray(parque.geometry.coordinates[0][0])
            ? parque.geometry.coordinates[0]
            : parque.geometry.coordinates;
          
          const lats = coords.map((c: any) => Array.isArray(c) ? c[1] : 0);
          const lngs = coords.map((c: any) => Array.isArray(c) ? c[0] : 0);
          
          lat = lats.reduce((a: number, b: number) => a + b, 0) / lats.length;
          lng = lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length;
        }
      }

      // Fallback a lat/lon strings
      if (!lat && parque.lat && parque.lon) {
        lat = parseFloat(parque.lat);
        lng = parseFloat(parque.lon);
      }

      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-icon">🌳</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          })
        });

        // Popup con información del parque
        const estadoIntervencion = parque.intervenciones?.[0]?.estado || 'Sin datos';
        marker.bindPopup(`
          <div class="popup-content">
            <h4>${parque.nombre_up}</h4>
            <p><strong>ID:</strong> ${parque.upid}</p>
            ${parque.barrio_vereda ? `<p><strong>Barrio:</strong> ${parque.barrio_vereda}</p>` : ''}
            ${parque.direccion ? `<p><strong>Dirección:</strong> ${parque.direccion}</p>` : ''}
            <p><strong>Estado:</strong> <span class="estado-badge">${estadoIntervencion}</span></p>
          </div>
        `);

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
    <h1 class="title">Mapa de Parques</h1>
    <p class="subtitle">Visualización geográfica de los {parques.length} parques</p>
    <button class="btn-recenter" on:click={recenterMap}>
      🎯 Centrar Mapa
    </button>
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

  :global(.marker-icon) {
    font-size: 24px;
    text-align: center;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }

  :global(.leaflet-popup-content) {
    margin: 0;
    padding: 0;
  }

  :global(.popup-content) {
    padding: 0.75rem;
    min-width: 200px;
  }

  :global(.popup-content h4) {
    margin: 0 0 0.5rem 0;
    color: #047857;
    font-size: 1rem;
    font-weight: 700;
  }

  :global(.popup-content p) {
    margin: 0.25rem 0;
    font-size: 0.875rem;
    color: #374151;
  }

  :global(.estado-badge) {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    background: #dbeafe;
    color: #1e40af;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .mapa-container {
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    height: calc(100vh - 3rem);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #047857;
    margin: 0;
  }

  .subtitle {
    font-size: 1rem;
    color: #6b7280;
    margin: 0;
    flex: 1;
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
  }
</style>
