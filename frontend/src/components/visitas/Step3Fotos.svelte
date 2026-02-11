<script lang="ts">
  import Card from "../ui/Card.svelte";

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
  <div class="step-content">
    <Card padding="md">
      <h3 class="card-title">📸 Evidencia Fotográfica</h3>
      <p class="card-subtitle">
        Debe agregar al menos una foto del estado actual del parque
      </p>

      <div class="photo-actions">
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
          <label for="photo-camera" class="file-label">
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
          <label for="photo-gallery" class="file-label">
            <span class="file-icon">🖼️</span>
            <span class="file-text">Galería</span>
          </label>
        </div>
      </div>

      {#if photoPreviewUrls.length > 0}
        <div class="photo-grid">
          {#each photoPreviewUrls as previewUrl, index}
            <div class="photo-item">
              <img
                src={previewUrl}
                alt="Foto {index + 1}"
                class="photo-preview"
              />
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

        <div class="photo-count">
          <span class="count-badge">
            ✓ {photoFiles.length} foto(s) agregada(s)
          </span>
        </div>
      {:else}
        <div class="empty-state">
          <div class="empty-icon">📸</div>
          <p class="empty-title">No hay fotos aún</p>
          <p class="empty-hint">
            Agregue fotos para documentar el estado del parque
          </p>
        </div>
      {/if}
    </Card>
  </div>
</div>

<style>
  .step-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .step-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Card */
  .card-title {
    font-size: 1rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 0.25rem 0;
  }

  .card-subtitle {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0 0 1rem 0;
  }

  /* Photo Actions */
  .photo-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 1rem;
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
    gap: 0.5rem;
    padding: 0.875rem 1rem;
    background: #2563eb;
    color: white;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    font-weight: 600;
    font-size: 0.9375rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    border: none;
    -webkit-tap-highlight-color: transparent;
  }

  .file-label:hover {
    background: #1d4ed8;
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
  }

  .file-label:active {
    transform: translateY(0);
  }

  .file-icon {
    font-size: 1.25rem;
    line-height: 1;
  }

  .file-text {
    font-size: 0.875rem;
  }

  /* Photo Grid */
  .photo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .photo-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    background: #f1f5f9;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .photo-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .btn-remove {
    position: absolute;
    top: 0.375rem;
    right: 0.375rem;
    width: 26px;
    height: 26px;
    background: rgba(220, 38, 38, 0.9);
    color: white;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: 700;
    transition: all 0.15s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .btn-remove:hover {
    background: rgba(185, 28, 28, 1);
    transform: scale(1.1);
  }

  .btn-remove:active {
    transform: scale(0.95);
  }

  .photo-count {
    display: flex;
    justify-content: center;
  }

  .count-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.875rem;
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    color: #047857;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2.5rem 1.5rem;
    text-align: center;
    background: #f8fafc;
    border: 2px dashed #cbd5e1;
    border-radius: 8px;
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 0.75rem;
    opacity: 0.4;
  }

  .empty-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #475569;
    margin: 0 0 0.375rem 0;
  }

  .empty-hint {
    font-size: 0.8125rem;
    color: #64748b;
    margin: 0;
    max-width: 320px;
    line-height: 1.5;
  }

  @media (max-width: 640px) {
    .photo-actions {
      grid-template-columns: 1fr;
    }

    .photo-grid {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 0.5rem;
    }
  }
</style>
