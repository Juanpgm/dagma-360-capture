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
  let initialized = false;

  const CALI_CENTER: [number, number] = [3.4516, -76.532];
  const CALI_BOUNDS: L.LatLngBoundsExpression = [[3.2800, -76.6300], [3.5900, -76.4300]];
  const COLOR_MAP: Record<string, string> = {
    cuadrilla: "#10b981",
    vivero:    "#3b82f6",
    gobernanza:"#f59e0b",
    ecosistemas:"#8b5cf6",
    umata:     "#ef4444",
  };

  // Reactivo: cada vez que cambia filteredReportes, actualizamos marcadores y re-encuadramos
  $: if (map && initialized) {
    updateMarkers(true);
  }

  onMount(() => {
    initMap();
    resizeObserver = new ResizeObserver(() => {
      if (map) map.invalidateSize();
    });
    resizeObserver.observe(mapContainer);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    map?.remove();
    map = null;
  });

  function initMap() {
    map = L.map(mapContainer, {
      center: CALI_CENTER,
      zoom: 12,
      zoomControl: true,
      attributionControl: false,
    });

    map.fitBounds(CALI_BOUNDS, { animate: false });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "",
      maxZoom: 19,
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);

    // Botón personalizado para restablecer encuadre
    const ResetControl = L.Control.extend({
      onAdd() {
        const btn = L.DomUtil.create("button", "reset-view-btn");
        btn.title = "Restablecer vista";
        btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
        L.DomEvent.on(btn, "click", (e) => {
          L.DomEvent.stopPropagation(e);
          fitToData(true);
        });
        return btn;
      },
    });
    new ResetControl({ position: "topleft" }).addTo(map);

    initialized = true;
    updateMarkers(false);
  }

  function getColor(grupo: string): string {
    return COLOR_MAP[(grupo || "").toLowerCase()] ?? "#6b7280";
  }

  function buildPopupHtml(reporte: ReporteIntervencion, color: string): string {
    const grupo = reporte.grupo
      ? reporte.grupo.charAt(0).toUpperCase() + reporte.grupo.slice(1)
      : "Sin grupo";

    const fechaStr = reporte.fecha_registro
      ? new Date(reporte.fecha_registro).toLocaleDateString("es-CO", {
          day: "2-digit", month: "short", year: "numeric",
        })
      : "Sin fecha";

    // Ubicación: barrio + comuna o dirección
    const geoLine = (() => {
      const parts = [reporte.barrio_vereda, reporte.comuna_corregimiento].filter(Boolean);
      if (parts.length > 0) return `<div class="pp-geo">${parts.join(" · ")}</div>`;
      if (reporte.direccion)  return `<div class="pp-geo">${reporte.direccion}</div>`;
      return "";
    })();

    // Impacto principal
    let impactoHtml = "";
    if (reporte.numero_individuos_intervenidos != null)
      impactoHtml = `<div class="pp-impacto" style="color:${color}">${reporte.numero_individuos_intervenidos} <span>individuos</span></div>`;
    else if (reporte.cantidad_total_plantas != null)
      impactoHtml = `<div class="pp-impacto" style="color:${color}">${reporte.cantidad_total_plantas} <span>plantas</span></div>`;
    else if (reporte.unidades_impactadas != null)
      impactoHtml = `<div class="pp-impacto" style="color:${color}">${reporte.unidades_impactadas}${reporte.unidad_medida ? " <span>" + reporte.unidad_medida + "</span>" : ""}</div>`;

    // Detalle (especie / tipos)
    let detalleHtml = "";
    if (reporte.tipo_arbol)
      detalleHtml = `<div class="pp-detail">${reporte.tipo_arbol}</div>`;
    else if (reporte.tipos_plantas) {
      const lista = Object.entries(reporte.tipos_plantas).map(([k, v]) => `${k} (${v})`).join(", ");
      detalleHtml = `<div class="pp-detail">${lista}</div>`;
    }

    const obsHtml = reporte.observaciones
      ? `<div class="pp-obs">${reporte.observaciones}</div>` : "";

    const photosHtml = (reporte.photos_uploaded ?? 0) > 0
      ? `<span class="pp-photos">${reporte.photos_uploaded} foto${reporte.photos_uploaded !== 1 ? "s" : ""}</span>` : "";

    return `
      <div class="pp-wrap">
        <div class="pp-header" style="border-left:3px solid ${color}">
          <div class="pp-header-top">
            <span class="pp-grupo-pill" style="color:${color};background:${color}14;border-color:${color}28">${grupo}</span>
            <span class="pp-date">${fechaStr}</span>
          </div>
          <div class="pp-tipo">${reporte.tipo_intervencion || "Intervención"}</div>
        </div>
        <div class="pp-body">
          ${geoLine}
          ${detalleHtml}
          ${impactoHtml}
          ${obsHtml}
        </div>
        ${photosHtml ? `<div class="pp-footer">${photosHtml}</div>` : ""}
      </div>`;
  }

  function updateMarkers(animate: boolean) {
    if (!map || !markersLayer) return;
    markersLayer.clearLayers();

    const now = Date.now();

    filteredReportes.forEach((reporte) => {
      if (!reporte.coordinates_data || reporte.coordinates_data.length !== 2) return;

      const [lng, lat] = reporte.coordinates_data;
      const color = getColor(reporte.grupo ?? "");

      const ageMs = reporte.fecha_registro
        ? now - new Date(reporte.fecha_registro).getTime()
        : Infinity;
      const isRecent = ageMs < 7 * 86_400_000;   // últimos 7 días
      const isNew    = ageMs < 1 * 86_400_000;    // últimas 24 h → anillo pulsante

      const icon = L.divIcon({
        className: "custom-marker",
        html: `
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            ${isNew    ? `<circle cx="16" cy="16" r="15" fill="${color}" opacity="0.15" class="pulse-ring"/>` : ""}
            ${isRecent ? `<circle cx="16" cy="16" r="13" fill="${color}" opacity="0.12"/>` : ""}
            <circle cx="16" cy="16" r="10" fill="${color}" opacity="0.92"/>
            <circle cx="16" cy="16" r="4.5" fill="white"/>
          </svg>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

      L.marker([lat, lng], { icon })
        .bindPopup(buildPopupHtml(reporte, color), {
          maxWidth: 300,
          className: "custom-popup",
        })
        .addTo(markersLayer!);
    });

    fitToData(animate);
  }

  function fitToData(animate: boolean) {
    if (!map) return;

    const pts = filteredReportes
      .filter((r) => r.coordinates_data?.length === 2)
      .map((r) => [r.coordinates_data![1], r.coordinates_data![0]] as [number, number]);

    if (pts.length === 0) {
      // Sin datos: volver a encuadre de Cali
      if (animate) {
        map.flyToBounds(CALI_BOUNDS, { duration: 0.8, maxZoom: 13 });
      } else {
        map.fitBounds(CALI_BOUNDS, { animate: false });
      }
      return;
    }

    if (pts.length === 1) {
      // Un solo punto: zoom fijo para no acercar demasiado
      if (animate) {
        map.flyTo(pts[0], 14, { duration: 0.8 });
      } else {
        map.setView(pts[0], 14, { animate: false });
      }
      return;
    }

    // Varios puntos
    const bounds = L.latLngBounds(pts);
    const pad: [number, number] = [48, 48];

    if (animate) {
      map.flyToBounds(bounds, { padding: pad, maxZoom: 15, duration: 0.9 });
    } else {
      map.fitBounds(bounds, { padding: pad, maxZoom: 15, animate: false });
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

  /* ── Botón reset ── */
  :global(.reset-view-btn) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    background: white;
    border: 1px solid #c8d3de;
    border-radius: 4px;
    cursor: pointer;
    color: #334155;
    box-shadow: 0 1px 5px rgba(0,0,0,0.2);
    padding: 0;
    margin-top: 6px;
    transition: background 0.15s;
  }
  :global(.reset-view-btn:hover) { background: #f0f4f8; }

  /* ── Popup ── */
  :global(.custom-popup .leaflet-popup-content-wrapper) {
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
    padding: 0;
    overflow: hidden;
    border: 1px solid #e9eef4;
  }
  :global(.custom-popup .leaflet-popup-content) {
    margin: 0;
    width: auto !important;
  }
  :global(.custom-popup .leaflet-popup-tip-container) {
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.08));
  }
  :global(.pp-wrap) {
    font-family: system-ui, sans-serif;
    font-size: 12px;
    color: #1e293b;
    min-width: 200px;
    max-width: 260px;
  }
  :global(.pp-header) {
    padding: 10px 14px 9px;
    background: #fafbfd;
    border-bottom: 1px solid #edf0f5;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  :global(.pp-header-top) {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  :global(.pp-grupo-pill) {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 2px 7px;
    border-radius: 999px;
    border: 1px solid;
  }
  :global(.pp-date) {
    font-size: 10.5px;
    color: #94a3b8;
    margin-left: auto;
    white-space: nowrap;
  }
  :global(.pp-tipo) {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.3;
  }
  :global(.pp-body) {
    padding: 9px 14px 11px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  :global(.pp-geo) {
    font-size: 11.5px;
    color: #334155;
    font-weight: 500;
  }
  :global(.pp-detail) {
    font-size: 11.5px;
    color: #64748b;
  }
  :global(.pp-impacto) {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.2;
  }
  :global(.pp-impacto span) {
    font-size: 11px;
    font-weight: 400;
    color: #64748b;
  }
  :global(.pp-obs) {
    font-size: 11px;
    color: #64748b;
    line-height: 1.4;
    padding: 5px 8px;
    background: #f8fafc;
    border-radius: 5px;
  }
  :global(.pp-footer) {
    padding: 6px 14px 9px;
    border-top: 1px solid #f1f5f9;
  }
  :global(.pp-photos) {
    font-size: 10.5px;
    font-weight: 600;
    color: #3b82f6;
    background: #dbeafe;
    padding: 2px 8px;
    border-radius: 999px;
  }

  /* ── Anillo pulsante para marcadores nuevos (<24 h) ── */
  @keyframes pulse-map {
    0%, 100% { opacity: 0.12; }
    50%       { opacity: 0.32; }
  }
  :global(.custom-marker .pulse-ring) {
    animation: pulse-map 2s ease-in-out infinite;
  }
</style>
