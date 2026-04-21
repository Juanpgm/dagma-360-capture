/**
 * Sistema de roles y permisos
 *
 * Jerarquía (menor a mayor):
 *   operador (1) < lider (2) < administrador (3) < desarrollador (4)
 *
 * Estas funciones son puras (no dependen de stores) para facilitar testing.
 * Para uso reactivo en componentes Svelte usa el store $permissions de authStore.
 */

export type Role = 'operador' | 'lider' | 'administrador' | 'desarrollador';

export const ROLE_HIERARCHY: Record<Role, number> = {
  operador: 1,
  lider: 2,
  administrador: 3,
  desarrollador: 4,
};

export const ROLE_LABELS: Record<Role, string> = {
  operador: 'Operador',
  lider: 'Líder',
  administrador: 'Administrador',
  desarrollador: 'Desarrollador',
};

export const ROLE_COLORS: Record<Role, string> = {
  operador: '#64748b',
  lider: '#2563eb',
  administrador: '#7c3aed',
  desarrollador: '#dc2626',
};

/** Normaliza cualquier representación de rol del backend al tipo Role canónico */
export function normalizeRole(raw: string | string[] | undefined | null): Role {
  const str = Array.isArray(raw) ? raw[0] : raw;
  if (!str) return 'operador';
  const lower = str.toLowerCase().trim();
  if (lower === 'admin' || lower === 'administrador') return 'administrador';
  if (lower === 'lider' || lower === 'líder' || lower === 'leader') return 'lider';
  if (lower === 'desarrollador' || lower === 'developer' || lower === 'dev') return 'desarrollador';
  return 'operador';
}

/** Retorna el nivel numérico del rol del usuario */
export function getRoleLevel(user: { role?: string; rol?: string; roles?: string[] } | null | undefined): number {
  if (!user) return 0;
  const role = normalizeRole(user.role ?? user.rol ?? user.roles);
  return ROLE_HIERARCHY[role] ?? 1;
}

/** El usuario tiene exactamente uno de los roles especificados */
export function hasRole(user: { role?: string; rol?: string; roles?: string[] } | null | undefined, ...roles: Role[]): boolean {
  if (!user) return false;
  const normalized = normalizeRole(user.role ?? user.rol ?? user.roles);
  return roles.includes(normalized);
}

/** El usuario tiene al menos el rol mínimo requerido (por jerarquía) */
export function hasMinRole(user: { role?: string; rol?: string; roles?: string[] } | null | undefined, min: Role): boolean {
  return getRoleLevel(user) >= ROLE_HIERARCHY[min];
}

// ─── Helpers semánticos ───────────────────────────────────────────────────────

/** Puede modificar (editar) reportes, visitas, reconocimientos */
export function canEdit(user: { role?: string; rol?: string; roles?: string[] } | null | undefined): boolean {
  return hasMinRole(user, 'administrador');
}

/** Puede eliminar reportes, visitas, reconocimientos */
export function canDelete(user: { role?: string; rol?: string; roles?: string[] } | null | undefined): boolean {
  return hasMinRole(user, 'administrador');
}

/** Puede ver/acceder a la pestaña "Grupos y Personal" */
export function canManageUsers(user: { role?: string; rol?: string; roles?: string[] } | null | undefined): boolean {
  return hasMinRole(user, 'lider');
}

/** Puede ver grupos y personal de TODOS los grupos (admin/dev) */
export function canSeeAllGroups(user: { role?: string; rol?: string; roles?: string[] } | null | undefined): boolean {
  return hasMinRole(user, 'administrador');
}

/** Puede asignar/desasignar personal en un grupo específico */
export function canAssignInGroup(
  user: { role?: string; rol?: string; roles?: string[]; grupo?: string } | null | undefined,
  targetGrupo: string
): boolean {
  if (!user) return false;
  if (hasMinRole(user, 'administrador')) return true;
  // Líder: solo en su propio grupo
  if (hasRole(user, 'lider') && user.grupo) {
    return user.grupo === targetGrupo;
  }
  return false;
}

/** Puede cambiar el rol de otros usuarios */
export function canChangeRoles(user: { role?: string; rol?: string; roles?: string[] } | null | undefined): boolean {
  // Solo desarrollador puede asignar/quitar el rol desarrollador
  const normalized = normalizeRole(user?.role ?? user?.rol ?? user?.roles);
  return normalized === 'desarrollador' || normalized === 'administrador';
}

/**
 * Retorna los roles que este usuario puede asignar a otros.
 * Administrador no puede asignar "desarrollador".
 */
export function assignableRoles(user: { role?: string; rol?: string; roles?: string[] } | null | undefined): Role[] {
  if (!user) return [];
  const normalized = normalizeRole(user.role ?? user.rol ?? user.roles);
  if (normalized === 'desarrollador') return ['operador', 'lider', 'administrador', 'desarrollador'];
  if (normalized === 'administrador') return ['operador', 'lider', 'administrador'];
  // Líder y operador no pueden asignar roles
  return [];
}

/** Compila todos los permisos del usuario en un objeto plano para usar en templates */
export function buildPermissions(user: { role?: string; rol?: string; roles?: string[]; grupo?: string } | null | undefined) {
  return {
    role: normalizeRole(user?.role ?? user?.rol ?? user?.roles),
    grupo: user?.grupo ?? null,
    canEdit: canEdit(user),
    canDelete: canDelete(user),
    canManageUsers: canManageUsers(user),
    canSeeAllGroups: canSeeAllGroups(user),
    canChangeRoles: canChangeRoles(user),
    /** Pass a target grupo string to check if the current user can assign in it */
    canAssignInGroup: (targetGrupo: string) => canAssignInGroup(user, targetGrupo),
    assignableRoles: assignableRoles(user),
    isOperador: hasRole(user, 'operador'),
    isLider: hasRole(user, 'lider'),
    isAdmin: hasRole(user, 'administrador'),
    isDev: hasRole(user, 'desarrollador'),
  };
}
