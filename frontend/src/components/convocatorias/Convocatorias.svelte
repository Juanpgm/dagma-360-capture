<script lang="ts">
  import { onMount, afterUpdate, tick } from "svelte";
  import {
    convocarActividad,
    eliminarActividadPlanDistritoVerde,
    getActividadesPlanDistritoVerde,
    getGoogleMapsUrl,
    getLideresGrupo,
    modificarActividadPlanDistritoVerde,
  } from "../../api/actividades";
  import { GRUPOS_DAGMA } from "../../lib/grupos";
  import { authStore } from "../../stores/authStore";
  import type { LiderGrupoOption } from "../../api/actividades";
  import type { ActividadPlanDistritoVerde } from "../../types/actividades";

  // Estado
  let actividades: ActividadPlanDistritoVerde[] = [];
  let filteredActividades: ActividadPlanDistritoVerde[] = [];
  let loading = true;
  let error = "";

  // Mapas de Leaflet
  let leafletLoaded = false;
  let initializedMaps = new Set<string>();

  // Filtros
  let searchQuery = "";
  let selectedGrupo = "";
  let selectedTipoJornada = "";
  let selectedLider = "";
  let fechaDesde = "";
  let fechaHasta = "";
  let filtrosVisibles = true;

  // Opciones para filtros
  let grupos: string[] = [];
  let tiposJornada: string[] = [];
  let lideres: string[] = [];
  let lideresGrupoOptions: LiderGrupoOption[] = [];
  let liderDropdownOpen = false;
  let liderSearchQuery = "";
  let liderDropdownRef: HTMLDivElement | null = null;
  let gruposDropdownOpen = false;
  let gruposSearchQuery = "";
  let gruposDropdownRef: HTMLDivElement | null = null;
  let dateRangeOpen = false;
  let dateRangeRef: HTMLDivElement | null = null;
  let headerSectionElement: HTMLDivElement | null = null;
  let showBackToTopButton = false;
  let timeNow = new Date(); // Variable reactiva para actualizar contadores
  const gruposCatalogo = [...new Set(GRUPOS_DAGMA)].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  const tiposJornadaDefault = [
    "Jornada de Limpieza",
    "Jornada de Siembra",
    "Jornada de Mantenimiento",
    "Jornada de Sensibilización",
    "Jornada Comunitaria",
  ];

  // Estado modal convocar actividad
  let isConvocatoriaModalOpen = false;
  let pasoConvocatoria = 1;
  let guardandoConvocatoria = false;
  let convocatoriaError = "";
  let convocatoriaFeedback = "";
  let convocatoriaFeedbackType: "success" | "error" = "success";
  let convocatoriaModalElement: HTMLDivElement | null = null;
  let deletingActividadId: string | null = null;
  let modifyingActividadId: string | null = null;
  let isEditMode = false;
  let editingActividadId: string | null = null;
  let isConfirmModifyModalOpen = false;
  let pendingModifyPayload: any = null;
  let pendingModifyActividadId: string | null = null;
  let isAsignarPersonalModalOpen = false;
  let actividadAsignacionActual: ActividadPlanDistritoVerde | null = null;
  let asignacionDropdownOpen = false;
  let asignacionSearchQuery = "";
  let personalSeleccionadoAsignacion: PersonalGrupoItem[] = [];
  let personalAsignadoPorActividad: Record<string, PersonalGrupoItem[]> = {};

  let tipoJornadaForm = "";
  let fechaActividadForm = "";
  let horaEncuentroForm = "";
  let duracionHorasForm: string | number = "";
  let gruposRequeridosForm: string[] = [];
  let liderActividadForm = "";
  let objetivoActividadForm = "";
  let observacionesForm = "";

  let direccionPuntoEncuentroForm = "";
  let latitudPuntoEncuentroForm: string | number = "";
  let longitudPuntoEncuentroForm: string | number = "";
  let latitudPuntoEncuentroNumero = Number.NaN;
  let longitudPuntoEncuentroNumero = Number.NaN;
  let tiposJornadaDisponibles: string[] = [];

  interface PersonalGrupoItem {
    id: string;
    nombreCompleto: string;
    telefono: string;
    grupo: string;
  }

  interface PersonalGrupoApiItem {
    id?: string;
    nombre_completo?: string;
    telefono?: string;
    grupo?: string;
  }

  const personalDummyCatalogo: PersonalGrupoItem[] = [
    {
      id: "reaccion-1",
      nombreCompleto: "Laura Camila Rojas",
      telefono: "3001234501",
      grupo: "REACCIÓN",
    },
    {
      id: "reaccion-2",
      nombreCompleto: "Julián Andrés Peña",
      telefono: "3001234502",
      grupo: "REACCIÓN",
    },
    {
      id: "iec-1",
      nombreCompleto: "Mónica Andrea Cardona",
      telefono: "3001234503",
      grupo: "IEC-Gobernanza",
    },
    {
      id: "iec-2",
      nombreCompleto: "Santiago López Mejía",
      telefono: "3001234504",
      grupo: "IEC-Gobernanza",
    },
    {
      id: "cuadrilla-1",
      nombreCompleto: "Diana Marcela Arboleda",
      telefono: "3001234505",
      grupo: "CUADRILLA",
    },
    {
      id: "cuadrilla-2",
      nombreCompleto: "Carlos Eduardo Benítez",
      telefono: "3001234506",
      grupo: "CUADRILLA",
    },
    {
      id: "hidrico-1",
      nombreCompleto: "Natalia Gómez Ruiz",
      telefono: "3001234507",
      grupo: "HIDRICO",
    },
    {
      id: "hidrico-2",
      nombreCompleto: "Felipe Andrés Vásquez",
      telefono: "3001234508",
      grupo: "HIDRICO",
    },
  ];

  function normalizeSearchValue(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function normalizeTextInput(value: string | number): string {
    return `${value ?? ""}`.trim();
  }

  function parseCoordinate(value: string | number): number {
    const normalizedValue = normalizeTextInput(value).replace(",", ".");
    return Number(normalizedValue);
  }

  function updateBackToTopVisibility(): void {
    if (!headerSectionElement) {
      showBackToTopButton = window.scrollY > 220;
      return;
    }

    const headerRect = headerSectionElement.getBoundingClientRect();
    showBackToTopButton = headerRect.bottom <= 0;
  }

  function handleWindowScroll(): void {
    updateBackToTopVisibility();
  }

  function scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $: latitudPuntoEncuentroNumero = parseCoordinate(latitudPuntoEncuentroForm);
  $: longitudPuntoEncuentroNumero = parseCoordinate(longitudPuntoEncuentroForm);

  $: tiposJornadaDisponibles =
    tiposJornada.length > 0 ? tiposJornada : tiposJornadaDefault;

  $: filteredLideresGrupoOptions = lideresGrupoOptions.filter((lider) => {
    const query = normalizeSearchValue(liderSearchQuery);
    if (!query) return true;

    return (
      normalizeSearchValue(lider.nombre).includes(query) ||
      normalizeSearchValue(lider.grupo).includes(query)
    );
  });

  $: liderSeleccionado =
    lideresGrupoOptions.find((lider) => lider.nombre === liderActividadForm) ||
    null;

  $: filteredGruposCatalogo = gruposCatalogo.filter((grupo) => {
    const query = normalizeSearchValue(gruposSearchQuery);
    if (!query) return true;
    return normalizeSearchValue(grupo).includes(query);
  });

  $: currentUser = $authStore.user;
  $: currentUserEmail = currentUser?.email || "";
  $: currentUserTelefono =
    currentUser?.cellphone ||
    currentUser?.telefono ||
    currentUser?.phone ||
    "No registrado";

  $: gruposActividadAsignacion =
    actividadAsignacionActual?.grupos_requeridos?.filter(Boolean) || [];

  $: personalDisponibleAsignacion = personalDummyCatalogo.filter((persona) =>
    gruposActividadAsignacion.includes(persona.grupo),
  );

  $: filteredPersonalAsignacion = personalDisponibleAsignacion.filter(
    (persona) => {
      const query = normalizeSearchValue(asignacionSearchQuery);
      if (!query) return true;

      return (
        normalizeSearchValue(persona.nombreCompleto).includes(query) ||
        normalizeSearchValue(persona.telefono).includes(query) ||
        normalizeSearchValue(persona.grupo).includes(query)
      );
    },
  );

  $: totalIntegrantesAsignados = personalSeleccionadoAsignacion.length;

  $: puedeContinuarPasoUno =
    !!tipoJornadaForm &&
    !!fechaActividadForm &&
    !!horaEncuentroForm &&
    !!normalizeTextInput(duracionHorasForm) &&
    !Number.isNaN(Number(normalizeTextInput(duracionHorasForm))) &&
    Number(normalizeTextInput(duracionHorasForm)) > 0 &&
    gruposRequeridosForm.length > 0 &&
    !!liderActividadForm.trim() &&
    !!objetivoActividadForm.trim();

  $: puedeConvocar =
    puedeContinuarPasoUno &&
    !!direccionPuntoEncuentroForm.trim() &&
    !!normalizeTextInput(latitudPuntoEncuentroForm) &&
    !!normalizeTextInput(longitudPuntoEncuentroForm) &&
    !Number.isNaN(latitudPuntoEncuentroNumero) &&
    !Number.isNaN(longitudPuntoEncuentroNumero);

  onMount(async () => {
    try {
      loading = true;
      error = "";

      console.log("[Convocatorias] Iniciando carga de actividades...");
      actividades = await getActividadesPlanDistritoVerde();
      console.log("[Convocatorias] Actividades cargadas:", actividades.length);

      // Extraer opciones únicas para filtros
      // Extraer todos los grupos de los arrays
      const allGrupos = actividades.flatMap((a) => a.grupos_requeridos || []);
      grupos = [...new Set(allGrupos)].sort();

      tiposJornada = [
        ...new Set(actividades.map((a) => a.tipo_jornada).filter(Boolean)),
      ].sort();
      lideres = [
        ...new Set(actividades.map((a) => a.lider_actividad).filter(Boolean)),
      ].sort();

      lideresGrupoOptions = await getLideresGrupo();

      filteredActividades = actividades;
      console.log("[Convocatorias] Filtros configurados correctamente");
    } catch (err) {
      console.error("[Convocatorias] Error al cargar actividades:", err);
      error = "Error al cargar las actividades. Por favor, intenta de nuevo.";
    } finally {
      loading = false;
    }
  });

  onMount(() => {
    updateBackToTopVisibility();

    const handleResize = () => updateBackToTopVisibility();
    window.addEventListener("resize", handleResize);

    // Actualizar el contador de tiempo cada segundo
    const timeInterval = setInterval(() => {
      timeNow = new Date();
    }, 1000);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearInterval(timeInterval);
    };
  });

  // Aplicar filtros
  $: {
    filteredActividades = actividades.filter((actividad) => {
      // Filtro de búsqueda general
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchableText = [
          actividad.tipo_jornada,
          actividad.punto_encuentro?.direccion,
          actividad.objetivo_actividad,
          actividad.lider_actividad,
          actividad.observaciones,
          ...(actividad.grupos_requeridos || []),
        ]
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(query)) return false;
      }

      // Filtro por grupo (buscar en el array de grupos)
      if (
        selectedGrupo &&
        !actividad.grupos_requeridos?.includes(selectedGrupo)
      )
        return false;

      // Filtro por tipo de jornada
      if (selectedTipoJornada && actividad.tipo_jornada !== selectedTipoJornada)
        return false;

      // Filtro por líder
      if (selectedLider && actividad.lider_actividad !== selectedLider)
        return false;

      // Filtro por fecha desde
      if (fechaDesde) {
        const fechaAct = parseDateDDMMYYYY(actividad.fecha_actividad);
        const fechaD = new Date(fechaDesde);
        if (fechaAct < fechaD) return false;
      }

      // Filtro por fecha hasta
      if (fechaHasta) {
        const fechaAct = parseDateDDMMYYYY(actividad.fecha_actividad);
        const fechaH = new Date(fechaHasta);
        if (fechaAct > fechaH) return false;
      }

      return true;
    });
  }

  // Parsear fecha en formato DD/MM/YYYY
  function parseDateDDMMYYYY(dateString: string): Date {
    if (!dateString) return new Date();
    const [day, month, year] = dateString.split("/");
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  function formatDate(dateString: string): string {
    if (!dateString) return "-";
    try {
      const date = parseDateDDMMYYYY(dateString);
      return date.toLocaleDateString("es-CO", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  }

  function openGoogleMaps(geometry: { coordinates: [number, number] }) {
    const [longitude, latitude] = geometry.coordinates;

    // Intentar obtener la ubicación del usuario para mostrar direcciones
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Si se obtiene la ubicación, mostrar dirección desde la ubicación actual
          const { latitude: userLat, longitude: userLng } = position.coords;
          const url = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${latitude},${longitude}&travelmode=driving`;
          window.open(url, "_blank");
        },
        (error) => {
          // Si falla la geolocalización, solo mostrar el punto de destino
          console.warn("No se pudo obtener la ubicación:", error);
          const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
          window.open(url, "_blank");
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 300000, // 5 minutos de cache
        },
      );
    } else {
      // Si el navegador no soporta geolocalización, solo mostrar el destino
      const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      window.open(url, "_blank");
    }
  }

  function resetFilters() {
    searchQuery = "";
    selectedGrupo = "";
    selectedTipoJornada = "";
    selectedLider = "";
    fechaDesde = "";
    fechaHasta = "";
  }

  function formatDateToDDMMYYYY(dateInput: string): string {
    const [year, month, day] = dateInput.split("-");
    return `${day}/${month}/${year}`;
  }

  function formatDateToInput(dateValue: string): string {
    if (!dateValue) return "";

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }

    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateValue)) {
      const [day, month, year] = dateValue.split("/");
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    return "";
  }

  function resetConvocatoriaForm() {
    pasoConvocatoria = 1;
    guardandoConvocatoria = false;
    convocatoriaError = "";

    tipoJornadaForm = "";
    fechaActividadForm = "";
    horaEncuentroForm = "";
    duracionHorasForm = "";
    gruposRequeridosForm = [];
    liderActividadForm = "";
    objetivoActividadForm = "";
    observacionesForm = "";

    direccionPuntoEncuentroForm = "";
    latitudPuntoEncuentroForm = "";
    longitudPuntoEncuentroForm = "";
    liderDropdownOpen = false;
    liderSearchQuery = "";
    gruposDropdownOpen = false;
    gruposSearchQuery = "";
  }

  function toggleLiderDropdown() {
    liderDropdownOpen = !liderDropdownOpen;
    if (!liderDropdownOpen) {
      liderSearchQuery = "";
    }
  }

  function seleccionarLider(lider: LiderGrupoOption) {
    liderActividadForm = lider.nombre;
    liderDropdownOpen = false;
    liderSearchQuery = "";
  }

  function toggleGruposDropdown() {
    gruposDropdownOpen = !gruposDropdownOpen;
    if (!gruposDropdownOpen) {
      gruposSearchQuery = "";
    }
  }

  function toggleGrupoRequerido(grupo: string) {
    if (gruposRequeridosForm.includes(grupo)) {
      gruposRequeridosForm = gruposRequeridosForm.filter(
        (item) => item !== grupo,
      );
      return;
    }

    gruposRequeridosForm = [...gruposRequeridosForm, grupo];
  }

  function removeGrupoRequerido(grupo: string) {
    gruposRequeridosForm = gruposRequeridosForm.filter(
      (item) => item !== grupo,
    );
  }

  function formatDateForDisplay(value: string): string {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return value;
    return `${day}/${month}/${year}`;
  }

  function calculateTimeRemaining(
    fechaActividad: string,
    horaEncuentro: string,
  ): string {
    try {
      // Convertir DD/MM/YYYY a YYYY-MM-DD
      const [day, month, year] = fechaActividad.split("/");
      const dateStr = `${year}-${month}-${day}`;

      // Crear fecha de actividad
      const actividadDate = new Date(`${dateStr}T${horaEncuentro}:00`);
      const now = timeNow;

      const diffMs = actividadDate.getTime() - now.getTime();

      if (diffMs < 0) {
        return "Actividad iniciada";
      }

      const diffSecs = Math.floor(diffMs / 1000);
      const days = Math.floor(diffSecs / 86400);
      const hours = Math.floor((diffSecs % 86400) / 3600);
      const minutes = Math.floor((diffSecs % 3600) / 60);

      if (days > 0) {
        return `${days}d ${hours}h`;
      } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else {
        return `${minutes}m`;
      }
    } catch (err) {
      console.error("Error calculando tiempo restante:", err);
      return "-";
    }
  }

  function toggleDateRangePicker() {
    dateRangeOpen = !dateRangeOpen;
  }

  function clearDateRange() {
    fechaDesde = "";
    fechaHasta = "";
  }

  function closeDropdownsOnOutsideClick(event: MouseEvent) {
    if (liderDropdownRef && !liderDropdownRef.contains(event.target as Node)) {
      liderDropdownOpen = false;
    }

    if (
      gruposDropdownRef &&
      !gruposDropdownRef.contains(event.target as Node)
    ) {
      gruposDropdownOpen = false;
    }

    if (dateRangeRef && !dateRangeRef.contains(event.target as Node)) {
      dateRangeOpen = false;
    }

    if (isAsignarPersonalModalOpen) {
      const target = event.target as HTMLElement;
      if (!target.closest(".asignacion-dropdown")) {
        asignacionDropdownOpen = false;
      }
    }
  }

  function openAsignarPersonalModal(actividad: ActividadPlanDistritoVerde) {
    if (!actividad?.id) return;

    actividadAsignacionActual = actividad;
    isAsignarPersonalModalOpen = true;
    asignacionDropdownOpen = false;
    asignacionSearchQuery = "";
    personalSeleccionadoAsignacion = [
      ...getPersonalAsignadoActividad(actividad.id),
    ];
  }

  function closeAsignarPersonalModal() {
    isAsignarPersonalModalOpen = false;
    actividadAsignacionActual = null;
    asignacionDropdownOpen = false;
    asignacionSearchQuery = "";
    personalSeleccionadoAsignacion = [];
  }

  function toggleAsignacionDropdown() {
    asignacionDropdownOpen = !asignacionDropdownOpen;

    if (!asignacionDropdownOpen) {
      asignacionSearchQuery = "";
    }
  }

  function toggleIntegranteAsignacion(persona: PersonalGrupoItem) {
    const exists = personalSeleccionadoAsignacion.some(
      (item) => item.id === persona.id,
    );

    personalSeleccionadoAsignacion = exists
      ? personalSeleccionadoAsignacion.filter((item) => item.id !== persona.id)
      : [...personalSeleccionadoAsignacion, persona];
  }

  function removeIntegranteAsignado(personaId: string) {
    personalSeleccionadoAsignacion = personalSeleccionadoAsignacion.filter(
      (item) => item.id !== personaId,
    );
  }

  function confirmarAsignacionPersonal() {
    if (actividadAsignacionActual?.id) {
      personalAsignadoPorActividad = {
        ...personalAsignadoPorActividad,
        [actividadAsignacionActual.id]: [...personalSeleccionadoAsignacion],
      };
    }

    convocatoriaFeedbackType = "success";
    convocatoriaFeedback =
      totalIntegrantesAsignados > 0
        ? `Se asignaron ${totalIntegrantesAsignados} integrante(s) a la actividad ${actividadAsignacionActual?.tipo_jornada || "seleccionada"}. (Datos dummy)`
        : "No se seleccionaron integrantes.";

    closeAsignarPersonalModal();
  }

  function getGrupoColorClass(grupo: string): string {
    const normalized = normalizeSearchValue(grupo);
    const palette = [
      "grupo-color-1",
      "grupo-color-2",
      "grupo-color-3",
      "grupo-color-4",
      "grupo-color-5",
      "grupo-color-6",
    ];

    const hash = [...normalized].reduce(
      (acc, char) => acc + char.charCodeAt(0),
      0,
    );

    return palette[hash % palette.length];
  }

  function getPersonalAsignadoActividad(
    actividadId: string | undefined,
  ): PersonalGrupoItem[] {
    if (!actividadId) return [];

    if (personalAsignadoPorActividad[actividadId]) {
      return personalAsignadoPorActividad[actividadId] || [];
    }

    const actividad = actividades.find((item) => item.id === actividadId);
    const grupoApi = (actividad?.grupo || []) as PersonalGrupoApiItem[];

    return grupoApi
      .filter((item) => item.nombre_completo && item.grupo)
      .map((item, index) => ({
        id: item.id || `${actividadId}-${index}`,
        nombreCompleto: item.nombre_completo || "-",
        telefono: item.telefono || "No registrado",
        grupo: item.grupo || "-",
      }));
  }

  function getPersonalAsignadoPorGrupo(
    actividadId: string | undefined,
    grupo: string,
  ): PersonalGrupoItem[] {
    return getPersonalAsignadoActividad(actividadId).filter(
      (persona) => persona.grupo === grupo,
    );
  }

  function getTotalPersonalAsignadoActividad(
    actividadId: string | undefined,
  ): number {
    return getPersonalAsignadoActividad(actividadId).length;
  }

  function getGruposAsignadosActividad(
    actividadId: string | undefined,
  ): string[] {
    const gruposSet = new Set(
      getPersonalAsignadoActividad(actividadId)
        .map((persona) => persona.grupo)
        .filter(Boolean),
    );

    return Array.from(gruposSet).sort((a, b) => a.localeCompare(b, "es"));
  }

  function getEstadoColorClass(estado?: string): string {
    switch (estado) {
      case "Programada":
        return "estado-programada";
      case "En ejecución":
        return "estado-ejecucion";
      case "Finalizada":
        return "estado-finalizada";
      default:
        return "estado-programada"; // Por defecto, Programada
    }
  }

  $: dateRangeSummary =
    fechaDesde || fechaHasta
      ? `${formatDateForDisplay(fechaDesde) || "Inicio"} — ${formatDateForDisplay(fechaHasta) || "Fin"}`
      : "Rango de fechas";

  function openConvocatoriaModal() {
    convocatoriaError = "";
    resetConvocatoriaForm();
    isEditMode = false;
    editingActividadId = null;
    isConvocatoriaModalOpen = true;
  }

  function openModificarActividadModal(actividad: ActividadPlanDistritoVerde) {
    if (!actividad?.id) return;

    convocatoriaError = "";
    resetConvocatoriaForm();

    isEditMode = true;
    editingActividadId = actividad.id;

    tipoJornadaForm = actividad.tipo_jornada || "";
    fechaActividadForm = formatDateToInput(actividad.fecha_actividad || "");
    horaEncuentroForm = (actividad.hora_encuentro || "").slice(0, 5);
    duracionHorasForm = actividad.duracion_actividad
      ? Number(actividad.duracion_actividad).toString()
      : "";
    gruposRequeridosForm = [...(actividad.grupos_requeridos || [])];
    liderActividadForm = (actividad.lider_actividad || "").trim();
    objetivoActividadForm = actividad.objetivo_actividad || "";
    observacionesForm = actividad.observaciones || "";

    direccionPuntoEncuentroForm = actividad.punto_encuentro?.direccion || "";
    latitudPuntoEncuentroForm =
      actividad.punto_encuentro?.geometry?.coordinates?.[1]?.toString() || "";
    longitudPuntoEncuentroForm =
      actividad.punto_encuentro?.geometry?.coordinates?.[0]?.toString() || "";

    isConvocatoriaModalOpen = true;
  }

  function setConvocatoriaError(message: string) {
    convocatoriaError = message;
    convocatoriaModalElement?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeConvocatoriaModal() {
    isConvocatoriaModalOpen = false;
    convocatoriaError = "";
    isEditMode = false;
    editingActividadId = null;
  }

  function irAStepDos() {
    if (!puedeContinuarPasoUno) {
      setConvocatoriaError(
        "Completa los datos obligatorios del paso 1 para continuar.",
      );
      return;
    }
    convocatoriaError = "";
    pasoConvocatoria = 2;
  }

  function volverAStepUno() {
    convocatoriaError = "";
    pasoConvocatoria = 1;
  }

  async function enviarConvocatoria() {
    if (!puedeConvocar) {
      setConvocatoriaError(
        "Completa la dirección y coordenadas del punto de encuentro para convocar.",
      );
      return;
    }

    if (!currentUserEmail) {
      setConvocatoriaError(
        "No fue posible obtener el email del usuario autenticado.",
      );
      return;
    }

    try {
      const payload = {
        tipo_jornada: tipoJornadaForm,
        fecha_actividad: formatDateToDDMMYYYY(fechaActividadForm),
        hora_encuentro: horaEncuentroForm,
        duracion_actividad: duracionHorasForm ? Number(duracionHorasForm) : 0,
        grupos_requeridos: gruposRequeridosForm,
        lider_actividad: liderActividadForm.trim(),
        objetivo_actividad: objetivoActividadForm.trim(),
        observaciones: observacionesForm.trim(),
        punto_encuentro: {
          direccion: direccionPuntoEncuentroForm.trim(),
          geometry: {
            type: "Point" as const,
            coordinates: [
              longitudPuntoEncuentroNumero,
              latitudPuntoEncuentroNumero,
            ] as [number, number],
          },
        },
        telefono: currentUserTelefono,
        email: currentUserEmail,
      };

      if (isEditMode) {
        if (!editingActividadId) {
          throw new Error("No se encontró el id de la actividad a modificar.");
        }

        // Guardar payload pendiente y mostrar modal de confirmación
        pendingModifyPayload = payload;
        pendingModifyActividadId = editingActividadId;
        isConfirmModifyModalOpen = true;
        return;
      }

      guardandoConvocatoria = true;
      convocatoriaError = "";
      const response = await convocarActividad(payload);

      convocatoriaFeedbackType = "success";
      convocatoriaFeedback =
        response.message || "Programación registrada exitosamente.";

      closeConvocatoriaModal();
      await retry();
    } catch (err) {
      console.error("[Convocatorias] Error al guardar actividad:", err);
      convocatoriaError =
        "No fue posible registrar la programación. Verifica la información e intenta de nuevo.";
      convocatoriaFeedbackType = "error";
      convocatoriaFeedback = convocatoriaError;
    } finally {
      guardandoConvocatoria = false;
    }
  }

  async function confirmarModificacion() {
    if (!pendingModifyPayload || !pendingModifyActividadId) {
      return;
    }

    try {
      guardandoConvocatoria = true;
      convocatoriaError = "";

      modifyingActividadId = pendingModifyActividadId;
      const response = await modificarActividadPlanDistritoVerde(
        pendingModifyActividadId,
        pendingModifyPayload,
      );

      convocatoriaFeedbackType = "success";
      convocatoriaFeedback =
        (response as { message?: string })?.message ||
        "Actividad modificada exitosamente.";

      // Limpiar estados
      pendingModifyPayload = null;
      pendingModifyActividadId = null;
      isConfirmModifyModalOpen = false;

      closeConvocatoriaModal();
      await retry();
    } catch (err) {
      console.error("[Convocatorias] Error al modificar actividad:", err);
      convocatoriaError =
        "No fue posible modificar la actividad. Verifica la información e intenta de nuevo.";
      convocatoriaFeedbackType = "error";
      convocatoriaFeedback = convocatoriaError;
    } finally {
      guardandoConvocatoria = false;
      modifyingActividadId = null;
    }
  }

  function cancelarModificacion() {
    pendingModifyPayload = null;
    pendingModifyActividadId = null;
    isConfirmModifyModalOpen = false;
  }

  async function retry() {
    loading = true;
    error = "";
    try {
      console.log("[Convocatorias] Reintentando carga...");
      actividades = await getActividadesPlanDistritoVerde();

      const allGrupos = actividades.flatMap((a) => a.grupos_requeridos || []);
      grupos = [...new Set(allGrupos)].sort();
      tiposJornada = [
        ...new Set(actividades.map((a) => a.tipo_jornada).filter(Boolean)),
      ].sort();
      lideres = [
        ...new Set(actividades.map((a) => a.lider_actividad).filter(Boolean)),
      ].sort();
      lideresGrupoOptions = await getLideresGrupo();
      filteredActividades = actividades;
    } catch (err) {
      console.error("[Convocatorias] Error al reintentar:", err);
      error = "Error al cargar las actividades. Por favor, intenta de nuevo.";
    } finally {
      loading = false;
    }
  }

  async function eliminarActividad(actividadId: string) {
    if (!actividadId || deletingActividadId) return;

    const shouldDelete = window.confirm(
      "¿Deseas eliminar esta actividad de forma permanente?",
    );

    if (!shouldDelete) return;

    try {
      deletingActividadId = actividadId;
      await eliminarActividadPlanDistritoVerde(actividadId);
      convocatoriaFeedbackType = "success";
      convocatoriaFeedback = "Actividad eliminada exitosamente.";
      await retry();
    } catch (err) {
      console.error("[Convocatorias] Error al eliminar actividad:", err);
      convocatoriaFeedbackType = "error";
      convocatoriaFeedback =
        "No fue posible eliminar la actividad. Intenta nuevamente.";
    } finally {
      deletingActividadId = null;
    }
  }

  function modificarActividad(actividad: ActividadPlanDistritoVerde) {
    openModificarActividadModal(actividad);
  }

  // Inicializar un mapa individual
  function initializeMap(actividad: ActividadPlanDistritoVerde) {
    const mapId = `map-${actividad.id}`;

    // Si ya fue inicializado, no hacer nada
    if (initializedMaps.has(mapId)) {
      return;
    }

    const mapElement = document.getElementById(mapId);

    if (mapElement && actividad.punto_encuentro?.geometry?.coordinates) {
      const [lng, lat] = actividad.punto_encuentro.geometry.coordinates;

      try {
        // Crear mapa
        const map = (window as any).L.map(mapId, {
          center: [lat, lng],
          zoom: 16,
          zoomControl: true,
        });

        // Capa base: CartoDB Positron
        const positron = (window as any).L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: "abcd",
            maxZoom: 20,
          },
        );

        // Capa satelital
        const satellite = (window as any).L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution:
              "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
            maxZoom: 20,
          },
        );

        // Agregar capa por defecto
        let currentLayer = "mapa";
        positron.addTo(map);

        // Control toggle personalizado
        const ToggleControl = (window as any).L.Control.extend({
          options: {
            position: "topright",
          },
          onAdd: function (map: any) {
            const container = (window as any).L.DomUtil.create(
              "div",
              "leaflet-bar leaflet-control leaflet-control-custom",
            );
            container.style.backgroundColor = "white";
            container.style.width = "34px";
            container.style.height = "34px";
            container.style.cursor = "pointer";
            container.style.display = "flex";
            container.style.alignItems = "center";
            container.style.justifyContent = "center";
            container.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;
            container.title = "Cambiar a vista satélite";

            container.onclick = function () {
              if (currentLayer === "mapa") {
                map.removeLayer(positron);
                satellite.addTo(map);
                container.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
                container.title = "Cambiar a vista de mapa";
                currentLayer = "satelite";
              } else {
                map.removeLayer(satellite);
                positron.addTo(map);
                container.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;
                container.title = "Cambiar a vista satélite";
                currentLayer = "mapa";
              }
            };

            return container;
          },
        });

        map.addControl(new ToggleControl());

        // Control de centrar mapa
        const CenterControl = (window as any).L.Control.extend({
          options: {
            position: "bottomleft",
          },
          onAdd: function (map: any) {
            const container = (window as any).L.DomUtil.create(
              "div",
              "leaflet-bar leaflet-control leaflet-control-custom",
            );
            container.style.backgroundColor = "white";
            container.style.width = "34px";
            container.style.height = "34px";
            container.style.cursor = "pointer";
            container.style.display = "flex";
            container.style.alignItems = "center";
            container.style.justifyContent = "center";
            container.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>`;
            container.title = "Centrar mapa en la ubicación";

            container.onclick = function () {
              map.setView([lat, lng], 16, {
                animate: true,
                duration: 0.5,
              });
            };

            return container;
          },
        });

        map.addControl(new CenterControl());

        // Agregar marcador
        (window as any).L.marker([lat, lng])
          .addTo(map)
          .bindPopup(
            `<b>${actividad.punto_encuentro.direccion || "Ubicación"}</b>`,
          );

        // Marcar como inicializado
        initializedMaps.add(mapId);
      } catch (error) {
        console.error(`Error inicializando mapa ${mapId}:`, error);
      }
    }
  }

  // Inicializar todos los mapas visibles
  function initializeMaps() {
    if (!leafletLoaded || typeof (window as any).L === "undefined") {
      return;
    }

    filteredActividades.forEach((actividad) => {
      initializeMap(actividad);
    });
  }

  // Detectar cuando Leaflet esté cargado
  onMount(() => {
    const checkLeaflet = () => {
      if (typeof (window as any).L !== "undefined") {
        leafletLoaded = true;
        initializeMaps();
      } else {
        setTimeout(checkLeaflet, 100);
      }
    };
    checkLeaflet();
  });

  // Reinicializar mapas después de actualizaciones
  afterUpdate(async () => {
    await tick();
    if (leafletLoaded) {
      initializeMaps();
    }
  });
</script>

<svelte:head>
  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
    crossorigin=""
  />
  <script
    src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
    crossorigin=""
  ></script>
</svelte:head>

<svelte:window
  on:click={closeDropdownsOnOutsideClick}
  on:scroll={handleWindowScroll}
/>

<div class="convocatorias-container">
  <div class="convocatorias-content">
    <div class="header-section" bind:this={headerSectionElement}>
      <div>
        <h1 class="page-title">Programación de Actividades</h1>
        <p class="page-subtitle">
          Gestión de actividades y jornadas programadas en el marco del Plan
          Distrito Verde
        </p>
      </div>
      <div class="header-actions">
        <div class="stats">
          <div class="stat-item">
            <span class="stat-value">{filteredActividades.length}</span>
            <span class="stat-label">Actividades</span>
          </div>
        </div>

        <div class="header-buttons">
          <button
            class="btn-programar-actividad"
            type="button"
            on:click={openConvocatoriaModal}
          >
            + Programar nueva actividad
          </button>

          <button
            type="button"
            class="btn-toggle-filtros"
            on:click={() => (filtrosVisibles = !filtrosVisibles)}
          >
            {filtrosVisibles ? "Ocultar filtros" : "Mostrar filtros"}
          </button>
        </div>
      </div>
    </div>

    <!-- Controles de filtrado -->
    {#if filtrosVisibles}
      <div class="filters-section">
        <div class="search-bar">
          <input
            type="text"
            placeholder="Buscar en todas las columnas..."
            bind:value={searchQuery}
          />
        </div>

        <div class="filters-grid">
          <select bind:value={selectedGrupo}>
            <option value="">Todos los grupos</option>
            {#each grupos as grupo}
              <option value={grupo}>{grupo}</option>
            {/each}
          </select>

          <select bind:value={selectedTipoJornada}>
            <option value="">Todos los tipos</option>
            {#each tiposJornada as tipo}
              <option value={tipo}>{tipo}</option>
            {/each}
          </select>

          <select bind:value={selectedLider}>
            <option value="">Todos los líderes</option>
            {#each lideres as lider}
              <option value={lider}>{lider}</option>
            {/each}
          </select>

          <div class="date-range-picker" bind:this={dateRangeRef}>
            <button
              type="button"
              class="date-range-trigger"
              aria-haspopup="dialog"
              aria-expanded={dateRangeOpen}
              on:click={toggleDateRangePicker}
            >
              <span>{dateRangeSummary}</span>
              <span class="date-range-arrow">▾</span>
            </button>

            {#if dateRangeOpen}
              <div
                class="date-range-panel"
                role="dialog"
                aria-label="Seleccionar rango de fechas"
              >
                <label>
                  <span>Desde</span>
                  <input
                    type="date"
                    bind:value={fechaDesde}
                    aria-label="Fecha desde"
                  />
                </label>

                <label>
                  <span>Hasta</span>
                  <input
                    type="date"
                    bind:value={fechaHasta}
                    aria-label="Fecha hasta"
                  />
                </label>

                <button
                  type="button"
                  class="date-range-clear"
                  on:click={clearDateRange}
                >
                  Limpiar rango
                </button>
              </div>
            {/if}
          </div>

          <button class="btn-reset" on:click={resetFilters}>
            Limpiar filtros
          </button>
        </div>
      </div>
    {/if}

    {#if convocatoriaFeedback}
      <div class={`convocatoria-feedback ${convocatoriaFeedbackType}`}>
        {convocatoriaFeedback}
      </div>
    {/if}

    {#if loading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Cargando actividades...</p>
      </div>
    {:else if error}
      <div class="error-state">
        <div class="state-icon state-icon--error">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h3>Error al cargar datos</h3>
        <p>{error}</p>
        <p class="error-hint">Verifica tu conexión o revisa la consola (F12) para más detalles.</p>
        <button class="btn-retry" on:click={retry}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
          Reintentar
        </button>
      </div>
    {:else if filteredActividades.length === 0}
      <div class="empty-state">
        <div class="state-icon state-icon--empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        </div>
        <h3>Sin resultados</h3>
        <p>No se encontraron actividades con los filtros actuales</p>
      </div>
    {:else}
      <!-- Contenedores de actividades -->
      <div class="actividades-container">
        {#each filteredActividades as actividad (actividad.id)}
          <div class="actividad-card">
            <!-- Contenido principal del card -->
            <div class="card-header">
              <div class="header-top">
                <div class="type-and-state">
                  <span class="badge-tipo">{actividad.tipo_jornada || "-"}</span
                  >
                  <span
                    class={`badge-estado ${getEstadoColorClass(
                      actividad.estado_actividad,
                    )}`}
                  >
                    {actividad.estado_actividad || "Programada"}
                  </span>
                </div>
                <div class="header-location-timer">
                  <span class="header-timer">
                    {calculateTimeRemaining(
                      actividad.fecha_actividad,
                      actividad.hora_encuentro,
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div class="card-body">
              <!-- Sección información básica -->
              <div class="info-section">
                <button
                  class="direccion-destaque"
                  on:click={() =>
                    openGoogleMaps(actividad.punto_encuentro.geometry)}
                  title="Ver en Google Maps"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                    ></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  {actividad.punto_encuentro?.direccion || "Sin dirección"}
                </button>
                <h3 class="fecha-titulo">
                  {formatDate(actividad.fecha_actividad)} a las{" "}
                  {actividad.hora_encuentro || "-"}
                </h3>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="info-label">Duración:</span>
                    <span class="info-text">
                      {actividad.duracion_actividad
                        ? `${actividad.duracion_actividad}h`
                        : "-"}
                    </span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Líder:</span>
                    <span class="info-text"
                      >{actividad.lider_actividad || "-"}</span
                    >
                  </div>
                </div>
              </div>

              <!-- Sección objetivo -->
              <div class="objetivo-section">
                <h4 class="section-title">Objetivo</h4>
                <p class="objetivo-text">
                  {actividad.objetivo_actividad || "-"}
                </p>
                {#if actividad.observaciones}
                  <div class="observaciones-section">
                    <span class="observaciones-label">Observaciones:</span>
                    <p class="observaciones-text">{actividad.observaciones}</p>
                  </div>
                {/if}
              </div>

              <!-- Sección grupos -->
              {#if actividad.grupos_requeridos && actividad.grupos_requeridos.length > 0}
                <div class="grupos-section">
                  <h4 class="section-title">Grupos requeridos</h4>
                  <div class="grupos-container">
                    {#each actividad.grupos_requeridos as grupo}
                      <span class="badge-grupo">{grupo}</span>
                    {/each}
                  </div>

                  <details class="grupos-disclosure">
                    <summary>
                      <span class="grupos-disclosure-title"
                        >Personal de apoyo asignado</span
                      >
                      <span class="grupos-disclosure-count"
                        >{getTotalPersonalAsignadoActividad(actividad.id)}</span
                      >
                    </summary>

                    {#if getPersonalAsignadoActividad(actividad.id).length === 0}
                      <p class="personal-asignado-empty">
                        No se ha asignado aún personal de apoyo para ésta
                        actividad, por favor asígnelo antes del comienzo de la
                        misma
                      </p>
                    {:else}
                      <div class="personal-grupos-container">
                        {#each getGruposAsignadosActividad(actividad.id) as grupo}
                          <div class="personal-grupo-item">
                            <span
                              class={`lider-grupo-badge ${getGrupoColorClass(grupo)}`}
                            >
                              {grupo}
                            </span>

                            <div class="personal-listado">
                              {#each getPersonalAsignadoPorGrupo(actividad.id, grupo) as personaAsignada}
                                <div class="personal-item">
                                  <div class="personal-item-row">
                                    <span class="personal-label">Nombre:</span>
                                    <span class="personal-value">{personaAsignada.nombreCompleto}</span>
                                  </div>
                                  <div class="personal-item-row">
                                    <span class="personal-label">Grupo:</span>
                                    <span class="personal-value">{personaAsignada.grupo}</span>
                                  </div>
                                </div>
                              {/each}
                            </div>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </details>
                </div>
              {/if}

              <!-- Botones de acción -->
              <div class="acciones-section">
                <button
                  type="button"
                  class="btn-asignar-personal"
                  title="Asignar personal a la actividad"
                  aria-label="Asignar personal"
                  on:click={() => openAsignarPersonalModal(actividad)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <line x1="19" y1="8" x2="19" y2="14"></line>
                    <line x1="22" y1="11" x2="16" y2="11"></line>
                  </svg>
                  <span>Asignar Personal</span>
                </button>

                <div class="acciones-row">
                  <button
                    type="button"
                    class="btn-modificar-actividad"
                    title="Modificar actividad"
                    aria-label="Modificar actividad"
                    disabled={modifyingActividadId === actividad.id}
                    on:click={() => modificarActividad(actividad)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M12 20h9"></path><path
                        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                      ></path>
                    </svg>
                    <span>Modificar</span>
                  </button>

                  <button
                    type="button"
                    class="btn-delete-actividad"
                    title="Eliminar actividad"
                    aria-label="Eliminar actividad"
                    disabled={deletingActividadId === actividad.id}
                    on:click={() => eliminarActividad(actividad.id)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
                      ></path>
                      <path d="M10 11v6"></path>
                      <path d="M14 11v6"></path>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                    </svg>
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Sección de mapa (visible solo en pantalla ancha) -->
            <div class="map-section">
              <div class="map-container" id="map-{actividad.id}"></div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

{#if showBackToTopButton}
  <button
    type="button"
    class="btn-back-to-top"
    on:click={scrollToTop}
    aria-label="Volver al inicio"
    title="Volver al inicio"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
  </button>
{/if}

{#if isConvocatoriaModalOpen}
  <div
    class="convocatoria-modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-label={isEditMode
      ? "Modificar programación de actividad"
      : "Registrar programación de actividad"}
  >
    <div class="convocatoria-modal" bind:this={convocatoriaModalElement}>
      <div class="convocatoria-modal-header">
        <h2>
          {isEditMode ? "Modificar Actividad" : "Programación de Actividad"}
        </h2>
        <p>Paso {pasoConvocatoria} de 2</p>
      </div>

      {#if convocatoriaError}
        <div class="convocatoria-error">{convocatoriaError}</div>
      {/if}

      {#if pasoConvocatoria === 1}
        <div class="convocatoria-form-grid">
          <label>
            <span>Tipo de jornada *</span>
            <select bind:value={tipoJornadaForm}>
              <option value="">Selecciona una opción</option>
              {#each tiposJornadaDisponibles as tipo}
                <option value={tipo}>{tipo}</option>
              {/each}
            </select>
          </label>

          <label>
            <span>Fecha de actividad *</span>
            <input type="date" bind:value={fechaActividadForm} />
          </label>

          <label>
            <span>Hora de encuentro *</span>
            <input type="time" bind:value={horaEncuentroForm} />
          </label>

          <label>
            <span>Duración (horas) *</span>
            <div class="duration-input-wrapper">
              <input
                class="duration-input"
                type="number"
                min="0.5"
                step="0.5"
                inputmode="decimal"
                bind:value={duracionHorasForm}
                placeholder="2"
              />
              <span class="duration-suffix">h</span>
            </div>
          </label>

          <label>
            <span>Líder de actividad *</span>
            <div class="lider-dropdown" bind:this={liderDropdownRef}>
              <button
                type="button"
                class="lider-dropdown-trigger"
                class:open={liderDropdownOpen}
                on:click={toggleLiderDropdown}
              >
                {#if liderSeleccionado}
                  <span class="lider-name">{liderSeleccionado.nombre}</span>
                  <span
                    class={`lider-grupo-badge ${getGrupoColorClass(
                      liderSeleccionado.grupo,
                    )}`}
                  >
                    {liderSeleccionado.grupo}
                  </span>
                {:else}
                  <span class="lider-placeholder">Selecciona un líder</span>
                {/if}
                <span class="lider-dropdown-arrow">▾</span>
              </button>

              {#if liderDropdownOpen}
                <div class="lider-dropdown-panel">
                  <input
                    type="search"
                    class="lider-search-input"
                    bind:value={liderSearchQuery}
                    placeholder="Buscar líder o grupo..."
                  />

                  <div class="lider-options-list">
                    {#if filteredLideresGrupoOptions.length === 0}
                      <div class="lider-empty-state">
                        No se encontraron líderes.
                      </div>
                    {:else}
                      {#each filteredLideresGrupoOptions as lider}
                        <button
                          type="button"
                          class="lider-option-item"
                          class:selected={lider.nombre === liderActividadForm}
                          on:click={() => seleccionarLider(lider)}
                        >
                          <span class="lider-option-name">{lider.nombre}</span>
                          <span
                            class={`lider-grupo-badge ${getGrupoColorClass(
                              lider.grupo,
                            )}`}
                          >
                            {lider.grupo}
                          </span>
                        </button>
                      {/each}
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          </label>

          <label class="grupos-field grupos-required-field">
            <span>Grupos requeridos *</span>
            <div class="grupos-required-dropdown" bind:this={gruposDropdownRef}>
              <button
                type="button"
                class="grupos-required-trigger"
                class:open={gruposDropdownOpen}
                on:click={toggleGruposDropdown}
              >
                {#if gruposRequeridosForm.length === 0}
                  <span class="grupos-required-placeholder"
                    >Selecciona uno o varios grupos</span
                  >
                {:else}
                  <div class="grupos-selected-chips">
                    {#each gruposRequeridosForm as grupoSeleccionado (grupoSeleccionado)}
                      <span
                        class={`lider-grupo-badge ${getGrupoColorClass(
                          grupoSeleccionado,
                        )}`}
                      >
                        {grupoSeleccionado}
                      </span>
                    {/each}
                  </div>
                {/if}
                <span class="grupos-required-arrow">▾</span>
              </button>

              {#if gruposDropdownOpen}
                <div class="grupos-required-panel">
                  <input
                    type="search"
                    class="grupos-search-input"
                    bind:value={gruposSearchQuery}
                    placeholder="Buscar grupo..."
                  />

                  <div class="grupos-options-list">
                    {#if filteredGruposCatalogo.length === 0}
                      <div class="grupos-empty-state">
                        No se encontraron grupos.
                      </div>
                    {:else}
                      {#each filteredGruposCatalogo as grupoItem}
                        <button
                          type="button"
                          class="grupos-option-item"
                          class:selected={gruposRequeridosForm.includes(
                            grupoItem,
                          )}
                          on:click={() => toggleGrupoRequerido(grupoItem)}
                        >
                          <span class="grupos-option-check"
                            >{gruposRequeridosForm.includes(grupoItem)
                              ? "✓"
                              : ""}</span
                          >
                          <span
                            class={`lider-grupo-badge ${getGrupoColorClass(grupoItem)}`}
                            >{grupoItem}</span
                          >
                        </button>
                      {/each}
                    {/if}
                  </div>

                  {#if gruposRequeridosForm.length > 0}
                    <div class="grupos-required-footer">
                      {#each gruposRequeridosForm as grupoSeleccionado (grupoSeleccionado)}
                        <button
                          type="button"
                          class="grupo-selected-pill"
                          on:click={() =>
                            removeGrupoRequerido(grupoSeleccionado)}
                          title="Quitar grupo"
                        >
                          <span>{grupoSeleccionado}</span>
                          <span>×</span>
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </label>

          <label class="full-width">
            <span>Objetivo de la actividad *</span>
            <textarea
              rows="4"
              bind:value={objetivoActividadForm}
              placeholder="Describe el objetivo de la actividad"
            ></textarea>
          </label>

          <label class="full-width">
            <span>Observaciones</span>
            <textarea
              rows="4"
              bind:value={observacionesForm}
              placeholder="Observaciones adicionales"
            ></textarea>
          </label>
        </div>

        <div class="convocatoria-actions">
          <button
            type="button"
            class="btn-secondary"
            on:click={closeConvocatoriaModal}
          >
            Cancelar
          </button>
          <button type="button" class="btn-primary" on:click={irAStepDos}>
            Continuar
          </button>
        </div>
      {:else}
        <div class="convocatoria-form-grid">
          <label class="full-width">
            <span>Dirección del punto de encuentro *</span>
            <input
              type="text"
              bind:value={direccionPuntoEncuentroForm}
              placeholder="Dirección o referencia del punto de encuentro"
            />
          </label>

          <label>
            <span>Latitud *</span>
            <input
              type="text"
              inputmode="decimal"
              bind:value={latitudPuntoEncuentroForm}
              placeholder="3.4516"
            />
          </label>

          <label>
            <span>Longitud *</span>
            <input
              type="text"
              inputmode="decimal"
              bind:value={longitudPuntoEncuentroForm}
              placeholder="-76.5320"
            />
          </label>
        </div>

        <div class="convocatoria-actions">
          <button type="button" class="btn-secondary" on:click={volverAStepUno}>
            Atrás
          </button>
          <button
            type="button"
            class="btn-primary"
            on:click={enviarConvocatoria}
            disabled={guardandoConvocatoria}
          >
            {guardandoConvocatoria
              ? isEditMode
                ? "Modificando..."
                : "Programando..."
              : isEditMode
                ? "Modificar"
                : "Programar"}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if isConfirmModifyModalOpen}
  <div
    class="confirm-modify-modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Confirmar cambios a la actividad"
  >
    <div class="confirm-modify-modal">
      <div class="confirm-modify-header">
        <h2>Confirmar Cambios</h2>
      </div>

      <div class="confirm-modify-content">
        <p>¿Deseas aplicar los cambios a la actividad?</p>
      </div>

      <div class="confirm-modify-actions">
        <button
          type="button"
          class="btn-secondary"
          on:click={cancelarModificacion}
          disabled={guardandoConvocatoria}
        >
          No, Cancelar
        </button>
        <button
          type="button"
          class="btn-primary"
          on:click={confirmarModificacion}
          disabled={guardandoConvocatoria}
        >
          {guardandoConvocatoria ? "Modificando..." : "Sí, Aplicar Cambios"}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if isAsignarPersonalModalOpen}
  <div
    class="asignar-personal-modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Asignar personal a la actividad"
  >
    <div
      class="asignar-personal-modal"
      class:dropdown-open={asignacionDropdownOpen}
    >
      <div class="asignar-personal-header">
        <h2>Asignar Personal</h2>
        <p>
          {actividadAsignacionActual?.tipo_jornada || "Actividad"} ·
          {formatDate(actividadAsignacionActual?.fecha_actividad || "")}
        </p>
      </div>

      {#if gruposActividadAsignacion.length === 0}
        <div class="asignacion-empty-groups">
          Esta actividad no tiene grupos requeridos para asignar personal.
        </div>
      {:else}
        <div class="asignacion-grupos-resumen">
          {#each gruposActividadAsignacion as grupoActividad}
            <span
              class={`lider-grupo-badge ${getGrupoColorClass(grupoActividad)}`}
            >
              {grupoActividad}
            </span>
          {/each}
        </div>

        <div class="asignacion-dropdown">
          <button
            type="button"
            class="asignacion-dropdown-trigger"
            class:open={asignacionDropdownOpen}
            on:click={toggleAsignacionDropdown}
          >
            <span class="asignacion-dropdown-label"
              >Seleccionar integrantes</span
            >
            <span class="asignacion-dropdown-arrow">▾</span>
          </button>

          {#if asignacionDropdownOpen}
            <div class="asignacion-dropdown-panel">
              <input
                type="search"
                class="asignacion-search-input"
                bind:value={asignacionSearchQuery}
                placeholder="Buscar por nombre, teléfono o grupo..."
              />

              <div class="asignacion-options-list">
                {#if filteredPersonalAsignacion.length === 0}
                  <div class="asignacion-empty-state">
                    No hay personas disponibles para los grupos requeridos.
                  </div>
                {:else}
                  {#each filteredPersonalAsignacion as persona}
                    <button
                      type="button"
                      class="asignacion-option-item"
                      class:selected={personalSeleccionadoAsignacion.some(
                        (item) => item.id === persona.id,
                      )}
                      on:click={() => toggleIntegranteAsignacion(persona)}
                    >
                      <span class="asignacion-option-check"
                        >{personalSeleccionadoAsignacion.some(
                          (item) => item.id === persona.id,
                        )
                          ? "✓"
                          : ""}</span
                      >
                      <div class="asignacion-option-content">
                        <span class="asignacion-option-name"
                          >{persona.nombreCompleto}</span
                        >
                        <span class="asignacion-option-phone"
                          >{persona.telefono}</span
                        >
                      </div>
                      <span
                        class={`lider-grupo-badge ${getGrupoColorClass(persona.grupo)}`}
                      >
                        {persona.grupo}
                      </span>
                    </button>
                  {/each}
                {/if}
              </div>
            </div>
          {/if}
        </div>

        {#if personalSeleccionadoAsignacion.length > 0}
          <div class="asignacion-selected-list">
            {#each personalSeleccionadoAsignacion as personaSel}
              <button
                type="button"
                class="asignacion-selected-pill"
                on:click={() => removeIntegranteAsignado(personaSel.id)}
                title="Quitar integrante"
              >
                <span class="asignacion-pill-name"
                  >{personaSel.nombreCompleto}</span
                >
                <span class="asignacion-pill-phone">{personaSel.telefono}</span>
                <span
                  class={`lider-grupo-badge ${getGrupoColorClass(personaSel.grupo)}`}
                >
                  {personaSel.grupo}
                </span>
                <span class="asignacion-pill-remove">×</span>
              </button>
            {/each}
          </div>
        {/if}
      {/if}

      <div class="asignar-personal-actions">
        <button
          type="button"
          class="btn-secondary"
          on:click={closeAsignarPersonalModal}
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn-primary"
          on:click={confirmarAsignacionPersonal}
          disabled={totalIntegrantesAsignados === 0}
        >
          Asignar
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .convocatorias-container {
    min-height: calc(100vh - 80px);
    background-color: var(--surface);
    padding: 2rem 1.5rem;
  }

  .convocatorias-content {
    max-width: 3200px;
    margin: 0 auto;
  }

  /* Header */
  .header-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.25rem;
    gap: 2rem;
  }

  .header-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.75rem;
  }

  .page-title {
    color: var(--text-primary);
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 0.25rem;
  }

  .page-subtitle {
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .stats {
    display: flex;
    gap: 1rem;
  }

  .header-buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .stat-item {
    background: var(--surface);
    padding: 0.625rem 1rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    text-align: center;
    min-width: 80px;
  }

  .stat-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--primary);
    line-height: 1;
    letter-spacing: -0.02em;
  }

  .stat-label {
    display: block;
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--text-muted);
    margin-top: 0.2rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .btn-toggle-filtros {
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-secondary);
    border-radius: var(--radius);
    padding: 0.5rem 0.875rem;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition);
  }

  .btn-toggle-filtros:hover {
    border-color: var(--primary);
    color: var(--primary);
    background: rgba(5,150,105,0.04);
  }

  /* Filtros */
  .filters-section {
    background: var(--surface);
    padding: 1rem;
    border-radius: var(--radius-md);
    margin-bottom: 1.25rem;
    border: 1px solid var(--border);
  }

  .search-bar {
    position: relative;
    margin-bottom: 0.75rem;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 1.25rem;
  }

  .search-bar input {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 0.875rem;
    transition: all var(--transition);
    background: var(--surface-alt);
    color: var(--text-primary);
    font-family: inherit;
  }

  .search-bar input:focus {
    outline: none;
    border-color: var(--primary);
    background: var(--surface);
    box-shadow: 0 0 0 3px rgba(5,150,105,0.08);
  }

  .filters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 0.5rem;
  }

  .filters-grid select,
  .filters-grid input[type="date"] {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 0.8125rem;
    background: var(--surface-alt);
    color: var(--text-primary);
    font-family: inherit;
    cursor: pointer;
    transition: all var(--transition);
  }

  .filters-grid select:focus,
  .filters-grid input[type="date"]:focus {
    outline: none;
    border-color: var(--primary);
    background: var(--surface);
    box-shadow: 0 0 0 3px rgba(5,150,105,0.08);
  }

  .date-range-picker {
    position: relative;
  }

  .date-range-trigger {
    width: 100%;
    min-height: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 0.8125rem;
    background: var(--surface-alt);
    color: var(--text-primary);
    cursor: pointer;
    transition: all var(--transition);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    text-align: left;
    font-family: inherit;
  }

  .date-range-trigger:hover,
  .date-range-trigger:focus {
    outline: none;
    border-color: var(--primary);
    background: var(--surface);
    box-shadow: 0 0 0 3px rgba(5,150,105,0.08);
  }

  .date-range-arrow {
    font-size: 0.8rem;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .date-range-panel {
    position: absolute;
    top: calc(100% + 0.4rem);
    left: 0;
    width: min(300px, 92vw);
    z-index: 80;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    padding: 0.75rem;
    display: grid;
    gap: 0.5rem;
  }

  .date-range-panel label {
    display: grid;
    gap: 0.35rem;
  }

  .date-range-panel label span {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-secondary);
  }

  .date-range-panel input[type="date"] {
    width: 100%;
  }

  .date-range-clear {
    margin-top: 0.2rem;
    border: none;
    border-radius: 0.65rem;
    background: var(--surface);
    color: var(--text-secondary);
    font-weight: 700;
    padding: 0.55rem 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .date-range-clear:hover {
    background: var(--border);
    color: var(--text-primary);
  }

  .btn-reset {
    padding: 0.5rem 0.875rem;
    background: var(--surface-alt);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-weight: 500;
    font-size: 0.8125rem;
    font-family: inherit;
    cursor: pointer;
    transition: all var(--transition);
  }

  .btn-reset:hover {
    background: var(--border);
    color: var(--text-primary);
  }

  .btn-programar-actividad {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0.5rem 0.875rem;
    border: none;
    border-radius: var(--radius);
    background: var(--primary);
    color: white;
    font-size: 0.8125rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all var(--transition);
  }

  .btn-programar-actividad:hover {
    background: var(--primary-dark);
  }

  /* Estados */
  .loading-state,
  .error-state,
  .empty-state {
    text-align: center;
    padding: 3rem 2rem;
    background: var(--surface);
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
  }

  .state-icon {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1rem;
  }
  .state-icon--error {
    background: rgba(220, 38, 38, 0.08);
    color: #dc2626;
    border: 1px solid rgba(220, 38, 38, 0.15);
  }
  .state-icon--empty {
    background: var(--surface-alt);
    color: var(--text-muted);
    border: 1px solid var(--border);
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-icon,
  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .loading-state p,
  .error-state p,
  .empty-state p {
    color: var(--text-secondary);
    margin-top: 0.5rem;
    font-size: 0.875rem;
  }

  .error-state h3,
  .empty-state h3 {
    color: var(--text-primary);
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .error-hint {
    font-size: 0.8125rem;
    color: var(--text-muted);
    margin-top: 0.75rem !important;
  }

  .btn-retry {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 1.25rem;
    padding: 0.5rem 1.25rem;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-weight: 600;
    font-size: 0.875rem;
    font-family: inherit;
    cursor: pointer;
    transition: all var(--transition);
  }

  .btn-retry:hover {
    background: var(--primary-dark);
  }

  /* Tabla */
  .actividades-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-bottom: 2rem;
    width: 100%;
    overflow: hidden;
  }

  @media (max-width: 768px) {
    .actividades-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
  }

  @media (min-width: 769px) and (max-width: 1024px) {
    .actividades-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
      gap: 1.5rem;
    }
  }

  /* Mayor espacio entre cards en pantallas 2K */
  @media (min-width: 2560px) {
    .actividades-container {
      gap: 2rem;
    }

    .filters-section {
      padding: 2rem;
      margin-bottom: 2.5rem;
    }
  }

  /* Mayor espacio entre cards en pantallas 4K */
  @media (min-width: 3840px) {
    .actividades-container {
      gap: 2.5rem;
    }

    .filters-section {
      padding: 2.5rem;
      margin-bottom: 3rem;
    }
  }

  @media (min-width: 1025px) {
    .actividad-card {
      display: grid;
      grid-template-columns: 1fr 400px;
      grid-template-rows: auto 1fr;
      max-width: 1600px;
    }

    .card-header {
      grid-column: 1 / -1;
    }

    .card-body {
      grid-column: 1;
      grid-row: 2;
    }

    .map-section {
      grid-column: 2;
      grid-row: 2;
      border-left: 2px solid var(--border);
    }
  }

  .actividad-card {
    background: var(--surface);
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    overflow: hidden;
    transition: box-shadow var(--transition), transform var(--transition);
    width: 100%;
    box-sizing: border-box;
  }

  .actividad-card:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }

  .card-header {
    background: var(--surface-alt);
    border-bottom: 1px solid var(--border);
    padding: 0.625rem 1rem;
    overflow: hidden;
  }

  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    min-width: 0;
  }

  @media (max-width: 768px) {
    .header-top {
      gap: 0.3rem;
    }
  }

  .type-and-state {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: nowrap;
  }

  .header-location-timer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .header-timer {
    background: var(--surface);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    padding: 0.2rem 0.5rem;
    border-radius: var(--radius-sm);
    font-size: 0.6875rem;
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .header-timer {
      padding: 0.15rem 0.35rem;
      font-size: 0.6rem;
    }
  }

  .type-and-state {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: nowrap;
  }

  .card-body {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .info-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .direccion-destaque {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--primary);
    text-align: left;
    transition: color var(--transition);
    margin-bottom: 0.125rem;
    font-family: inherit;
    min-height: unset;
  }

  .direccion-destaque:hover {
    color: var(--primary-dark);
    text-decoration: underline;
  }

  .direccion-destaque svg {
    flex-shrink: 0;
    color: inherit;
  }

  .fecha-titulo {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .info-label {
    color: var(--text-muted);
    font-size: 0.6875rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .info-text {
    color: var(--text-primary);
    font-size: 0.8125rem;
    line-height: 1.4;
    font-weight: 500;
  }

  .objetivo-section {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .section-title {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0;
  }

  .objetivo-text {
    font-size: 0.8125rem;
    line-height: 1.55;
    color: var(--text-secondary);
    margin: 0;
  }

  .observaciones-section {
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .observaciones-label {
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .observaciones-text {
    color: var(--text-secondary);
    font-style: italic;
    line-height: 1.5;
    font-size: 0.85rem;
    margin: 0;
  }

  .grupos-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .grupos-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .badge-grupo {
    display: inline-block;
    padding: 0.25rem 0.6rem;
    background: var(--text-secondary);
    color: white;
    border-radius: 0.375rem;
    font-weight: 600;
    font-size: 0.7rem;
    white-space: nowrap;
  }

  .acciones-section {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding-top: 0.625rem;
    border-top: 1px solid var(--border);
  }

  .acciones-row {
    display: flex;
    gap: 0.375rem;
  }

  .btn-modificar-actividad,
  .btn-delete-actividad,
  .btn-asignar-personal {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    border-radius: var(--radius);
    padding: 0.45rem 0.625rem;
    cursor: pointer;
    transition: all var(--transition);
    font-size: 0.75rem;
    font-weight: 600;
    font-family: inherit;
    background: var(--surface-alt);
    border: 1px solid var(--border);
    min-height: unset;
  }

  .btn-asignar-personal {
    border-color: rgba(2, 132, 199, 0.3);
    color: var(--secondary);
    background: rgba(2, 132, 199, 0.04);
    width: 100%;
  }

  .btn-asignar-personal:hover {
    background: rgba(2, 132, 199, 0.08);
    border-color: var(--secondary);
  }

  .btn-asignar-personal:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-asignar-personal svg {
    width: 13px;
    height: 13px;
  }

  .btn-modificar-actividad {
    border-color: rgba(180, 83, 9, 0.25);
    color: var(--accent);
    background: rgba(180, 83, 9, 0.04);
  }

  .btn-modificar-actividad:hover {
    background: rgba(180, 83, 9, 0.08);
    border-color: var(--accent);
  }

  .btn-delete-actividad {
    border-color: rgba(220, 38, 38, 0.2);
    color: var(--error);
    background: rgba(220, 38, 38, 0.04);
  }

  .btn-delete-actividad:hover {
    background: rgba(220, 38, 38, 0.08);
    border-color: var(--error);
  }

  .btn-modificar-actividad:disabled,
  .btn-delete-actividad:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-modificar-actividad svg,
  .btn-delete-actividad svg {
    width: 13px;
    height: 13px;
  }

  /* Footer eliminado */
  .card-footer {
    display: none;
  }

  .badge-tipo {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    background: rgba(5, 150, 105, 0.1);
    color: var(--primary-dark);
    border: 1px solid rgba(5, 150, 105, 0.2);
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-size: 0.6875rem;
    white-space: nowrap;
  }

  .badge-estado {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-size: 0.6875rem;
    white-space: nowrap;
  }

  .badge-estado.estado-programada {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
    border: 1px solid rgba(239,68,68,0.2);
  }

  .badge-estado.estado-ejecucion {
    background: rgba(234, 179, 8, 0.1);
    color: #92400e;
    border: 1px solid rgba(234,179,8,0.25);
  }

  .badge-estado.estado-finalizada {
    background: rgba(16, 185, 129, 0.1);
    color: var(--primary-dark);
    border: 1px solid rgba(16,185,129,0.2);
  }

  .badge-estado-small {
    display: inline-block;
    padding: 0.15rem 0.4rem;
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-size: 0.6875rem;
    white-space: nowrap;
  }

  .badge-estado-small.estado-programada {
    background: rgba(239,68,68,0.1);
    color: #dc2626;
    border: 1px solid rgba(239,68,68,0.2);
  }

  .badge-estado-small.estado-ejecucion {
    background: rgba(234,179,8,0.1);
    color: #92400e;
    border: 1px solid rgba(234,179,8,0.25);
  }

  .badge-estado-small.estado-finalizada {
    background: rgba(16,185,129,0.1);
    color: var(--primary-dark);
    border: 1px solid rgba(16,185,129,0.2);
  }

  .map-section {
    display: none; /* Oculto por defecto (móvil) */
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.25rem;
  }

  @media (min-width: 1025px) {
    .map-section {
      display: flex; /* Visible en escritorio */
    }
  }

  /* Pantallas muy anchas - Mayor ancho de mapa */
  @media (min-width: 1600px) {
    .actividad-card {
      grid-template-columns: 1fr 500px;
      max-width: 1800px;
    }
  }

  /* Pantallas ultrawide - TV y monitores ultra anchos */
  @media (min-width: 1920px) {
    .actividad-card {
      grid-template-columns: 1fr 600px;
      max-width: 2000px;
    }
  }

  /* Pantallas 2K (2560x1440) */
  @media (min-width: 2560px) {
    .convocatorias-container {
      padding: 2.5rem 3rem;
    }

    .actividad-card {
      grid-template-columns: 1fr 700px;
      max-width: 2400px;
    }

    .map-container {
      min-height: 650px;
    }

    .map-section {
      padding: 1.5rem;
    }

    .page-title {
      font-size: 2.5rem;
    }

    .page-subtitle {
      font-size: 1.125rem;
    }

    .card-header {
      padding: 1.5rem 1.75rem;
    }

    .card-body {
      padding: 1.75rem;
    }

    .direccion-destaque {
      font-size: 1.125rem;
    }

    .direccion-destaque svg {
      width: 18px;
      height: 18px;
    }

    .fecha-titulo {
      font-size: 1.05rem;
    }

    .info-label {
      font-size: 0.875rem;
    }

    .info-text {
      font-size: 1rem;
    }

    .badge-grupo,
    .badge-tipo,
    .badge-estado {
      font-size: 0.8rem;
      padding: 0.4rem 0.75rem;
    }

    .objetivo-text {
      font-size: 1rem;
    }

    .section-title {
      font-size: 0.95rem;
    }
  }

  /* Pantallas 4K (3840x2160) */
  @media (min-width: 3840px) {
    .convocatorias-container {
      padding: 3rem 4rem;
    }

    .actividad-card {
      grid-template-columns: 1fr 900px;
      max-width: 3200px;
    }

    .map-container {
      min-height: 800px;
    }

    .map-section {
      padding: 2rem;
    }

    .page-title {
      font-size: 3rem;
    }

    .page-subtitle {
      font-size: 1.25rem;
    }

    .card-header {
      padding: 1.75rem 2rem;
    }

    .card-body {
      padding: 2rem;
    }

    .direccion-destaque {
      font-size: 1.25rem;
    }

    .direccion-destaque svg {
      width: 20px;
      height: 20px;
    }

    .fecha-titulo {
      font-size: 1.15rem;
    }

    .info-row {
      font-size: 1.125rem;
    }

    .info-label {
      font-size: 1rem;
    }

    .info-text {
      font-size: 1.125rem;
    }

    .badge-grupo,
    .badge-tipo,
    .badge-estado {
      font-size: 0.9rem;
      padding: 0.45rem 0.85rem;
    }

    .objetivo-text {
      font-size: 1.125rem;
      line-height: 1.7;
    }

    .section-title {
      font-size: 1.05rem;
    }

    .observaciones-text {
      font-size: 1rem;
    }

    .btn-modificar-actividad,
    .btn-delete-actividad {
      font-size: 0.95rem;
      padding: 0.75rem 1rem;
    }

    .stat-value {
      font-size: 2.5rem;
    }

    .stat-label {
      font-size: 1rem;
    }
  }

  .map-container {
    width: 100%;
    height: 100%;
    min-height: 500px;
    border-radius: 0.6rem;
    overflow: hidden;
    border: 1px solid var(--border);
    position: relative;
    background: var(--surface);
    z-index: 1;
  }

  /* Estilos para Leaflet dentro del contenedor */
  .map-container :global(.leaflet-container) {
    height: 100%;
    width: 100%;
    border-radius: 0.6rem;
  }

  .map-container :global(.leaflet-control-custom) {
    border-radius: 0.4rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transition: all 0.2s ease;
  }

  .map-container :global(.leaflet-control-custom):hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    transform: translateY(-1px);
  }

  .map-container :global(.leaflet-popup-content-wrapper) {
    border-radius: 0.4rem;
  }

  .map-container :global(.leaflet-control-attribution) {
    display: none;
  }

  .grupos-disclosure summary::after {
    content: "v";
    font-size: 0.75rem;
    margin-left: 0.5rem;
  }

  .grupos-disclosure[open] summary::after {
    content: "^";
  }

  .grupos-disclosure {
    margin-top: 0.6rem;
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 0.8rem;
    background: white;
    padding: 0.6rem 0.7rem;
    box-shadow: 0 2px 8px var(--shadow);
  }

  .grupos-disclosure summary {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    cursor: pointer;
    color: var(--text-secondary);
    font-size: 0.84rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    list-style: none;
    padding: 0.15rem 0;
  }

  .grupos-disclosure-title {
    color: var(--text-secondary);
    font-weight: 800;
  }

  .grupos-disclosure-count {
    min-width: 1.65rem;
    height: 1.65rem;
    border-radius: 999px;
    border: 1px solid rgba(2, 132, 199, 0.25);
    background: rgba(2, 132, 199, 0.1);
    color: var(--secondary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.78rem;
    font-weight: 800;
  }

  .grupos-disclosure summary::-webkit-details-marker {
    display: none;
  }

  .personal-asignado-empty {
    margin-top: 0.65rem;
    color: var(--text-secondary);
    font-size: 0.84rem;
    line-height: 1.4;
    border: 1px dashed var(--border);
    border-radius: 0.65rem;
    background: var(--surface);
    padding: 0.7rem 0.8rem;
  }

  .personal-grupos-container {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .personal-grupo-item {
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    padding: 0.65rem 0.7rem;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .personal-grupo-empty {
    color: var(--text-secondary);
    font-size: 0.8rem;
    font-style: italic;
  }

  .personal-listado {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .personal-item {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 0.65rem;
    background: white;
    padding: 0.5rem 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.82rem;
  }

  .personal-item-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
  }

  .personal-label {
    color: var(--text-secondary);
    font-weight: 700;
  }

  .personal-value {
    color: var(--text-primary);
    font-weight: 600;
    margin-right: 0.45rem;
  }

  .grupos-compact {
    margin-top: 0.4rem;
  }

  .btn-location-inline {
    background: rgba(5, 150, 105, 0.08);
    border: 1px solid rgba(5, 150, 105, 0.2);
    color: var(--primary-dark);
    padding: 0.35rem 0.7rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 1px 3px rgba(5, 150, 105, 0.15);
  }

  .btn-location-inline svg {
    width: 14px;
    height: 14px;
  }

  .btn-location-inline:hover {
    border-color: var(--primary);
    background: rgba(5, 150, 105, 0.14);
    color: var(--primary);
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(5, 150, 105, 0.18);
  }

  .convocatoria-feedback {
    border-radius: 0.75rem;
    padding: 0.875rem 1rem;
    margin-bottom: 1rem;
    font-weight: 600;
  }

  .convocatoria-feedback.success {
    background: rgba(5, 150, 105, 0.12);
    color: var(--primary-dark);
    border: 1px solid rgba(5, 150, 105, 0.2);
  }

  .convocatoria-feedback.error {
    background: rgba(220, 38, 38, 0.1);
    color: #991b1b;
    border: 1px solid rgba(220, 38, 38, 0.2);
  }

  .btn-back-to-top {
    position: fixed;
    right: 1.25rem;
    bottom: 1.25rem;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: var(--shadow-md);
    z-index: 220;
    transition: all var(--transition);
  }

  .btn-back-to-top:hover {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
  }

  .convocatoria-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 1rem;
    z-index: 300;
  }

  .convocatoria-modal {
    width: min(820px, 100%);
    max-height: 90vh;
    overflow-y: auto;
    background: var(--surface);
    border-radius: var(--radius-md);
    padding: 1.25rem;
    box-shadow: 0 20px 45px rgba(15, 23, 42, 0.2);
  }

  .confirm-modify-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 1rem;
    z-index: 350;
  }

  .asignar-personal-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 1rem;
    z-index: 360;
  }

  .asignar-personal-modal {
    width: min(1100px, 96vw);
    max-height: 94vh;
    overflow-y: auto;
    background: white;
    border-radius: 1rem;
    padding: 1.5rem;
    box-shadow: 0 20px 45px rgba(15, 23, 42, 0.28);
    transition:
      width 0.2s ease,
      max-height 0.2s ease,
      padding 0.2s ease;
  }

  .asignar-personal-modal.dropdown-open {
    width: min(1400px, 99vw);
    max-height: 98vh;
    padding: 1.75rem;
  }

  .asignar-personal-header h2 {
    color: var(--text-primary);
    font-size: 1.45rem;
    margin-bottom: 0.2rem;
  }

  .asignar-personal-header p {
    color: var(--text-secondary);
    margin-bottom: 1rem;
    font-size: 0.92rem;
  }

  .asignacion-empty-groups {
    border: 1px dashed var(--border);
    border-radius: 0.8rem;
    padding: 1rem;
    color: var(--text-secondary);
    font-weight: 500;
    background: #f8fffb;
  }

  .asignacion-grupos-resumen {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.7rem;
  }

  .asignacion-dropdown {
    position: relative;
  }

  .asignacion-dropdown-trigger {
    width: 100%;
    min-height: 38px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-alt);
    padding: 0.5rem 0.75rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    cursor: pointer;
    font-family: inherit;
    transition: all var(--transition);
  }

  .asignacion-dropdown-trigger.open,
  .asignacion-dropdown-trigger:focus {
    outline: none;
    border-color: var(--secondary);
    background: var(--surface);
    box-shadow: 0 0 0 3px rgba(2,132,199,0.08);
  }

  .asignacion-dropdown-label {
    color: var(--text-primary);
    font-weight: 600;
    font-size: 0.9rem;
  }

  .asignacion-dropdown-arrow {
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .asignacion-dropdown-panel {
    position: absolute;
    z-index: 42;
    top: calc(100% + 0.35rem);
    left: 0;
    right: 0;
    background: white;
    border: 1px solid var(--border);
    border-radius: 0.8rem;
    box-shadow: 0 14px 28px rgba(15, 23, 42, 0.2);
    padding: 0.6rem;
  }

  .asignar-personal-modal.dropdown-open .asignacion-dropdown-panel {
    position: relative;
    margin-top: 0.35rem;
  }

  .asignacion-search-input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 0.6rem;
    padding: 0.6rem 0.75rem;
    font-size: 0.88rem;
    margin-bottom: 0.5rem;
    background: #f8fffb;
  }

  .asignacion-search-input:focus {
    outline: none;
    border-color: var(--secondary);
    background: white;
  }

  .asignacion-options-list {
    max-height: 340px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .asignar-personal-modal.dropdown-open .asignacion-options-list {
    max-height: 62vh;
  }

  .asignacion-option-item {
    width: 100%;
    display: grid;
    grid-template-columns: 1rem 1fr auto;
    gap: 0.5rem;
    align-items: center;
    border: 1px solid transparent;
    border-radius: 0.6rem;
    background: #f8fffb;
    padding: 0.5rem 0.6rem;
    cursor: pointer;
    text-align: left;
  }

  .asignacion-option-item:hover {
    border-color: var(--border);
    background: #effcf4;
  }

  .asignacion-option-item.selected {
    border-color: rgba(2, 132, 199, 0.35);
    background: rgba(2, 132, 199, 0.1);
  }

  .asignacion-option-check {
    width: 1rem;
    color: var(--secondary);
    font-weight: 800;
  }

  .asignacion-option-content {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .asignacion-option-name {
    color: var(--text-primary);
    font-weight: 600;
    font-size: 0.88rem;
    line-height: 1.3;
  }

  .asignacion-option-phone {
    color: var(--text-secondary);
    font-size: 0.8rem;
  }

  .asignacion-empty-state {
    color: #6b7280;
    font-size: 0.85rem;
    padding: 0.5rem 0.35rem;
  }

  .asignacion-selected-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .asignacion-selected-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid rgba(2, 132, 199, 0.35);
    border-radius: 999px;
    background: rgba(2, 132, 199, 0.1);
    color: var(--secondary);
    padding: 0.25rem 0.55rem;
    font-size: 0.74rem;
    font-weight: 600;
    cursor: pointer;
  }

  .asignacion-selected-pill:hover {
    background: rgba(2, 132, 199, 0.18);
  }

  .asignacion-pill-name {
    color: var(--text-primary);
    font-weight: 700;
  }

  .asignacion-pill-phone {
    color: var(--text-secondary);
    font-weight: 600;
  }

  .asignacion-pill-remove {
    color: var(--secondary);
    font-weight: 800;
  }

  .asignar-personal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .confirm-modify-modal {
    width: min(480px, 100%);
    background: var(--surface);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    box-shadow: 0 20px 45px rgba(15, 23, 42, 0.2);
  }

  .confirm-modify-header {
    margin-bottom: 0.875rem;
  }

  .confirm-modify-header h2 {
    color: var(--text-primary);
    font-size: 1.125rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0;
  }

  .confirm-modify-content {
    margin-bottom: 1.5rem;
  }

  .confirm-modify-content p {
    color: var(--text-secondary);
    font-size: 1rem;
    margin: 0;
    line-height: 1.5;
  }

  .confirm-modify-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .confirm-modify-actions button {
    padding: 0.75rem 1.25rem;
    border-radius: 0.75rem;
    font-weight: 600;
    font-size: 0.95rem;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .convocatoria-modal-header h2 {
    color: var(--text-primary);
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: 0.125rem;
    letter-spacing: -0.02em;
  }

  .convocatoria-modal-header p {
    color: var(--text-muted);
    font-size: 0.8125rem;
    margin-bottom: 1rem;
  }

  .convocatoria-error {
    margin-bottom: 1rem;
    border-radius: 0.75rem;
    padding: 0.75rem 0.875rem;
    background: rgba(220, 38, 38, 0.1);
    color: #991b1b;
    border: 1px solid rgba(220, 38, 38, 0.2);
    font-weight: 600;
  }

  .convocatoria-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .convocatoria-form-grid label,
  .grupos-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .convocatoria-form-grid label span {
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 0.8125rem;
  }

  .convocatoria-form-grid input,
  .convocatoria-form-grid select,
  .convocatoria-form-grid textarea {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.5625rem 0.75rem;
    font-size: 0.875rem;
    font-family: inherit;
    background: var(--surface-alt);
    color: var(--text-primary);
    transition: border-color var(--transition), box-shadow var(--transition);
  }

  .convocatoria-form-grid input:focus,
  .convocatoria-form-grid select:focus,
  .convocatoria-form-grid textarea:focus {
    outline: none;
    border-color: var(--primary);
    background: var(--surface);
    box-shadow: 0 0 0 3px rgba(5,150,105,0.08);
  }

  .duration-input-wrapper {
    position: relative;
  }

  .duration-input {
    width: 100%;
    padding-right: 2.1rem;
  }

  .duration-suffix {
    position: absolute;
    right: 0.85rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-secondary);
    pointer-events: none;
  }

  .lider-dropdown {
    position: relative;
  }

  .grupos-required-dropdown {
    position: relative;
  }

  .grupos-required-trigger {
    width: 100%;
    min-height: 38px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-alt);
    padding: 0.5rem 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-family: inherit;
    transition: all var(--transition);
  }

  .grupos-required-trigger.open,
  .grupos-required-trigger:focus {
    outline: none;
    border-color: var(--primary);
    background: var(--surface);
    box-shadow: 0 0 0 3px rgba(5,150,105,0.08);
  }

  .grupos-required-placeholder {
    color: #6b7280;
    text-align: left;
    flex: 1;
  }

  .grupos-selected-chips {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    min-width: 0;
  }

  .grupos-required-arrow {
    margin-left: auto;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .grupos-required-panel {
    position: absolute;
    z-index: 35;
    top: calc(100% + 0.35rem);
    left: 0;
    right: 0;
    background: white;
    border: 1px solid var(--border);
    border-radius: 0.8rem;
    box-shadow: 0 14px 28px rgba(15, 23, 42, 0.2);
    padding: 0.6rem;
  }

  .grupos-search-input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 0.6rem;
    padding: 0.6rem 0.75rem;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
    background: #f8fffb;
  }

  .grupos-search-input:focus {
    outline: none;
    border-color: var(--primary);
    background: white;
  }

  .grupos-options-list {
    max-height: 190px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .grupos-option-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid transparent;
    border-radius: 0.6rem;
    background: #f8fffb;
    padding: 0.5rem 0.6rem;
    cursor: pointer;
    text-align: left;
  }

  .grupos-option-item:hover {
    border-color: var(--border);
    background: #effcf4;
  }

  .grupos-option-item.selected {
    border-color: rgba(5, 150, 105, 0.4);
    background: rgba(16, 185, 129, 0.12);
  }

  .grupos-option-check {
    width: 1rem;
    color: var(--primary-dark);
    font-weight: 800;
  }

  .grupos-empty-state {
    color: #6b7280;
    font-size: 0.85rem;
    padding: 0.45rem 0.35rem;
  }

  .grupos-required-footer {
    margin-top: 0.6rem;
    padding-top: 0.55rem;
    border-top: 1px solid var(--border);
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .grupo-selected-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid rgba(5, 150, 105, 0.35);
    border-radius: 999px;
    background: rgba(16, 185, 129, 0.14);
    color: var(--primary-dark);
    padding: 0.25rem 0.55rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
  }

  .grupo-selected-pill:hover {
    background: rgba(16, 185, 129, 0.24);
  }

  .lider-dropdown-trigger {
    width: 100%;
    min-height: 38px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-alt);
    padding: 0.5rem 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-family: inherit;
    cursor: pointer;
    transition: all var(--transition);
  }

  .lider-dropdown-trigger.open,
  .lider-dropdown-trigger:focus {
    outline: none;
    border-color: var(--primary);
    background: var(--surface);
    box-shadow: 0 0 0 3px rgba(5,150,105,0.08);
  }

  .lider-placeholder {
    color: #6b7280;
    text-align: left;
    flex: 1;
  }

  .lider-name {
    color: var(--text-primary);
    font-weight: 600;
    text-align: left;
    flex: 1;
  }

  .lider-dropdown-arrow {
    color: var(--text-secondary);
    margin-left: auto;
    font-size: 0.85rem;
  }

  .lider-dropdown-panel {
    position: absolute;
    z-index: 30;
    top: calc(100% + 0.35rem);
    left: 0;
    right: 0;
    background: white;
    border: 1px solid var(--border);
    border-radius: 0.8rem;
    box-shadow: 0 14px 28px rgba(15, 23, 42, 0.2);
    padding: 0.6rem;
  }

  .lider-search-input {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 0.6rem;
    padding: 0.6rem 0.75rem;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
    background: #f8fffb;
  }

  .lider-search-input:focus {
    outline: none;
    border-color: var(--primary);
    background: white;
  }

  .lider-options-list {
    max-height: 220px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .lider-option-item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    border: 1px solid transparent;
    border-radius: 0.6rem;
    background: #f8fffb;
    padding: 0.55rem 0.65rem;
    cursor: pointer;
    text-align: left;
  }

  .lider-option-item:hover {
    border-color: var(--border);
    background: #effcf4;
  }

  .lider-option-item.selected {
    border-color: rgba(5, 150, 105, 0.4);
    background: rgba(16, 185, 129, 0.12);
  }

  .lider-option-name {
    color: var(--text-primary);
    font-weight: 500;
    font-size: 0.9rem;
  }

  .lider-empty-state {
    color: #6b7280;
    font-size: 0.85rem;
    padding: 0.5rem 0.35rem;
  }

  .lider-grupo-badge {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 0.2rem 0.55rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    white-space: nowrap;
  }

  .grupo-color-1 {
    background: #dcfce7;
    color: #166534;
  }

  .grupo-color-2 {
    background: #dbeafe;
    color: #1e40af;
  }

  .grupo-color-3 {
    background: #ede9fe;
    color: #5b21b6;
  }

  .grupo-color-4 {
    background: #fee2e2;
    color: #991b1b;
  }

  .grupo-color-5 {
    background: #fef3c7;
    color: #92400e;
  }

  .grupo-color-6 {
    background: #cffafe;
    color: #155e75;
  }

  .convocatoria-form-grid input:focus,
  .convocatoria-form-grid select:focus,
  .convocatoria-form-grid textarea:focus {
    outline: none;
    border-color: var(--primary);
    background: white;
  }

  .full-width {
    grid-column: 1 / -1;
  }

  .convocatoria-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .btn-primary,
  .btn-secondary {
    border: none;
    border-radius: 0.75rem;
    padding: 0.75rem 1.25rem;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-primary {
    background: var(--primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--primary-dark);
  }

  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--text-secondary);
    color: white;
  }

  /* Nuevos estilos para tabla restructurada */
  .main-row {
    border-bottom: 2px solid var(--primary);
  }

  .main-content-cell {
    padding: 1rem 0.75rem !important;
  }

  .main-grid {
    display: grid;
    grid-template-columns: 1fr 1.5fr 150px 150px;
    gap: 1rem;
  }

  .info-section,
  .objective-section,
  .grupos-section,
  .acciones-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .info-section .info-stack {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .info-section .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .info-section .info-label {
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .info-section .info-text {
    color: var(--text-primary);
    font-weight: 500;
  }

  .objetivo-section {
    min-height: 80px;
  }

  .grupos-section {
    min-height: 80px;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
  }

  .grupos-section .grupos-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .acciones-section {
    min-height: 80px;
    justify-content: center;
  }

  .acciones-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* Fila intermedia */
  .info-row {
    background-color: rgba(5, 150, 105, 0.05);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }

  .info-row-content {
    padding: 0.75rem 0.75rem !important;
  }

  .info-row-grid {
    display: grid;
    grid-template-columns: 1fr 200px 150px 120px;
    gap: 1rem;
    align-items: center;
  }

  .info-row-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .info-row-item.timer {
    justify-content: flex-end;
  }

  .info-row-label {
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    white-space: nowrap;
  }

  .btn-location-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    color: var(--primary);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    padding: 0.25rem 0;
    transition: color 0.2s;
    text-align: left;
    max-width: 100%;
    white-space: normal;
    word-break: break-word;
  }

  .btn-location-cell:hover {
    color: var(--primary-dark);
    text-decoration: underline;
  }

  .btn-location-cell svg {
    flex-shrink: 0;
  }

  .timer-value {
    font-weight: 700;
    color: var(--primary);
    font-size: 0.9rem;
  }

  /* Responsive */
  @media (max-width: 1200px) {
    .table-container {
      overflow-x: hidden;
    }
  }

  @media (max-width: 768px) {
    .convocatorias-container {
      padding: 1rem;
    }

    .header-section {
      flex-direction: column;
      gap: 1rem;
    }

    .header-actions {
      width: 100%;
      align-items: stretch;
    }

    .header-buttons {
      width: 100%;
      justify-content: stretch;
    }

    .page-title {
      font-size: 1.5rem;
    }

    .btn-programar-actividad,
    .btn-toggle-filtros {
      width: 100%;
    }

    .filters-grid {
      grid-template-columns: 1fr;
    }

    .date-range-panel {
      width: 100%;
      max-width: 100%;
    }

    .actividades-table thead {
      display: none;
    }

    .actividades-table tbody tr {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.75rem;
      padding: 0.75rem 0.5rem;
    }

    .actividades-table td {
      padding: 0.5rem 0;
    }

    .info-cell {
      order: 1;
      width: auto;
      min-width: 0;
    }

    .objetivo-cell {
      order: 2;
      width: auto;
      min-width: 0;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border);
    }

    .actividades-table th:nth-child(3),
    .grupos-cell {
      display: none;
    }

    .acciones-cell {
      order: 3;
      width: auto;
      min-width: 0;
      text-align: left;
      padding-top: 0.25rem;
    }

    .acciones-buttons {
      width: 100%;
      justify-content: flex-start;
    }

    .grupos-inline {
      display: flex;
    }

    .convocatoria-form-grid {
      grid-template-columns: 1fr;
    }

    .convocatoria-modal {
      max-height: 92vh;
      padding-bottom: 5.25rem;
    }

    .convocatoria-actions {
      position: sticky;
      bottom: 0;
      z-index: 40;
      margin-top: 0.75rem;
      margin-left: -1.25rem;
      margin-right: -1.25rem;
      margin-bottom: -1.25rem;
      padding: 0.75rem 1.25rem calc(0.75rem + env(safe-area-inset-bottom));
      background: white;
      border-top: 1px solid var(--border);
      box-shadow: 0 -6px 16px rgba(15, 23, 42, 0.08);
    }

    .convocatoria-actions .btn-primary,
    .convocatoria-actions .btn-secondary {
      min-height: 44px;
    }

    .btn-back-to-top {
      right: 1rem;
      bottom: 1rem;
      width: 2.75rem;
      height: 2.75rem;
    }
  }

  @media (max-width: 640px) {
    .actividades-table th:nth-child(3),
    .grupos-cell {
      display: none;
    }

    .grupos-inline {
      display: flex;
    }
  }
</style>
