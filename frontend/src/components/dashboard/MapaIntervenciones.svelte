<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import L from "leaflet";
  import "leaflet/dist/leaflet.css";
  import type { ReporteIntervencion } from "../../api/visitas";

  export let filteredReportes: ReporteIntervencion[] = [];

  let mapContainer: HTMLElement;
  let map: L.Map | null = null;
  let markersLayer: L.LayerGroup | null = null;

  $: if (map && filteredReportes) {
    updateMarkers();
  }

  onMount(() => {
    initMap();
  });

  onDestroy(() => {
    if (map) {
      map.remove();
      map = null;
    }
  });

  function initMap() {
    // Inicializar mapa centrado en Cali, Colombia
    map = L.map(mapContainer, {
      center: [3.4516, -76.532],
      zoom: 12,
      zoomControl: true,
    });

    // Agregar capa base de OpenStreetMap
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Crear capa para marcadores
    markersLayer = L.layerGroup().addTo(map);

    updateMarkers();
  }

  function updateMarkers() {
    if (!map || !markersLayer) return;

    // Limpiar marcadores existentes
    markersLayer.clearLayers();

    // Colores por tipo de intervención
    const colorMap: Record<string, string> = {
      Poda: "#10b981",
      Tala: "#ef4444",
      "Mantenimiento arbóreo": "#3b82f6",
    };

    // Agregar marcadores para cada reporte
    filteredReportes.forEach((reporte) => {
      if (!reporte.coordinates_data || reporte.coordinates_data.length !== 2) {
        return;
      }

      const [lng, lat] = reporte.coordinates_data;
      const color = colorMap[reporte.tipo_intervencion] || "#6b7280";

      // Crear icono personalizado SVG
      const icon = L.divIcon({
        className: "custom-marker",
        html: `
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="12" fill="${color}" opacity="0.3"/>
            <circle cx="16" cy="16" r="8" fill="${color}"/>
            <circle cx="16" cy="16" r="4" fill="white"/>
          </svg>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([lat, lng], { icon })
        .bindPopup(
          `
          <div style="min-width: 200px;">
            <strong style="color: ${color}; font-size: 14px;">${reporte.tipo_intervencion}</strong>
            <div style="margin-top: 8px; font-size: 12px;">
              <div><strong>Árbol:</strong> ${reporte.tipo_arbol || "N/A"}</div>
              <div><strong>Individuos:</strong> ${reporte.numero_individuos_intervenidos || 0}</div>
              <div><strong>Fecha:</strong> ${reporte.fecha_registro ? new Date(reporte.fecha_registro).toLocaleDateString("es-CO") : "N/A"}</div>
              ${reporte.observaciones ? `<div style="margin-top: 4px;"><strong>Obs:</strong> ${reporte.observaciones}</div>` : ""}
            </div>
          </div>
        `,
          {
            maxWidth: 300,
          },
        )
        .addTo(markersLayer!);
    });

    // Ajustar vista si hay reportes
    if (filteredReportes.length > 0) {
      const bounds = filteredReportes
        .filter((r) => r.coordinates_data && r.coordinates_data.length === 2)
        .map(
          (r) =>
            [r.coordinates_data![1], r.coordinates_data![0]] as [
              number,
              number,
            ],
        );

      if (bounds.length > 0) {
        map!.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }
</script>

<div class="map-wrapper">
  <div class="map-header">
    <h3>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      Ubicaciones de Intervenciones
    </h3>
    <div class="legend">
      <div class="legend-item">
        <span class="dot poda"></span>
        Poda
      </div>
      <div class="legend-item">
        <span class="dot tala"></span>
        Tala
      </div>
      <div class="legend-item">
        <span class="dot mantenimiento"></span>
        Mantenimiento
      </div>
    </div>
  </div>
  <div bind:this={mapContainer} class="map-container"></div>
</div>

<style>
  .map-wrapper {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .map-header {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .map-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .legend {
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: #64748b;
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .dot.poda {
    background: #10b981;
  }

  .dot.tala {
    background: #ef4444;
  }

  .dot.mantenimiento {
    background: #3b82f6;
  }

  .map-container {
    flex: 1;
    min-height: 400px;
  }

  :global(.custom-marker) {
    background: transparent !important;
    border: none !important;
  }

  :global(.leaflet-popup-content-wrapper) {
    border-radius: 8px;
  }

  @media (max-width: 768px) {
    .map-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .legend {
      width: 100%;
      justify-content: space-between;
    }
  }
</style>
