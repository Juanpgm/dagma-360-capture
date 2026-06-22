import { describe, it, expect } from 'vitest';
import { canEdit, canSeeAllGroups, canManageUsers, buildPermissions } from './permissions';

const operador = { role: 'operador' };
const lider = { role: 'lider' };
const admin = { role: 'administrador' };
const dev = { role: 'desarrollador' };

describe('canEdit (editar reportes desde el dashboard)', () => {
  it('lo permite a administrador y superior', () => {
    expect(canEdit(admin)).toBe(true);
    expect(canEdit(dev)).toBe(true);
  });

  it('lo niega a operador y líder', () => {
    expect(canEdit(operador)).toBe(false);
    expect(canEdit(lider)).toBe(false);
  });

  it('lo niega a usuario nulo', () => {
    expect(canEdit(null)).toBe(false);
  });
});

describe('canManageUsers (líder y superior)', () => {
  it('permite líder y admin, niega operador', () => {
    expect(canManageUsers(lider)).toBe(true);
    expect(canManageUsers(admin)).toBe(true);
    expect(canManageUsers(operador)).toBe(false);
  });
});

describe('canSeeAllGroups (admin y superior)', () => {
  it('permite admin, niega líder y operador', () => {
    expect(canSeeAllGroups(admin)).toBe(true);
    expect(canSeeAllGroups(lider)).toBe(false);
    expect(canSeeAllGroups(operador)).toBe(false);
  });
});

describe('buildPermissions', () => {
  it('expone canEdit consistente con el helper', () => {
    expect(buildPermissions(admin).canEdit).toBe(true);
    expect(buildPermissions(operador).canEdit).toBe(false);
  });
});
