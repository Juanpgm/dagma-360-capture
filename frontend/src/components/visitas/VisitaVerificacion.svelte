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
  import type { PlantaEntry } from "../../types/visitas";
  import type { GrupoFormType, GrupoKey } from "../../lib/grupos";
  import { GRUPO_KEYS } from "../../lib/grupos";
  // import { getGrupoConfig, type GrupoConfig } from "../../lib/grupos";
  import Stepper from "../ui/Stepper.svelte";
  import Button from "../ui/Button.svelte";
  import Modal from "../ui/Modal.svelte";
  import Step1SeleccionUP from "./Step1SeleccionUP.svelte";
  import Step2Formulario from "./Step2Formulario.svelte";
  import Step3Fotos from "./Step3Fotos.svelte";

  export let onClose: () => void;

  let submitting = false;
  let submitError: string | null = null;
  let submitSuccess = false;
  let photoFiles: File[] = [];

  // Variables locales para el formulario Step 2 (necesarias para bindings)
  let tipoIntervencion = "";
  let descripcionIntervencion = "";
  let direccion = "";
  let observaciones = "";

  // Variables CUADRILLA
  let individuosIntervenidos: number | undefined = undefined;
  let nombreCientifico: string | undefined = undefined;
  let nombreComun: string | undefined = undefined;

  // Variables para grupos adicionales
  let unidadesImpactadas: number | undefined = undefined;
  let unidadMedida: string = "";
  let tiposPlantas: PlantaEntry[] = [{ nombre: "", cantidad: 0 }];

  // Estado del modal
  let modalOpen = false;
  let modalTitle = "";
  let modalMessage = "";
  let modalType: "success" | "error" | "info" | "warning" = "info";
  let modalShowCancel = false;
  let modalConfirmText = "Entendido";
  let modalCancelText = "Cancelar";
  let modalOnConfirm: (() => void) | null = null;

  const extractUserGroups = (user: any): string[] => {
    const groups: string[] = [];

    const addValue = (value: any) => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach(addValue);
        return;
      }
      if (typeof value === "string" || typeof value === "number") {
        groups.push(String(value));
        return;
      }
      if (typeof value === "object") {
        const nested =
          value.grupo ||
          value.nombre ||
          value.nombre_grupo ||
          value.name ||
          value.label;
        if (nested) {
          addValue(nested);
        }
      }
    };

    addValue(
      user?.grupo ||
        user?.group ||
        user?.grupo_nombre ||
        user?.grupoName ||
        user?.nombre_grupo,
    );
    addValue(user?.grupos);
    addValue(user?.grupos_requeridos);

    return groups.filter(Boolean);
  };

  // Suscripción al store
  $: state = $visitaStore;
  $: currentUser = $authStore.user;
  $: userGrupo = extractUserGroups(currentUser);
  // Determinar el tipo de formulario según el grupo del usuario
  $: grupoFormType = ((Array.isArray(userGrupo) ? userGrupo[0] : userGrupo || '') as string).toLowerCase() as GrupoFormType;
  $: isCuadrilla = grupoFormType === "cuadrilla";
  $: canContinue =
    currentStep === 3
      ? photoFiles.length > 0
      : currentStep === 2
        ? tipoIntervencion &&
          descripcionIntervencion &&
          (isCuadrilla || direccion) &&
          // Validación específica por grupo
          (grupoFormType === "cuadrilla"
            ? individuosIntervenidos != null &&
              individuosIntervenidos > 0 &&
              nombreCientifico
            : grupoFormType === "vivero"
              ? tiposPlantas.some((p) => p.nombre && p.cantidad > 0)
                : grupoFormType === "gobernanza" || 
                  grupoFormType === "umata"
                ? unidadesImpactadas != null && unidadesImpactadas > 0
                : grupoFormType === "ecosistemas"
                  ? unidadMedida &&
                    unidadesImpactadas != null &&
                    unidadesImpactadas > 0
                  : true) // otros: sin campos extra específicos
        : $isCurrentStepValid;
  $: currentStep = state.currentStep;

  onMount(() => {
    // Resetear formulario al montar
    visitaStore.reset();
    // Resetear variables locales
    tipoIntervencion = "";
    descripcionIntervencion = "";
    direccion = "";
    observaciones = "";
    individuosIntervenidos = undefined;
    nombreCientifico = undefined;
    nombreComun = undefined;
    unidadesImpactadas = undefined;
    unidadMedida = "";
    tiposPlantas = [{ nombre: "", cantidad: 0 }];
  });

  // Handlers para Step 1
  function handleActividadSelect(actividad: ActividadPlanDistritoVerde) {
    visitaStore.selectActividad(actividad);
    // Para CUADRILLA, el tipo se elige manualmente en Step2
    if (!isCuadrilla) {
      tipoIntervencion = actividad.tipo_jornada || "Sin especificar";
    }
    direccion =
      actividad.punto_encuentro?.direccion || "Sin dirección registrada";
    // Avanzar automáticamente al siguiente paso después de seleccionar
    visitaStore.nextStep();
  }

  async function handleLoadActividades() {
    await visitaStore.loadActividades();
  }

  // Handlers para Step 2
  async function handleCaptureGPS() {
    await visitaStore.captureGPS();
  }

  // Navegación
  async function handleNext() {
    if (!canContinue) return;

    // Validaciones específicas por paso antes de continuar
    if (currentStep === 1 && !state.selectedActividad) {
      visitaStore.setError("Debe seleccionar una actividad");
      return;
    }

    // Si estamos en paso 2, sincronizar datos locales al store antes de avanzar
    if (currentStep === 2) {
      if (state.selectedActividad && !isCuadrilla) {
        tipoIntervencion ||=
          state.selectedActividad.tipo_jornada || "Sin especificar";
      }
      if (state.selectedActividad) {
        direccion ||=
          state.selectedActividad.punto_encuentro?.direccion ||
          "Sin dirección registrada";
      }
      const updatePayload: Record<string, any> = {
        tipo_intervencion: tipoIntervencion,
        descripcion_intervencion: descripcionIntervencion,
        direccion: direccion,
        observaciones: observaciones,
      };
      if (grupoFormType === "cuadrilla") {
        updatePayload.individuos_intervenidos = individuosIntervenidos;
        updatePayload.nombre_cientifico = nombreCientifico;
        updatePayload.nombre_comun = nombreComun;
      }
      if (grupoFormType === "vivero") {
        updatePayload.tipos_plantas = tiposPlantas;
      }
      if (
        ["gobernanza", "ecosistemas", "umata"].includes(grupoFormType)
      ) {
        updatePayload.unidades_impactadas = unidadesImpactadas;
      }
      if (grupoFormType === "ecosistemas") {
        updatePayload.unidad_medida = unidadMedida;
      }
      visitaStore.updateData(updatePayload);
    }

    // Si estamos en el paso 1 y avanzamos al 2, verificar permisos GPS antes
    if (currentStep === 1) {
      const permissionStatus = await visitaStore.checkGPSPermission();

      if (permissionStatus === "unavailable" || permissionStatus === "denied") {
        // Sin GPS o permiso denegado → continuar con coordenadas por defecto (Cali)
        // No bloqueamos el flujo; geolocation.ts ya aplica el fallback al capturar.
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
      // Sincronizar las variables locales al store antes del envío
      if (state.selectedActividad && !isCuadrilla) {
        tipoIntervencion ||=
          state.selectedActividad.tipo_jornada || "Sin especificar";
      }
      if (state.selectedActividad) {
        direccion ||=
          state.selectedActividad.punto_encuentro?.direccion ||
          "Sin dirección registrada";
      }

      const updatePayload: Record<string, any> = {
        tipo_intervencion: tipoIntervencion,
        descripcion_intervencion: descripcionIntervencion,
        direccion: direccion,
        observaciones: observaciones,
      };
      if (grupoFormType === "cuadrilla") {
        updatePayload.individuos_intervenidos = individuosIntervenidos;
        updatePayload.nombre_cientifico = nombreCientifico;
        updatePayload.nombre_comun = nombreComun;
      }
      if (grupoFormType === "vivero") {
        updatePayload.tipos_plantas = tiposPlantas;
      }
      if (
        ["gobernanza", "ecosistemas", "umata"].includes(grupoFormType)
      ) {
        updatePayload.unidades_impactadas = unidadesImpactadas;
      }
      if (grupoFormType === "ecosistemas") {
        updatePayload.unidad_medida = unidadMedida;
      }
      visitaStore.updateData(updatePayload);

      // Validar que todos los campos requeridos estén completos
      const data = state.data;

      if (
        !state.selectedActividad ||
        !tipoIntervencion ||
        !descripcionIntervencion ||
        photoFiles.length === 0
      ) {
        throw new Error(
          "Faltan campos requeridos. Asegúrese de completar todos los pasos incluyendo al menos una foto.",
        );
      }

      // Validación adicional para NO-CUADRILLA
      if (!isCuadrilla && !direccion) {
        throw new Error("La dirección es requerida");
      }

      console.log("Enviando reconocimiento al servidor...", {
        actividad: state.selectedActividad.objetivo_actividad,
        tipo: data.tipo_intervencion,
        direccion: data.direccion,
      });

      // Preparar coordenadas: Usar GPS capturado O fallback al punto de encuentro
      let finalCoordenadas = data.coordenadas_gps;
      let finalCoordinatesData = data.coordinates_data;
      let finalCoordinatesType = data.coordinates_type || "Point";

      // Si no hay GPS capturado, usar ubicación de la actividad
      if (!finalCoordenadas && state.selectedActividad) {
        console.log(
          "⚠️ No hay GPS capturado, usando punto de encuentro de la actividad...",
        );
        const actividad = state.selectedActividad;
        const geometry = actividad.punto_encuentro?.geometry;

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
          console.log("✅ Usando punto de encuentro:", finalCoordenadas);
        }
      }

      // Validación final de coordenadas — fallback a Cali si todo falla
      if (!finalCoordenadas) {
        finalCoordenadas = { latitude: 3.4516, longitude: -76.5320, accuracy: 0, timestamp: Date.now() };
        finalCoordinatesType = "Point";
        finalCoordinatesData = JSON.stringify([-76.5320, 3.4516]);
      }

      let response;

      // Campos comunes para el endpoint unificado
      const commonFields = {
        tipo_intervencion: tipoIntervencion,
        descripcion_intervencion: descripcionIntervencion,
        registrado_por:
          currentUser?.nombre_completo ||
          currentUser?.displayName ||
          currentUser?.email ||
          "Usuario",
        grupo: currentUser?.grupo || userGrupo[0] || grupoFormType,
        id_actividad: state.selectedActividad?.id || "",
        observaciones: observaciones || "",
        coordinates_type: finalCoordinatesType,
        coordinates_data:
          finalCoordinatesData ||
          JSON.stringify([
            finalCoordenadas.longitude,
            finalCoordenadas.latitude,
          ]),
      };

      const params: RegistrarIntervencionParams = {
        common: commonFields,
        direccion: direccion || "Sin dirección registrada",
      };

      // Campos específicos por grupo
      switch (grupoFormType) {
        case "cuadrilla": {
          if (!nombreComun || !nombreCientifico) {
            throw new Error("Debe seleccionar una especie de árbol");
          }
          if (!individuosIntervenidos || individuosIntervenidos < 1) {
            throw new Error(
              "Debe indicar el número de individuos intervenidos",
            );
          }
          params.arboles_data = JSON.stringify([
            {
              especie: `${nombreComun} (${nombreCientifico})`,
              cantidad: individuosIntervenidos,
            },
          ]);
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
          if (!unidadMedida) {
            throw new Error("Debe seleccionar una unidad de medida");
          }
          if (!unidadesImpactadas || unidadesImpactadas < 1) {
            throw new Error("Debe indicar las unidades impactadas");
          }
          params.unidad_medida = unidadMedida;
          params.unidades_impactadas = unidadesImpactadas;
          break;
        }
      }

      if (!GRUPO_KEYS.includes(grupoFormType as GrupoKey)) {
        throw new Error(`El grupo "${grupoFormType}" no es válido para registrar intervenciones`);
      }
      response = await registrarIntervencion(
        grupoFormType as GrupoKey,
        params,
        photoFiles,
      );

      if (response.success) {
        submitSuccess = true;
        console.log("Reconocimiento registrado exitosamente:", response);

        // Mostrar modal de éxito
        modalTitle = "¡Reconocimiento Registrado!";
        modalMessage =
          "El reconocimiento de la actividad se ha guardado correctamente.";
        modalType = "success";
        modalShowCancel = false;
        modalConfirmText = "Entendido";
        modalOpen = true;
      }
    } catch (error) {
      console.error("Error al enviar reconocimiento:", error);

      // Extraer mensaje de error de diferentes formatos
      let errorMessage = "Error al registrar la verificación";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else if (error && typeof error === "object") {
        // Intentar extraer mensaje de diferentes propiedades comunes
        const errorObj = error as any;
        errorMessage =
          errorObj.message ||
          errorObj.error ||
          errorObj.detail ||
          errorObj.msg ||
          JSON.stringify(error);
      }

      submitError = errorMessage;

      // Mostrar modal de error
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
      <h1 class="header-title">Reconocimiento de Actividad</h1>
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
        actividades={state.actividades}
        selectedActividad={state.selectedActividad}
        onSelect={handleActividadSelect}
        onLoadActividades={handleLoadActividades}
        isLoading={state.isLoading}
        {userGrupo}
      />
    {:else if currentStep === 2}
      <Step2Formulario
        coordenadas={state.data.coordenadas_gps}
        bind:tipoIntervencion
        bind:descripcionIntervencion
        bind:direccion
        bind:observaciones
        selectedActividad={state.selectedActividad ?? undefined}
        onCaptureGPS={handleCaptureGPS}
        isLoading={state.isLoading}
        {isCuadrilla}
        grupoFormType={grupoFormType}
        bind:individuosIntervenidos
        bind:nombreCientifico
        bind:nombreComun
        bind:unidadesImpactadas
        bind:unidadMedida
        bind:tiposPlantas
      />
    {:else if currentStep === 3}
      <Step3Fotos bind:photoFiles />
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
