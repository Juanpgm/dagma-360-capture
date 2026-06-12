<script lang="ts">
  /**
   * CoordsEditorModal — Edición manual de coordenadas (Bug #5)
   *
   * Reutiliza el stack de mapa del dashboard (`leaflet` bundleado, CartoCDN
   * para vista clara), añade capa satelital (Esri World Imagery), muestra el
   * marcador original como referencia (rojo, no movible) y un crosshair / mira
   * draggable para que el usuario ajuste con precisión.
   */
  import { onDestroy, onMount, tick } from "svelte";
  import L from "leaflet";
  import "leaflet/dist/leaflet.css";
  import Button from "../ui/Button.svelte";
  import type { Coordenadas } from "../../types/visitas";

  export let open = false;
  export let coordenadas: Coordenadas | undefined = undefined;
  export let onClose: () => void = () => {};
  export let onSave: (next: Coordenadas) => void = () => {};

  // Default ~ Cali (Plaza de Caycedo) cuando no hay coords.
  const DEFAULT_LAT = 3.4516;
  const DEFAULT_LNG = -76.532;

  // Tiles
  const BASEMAPS = {
    map: {
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      maxZoom: 19,
      label: "Mapa",
      attribution: "&copy; OpenStreetMap, &copy; CARTO",
    },
    satelital: {
      // Esri World Imagery — sin API key, uso público con attribution.
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      maxZoom: 19,
      label: "Satélite",
      attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics",
    },
  } as const;
  type BasemapKey = keyof typeof BASEMAPS;

  let latStr = "";
  let lngStr = "";
  let latError = "";
  let lngError = "";
  let mapError = "";
  let mapReady = false;
  let mapEl: HTMLDivElement | null = null;
  let mapInstance: L.Map | null = null;
  let crosshairMarker: L.Marker | null = null;
  let originalMarker: L.Marker | null = null;
  let tileLayer: L.TileLayer | null = null;
  let currentBasemap: BasemapKey = "map";
  let originalLat: number | null = null;
  let originalLng: number | null = null;
  let online = typeof navigator !== "undefined" ? navigator.onLine : true;
  let chipExpanded = false;
  let hasInitialCoords = false;
  let _prevOpen = false; // guard: only re-init when open transitions false→true

  // ── Sync inputs con coords al abrir + recordar el punto original ──
  $: if (open && !_prevOpen) {
    _prevOpen = true;
    const has = coordenadas?.latitude != null && coordenadas?.longitude != null;
    hasInitialCoords = !!has;
    const lat = has ? (coordenadas!.latitude as number) : DEFAULT_LAT;
    const lng = has ? (coordenadas!.longitude as number) : DEFAULT_LNG;
    latStr = lat.toFixed(6);
    lngStr = lng.toFixed(6);
    latError = "";
    lngError = "";
    if (has && (originalLat === null || originalLng === null)) {
      originalLat = lat;
      originalLng = lng;
    }
  }
  $: if (!open) {
    // Permitir capturar de nuevo el "original" la próxima vez que se abra.
    _prevOpen = false;
    originalLat = null;
    originalLng = null;
    chipExpanded = false;
  }

  // ── Iconos custom (sin depender de los PNGs default de Leaflet) ──
  function buildCrosshairIcon(): L.DivIcon {
    const svg = `
      <div class="ch-wrap">
        <svg viewBox="0 0 64 64" width="48" height="48" aria-hidden="true">
          <circle cx="32" cy="32" r="22" fill="rgba(5,150,105,0.10)" stroke="#059669" stroke-width="2.5"/>
          <circle cx="32" cy="32" r="4" fill="#059669"/>
          <line x1="32" y1="2" x2="32" y2="16" stroke="#059669" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="32" y1="48" x2="32" y2="62" stroke="#059669" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="2" y1="32" x2="16" y2="32" stroke="#059669" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="48" y1="32" x2="62" y2="32" stroke="#059669" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </div>`;
    return L.divIcon({
      className: "coords-crosshair",
      html: svg,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
  }
  function buildOriginIcon(): L.DivIcon {
    const svg = `
      <div class="og-wrap">
        <svg viewBox="0 0 24 24" width="22" height="28" aria-hidden="true">
          <path d="M12 0c-5 0-9 4-9 9 0 6.5 9 15 9 15s9-8.5 9-15c0-5-4-9-9-9z" fill="#dc2626" stroke="#7f1d1d" stroke-width="1.2"/>
          <circle cx="12" cy="9" r="3" fill="#fff"/>
        </svg>
      </div>`;
    return L.divIcon({
      className: "coords-origin",
      html: svg,
      iconSize: [22, 28],
      iconAnchor: [11, 26],
    });
  }

  // ── Validación ──
  function parseLat(s: string): number | null {
    const n = parseFloat(String(s).replace(",", "."));
    if (isNaN(n) || n < -90 || n > 90) return null;
    return n;
  }
  function parseLng(s: string): number | null {
    const n = parseFloat(String(s).replace(",", "."));
    if (isNaN(n) || n < -180 || n > 180) return null;
    return n;
  }

  function onLatInput() {
    latError = parseLat(latStr) === null ? "Latitud inválida (-90 a 90)" : "";
    syncMarkerFromInputs();
  }
  function onLngInput() {
    lngError = parseLng(lngStr) === null ? "Longitud inválida (-180 a 180)" : "";
    syncMarkerFromInputs();
  }

  function syncMarkerFromInputs() {
    if (!crosshairMarker || !mapInstance) return;
    const lat = parseLat(latStr);
    const lng = parseLng(lngStr);
    if (lat === null || lng === null) return;
    crosshairMarker.setLatLng([lat, lng]);
    // No panTo aquí: mover el marcador es suficiente mientras se escribe.
    // El pan al nuevo punto se hace solo cuando el input pierde el foco (onLatBlur/onLngBlur).
  }

  function panToMarker() {
    if (!crosshairMarker || !mapInstance) return;
    const lat = parseLat(latStr);
    const lng = parseLng(lngStr);
    if (lat === null || lng === null) return;
    mapInstance.setView([lat, lng], mapInstance.getZoom(), { animate: false });
  }

  function onLatBlur() { panToMarker(); }
  function onLngBlur() { panToMarker(); }

  function setBasemap(key: string) {
    const k = key as BasemapKey;
    if (!mapInstance) {
      currentBasemap = k;
      return;
    }
    if (tileLayer) {
      try { mapInstance.removeLayer(tileLayer); } catch (_) {}
    }
    const cfg = BASEMAPS[k];
    const opts: L.TileLayerOptions = {
      maxZoom: cfg.maxZoom,
      attribution: cfg.attribution,
    };
    if (k === "map") {
      (opts as any).subdomains = "abcd";
    }
    tileLayer = L.tileLayer(cfg.url, opts).addTo(mapInstance);
    currentBasemap = k;
  }

  function recenterOnOriginal() {
    if (!mapInstance || originalLat === null || originalLng === null) return;
    mapInstance.setView([originalLat, originalLng], 18, { animate: true });
    if (crosshairMarker) {
      crosshairMarker.setLatLng([originalLat, originalLng]);
      latStr = originalLat.toFixed(6);
      lngStr = originalLng.toFixed(6);
      latError = "";
      lngError = "";
    }
  }

  async function initMap() {
    if (!mapEl) return;
    if (!online) {
      mapError = "Sin conexión: usa los campos numéricos.";
      return;
    }
    await tick();
    const lat = parseLat(latStr) ?? DEFAULT_LAT;
    const lng = parseLng(lngStr) ?? DEFAULT_LNG;
    const initialZoom = hasInitialCoords ? 18 : 12;

    mapInstance = L.map(mapEl, {
      zoomControl: true,
      attributionControl: false,
      doubleClickZoom: false,
      keyboard: false,   // evita que Leaflet robe el foco de los inputs de texto
    }).setView([lat, lng], initialZoom);
    mapInstance.zoomControl.setPosition("bottomright");

    setBasemap(currentBasemap);

    // Forzar relayout después del primer paint y del segundo (animación del modal).
    requestAnimationFrame(() => mapInstance && mapInstance.invalidateSize());
    setTimeout(() => mapInstance && mapInstance.invalidateSize(), 150);
    setTimeout(() => mapInstance && mapInstance.invalidateSize(), 400);

    if (originalLat !== null && originalLng !== null) {
      originalMarker = L.marker([originalLat, originalLng], {
        icon: buildOriginIcon(),
        interactive: true,
        keyboard: false,
        zIndexOffset: 100,
      }).addTo(mapInstance);
      originalMarker.bindTooltip("Posición original (GPS)", {
        direction: "top",
        offset: [0, -22],
        className: "coords-tooltip",
      });
    }

    crosshairMarker = L.marker([lat, lng], {
      icon: buildCrosshairIcon(),
      draggable: true,
      autoPan: true,
      zIndexOffset: 1000,
    }).addTo(mapInstance);

    crosshairMarker.on("drag", () => {
      const pos = crosshairMarker!.getLatLng();
      latStr = pos.lat.toFixed(6);
      lngStr = pos.lng.toFixed(6);
    });
    crosshairMarker.on("dragend", () => {
      latError = "";
      lngError = "";
    });
    crosshairMarker.on("dblclick", (ev: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(ev as any);
      handleSave();
    });

    mapInstance.on("click", (ev: L.LeafletMouseEvent) => {
      crosshairMarker!.setLatLng(ev.latlng);
      latStr = ev.latlng.lat.toFixed(6);
      lngStr = ev.latlng.lng.toFixed(6);
      latError = "";
      lngError = "";
    });
    mapInstance.on("dblclick", (ev: L.LeafletMouseEvent) => {
      // Doble-click sobre el mapa = fijar punto + guardar.
      crosshairMarker!.setLatLng(ev.latlng);
      latStr = ev.latlng.lat.toFixed(6);
      lngStr = ev.latlng.lng.toFixed(6);
      latError = "";
      lngError = "";
      handleSave();
    });

    setTimeout(() => mapInstance && mapInstance.invalidateSize(), 100);
    setTimeout(() => mapInstance && mapInstance.invalidateSize(), 500);
    mapReady = true;
  }

  function teardownMap() {
    try { mapInstance?.remove(); } catch (_) {}
    mapInstance = null;
    crosshairMarker = null;
    originalMarker = null;
    tileLayer = null;
    mapReady = false;
  }

  $: if (open && mapEl && !mapInstance) {
    initMap();
  }
  $: if (!open && mapInstance) {
    teardownMap();
  }

  onMount(() => {
    const handler = () => {
      online = navigator.onLine;
    };
    window.addEventListener("online", handler);
    window.addEventListener("offline", handler);
    return () => {
      window.removeEventListener("online", handler);
      window.removeEventListener("offline", handler);
    };
  });

  onDestroy(() => {
    teardownMap();
  });

  function handleCancel() {
    open = false;
    onClose();
  }

  function handleSave() {
    const lat = parseLat(latStr);
    const lng = parseLng(lngStr);
    if (lat === null) {
      latError = "Latitud inválida (-90 a 90)";
      return;
    }
    if (lng === null) {
      lngError = "Longitud inválida (-180 a 180)";
      return;
    }
    const next: Coordenadas = {
      latitude: lat,
      longitude: lng,
      accuracy: undefined,
      timestamp: Date.now(),
      source: "manual",
      manuallyEdited: true,
    };
    onSave(next);
    open = false;
  }
</script>

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" on:click={handleCancel}></div>
  <div class="modal" role="dialog" aria-modal="true" aria-label="Editar coordenadas">
    <button class="btn-close" type="button" on:click={handleCancel} aria-label="Cerrar">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>

    <div class="map-wrap">
      <div class="map" bind:this={mapEl}></div>
      {#if !mapReady && !mapError}
        <div class="map-loading">Cargando mapa…</div>
      {/if}
      {#if mapError}
        <div class="map-loading map-err">{mapError}</div>
      {/if}

      <!-- Chip de coordenadas (overlay minimalista) -->
      <div class="coords-chip" class:expanded={chipExpanded}>
        {#if !chipExpanded}
          <button type="button" class="chip-display" on:click={() => (chipExpanded = true)} title="Click: editar  ·  Doble-click en el mapa: aplicar">
            <span class="chip-dot"></span>
            <span class="chip-coords">{latStr}, {lngStr}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
        {:else}
          <div class="chip-edit">
            <div class="chip-field">
              <label for="coords-lat">Lat</label>
              <input id="coords-lat" type="text" inputmode="decimal" autocomplete="off"
                bind:value={latStr} on:input={onLatInput} on:blur={onLatBlur}
                class:has-error={!!latError} placeholder="3.451600" />
            </div>
            <div class="chip-field">
              <label for="coords-lng">Lng</label>
              <input id="coords-lng" type="text" inputmode="decimal" autocomplete="off"
                bind:value={lngStr} on:input={onLngInput} on:blur={onLngBlur}
                class:has-error={!!lngError} placeholder="-76.532000" />
            </div>
            <button type="button" class="chip-collapse" on:click={() => (chipExpanded = false)} aria-label="Cerrar editor">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
          </div>
          {#if latError || lngError}
            <span class="chip-err">{latError || lngError}</span>
          {/if}
        {/if}
      </div>

      <!-- Controles flotantes top-right -->
      <div class="map-controls">
        <div class="basemap-toggle" role="group" aria-label="Tipo de mapa">
          {#each Object.entries(BASEMAPS) as [key, cfg]}
            <button type="button" class:active={currentBasemap === key}
              on:click={() => setBasemap(key)} title={cfg.label}>
              {cfg.label}
            </button>
          {/each}
        </div>
        {#if originalLat !== null}
          <button type="button" class="icon-btn" on:click={recenterOnOriginal} title="Volver al punto GPS original">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
        {/if}
      </div>
    </div>

    <div class="modal-footer">
      <Button variant="outline" size="sm" onClick={handleCancel}>Cancelar</Button>
      <Button size="sm" onClick={handleSave}
        disabled={!!latError || !!lngError}>Guardar coordenadas</Button>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 1100;
  }
  .modal {
    position: fixed;
    z-index: 1101;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(820px, 96vw);
    height: min(78vh, 720px);
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .btn-close {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 800;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #e2e8f0;
    cursor: pointer;
    color: #334155;
    padding: 6px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    box-shadow: 0 2px 6px rgba(0,0,0,0.12);
    transition: background 120ms;
  }
  .btn-close:hover { background: #f1f5f9; }

  .map-wrap {
    position: relative;
    flex: 1 1 auto;
    min-height: 420px;
    background: #f8fafc;
  }
  .map { width: 100%; height: 100%; min-height: 420px; }
  .map-loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    font-size: 0.85rem;
    background: rgba(248, 250, 252, 0.85);
    pointer-events: none;
    z-index: 700;
  }
  .map-err { color: #b45309; }

  /* ── Chip de coordenadas (bottom-left overlay) ── */
  .coords-chip {
    position: absolute;
    left: 12px;
    bottom: 12px;
    z-index: 750;
    max-width: calc(100% - 24px);
  }
  .chip-display {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    cursor: pointer;
    font-size: 0.78rem;
    color: #0f172a;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    transition: background 120ms;
  }
  .chip-display:hover { background: #fff; border-color: #94a3b8; }
  .chip-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #059669;
    box-shadow: 0 0 0 2px rgba(5,150,105,0.25);
  }
  .chip-coords { letter-spacing: -0.02em; }
  .chip-display svg { color: #64748b; }

  .chip-edit {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px 6px 10px;
    background: rgba(255, 255, 255, 0.98);
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.18);
  }
  .chip-field { display: inline-flex; align-items: center; gap: 4px; }
  .chip-field label {
    font-size: 0.7rem;
    color: #64748b;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .chip-field input {
    width: 96px;
    padding: 4px 6px;
    border: 1px solid #cbd5e1;
    border-radius: 5px;
    font-size: 0.78rem;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    background: #fff;
  }
  .chip-field input:focus { outline: 2px solid #059669; outline-offset: 0; }
  .chip-field input.has-error { border-color: #dc2626; }
  .chip-collapse {
    background: transparent;
    border: 0;
    padding: 4px;
    cursor: pointer;
    color: #64748b;
    border-radius: 5px;
    display: grid;
    place-items: center;
  }
  .chip-collapse:hover { background: #f1f5f9; color: #0f172a; }
  .chip-err {
    display: block;
    margin-top: 4px;
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fecaca;
    border-radius: 6px;
    padding: 3px 8px;
    font-size: 0.7rem;
  }

  /* ── Controles flotantes top-right ── */
  .map-controls {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 750;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .basemap-toggle {
    display: inline-flex;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(255,255,255,0.96);
    box-shadow: 0 2px 6px rgba(0,0,0,0.12);
  }
  .basemap-toggle button {
    padding: 6px 11px;
    background: transparent;
    border: 0;
    cursor: pointer;
    font-size: 0.74rem;
    font-weight: 500;
    color: #475569;
    border-right: 1px solid #e2e8f0;
    transition: background 120ms;
  }
  .basemap-toggle button:last-child { border-right: 0; }
  .basemap-toggle button:hover { background: #f1f5f9; }
  .basemap-toggle button.active {
    background: #059669;
    color: #fff;
    font-weight: 600;
  }
  .icon-btn {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 1px solid #e2e8f0;
    background: rgba(255,255,255,0.96);
    border-radius: 8px;
    cursor: pointer;
    color: #475569;
    box-shadow: 0 2px 6px rgba(0,0,0,0.12);
    transition: background 120ms;
  }
  .icon-btn:hover { background: #f1f5f9; color: #0f172a; }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    padding: 0.7rem 1rem;
    border-top: 1px solid #e2e8f0;
    background: #fff;
  }

  /* Iconos custom — global para que Leaflet los inyecte sin scope. */
  :global(.coords-crosshair) {
    background: transparent !important;
    border: 0 !important;
  }
  :global(.coords-crosshair .ch-wrap) {
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));
    cursor: grab;
  }
  :global(.coords-crosshair:active .ch-wrap) { cursor: grabbing; }

  :global(.coords-origin) {
    background: transparent !important;
    border: 0 !important;
  }
  :global(.coords-origin .og-wrap) {
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));
  }
  :global(.coords-tooltip) {
    background: rgba(15,23,42,0.92) !important;
    color: #fff !important;
    border: 0 !important;
    border-radius: 4px !important;
    padding: 3px 8px !important;
    font-size: 0.72rem !important;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important;
  }
  :global(.coords-tooltip::before) { display: none !important; }

  /* Leaflet zoom control re-skin para que combine con el chip. */
  :global(.leaflet-control-zoom) {
    border: 1px solid #e2e8f0 !important;
    box-shadow: 0 2px 6px rgba(0,0,0,0.12) !important;
  }
  :global(.leaflet-control-zoom a) {
    background: rgba(255,255,255,0.96) !important;
    color: #475569 !important;
  }

  @media (max-width: 640px) {
    .modal { width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0; }
    .chip-field input { width: 82px; font-size: 0.74rem; }
    .basemap-toggle button { padding: 5px 9px; font-size: 0.72rem; }
  }
</style>
