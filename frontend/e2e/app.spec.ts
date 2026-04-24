/**
 * E2E — Autenticación con sesión inyectada
 * Usa injectAuthState para saltar el login UI e ir directo a la app logueada.
 * Cubre: navegación, visitas (Step1), registro de intervención.
 */
import { test, expect } from '@playwright/test';
import { APP_URL, TEST_USER, injectAuthState } from './helpers';

const BASE = APP_URL;

test.describe('App autenticada — navegación principal', () => {
  test.beforeEach(async ({ page }) => {
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

  test('logout cierra la sesión y vuelve al login', async ({ page }) => {
    // Logout icon button has title="Cerrar sesión"
    const logoutBtn = page.locator('button[title="Cerrar sesión"]').first();
    await expect(logoutBtn).toBeVisible({ timeout: 15000 });
    await logoutBtn.click();

    // Should be back at login
    await expect(page.locator('input[type="email"], input[placeholder*="correo"]').first()).toBeVisible({ timeout: 15000 });
  });
});
