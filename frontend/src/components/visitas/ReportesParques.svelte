<script lang="ts">
  import { onMount } from 'svelte';
  import { getReportes } from '../../api/visitas';
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';
  import Modal from '../ui/Modal.svelte';
  import type { Reporte } from '../../types/visitas';

  let reportes: Reporte[] = [];
  let loading = false;
  let error: string | null = null;

  // Filtros
  let searchTerm = '';
  let selectedTipoIntervencion = '';
  let fechaInicio = '';
  let fechaFin = '';

  // Paginación
  let currentPage = 1;
  let itemsPerPage = 10;

  // Modal de fotos
  let photoModalOpen = false;
  let selectedPhotos: string[] = [];
  let selectedReporteNombre = '';

  // Tipos de intervención únicos
  $: tiposIntervencion = Array.from(new Set(reportes.map(r => r.tipo_intervencion).filter(Boolean)));

  // Reportes filtrados
  $: filteredReportes = reportes.filter(reporte => {
    const matchesSearch = !searchTerm || 
      reporte.nombre_parque?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reporte.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reporte.upid?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTipo = !selectedTipoIntervencion || 
      reporte.tipo_intervencion === selectedTipoIntervencion;

    const matchesFecha = (!fechaInicio || new Date(reporte.fecha) >= new Date(fechaInicio)) &&
                         (!fechaFin || new Date(reporte.fecha) <= new Date(fechaFin));

    return matchesSearch && matchesTipo && matchesFecha;
  });

  // Paginación
  $: totalPages = Math.ceil(filteredReportes.length / itemsPerPage);
  $: paginatedReportes = filteredReportes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset página al cambiar filtros
  $: {
    searchTerm, selectedTipoIntervencion, fechaInicio, fechaFin;
    currentPage = 1;
  }

  onMount(async () => {
    await loadReportes();
  });

  async function loadReportes() {
    loading = true;
    error = null;

    try {
      const response = await getReportes();
      reportes = response.reportes || [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error al cargar reportes';
      console.error('Error loading reportes:', err);
    } finally {
      loading = false;
    }
  }

  function openPhotoModal(photos: string[], nombreParque: string) {
    selectedPhotos = photos;
    selectedReporteNombre = nombreParque;
    photoModalOpen = true;
  }

  function closePhotoModal() {
    photoModalOpen = false;
    selectedPhotos = [];
    selectedReporteNombre = '';
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatCoordinates(coordenadas: any) {
    if (!coordenadas) return 'N/A';
    if (typeof coordenadas === 'string') {
      try {
        coordenadas = JSON.parse(coordenadas);
      } catch {
        return coordenadas;
      }
    }
    const lat = coordenadas.latitude?.toFixed(6) || coordenadas[1]?.toFixed(6);
    const lng = coordenadas.longitude?.toFixed(6) || coordenadas[0]?.toFixed(6);
    return lat && lng ? `${lat}, ${lng}` : 'N/A';
  }

  function clearFilters() {
    searchTerm = '';
    selectedTipoIntervencion = '';
    fechaInicio = '';
    fechaFin = '';
  }

  function exportToExcel() {
    // Crear CSV simple
    const headers = ['Fecha', 'Parque', 'Tipo Intervención', 'Descripción', 'Observaciones', 'Coordenadas', 'Fotos'];
    const rows = filteredReportes.map(r => [
      formatDate(r.fecha),
      r.nombre_parque || '',
      r.tipo_intervencion || '',
      r.descripcion || '',
      r.observaciones || '',
      formatCoordinates(r.coordenadas),
      r.fotos?.length || 0
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reportes_parques_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }
</script>

<div class="reportes-container">
  <div class="header">
    <h1 class="title">Reportes de Reconocimiento</h1>
    <p class="subtitle">Historial de reconocimientos realizados en los parques</p>
  </div>

  <!-- Filtros y acciones -->
  <Card variant="outlined" padding="sm">
    <div class="filters-section">
      <div class="filters-row">
        <input
          type="text"
          bind:value={searchTerm}
          placeholder="Buscar por parque, descripción o UPID..."
          class="search-input"
        />

        <select bind:value={selectedTipoIntervencion} class="filter-select">
          <option value="">Todos los tipos</option>
          {#each tiposIntervencion as tipo}
            <option value={tipo}>{tipo}</option>
          {/each}
        </select>
      </div>

      <div class="filters-row">
        <div class="date-filter">
          <label for="fecha-inicio">Desde:</label>
          <input type="date" id="fecha-inicio" bind:value={fechaInicio} class="date-input" />
        </div>

        <div class="date-filter">
          <label for="fecha-fin">Hasta:</label>
          <input type="date" id="fecha-fin" bind:value={fechaFin} class="date-input" />
        </div>

        <div class="filter-actions">
          <Button size="sm" variant="outline" onClick={clearFilters}>
            Limpiar
          </Button>
          <Button size="sm" variant="primary" onClick={exportToExcel} disabled={filteredReportes.length === 0}>
            📥 Exportar CSV
          </Button>
        </div>
      </div>

      <div class="results-info">
        Mostrando {paginatedReportes.length} de {filteredReportes.length} reportes
        {#if filteredReportes.length !== reportes.length}
          (filtrados de {reportes.length} totales)
        {/if}
      </div>
    </div>
  </Card>

  <!-- Tabla de reportes -->
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Cargando reportes...</p>
    </div>
  {:else if error}
    <Card variant="outlined" padding="md">
      <div class="error-state">
        <span class="error-icon">⚠️</span>
        <p class="error-message">{error}</p>
        <Button size="sm" onClick={loadReportes}>Reintentar</Button>
      </div>
    </Card>
  {:else if paginatedReportes.length === 0}
    <Card variant="outlined" padding="md">
      <div class="empty-state">
        <span class="empty-icon">📋</span>
        <p class="empty-message">
          {filteredReportes.length === 0 && reportes.length > 0
            ? 'No se encontraron reportes con los filtros aplicados'
            : 'No hay reportes registrados'}
        </p>
        {#if filteredReportes.length === 0 && reportes.length > 0}
          <Button size="sm" onClick={clearFilters}>Limpiar filtros</Button>
        {/if}
      </div>
    </Card>
  {:else}
    <div class="table-container">
      <table class="reportes-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Parque</th>
            <th>Tipo Intervención</th>
            <th>Descripción</th>
            <th>Coordenadas</th>
            <th>Fotos</th>
          </tr>
        </thead>
        <tbody>
          {#each paginatedReportes as reporte}
            <tr>
              <td class="date-cell">{formatDate(reporte.fecha)}</td>
              <td class="park-cell">
                <div class="park-name">{reporte.nombre_parque || 'N/A'}</div>
                {#if reporte.upid}
                  <div class="park-id">ID: {reporte.upid}</div>
                {/if}
              </td>
              <td>
                <span class="tipo-badge">{reporte.tipo_intervencion || 'N/A'}</span>
              </td>
              <td class="description-cell">
                <div class="description-text">{reporte.descripcion || 'Sin descripción'}</div>
                {#if reporte.observaciones}
                  <div class="observations-text">
                    <strong>Obs:</strong> {reporte.observaciones}
                  </div>
                {/if}
              </td>
              <td class="coords-cell">
                {formatCoordinates(reporte.coordenadas)}
              </td>
              <td class="photos-cell">
                {#if reporte.fotos && reporte.fotos.length > 0}
                  <button
                    class="photos-button"
                    on:click={() => openPhotoModal(reporte.fotos || [], reporte.nombre_parque || 'Parque')}
                  >
                    📷 {reporte.fotos.length}
                  </button>
                {:else}
                  <span class="no-photos">Sin fotos</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Paginación -->
    {#if totalPages > 1}
      <div class="pagination">
        <button
          class="page-btn"
          disabled={currentPage === 1}
          on:click={() => goToPage(currentPage - 1)}
        >
          ← Anterior
        </button>

        <div class="page-numbers">
          {#each Array(totalPages) as _, i}
            {#if i + 1 === 1 || i + 1 === totalPages || Math.abs(i + 1 - currentPage) <= 2}
              <button
                class="page-number-btn"
                class:active={currentPage === i + 1}
                on:click={() => goToPage(i + 1)}
              >
                {i + 1}
              </button>
            {:else if Math.abs(i + 1 - currentPage) === 3}
              <span class="page-ellipsis">...</span>
            {/if}
          {/each}
        </div>

        <button
          class="page-btn"
          disabled={currentPage === totalPages}
          on:click={() => goToPage(currentPage + 1)}
        >
          Siguiente →
        </button>
      </div>
    {/if}
  {/if}
</div>

<!-- Modal de Galería de Fotos -->
{#if photoModalOpen}
  <div class="modal-overlay" on:click={closePhotoModal}>
    <div class="photo-modal" on:click|stopPropagation>
      <div class="photo-modal-header">
        <h3>{selectedReporteNombre} - Fotos</h3>
        <button class="close-btn" on:click={closePhotoModal}>✕</button>
      </div>
      <div class="photo-gallery">
        {#each selectedPhotos as photoUrl, index}
          <div class="photo-item">
            <img src={photoUrl} alt="Foto {index + 1}" />
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .reportes-container {
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .header {
    margin-bottom: 0.5rem;
  }

  .title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #047857;
    margin: 0 0 0.5rem 0;
  }

  .subtitle {
    font-size: 1rem;
    color: #6b7280;
    margin: 0;
  }

  .filters-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .filters-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .search-input {
    flex: 1;
    min-width: 250px;
    padding: 0.625rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.9375rem;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: #059669;
    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
  }

  .filter-select {
    padding: 0.625rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.9375rem;
    background: white;
    cursor: pointer;
    min-width: 180px;
  }

  .date-filter {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .date-filter label {
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 500;
  }

  .date-input {
    padding: 0.625rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.9375rem;
  }

  .filter-actions {
    display: flex;
    gap: 0.75rem;
    margin-left: auto;
  }

  .results-info {
    font-size: 0.875rem;
    color: #6b7280;
    padding-top: 0.5rem;
    border-top: 1px solid #e5e7eb;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
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

  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
    text-align: center;
  }

  .error-icon,
  .empty-icon {
    font-size: 3rem;
  }

  .error-message,
  .empty-message {
    color: #6b7280;
    margin: 0;
  }

  .table-container {
    overflow-x: auto;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
  }

  .reportes-table {
    width: 100%;
    border-collapse: collapse;
    background: white;
  }

  .reportes-table th {
    background: #f9fafb;
    padding: 0.875rem 1rem;
    text-align: left;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 2px solid #e5e7eb;
  }

  .reportes-table td {
    padding: 0.875rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.9375rem;
    color: #374151;
  }

  .reportes-table tr:hover {
    background: #f9fafb;
  }

  .date-cell {
    white-space: nowrap;
    color: #6b7280;
    font-size: 0.875rem;
  }

  .park-cell {
    min-width: 180px;
  }

  .park-name {
    font-weight: 600;
    color: #047857;
  }

  .park-id {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  .tipo-badge {
    display: inline-block;
    padding: 0.25rem 0.625rem;
    background: #dbeafe;
    color: #1e40af;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .description-cell {
    max-width: 350px;
  }

  .description-text {
    margin-bottom: 0.25rem;
  }

  .observations-text {
    font-size: 0.8125rem;
    color: #6b7280;
    font-style: italic;
  }

  .coords-cell {
    font-family: 'Courier New', monospace;
    font-size: 0.8125rem;
    color: #6b7280;
    white-space: nowrap;
  }

  .photos-cell {
    text-align: center;
  }

  .photos-button {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    color: white;
    border: none;
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .photos-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(5, 150, 105, 0.3);
  }

  .no-photos {
    color: #9ca3af;
    font-size: 0.875rem;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
  }

  .page-btn {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  .page-btn:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .page-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-numbers {
    display: flex;
    gap: 0.25rem;
  }

  .page-number-btn {
    width: 36px;
    height: 36px;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  .page-number-btn:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .page-number-btn.active {
    background: #059669;
    color: white;
    border-color: #059669;
  }

  .page-ellipsis {
    padding: 0 0.25rem;
    color: #9ca3af;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .photo-modal {
    background: white;
    border-radius: 12px;
    max-width: 900px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  }

  .photo-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    position: sticky;
    top: 0;
    background: white;
    z-index: 10;
  }

  .photo-modal-header h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #047857;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #6b7280;
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
    transition: color 0.2s;
  }

  .close-btn:hover {
    color: #374151;
  }

  .photo-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
    padding: 1.5rem;
  }

  .photo-item {
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .photo-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.2s;
  }

  .photo-item:hover img {
    transform: scale(1.05);
  }

  @media (max-width: 768px) {
    .reportes-container {
      padding: 1rem;
    }

    .filters-row {
      flex-direction: column;
      align-items: stretch;
    }

    .search-input,
    .filter-select {
      width: 100%;
    }

    .filter-actions {
      margin-left: 0;
      width: 100%;
      justify-content: stretch;
    }

    .reportes-table {
      font-size: 0.8125rem;
    }

    .reportes-table th,
    .reportes-table td {
      padding: 0.625rem 0.5rem;
    }

    .photo-gallery {
      grid-template-columns: 1fr;
    }
  }
</style>
