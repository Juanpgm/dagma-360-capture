<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import L from "leaflet";
  import "leaflet/dist/leaflet.css";
  import type { ReporteIntervencion } from "../../api/visitas";

  export let filteredReportes: ReporteIntervencion[] = [];
  export let aggregationLevel: "comuna" | "barrio" = "comuna";

  let mapContainer: HTMLElement;
  let map: L.Map | null = null;
  let geojsonLayer: L.GeoJSON | null = null;
  let geojsonData: any = null;
  let isFirstLoad = true;
  let resizeObserver: ResizeObserver | null = null;

  $: {
    // track filteredReportes changes to trigger updateChoropleth
    void filteredReportes;
  }

  $: if (map && geojsonData && filteredReportes) {
    updateChoropleth();
  }

  // Recargar GeoJSON cuando cambie el nivel de agregación
  $: if (aggregationLevel && map) {
    isFirstLoad = true; // Reset para ajustar vista con nuevo nivel
    loadGeoJSON().then(() => {
      updateChoropleth();
    });
  }

  onMount(async () => {
    await loadGeoJSON();
    initMap();
    resizeObserver = new ResizeObserver(() => {
      if (map) {
        map.invalidateSize();
        if (geojsonLayer) fitMapToGeoJSON();
      }
    });
    resizeObserver.observe(mapContainer);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    if (map) {
      map.remove();
      map = null;
    }
  });

  async function loadGeoJSON() {
    try {
      const filename =
        aggregationLevel === "comuna"
          ? "/cartografia_base/comunas_corregimientos.geojson"
          : "/cartografia_base/barrios_veredas.geojson";

      const response = await fetch(filename);
      geojsonData = await response.json();
    } catch (error) {
      console.error("Error cargando GeoJSON:", error);
    }
  }

  function initMap() {
    map = L.map(mapContainer, {
      center: [3.4516, -76.532],
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      dragging: false,
      boxZoom: false,
      keyboard: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '',
      maxZoom: 19,
      opacity: 0.3,
    }).addTo(map);

    updateChoropleth();
  }

  function fitMapToGeoJSON() {
    if (map && geojsonLayer) {
      const bounds = geojsonLayer.getBounds();
      map.fitBounds(bounds, { padding: [8, 8], animate: false });
    }
  }

  // Normalizar nombres para matching consistente
  function normalizeAreaName(name: string | null | undefined): string {
    if (!name) return "";
    return name.trim().toUpperCase();
  }

  function updateChoropleth() {
    if (!map || !geojsonData) return;

    // Limpiar capa anterior
    if (geojsonLayer) {
      map!.removeLayer(geojsonLayer);
    }

    // Calcular agregaciones por área
    const aggregations = calculateAggregations();

    // Debug: Mostrar los nombres de áreas en el GeoJSON
    const geojsonAreas = new Set<string>();
    geojsonData.features?.forEach((feature: any, index: number) => {
      const areaName =
        aggregationLevel === "comuna"
          ? feature?.properties?.comuna_corregimiento
          : feature?.properties?.barrio_vereda;
      if (areaName) {
        geojsonAreas.add(areaName);
      }
    });

    // Crear capa GeoJSON con estilos
    geojsonLayer = L.geoJSON(geojsonData, {
      style: (feature) => {
        const areaName =
          aggregationLevel === "comuna"
            ? feature?.properties?.comuna_corregimiento
            : feature?.properties?.barrio_vereda;

        const normalizedName = normalizeAreaName(areaName);
        const count = aggregations.get(normalizedName) || 0;
        const color = getColor(count);

        if (count > 0) {
          // area has interventions
        }

        return {
          fillColor: color,
          weight: 1,
          opacity: 1,
          color: "#64748b",
          fillOpacity: 0.7,
        };
      },
      onEachFeature: (feature, layer) => {
        const areaName =
          aggregationLevel === "comuna"
            ? feature?.properties?.comuna_corregimiento
            : feature?.properties?.barrio_vereda;

        const normalizedName = normalizeAreaName(areaName);
        const count = aggregations.get(normalizedName) || 0;

        layer.bindPopup(
          `
          <div style="font-size: 13px;">
            <strong style="font-size: 14px;">${areaName || "Sin nombre"}</strong>
            <div style="margin-top: 8px;">
              <strong>Intervenciones:</strong> ${count}
            </div>
          </div>
        `,
          { maxWidth: 250 },
        );

        layer.on({
          mouseover: highlightFeature,
          mouseout: resetHighlight,
        });
      },
    }).addTo(map!);

    // Ajustar vista solo la primera vez que se carga
    if (isFirstLoad && geojsonLayer) {
      fitMapToGeoJSON();
      isFirstLoad = false;
    }
  }

  function calculateAggregations(): Map<string, number> {
    const counts = new Map<string, number>();

    filteredReportes.forEach((reporte, index) => {
      // Use backend geo fields directly
      let areaName =
        aggregationLevel === "comuna"
          ? reporte.comuna_corregimiento
          : reporte.barrio_vereda;

      if (areaName) {
        const normalizedName = normalizeAreaName(areaName);
        counts.set(normalizedName, (counts.get(normalizedName) || 0) + 1);
      }
    });

    return counts;
  }

  function getColor(count: number): string {
    // Escala de colores ajustada para valores más representativos
    return count >= 8
      ? "#064e3b" // Verde muy oscuro - 8+ intervenciones
      : count >= 6
        ? "#059669" // Verde oscuro - 6-7 intervenciones
        : count >= 4
          ? "#10b981" // Verde medio - 4-5 intervenciones
          : count >= 3
            ? "#34d399" // Verde - 3 intervenciones
            : count >= 2
              ? "#6ee7b7" // Verde claro - 2 intervenciones
              : count >= 1
                ? "#a7f3d0" // Verde muy claro - 1 intervención
                : "#f1f5f9"; // Gris claro - sin intervenciones
  }

  function highlightFeature(e: L.LeafletMouseEvent) {
    const layer = e.target;
    layer.setStyle({
      weight: 3,
      color: "#334155",
      fillOpacity: 0.9,
    });
    layer.bringToFront();
  }

  function resetHighlight(e: L.LeafletMouseEvent) {
    geojsonLayer?.resetStyle(e.target);
  }
</script>

<div bind:this={mapContainer} class="map-container"></div>

<style>
  .map-container {
    width: 100%;
    height: 100%;
    min-height: 400px;
  }
</style>
