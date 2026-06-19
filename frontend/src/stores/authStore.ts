import { writable, derived } from 'svelte/store';
import { logout as firebaseLogout, handleGoogleRedirectResult, NeedsProfileCompletionError } from '../api/auth';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { buildPermissions } from '../lib/permissions';
import { ApiClient, resolveUrl } from '../lib/api-client';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: any | null;
  loading: boolean;
}

/** Llama a /auth/validate-session y devuelve el user enriquecido o null */
async function fetchFullUserProfile(idToken: string): Promise<any | null> {
  try {
    const res = await fetch(resolveUrl('/auth/validate-session'), {
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
    loading: true
  });

  return {
    subscribe,
    login: (token: string, user: any) => {
      ApiClient.clearCache();

      // Token only in sessionStorage — not in localStorage (XSS risk)
      sessionStorage.setItem('authToken', token);
      // User profile in localStorage so offline PWA can restore role/grupo on new session
      localStorage.setItem('user', JSON.stringify(user));
      sessionStorage.setItem('userData', JSON.stringify(user));

      set({ isAuthenticated: true, token, user, loading: false });
      if (import.meta.env.DEV) {
        console.log('💾 Session saved:', {
          email: user.email,
          roles: user.roles,
          permissions: user.permissions,
          grupo: user.grupo
        });
      }
    },
    logout: async () => {
      if (import.meta.env.DEV) console.log('🚪 Logging out...');

      ApiClient.clearCache();

      try {
        await firebaseLogout();
      } catch (error) {
        console.error('Error during logout:', error);
      }

      localStorage.removeItem('user');
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('userData');

      set({ isAuthenticated: false, token: null, user: null, loading: false });
      if (import.meta.env.DEV) console.log('✅ Logout complete');
    },
    init: () => {
      if (import.meta.env.DEV) console.log('🔄 Initializing auth state...');

      // Handle Google redirect result (mobile sign-in flow)
      handleGoogleRedirectResult()
        .then((response) => {
          if (response) {
            if (import.meta.env.DEV) {
              console.log('✅ Google redirect sign-in completed:', response.user?.email);
            }
            ApiClient.clearCache();
            sessionStorage.setItem('authToken', response.access_token);
            localStorage.setItem('user', JSON.stringify(response.user));
            sessionStorage.setItem('userData', JSON.stringify(response.user));
            set({ isAuthenticated: true, token: response.access_token, user: response.user, loading: false });
          }
        });

      // Safety timeout: if no Firebase response after 3s, unblock the UI
      const timeoutId = setTimeout(() => {
        if (import.meta.env.DEV) console.warn('⚠️ Auth initialization timeout - forcing loading=false');
        update(state => ({ ...state, loading: false }));
      }, 3000);

      onAuthStateChanged(auth, async (firebaseUser) => {
        clearTimeout(timeoutId);

        if (firebaseUser) {
          if (import.meta.env.DEV) console.log('✅ Firebase session restored:', firebaseUser.email);

          // Prefer sessionStorage (current session), fall back to localStorage (cross-session profile)
          let userStr = sessionStorage.getItem('userData');
          let source = 'sessionStorage';

          if (!userStr) {
            userStr = localStorage.getItem('user');
            source = 'localStorage';
          }

          if (userStr) {
            let cachedUser: any = null;
            try {
              cachedUser = JSON.parse(userStr);
            } catch (parseError) {
              if (import.meta.env.DEV) console.warn('⚠️ Cached user data is corrupted:', parseError);
            }

            // Firebase SDK manages token persistence (IndexedDB) — getIdToken() works offline
            let idToken: string;
            try {
              idToken = await firebaseUser.getIdToken();
            } catch {
              // Offline fallback: use sessionStorage token (never localStorage for tokens)
              idToken = sessionStorage.getItem('authToken') || '';
            }

            const backendUser = idToken ? await fetchFullUserProfile(idToken) : null;

            let user: any;
            if (backendUser) {
              const previousUid = cachedUser?.uid;
              const newUid = backendUser.uid;
              if (previousUid && newUid && previousUid !== newUid) {
                if (import.meta.env.DEV) console.log(`🔄 User changed ${previousUid} → ${newUid}`);
                ApiClient.clearCache();
              }
              user = {
                ...(cachedUser || {}),
                ...backendUser,
                roles: backendUser.role ? [backendUser.role] : (cachedUser?.roles || []),
                photoURL: backendUser.photoURL || cachedUser?.photoURL || firebaseUser.photoURL,
              };
              if (import.meta.env.DEV) {
                console.log('🔄 Session refreshed from backend:', {
                  uid: user.uid, email: user.email, grupo: user.grupo, role: user.role
                });
              }
            } else if (cachedUser) {
              user = {
                ...cachedUser,
                email: cachedUser.email || firebaseUser.email,
                uid: cachedUser.uid || firebaseUser.uid,
                displayName: cachedUser.displayName || firebaseUser.displayName,
                photoURL: cachedUser.photoURL || firebaseUser.photoURL,
              };
              if (import.meta.env.DEV) {
                console.log('📴 Backend unavailable - using cached profile:', {
                  uid: user.uid, email: user.email, grupo: user.grupo, role: user.role || user.rol
                });
              }
            } else {
              user = {
                email: firebaseUser.email,
                uid: firebaseUser.uid,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                roles: [],
                permissions: [],
              };
              if (import.meta.env.DEV) console.warn('⚠️ No cache and no backend - minimal user profile');
            }

            if (idToken) sessionStorage.setItem('authToken', idToken);
            localStorage.setItem('user', JSON.stringify(user));
            sessionStorage.setItem('userData', JSON.stringify(user));

            set({ isAuthenticated: true, token: idToken, user, loading: false });
            if (import.meta.env.DEV) {
              console.log(`✅ Session restored from ${source}:`, {
                email: user.email, uid: user.uid, grupo: user.grupo,
                roles: user.roles || [], permissions: user.permissions || []
              });
            }
          } else {
            let idToken: string;
            try {
              idToken = await firebaseUser.getIdToken();
            } catch {
              idToken = sessionStorage.getItem('authToken') || '';
            }
            const backendUser = idToken ? await fetchFullUserProfile(idToken) : null;

            ApiClient.clearCache();

            const user = {
              email: firebaseUser.email,
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName,
              roles: backendUser?.role ? [backendUser.role] : [],
              permissions: [],
              ...(backendUser || {}),
              photoURL: backendUser?.photoURL || firebaseUser.photoURL,
            };
            if (idToken) sessionStorage.setItem('authToken', idToken);
            localStorage.setItem('user', JSON.stringify(user));
            sessionStorage.setItem('userData', JSON.stringify(user));
            set({ isAuthenticated: true, token: idToken, user, loading: false });
            if (import.meta.env.DEV) {
              console.log('✅ Session created from Firebase + backend profile:', {
                uid: user.uid, email: user.email, grupo: user.grupo,
                role: user.role || user.rol, hadBackend: !!backendUser,
              });
            }
          }
        } else {
          if (import.meta.env.DEV) console.log('ℹ️ No Firebase user - logged out');
          localStorage.removeItem('user');
          sessionStorage.removeItem('authToken');
          sessionStorage.removeItem('userData');
          set({ isAuthenticated: false, token: null, user: null, loading: false });
        }
      }, (error) => {
        console.error('❌ Error in Firebase auth state listener:', error);
        clearTimeout(timeoutId);
        set({ isAuthenticated: false, token: null, user: null, loading: false });
      });
    },
    refreshToken: async () => {
      const user = auth.currentUser;
      if (user) {
        const idToken = await user.getIdToken(true);
        sessionStorage.setItem('authToken', idToken);
        update(state => ({ ...state, token: idToken }));
        if (import.meta.env.DEV) console.log('🔄 Token refreshed');
        return idToken;
      }
      return null;
    },
    getUser: () => {
      const userStr = sessionStorage.getItem('userData') || localStorage.getItem('user');
      if (userStr) {
        try {
          return JSON.parse(userStr);
        } catch {
          return null;
        }
      }
      return null;
    },
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
    hasRole: (role: string) => {
      const user = authStore.getUser();
      return user?.roles?.includes(role) || false;
    },
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
