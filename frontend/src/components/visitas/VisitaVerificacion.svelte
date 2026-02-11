<script lang="ts">
  import { onMount } from "svelte";
  import {
    visitaStore,
    stepNames,
    isCurrentStepValid,
  } from "../../stores/visitaStore";
  import { authStore } from "../../stores/authStore";
  import { registrarReconocimiento, getParques } from "../../api/visitas";
  import Stepper from "../ui/Stepper.svelte";
  import Button from "../ui/Button.svelte";
  import Modal from "../ui/Modal.svelte";
  import Step1SeleccionUP from "./Step1SeleccionUP.svelte";
  import Step2Formulario from "./Step2Formulario.svelte";
  import Step3Fotos from "./Step3Fotos.svelte";
  import type { Parque } from "../../types/visitas";

  export let onClose: () => void;

  let submitting = false;
  let submitError: string | null = null;
  let submitSuccess = false;
  let photoFiles: File[] = [];

  // Estado del modal
  let modalOpen = false;
  let modalTitle = "";
  let modalMessage = "";
  let modalType: "success" | "error" | "info" | "warning" = "info";
  let modalShowCancel = false;
  let modalConfirmText = "Entendido";
  let modalCancelText = "Cancelar";
  let modalOnConfirm: (() => void) | null = null;

  // Suscripción al store
  $: state = $visitaStore;
  $: canContinue = currentStep === 3 
    ? photoFiles.length > 0  // En el paso 3, validar que haya fotos
    : $isCurrentStepValid;    // En otros pasos, usar la validación del store
  $: currentStep = state.currentStep;

  onMount(() => {
    // Resetear formulario al montar
    visitaStore.reset();
  });

  // Handlers para Step 1
  function handleParqueSelect(parque: Parque) {
    visitaStore.selectParque(parque);
    // Avanzar automáticamente al siguiente paso después de seleccionar
    visitaStore.nextStep();
  }

  async function handleLoadParques() {
    await visitaStore.loadParques();
  }

  // Handlers para Step 2
  async function handleCaptureGPS() {
    await visitaStore.captureGPS();
  }

  // Navegación
  async function handleNext() {
    if (!canContinue) return;

    // Validaciones específicas por paso antes de continuar
    if (currentStep === 1 && !state.selectedParque) {
      visitaStore.setError("Debe seleccionar un parque");
      return;
    }

    // Si estamos en el paso 1 y avanzamos al 2, verificar permisos GPS antes
    if (currentStep === 1) {
      const permissionStatus = await visitaStore.checkGPSPermission();
      
      if (permissionStatus === 'unavailable') {
        // GPS no disponible en el navegador
        modalTitle = "GPS No Disponible";
        modalMessage = "Tu navegador o dispositivo no soporta geolocalización. Necesitas un navegador moderno con capacidad GPS para registrar reconocimientos.";
        modalType = "error";
        modalShowCancel = false;
        modalConfirmText = "Entendido";
        modalOpen = true;
        return;
      }
      
      if (permissionStatus === 'denied') {
        // Permiso denegado - mostrar instrucciones
        modalTitle = "Permiso GPS Requerido";
        modalMessage = "El acceso a la ubicación ha sido denegado. Por favor, habilita el permiso de ubicación en la configuración de tu navegador y recarga la página para continuar.";
        modalType = "warning";
        modalShowCancel = false;
        modalConfirmText = "Entendido";
        modalOpen = true;
        return;
      }
      
      // Si el permiso es 'prompt', el navegador pedirá permiso automáticamente cuando intentemos capturar
      // Si el permiso es 'granted', continuamos normalmente
    }

    visitaStore.setError(null);
    visitaStore.nextStep();
  }

  function handleBack() {
    visitaStore.previousStep();
  }

  function handleStepClick(step: number) {
    visitaStore.goToStep(step as any);
  }

  function handleModalClose() {
    modalOpen = false;
    if (modalType === "success") {
      visitaStore.reset();
      onClose();
    }
  }

  function handleModalConfirm() {
    modalOpen = false;
    if (modalOnConfirm) {
      modalOnConfirm();
    }
  }

  // Envío del formulario
  async function handleSubmit() {
    if (!canContinue) return;

    submitError = null;
    submitting = true;

    try {
      // Validar que todos los campos requeridos estén completos
      const data = state.data;

      if (
        !state.selectedParque ||
        !data.coordenadas_gps ||
        !data.tipo_intervencion ||
        !data.descripcion_intervencion ||
        !data.direccion ||
        photoFiles.length === 0
      ) {
        throw new Error("Faltan campos requeridos. Asegúrese de completar todos los pasos incluyendo al menos una foto.");
      }

      console.log("Enviando reconocimiento al servidor...", {
        parque: state.selectedParque.nombre_up,
        tipo: data.tipo_intervencion,
        direccion: data.direccion,
      });

      // Preparar datos de reconocimiento con las coordenadas GPS capturadas
      const reconocimiento = {
        upid: state.selectedParque.upid,
        tipo_intervencion: data.tipo_intervencion,
        descripcion_intervencion: data.descripcion_intervencion,
        direccion: data.direccion,
        observaciones: data.observaciones || "",
        coordenadas_gps: data.coordenadas_gps,
        // Usar las coordenadas GPS capturadas, no las del parque
        coordinates_type: data.coordinates_type || "Point",
        coordinates_data: data.coordinates_data || JSON.stringify([data.coordenadas_gps.longitude, data.coordenadas_gps.latitude]),
      };

      // Enviar al backend usando el nuevo endpoint
      const response = await registrarReconocimiento(reconocimiento, photoFiles);

      if (response.success) {
        submitSuccess = true;
        console.log("Reconocimiento registrado exitosamente:", response);

        // Mostrar modal de éxito
        modalTitle = "¡Reconocimiento Registrado!";
        modalMessage = "El reconocimiento del parque se ha guardado correctamente.";
        modalType = "success";
        modalShowCancel = false;
        modalConfirmText = "Entendido";
        modalOpen = true;
      }
    } catch (error) {
      console.error("Error al enviar reconocimiento:", error);
      submitError =
        error instanceof Error ? error.message : "Error al registrar la verificación";

      // Mostrar modal de error
      modalTitle = "Error";
      modalMessage = submitError || "Ocurrió un error al guardar el reconocimiento.";
      modalType = "error";
      modalShowCancel = false;
      modalConfirmText = "Entendido";
      modalOpen = true;
    } finally {
      submitting = false;
    }
  }

  function handleCancel() {
    modalTitle = "¿Cancelar reconocimiento?";
    modalMessage = "Se perderán todos los datos ingresados hasta el momento.";
    modalType = "warning";
    modalShowCancel = true;
    modalConfirmText = "Sí, cancelar";
    modalCancelText = "Volver";
    modalOnConfirm = () => {
      visitaStore.reset();
      onClose();
    };
    modalOpen = true;
  }
</script>

<div class="visita-container">
  <!-- Header -->
  <div class="visita-header">
    <div class="header-content">
      <button class="back-btn" on:click={handleCancel}>
        <span class="back-icon">←</span>
      </button>
      <h1 class="header-title">Reconocimiento de Parque</h1>
    </div>
  </div>

  <!-- Stepper -->
  <div class="stepper-section">
    <Stepper
      currentStep={state.currentStep}
      steps={stepNames}
      completedSteps={state.completedSteps}
      onStepClick={handleStepClick}
    />
  </div>

  <!-- Contenido del paso actual -->
  <div class="step-content">
    {#if currentStep === 1}
      <Step1SeleccionUP
        parques={state.parques}
        selectedParque={state.selectedParque}
        onSelect={handleParqueSelect}
        onLoadParques={handleLoadParques}
        isLoading={state.isLoading}
      />
    {:else if currentStep === 2}
      <Step2Formulario
        coordenadas={state.data.coordenadas_gps}
        bind:tipoIntervencion={state.data.tipo_intervencion}
        bind:descripcionIntervencion={state.data.descripcion_intervencion}
        bind:observaciones={state.data.observaciones}
        selectedParque={state.selectedParque ?? undefined}
        onCaptureGPS={handleCaptureGPS}
        isLoading={state.isLoading}
      />
    {:else if currentStep === 3}
      <Step3Fotos
        bind:photoFiles
      />
    {/if}

    <!-- Error global -->
    {#if state.error}
      <div class="global-error">
        {state.error}
      </div>
    {/if}

    <!-- Navegación inferior (dentro del flujo) -->
    <div class="navigation-footer">
      <div class="nav-buttons">
        {#if currentStep > 1}
          <div class="btn-wrapper left">
            <Button
              variant="outline"
              size="md"
              onClick={handleBack}
              disabled={submitting}
            >
              Atrás
            </Button>
          </div>
        {:else}
          <div class="btn-wrapper left"></div>
          <!-- Spacer -->
        {/if}

        {#if currentStep < 3}
          <div class="btn-wrapper right">
            <Button
              variant="primary"
              size="md"
              onClick={handleNext}
              disabled={!canContinue || state.isLoading}
            >
              Continuar
            </Button>
          </div>
        {:else}
          <div class="btn-wrapper right">
            <Button
              variant="primary"
              size="md"
              fullWidth={true}
              onClick={handleSubmit}
              disabled={!canContinue || submitting}
            >
              {submitting ? "Enviando..." : "Finalizar"}
            </Button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Modal de confirmación -->
  <Modal
    isOpen={modalOpen}
    title={modalTitle}
    message={modalMessage}
    type={modalType}
    showCancel={modalShowCancel}
    confirmText={modalConfirmText}
    cancelText={modalCancelText}
    on:close={handleModalClose}
    on:confirm={handleModalConfirm}
  />
</div>

<style>
  .visita-container {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background: #f9fafb; /* Light background always */
  }

  .visita-header {
    background: white;
    color: #111827;
    padding: 0.5rem 1rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    position: sticky;
    top: 0;
    z-index: 100;
    border-bottom: 1px solid #f3f4f6;
  }

  .header-content {
    max-width: 600px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 44px;
  }

  .back-btn {
    background: transparent;
    border: none;
    color: #4b5563;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .back-btn:hover {
    background: #f3f4f6;
  }

  .back-icon {
    font-size: 1.25rem;
    line-height: 1;
  }

  .header-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    color: #111827;
  }

  .stepper-section {
    background: white;
    padding: 0 1rem;
    border-bottom: 1px solid #f3f4f6;
    position: sticky;
    top: 53px; /* Height of header + padding */
    z-index: 99;
  }

  .step-content {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 2rem;
    background: #f9fafb;
    display: flex;
    flex-direction: column;
  }

  .global-error {
    margin: 0.75rem;
    padding: 0.75rem;
    background: #fee2e2;
    color: #991b1b;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    border-left: 4px solid #ef4444;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }

  .navigation-footer {
    margin-top: auto; /* Push to bottom of flex container */
    padding: 2rem 1rem 1rem 1rem; /* Top margin/padding from content */
    width: 100%;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }

  .nav-buttons {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .btn-wrapper {
    flex: 1;
  }

  .btn-wrapper.left {
    display: flex;
    justify-content: flex-start;
  }

  .btn-wrapper.right {
    display: flex;
    justify-content: flex-end;
  }
</style>
