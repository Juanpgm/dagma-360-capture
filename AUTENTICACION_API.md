# Autenticación con la API de Railway

## 📋 Resumen

El sistema de autenticación se ha actualizado para trabajar con la API desplegada en Railway: `https://web-production-2d737.up.railway.app`

## 🔐 Flujo de Autenticación

### Opción 1: Autenticación Directa con API (Recomendado)

Este es el flujo principal y más simple:

```
Usuario → Firebase Auth → id_token → API /auth/login → access_token
```

**Pasos:**

1. **Usuario ingresa credenciales** (email/password)
2. **Firebase Authentication** valida las credenciales y genera un `id_token`
3. **API de Railway** recibe el `id_token` en `/auth/login` y devuelve:
   - `access_token`: Token JWT para hacer requests autenticados
   - `user`: Información del usuario con roles y permisos

**Código:**

```typescript
// En frontend/src/api/auth.ts
const response = await fetch(`${API_BASE_URL}/auth/login`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify({
    id_token: idToken, // Obtenido de Firebase
    email: credentials.username,
  }),
});
```

### Opción 2: Autenticación con Firebase + Validación de Sesión

Flujo alternativo (activar con `VITE_USE_FIREBASE=true`):

```
Usuario → Firebase Auth → id_token → API /auth/validate-session → datos usuario
```

Este flujo es útil si necesitas validar sesiones existentes sin hacer login nuevamente.

## 🌐 Endpoints de la API

### POST /auth/login

Autentica un usuario con su id_token de Firebase.

**Request:**

```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIs...",
  "email": "usuario@example.com"
}
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "user": {
    "email": "usuario@example.com",
    "uid": "firebase-uid",
    "username": "usuario",
    "displayName": "Usuario Nombre",
    "roles": ["operador", "admin"],
    "permissions": ["read:parques", "write:reportes"]
  }
}
```

### POST /auth/validate-session

Valida una sesión existente usando el token de autorización.

**Headers:**

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

**Response:**

```json
{
  "user": {
    "email": "usuario@example.com",
    "nombre_completo": "Usuario Nombre"
  },
  "roles": ["operador"],
  "permissions": ["read:parques"]
}
```

## ⚙️ Configuración

### Variables de Entorno

Crear archivo `.env.local` en `frontend/`:

```bash
# API Backend
VITE_API_URL=https://web-production-2d737.up.railway.app

# Autenticación
VITE_USE_FIREBASE=false  # false = Login directo, true = Validación de sesión

# Firebase Configuration (REQUERIDO)
VITE_FIREBASE_API_KEY=tu-api-key
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto-id
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456
```

**Nota:** Firebase es **siempre requerido** porque la API necesita un `id_token` válido de Firebase para autenticar.

## 🔧 Implementación en el Código

### Archivo: `frontend/src/api/auth.ts`

```typescript
// Función principal de login
export const login = async (
  credentials: LoginCredentials,
): Promise<LoginResponse> => {
  if (USE_FIREBASE) {
    return loginWithFirebase(credentials); // Usa validate-session
  }
  return loginWithAPI(credentials); // Usa /auth/login (recomendado)
};
```

### Manejo de Errores

El sistema maneja automáticamente los errores comunes de Firebase:

- `auth/user-not-found` → "Usuario no encontrado"
- `auth/wrong-password` → "Contraseña incorrecta"
- `auth/invalid-email` → "Email inválido"
- `auth/too-many-requests` → "Demasiados intentos. Intenta más tarde."

## 🧪 Pruebas

### Probar el Endpoint Directamente

```powershell
# 1. Obtener un id_token de Firebase (manual o desde la app)
# 2. Probar el login
$body = @{
    id_token = "tu-firebase-id-token"
    email = "usuario@example.com"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://web-production-2d737.up.railway.app/auth/login" `
  -Method POST `
  -Body $body `
  -ContentType "application/json"
```

### Probar Validación de Sesión

```powershell
Invoke-RestMethod -Uri "https://web-production-2d737.up.railway.app/auth/validate-session" `
  -Method POST `
  -Headers @{Authorization="Bearer tu-firebase-id-token"}
```

## 📝 Notas Importantes

1. **Firebase es obligatorio**: Aunque uses `VITE_USE_FIREBASE=false`, aún necesitas configurar Firebase porque la API requiere un `id_token` válido.

2. **Token Storage**: Los tokens se guardan en:
   - `localStorage`: Para persistencia entre sesiones
   - `sessionStorage`: Para la sesión actual

3. **Refresh de Token**: Firebase maneja automáticamente el refresh de tokens. La app los actualiza al restaurar la sesión.

4. **CORS**: La API debe tener configurado CORS para aceptar requests desde tu dominio frontend.

## 🚀 Despliegue

Al desplegar en Vercel, asegúrate de configurar estas variables de entorno en el dashboard de Vercel:

```
VITE_API_URL
VITE_USE_FIREBASE
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

## 🔍 Debugging

Para ver los logs detallados del proceso de autenticación, abre la consola del navegador. Verás mensajes como:

```
🔐 Attempting direct API login: { email: "usuario@example.com" }
📡 Authenticating with Firebase to get id_token...
✅ Firebase id_token obtained
🌐 Logging in to API: https://web-production-2d737.up.railway.app/auth/login
📥 API response: { status: 200, statusText: "OK", ok: true }
✅ API login successful
✅ Login complete
```

## 📚 Referencias

- [Documentación API](https://web-production-2d737.up.railway.app/docs)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Railway Deployment](https://docs.railway.app/)
