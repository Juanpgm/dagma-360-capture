import { writable, derived } from 'svelte/store';
import { logout as firebaseLogout, handleGoogleRedirectResult, NeedsProfileCompletionError } from '../api/auth';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { buildPermissions } from '../lib/permissions';
import { ApiClient } from '../lib/api-client';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: any | null;
  loading: boolean;
}

/** Llama a /auth/validate-session y devuelve el user enriquecido o null */
async function fetchFullUserProfile(idToken: string): Promise<any | null> {
  try {
    const res = await fetch('/api/auth/validate-session', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.user ?? data ?? null;
  } catch {
    return null;
  }
}

const createAuthStore = () => {
  const { subscribe, set, update } = writable<AuthState>({
    isAuthenticated: false,
    token: null,
    user: null,
    loading: true // Inicialmente true mientras verificamos la sesión
  });

  return {
    subscribe,
    login: (token: string, user: any) => {
      // Limpiar el caché del ApiClient para evitar datos del usuario anterior
      ApiClient.clearCache();
      
      // Guardar en localStorage (persistencia entre sesiones)
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Guardar en sessionStorage (datos durante la sesión actual)
      sessionStorage.setItem('authToken', token);
      sessionStorage.setItem('userData', JSON.stringify(user));
      
      set({ isAuthenticated: true, token, user, loading: false });
      console.log('💾 Session saved (localStorage + sessionStorage):', {
        email: user.email,
        roles: user.roles,
        permissions: user.permissions,
        grupo: user.grupo
      });
    },
    logout: async () => {
      console.log('🚪 Logging out...');
      
      // Limpiar el caché del ApiClient para evitar que datos del usuario anterior persistan
      ApiClient.clearCache();
      
      try {
        await firebaseLogout();
      } catch (error) {
        console.error('Error during logout:', error);
      }
      
      // Limpiar localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Limpiar sessionStorage
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('userData');
      
      set({ isAuthenticated: false, token: null, user: null, loading: false });
      console.log('✅ Logout complete - All session data and API cache cleared');
    },
    init: () => {
      console.log('🔄 Initializing auth state...');

      // Handle Google redirect result (mobile sign-in flow)
      handleGoogleRedirectResult()
        .then((response) => {
          if (response) {
            console.log('✅ Google redirect sign-in completed:', response.user?.email);
            // Limpiar caché para nueva sesión
            ApiClient.clearCache();
            localStorage.setItem('token', response.access_token);
            localStorage.setItem('user', JSON.stringify(response.user));
            sessionStorage.setItem('authToken', response.access_token);
            sessionStorage.setItem('userData', JSON.stringify(response.user));
            set({ isAuthenticated: true, token: response.access_token, user: response.user, loading: false });
          }
        });
      
      // Timeout de seguridad: si después de 3 segundos no hay respuesta, forzar loading=false
      const timeoutId = setTimeout(() => {
        console.warn('⚠️ Auth initialization timeout - forcing loading=false');
        update(state => ({ ...state, loading: false }));
      }, 3000);
      
      // Escuchar cambios de autenticación de Firebase
      onAuthStateChanged(auth, async (firebaseUser) => {
        clearTimeout(timeoutId); // Cancelar timeout si Firebase responde
        
        if (firebaseUser) {
          console.log('✅ Firebase session restored:', firebaseUser.email);
          
          // Priorizar sessionStorage para datos de la sesión actual
          let userStr = sessionStorage.getItem('userData');
          let source = 'sessionStorage';
          
          // Fallback a localStorage si no hay datos en sessionStorage
          if (!userStr) {
            userStr = localStorage.getItem('user');
            source = 'localStorage';
          }
          
          if (userStr) {
            // Parseo defensivo del cache. Si está corrupto, lo tratamos como "sin cache"
            // en lugar de pisar la sesión actual con un user vacío (perderíamos rol/grupo offline).
            let cachedUser: any = null;
            try {
              cachedUser = JSON.parse(userStr);
            } catch (parseError) {
              console.warn('⚠️ Cached user data is corrupted - will rely on backend:', parseError);
            }

            // Token fresco (Firebase devuelve cache offline si no está expirado)
            let idToken: string;
            try {
              idToken = await firebaseUser.getIdToken();
            } catch (tokenError) {
              console.warn('⚠️ getIdToken failed (likely offline) - using last stored token:', tokenError);
              idToken = sessionStorage.getItem('authToken') || localStorage.getItem('token') || '';
            }

            // Intentar enriquecer con backend, pero NUNCA pisar rol/grupo cacheado si el backend no responde
            const backendUser = idToken ? await fetchFullUserProfile(idToken) : null;

            let user: any;
            if (backendUser) {
              // Detectar cambio de usuario
              const previousUid = cachedUser?.uid;
              const newUid = backendUser.uid;
              if (previousUid && newUid && previousUid !== newUid) {
                console.log(`🔄 User changed from ${previousUid} to ${newUid} - clearing API cache`);
                ApiClient.clearCache();
              }
              user = {
                ...(cachedUser || {}),
                ...backendUser,
                roles: backendUser.role ? [backendUser.role] : (cachedUser?.roles || []),
                photoURL: backendUser.photoURL || cachedUser?.photoURL || firebaseUser.photoURL,
              };
              console.log('🔄 Session refreshed from backend:', {
                uid: user.uid, email: user.email, grupo: user.grupo, role: user.role
              });
            } else if (cachedUser) {
              // OFFLINE / backend caído: conservar rol/grupo del cache
              user = {
                ...cachedUser,
                email: cachedUser.email || firebaseUser.email,
                uid: cachedUser.uid || firebaseUser.uid,
                displayName: cachedUser.displayName || firebaseUser.displayName,
                photoURL: cachedUser.photoURL || firebaseUser.photoURL,
              };
              console.log('📴 Backend unavailable - using cached profile:', {
                uid: user.uid, email: user.email, grupo: user.grupo, role: user.role || user.rol
              });
            } else {
              // Sin backend y sin cache válido (caso raro: primera carga offline tras corrupción)
              user = {
                email: firebaseUser.email,
                uid: firebaseUser.uid,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                roles: [],
                permissions: [],
              };
              console.warn('⚠️ No cache and no backend - minimal user profile (no role assigned)');
            }

            // Actualizar storages solo con campos definidos
            if (idToken) {
              localStorage.setItem('token', idToken);
              sessionStorage.setItem('authToken', idToken);
            }
            localStorage.setItem('user', JSON.stringify(user));
            sessionStorage.setItem('userData', JSON.stringify(user));

            set({ isAuthenticated: true, token: idToken, user, loading: false });
            console.log(`✅ Session restored from ${source}:`, {
              email: user.email, uid: user.uid, grupo: user.grupo,
              roles: user.roles || [], permissions: user.permissions || []
            });
          } else {
            // Usuario de Firebase pero sin datos locales — buscar perfil completo en el backend
            let idToken: string;
            try {
              idToken = await firebaseUser.getIdToken();
            } catch (tokenError) {
              console.warn('⚠️ getIdToken failed - using stored token if any:', tokenError);
              idToken = sessionStorage.getItem('authToken') || localStorage.getItem('token') || '';
            }
            const backendUser = idToken ? await fetchFullUserProfile(idToken) : null;

            // Limpiar caché para nueva sesión
            ApiClient.clearCache();

            const user = {
              email: firebaseUser.email,
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName,
              roles: backendUser?.role ? [backendUser.role] : [],
              permissions: [],
              ...(backendUser || {}),
              // Preserve Firebase photoURL if Firestore doesn't have one
              photoURL: backendUser?.photoURL || firebaseUser.photoURL,
            };
            if (idToken) {
              localStorage.setItem('token', idToken);
              sessionStorage.setItem('authToken', idToken);
            }
            localStorage.setItem('user', JSON.stringify(user));
            sessionStorage.setItem('userData', JSON.stringify(user));
            set({ isAuthenticated: true, token: idToken, user, loading: false });
            console.log('✅ Session created from Firebase + backend profile:', {
              uid: user.uid,
              email: user.email,
              grupo: user.grupo,
              role: user.role || user.rol,
              hadBackend: !!backendUser,
            });
          }
        } else {
          console.log('ℹ️ No Firebase user detected - user is logged out');
          // No hay usuario de Firebase, limpiar estado
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          sessionStorage.removeItem('authToken');
          sessionStorage.removeItem('userData');
          set({ isAuthenticated: false, token: null, user: null, loading: false });
        }
      }, (error) => {
        // Manejar errores de Firebase en onAuthStateChanged
        console.error('❌ Error in Firebase auth state listener:', error);
        clearTimeout(timeoutId);
        // Aún con error, permitir que se muestre el login
        set({ isAuthenticated: false, token: null, user: null, loading: false });
      });
    },
    // Método para refrescar el token si es necesario
    refreshToken: async () => {
      const user = auth.currentUser;
      if (user) {
        const idToken = await user.getIdToken(true); // Force refresh
        localStorage.setItem('token', idToken);
        sessionStorage.setItem('authToken', idToken);
        update(state => ({ ...state, token: idToken }));
        console.log('🔄 Token refreshed');
        return idToken;
      }
      return null;
    },
    // Método para obtener los datos del usuario actual
    getUser: () => {
      // Priorizar sessionStorage
      let userStr = sessionStorage.getItem('userData');
      if (!userStr) {
        userStr = localStorage.getItem('user');
      }
      if (userStr) {
        try {
          return JSON.parse(userStr);
        } catch {
          return null;
        }
      }
      return null;
    },
    // Actualiza campos parciales del usuario en el store y en localStorage/sessionStorage
    updateUser: (fields: Partial<Record<string, any>>) => {
      update(state => {
        const updatedUser = state.user ? { ...state.user, ...fields } : state.user;
        if (updatedUser) {
          localStorage.setItem('user', JSON.stringify(updatedUser));
          sessionStorage.setItem('userData', JSON.stringify(updatedUser));
        }
        return { ...state, user: updatedUser };
      });
    },
    // Método para verificar si el usuario tiene un rol específico
    hasRole: (role: string) => {
      const user = authStore.getUser();
      return user?.roles?.includes(role) || false;
    },
    // Método para verificar si el usuario tiene un permiso específico
    hasPermission: (permission: string) => {
      const user = authStore.getUser();
      return user?.permissions?.includes(permission) || false;
    }
  };
};

export const authStore = createAuthStore();

/** Derived store with computed permissions — use in Svelte templates as $permissions */
export const permissions = derived(authStore, ($auth) => buildPermissions($auth.user));

export const initAuth = () => authStore.init();
