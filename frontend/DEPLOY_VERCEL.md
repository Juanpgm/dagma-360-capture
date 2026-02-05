# 🚀 Instrucciones para Deploy en Vercel

## Variables de Entorno Requeridas

Configura las siguientes variables de entorno en **Vercel Dashboard** > **Settings** > **Environment Variables**:

### 1. API Backend

```
VITE_API_URL=https://web-production-2d737.up.railway.app
```

**Descripción**: URL del backend en Railway (endpoints de parques y reconocimientos)

### 2. Autenticación

```
VITE_USE_FIREBASE=false
```

**Descripción**: Deshabilita el flujo completo de Firebase (usa autenticación directa con API)

### 3. Firebase Configuration

```
VITE_FIREBASE_API_KEY=AIzaSyAVVeWMgunLWBiZz5XU-GjrzbO3ZKcyvD0
VITE_FIREBASE_AUTH_DOMAIN=dagma-85aad.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=dagma-85aad
VITE_FIREBASE_STORAGE_BUCKET=dagma-85aad.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=716440297451
VITE_FIREBASE_APP_ID=1:716440297451:web:6971b2bb4118f7ea3cc3ae
```

**Descripción**: Credenciales de Firebase para autenticación

---

## Pasos para Configurar en Vercel

### Opción A: Dashboard de Vercel

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Click en **Settings** > **Environment Variables**
3. Agrega cada variable con su valor
4. Selecciona los entornos: **Production**, **Preview**, **Development**
5. Click en **Save**
6. Redeploy el proyecto: **Deployments** > **...** > **Redeploy**

### Opción B: Vercel CLI

```powershell
# Instalar Vercel CLI (si no está instalado)
npm i -g vercel

# Login
vercel login

# Configurar variables
vercel env add VITE_API_URL production
# Pegar: https://web-production-2d737.up.railway.app

vercel env add VITE_USE_FIREBASE production
# Pegar: false

vercel env add VITE_FIREBASE_API_KEY production
# Pegar: AIzaSyAVVewMgunLWBiZz5XU-GjrzbO3ZKcyvD0

vercel env add VITE_FIREBASE_AUTH_DOMAIN production
# Pegar: dagma-85aad.firebaseapp.com

vercel env add VITE_FIREBASE_PROJECT_ID production
# Pegar: dagma-85aad

vercel env add VITE_FIREBASE_STORAGE_BUCKET production
# Pegar: dagma-85aad.firebasestorage.app

vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID production
# Pegar: 716440297451

vercel env add VITE_FIREBASE_APP_ID production
# Pegar: 1:716440297451:web:6971b2bb4118f7ea3cc3ae

# Redeploy
vercel --prod
```

---

## Verificación Post-Deploy

### 1. Verifica que las variables estén configuradas

```powershell
vercel env ls
```

### 2. Abre la aplicación en producción

```
https://tu-dominio.vercel.app
```

### 3. Abre DevTools (F12) y verifica:

- **Console**: Busca logs como "🚀 Iniciando carga de parques desde: https://web-production-2d737.up.railway.app/init/parques"
- **Network**: Verifica que las peticiones a `/init/parques` y `/grupo-operativo/reconocimiento` funcionen (status 200)

### 4. Funcionalidades a probar:

- ✅ **Mapa de Parques**: Debe cargar 25 parques
- ✅ **Reconocimiento**: Debe poder registrar reconocimientos con fotos
- ✅ **Historial**: Debe mostrar los reconocimientos guardados

---

## Solución de Problemas

### Problema: "No se pudieron cargar los parques"

**Causa**: CORS o variables de entorno mal configuradas

**Solución**:

1. Verifica que `VITE_API_URL` esté configurada correctamente en Vercel
2. Verifica que el backend en Railway tenga CORS configurado para tu dominio de Vercel:
   ```python
   # app/main.py
   allow_origins=[
       "https://tu-dominio.vercel.app",
       "http://localhost:5173",
       "http://localhost:5174"
   ]
   ```

### Problema: Endpoints no funcionan en producción

**Causa**: El proxy de Vite no existe en producción

**Solución**: Ya está arreglado. El código usa:

- Desarrollo: `/api/...` (proxy local)
- Producción: `https://web-production-2d737.up.railway.app/...` (URL completa)

---

## Scripts Útiles

### Build local (para probar antes de deploy)

```powershell
cd a:\programing_workspace\artefacto-360-dagma\frontend
npm run build
npm run preview
```

### Deploy directo a Vercel

```powershell
cd a:\programing_workspace\artefacto-360-dagma\frontend
vercel --prod
```

---

## URLs Importantes

- **Frontend (Vercel)**: https://tu-dominio.vercel.app
- **Backend (Railway)**: https://web-production-2d737.up.railway.app
- **API Docs**: https://web-production-2d737.up.railway.app/docs
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Railway Dashboard**: https://railway.app/dashboard

---

## Endpoints Configurados

### GET /init/parques

Carga los parques con sus geometrías para mostrar en el mapa.

### POST /grupo-operativo/reconocimiento

Registra un nuevo reconocimiento de parque con fotos (multipart/form-data).

### GET /grupo-operativo/reportes

Obtiene el historial de reconocimientos registrados.

---

**Última actualización**: {{ date }}
