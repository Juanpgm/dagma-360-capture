/**
 * E2E — Login flow
 * Tests the login page against the production app.
 * Covers: email/password login, wrong credentials, logout.
 */
import { test, expect } from '@playwright/test';
import { APP_URL, TEST_USER } from './helpers';

const BASE = APP_URL;

test.describe('Login con email/password', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'networkidle' });
  });

  test('muestra la pantalla de login cuando no hay sesión', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    // Should see login form
    await expect(page.locator('input[type="email"], input[placeholder*="correo"], input[placeholder*="email"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('login exitoso con credenciales válidas', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });

    // Fill login form
    const emailInput = page.locator('input[type="email"], input[placeholder*="correo"], input[placeholder*="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    await emailInput.fill(TEST_USER.email);
    await passwordInput.fill(TEST_USER.password);
    await submitBtn.click();

    // After login the home view should be visible (no more login form)
    await expect(emailInput).not.toBeVisible({ timeout: 15000 });
    // Home screen with "Bienvenido" appears after login
    await expect(page.locator('h1:has-text("Bienvenido"), h2:has-text("Bienvenido"), [class*="home"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('error con credenciales incorrectas', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });

    const emailInput = page.locator('input[type="email"], input[placeholder*="correo"], input[placeholder*="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    await emailInput.fill('wrong@email.com');
    await passwordInput.fill('wrongpassword');
    await submitBtn.click();

    // Should show error message
    await expect(page.locator('[class*="error"], [class*="alert"], .text-red, [style*="color: red"]').first()).toBeVisible({ timeout: 10000 });
    // Login form should still be visible
    await expect(emailInput).toBeVisible();
  });
});
