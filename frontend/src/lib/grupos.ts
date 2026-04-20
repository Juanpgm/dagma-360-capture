
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

// --- API: GET /grupos ---

export interface GrupoAPILider {
  nombre: string | null;
  email: string | null;
  numero_contacto: string | null;
}

export interface GrupoAPIItem {
  id: string;
  nombre: string;
  email: string;
  lider: GrupoAPILider;
}

const GRUPOS_API_URL = '/api/grupos';

/**
 * Obtiene los grupos desde GET /grupos.
 * Devuelve la lista completa con id, nombre, email y lider.
 */
export async function getGruposAPI(): Promise<GrupoAPIItem[]> {
  const res = await fetch(GRUPOS_API_URL, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();
  const rows: any[] = Array.isArray(json)
    ? json
    : Array.isArray(json?.data)
      ? json.data
      : [];

  return rows
    .filter((item) => item && item.nombre)
    .map((item): GrupoAPIItem => ({
      id: item.id || '',
      nombre: (item.nombre || '').toString().trim(),
      email: (item.email || '').toString().trim(),
      lider: {
        nombre: item.lider?.nombre || null,
        email: item.lider?.email || null,
        numero_contacto: item.lider?.numero_contacto || null,
      },
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/**
 * Devuelve solo los nombres de grupo (string[]) desde la API.
 */
export async function getGruposNombres(): Promise<string[]> {
  const grupos = await getGruposAPI();
  return grupos.map((g) => g.nombre);
}

/**
 * Devuelve los líderes extraídos de GET /grupos.
 * Compatible con LiderGrupoOption { nombre, grupo }.
 */
export async function getLideresFromGrupos(): Promise<{ nombre: string; grupo: string }[]> {
  const grupos = await getGruposAPI();
  return grupos
    .filter((g) => g.lider.nombre)
    .map((g) => ({
      nombre: g.lider.nombre!,
      grupo: g.nombre,
    }));
}
