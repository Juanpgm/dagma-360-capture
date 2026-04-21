import { writable, derived } from 'svelte/store';
import { logout as firebaseLogout } from '../api/auth';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { buildPermissions } from '../lib/permissions';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: any | null;
  loading: boolean;
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
        permissions: user.permissions
      });
    },
    logout: async () => {
      console.log('🚪 Logging out...');
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
      console.log('✅ Logout complete - All session data cleared');
    },
    init: () => {
      console.log('🔄 Initializing auth state...');
      
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
            try {
              const user = JSON.parse(userStr);
              // Obtener token fresco de Firebase
              const idToken = await firebaseUser.getIdToken();
              
              // Actualizar ambos storages
              localStorage.setItem('token', idToken);
              localStorage.setItem('user', JSON.stringify(user));
              sessionStorage.setItem('authToken', idToken);
              sessionStorage.setItem('userData', JSON.stringify(user));
              
              set({ isAuthenticated: true, token: idToken, user, loading: false });
              console.log(`✅ Session restored from ${source} with fresh token:`, {
                email: user.email,
                roles: user.roles || [],
                permissions: user.permissions || []
              });
            } catch (error) {
              console.error('Error parsing user data:', error);
              // Si hay error, crear usuario básico
              const idToken = await firebaseUser.getIdToken();
              const user = {
                email: firebaseUser.email,
                uid: firebaseUser.uid,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                roles: [],
                permissions: []
              };
              localStorage.setItem('token', idToken);
              localStorage.setItem('user', JSON.stringify(user));
              sessionStorage.setItem('authToken', idToken);
              sessionStorage.setItem('userData', JSON.stringify(user));
              set({ isAuthenticated: true, token: idToken, user, loading: false });
              console.log('✅ Session restored from Firebase with basic user data');
            }
          } else {
            // Usuario de Firebase pero sin datos locales, obtener token fresco
            const idToken = await firebaseUser.getIdToken();
            const user = {
              email: firebaseUser.email,
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              roles: [],
              permissions: []
            };
            localStorage.setItem('token', idToken);
            localStorage.setItem('user', JSON.stringify(user));
            sessionStorage.setItem('authToken', idToken);
            sessionStorage.setItem('userData', JSON.stringify(user));
            set({ isAuthenticated: true, token: idToken, user, loading: false });
            console.log('✅ New session created from Firebase user');
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
