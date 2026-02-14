// Tipos para actividades del Plan Distrito Verde

export interface PuntoEncuentro {
  direccion: string;
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
  punto_encuentro: PuntoEncuentro;
  objetivo_actividad: string;
  personas_requeridas_grupo: number;
  grupos_requeridos: string[]; // Array de grupos
  lider_actividad: string;
  observaciones: string;
  telefono?: string;
}

export interface ActividadesAPIResponse {
  success: boolean;
  total: number;
  data: ActividadPlanDistritoVerde[];
}
