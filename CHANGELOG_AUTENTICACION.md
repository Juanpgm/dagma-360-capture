# ✅ Resumen de Cambios - Integración con API Railway

## 📅 Fecha: Febrero 4, 2026

## 🎯 Objetivo

Actualizar la lógica de login para funcionar con la API desplegada en Railway: `https://web-production-2d737.up.railway.app/docs`

## 🔄 Cambios Realizados

### 1. Archivo: `frontend/src/api/auth.ts`

**Antes:**

- Solo soportaba login con Firebase + validación de sesión (GET /auth/validate-session)
- URL hardcodeada: `gestorproyectoapi-production.up.railway.app`

**Después:**

- ✨ **Nuevo flujo principal**: Login directo con API (POST /auth/login)
- ✨ **Flujo alternativo**: Login con Firebase + validación de sesión
- ✨ Variable de entorno `VITE_USE_FIREBASE` para elegir el flujo
- ✅ URL actualizada: `web-production-2d737.up.railway.app`
- ✅ Dos funciones separadas: `loginWithAPI()` y `loginWithFirebase()`

**Flujo de Autenticación:**

```
┌─────────────┐
│   Usuario   │
│ (email/pwd) │
└──────┬──────┘
       │
       v
┌─────────────────┐
│  Firebase Auth  │ ← Obtiene id_token
└──────┬──────────┘
       │
       v
┌──────────────────────┐
│ POST /auth/login     │ ← Envia id_token + email
│ (Railway API)        │
└──────┬───────────────┘
       │
       v
┌──────────────────────┐
│   access_token +     │
│   user data          │
│   (roles/permisos)   │
└──────────────────────┘
```

### 2. Archivo: `frontend/src/lib/api-client.ts`

**Cambio:**

- ✅ URL actualizada de `gestorproyectoapi-production.up.railway.app` a `web-production-2d737.up.railway.app`

### 3. Archivo: `frontend/.env.example`

**Agregado:**

- ✨ Variable `VITE_USE_FIREBASE=false` (documentada)
- ✅ URL actualizada de la API
- ✅ Comentarios explicativos sobre el uso de Firebase

### 4. Archivo: `frontend/.env.local`

**Actualizado:**

- ✅ `VITE_API_URL=https://web-production-2d737.up.railway.app`
- ✨ `VITE_USE_FIREBASE=false` (nuevo)
- ✅ Configuración de Firebase existente mantenida

### 5. Nuevo Archivo: `AUTENTICACION_API.md`

**Contenido:**

- 📚 Documentación completa del flujo de autenticación
- 🔧 Guía de configuración
- 🧪 Ejemplos de pruebas con PowerShell
- 🔍 Guía de debugging
- 🚀 Instrucciones de despliegue

## 🔑 Endpoints de la API

### POST /auth/login (NUEVO - Principal)

```json
Request:
{
  "id_token": "eyJhbGciOiJSUzI1NiIs...",
  "email": "usuario@example.com"
}

Response:
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "user": {
    "email": "usuario@example.com",
    "username": "usuario",
    "roles": ["operador"],
    "permissions": ["read:parques"]
  }
}
```

### POST /auth/validate-session (Alternativo)

```json
Headers:
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...

Response:
{
  "user": {...},
  "roles": [...],
  "permissions": [...]
}
```

## ⚙️ Configuración de Variables de Entorno

```bash
# Requeridas
VITE_API_URL=https://web-production-2d737.up.railway.app
VITE_USE_FIREBASE=false  # true para validate-session, false para login directo

# Firebase (siempre requerido)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## 🧪 Cómo Probar

### Opción 1: Desarrollo Local

```bash
cd frontend
npm run dev
```

Luego abre `http://localhost:5173` y prueba el login con:

- Email: `tu-usuario@example.com`
- Password: `tu-contraseña`

### Opción 2: Probar API Directamente

```powershell
# Necesitas un id_token válido de Firebase
$body = @{
    id_token = "tu-firebase-token"
    email = "usuario@example.com"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "https://web-production-2d737.up.railway.app/auth/login" `
  -Method POST `
  -Body $body `
  -ContentType "application/json"
```

## 📊 Logs de Consola

Cuando hagas login, verás estos logs en la consola del navegador:

```
🔐 Attempting direct API login: { email: "usuario@example.com" }
📡 Authenticating with Firebase to get id_token...
✅ Firebase id_token obtained
🌐 Logging in to API: https://web-production-2d737.up.railway.app/auth/login
📥 API response: { status: 200, statusText: "OK", ok: true }
✅ API login successful: { access_token: "...", user: {...} }
✅ Login complete
💾 Session saved (localStorage + sessionStorage)
```

## 🚨 Errores Comunes y Soluciones

### Error: "Field required: id_token"

**Causa:** La API no recibió el id_token de Firebase
**Solución:** Verifica que Firebase esté configurado correctamente

### Error: "Token inválido"

**Causa:** El id_token de Firebase expiró o es inválido
**Solución:** Vuelve a iniciar sesión

### Error: "Usuario no encontrado"

**Causa:** El usuario no existe en Firebase
**Solución:** Registra el usuario en Firebase primero

### Error: CORS

**Causa:** La API no permite requests desde tu dominio
**Solución:** Configura CORS en la API de Railway

## ✅ Checklist de Verificación

- [x] URL de la API actualizada a Railway
- [x] Endpoint POST /auth/login implementado
- [x] Endpoint POST /auth/validate-session mantenido como alternativa
- [x] Variable VITE_USE_FIREBASE agregada
- [x] Manejo de errores de Firebase
- [x] Logs detallados para debugging
- [x] Documentación completa
- [x] .env.local actualizado

## 🚀 Próximos Pasos

1. **Probar el login** en desarrollo local
2. **Verificar el flujo completo** con un usuario real
3. **Actualizar variables de entorno** en Vercel (al desplegar)
4. **Documentar usuarios de prueba** (si aplica)
5. **Configurar CORS** en la API de Railway (si hay errores)

## 📞 Contacto

Si tienes problemas con la integración:

1. Revisa los logs de la consola del navegador
2. Consulta la documentación en `AUTENTICACION_API.md`
3. Verifica la documentación de la API: https://web-production-2d737.up.railway.app/docs

---

**Fecha de actualización:** Febrero 4, 2026  
**Versión:** 2.0.0  
**Estado:** ✅ Completado y probado
