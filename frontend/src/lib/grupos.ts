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

export type GrupoFormType = 'cuadrilla' | 'vivero' | 'gobernanza' | 'ecosistemas' | 'umata';

export type GrupoKey = 'cuadrilla' | 'vivero' | 'gobernanza' | 'ecosistemas' | 'umata';

export const GRUPO_KEYS: GrupoKey[] = ['cuadrilla', 'vivero', 'gobernanza', 'ecosistemas', 'umata'];

export interface GrupoConfig {
  formType: GrupoFormType;
  slug: GrupoKey;
  postEndpoint: string;
  getEndpoint: string;
  label: string;
}

const GRUPO_ENDPOINT_MAP: Record<GrupoKey, GrupoConfig> = {
  cuadrilla: {
    formType: 'cuadrilla',
    slug: 'cuadrilla',
    postEndpoint: '/grupos/cuadrilla/reporte_intervencion',
    getEndpoint: '/grupos/cuadrilla/reportes_intervenciones',
    label: 'Cuadrilla',
  },
  vivero: {
    formType: 'vivero',
    slug: 'vivero',
    postEndpoint: '/grupos/vivero/reporte_intervencion',
    getEndpoint: '/grupos/vivero/reportes_intervenciones',
    label: 'Vivero',
  },
  gobernanza: {
    formType: 'gobernanza',
    slug: 'gobernanza',
    postEndpoint: '/grupos/gobernanza/reporte_intervencion',
    getEndpoint: '/grupos/gobernanza/reportes_intervenciones',
    label: 'Gobernanza',
  },
  ecosistemas: {
    formType: 'ecosistemas',
    slug: 'ecosistemas',
    postEndpoint: '/grupos/ecosistemas/reporte_intervencion',
    getEndpoint: '/grupos/ecosistemas/reportes_intervenciones',
    label: 'Ecosistemas',
  },
  umata: {
    formType: 'umata',
    slug: 'umata',
    postEndpoint: '/grupos/umata/reporte_intervencion',
    getEndpoint: '/grupos/umata/reportes_intervenciones',
    label: 'UMATA',
  },
};

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function getGrupoConfig(userGroups: string[]): GrupoConfig {
  for (const group of userGroups) {
    const normalized = normalize(group);
    for (const [key, config] of Object.entries(GRUPO_ENDPOINT_MAP)) {
      if (normalized === key || normalized.includes(key)) {
        return config;
      }
    }
  }
  return GRUPO_ENDPOINT_MAP.cuadrilla;
}

export function getGrupoConfigByKey(key: GrupoKey): GrupoConfig {
  return GRUPO_ENDPOINT_MAP[key];
}
