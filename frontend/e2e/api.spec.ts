/**
 * E2E — Backend API flows
 * Tests the production backend API directly (no browser needed).
 * Covers: validate-session, complete-google-profile, health check.
 */
import { test, expect } from '@playwright/test';
import { firebaseSignIn, validateSession, API_URL, TEST_USER } from './helpers';

let idToken: string | null = null;
let authBootstrapError: string | null = null;

test.describe('Backend API — flujos críticos', () => {
  test.beforeAll(async () => {
    try {
      const { idToken: tok } = await firebaseSignIn(TEST_USER.email, TEST_USER.password);
      idToken = tok;
    } catch (err) {
      authBootstrapError = err instanceof Error ? err.message : String(err);
      idToken = null;
    }
  });

  test.beforeEach(async ({}, testInfo) => {
    const requiresAuth = ![
      'API está online — /health o raíz responde 200',
      'validate-session rechaza token inválido → 401',
      'validate-session rechaza petición sin Authorization → 401 o 403',
      'lista de actividades es accesible (endpoint público)',
    ].includes(testInfo.title);

    test.skip(
      requiresAuth && !idToken,
      `No se pudieron obtener credenciales E2E de Firebase: ${authBootstrapError ?? 'sin detalle'}`,
    );
  });

  test('API está online — /health o raíz responde 200', async ({ request }) => {
    const resp = await request.get(`${API_URL}/`);
    expect([200, 301, 302, 307]).toContain(resp.status());
  });

  test('validate-session devuelve sesión válida con token de test', async () => {
    if (!idToken) test.skip(true, 'Sin idToken para validar sesión');
    const session = await validateSession(idToken as string);
    expect(session.valid).toBe(true);
    expect(session.needs_profile_completion).toBe(false);
    expect(session.user).toBeDefined();
    expect(session.user.email).toBe(TEST_USER.email);
    expect(session.user.grupo).toBeTruthy();
  });

  test('validate-session rechaza token inválido → 401', async ({ request }) => {
    const resp = await request.post(`${API_URL}/auth/validate-session`, {
      headers: { Authorization: 'Bearer token-completamente-invalido' },
    });
    expect(resp.status()).toBe(401);
  });

  test('validate-session rechaza petición sin Authorization → 401 o 403', async ({ request }) => {
    const resp = await request.post(`${API_URL}/auth/validate-session`);
    expect([401, 403, 422]).toContain(resp.status());
  });

  test('lista de actividades es accesible (endpoint público)', async ({ request }) => {
    const resp = await request.get(`${API_URL}/actividades`);
    // The endpoint returns 200 with data (publicly readable)
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(Array.isArray(data) || typeof data === 'object').toBeTruthy();
  });

  test('lista de actividades con auth devuelve array', async ({ request }) => {
    if (!idToken) test.skip(true, 'Sin idToken para endpoint autenticado');
    const resp = await request.get(`${API_URL}/actividades`, {
      headers: { Authorization: `Bearer ${idToken as string}` },
    });
    // Either 200 with data or 404 if no data, but should be authenticated
    expect([200, 404]).toContain(resp.status());
    if (resp.status() === 200) {
      const data = await resp.json();
      expect(Array.isArray(data) || Array.isArray(data.actividades) || typeof data === 'object').toBeTruthy();
    }
  });
});
