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
// Se obtiene desde el endpoint /grupos/nombres (ajustar si el endpoint real es diferente).
import { ApiClient } from './api-client';

export async function getGruposNombres(): Promise<string[]> {
	try {
		const res = await ApiClient.get<{ success: boolean; data: string[] }>(
			'/grupos/nombres',
			{ requireAuth: true }
		);
		return Array.isArray(res.data) ? res.data : [];
	} catch (err) {
		// Fallback: retorna un arreglo vacío si falla
		return [];
	}
}

// Placeholder para getLideresFromGrupos si es necesario
export async function getLideresFromGrupos(): Promise<any[]> {
	// Implementar según el endpoint real
	return [];
}
