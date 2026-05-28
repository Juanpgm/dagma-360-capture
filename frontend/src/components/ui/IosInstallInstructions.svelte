<script lang="ts">
  /**
   * IosInstallInstructions — Modal con pasos visuales para instalar la PWA en iOS Safari.
   * iOS no soporta beforeinstallprompt; la única vía es Compartir → Agregar a pantalla de inicio.
   */
  export let open = false;
  export let onClose: () => void = () => {};

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
</script>

{#if open}
  <div
    class="backdrop"
    on:click={handleBackdrop}
    on:keydown={(e) => e.key === "Escape" && onClose()}
    role="presentation"
  >
    <div class="modal" role="dialog" aria-labelledby="ios-install-title">
      <header class="header">
        <h2 id="ios-install-title">Instalar en iPhone / iPad</h2>
        <button class="close" type="button" on:click={onClose} aria-label="Cerrar">✕</button>
      </header>

      <div class="body">
        <p class="hint">
          iOS no permite instalar apps con un botón directo. Sigue estos pasos en Safari:
        </p>

        <ol class="steps">
          <li>
            <div class="step-icon" aria-hidden="true">
              <!-- Share icon (caja con flecha hacia arriba) -->
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </div>
            <div class="step-text">
              <strong>1. Toca el botón Compartir</strong>
              <span>En la barra inferior (o superior en iPad) de Safari.</span>
            </div>
          </li>

          <li>
            <div class="step-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
            <div class="step-text">
              <strong>2. Selecciona "Agregar a pantalla de inicio"</strong>
              <span>Desplázate hacia abajo en el menú si no la ves.</span>
            </div>
          </li>

          <li>
            <div class="step-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div class="step-text">
              <strong>3. Confirma con "Agregar"</strong>
              <span>El ícono DAGMA 360 aparecerá en tu pantalla de inicio.</span>
            </div>
          </li>
        </ol>

        <p class="note">
          ⚠️ Debes usar <strong>Safari</strong>. Chrome y otros navegadores en iOS no permiten instalar PWAs.
        </p>
      </div>

      <footer class="footer">
        <button class="primary" type="button" on:click={onClose}>Entendido</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    padding: 1rem;
  }
  .modal {
    width: 100%;
    max-width: 460px;
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 18px 50px rgba(15, 23, 42, 0.25);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: 90vh;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e5e7eb;
  }
  .header h2 {
    margin: 0;
    font-size: 1.05rem;
    color: #0f172a;
  }
  .close {
    background: transparent;
    border: none;
    font-size: 1.1rem;
    cursor: pointer;
    color: #64748b;
  }
  .body {
    padding: 1rem 1.25rem;
    overflow-y: auto;
  }
  .hint {
    margin: 0 0 1rem;
    color: #475569;
    font-size: 0.9rem;
  }
  .steps {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  .steps li {
    display: flex;
    gap: 0.85rem;
    align-items: flex-start;
    padding: 0.75rem;
    background: #f8fafc;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
  }
  .step-icon {
    flex: 0 0 44px;
    height: 44px;
    border-radius: 10px;
    background: #dcfce7;
    color: #166534;
    display: grid;
    place-items: center;
  }
  .step-text {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    color: #0f172a;
    font-size: 0.9rem;
  }
  .step-text span {
    color: #64748b;
    font-size: 0.8125rem;
  }
  .note {
    margin: 1rem 0 0;
    padding: 0.75rem;
    background: #fef3c7;
    border-radius: 8px;
    color: #78350f;
    font-size: 0.85rem;
    border: 1px solid #fcd34d;
  }
  .footer {
    padding: 0.85rem 1.25rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
  }
  .primary {
    background: #16a34a;
    color: white;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .primary:hover {
    background: #15803d;
  }
</style>
