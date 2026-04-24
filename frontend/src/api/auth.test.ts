/**
 * Tests for critical authentication flows:
 * - Google login desktop (popup)
 * - Google login mobile (redirect)
 * - handleGoogleRedirectResult
 * - completeGoogleProfile
 * - NeedsProfileCompletionError
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks must be declared before any imports ────────────────────────────────
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  GoogleAuthProvider: vi.fn(() => ({ setCustomParameters: vi.fn() })),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn().mockResolvedValue(undefined),
  getRedirectResult: vi.fn().mockResolvedValue(null),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/firebase', () => ({
  auth: {
    currentUser: {
      uid: 'uid-test-001',
      email: 'test@dagma.gov.co',
      displayName: 'Test User',
      photoURL: 'https://example.com/photo.jpg',
      emailVerified: true,
      getIdToken: vi.fn().mockResolvedValue('mock-id-token-xyz'),
    },
  },
}));

// ── Mock global fetch ────────────────────────────────────────────────────────
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ── Imports AFTER mocks ──────────────────────────────────────────────────────
import {
  loginWithGoogle,
  handleGoogleRedirectResult,
  completeGoogleProfile,
  NeedsProfileCompletionError,
  type PartialGoogleUser,
} from './auth';
import { signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';

const mockPopup = vi.mocked(signInWithPopup);
const mockRedirect = vi.mocked(signInWithRedirect);
const mockGetRedirect = vi.mocked(getRedirectResult);

// ── Shared helpers ───────────────────────────────────────────────────────────
const MOCK_USER = {
  uid: 'uid-test-001',
  email: 'test@dagma.gov.co',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
  emailVerified: true,
  getIdToken: vi.fn().mockResolvedValue('mock-id-token-xyz'),
};

const backendOk = (overrides: object = {}) => ({
  valid: true,
  needs_profile_completion: false,
  user: {
    uid: 'uid-test-001',
    email: 'test@dagma.gov.co',
    full_name: 'Test User',
    photoURL: null,
    role: 'Operador',
    grupo: 'Cuadrilla 1',
  },
  ...overrides,
});

const fetchOk = (body: object) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
const fetchFail = (body: object, status = 500) =>
  Promise.resolve({ ok: false, status, json: () => Promise.resolve(body) });

// ── loginWithGoogle — desktop ─────────────────────────────────────────────────
describe('loginWithGoogle() — desktop (popup)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124',
      writable: true, configurable: true,
    });
    mockPopup.mockResolvedValue({ user: MOCK_USER } as any);
  });

  it('returns LoginResponse when user has grupo', async () => {
    mockFetch.mockReturnValueOnce(fetchOk(backendOk()));
    const res = await loginWithGoogle();
    expect(res.access_token).toBe('mock-id-token-xyz');
    expect(res.user.grupo).toBe('Cuadrilla 1');
  });

  it('throws NeedsProfileCompletionError when no grupo', async () => {
    mockFetch.mockReturnValueOnce(fetchOk(backendOk({
      needs_profile_completion: true,
      user: { uid: 'u', email: 'new@x.com', grupo: null },
    })));
    await expect(loginWithGoogle()).rejects.toBeInstanceOf(NeedsProfileCompletionError);
  });

  it('throws when validate-session fails', async () => {
    mockFetch.mockReturnValueOnce(fetchFail({ detail: 'Server error' }));
    await expect(loginWithGoogle()).rejects.toThrow('Error al validar sesión');
  });

  it('uses signInWithPopup (not redirect) on desktop', async () => {
    mockFetch.mockReturnValueOnce(fetchOk(backendOk()));
    await loginWithGoogle();
    expect(mockPopup).toHaveBeenCalledOnce();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

// ── loginWithGoogle — mobile ──────────────────────────────────────────────────
describe('loginWithGoogle() — mobile (redirect)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) Mobile Safari/537.36',
      writable: true, configurable: true,
    });
  });

  it('calls signInWithRedirect on mobile, not popup', async () => {
    loginWithGoogle(); // navigates away — don't await
    await new Promise((r) => setTimeout(r, 20));
    expect(mockRedirect).toHaveBeenCalledOnce();
    expect(mockPopup).not.toHaveBeenCalled();
  });
});

// ── handleGoogleRedirectResult ────────────────────────────────────────────────
describe('handleGoogleRedirectResult()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns null when no pending redirect', async () => {
    mockGetRedirect.mockResolvedValue(null);
    expect(await handleGoogleRedirectResult()).toBeNull();
  });

  it('returns LoginResponse after redirect when user has grupo', async () => {
    mockGetRedirect.mockResolvedValue({ user: MOCK_USER } as any);
    mockFetch.mockReturnValueOnce(fetchOk(backendOk()));
    const res = await handleGoogleRedirectResult();
    expect(res).not.toBeNull();
    expect(res!.user.grupo).toBe('Cuadrilla 1');
  });

  it('throws NeedsProfileCompletionError via redirect when no grupo', async () => {
    mockGetRedirect.mockResolvedValue({ user: MOCK_USER } as any);
    mockFetch.mockReturnValueOnce(fetchOk(backendOk({
      needs_profile_completion: true,
      user: { uid: 'u', email: 'x@x.com', grupo: null },
    })));
    await expect(handleGoogleRedirectResult()).rejects.toBeInstanceOf(NeedsProfileCompletionError);
  });
});

// ── completeGoogleProfile ─────────────────────────────────────────────────────
describe('completeGoogleProfile()', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('completes profile and returns updated user', async () => {
    mockFetch
      .mockReturnValueOnce(fetchOk({ success: true, uid: 'uid-test-001', grupo: 'Poda' }))
      .mockReturnValueOnce(fetchOk(backendOk({ user: { ...backendOk().user, grupo: 'Poda' } })));

    const res = await completeGoogleProfile('tok', { grupo: 'Poda', full_name: 'Test' });
    expect(res.user.grupo).toBe('Poda');
  });

  it('throws when backend returns error', async () => {
    mockFetch.mockReturnValueOnce(fetchFail({ detail: 'El perfil ya esta completo.' }, 400));
    await expect(completeGoogleProfile('tok', { grupo: 'Poda' })).rejects.toThrow('El perfil ya esta completo.');
  });
});

// ── NeedsProfileCompletionError ──────────────────────────────────────────────
describe('NeedsProfileCompletionError', () => {
  it('carries partial user data and correct message', () => {
    const partial: PartialGoogleUser = {
      uid: 'u', email: 'a@b.com', displayName: 'A', photoURL: null, idToken: 'tok',
    };
    const err = new NeedsProfileCompletionError(partial);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('NEEDS_PROFILE_COMPLETION');
    expect(err.partialUser).toEqual(partial);
  });
});
