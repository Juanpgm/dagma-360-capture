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

  // Debug: Log cuando cambien los reportes
  $: {
    console.log("🔄 MapaCoropletico: filteredReportes actualizado");
    console.log("   Total reportes recibidos:", filteredReportes.length);
    if (filteredReportes.length > 0) {
      console.log("   Primer reporte:", filteredReportes[0]);
      console.log(
        "   comuna_corregimiento:",
        filteredReportes[0]?.comuna_corregimiento,
      );
      console.log("   barrio_vereda:", filteredReportes[0]?.barrio_vereda);
    }
  }

  $: if (map && geojsonData && filteredReportes) {
    console.log(
      "📍 Trigger updateChoropleth - reportes:",
      filteredReportes.length,
    );
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
  });

  onDestroy(() => {
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
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      dragging: false,
      boxZoom: false,
      keyboard: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
      opacity: 0.3,
    }).addTo(map);

    updateChoropleth();
  }

  function fitMapToGeoJSON() {
    if (map && geojsonLayer) {
      const bounds = geojsonLayer.getBounds();
      map.fitBounds(bounds, { padding: [20, 20] });
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
      if (index < 5) {
        console.log(
          `🗺️ GeoJSON feature ${index}:`,
          areaName,
          "normalizado:",
          normalizeAreaName(areaName),
        );
      }
    });
    console.log("🗺️ Áreas únicas en GeoJSON:", Array.from(geojsonAreas).sort());
    console.log(
      "🗺️ Áreas normalizadas:",
      Array.from(geojsonAreas)
        .map((a) => normalizeAreaName(a))
        .sort(),
    );

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
          console.log(
            `🎨 Área "${areaName}" (${normalizedName}): ${count} intervenciones, color: ${color}`,
          );
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

    console.log(
      "🗺️ Mapa coroplético actualizado. Agregaciones:",
      Array.from(aggregations.entries()),
    );
  }

  function calculateAggregations(): Map<string, number> {
    const counts = new Map<string, number>();

    console.log("📊 Calculando agregaciones para:", aggregationLevel);
    console.log("📊 Total reportes filtrados:", filteredReportes.length);

    filteredReportes.forEach((reporte, index) => {
      // Usar directamente los campos del backend
      let areaName =
        aggregationLevel === "comuna"
          ? reporte.comuna_corregimiento
          : reporte.barrio_vereda;

      if (index < 5) {
        console.log(
          `📍 Reporte ${index}:`,
          `${aggregationLevel}="${areaName}"`,
          `comuna_corregimiento="${reporte.comuna_corregimiento}"`,
          `barrio_vereda="${reporte.barrio_vereda}"`,
        );
      }

      if (areaName) {
        const normalizedName = normalizeAreaName(areaName);
        counts.set(normalizedName, (counts.get(normalizedName) || 0) + 1);

        if (index < 5) {
          console.log(`   → Normalizado: "${normalizedName}"`);
        }
      }
    });

    console.log("✅ Agregaciones calculadas:", Array.from(counts.entries()));
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
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
      Distribución por {aggregationLevel === "comuna" ? "Comuna" : "Barrio"}
    </h3>
    <div class="legend-scale">
      <div class="scale-item">
        <span class="scale-box" style="background: #a7f3d0"></span>
        1
      </div>
      <div class="scale-item">
        <span class="scale-box" style="background: #6ee7b7"></span>
        2
      </div>
      <div class="scale-item">
        <span class="scale-box" style="background: #34d399"></span>
        3
      </div>
      <div class="scale-item">
        <span class="scale-box" style="background: #10b981"></span>
        4-5
      </div>
      <div class="scale-item">
        <span class="scale-box" style="background: #059669"></span>
        6-7
      </div>
      <div class="scale-item">
        <span class="scale-box" style="background: #064e3b"></span>
        8+
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

  .legend-scale {
    display: flex;
    gap: 0.75rem;
    font-size: 0.75rem;
  }

  .scale-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: #64748b;
  }

  .scale-box {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    border: 1px solid #cbd5e1;
  }

  .map-container {
    flex: 1;
    min-height: 400px;
  }

  @media (max-width: 768px) {
    .map-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .legend-scale {
      width: 100%;
      flex-wrap: wrap;
    }
  }
</style>
