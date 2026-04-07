export const GRUPOS_DAGMA = [
  "Dirección",
  "Ecosistemas Y UMATA",
  "Calidad Ambiental",
  "Comunicaciones",
  "UMATA",
  "PSA",
  "Cambio Climático",
  "Vivero",
  "Ecourbanismo",
  "Gobernanza",
  "Huertas Urbanas",
  "Flora Urbana",
  "Gerencia Social",
  "Ecosistemas",
  "Acústica",
  "Hídrico",
  "Urbanismo",
  "Residuos Sólidos",
  "Calidad del Aire",
  "Flora",
  "Fauna Silvestre",
  "Trámite",
  "Cuadrilla",
  "IEC",
] as const;

// ============================================
// Tipos de formulario por grupo
// ============================================

export type GrupoFormType = 'cuadrilla' | 'vivero' | 'gobernanza' | 'ecosistemas' | 'umata' | 'operativo';

export interface GrupoConfig {
  formType: GrupoFormType;
  slug: string;
  postEndpoint: string;
  getEndpoint: string;
  label: string;
}

// ============================================
// Mapeo de grupo normalizado → configuración
// ============================================

const GRUPO_ENDPOINT_MAP: Record<string, GrupoConfig> = {
  cuadrilla: {
    formType: 'cuadrilla',
    slug: 'grupo-cuadrilla',
    postEndpoint: '/grupo-cuadrilla/reporte_intervencion',
    getEndpoint: '/grupo-cuadrilla/reportes_intervenciones',
    label: 'Cuadrilla',
  },
  vivero: {
    formType: 'vivero',
    slug: 'grupo-vivero',
    postEndpoint: '/grupo-vivero/reporte_intervencion',
    getEndpoint: '/grupo-vivero/reportes_intervenciones',
    label: 'Vivero',
  },
  gobernanza: {
    formType: 'gobernanza',
    slug: 'grupo-gobernanza',
    postEndpoint: '/grupo-gobernanza/reporte_intervencion',
    getEndpoint: '/grupo-gobernanza/reportes_intervenciones',
    label: 'Gobernanza',
  },
  ecosistemas: {
    formType: 'ecosistemas',
    slug: 'grupo-ecosistemas',
    postEndpoint: '/grupo-ecosistemas/reporte_intervencion',
    getEndpoint: '/grupo-ecosistemas/reportes_intervenciones',
    label: 'Ecosistemas',
  },
  umata: {
    formType: 'umata',
    slug: 'grupo-umata',
    postEndpoint: '/grupo-umata/reporte_intervencion',
    getEndpoint: '/grupo-umata/reportes_intervenciones',
    label: 'UMATA',
  },
};

const OPERATIVO_DEFAULT: GrupoConfig = {
  formType: 'operativo',
  slug: 'grupo-operativo',
  postEndpoint: '/grupo-operativo/reconocimiento',
  getEndpoint: '',
  label: 'Operativo',
};

/**
 * Normaliza un string: minúsculas, quita acentos.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Determina la configuración de grupo a partir del array de grupos del usuario.
 * Prioridad: primera coincidencia gana. Si no hay match → operativo.
 * "Ecosistemas Y UMATA" mapea a Ecosistemas.
 */
export function getGrupoConfig(userGroups: string[]): GrupoConfig {
  for (const group of userGroups) {
    const normalized = normalize(group);

    // Coincidencia directa por clave del mapa
    for (const [key, config] of Object.entries(GRUPO_ENDPOINT_MAP)) {
      if (normalized === key || normalized.includes(key)) {
        return config;
      }
    }
  }

  return OPERATIVO_DEFAULT;
}
