<script lang="ts">
  import { onMount } from "svelte";
  import {
    visitaStore,
    stepNames,
    isCurrentStepValid,
  } from "../../stores/visitaStore";
  import { authStore } from "../../stores/authStore";
  import {
    registrarIntervencion,
    type RegistrarIntervencionParams,
  } from "../../api/visitas";
  import type { ActividadPlanDistritoVerde } from "../../types/actividades";
  import type { PlantaEntry, ArbolEntry } from "../../types/visitas";
  import type { GrupoKey, GrupoFormType } from "../../lib/grupos";
  import Stepper from "../ui/Stepper.svelte";
  import Button from "../ui/Button.svelte";
  import Modal from "../ui/Modal.svelte";
  import GrupoSelector from "./GrupoSelector.svelte";
  import Step1SeleccionUP from "./Step1SeleccionUP.svelte";
  import Step2Formulario from "./Step2Formulario.svelte";
  import Step3Fotos from "./Step3Fotos.svelte";

  export let onClose: () => void;

  let selectedGrupo: GrupoKey | null = null;

  let submitting = false;
  let submitError: string | null = null;
  let submitSuccess = false;
  let photoFiles: File[] = [];

  let tipoIntervencion = "";
  let descripcionIntervencion = "";
  let direccion = "";
  let observaciones = "";

  let arbolesData: ArbolEntry[] = [{ especie: "", cantidad: 0 }];
  let unidadesImpactadas: number | undefined = undefined;
  let unidadMedida: string = "";
  let tiposPlantas: PlantaEntry[] = [{ nombre: "", cantidad: 0 }];

  let modalOpen = false;
  let modalTitle = "";
  let modalMessage = "";
  let modalType: "success" | "error" | "info" | "warning" = "info";
  let modalShowCancel = false;
  let modalConfirmText = "Entendido";
  let modalCancelText = "Cancelar";
  let modalOnConfirm: (() => void) | null = null;

  $: state = $visitaStore;
  $: currentUser = $authStore.user;
  $: grupoFormType = (selectedGrupo ?? "operativo") as GrupoFormType;
  $: isCuadrilla = grupoFormType === "cuadrilla";
  $: canContinue =
    state.currentStep === 3
      ? photoFiles.length > 0
      : state.currentStep === 2
        ? tipoIntervencion &&
          descripcionIntervencion &&
          (isCuadrilla || direccion) &&
          (grupoFormType === "cuadrilla"
            ? arbolesData.some((a) => a.especie && a.cantidad > 0)
            : grupoFormType === "vivero"
              ? tiposPlantas.some((p) => p.nombre && p.cantidad > 0)
              : grupoFormType === "gobernanza" || grupoFormType === "umata"
                ? unidadesImpactadas != null && unidadesImpactadas > 0
                : grupoFormType === "ecosistemas"
                  ? unidadMedida &&
                    unidadesImpactadas != null &&
                    unidadesImpactadas > 0
                  : true)
        : $isCurrentStepValid;

  onMount(() => {
    resetLocalState();
  });

  function resetLocalState() {
    visitaStore.reset();
    tipoIntervencion = "";
    descripcionIntervencion = "";
    direccion = "";
    observaciones = "";
    unidadesImpactadas = undefined;
    unidadMedida = "";
    tiposPlantas = [{ nombre: "", cantidad: 0 }];
    arbolesData = [{ especie: "", cantidad: 0 }];
    photoFiles = [];
  }

  function handleGrupoSelect(grupo: GrupoKey) {
    selectedGrupo = grupo;
    resetLocalState();
  }

  function handleActividadSelect(actividad: ActividadPlanDistritoVerde) {
    visitaStore.selectActividad(actividad);
    if (!isCuadrilla) {
      const defaults: Partial<Record<string, string>> = {
        vivero: "Siembra en sitio definitivo",
        gobernanza: "Jornada de sensibilizacion ambiental",
        ecosistemas: "Restauracion ecologica",
        umata: "Visita tecnica predial",
      };
      tipoIntervencion =
        defaults[grupoFormType] || actividad.tipo_jornada || "Sin especificar";
    }
    direccion =
      actividad.punto_encuentro?.direccion || "Sin direccion registrada";
    visitaStore.nextStep();
  }

  async function handleLoadActividades() {
    await visitaStore.loadActividades();
  }

  async function handleCaptureGPS() {
    await visitaStore.captureGPS();
  }

  async function handleNext() {
    if (!canContinue) return;

    if (state.currentStep === 1 && !state.selectedActividad) {
      visitaStore.setError("Debe seleccionar una actividad");
      return;
    }

    if (state.currentStep === 2) {
      if (state.selectedActividad && !isCuadrilla) {
        tipoIntervencion ||=
          state.selectedActividad.tipo_jornada || "Sin especificar";
      }
      if (state.selectedActividad) {
        direccion ||=
          state.selectedActividad.punto_encuentro?.direccion ||
          "Sin direccion registrada";
      }
      const updatePayload: Record<string, any> = {
        tipo_intervencion: tipoIntervencion,
        descripcion_intervencion: descripcionIntervencion,
        direccion,
        observaciones,
      };
      if (grupoFormType === "cuadrilla") updatePayload.arboles_data = arbolesData;
      if (grupoFormType === "vivero") updatePayload.tipos_plantas = tiposPlantas;
      if (["gobernanza", "ecosistemas", "umata"].includes(grupoFormType)) {
        updatePayload.unidades_impactadas = unidadesImpactadas;
      }
      if (grupoFormType === "ecosistemas") updatePayload.unidad_medida = unidadMedida;
      visitaStore.updateData(updatePayload);
    }

    if (state.currentStep === 1) {
      await visitaStore.checkGPSPermission();
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
      selectedGrupo = null;
      resetLocalState();
      onClose();
    }
  }

  function handleModalConfirm() {
    modalOpen = false;
    if (modalOnConfirm) modalOnConfirm();
  }

  async function handleSubmit() {
    if (!canContinue || !selectedGrupo) return;

    submitError = null;
    submitting = true;

    try {
      if (state.selectedActividad && !isCuadrilla) {
        tipoIntervencion ||=
          state.selectedActividad.tipo_jornada || "Sin especificar";
      }
      if (state.selectedActividad) {
        direccion ||=
          state.selectedActividad.punto_encuentro?.direccion ||
          "Sin direccion registrada";
      }

      const updatePayload: Record<string, any> = {
        tipo_intervencion: tipoIntervencion,
        descripcion_intervencion: descripcionIntervencion,
        direccion,
        observaciones,
      };
      if (grupoFormType === "cuadrilla") updatePayload.arboles_data = arbolesData;
      if (grupoFormType === "vivero") updatePayload.tipos_plantas = tiposPlantas;
      if (["gobernanza", "ecosistemas", "umata"].includes(grupoFormType)) {
        updatePayload.unidades_impactadas = unidadesImpactadas;
      }
      if (grupoFormType === "ecosistemas") updatePayload.unidad_medida = unidadMedida;
      visitaStore.updateData(updatePayload);

      const data = state.data;

      if (
        !state.selectedActividad ||
        !tipoIntervencion ||
        !descripcionIntervencion ||
        photoFiles.length === 0
      ) {
        throw new Error(
          "Faltan campos requeridos. Complete todos los pasos incluyendo al menos una foto.",
        );
      }

      if (!isCuadrilla && !direccion) throw new Error("La direccion es requerida");

      let finalCoordenadas = data.coordenadas_gps;
      let finalCoordinatesData = data.coordinates_data;
      let finalCoordinatesType = data.coordinates_type || "Point";

      if (!finalCoordenadas && state.selectedActividad) {
        const geometry = state.selectedActividad.punto_encuentro?.geometry;
        if (geometry?.coordinates && geometry.coordinates.length >= 2) {
          const [lon, lat] = geometry.coordinates;
          finalCoordenadas = {
            latitude: lat,
            longitude: lon,
            accuracy: 0,
            timestamp: Date.now(),
          };
          finalCoordinatesType = geometry.type || "Point";
          finalCoordinatesData = JSON.stringify([lon, lat]);
        }
      }

      if (!finalCoordenadas) {
        finalCoordenadas = {
          latitude: 3.4516,
          longitude: -76.532,
          accuracy: 0,
          timestamp: Date.now(),
        };
        finalCoordinatesType = "Point";
        finalCoordinatesData = JSON.stringify([-76.532, 3.4516]);
      }

      const params: RegistrarIntervencionParams = {
        tipo_intervencion: tipoIntervencion,
        descripcion_intervencion: descripcionIntervencion,
        registrado_por:
          currentUser?.nombre_completo ||
          currentUser?.displayName ||
          currentUser?.email ||
          "Usuario",
        grupo: selectedGrupo!,
        id_actividad: state.selectedActividad?.id || "",
        observaciones: observaciones || "",
        coordinates_type: finalCoordinatesType,
        coordinates_data:
          finalCoordinatesData ||
          JSON.stringify([finalCoordenadas.longitude, finalCoordenadas.latitude]),
        direccion: direccion || "Sin direccion registrada",
      };

      switch (grupoFormType) {
        case "cuadrilla": {
          const arbolesValidos = arbolesData.filter(
            (a) => a.especie && a.cantidad > 0,
          );
          if (arbolesValidos.length === 0) {
            throw new Error("Debe agregar al menos un arbol con especie y cantidad");
          }
          params.arboles_data = JSON.stringify(arbolesValidos);
          break;
        }
        case "vivero": {
          const plantasValidas = tiposPlantas.filter(
            (p) => p.nombre && p.cantidad > 0,
          );
          if (plantasValidas.length === 0) {
            throw new Error("Debe agregar al menos una planta con cantidad");
          }
          const tiposPlantasDict: Record<string, number> = {};
          plantasValidas.forEach((p) => {
            tiposPlantasDict[p.nombre] = p.cantidad;
          });
          params.tipos_plantas = JSON.stringify(tiposPlantasDict);
          break;
        }
        case "gobernanza":
        case "umata": {
          if (!unidadesImpactadas || unidadesImpactadas < 1) {
            throw new Error("Debe indicar las unidades impactadas");
          }
          params.unidades_impactadas = unidadesImpactadas;
          break;
        }
        case "ecosistemas": {
          if (!unidadMedida) throw new Error("Debe seleccionar una unidad de medida");
          if (!unidadesImpactadas || unidadesImpactadas < 1) {
            throw new Error("Debe indicar las unidades impactadas");
          }
          params.unidad_medida = unidadMedida;
          params.unidades_impactadas = unidadesImpactadas;
          break;
        }
      }

      const response = await registrarIntervencion(selectedGrupo, params, photoFiles);

      if (response.success) {
        submitSuccess = true;
        modalTitle = "Reporte Registrado";
        modalMessage = "El reporte de intervencion se ha guardado correctamente.";
        modalType = "success";
        modalShowCancel = false;
        modalConfirmText = "Entendido";
        modalOpen = true;
      }
    } catch (error) {
      console.error("Error al enviar reporte:", error);
      let errorMessage = "Error al registrar el reporte";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === "object") {
        const e = error as any;
        errorMessage =
          e.message || e.error || e.detail || e.msg || JSON.stringify(error);
      }
      submitError = errorMessage;
      modalTitle = "Error";
      modalMessage = errorMessage;
      modalType = "error";
      modalShowCancel = false;
      modalConfirmText = "Entendido";
      modalOpen = true;
    } finally {
      submitting = false;
    }
  }

  function handleCancel() {
    modalTitle = "Cancelar reporte?";
    modalMessage = "Se perderan todos los datos ingresados.";
    modalType = "warning";
    modalShowCancel = true;
    modalConfirmText = "Si, cancelar";
    modalCancelText = "Volver";
    modalOnConfirm = () => {
      selectedGrupo = null;
      resetLocalState();
      onClose();
    };
    modalOpen = true;
  }
</script>

{#if !selectedGrupo}
  <GrupoSelector onSelect={handleGrupoSelect} onCancel={onClose} />
{:else}
  <div class="visita-container">
    <div class="visita-header">
      <div class="header-content">
        <button class="back-btn" on:click={handleCancel} aria-label="Cancelar">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 class="header-title">Reconocimiento de Actividad</h1>
      </div>
    </div>

    <div class="stepper-section">
      <Stepper
        currentStep={state.currentStep}
        steps={stepNames}
        completedSteps={state.completedSteps}
        onStepClick={handleStepClick}
      />
    </div>

    <div class="step-content">
      {#if state.currentStep === 1}
        <Step1SeleccionUP
          actividades={state.actividades}
          selectedActividad={state.selectedActividad}
          onSelect={handleActividadSelect}
          onLoadActividades={handleLoadActividades}
          isLoading={state.isLoading}
        />
      {:else if state.currentStep === 2}
        <Step2Formulario
          coordenadas={state.data.coordenadas_gps}
          bind:tipoIntervencion
          bind:descripcionIntervencion
          bind:direccion
          bind:observaciones
          selectedActividad={state.selectedActividad ?? undefined}
          onCaptureGPS={handleCaptureGPS}
          isLoading={state.isLoading}
          {grupoFormType}
          bind:arbolesData
          bind:unidadesImpactadas
          bind:unidadMedida
          bind:tiposPlantas
        />
      {:else if state.currentStep === 3}
        <Step3Fotos bind:photoFiles />
      {/if}

      {#if state.error}
        <div class="global-error">{state.error}</div>
      {/if}

      <div class="navigation-footer">
        <div class="nav-buttons">
          {#if state.currentStep > 1}
            <div class="btn-wrapper left">
              <Button
                variant="outline"
                size="md"
                onClick={handleBack}
                disabled={submitting}
              >
                Atras
              </Button>
            </div>
          {:else}
            <div class="btn-wrapper left"></div>
          {/if}

          {#if state.currentStep < 3}
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
{/if}

<style>
  .visita-container {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background: #f9fafb;
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
    flex-shrink: 0;
  }

  .back-btn:hover {
    background: #f3f4f6;
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
    top: 53px;
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
    margin-top: auto;
    padding: 2rem 1rem 1rem 1rem;
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