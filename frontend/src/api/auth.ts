import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

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
