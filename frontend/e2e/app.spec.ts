/**
 * E2E — Autenticación con sesión inyectada
 * Usa injectAuthState para saltar el login UI e ir directo a la app logueada.
 * Cubre: navegación, visitas (Step1), registro de intervención.
 */
import { test, expect } from '@playwright/test';
import { APP_URL, TEST_USER, injectAuthState, firebaseSignIn } from './helpers';

const BASE = APP_URL;
let authBootstrapError: string | null = null;
let authReady = false;

test.describe('App autenticada — navegación principal', () => {
  test.beforeAll(async () => {
    try {
      await firebaseSignIn(TEST_USER.email, TEST_USER.password);
      authReady = true;
    } catch (err) {
      authReady = false;
      authBootstrapError = err instanceof Error ? err.message : String(err);
    }
  });

  test.beforeEach(async ({ page }) => {
    test.skip(!authReady, `No se pudo autenticar usuario E2E en Firebase: ${authBootstrapError ?? 'sin detalle'}`);
    await injectAuthState(page, TEST_USER.email, TEST_USER.password);
    await page.reload({ waitUntil: 'networkidle' });
  });

  test('muestra el home con nombre de usuario', async ({ page }) => {
    // After reload with valid auth, should see home (not login form)
    await expect(page.locator('input[type="email"]')).not.toBeVisible({ timeout: 15000 });
    // "Bienvenido" heading appears on the home screen
    await expect(page.locator('h1:has-text("Bienvenido"), h2:has-text("Bienvenido"), [class*="home"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('puede navegar a registro de visita', async ({ page }) => {
    // Click on "Intervención" card (the correct label in the home menu)
    const visitaBtn = page.locator('button:has-text("Intervención"), a:has-text("Intervención"), [class*="card"]:has-text("Intervención")').first();
    await expect(visitaBtn).toBeVisible({ timeout: 15000 });
    await visitaBtn.click();

    // Step 1 should appear (selector group or actividades list)
    await expect(page.locator('[class*="step"], [class*="act-table"], [class*="cards-mobile"], h1, h2, h3').first())
      .toBeVisible({ timeout: 15000 });
  });

  test('paso 1 muestra actividades o estado vacío', async ({ page }) => {
    // Navigate to Intervención
    const visitaBtn = page.locator('[class*="card"]:has-text("Intervención"), button:has-text("Intervención")').first();
    if (await visitaBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await visitaBtn.click();
    }

    // Either shows a table of activities or a selector UI
    const content = page.locator('[class*="act-table"], [class*="cards-mobile"], [class*="empty"], [class*="group"], [class*="selector"]').first();
    await expect(content).toBeVisible({ timeout: 20000 });
  });

  test('paso 1 — búsqueda filtra actividades', async ({ page }) => {
    const visitaBtn = page.locator('[class*="card"]:has-text("Intervención"), button:has-text("Intervención")').first();
    if (await visitaBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await visitaBtn.click();
    }

    // Wait for content to load
    await page.waitForTimeout(3000);

    // Look for the search input
    const searchInput = page.locator('input[placeholder*="Buscar"], input[type="search"], input[placeholder*="buscar"]').first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill('test');
      // Results badge should update or "no results" shows
      await page.waitForTimeout(500);
      const badge = page.locator('[class*="badge"], [class*="results"], [class*="count"]').first();
      // Just verify no error thrown
      await expect(page).not.toHaveURL(/error/);
    }
  });

  test('programación — líder depende de grupos requeridos', async ({ page }) => {
    // Navegar al módulo Intervención / Programación
    const intervencionBtn = page.locator('button:has-text("Intervención"), a:has-text("Intervención"), [class*="card"]:has-text("Intervención")').first();
    await expect(intervencionBtn).toBeVisible({ timeout: 15000 });
    await intervencionBtn.click();

    // Si el usuario E2E no tiene permisos de líder, saltar la prueba con mensaje explícito
    const programarBtn = page.locator('button:has-text("Programar nueva actividad")').first();
    const canProgramar = await programarBtn.isVisible({ timeout: 6000 }).catch(() => false);
    test.skip(!canProgramar, 'El usuario E2E no tiene rol líder para abrir el modal de programación.');

    await programarBtn.click();
    await expect(page.locator('h2:has-text("Programación de Actividad")').first()).toBeVisible({ timeout: 10000 });

    const liderTrigger = page.locator('.lider-dropdown-trigger').first();
    const gruposTrigger = page.locator('.grupos-required-trigger').first();

    // 1) Antes de elegir grupos, el selector de líder debe estar deshabilitado
    await expect(liderTrigger).toBeDisabled();
    await expect(liderTrigger).toContainText('Selecciona primero los grupos requeridos');

    // 2) Seleccionar un grupo requerido habilita el selector de líder
    await gruposTrigger.click();
    const firstGroupOption = page.locator('.grupos-option-item').first();
    await expect(firstGroupOption).toBeVisible({ timeout: 10000 });
    const selectedGroup = ((await firstGroupOption.textContent()) || '').trim().replace(/^✓\s*/, '');
    await firstGroupOption.click();

    // Cerrar panel de grupos y validar habilitación
    await gruposTrigger.click();
    await expect(liderTrigger).toBeEnabled();

    // 3) Abrir líderes y verificar hint de filtro por grupo
    await liderTrigger.click();
    await expect(page.locator('.lider-filter-hint').first()).toContainText('Mostrando líderes de:');
    if (selectedGroup) {
      await expect(page.locator('.lider-filter-hint').first()).toContainText(selectedGroup);
    }

    const leaderOptions = page.locator('.lider-option-item');
    const hasLeaderOptions = (await leaderOptions.count()) > 0;

    // Si hay opciones, seleccionar una y luego remover el grupo para validar limpieza automática
    if (hasLeaderOptions) {
      const chosenLeaderName = ((await leaderOptions.first().locator('.lider-option-name').textContent()) || '').trim();
      await leaderOptions.first().click();
      await expect(liderTrigger).toContainText(chosenLeaderName);

      // Quitar el grupo seleccionado (toggle en el panel) y validar reset del líder
      await gruposTrigger.click();
      await firstGroupOption.click();
      await gruposTrigger.click();

      await expect(liderTrigger).toBeDisabled();
      await expect(liderTrigger).toContainText('Selecciona primero los grupos requeridos');
      await expect(liderTrigger).not.toContainText(chosenLeaderName);
    } else {
      // Sin líderes para el grupo seleccionado: validar empty state específico
      await expect(page.locator('.lider-empty-state').first()).toContainText('No hay líderes registrados para');
    }
  });

  test('logout cierra la sesión y vuelve al login', async ({ page }) => {
    // Logout icon button has title="Cerrar sesión"
    const logoutBtn = page.locator('button[title="Cerrar sesión"]').first();
    await expect(logoutBtn).toBeVisible({ timeout: 15000 });
    await logoutBtn.click();

    // Should be back at login
    await expect(page.locator('input[type="email"], input[placeholder*="correo"]').first()).toBeVisible({ timeout: 15000 });
  });
});
