import { ApiClient } from '../lib/api-client';
import { auth } from '../lib/firebase';
import type { Role } from '../lib/permissions';

async function getToken(): Promise<string> {
  if (auth.currentUser) return auth.currentUser.getIdToken();
  throw new Error('No autenticado');
}

const BASE = () => (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

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
  cellphone?: string;
  photoURL?: string;
  [key: string]: any;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  full_name: string;
  cellphone: string;
  grupo: string;
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
export async function changeUserRole(uid: string, role: Role): Promise<any> {
  return ApiClient.patch<any>(`/admin/users/${encodeURIComponent(uid)}/role`, { role });
}

/**
 * Cambia el grupo de un usuario.
 * PATCH /admin/users/{uid}/grupo
 */
export async function changeUserGrupo(uid: string, grupo: string): Promise<any> {
  return ApiClient.patch<any>(`/admin/users/${encodeURIComponent(uid)}/grupo`, { grupo });
}

/**
 * Actualiza datos de perfil de otro usuario (requiere admin+).
 * PATCH /admin/users/{uid}/profile
 */
export async function updateUserProfile(uid: string, data: { full_name?: string; cellphone?: string }): Promise<any> {
  return ApiClient.patch<any>(`/admin/users/${encodeURIComponent(uid)}/profile`, data);
}

/**
 * El usuario actualiza su propio perfil (cualquier rol autenticado).
 * PATCH /auth/me/profile
 */
export async function selfUpdateMyProfile(data: { full_name?: string; cellphone?: string }): Promise<any> {
  return ApiClient.patch<any>('/auth/me/profile', data);
}

/**
 * Elimina un usuario (Firebase Auth + Firestore).
 * DELETE /auth/user/{uid}  — requiere administrador+
 */
export async function deleteUser(uid: string): Promise<any> {
  return ApiClient.delete<any>(`/auth/user/${encodeURIComponent(uid)}`);
}

/**
 * Restablece la contraseña de otro usuario.
 * POST /auth/change-password  (form data)
 */
export async function resetUserPassword(uid: string, newPassword: string): Promise<any> {
  const { auth } = await import('../lib/firebase');
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  if (!token) throw new Error('No autenticado');
  const form = new URLSearchParams();
  form.append('new_password', newPassword);
  form.append('target_uid', uid);
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/auth/change-password`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Error al cambiar la contraseña');
  }
  return res.json();
}

/**
 * Crea un nuevo usuario en el sistema.
 * POST /auth/register
 */
export async function createUser(payload: CreateUserPayload): Promise<any> {
  return ApiClient.post<any>('/auth/register', payload);
}

/**
 * Sube o reemplaza la foto de perfil del usuario autenticado.
 * POST /auth/me/photo  (multipart/form-data)
 */
export async function uploadProfilePhoto(file: File): Promise<{ photoURL: string }> {
  const token = await getToken();
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
  const form = new FormData();
  form.append('photo', file);
  const res = await fetch(`${baseUrl}/auth/me/photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Error al subir la foto');
  }
  return res.json();
}

