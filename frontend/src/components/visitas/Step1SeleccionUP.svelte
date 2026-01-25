<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '../ui/Button.svelte';
  import type { Parque } from '../../types/visitas';
  import { getCurrentPosition, calculateDistanceToGeometry } from '../../lib/geolocation';
  import type { Coordenadas } from '../../types/visitas';
  
  export let parques: Parque[];
  export let selectedParque: Parque | null;
  export let onSelect: (parque: Parque) => void;
  export let onLoadParques: () => Promise<void>;
  export let isLoading: boolean;

  let searchTerm = '';
  let showColumnSelector = false;
  let currentLocation: Coordenadas | null = null;
  let capturingLocation = false;
  let sortByDistance = true; // Por defecto ordenar por distancia
  
  // Paginación
  let currentPage = 1;
  let itemsPerPage = 10;

  // Columnas disponibles para parques
  interface ColumnConfig {
    key: keyof Parque | 'distancia' | 'estado_intervencion';
    label: string;
    visible: boolean;
    width?: string;
  }

  let columns: ColumnConfig[] = [
    { key: 'distancia', label: 'Distancia', visible: true, width: '100px' },
    { key: 'upid', label: 'ID', visible: true, width: '100px' },
    { key: 'nombre_up', label: 'Nombre del Parque', visible: true, width: '250px' },
    { key: 'identificador', label: 'Tipo', visible: true, width: '120px' },
    { key: 'barrio_vereda', label: 'Barrio', visible: true, width: '150px' },
    { key: 'comuna_corregimiento', label: 'Comuna', visible: true, width: '120px' },
    { key: 'direccion', label: 'Dirección', visible: true, width: '200px' },
    { key: 'estado_intervencion', label: 'Estado', visible: true, width: '130px' },
    { key: 'tipo_equipamiento', label: 'Equipamiento', visible: false, width: '150px' },
    { key: 'avance_obra', label: 'Avance %', visible: false, width: '90px' },
  ];

  $: visibleColumns = columns.filter(col => col.visible);

  // Filtrar parques por búsqueda
  $: filteredParques = parques.filter(parque => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      parque.upid?.toLowerCase().includes(term) ||
      parque.nombre_up?.toLowerCase().includes(term) ||
      parque.identificador?.toLowerCase().includes(term) ||
      parque.barrio_vereda?.toLowerCase().includes(term) ||
      parque.comuna_corregimiento?.toLowerCase().includes(term) ||
      parque.direccion?.toLowerCase().includes(term) ||
      parque.tipo_equipamiento?.toLowerCase().includes(term)
    );
  });

  // Ordenar por distancia si hay ubicación actual
  $: sortedParques = sortByDistance && currentLocation 
    ? [...filteredParques].sort((a, b) => {
        const distA = calculateParqueDistance(a);
        const distB = calculateParqueDistance(b);
        return distA - distB;
      })
    : filteredParques;

  // Paginación
  $: totalPages = Math.ceil(sortedParques.length / itemsPerPage);
  $: paginatedParques = sortedParques.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Resetear a página 1 cuando cambie la búsqueda
  $: if (searchTerm) {
    currentPage = 1;
  }

  // Función para calcular distancia a un parque
  function calculateParqueDistance(parque: Parque): number {
    if (!currentLocation) {
      return Infinity;
    }
    
    // Intentar usar geometry primero
    if (parque.geometry && parque.geometry.coordinates) {
      try {
        return calculateDistanceToGeometry(currentLocation, parque.geometry);
      } catch (error) {
        console.error('Error calculando distancia desde geometry:', error);
      }
    }
    
    // Fallback a lat/lon si existen
    if (parque.lat && parque.lon) {
      try {
        const lat = parseFloat(parque.lat);
        const lon = parseFloat(parque.lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          return calculateDistanceToGeometry(currentLocation, {
            type: 'Point',
            coordinates: [lon, lat]
          });
        }
      } catch (error) {
        console.error('Error calculando distancia desde lat/lon:', error);
      }
    }
    
    return Infinity;
  }

  // Formatear distancia para mostrar
  function formatDistance(distance: number): string {
    if (distance === Infinity || isNaN(distance)) {
      return 'N/A';
    }
    
    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    } else {
      return `${(distance / 1000).toFixed(1)}km`;
    }
  }

  // Capturar ubicación GPS automáticamente
  async function captureLocation() {
    capturingLocation = true;
    try {
      currentLocation = await getCurrentPosition();
      console.log('Ubicación capturada:', currentLocation);
    } catch (error) {
      console.error('Error capturando ubicación:', error);
      currentLocation = null;
    } finally {
      capturingLocation = false;
    }
  }

  onMount(async () => {
    if (parques.length === 0) {
      await onLoadParques();
    }
    // Capturar ubicación automáticamente al montar
    await captureLocation();
  });

  function handleSelectParque(parque: Parque) {
    console.log('Parque seleccionado:', parque);
    onSelect(parque);
  }

  function openGoogleMaps(parque: Parque) {
    console.log('openGoogleMaps llamado para parque:', parque.nombre_up);
    
    let lat: number, lng: number;

    try {
      // Intentar usar geometry primero
      if (parque.geometry && parque.geometry.coordinates) {
        const coords = parque.geometry.coordinates;
        
        if (parque.geometry.type === 'Point') {
          [lng, lat] = coords as [number, number];
        } else if (parque.geometry.type === 'LineString') {
          const lineCoords = coords as [number, number][];
          [lng, lat] = lineCoords[0];
        } else if (parque.geometry.type === 'MultiLineString') {
          const firstLine = (coords as [number, number][][])[0];
          [lng, lat] = firstLine[0];
        } else if (parque.geometry.type === 'Polygon') {
          const ring = (coords as [number, number][][])[0];
          [lng, lat] = ring[0];
        } else {
          throw new Error(`Tipo de geometría no soportado: ${parque.geometry.type}`);
        }
      } 
      // Fallback a lat/lon
      else if (parque.lat && parque.lon) {
        lat = parseFloat(parque.lat);
        lng = parseFloat(parque.lon);
      } else {
        throw new Error('No hay coordenadas disponibles');
      }

      // Validar coordenadas
      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
        throw new Error(`Coordenadas no válidas: lat=${lat}, lng=${lng}`);
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new Error(`Coordenadas fuera de rango: lat=${lat}, lng=${lng}`);
      }
      
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      console.log('✅ Abriendo Google Maps:', { lat, lng, url: mapsUrl });
      window.open(mapsUrl, '_blank');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert(`Las coordenadas del parque no son válidas.\n\nDetalle: ${errorMsg}`);
      console.error('❌ Error procesando coordenadas:', { error: errorMsg, parque });
    }
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }

  function toggleColumnVisibility(columnKey: keyof Parque | 'distancia' | 'estado_intervencion') {
    columns = columns.map(col => 
      col.key === columnKey ? { ...col, visible: !col.visible } : col
    );
  }

  function getCellValue(parque: Parque, key: keyof Parque | 'distancia' | 'estado_intervencion'): string {
    // Caso especial para distancia
    if (key === 'distancia') {
      const distance = calculateParqueDistance(parque);
      return formatDistance(distance);
    }

    // Caso especial para estado de intervención
    if (key === 'estado_intervencion') {
      if (parque.intervenciones && parque.intervenciones.length > 0) {
        return parque.intervenciones[0].estado;
      }
      return '-';
    }

    const value = parque[key as keyof Parque];
    
    if (value === null || value === undefined) return '-';
    
    if (key === 'avance_obra' && typeof value === 'number') {
      return `${value}%`;
    }
    
    return String(value);
  }

  // Obtener badge color para estado
  function getEstadoBadgeClass(estado: string): string {
    const estadoLower = estado.toLowerCase();
    if (estadoLower.includes('ejecución') || estadoLower.includes('activo')) {
      return 'badge-success';
    }
    if (estadoLower.includes('suspendido') || estadoLower.includes('inactivo')) {
      return 'badge-warning';
    }
    if (estadoLower.includes('terminado') || estadoLower.includes('completado')) {
      return 'badge-info';
    }
    if (estadoLower.includes('alistamiento')) {
      return 'badge-secondary';
    }
    return 'badge-default';
  }
</script>

<div class="step-container">
  <div class="step-header">
    <h2 class="step-title">Selección de Parque</h2>
    <p class="step-description">
      Busque y seleccione el parque o zona verde a verificar
    </p>
  </div>

  <div class="step-content">
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Cargando parques...</p>
      </div>
    {:else}
      <!-- Barra de herramientas -->
      <div class="toolbar">
        <input
          type="text"
          placeholder="Buscar por nombre, barrio, comuna..."
          bind:value={searchTerm}
          class="search-input"
        />
        
        <div class="toolbar-actions">
          <!-- Indicador de GPS -->
          <div class="gps-indicator">
            {#if capturingLocation}
              <div class="gps-status capturing">
                <div class="spinner-small"></div>
                <span>Capturando GPS...</span>
              </div>
            {:else if currentLocation}
              <div class="gps-status active" title="Parques ordenados por cercanía">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#10b981"/>
                </svg>
                <span>GPS activo</span>
              </div>
            {:else}
              <div class="gps-status inactive">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#9ca3af"/>
                </svg>
                <span>Sin GPS</span>
                <button class="btn-retry" on:click={captureLocation}>Reintentar</button>
              </div>
            {/if}
          </div>

          <button 
            class="btn-toggle-columns"
            on:click={() => showColumnSelector = !showColumnSelector}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 3h12M2 8h12M2 13h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Columnas
          </button>
          <span class="results-count">{sortedParques.length} parque(s)</span>
        </div>
      </div>

      <!-- Selector de columnas -->
      {#if showColumnSelector}
        <div class="column-selector">
          <p class="column-selector-title">Mostrar/Ocultar Columnas:</p>
          <div class="column-options">
            {#each columns as column}
              <label class="column-option">
                <input
                  type="checkbox"
                  checked={column.visible}
                  on:change={() => toggleColumnVisibility(column.key)}
                />
                <span>{column.label}</span>
              </label>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Tabla de parques -->
      <div class="table-container">
        <table class="projects-table">
          <thead>
            <tr>
              {#each visibleColumns as column}
                <th style="width: {column.width || 'auto'}">{column.label}</th>
              {/each}
              <th style="width: 140px">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#if filteredParques.length === 0}
              <tr>
                <td colspan={visibleColumns.length + 1} class="empty-state">
                  No se encontraron parques
                </td>
              </tr>
            {:else}
              {#each paginatedParques as parque}
                <tr class:selected={selectedParque?.upid === parque.upid}>
                  {#each visibleColumns as column}
                    {#if column.key === 'estado_intervencion'}
                      <td>
                        {#if parque.intervenciones && parque.intervenciones.length > 0}
                          <span class="badge {getEstadoBadgeClass(parque.intervenciones[0].estado)}">
                            {parque.intervenciones[0].estado}
                          </span>
                        {:else}
                          -
                        {/if}
                      </td>
                    {:else}
                      <td>{getCellValue(parque, column.key)}</td>
                    {/if}
                  {/each}
                  <td class="actions-cell">
                    <button
                      class="btn-action btn-maps"
                      on:click={() => openGoogleMaps(parque)}
                      disabled={!parque.has_geometry}
                      title={parque.has_geometry ? 'Abrir en Google Maps' : 'Sin coordenadas'}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 0C5.2 0 3 2.2 3 5c0 3.9 5 11 5 11s5-7.1 5-11c0-2.8-2.2-5-5-5zm0 7.5c-1.4 0-2.5-1.1-2.5-2.5S6.6 2.5 8 2.5s2.5 1.1 2.5 2.5S9.4 7.5 8 7.5z"/>
                      </svg>
                    </button>
                    <button
                      class="btn-action btn-select"
                      on:click={() => handleSelectParque(parque)}
                    >
                      Seleccionar
                    </button>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
      {#if filteredParques.length > 0}
        <div class="pagination">
          <div class="pagination-info">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredParques.length)} de {filteredParques.length}
          </div>
          
          <div class="pagination-controls">
            <button
              class="btn-page"
              on:click={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              ‹ Anterior
            </button>
            
            <div class="page-numbers">
              {#each Array(totalPages) as _, i}
                {#if totalPages <= 5 || i === 0 || i === totalPages - 1 || Math.abs(i + 1 - currentPage) <= 1}
                  <button
                    class="btn-page-number"
                    class:active={currentPage === i + 1}
                    on:click={() => goToPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                {:else if i === 1 || i === totalPages - 2}
                  <span class="page-ellipsis">...</span>
                {/if}
              {/each}
            </div>
            
            <button
              class="btn-page"
              on:click={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Siguiente ›
            </button>
          </div>
        </div>
      {/if}

      {#if selectedParque}
        <div class="up-preview">
          <h4>Parque seleccionado: {selectedParque.nombre_up}</h4>
          <p class="selected-id">UP ID: {selectedParque.upid}</p>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .step-container {
    padding: 1rem;
    width: 100%;
    max-width: 100%;
  }

  .step-header {
    margin-bottom: 1.5rem;
  }

  .step-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 0.25rem;
  }

  .step-description {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .step-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem 1rem;
    color: #6b7280;
    font-size: 0.875rem;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e5e7eb;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    gap: 1rem;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .search-input {
    flex: 1;
    min-width: 250px;
    padding: 0.625rem 0.875rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    transition: border-color 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .toolbar-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
  }

  /* GPS Indicator */
  .gps-indicator {
    display: flex;
    align-items: center;
  }

  .gps-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
    white-space: nowrap;
  }

  .gps-status.capturing {
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #fbbf24;
  }

  .gps-status.active {
    background: #d1fae5;
    color: #065f46;
    border: 1px solid #10b981;
  }

  .gps-status.inactive {
    background: #f3f4f6;
    color: #6b7280;
    border: 1px solid #d1d5db;
  }

  .spinner-small {
    width: 14px;
    height: 14px;
    border: 2px solid #fbbf24;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  .btn-retry {
    padding: 0.125rem 0.5rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 0.75rem;
    color: #4b5563;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-retry:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .btn-toggle-columns {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-toggle-columns:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .results-count {
    font-size: 0.875rem;
    color: #6b7280;
    white-space: nowrap;
  }

  /* Column Selector */
  .column-selector {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 1rem;
  }

  .column-selector-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.75rem;
  }

  .column-options {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.5rem;
  }

  .column-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
  }

  .column-option input[type="checkbox"] {
    cursor: pointer;
  }

  /* Table */
  .table-container {
    overflow-x: auto;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .projects-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .projects-table thead {
    background: #f9fafb;
    border-bottom: 2px solid #e5e7eb;
  }

  .projects-table th {
    padding: 0.75rem 0.875rem;
    text-align: left;
    font-weight: 600;
    color: #374151;
    white-space: nowrap;
    position: sticky;
    top: 0;
    background: #f9fafb;
    z-index: 10;
  }

  .projects-table td {
    padding: 0.75rem 0.875rem;
    border-bottom: 1px solid #f3f4f6;
    color: #111827;
  }

  .projects-table tbody tr {
    transition: background-color 0.15s;
  }

  .projects-table tbody tr:hover {
    background: #f9fafb;
  }

  .projects-table tbody tr.selected {
    background: #eff6ff;
  }

  .projects-table tbody tr.selected:hover {
    background: #dbeafe;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem !important;
    color: #9ca3af;
    font-style: italic;
  }

  .actions-cell {
    display: flex;
    gap: 0.25rem;
    align-items: center;
    justify-content: center;
  }

  .btn-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.5rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
    white-space: nowrap;
  }

  .btn-maps {
    background: #f0fdf4;
    color: #15803d;
    border-color: #bbf7d0;
    padding: 0.5rem;
  }

  .btn-maps:hover:not(:disabled) {
    background: #dcfce7;
    border-color: #86efac;
  }

  .btn-maps:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-select {
    background: #667eea;
    color: white;
    border-color: #667eea;
    padding: 0.5rem 0.75rem;
  }

  .btn-select:hover {
    background: #5568d3;
    border-color: #5568d3;
  }

  /* Paginación */
  .pagination {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: center;
    padding: 0.75rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
  }

  .pagination-info {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .pagination-controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
  }

  .btn-page {
    padding: 0.5rem 0.875rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-page:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .btn-page:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-numbers {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }

  .btn-page-number {
    min-width: 36px;
    height: 36px;
    padding: 0.5rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-page-number:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .btn-page-number.active {
    background: #667eea;
    color: white;
    border-color: #667eea;
  }

  .page-ellipsis {
    padding: 0 0.25rem;
    color: #9ca3af;
  }

  /* Status Badges */
  .badge {
    display: inline-block;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .badge-success {
    background-color: #d1fae5;
    color: #065f46;
  }

  .badge-warning {
    background-color: #fef3c7;
    color: #92400e;
  }

  .badge-info {
    background-color: #dbeafe;
    color: #1e40af;
  }

  .badge-secondary {
    background-color: #f3f4f6;
    color: #374151;
  }

  .badge-default {
    background-color: #e5e7eb;
    color: #6b7280;
  }

  /* Selected Preview */
  .up-preview {
    background: #ecfdf5;
    border: 1px solid #86efac;
    border-radius: 8px;
    padding: 1rem;
  }

  .up-preview h4 {
    font-size: 0.875rem;
    font-weight: 600;
    color: #047857;
    margin: 0 0 0.25rem 0;
  }

  .selected-id {
    font-size: 0.75rem;
    color: #059669;
    margin: 0;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .toolbar {
      flex-direction: column;
      align-items: stretch;
    }

    .search-input {
      min-width: 100%;
    }

    .toolbar-actions {
      justify-content: space-between;
    }

    .column-options {
      grid-template-columns: 1fr;
    }

    .table-container {
      font-size: 0.75rem;
    }

    .projects-table th,
    .projects-table td {
      padding: 0.5rem 0.25rem;
      font-size: 0.75rem;
    }

    .btn-action {
      padding: 0.375rem;
      font-size: 0.7rem;
    }

    .btn-select {
      padding: 0.375rem 0.5rem;
    }

    .pagination {
      font-size: 0.8125rem;
    }

    .btn-page,
    .btn-page-number {
      padding: 0.375rem 0.5rem;
      font-size: 0.8125rem;
      min-width: 32px;
      height: 32px;
    }
  }
</style>
