/**
 * E2E admin flows — requiere credenciales admin via env:
 *   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
 *
 * Cubre:
 *  1. Modal de Convocatorias: selector líder se habilita al elegir grupo (dropdown custom).
 *  2. Modal "Asignar Personal" abre en alguna actividad existente.
 *  3. Cambiar rol del primer usuario no-self en Gestión de Usuarios y revertir.
 */
import { test, expect, type Page } from '@playwright/test';
import { injectAuthState, firebaseSignIn } from './helpers';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';
const HAS_ADMIN = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);

async function gotoHome(page: Page) {
  await injectAuthState(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForLoadState('domcontentloaded');
  await page
    .locator('[class*="card"], h1, h2')
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 });
}

async function openProgramacion(page: Page) {
  const card = page
    .locator(
      [
        '[data-testid="home-card-programacion"]',
        '[class*="card"]:has-text("Programación")',
        'button:has-text("Programación")',
      ].join(', '),
    )
    .first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
}

test.describe('Admin flows — requiere credenciales E2E_ADMIN_*', () => {
  test.skip(!HAS_ADMIN, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD no provistos en env.');

  test.beforeAll(async () => {
    await firebaseSignIn(ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test('modal de Convocatorias — selector líder se habilita al elegir grupo', async ({ page }) => {
    await gotoHome(page);
    await openProgramacion(page);

    const programarBtn = page.locator('button:has-text("Programar nueva actividad")').first();
    await expect(programarBtn).toBeVisible({ timeout: 15_000 });
    await programarBtn.click();

    const modal = page.locator('.convocatoria-modal').first();
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // 1) El dropdown de líder debe estar visible pero deshabilitado hasta tener grupos
    const liderTrigger = modal.locator('.lider-dropdown-trigger').first();
    await expect(liderTrigger).toBeVisible({ timeout: 5_000 });
    await expect(liderTrigger).toBeDisabled();

    // 2) Abrir el dropdown de Grupos requeridos y seleccionar el primero disponible
    const gruposTrigger = modal.locator('.grupos-required-trigger').first();
    await expect(gruposTrigger).toBeVisible({ timeout: 5_000 });
    await gruposTrigger.click();
    const firstGrupoOption = modal.locator('.grupos-option-item').first();
    await expect(firstGrupoOption).toBeVisible({ timeout: 8_000 });
    await firstGrupoOption.click();
    // Cerrar el dropdown de grupos volviendo a hacer click en el trigger
    await gruposTrigger.click();

    // 3) Ahora el dropdown de líder debe estar habilitado
    await expect(liderTrigger).toBeEnabled({ timeout: 5_000 });

    // 4) Abrir dropdown líder y verificar que aparece el buscador
    await liderTrigger.click();
    const liderSearch = modal.locator('.lider-search-input').first();
    await expect(liderSearch).toBeVisible({ timeout: 5_000 });
    await liderSearch.fill('test');
    await expect(liderSearch).toHaveValue('test');

    // Cerrar modal
    const closeBtn = modal
      .locator('button:has-text("Cancelar"), button[aria-label*="cerrar" i], button:has-text("✕")')
      .first();
    if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await closeBtn.click().catch(() => {});
    } else {
      await page.keyboard.press('Escape');
    }
  });

  test('modal "Asignar Personal" abre desde una actividad existente', async ({ page }) => {
    await gotoHome(page);
    await openProgramacion(page);

    await page.waitForLoadState('networkidle');

    const asignarBtn = page
      .locator('button:has-text("Asignar Personal"), button:has-text("Asignar personal"), .btn-asignar-personal')
      .first();

    const visible = await asignarBtn.isVisible({ timeout: 8_000 }).catch(() => false);
    test.skip(!visible, 'No hay actividades con botón "Asignar Personal" disponibles.');

    await asignarBtn.click();

    const overlay = page
      .locator('[role="dialog"], .modal, .overlay, [class*="asignacion"]')
      .first();
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press('Escape').catch(() => {});
  });

  test('cambiar rol del primer usuario no-self y revertir', async ({ page }) => {
    await gotoHome(page);

    const card = page
      .locator(
        [
          '[data-testid="home-card-gestion-usuarios"]',
          '[class*="card"]:has-text("Gestión de Usuarios")',
          'button:has-text("Gestión de Usuarios")',
        ].join(', '),
      )
      .first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    await page.waitForLoadState('networkidle');

    const otherRow = page.locator('tr.user-row:not(.is-self)').first();
    await expect(otherRow).toBeVisible({ timeout: 20_000 });

    // Capturar email del usuario para localizarlo de forma estable después del reload
    const targetEmail = (await otherRow.locator('.user-email').innerText()).trim();
    expect(targetEmail.length).toBeGreaterThan(0);

    const rowByEmail = () => page.locator(`tr.user-row:has(.user-email:text-is("${targetEmail}"))`);
    const badgeByEmail = () => rowByEmail().locator('.badge-role');

    const originalRoleText = (await badgeByEmail().innerText()).trim();

    await rowByEmail().locator('button[title=\"Cambiar rol\"]').click();
    await expect(page.locator('.modal-title:has-text(\"Cambiar rol\")')).toBeVisible({
      timeout: 10_000,
    });

    // Capturar errores que aparezcan en el modal (para diagnóstico)
    page.on('response', (resp) => {
      const url = resp.url();
      if (url.includes('/admin/users/') && url.includes('/role')) {
        console.log(`[role-change] ${resp.request().method()} ${url} -> ${resp.status()}`);
      }
    });

    const options = page.locator('.role-option:not([disabled])');
    const count = await options.count();
    expect(count).toBeGreaterThan(0);

    let chosenIndex = -1;
    let chosenLabel = '';
    for (let i = 0; i < count; i++) {
      const label = (await options.nth(i).innerText()).trim();
      if (label && label.toLowerCase() !== originalRoleText.toLowerCase()) {
        chosenIndex = i;
        chosenLabel = label;
        break;
      }
    }
    test.skip(chosenIndex < 0, 'No hay rol distinto disponible para alternar.');
    await options.nth(chosenIndex).click();

    // Esperar la respuesta de la API al hacer click en Aplicar
    const [resp1] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/admin/users/') && r.request().method() !== 'GET',
        { timeout: 15_000 },
      ).catch(() => null),
      page.locator('.modal-footer button:has-text(\"Aplicar\")').click(),
    ]);
    if (resp1) {
      console.log(`[change] status=${resp1.status()} url=${resp1.url()}`);
      expect(resp1.status(), 'API change-role debe responder 2xx').toBeLessThan(300);
    }
    await expect(page.locator('.modal-title:has-text(\"Cambiar rol\")')).not.toBeVisible({
      timeout: 20_000,
    });

    // NO reload — la SPA pierde la vista. La tabla refresca in-place via users = [...users]
    await expect
      .poll(async () => (await badgeByEmail().innerText()).trim(), { timeout: 20_000 })
      .not.toBe(originalRoleText);
    const intermediateRole = (await badgeByEmail().innerText()).trim();
    console.log(`[change] ${targetEmail}: ${originalRoleText} -> ${intermediateRole} (intent: ${chosenLabel})`);

    // Revertir
    await rowByEmail().locator('button[title=\"Cambiar rol\"]').click();
    await expect(page.locator('.modal-title:has-text(\"Cambiar rol\")')).toBeVisible({
      timeout: 10_000,
    });
    await page
      .locator('.role-option:not([disabled])')
      .filter({ hasText: new RegExp(`^${originalRoleText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
      .first()
      .click();
    const [resp2] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/admin/users/') && r.request().method() !== 'GET',
        { timeout: 15_000 },
      ).catch(() => null),
      page.locator('.modal-footer button:has-text(\"Aplicar\")').click(),
    ]);
    if (resp2) {
      console.log(`[revert] status=${resp2.status()} url=${resp2.url()}`);
      expect(resp2.status(), 'API revert-role debe responder 2xx').toBeLessThan(300);
    }
    await expect(page.locator('.modal-title:has-text(\"Cambiar rol\")')).not.toBeVisible({
      timeout: 20_000,
    });

    await expect
      .poll(async () => (await badgeByEmail().innerText()).trim(), { timeout: 20_000 })
      .toBe(originalRoleText);
    // Sanity: el rol intermedio era distinto al original
    expect(intermediateRole).not.toBe(originalRoleText);
  });
});
