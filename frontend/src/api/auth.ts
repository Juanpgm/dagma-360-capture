import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';

/** Detect mobile browsers that block popups */
const isMobileBrowser = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const API_BASE_URL = '/api';
const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';

interface LoginCredentials {
  username: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  user?: any;
}

interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  cellphone: string;
  grupo: string;
  rol: string;
}

interface RegisterResponse {
  success?: boolean;
  message?: string;
  user?: any;
}

const fetchAdminUserByEmail = async (
  email: string,
  token: string
): Promise<Record<string, any> | null> => {
  try {
    const url = `${API_BASE_URL}/admin/users?limit=1&email=${encodeURIComponent(email)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('⚠️ /admin/users returned non-OK status:', response.status);
      return null;
    }

    const payload = await response.json();
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.users)
      ? payload.users
      : [];

    return rows.length > 0 ? (rows[0] as Record<string, any>) : null;
  } catch (error) {
    console.warn('⚠️ Unable to fetch user profile from /admin/users:', error);
    return null;
  }
};

/**
 * Login directo con API (sin Firebase)
 * Flujo alternativo cuando Firebase no está configurado
 */
const loginWithAPI = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  console.log('🔐 Attempting direct API login:', { email: credentials.username });

  try {
    // Paso 1: Primero autenticar con Firebase para obtener id_token
    console.log('📡 Authenticating with Firebase to get id_token...');
    const firebaseAuth = await signInWithEmailAndPassword(
      auth,
      credentials.username,
      credentials.password
    );

    const idToken = await firebaseAuth.user.getIdToken();
    console.log('✅ Firebase id_token obtained');

    // Paso 2: Login en la API con el id_token
    console.log('🌐 Logging in to API:', `${API_BASE_URL}/auth/login`);
    
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        id_token: idToken,
        email: credentials.username
      })
    });

    console.log('📥 API response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API login failed:', errorText);
      
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { detail: errorText || 'Error de autenticación' };
      }
      
      throw new Error(error.detail || `Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ API login successful:', data);

    // Combinar datos
    const email = credentials.username;
    const sessionToken = data.access_token || idToken;
    const adminUser = await fetchAdminUserByEmail(email, sessionToken);

    const userData = {
      email: email,
      uid: firebaseAuth.user.uid,
      displayName: data.user?.nombre_completo || data.user?.nombre || email.split('@')[0],
      username: data.user?.username || data.user?.email?.split('@')[0] || email.split('@')[0],
      photoURL: data.user?.photo_url || null,
      ...data.user,
      ...adminUser,
      roles: data.user?.roles || [],
      permissions: data.user?.permissions || []
    };

    return {
      access_token: data.access_token || idToken,
      token_type: data.token_type || 'Bearer',
      user: userData
    };

  } catch (err: any) {
    console.error('💥 API login error:', err);
    
    // Mapear errores de Firebase a mensajes legibles
    if (err.code === 'auth/user-not-found') {
      throw new Error('Usuario no encontrado');
    } else if (err.code === 'auth/wrong-password') {
      throw new Error('Contraseña incorrecta');
    } else if (err.code === 'auth/invalid-email') {
      throw new Error('Email inválido');
    } else if (err.code === 'auth/too-many-requests') {
      throw new Error('Demasiados intentos. Intenta más tarde.');
    }
    
    throw err;
  }
};

/**
 * Login con Firebase Auth SDK (flujo original)
 * 1. Autentica con Firebase usando email/password
 * 2. Obtiene idToken de Firebase
 * 3. Valida con backend que agrega roles/permisos
 */
const loginWithFirebase = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  console.log('🔐 Attempting login with Firebase Auth SDK:', { email: credentials.username });

  try {
    // 1. Autenticar con Firebase
    console.log('📡 Authenticating with Firebase...');
    const userCredential = await signInWithEmailAndPassword(
      auth,
      credentials.username,
      credentials.password
    );

    console.log('✅ Firebase authentication successful');

    // 2. Obtener ID token de Firebase
    const idToken = await userCredential.user.getIdToken();
    console.log('✅ ID token obtained:', idToken.substring(0, 20) + '...');

    // 3. Validar con backend para obtener roles y permisos
    console.log('🌐 Validating session with backend:', `${API_BASE_URL}/auth/validate-session`);
    
    const response = await fetch(`${API_BASE_URL}/auth/validate-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log('📥 Backend response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Backend validation failed:', errorText);
      
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { detail: errorText || 'Error de validación' };
      }
      
      throw new Error(error.detail || `Error ${response.status}: ${response.statusText}`);
    }

    const backendData = await response.json();
    console.log('✅ Backend validation successful:', backendData);

    // 4. Combinar datos de Firebase + Backend
    const email = userCredential.user.email || '';
    const adminUser = email
      ? await fetchAdminUserByEmail(email, idToken)
      : null;

    const userData = {
      // Datos de Firebase
      email: email,
      uid: userCredential.user.uid,
      displayName: userCredential.user.displayName || backendData.user?.nombre_completo || backendData.user?.nombre || email.split('@')[0],
      photoURL: userCredential.user.photoURL,
      
      // Extraer username del email si no existe
      username: backendData.user?.username || backendData.user?.nombre_usuario || email.split('@')[0],
      
      // Datos del backend (pueden sobrescribir los anteriores si existen)
      ...backendData.user,
      ...adminUser,
      
      // Roles y permisos
      roles: backendData.roles || [],
      permissions: backendData.permissions || []
    };

    const result: LoginResponse = {
      access_token: idToken,
      token_type: 'Bearer',
      user: userData
    };

    console.log('✅ Login complete:', result);
    
    // Guardar datos completos en sessionStorage también
    sessionStorage.setItem('userData', JSON.stringify(userData));
    sessionStorage.setItem('authToken', idToken);
    
    return result;

  } catch (err: any) {
    console.error('💥 Login error:', err);
    
    // Mapear errores de Firebase a mensajes legibles
    if (err.code === 'auth/user-not-found') {
      throw new Error('Usuario no encontrado');
    } else if (err.code === 'auth/wrong-password') {
      throw new Error('Contraseña incorrecta');
    } else if (err.code === 'auth/invalid-email') {
      throw new Error('Email inválido');
    } else if (err.code === 'auth/too-many-requests') {
      throw new Error('Demasiados intentos. Intenta más tarde.');
    }
    
    throw err;
  }
};

/**
 * Login principal - usa API directamente
 */
export const login = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  // Por defecto usar login directo con API
  if (USE_FIREBASE) {
    return loginWithFirebase(credentials);
  }
  return loginWithAPI(credentials);
};

/**
 * Registro de usuario via API
 */
export const registerUser = async (payload: RegisterPayload): Promise<RegisterResponse> => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let error;
    try {
      error = JSON.parse(errorText);
    } catch {
      error = { detail: errorText || 'Error de registro' };
    }
    throw new Error(error.detail || `Error ${response.status}: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Obtiene el token actual del usuario autenticado
 */
export const getCurrentToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
};

/**
 * Headers de autenticación para requests protegidos
 */
export const getAuthHeaders = async (): Promise<HeadersInit> => {
  const token = await getCurrentToken();
  if (!token) {
    throw new Error('No authentication token available');
  }
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
};

/**
 * Cerrar sesión
 */
export const logout = async (): Promise<void> => {
  await auth.signOut();
  console.log('✅ Logout successful');
};

// ─── Google auth: datos parciales cuando el perfil no está completo ─────────

export interface PartialGoogleUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  idToken: string;
  full_name?: string;
}

/**
 * Se lanza cuando un usuario se autentica con Google pero no tiene grupo asignado.
 * El componente Login debe capturar este error y mostrar el modal de completar perfil.
 */
export class NeedsProfileCompletionError extends Error {
  constructor(public readonly partialUser: PartialGoogleUser) {
    super('NEEDS_PROFILE_COMPLETION');
    this.name = 'NeedsProfileCompletionError';
  }
}

/**
 * Login con Google (popup en desktop, redirect en mobile).
 * - Si el usuario ya tiene grupo → devuelve LoginResponse normal.
 * - Si el usuario es nuevo (sin grupo) → lanza NeedsProfileCompletionError.
 * - En mobile: llama signInWithRedirect y devuelve null; el resultado se procesa
 *   en handleGoogleRedirectResult() cuando la app recarga.
 */
export const loginWithGoogle = async (): Promise<LoginResponse> => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  let credential;
  if (isMobileBrowser()) {
    // On mobile, popup is often blocked. Use redirect flow.
    await signInWithRedirect(auth, provider);
    // The redirect navigates away; execution does not continue here.
    // Return a dummy promise that never resolves — the page will reload.
    return new Promise(() => {});
  } else {
    credential = await signInWithPopup(auth, provider);
  }

  return _processGoogleCredential(credential);
};

/**
 * Call this on app startup (in authStore.initAuth) to handle redirect result
 * on mobile after the page reloads post-Google-redirect.
 * Returns LoginResponse if there was a pending redirect, or null otherwise.
 */
export const handleGoogleRedirectResult = async (): Promise<LoginResponse | null> => {
  try {
    const result = await getRedirectResult(auth);
    if (!result) return null;
    return _processGoogleCredential(result);
  } catch (err: any) {
    if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
      return null;
    }
    throw err;
  }
};

async function _processGoogleCredential(credential: { user: import('firebase/auth').User }): Promise<LoginResponse> {
  const idToken = await credential.user.getIdToken();
  const email = credential.user.email || '';

  const res = await fetch(`${API_BASE_URL}/auth/validate-session`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error('Error al validar sesión con el servidor. Intenta de nuevo.');
  }

  const backendData = await res.json();

  if (backendData.needs_profile_completion) {
    throw new NeedsProfileCompletionError({
      uid: credential.user.uid,
      email,
      displayName: credential.user.displayName || email.split('@')[0],
      photoURL: credential.user.photoURL ?? null,
      idToken,
      full_name: backendData.user?.full_name || credential.user.displayName || '',
    });
  }

  const userData = {
    email,
    uid: credential.user.uid,
    displayName: credential.user.displayName || email.split('@')[0],
    photoURL: credential.user.photoURL ?? null,
    username: email.split('@')[0],
    ...backendData.user,
  };

  sessionStorage.setItem('userData', JSON.stringify(userData));
  sessionStorage.setItem('authToken', idToken);

  return { access_token: idToken, token_type: 'Bearer', user: userData };
}

/**
 * Completa el perfil de un usuario registrado con Google que no tiene grupo.
 * Llama a POST /auth/complete-google-profile con el idToken del usuario.
 */
export const completeGoogleProfile = async (
  idToken: string,
  data: { grupo: string; full_name?: string; cellphone?: string }
): Promise<LoginResponse> => {
  const res = await fetch(`${API_BASE_URL}/auth/complete-google-profile`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Error al completar el perfil');
  }

  // Después de completar, volvemos a validate-session para obtener datos actualizados
  const sessionRes = await fetch(`${API_BASE_URL}/auth/validate-session`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
  });

  const backendData = sessionRes.ok ? await sessionRes.json() : {};

  // Obtener datos del usuario de Firebase (para photoURL)
  const firebaseUser = auth.currentUser;
  const userData = {
    email: firebaseUser?.email || '',
    uid: firebaseUser?.uid || '',
    displayName: firebaseUser?.displayName || '',
    photoURL: firebaseUser?.photoURL ?? null,
    username: (firebaseUser?.email || '').split('@')[0],
    ...backendData.user,
  };

  sessionStorage.setItem('userData', JSON.stringify(userData));
  sessionStorage.setItem('authToken', idToken);

  return { access_token: idToken, token_type: 'Bearer', user: userData };
};

/**
 * Envía un correo de recuperación de contraseña via Firebase.
 */
export const sendPasswordReset = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email);
};

