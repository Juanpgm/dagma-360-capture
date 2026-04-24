export type GrupoKey = "cuadrilla" | "vivero" | "gobernanza" | "ecosistemas" | "umata";
export type GrupoFormType = GrupoKey | "operativo";

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

export interface LiderGrupoOption {
	nombre: string;
	grupo: string;
}

/** Obtiene líderes desde /personal_operativo para usarlos en selects de actividades */
export async function getLideresFromGrupos(): Promise<LiderGrupoOption[]> {
	try {
		const res = await ApiClient.get<any>('/personal_operativo', { requireAuth: true });
		const rows: any[] = Array.isArray(res) ? res : res.data ?? res.personal ?? [];
		const map = new Map<string, LiderGrupoOption>();
		for (const item of rows) {
			const nombre = (
				item.nombre_completo ||
				item.full_name ||
				item.nombre ||
				''
			).toString().trim();
			const grupo = (item.grupo || '').toString().trim();
			if (!nombre) continue;
			const key = `${nombre}::${grupo}`.toLowerCase();
			if (!map.has(key)) map.set(key, { nombre, grupo });
		}
		return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
	} catch {
		return [];
	}
}
