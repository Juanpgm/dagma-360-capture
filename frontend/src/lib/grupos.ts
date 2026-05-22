export type GrupoKey = "cuadrilla" | "vivero" | "gobernanza" | "ecosistemas" | "umata";
export type GrupoFormType = GrupoKey | "operativo";

/**
 * Normaliza un nombre de grupo para comparaciones tolerantes en el frontend.
 *
 * Equivale a `app.utils.text_utils.normalize_grupo` del backend:
 *   - lowercase + trim
 *   - elimina tildes/diacríticos (NFKD + filtrado de marcas combinantes)
 *   - trata "_" como espacio (para grupos como "Central_Social" vs "Central Social")
 *   - colapsa secuencias de espacios en uno solo
 *
 * Garantiza que "Central Social", "central_social" y "CENTRAL  SOCIAL" se
 * consideren equivalentes, y que "Reacción" coincida con "reaccion".
 * Úsala SIEMPRE para comparar nombres de grupo provenientes de fuentes
 * heterogéneas (Firestore, formularios, claims de Firebase Auth, etc.).
 */
export function normalizeGrupo(value: string | null | undefined): string {
	if (!value) return '';
	return value
		.toString()
		.normalize('NFKD')
		.replace(/\p{M}+/gu, '')
		.toLowerCase()
		.replace(/_/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** True si dos nombres de grupo representan el mismo grupo (tolerante a tildes, "_" y mayúsculas). */
export function gruposMatch(a: string | null | undefined, b: string | null | undefined): boolean {
	return normalizeGrupo(a) === normalizeGrupo(b);
}

// Claves de grupos operativos estándar (ajustar según la app)
export const GRUPO_KEYS: GrupoKey[] = [
	"cuadrilla",
	"vivero",
	"gobernanza",
	"ecosistemas",
	"umata"
];

// Nombres para mostrar en UI — UMATA siempre en mayúsculas completas
export const GRUPO_DISPLAY_NAMES: Record<GrupoKey, string> = {
	cuadrilla: "Cuadrilla",
	vivero: "Vivero",
	gobernanza: "Gobernanza",
	ecosistemas: "Ecosistemas",
	umata: "UMATA",
};

// Descripción corta por grupo para UI de selección
export const GRUPO_DESCRIPTIONS: Record<GrupoKey, string> = {
	cuadrilla: "Intervenciones arbóreas: poda, tala, mantenimiento",
	vivero: "Siembra, trasplante y distribución de material vegetal",
	gobernanza: "Talleres, capacitaciones y sensibilización ambiental",
	ecosistemas: "Restauración, monitoreo y control ambiental",
	umata: "Atención veterinaria y asistencia técnica agropecuaria",
};


// Devuelve los nombres de los grupos operativos disponibles en el sistema.
// Usa el endpoint /grupos que retorna objetos completos; extrae solo el campo nombre.
import { ApiClient } from './api-client';

export async function getGruposNombres(): Promise<string[]> {
	try {
		// requireAuth: false — el endpoint /grupos es público y se llama antes del login (registro)
		const res = await ApiClient.get<any>('/grupos', { requireAuth: false });
		// El backend devuelve { status, data: [{id, nombre, ...}], count, ... }
		const data: any[] = Array.isArray(res) ? res : res.data ?? res.grupos ?? [];
		const nombres = data
			.map((g: any) => (g.nombre ?? '').toString().trim())
			.filter(Boolean);
		return nombres.length > 0 ? nombres : Object.values(GRUPO_DISPLAY_NAMES);
	} catch (err) {
		// Fallback a lista estática si el endpoint falla
		return Object.values(GRUPO_DISPLAY_NAMES);
	}
}

export interface GrupoConId {
	id: string;
	nombre: string;
}

/** Devuelve grupos con su id (clave de Firestore) y nombre de display */
export async function getGruposConIds(): Promise<GrupoConId[]> {
	try {
		const res = await ApiClient.get<any>('/grupos', { requireAuth: false });
		const data: any[] = Array.isArray(res) ? res : res.data ?? res.grupos ?? [];
		const grupos = data
			.filter((g: any) => g.id && g.nombre)
			.map((g: any) => ({ id: g.id.toString().trim(), nombre: g.nombre.toString().trim() }));
		return grupos.length > 0 ? grupos : GRUPO_KEYS.map(k => ({ id: k, nombre: GRUPO_DISPLAY_NAMES[k] }));
	} catch (err) {
		return GRUPO_KEYS.map(k => ({ id: k, nombre: GRUPO_DISPLAY_NAMES[k] }));
	}
}

export interface LiderGrupoOption {
	nombre: string;
	grupo: string;
	email?: string;
	role?: string;
}

/** Obtiene líderes desde el catálogo canónico de usuarios para usarlos en selects de actividades */
export async function getLideresFromGrupos(): Promise<LiderGrupoOption[]> {
	try {
		const res = await ApiClient.get<any>('/admin/users/lideres', { requireAuth: true });
		const rows: any[] = Array.isArray(res) ? res : res.data ?? res.personal ?? [];
		const map = new Map<string, LiderGrupoOption>();
		for (const item of rows) {
			const nombre = (
				item.nombre_completo ||
				item.full_name ||
				item.displayName ||
				item.nombre ||
				item.email ||
				''
			).toString().trim();
			const grupo = (item.grupo || '').toString().trim();
			const email = (item.email || '').toString().trim();
			const role = (item.role || '').toString().trim() || undefined;
			if (!nombre) continue;
			const key = `${nombre}::${grupo}`.toLowerCase();
			if (!map.has(key)) map.set(key, { nombre, grupo, email: email || undefined, role });
		}
		return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
	} catch {
		return [];
	}
}
