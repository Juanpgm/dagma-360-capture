// Tipos para actividades del Plan Distrito Verde

export interface PuntoEncuentro {
  direccion: string;
  comuna_corregimiento?: string;
  barrio_vereda?: string;
  geometry: {
    type: string;
    coordinates: [number, number]; // [longitud, latitud]
  };
}

export interface ActividadPlanDistritoVerde {
  id: string;
  tipo_jornada: string;
  fecha_actividad: string; // Formato DD/MM/YYYY
  hora_encuentro: string;
  duracion_actividad?: number; // Duración en horas
  punto_encuentro: PuntoEncuentro;
  objetivo_actividad: string;
  personas_requeridas_grupo: number;
  grupos_requeridos: string[]; // Array de grupos
  lider_actividad: string;
  observaciones: string;
  telefono?: string;
  marca_temporal?: string; // ISO 8601 timestamp
  estado_actividad?: "Programada" | "En ejecución" | "Finalizada"; // Estado de la actividad
}

export interface ActividadesAPIResponse {
  success: boolean;
  total: number;
  data: ActividadPlanDistritoVerde[];
}

export interface ConvocarActividadRequest {
  tipo_jornada: string;
  fecha_actividad: string;
  hora_encuentro: string;
  grupos_requeridos: string[];
  lider_actividad: string;
  punto_encuentro: {
    direccion: string;
    geometry: {
      type: "Point";
      coordinates: [number, number];
    };
  };
  observaciones?: string;
  telefono: string;
  objetivo_actividad: string;
  email: string;
}

export interface ConvocarActividadResponse {
  success: boolean;
  id: string;
  message: string;
  marca_temporal: string;
  data: Record<string, unknown>;
}
