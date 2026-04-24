<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import L from "leaflet";
  import "leaflet/dist/leaflet.css";
  import type { ReporteIntervencion } from "../../api/visitas";

  export let filteredReportes: ReporteIntervencion[] = [];

  let mapContainer: HTMLElement;
  let map: L.Map | null = null;
  let markersLayer: L.LayerGroup | null = null;
  let resizeObserver: ResizeObserver | null = null;
  const CALI_BOUNDS: L.LatLngBoundsExpression = [[3.2800, -76.6300], [3.5900, -76.4300]];

  $: if (map && filteredReportes) {
    updateMarkers();
  }

  onMount(() => {
    initMap();
    resizeObserver = new ResizeObserver(() => {
      if (map) {
        map.invalidateSize();
        // Refit only if no markers with custom bounds
        if (!markersLayer || (markersLayer as any).getLayers().length === 0) {
          map.fitBounds(CALI_BOUNDS, { animate: false });
        }
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

  function initMap() {
    // Inicializar mapa centrado en Cali, Colombia
    map = L.map(mapContainer, {
      center: [3.4516, -76.532],
      zoom: 12,
      zoomControl: true,
      attributionControl: false,
    });

    // Ajustar vista inicial al encuadre de Cali
    map.fitBounds(CALI_BOUNDS, { animate: false });

    // Agregar capa base
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '',
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

    // Colores por grupo
    const colorMap: Record<string, string> = {
      Cuadrilla: "#10b981",
      Vivero: "#3b82f6",
      Gobernanza: "#f59e0b",
      Ecosistemas: "#8b5cf6",
      UMATA: "#ef4444",
    };

    // Agregar marcadores para cada reporte
    filteredReportes.forEach((reporte) => {
      if (!reporte.coordinates_data || reporte.coordinates_data.length !== 2) {
        return;
      }

      const [lng, lat] = reporte.coordinates_data;
      const grupo = reporte.grupo || "Sin grupo";
      const color = colorMap[grupo] || "#6b7280";

      // Crear icono personalizado SVG con tamaño adaptado
      const isRecent = (() => {
        if (!reporte.fecha_registro) return false;
        const hace7 = new Date();
        hace7.setDate(hace7.getDate() - 7);
        return new Date(reporte.fecha_registro) >= hace7;
      })();

      const icon = L.divIcon({
        className: "custom-marker",
        html: `
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            ${isRecent ? `<circle cx="14" cy="14" r="13" fill="${color}" opacity="0.18"/>` : ""}
            <circle cx="14" cy="14" r="9" fill="${color}" opacity="0.9"/>
            <circle cx="14" cy="14" r="4" fill="white"/>
          </svg>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      // Construir detalle dinámico según grupo
      let detalleHtml = "";
      if (reporte.tipo_arbol) {
        detalleHtml += `<div><strong>Árbol:</strong> ${reporte.tipo_arbol}</div>`;
      }
      if (reporte.numero_individuos_intervenidos != null) {
        detalleHtml += `<div><strong>Individuos:</strong> ${reporte.numero_individuos_intervenidos}</div>`;
      }
      if (reporte.tipos_plantas) {
        const plantas = Object.entries(reporte.tipos_plantas)
          .map(([k, v]) => `${k} (${v})`)
          .join(", ");
        detalleHtml += `<div><strong>Plantas:</strong> ${plantas}</div>`;
      }
      if (reporte.cantidad_total_plantas != null) {
        detalleHtml += `<div><strong>Total plantas:</strong> ${reporte.cantidad_total_plantas}</div>`;
      }
      if (reporte.unidades_impactadas != null) {
        detalleHtml += `<div><strong>Unidades:</strong> ${reporte.unidades_impactadas}${reporte.unidad_medida ? " " + reporte.unidad_medida : ""}</div>`;
      }
      if (reporte.direccion) {
        detalleHtml += `<div><strong>Dir:</strong> ${reporte.direccion}</div>`;
      }

      const marker = L.marker([lat, lng], { icon })
        .bindPopup(
          `<div style="min-width:220px;font-family:system-ui,sans-serif;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:2px solid ${color}20;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></span>
              <strong style="color:${color};font-size:13px;">${reporte.tipo_intervencion || "Intervención"}</strong>
              <span style="font-size:11px;color:#94a3b8;margin-left:auto;">${grupo}</span>
            </div>
            <div style="font-size:12px;color:#334155;display:flex;flex-direction:column;gap:4px;">
              ${detalleHtml}
              <div style="color:#64748b;">
                📅 ${reporte.fecha_registro ? new Date(reporte.fecha_registro).toLocaleDateString("es-CO", {day:"2-digit",month:"short",year:"2-digit"}) : "Sin fecha"}
              </div>
              ${reporte.barrio_vereda || reporte.comuna_corregimiento ? `<div style="color:#475569;">🏘️ ${[reporte.barrio_vereda, reporte.comuna_corregimiento].filter(Boolean).join(' — ')}</div>` : reporte.direccion ? `<div style="color:#64748b;">📍 ${reporte.direccion}</div>` : ""}
              ${reporte.observaciones ? `<div style="margin-top:4px;padding:4px 6px;background:#f8fafc;border-radius:4px;font-size:11px;color:#475569;">${reporte.observaciones}</div>` : ""}
              ${(reporte.photos_uploaded ?? 0) > 0 ? `<div style="margin-top:4px;display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:#dbeafe;color:#1d4ed8;border-radius:999px;font-size:11px;font-weight:600;">📷 ${reporte.photos_uploaded} foto${reporte.photos_uploaded !== 1 ? "s" : ""}</div>` : ""}
            </div>
          </div>`,
          { maxWidth: 320, className: "custom-popup" },
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

<div bind:this={mapContainer} class="map-container"></div>

<style>
  .map-container {
    width: 100%;
    height: 100%;
    min-height: 400px;
  }

  :global(.custom-marker) {
    background: transparent !important;
    border: none !important;
  }

  :global(.custom-popup .leaflet-popup-content-wrapper) {
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    padding: 0;
  }

  :global(.custom-popup .leaflet-popup-content) {
    margin: 12px 14px;
  }
</style>
