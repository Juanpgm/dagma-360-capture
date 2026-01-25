<script lang="ts">
  export let photoFiles: File[] = [];

  let photoPreviewUrls: string[] = [];

  function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target.files;

    if (files && files.length > 0) {
      // Convertir FileList a Array y agregar a los existentes
      const newFiles = Array.from(files);
      photoFiles = [...photoFiles, ...newFiles];

      // Generar previsualizaciones para los nuevos archivos
      newFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            photoPreviewUrls = [...photoPreviewUrls, e.target.result as string];
          }
        };
        reader.readAsDataURL(file);
      });

      // Limpiar el input para permitir seleccionar los mismos archivos nuevamente si se desea
      target.value = "";
    }
  }

  function removePhoto(index: number) {
    photoPreviewUrls = photoPreviewUrls.filter((_, i) => i !== index);
    photoFiles = photoFiles.filter((_, i) => i !== index);
  }
</script>

<div class="step-container">
  <div class="step-header">
    <h2 class="step-title">Evidencia Fotográfica</h2>
    <p class="step-description">Capture fotos del estado actual del parque</p>
  </div>

  <div class="step-content">
    <div class="photos-section">
      <!-- Botón para tomar foto con cámara (móviles) -->
      <div class="file-input-wrapper">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          on:change={handleFileChange}
          id="photo-camera"
          class="file-input"
        />
        <label for="photo-camera" class="file-label camera">
          <span class="file-icon">📷</span>
          <span class="file-text">Tomar Foto</span>
        </label>
      </div>

      <!-- Botón para seleccionar de galería -->
      <div class="file-input-wrapper">
        <input
          type="file"
          accept="image/*"
          multiple
          on:change={handleFileChange}
          id="photo-gallery"
          class="file-input"
        />
        <label for="photo-gallery" class="file-label gallery">
          <span class="file-icon">🖼️</span>
          <span class="file-text">Seleccionar de Galería</span>
        </label>
      </div>

      {#if photoFiles.length > 0}
        <div class="photo-counter">
          <span class="counter-icon">📸</span>
          <span class="counter-text">{photoFiles.length} foto(s) agregada(s)</span>
        </div>
      {/if}

      {#if photoPreviewUrls.length > 0}
        <div class="photo-grid">
          {#each photoPreviewUrls as previewUrl, index}
            <div class="photo-item">
              <img src={previewUrl} alt="Foto {index + 1}" class="photo-preview" />
              <button
                type="button"
                class="btn-remove"
                on:click={() => removePhoto(index)}
                title="Eliminar foto"
              >
                ✕
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-state">
          <div class="empty-icon">📸</div>
          <p class="empty-text">No hay fotos seleccionadas</p>
          <p class="empty-hint">Las fotos son opcionales pero recomendadas para documentar el estado del parque</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .step-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .step-header {
    text-align: left;
  }

  .step-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #047857;
    margin: 0 0 0.5rem 0;
  }

  .step-description {
    color: #6b7280;
    margin: 0;
    font-size: 0.9375rem;
  }

  .step-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .photos-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .file-input-wrapper {
    position: relative;
  }

  .file-input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .file-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    color: white;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 600;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    border: none;
    -webkit-tap-highlight-color: transparent;
  }

  .file-label.camera {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
  }

  .file-label.gallery {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  }

  .file-label:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
  }

  .file-label:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .file-icon {
    font-size: 1.5rem;
  }

  .file-text {
    font-size: 1rem;
  }

  .photo-counter {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 6px;
    color: #047857;
    font-weight: 600;
  }

  .counter-icon {
    font-size: 1.25rem;
  }

  .counter-text {
    font-size: 0.9375rem;
  }

  .photo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.75rem;
  }

  .photo-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s;
  }

  .photo-item:hover {
    transform: scale(1.02);
  }

  .photo-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .btn-remove {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 28px;
    height: 28px;
    background: rgba(220, 38, 38, 0.95);
    color: white;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    font-weight: bold;
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .btn-remove:hover {
    background: rgba(185, 28, 28, 1);
    transform: scale(1.1);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 1.5rem;
    text-align: center;
    background: #f9fafb;
    border: 2px dashed #d1d5db;
    border-radius: 8px;
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-text {
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 0.5rem 0;
  }

  .empty-hint {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
    max-width: 400px;
  }

  @media (max-width: 640px) {
    .step-title {
      font-size: 1.25rem;
    }

    .file-label {
      padding: 1rem;
      font-size: 0.9375rem;
    }

    .file-icon {
      font-size: 1.75rem;
    }

    .photo-grid {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 0.5rem;
    }

    .btn-remove {
      width: 32px;
      height: 32px;
      font-size: 1.125rem;
    }
  }
</style>
