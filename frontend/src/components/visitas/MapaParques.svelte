<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getParques } from "../../api/visitas";
  import type { Parque } from "../../types/visitas";
  import L from "leaflet";
  import "leaflet/dist/leaflet.css";

  let mapContainer: HTMLDivElement;
  let map: L.Map | null = null;
  let parques: Parque[] = [];
  let loading = false;
  let error: string | null = null;
  let markers: L.Marker[] = [];

  onMount(async () => {
    console.log("🎯 MapaParques.svelte mounted");
    try {
      await loadParques();
      console.log(`📦 Parques cargados: ${parques.length}`);
      if (parques.length === 0) {
        console.warn("⚠️  No hay parques cargados");
      }
      initMap();
    } catch (err) {
      console.error("❌ Error en mount:", err);
    }
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
      error = err instanceof Error ? err.message : "Error al cargar parques";
      console.error("Error loading parques:", err);
    } finally {
      loading = false;
    }
  }

  function initMap() {
    if (!mapContainer) return;

    // Crear mapa centrado en Cali
    map = L.map(mapContainer).setView([3.4516, -76.532], 12);

    // Agregar capa de OpenStreetMap
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    // Agregar marcadores de parques
    addParqueMarkers();
  }

  function addParqueMarkers() {
    if (!map) {
      console.error("❌ Mapa no inicializado");
      return;
    }

    console.log(`\n🎨 == DIBUJANDO PARQUES ==`);
    console.log(`   Total: ${parques.length}`);
    console.log(
      `   Con geometría: ${parques.filter((p) => p.geometry).length}`,
    );

    // Limpiar capas anteriores (excepto tile layer)
    let layerCount = 0;
    map.eachLayer((layer) => {
      if (
        layer instanceof L.Marker ||
        layer instanceof L.Polygon ||
        layer instanceof L.Polyline ||
        layer instanceof L.FeatureGroup
      ) {
        map!.removeLayer(layer);
        layerCount++;
      }
    });
    console.log(`   Capas limpias: ${layerCount}`);

    markers = [];
    const allLayers: L.Layer[] = [];

    console.log(`📍 Dibujando ${parques.length} parques`);

    parques.forEach((parque, index) => {
      if (!parque.geometry) {
        console.warn(`⚠️  Parque ${index} (${parque.nombre_up}) sin geometría`);
        return;
      }

      const geometry = parque.geometry;
      const popupContent = getPopupContent(parque);
      let layersCount = 0;

      try {
        switch (geometry.type) {
          case "Point":
            const pointLayer = createPoint(
              geometry.coordinates as [number, number],
              popupContent,
            );
            if (pointLayer) {
              pointLayer.addTo(map!);
              allLayers.push(pointLayer);
              layersCount = 1;
            }
            break;

          case "LineString":
            const lineLayer = createLineString(
              geometry.coordinates as [number, number][],
              popupContent,
            );
            if (lineLayer) {
              lineLayer.addTo(map!);
              allLayers.push(lineLayer);
              layersCount = 1;
            }
            break;

          case "Polygon":
            const polygonLayer = createPolygon(
              geometry.coordinates as [number, number][][],
              popupContent,
            );
            if (polygonLayer) {
              polygonLayer.addTo(map!);
              allLayers.push(polygonLayer);
              layersCount = 1;
            }
            break;

          case "MultiPoint":
            const multiPointLayers = (
              geometry.coordinates as [number, number][]
            ).map((coords) => createPoint(coords, popupContent));
            multiPointLayers.forEach((l) => l?.addTo(map!));
            allLayers.push(
              ...(multiPointLayers.filter((l) => l !== null) as L.Layer[]),
            );
            layersCount = multiPointLayers.length;
            break;

          case "MultiLineString":
            const multiLineLayers = (
              geometry.coordinates as [number, number][][]
            ).map((coords) => createLineString(coords, popupContent));
            multiLineLayers.forEach((l) => l?.addTo(map!));
            allLayers.push(
              ...(multiLineLayers.filter((l) => l !== null) as L.Layer[]),
            );
            layersCount = multiLineLayers.length;
            break;

          case "MultiPolygon":
            const multiPolyLayers = (
              geometry.coordinates as [number, number][][][]
            ).map((coords) => createPolygon(coords, popupContent));
            multiPolyLayers.forEach((l) => l?.addTo(map!));
            allLayers.push(
              ...(multiPolyLayers.filter((l) => l !== null) as L.Layer[]),
            );
            layersCount = multiPolyLayers.length;
            break;

          case "GeometryCollection":
            console.warn(`⚠️  GeometryCollection no soportada aún`);
            break;

          default:
            console.warn(
              `⚠️  Tipo de geometría desconocido: ${(geometry as any).type}`,
            );
        }

        if (layersCount > 0) {
          console.log(
            `  ✓ ${parque.nombre_up}: ${geometry.type} (${layersCount} capa${layersCount > 1 ? "s" : ""})`,
          );
        }
      } catch (err) {
        console.error(`❌ Error dibujando ${parque.nombre_up}:`, err);
      }
    });

    console.log(`✅ == RESULTADO ==`);
    console.log(`   Capas dibujadas: ${allLayers.length}`);
    console.log(`   Marcadores: ${markers.length}`);

    // Ajustar vista
    if (allLayers.length > 0 && map) {
      try {
        setTimeout(() => {
          const group = new L.FeatureGroup(allLayers);
          map!.fitBounds(group.getBounds().pad(0.1));
        }, 100);
      } catch (err) {
        console.error("Error ajustando vista:", err);
      }
    }
  }

  function getPopupContent(parque: Parque): string {
    const estadoIntervencion =
      parque.intervenciones?.[0]?.estado || "Sin datos";
    return `
      <div class="popup-content">
        <h4>${parque.nombre_up}</h4>
        <p><strong>ID:</strong> ${parque.upid}</p>
        ${parque.barrio_vereda ? `<p><strong>Barrio:</strong> ${parque.barrio_vereda}</p>` : ""}
        ${parque.direccion ? `<p><strong>Dirección:</strong> ${parque.direccion}</p>` : ""}
        <p><strong>Estado:</strong> <span class="estado-badge">${estadoIntervencion}</span></p>
        <p><strong>Tipo:</strong> ${parque.geometry?.type || "Sin geometría"}</p>
      </div>
    `;
  }

  function createPoint(
    coords: [number, number],
    popup: string,
  ): L.Marker | null {
    const [lng, lat] = coords;
    if (isNaN(lat) || isNaN(lng)) return null;

    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: "custom-marker",
        html: `<div class="marker-icon">🌳</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    });
    marker.bindPopup(popup);
    markers.push(marker);
    return marker;
  }

  function createLineString(
    coords: [number, number][],
    popup: string,
  ): L.Polyline | null {
    if (coords.length < 2) return null;

    const latLngs = coords
      .map(([lng, lat]) => [lat, lng] as [number, number])
      .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));

    if (latLngs.length < 2) return null;

    const polyline = L.polyline(latLngs, {
      color: "#059669",
      weight: 3,
      opacity: 0.8,
    });
    polyline.bindPopup(popup);
    return polyline;
  }

  function createPolygon(
    coords: [number, number][][],
    popup: string,
  ): L.Polygon | null {
    if (coords.length === 0 || coords[0].length < 3) return null;

    const latLngs = coords[0]
      .map(([lng, lat]) => [lat, lng] as [number, number])
      .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));

    if (latLngs.length < 3) return null;

    const polygon = L.polygon(latLngs, {
      color: "#047857",
      weight: 3,
      opacity: 0.8,
      fillColor: "#d1fae5",
      fillOpacity: 0.5,
      interactive: true,
    });
    polygon.bindPopup(popup);
    return polygon;
  }

  function recenterMap() {
    if (!map) return;

    // Obtener todas las capas dibujadas en el mapa
    const layers: L.Layer[] = [];
    map.eachLayer((layer) => {
      if (
        layer instanceof L.Marker ||
        layer instanceof L.Polygon ||
        layer instanceof L.Polyline
      ) {
        layers.push(layer);
      }
    });

    if (layers.length > 0) {
      const group = new L.FeatureGroup(layers);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }
</script>

<div class="mapa-container">
  <div class="header">
    <h1 class="title">Mapa de Parques</h1>
    <p class="subtitle">
      Visualización geográfica de los {parques.length} parques
    </p>
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
  :global(.leaflet-pane) {
    z-index: 1;
  }

  :global(.leaflet-overlay-pane) {
    z-index: 400 !important;
  }

  :global(.leaflet-shadow-pane) {
    z-index: 500 !important;
  }

  :global(.leaflet-marker-pane) {
    z-index: 600 !important;
  }

  :global(.leaflet-popup-pane) {
    z-index: 700 !important;
  }

  :global(.leaflet-polygon) {
    stroke: #047857 !important;
    stroke-width: 3 !important;
    opacity: 0.8 !important;
    fill: #d1fae5 !important;
    fill-opacity: 0.5 !important;
    z-index: 450 !important;
  }

  :global(.leaflet-polyline) {
    stroke: #059669 !important;
    stroke-width: 3 !important;
    opacity: 0.8 !important;
    z-index: 450 !important;
  }

  :global(.leaflet-path) {
    pointer-events: auto !important;
  }

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
    to {
      transform: rotate(360deg);
    }
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
    overflow: visible;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    position: relative;
    z-index: 1;
  }

  .map {
    width: 100%;
    height: 100%;
    min-height: 500px;
    position: relative;
    z-index: 1;
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
