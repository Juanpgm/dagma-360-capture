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
