import { ApiClient } from '../lib/api-client';
import type { Role } from '../lib/permissions';

export interface UserRecord {
  uid: string;
  email: string;
  nombre_completo?: string;
  full_name?: string;
  displayName?: string;
  grupo?: string;
  nombre_centro_gestor?: string;
  role?: Role;
  rol?: string;
  roles?: string[];
  [key: string]: any;
}

/**
 * Obtiene la lista de usuarios del sistema.
 * GET /admin/users — el backend filtra por grupo automáticamente para líder.
 */
export async function getUsers(grupo?: string): Promise<UserRecord[]> {
  const params = new URLSearchParams();
  params.set('limit', '200');
  if (grupo) params.set('grupo', grupo);
  const res = await ApiClient.get<any>(`/admin/users?${params.toString()}`);
  return Array.isArray(res) ? res : res.data ?? res.users ?? [];
}

/**
 * Cambia el rol de un usuario.
 * PATCH /admin/users/{uid}/role  — ChangeRoleRequest: { role: string }
 *
 * Reglas de negocio aplicadas en backend:
 *   - administrador puede asignar hasta 'administrador' (no 'desarrollador')
 *   - desarrollador puede asignar cualquier rol
 *   - lider / operador reciben 403
 *   - nadie puede cambiar su propio rol (excepto desarrollador)
 */
export async function changeUserRole(uid: string, role: Role): Promise<UserRecord> {
  return ApiClient.patch<UserRecord>(`/admin/users/${encodeURIComponent(uid)}/role`, { role });
}

