# Reverse Engineering: Dashboard de Visualización de Mapas

**Source project:** dagma_360 — sistema de gestión de intervenciones ambientales urbanas (DAGMA, Cali, Colombia)
**Stack:** Svelte 4 + TypeScript + Vite 5 + Leaflet 1.9 + Chart.js 4 + Firebase Auth + FastAPI backend
**Document purpose:** Guía de replicación del módulo de visualización cartográfica y estadística del Dashboard
**Date:** 2026-06-04

---

## 1. Feature Overview

El Dashboard es un módulo de análisis geoespacial y estadístico que consume reportes de intervenciones ambientales (poda, siembra, restauración, etc.) registrados por grupos operativos de campo. Presenta dos vistas de mapa complementarias —**mapa de puntos** con marcadores por intervención y **mapa coroplético** con densidad de calor por zona administrativa— junto con KPIs de gestión, gráficas Chart.js y una tabla paginada. Todo el sistema es reactivo: cada filtro (texto, tipo, grupo, fechas, comuna, barrio) recalcula simultáneamente las métricas, los mapas y los gráficos sin llamadas adicionales al backend.

Los datos se cargan en `onMount` haciendo requests paralelos a todos los grupos operativos. Los usuarios con rol `administrador`/`director`/`desarrollador` ven todos los grupos; roles menores solo ven su propio grupo.

---

## 2. Architecture & File Map

### Frontend

| Archivo | Rol |
|---------|-----|
| `src/components/dashboard/Dashboard.svelte` | Orquestador principal: filtros, KPIs, charts, layout, datos |
| `src/components/dashboard/MapaIntervenciones.svelte` | Mapa Leaflet de puntos con marcadores SVG custom |
| `src/components/dashboard/MapaCoropletico.svelte` | Mapa Leaflet coroplético con coloreado por conteo por área |
| `src/components/dashboard/KPICard.svelte` | Tarjeta de indicador (título, valor, subtítulo, trend) |
| `src/components/dashboard/DashboardReportesList.svelte` | Lista paginada de reportes (load-more, 24 items/página) |
| `src/api/visitas.ts` | Tipos `ReporteIntervencion`, función `obtenerReportes()`, `normalizeReporte()` |
| `src/lib/grupos.ts` | `GRUPO_KEYS`, `normalizeGrupo()`, `gruposMatch()`, `GRUPO_DISPLAY_NAMES` |
| `src/lib/api-client.ts` | `ApiClient` con auth automática JWT, dedup de inflight, cache TTL |
| `src/stores/authStore.ts` | Estado de autenticación, store derivado `permissions` |
| `src/lib/permissions.ts` | `canSeeAllGroups()`, `buildPermissions()`, jerarquía de roles |

### Assets públicos

| Archivo | Rol |
|---------|-----|
| `public/cartografia_base/comunas_corregimientos.geojson` | GeoJSON con polígonos de comunas/corregimientos de Cali |
| `public/cartografia_base/barrios_veredas.geojson` | GeoJSON con polígonos de barrios/veredas de Cali |

---

## 3. Dependencies & Configuration

### Paquetes requeridos

**Frontend:**
- `leaflet@^1.9.4` — motor de mapas interactivos (render de tiles, GeoJSON, marcadores, popups)
- `@types/leaflet@^1.9.21` — tipos TypeScript para Leaflet
- `chart.js@^4.5.1` — biblioteca de gráficas (Bar, Line, Doughnut)
- `svelte-chartjs@^3.1.5` — wrapper Svelte para Chart.js (componentes `<Bar>`, `<Line>`, `<Doughnut>`)
- `firebase@^12.6.0` — solo para autenticación; el ID token se usa para todas las llamadas al backend

### Variables de entorno

| Variable | Propósito | Ejemplo |
|----------|-----------|---------|
| `VITE_API_BASE_URL` | URL base de la API (con `/api` al final o sin path) | `https://api.example.com/api` o `/api` |

> Si `VITE_API_BASE_URL` no está definida, se asume `/api` (proxy local de Vite). El cliente resuelve rutas relativas automáticamente sin doble prefijo.

### Imports CSS de Leaflet

Leaflet requiere su CSS importado explícitamente **en cada componente que use `L.map()`**:

```typescript
import "leaflet/dist/leaflet.css";
```

---

## 4. Data Models

### `ReporteIntervencion` (TypeScript — `src/api/visitas.ts`)

```typescript
export interface ReporteIntervencion {
  id: string;
  registrado_por: string | null;
  grupo: string | null;                    // clave canónica lowercase: "cuadrilla", "vivero", etc.
  observaciones: string;
  coordinates?: {
    type: string;
    coordinates: string;                   // raw: "[lng, lat]" o "lng lat"
  };
  tipo_intervencion: string;
  id_actividad: string | null;
  descripcion_intervencion: string | null;
  timestamp: string;                       // ISO 8601
  photos_uploaded: number;
  photosUrl: string[];
  barrio_vereda: string;
  comuna_corregimiento: string;
  tipo_arbol?: string | null;
  numero_individuos_intervenidos?: number | null;   // cuadrilla
  tipos_plantas?: Record<string, number> | null;    // vivero
  cantidad_total_plantas?: number | null;           // vivero
  unidades_impactadas?: number | null;              // gobernanza/umata/ecosistemas
  unidad_medida?: string | null;
  direccion?: string | null;
  documentos_con_enlaces?: Array<{...}>;   // presigned URLs de S3
  numero_registro?: number;

  // Campos normalizados (añadidos por `normalizeReporte()`)
  coordinates_data?: [number, number];     // [lng, lat] — coordenadas parseadas
  fecha_registro?: string;                 // alias de `timestamp`
  comuna?: string;                         // alias de `comuna_corregimiento`
  barrio?: string;                         // alias de `barrio_vereda`
}
```

### Paleta de colores por grupo

Esta paleta es compartida entre `Dashboard.svelte`, `MapaIntervenciones.svelte` y `DashboardReportesList.svelte`. Debe estar sincronizada en todos los sitios:

```typescript
const COLOR_MAP: Record<string, string> = {
  cuadrilla:   "#10b981",   // verde esmeralda
  vivero:      "#3b82f6",   // azul
  gobernanza:  "#f59e0b",   // ámbar
  ecosistemas: "#8b5cf6",   // violeta
  umata:       "#ef4444",   // rojo
};
// Fallback para grupos desconocidos: "#6b7280" (gris)
```

### Estructura GeoJSON (propiedades esperadas por `MapaCoropletico`)

Las features del GeoJSON deben tener propiedades que coincidan con los campos del reporte:

```json
// comunas_corregimientos.geojson — cada feature tiene:
{
  "type": "Feature",
  "properties": {
    "comuna_corregimiento": "COMUNA 1"   // nombre en MAYÚSCULAS
  },
  "geometry": { "type": "Polygon", "coordinates": [...] }
}

// barrios_veredas.geojson — cada feature tiene:
{
  "type": "Feature",
  "properties": {
    "barrio_vereda": "NOMBRE BARRIO"     // nombre en MAYÚSCULAS
  },
  "geometry": { "type": "Polygon", "coordinates": [...] }
}
```

> **Crítico:** El matching entre el campo de cada reporte y la propiedad del GeoJSON se hace via `normalizeAreaName()` que hace `.trim().toUpperCase()`. El campo `reporte.comuna_corregimiento` puede llegar en cualquier capitalización desde el backend; el nombre en el GeoJSON debe estar en MAYÚSCULAS para que el matching funcione.

---

## 5. API Contract

### GET `/grupos/{grupoKey}/reportes_intervenciones`

**Auth:** Bearer JWT (Firebase ID token)
**Params:** `grupoKey` = uno de `cuadrilla|vivero|gobernanza|ecosistemas|umata`

**Query params opcionales:**
- `id`: filtrar por ID de reporte
- `id_actividad`: filtrar por actividad
- `grupo`: filtrar por grupo (redundante con el path pero soportado)

**Response (200):**
```json
{
  "success": true,
  "total": 45,
  "data": [
    {
      "id": "abc123",
      "grupo": "cuadrilla",
      "tipo_intervencion": "Poda",
      "timestamp": "2026-05-15T10:30:00Z",
      "coordinates": { "type": "Point", "coordinates": [-76.532, 3.4516] },
      "barrio_vereda": "EL GUABAL",
      "comuna_corregimiento": "COMUNA 15",
      "numero_individuos_intervenidos": 3,
      "tipo_arbol": "Ceiba",
      "registrado_por": "Juan Pérez",
      "photos_uploaded": 2
    }
  ]
}
```

El Dashboard llama este endpoint en paralelo para cada grupo en `GRUPO_KEYS` usando `Promise.allSettled()`. Fallos individuales se ignoran; solo se muestra error si el resultado total es vacío.

---

## 6. Core Business Logic

### 6.1 Carga de datos con RBAC

```typescript
async function cargarReportes() {
  const userGrupo = $authStore.user?.grupo?.toLowerCase() ?? '';
  
  // Admins/directores/devs ven todos los grupos; líderes/operadores solo el suyo
  const keysToFetch = $permissions.canSeeAllGroups
    ? GRUPO_KEYS
    : GRUPO_KEYS.filter((k) => k === userGrupo);
  
  // Carga paralela tolerante a fallos
  const resultados = await Promise.allSettled(
    keysToFetch.map((key) => obtenerReportes(key))
  );
  
  let todos: ReporteIntervencion[] = [];
  resultados.forEach((r) => {
    if (r.status === "fulfilled" && r.value?.data) {
      todos = [...todos, ...r.value.data];
    }
  });
  
  reportes = todos;
}
```

**`$permissions.canSeeAllGroups`** es `true` si el rol del usuario tiene nivel ≥ 3 (`administrador` o superior). Se calcula en `buildPermissions()` usando `canSeeAllGroups(user)` de `src/lib/permissions.ts`.

### 6.2 Normalización de coordenadas (`normalizeReporte`)

El campo `coordinates.coordinates` del backend puede llegar como array JSON o como string `"lng lat"`. `normalizeReporte()` lo unifica a `coordinates_data: [lng, lat]`:

```typescript
function normalizeReporte(reporte: ReporteIntervencion): ReporteIntervencion {
  let coordinates_data: [number, number] = [-76.532, 3.4516];  // fallback Cali
  if (reporte.coordinates?.coordinates) {
    const val = reporte.coordinates.coordinates as unknown;
    if (Array.isArray(val) && val.length === 2) {
      coordinates_data = [Number(val[0]), Number(val[1])];
    } else if (typeof val === 'string') {
      const parts = val.split(' ');
      if (parts.length === 2) {
        coordinates_data = [parseFloat(parts[0]), parseFloat(parts[1])];
      }
    }
  }
  return {
    ...reporte,
    coordinates_data,
    fecha_registro: reporte.timestamp,
    comuna: reporte.comuna_corregimiento,
    barrio: reporte.barrio_vereda,
  };
}
```

> **Orden:** las coordenadas están en formato GeoJSON `[longitud, latitud]`. Leaflet espera `[latitud, longitud]`. La inversión se hace al crear marcadores: `const [lng, lat] = reporte.coordinates_data; L.marker([lat, lng])`.

### 6.3 Filtrado reactivo (Svelte `$:`)

Todos los filtros se aplican en un único bloque `$:` sin llamadas adicionales al backend:

```typescript
$: filteredReportes = reportes
  .filter((r) => {
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      const match = [r.tipo_arbol, r.descripcion_intervencion, r.observaciones,
                     r.registrado_por, r.direccion, r.tipo_intervencion,
                     r.barrio_vereda, r.comuna_corregimiento]
        .some(v => v?.toLowerCase().includes(t));
      if (!match) return false;
    }
    if (selectedTipoIntervencion !== "todos" && r.tipo_intervencion !== selectedTipoIntervencion) return false;
    if (selectedGrupo !== "todos" && r.grupo !== selectedGrupo) return false;
    if (selectedComuna !== "todas" && r.comuna_corregimiento !== selectedComuna) return false;
    if (selectedBarrio !== "todos" && r.barrio_vereda !== selectedBarrio) return false;
    if (dateFrom && r.fecha_registro && new Date(r.fecha_registro) < new Date(dateFrom)) return false;
    if (dateTo && r.fecha_registro) {
      const to = new Date(dateTo); to.setHours(23, 59, 59);
      if (new Date(r.fecha_registro) > to) return false;
    }
    return true;
  })
  .sort((a, b) => {
    const da = a.fecha_registro ? new Date(a.fecha_registro).getTime() : 0;
    const db = b.fecha_registro ? new Date(b.fecha_registro).getTime() : 0;
    return db - da;  // más reciente primero
  });
```

`filteredReportes` se pasa como prop a ambos mapas y a la lista. Cualquier cambio en los filtros reactualiza mapas, KPIs y gráficas automáticamente.

### 6.4 KPIs computados

Todos son `$:` derivados de `filteredReportes`:

| KPI | Cálculo |
|-----|---------|
| `totalIntervenciones` | `filteredReportes.length` |
| `comunasConIntervenciones` | `new Set(filteredReportes.map(r => r.comuna_corregimiento).filter(Boolean)).size` |
| `coberturaComuna` | `(comunasConIntervenciones / 37) * 100` — 37 = total comunas + corregimientos de Cali |
| `individuosIntervenidos` | `sum(r.numero_individuos_intervenidos)` |
| `totalPlantas` | `sum(r.cantidad_total_plantas)` |
| `areaImpactada` | `sum(r.unidades_impactadas)` donde exista `unidad_medida` |
| `intervencionesEstaSemana` | Count donde `fecha_registro >= hace7días` |
| `gruposActivos` | `new Set(filteredReportes.map(r => r.grupo).filter(Boolean)).size` |
| `promedioComuna` | `totalIntervenciones / comunasConIntervenciones` |

---

## 7. Frontend — Componentes de Mapa

### 7.1 `MapaIntervenciones.svelte` — Mapa de Puntos

**Props:**
```typescript
export let filteredReportes: ReporteIntervencion[] = [];
```

**Inicialización del mapa:**
```typescript
const CALI_CENTER: [number, number] = [3.4516, -76.532];
const CALI_BOUNDS: L.LatLngBoundsExpression = [[3.2800, -76.6300], [3.5900, -76.4300]];

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
```

> **Tile provider:** CartoDB Light — minimalista, no requiere API key. No usar OpenStreetMap estándar (términos de uso más restrictivos para producción).

**Marcadores SVG custom con indicadores de antigüedad:**
```typescript
const ageMs = reporte.fecha_registro ? Date.now() - new Date(reporte.fecha_registro).getTime() : Infinity;
const isRecent = ageMs < 7 * 86_400_000;   // últimos 7 días → anillo de fondo
const isNew    = ageMs < 1 * 86_400_000;   // últimas 24 h → anillo pulsante animado

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
```

El CSS de la animación pulsante debe declararse como `:global()` porque el SVG está en un `divIcon` fuera del scope de Svelte:
```css
@keyframes pulse-map {
  0%, 100% { opacity: 0.12; }
  50%       { opacity: 0.32; }
}
:global(.custom-marker .pulse-ring) {
  animation: pulse-map 2s ease-in-out infinite;
}
```

**Encuadre automático con `fitToData(animate: boolean)`:**
```typescript
function fitToData(animate: boolean) {
  const pts = filteredReportes
    .filter((r) => r.coordinates_data?.length === 2)
    .map((r) => [r.coordinates_data![1], r.coordinates_data![0]] as [number, number]);
    // ↑ invierte [lng,lat] → [lat,lng] que espera Leaflet

  if (pts.length === 0) {
    map.fitBounds(CALI_BOUNDS, { animate: false }); // volver a Cali
    return;
  }
  if (pts.length === 1) {
    map.setView(pts[0], 14, { animate: false });    // zoom fijo para un punto
    return;
  }
  // Varios puntos → ajustar con padding y zoom máximo para no acercar demasiado
  map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 15, animate: false });
}
```

**Botón custom de reset (`L.Control.extend`):**
```typescript
const ResetControl = L.Control.extend({
  onAdd() {
    const btn = L.DomUtil.create("button", "reset-view-btn");
    btn.title = "Restablecer vista";
    btn.innerHTML = `<svg ...>...</svg>`;
    L.DomEvent.on(btn, "click", (e) => {
      L.DomEvent.stopPropagation(e);
      fitToData(true);  // animate=true → usa flyToBounds/flyTo
    });
    return btn;
  },
});
new ResetControl({ position: "topleft" }).addTo(map);
```

**Popup HTML** construido en `buildPopupHtml()` — estructura:
```html
<div class="pp-wrap">
  <div class="pp-header" style="border-left:3px solid {color}">
    <div class="pp-header-top">
      <span class="pp-grupo-pill" style="color:{color}; background:{color}14; border-color:{color}28">{grupo}</span>
      <span class="pp-date">{fechaStr}</span>
    </div>
    <div class="pp-tipo">{tipo_intervencion}</div>
  </div>
  <div class="pp-body">
    {barrio · comuna | dirección}
    {tipo_arbol | tipos_plantas | unidad_medida}
    {numero_individuos | cantidad_plantas | unidades_impactadas}
    {observaciones?}
  </div>
  {#if photos_uploaded > 0}
    <div class="pp-footer">{N} fotos</div>
  {/if}
</div>
```

Todos los estilos del popup deben ser `:global()` o inline (el popup se renderiza fuera del componente Svelte).

**Reactivo:** `$: if (map && initialized) { updateMarkers(true); }` — se ejecuta automáticamente cada vez que `filteredReportes` cambia.

**Limpieza de memoria:**
```typescript
onDestroy(() => {
  resizeObserver?.disconnect();
  map?.remove();
  map = null;
});
```

**`ResizeObserver`** llama a `map.invalidateSize()` cuando el contenedor cambia de tamaño (columnas, tabs, responsive).

---

### 7.2 `MapaCoropletico.svelte` — Mapa de Densidad

**Props:**
```typescript
export let filteredReportes: ReporteIntervencion[] = [];
export let aggregationLevel: "comuna" | "barrio" = "comuna";
```

**Flujo de inicialización:**
1. `onMount` → `loadGeoJSON()` → `initMap()` con `updateChoropleth()` inicial
2. `$: if (aggregationLevel && map)` → recarga GeoJSON y recalcula colores al cambiar nivel
3. `$: if (map && geojsonData && filteredReportes)` → recalcula al cambiar filtros

**Carga dinámica de GeoJSON:**
```typescript
async function loadGeoJSON() {
  const filename = aggregationLevel === "comuna"
    ? "/cartografia_base/comunas_corregimientos.geojson"
    : "/cartografia_base/barrios_veredas.geojson";
  const response = await fetch(filename);
  geojsonData = await response.json();
}
```

Los archivos GeoJSON se sirven como assets estáticos desde `public/`.

**Inicialización del mapa (interacciones deshabilitadas — modo lectura):**
```typescript
map = L.map(mapContainer, {
  center: [3.4516, -76.532],
  zoom: 11,
  zoomControl: false,
  attributionControl: false,
  scrollWheelZoom: false,
  doubleClickZoom: false,
  touchZoom: false,
  dragging: false,     // coroplético es solo visualización, no interactivo
  boxZoom: false,
  keyboard: false,
});

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: '',
  maxZoom: 19,
  opacity: 0.3,        // tile muy tenue para destacar los polígonos
}).addTo(map);
```

**Normalización de nombres para matching:**
```typescript
function normalizeAreaName(name: string | null | undefined): string {
  if (!name) return "";
  return name.trim().toUpperCase();
}
```

**Agregación por área:**
```typescript
function calculateAggregations(): Map<string, number> {
  const counts = new Map<string, number>();
  filteredReportes.forEach((reporte) => {
    let areaName = aggregationLevel === "comuna"
      ? reporte.comuna_corregimiento
      : reporte.barrio_vereda;
    if (areaName) {
      const normalizedName = normalizeAreaName(areaName);
      counts.set(normalizedName, (counts.get(normalizedName) || 0) + 1);
    }
  });
  return counts;
}
```

**Escala de colores (verde progresivo):**
```typescript
function getColor(count: number): string {
  return count >= 8 ? "#064e3b"   // verde muy oscuro — 8+ intervenciones
    : count >= 6   ? "#059669"   // verde oscuro — 6-7
    : count >= 4   ? "#10b981"   // verde medio — 4-5
    : count >= 3   ? "#34d399"   // verde — 3
    : count >= 2   ? "#6ee7b7"   // verde claro — 2
    : count >= 1   ? "#a7f3d0"   // verde muy claro — 1
    :                "#f1f5f9";  // gris claro — sin intervenciones
}
```

**Estilo y eventos de la capa GeoJSON:**
```typescript
geojsonLayer = L.geoJSON(geojsonData, {
  style: (feature) => {
    const areaName = aggregationLevel === "comuna"
      ? feature?.properties?.comuna_corregimiento
      : feature?.properties?.barrio_vereda;
    const count = aggregations.get(normalizeAreaName(areaName)) || 0;
    return {
      fillColor: getColor(count),
      weight: 1,
      opacity: 1,
      color: "#64748b",      // borde de polígono gris pizarra
      fillOpacity: 0.7,
    };
  },
  onEachFeature: (feature, layer) => {
    // Popup con nombre del área y conteo
    layer.bindPopup(`
      <div style="font-size: 13px;">
        <strong>${areaName}</strong>
        <div><strong>Intervenciones:</strong> ${count}</div>
      </div>
    `, { maxWidth: 250 });

    layer.on({
      mouseover: highlightFeature,
      mouseout: resetHighlight,
    });
  },
}).addTo(map);
```

**Highlight en hover:**
```typescript
function highlightFeature(e: L.LeafletMouseEvent) {
  e.target.setStyle({ weight: 3, color: "#334155", fillOpacity: 0.9 });
  e.target.bringToFront();
}
function resetHighlight(e: L.LeafletMouseEvent) {
  geojsonLayer?.resetStyle(e.target);  // restaura estilo calculado original
}
```

---

### 7.3 Selector de vista de mapa (en `Dashboard.svelte`)

Los dos mapas viven bajo el mismo card pero se alternan con `activeMapView`:

```typescript
let activeMapView: "puntos" | "coropletico" = "coropletico";
let aggregationLevel: "comuna" | "barrio" = "comuna";
```

```html
<!-- Toggle de vista -->
<div class="map-view-tabs">
  <button class:active={activeMapView === "puntos"} on:click={() => activeMapView = "puntos"}>
    Puntos
  </button>
  <button class:active={activeMapView === "coropletico"} on:click={() => activeMapView = "coropletico"}>
    Coroplético
  </button>
</div>

<!-- Render condicional -->
<div class="map-body map-body-unified">
  {#if activeMapView === "puntos"}
    <MapaIntervenciones {filteredReportes} />
  {:else}
    <MapaCoropletico {filteredReportes} {aggregationLevel} />
  {/if}
</div>

<!-- Leyenda dinámica según vista activa -->
<div class="map-legend" class:choropleth-legend={activeMapView === "coropletico"}>
  {#if activeMapView === "puntos"}
    {#each [["Cuadrilla","#10b981"],["Vivero","#3b82f6"],["Gobernanza","#f59e0b"],["Ecosistemas","#8b5cf6"],["UMATA","#ef4444"]] as [g, c]}
      <span class="legend-item">
        <span class="legend-dot" style="background:{c}"></span>{g}
      </span>
    {/each}
  {:else}
    <span class="legend-label">Menor</span>
    {#each ["#f1f5f9","#a7f3d0","#6ee7b7","#34d399","#10b981","#059669","#064e3b"] as c}
      <span class="legend-swatch" style="background:{c}"></span>
    {/each}
    <span class="legend-label">Mayor</span>
  {/if}
</div>
```

---

## 8. Gráficas Chart.js

### 8.1 `<Line>` — Tendencia temporal por mes

```typescript
// Agrupación por mes (formato "YYYY-MM")
const byMonth: Record<string, number> = {};
filteredReportes.forEach((r) => {
  const d = r.fecha_registro ? new Date(r.fecha_registro) : null;
  if (!d || isNaN(d.getTime())) return;
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  byMonth[key] = (byMonth[key] || 0) + 1;
});

// Labels en español: "Ene '25", "Feb '25", ...
const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
```

Config del dataset:
```typescript
{
  fill: true,
  backgroundColor: "rgba(16, 185, 129, 0.12)",
  borderColor: "#059669",
  tension: 0.4,    // curva suavizada
}
```

### 8.2 `<Bar>` — Top tipos de intervención (barras horizontales)

```typescript
const tiposBarOptions = {
  indexAxis: "y" as const,  // barras horizontales
  // ...
  scales: {
    x: { beginAtZero: true },
    y: { ticks: { color: "#334155", font: { size: 12 } } },
  },
};
```

Top 8 tipos por frecuencia descendente, con 8 colores fijos distintos.

### 8.3 `<Doughnut>` — Distribución por grupo

```typescript
const donutOptions = {
  cutout: "65%",   // agujero grande → aspecto de dona
  plugins: {
    legend: { position: "bottom" },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const pct = ((ctx.raw / total) * 100).toFixed(1);
          return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
        },
      },
    },
  },
};
```

Los colores de los segmentos usan `getGrupoColor(label)` que hace partial-match del nombre del grupo.

### Registro de Chart.js

Se debe llamar una única vez en el componente raíz:
```typescript
import { Chart as ChartJS, registerables } from "chart.js";
ChartJS.register(...registerables);
```

---

## 9. `KPICard.svelte`

```typescript
export let title: string;
export let value: string | number;
export let subtitle: string = "";
export let trend: "up" | "down" | "neutral" | undefined = undefined;
export let trendValue: string | undefined = undefined;
export let color: string = "green";  // "green"|"blue"|"amber"|"purple"|"red"|"teal"|"indigo"
```

El color del borde izquierdo y el color del texto del valor se derivan de un mapa de CSS variables del design system. El componente usa `--text-accent` (CSS custom property) que se sobreescribe por instancia:

```html
<div class="kpi-card" style="--accent: {accent}; --text-accent: {textAccent};">
```

Requiere que el design system tenga definidas las variables: `--green-700`, `--blue-600`, `--amber-600`, `--purple-600`, `--red-600`, `--teal-600`, `--indigo-600`, `--green-50`, `--blue-50`, etc.

---

## 10. `DashboardReportesList.svelte` — Lista con load-more

```typescript
export let reportes: ReporteIntervencion[] = [];
const PAGE_SIZE = 24;
let visibleCount = PAGE_SIZE;

$: visible = reportes.slice(0, visibleCount);
$: hasMore = visibleCount < reportes.length;
$: if (reportes) visibleCount = PAGE_SIZE;  // reset al cambiar filtros
```

Muestra 24 tarjetas inicialmente; botón "Mostrar más" incrementa en 24. El reset reactivo (`$: if (reportes)`) asegura que un cambio de filtro vuelva a página 1.

Cada tarjeta muestra: grupo (pill de color), número de registro, fecha relativa ("Hoy", "Ayer", "Hace N días") + absoluta, tipo de intervención, detalle de especie/plantas, impacto numérico, ubicación y badge de fotos si aplica. Los registros de los últimos 7 días tienen un punto verde de "nuevo".

---

## 11. Layout CSS

```css
/* Grid principal: KPIs fijos a izquierda + mapa que crece */
.kpi-map-layout {
  display: grid;
  grid-template-columns: minmax(280px, 360px) 1fr;
  gap: var(--space-4);
  align-items: stretch;
}

/* El mapa ocupa todo el espacio disponible */
.map-side .map-card-unified {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.map-side .map-card-unified .map-body {
  flex: 1;
  min-height: 0;
}

/* Container del mapa — ambos MapaIntervenciones y MapaCoropletico */
.map-container {
  width: 100%;
  height: 100%;
  min-height: 400px;
}
```

> **Crítico:** El contenedor del mapa debe tener altura explícita o el mapa Leaflet se renderiza con altura 0. `height: 100%` funciona solo si el ancestro tiene `display: flex` y `flex: 1` propagado correctamente.

---

## 12. Integrations & External Services

| Servicio | Propósito | Cliente | Fallo |
|---------|-----------|---------|-------|
| CartoDB tiles | Basemap minimalista | `L.tileLayer` (HTTP directo) | Mapa queda sin tiles de fondo, polígonos y puntos siguen visibles |
| Firebase Auth | Token JWT para llamadas API | `firebase/auth` → `auth.currentUser.getIdToken()` via `ApiClient` | 401 en todas las llamadas → pantalla de error |
| FastAPI Backend | Datos de reportes | `ApiClient.get()` via `VITE_API_BASE_URL` | Error visible en Dashboard con botón "Reintentar" |
| GeoJSON locales | Cartografía base | `fetch('/cartografia_base/*.geojson')` | Mapa coroplético queda en blanco |

---

## 13. Security & Access Control

- **Auth:** todas las llamadas a `/grupos/{grupoKey}/reportes_intervenciones` requieren Bearer JWT en header. `ApiClient` obtiene y renueva el token automáticamente (renueva cuando quedan < 60s para expirar).
- **RBAC:** usuarios con `role < administrador` solo ven datos de su propio grupo. La restricción se aplica **en el frontend** (filtrando `GRUPO_KEYS`) y también en el backend (el endpoint verifica el grupo del token).
- **Sin inputs peligrosos:** el Dashboard es solo lectura; ningún input del usuario llega al backend en este módulo.

---

## 14. Replication Guide

### Prerrequisitos

- [ ] Framework frontend con componentes reactivos (Svelte 4, o adaptar a React/Vue)
- [ ] Sistema de autenticación que produzca un Bearer token para las llamadas API
- [ ] Backend con endpoint que retorne lista de reportes con campos de coordenadas y geo-administrativos
- [ ] Archivos GeoJSON de las zonas a visualizar (polígonos de comunas/barrios)

### Orden de implementación

1. **Instalar dependencias**
   ```bash
   npm install leaflet @types/leaflet chart.js svelte-chartjs
   ```

2. **Preparar assets GeoJSON** — colocar en `public/cartografia_base/`. Verificar que cada feature tenga la propiedad que se usará para el matching (ej. `"comuna_corregimiento": "NOMBRE EN MAYÚSCULAS"`).

3. **Definir el tipo de dato principal** — replicar `ReporteIntervencion` adaptando campos al dominio propio. El campo crítico para los mapas es `coordinates_data: [number, number]` en formato `[lng, lat]`.

4. **Implementar `normalizeReporte()`** — parser que unifique las coordenadas del backend al formato `[lng, lat]` y añada aliases de campos.

5. **Implementar `obtenerReportes()`** — función de fetch con auth que retorne `{ data: ReporteIntervencion[] }`.

6. **Crear `MapaIntervenciones.svelte`** — en este orden:
   - `initMap()`: crear mapa, añadir tiles, crear `markersLayer`
   - `getColor(grupo)`: mapa de colores por categoría
   - `buildPopupHtml(reporte, color)`: HTML del popup
   - `updateMarkers(animate)`: limpiar layer, crear `L.divIcon` SVG, añadir marcadores
   - `fitToData(animate)`: encuadre inteligente (cero/uno/varios puntos)
   - Reactivo: `$: if (map && initialized) { updateMarkers(true); }`
   - `ResizeObserver` → `map.invalidateSize()`
   - `onDestroy` → `map.remove(); map = null`

7. **Crear `MapaCoropletico.svelte`** — en este orden:
   - `loadGeoJSON()`: fetch del archivo GeoJSON correcto según `aggregationLevel`
   - `initMap()`: crear mapa con interacciones deshabilitadas, tile opacidad 0.3
   - `calculateAggregations()`: `Map<string, number>` con `normalizeAreaName()`
   - `getColor(count)`: escala de colores progresiva
   - `updateChoropleth()`: remover capa anterior, crear nueva `L.geoJSON` con `style` y `onEachFeature`
   - `fitMapToGeoJSON()`: `geojsonLayer.getBounds()` → `fitBounds`
   - Reactivo: `$: if (map && geojsonData && filteredReportes) { updateChoropleth(); }`
   - Reactivo en cambio de nivel: recargar GeoJSON y recalcular

8. **Crear `KPICard.svelte`** — tarjeta con title, value, subtitle, trend opcional.

9. **Crear `DashboardReportesList.svelte`** — lista con slice y load-more.

10. **Crear `Dashboard.svelte`** — orquestador:
    - `onMount` → `cargarReportes()` con RBAC
    - Declarar todos los filtros como variables
    - `$: filteredReportes` — filtrado reactivo
    - `$:` KPIs derivados
    - `$:` datos de charts (byMonth, intervencionPorTipo, reportesPorGrupo)
    - Template: header → filtros → KPI+mapa layout → tabs → gráficas|lista

11. **Registrar Chart.js** — `ChartJS.register(...registerables)` una vez en el Dashboard.

12. **Configurar CSS global de Leaflet** — asegurar que `leaflet/dist/leaflet.css` se importe. Los estilos de popups custom deben ser `:global()`.

13. **Verificar el layout** — el contenedor del mapa necesita altura explícita propagada desde el padre via `display:flex` + `flex:1`.

### Known Gotchas

- **Leaflet y SSR:** Leaflet no funciona en Node (usa `window`, `document`). En frameworks con SSR (Next.js, SvelteKit), importar Leaflet solo en el browser (`onMount`, no en el módulo level) o usar dynamic import con `{ssr: false}`.

- **Orden lng/lat:** GeoJSON usa `[longitud, latitud]`; Leaflet usa `[latitud, longitud]`. `normalizeReporte()` guarda `[lng, lat]`. Al crear un marcador siempre invertir: `const [lng, lat] = r.coordinates_data; L.marker([lat, lng])`.

- **`map.invalidateSize()` después de cambio de visibilidad:** si el mapa está en un tab o modal que empieza oculto, Leaflet lo renderiza con tamaño 0. El `ResizeObserver` del componente lo soluciona automáticamente, pero si se replica sin él, llamar `map.invalidateSize()` manualmente cuando el contenedor se vuelva visible.

- **GeoJSON y matching de nombres:** el campo `reporte.comuna_corregimiento` puede llegar con capitalización inconsistente ("COMUNA 1", "Comuna 1", "comuna 1"). La función `normalizeAreaName()` hace `.toUpperCase()` en ambos lados. Si el GeoJSON tiene nombres en otro formato, adaptar la función.

- **Reactividad de Leaflet en Svelte:** Leaflet es imperativo. Los `$:` reactivos no deben modificar directamente el mapa; deben llamar a funciones imperativas (`updateMarkers()`, `updateChoropleth()`). Intentar hacer `$: if(map) map.setX(...)` directamente puede crear loops de reactividad.

- **Destrucción del mapa:** siempre llamar `map.remove()` en `onDestroy`. Sin esto, si el componente se monta/desmonta (por cambio de tab/route), se crean múltiples instancias Leaflet en el mismo elemento DOM, lo que produce errores visuales y memory leaks.

- **Un solo foto con `appendPhotos`:** el backend (FastAPI + python-multipart) no parsea `List[UploadFile]` cuando solo hay un file. El workaround es enviar el mismo file dos veces. Esto solo aplica al módulo de carga de reportes, no al Dashboard.

- **KPI de cobertura hardcodeado a 37:** Cali tiene 22 comunas + 15 corregimientos = 37 divisiones. Este número está hardcodeado. Externalizarlo si el dominio geográfico cambia.

- **`Promise.allSettled` en la carga:** si un endpoint de grupo falla (mantenimiento, permisos), los demás grupos siguen cargando. Error solo aparece si el resultado final es completamente vacío.

- **Chunk de Leaflet en Vite:** configurar `manualChunks` en `vite.config.ts` para separar Leaflet (~150KB) del bundle principal:
  ```typescript
  manualChunks: {
    leaflet: ['leaflet'],
    charts: ['chart.js', 'svelte-chartjs'],
  }
  ```

### Adaptaciones para otros stacks

- **React/Next.js (sin SSR en el mapa):** reemplazar los `$:` reactivos con `useEffect` + `useRef` para el mapa. El patrón es: `useEffect(() => { updateMarkers(); }, [filteredReportes])`. Usar `dynamic(() => import('./MapaIntervenciones'), { ssr: false })` para evitar errores de SSR.

- **Vue 3:** usar `watchEffect` o `watch(filteredReportes, updateMarkers)`. El mapa va en un `ref<L.Map | null>` y se inicializa en `onMounted`.

- **Sin Firebase:** reemplazar `ApiClient.get()` por cualquier función de fetch que añada el header `Authorization: Bearer <token>`. La lógica del Dashboard no depende de Firebase directamente.

- **Backend diferente a Firestore/FastAPI:** el Dashboard solo necesita que el endpoint retorne `{ data: ReporteIntervencion[] }`. Adaptar el tipo y la función `normalizeReporte()` al esquema real del backend.

- **Otro proveedor de tiles:** sustituir la URL de CartoDB por cualquier tile XYZ. Stamen Toner (monocromático), Esri World Street Map, o un servidor propio son alternativas. La lógica del mapa es agnóstica al proveedor.
