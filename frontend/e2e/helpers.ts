/**
 * E2E helpers — shared auth utilities for Playwright tests.
 * Uses Firebase REST API to get a real ID token, then injects auth state
 * into the browser so tests start already logged in without going through
 * the login UI every time.
 */
import { Page } from '@playwright/test';

export const FIREBASE_API_KEY = 'AIzaSyAVVewMgunLWBiZz5XU-GjrzbO3ZKcyvD0';
export const API_URL = 'https://web-production-2d737.up.railway.app';
export const APP_URL = process.env.BASE_URL || 'https://dagma-360-capture-frontend.vercel.app';

export const TEST_USER = {
  email: 'test.e2e@dagma.local',
  password: 'TestDagma2026!',
};

/** Sign in with Firebase REST API, returns { idToken, refreshToken, uid }. */
export async function firebaseSignIn(email: string, password: string) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!resp.ok) throw new Error(`Firebase sign-in failed: ${resp.status}`);
  return resp.json() as Promise<{ idToken: string; refreshToken: string; localId: string }>;
}

/** Call /auth/validate-session to get backend session data. */
export async function validateSession(idToken: string) {
  const resp = await fetch(`${API_URL}/auth/validate-session`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!resp.ok) throw new Error(`validate-session failed: ${resp.status}`);
  return resp.json();
}

/**
 * Log in via the real app UI so Firebase Auth SDK properly initialises the
 * session. This is more reliable than injecting localStorage manually because
 * Firebase Auth uses IndexedDB + onAuthStateChanged which clears any
 * localStorage we set before the SDK is ready.
 */
export async function injectAuthState(page: Page, email: string, password: string) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

  // If already authenticated (e.g. session still alive), skip login
  const alreadyHome = await page
    .locator('h2:has-text("Bienvenido"), h1:has-text("Bienvenido")')
    .isVisible({ timeout: 3000 })
    .catch(() => false);
  if (alreadyHome) return;

  // Fill and submit the login form
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  // Wait until the home screen is visible
  await page
    .locator('h2:has-text("Bienvenido"), h1:has-text("Bienvenido")')
    .waitFor({ timeout: 20000 });
}
