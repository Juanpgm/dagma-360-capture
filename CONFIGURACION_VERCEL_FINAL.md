# 🔧 Configuración Final de Deployment - CaliTrack 360

## ⚠️ PROBLEMA ACTUAL

El proyecto en Vercel tiene configurado `frontend` como **Root Directory**, lo que causa el error:
```
Error: The provided path "A:\programing_workspace\artefacto-calitrack-360\frontend\frontend" does not exist.
```

## ✅ SOLUCIÓN: Actualizar Configuración en Vercel Dashboard

### Paso 1: Acceder a la Configuración del Proyecto

1. Ve a: https://vercel.com/juan-pablos-projects-56fe2e60/artefacto-calitrack-360-frontend-production/settings
2. Inicia sesión si es necesario

### Paso 2: Cambiar Root Directory

1. En el menú lateral, haz clic en **"General"**
2. Busca la sección **"Build & Development Settings"**
3. Encuentra el campo **"Root Directory"**
4. **CAMBIA** el valor de `frontend` a `.` (punto) o déjalo **VACÍO**
5. Haz clic en **"Save"**

### Paso 3: Verificar Otras Configuraciones

Asegúrate de que estén configuradas así:

```
Framework Preset:       Vite
Root Directory:         . (punto o vacío)
Build Command:          npm run build
Output Directory:       dist
Install Command:        npm install
Node.js Version:        20.x
```

### Paso 4: Variables de Entorno

Verifica que estas variables estén configuradas en:
**Project Settings → Environment Variables**

```bash
VITE_API_URL=https://gestorproyectoapi-production.up.railway.app
VITE_FIREBASE_API_KEY=AIzaSyAjDv54W4S2OYwAJhRHlojN-BFyj4LiHLU
VITE_FIREBASE_AUTH_DOMAIN=gestorproyecto-37dbb.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=gestorproyecto-37dbb
VITE_FIREBASE_STORAGE_BUCKET=gestorproyecto-37dbb.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1045318606467
VITE_FIREBASE_APP_ID=1:1045318606467:web:3fbca47dce07ad1c96d933
```

---

## 🚀 DESPUÉS DE ACTUALIZAR LA CONFIGURACIÓN

Una vez que hayas cambiado el **Root Directory** en Vercel, puedes hacer deployment de dos formas:

### Opción A: Desde la línea de comandos

```powershell
cd frontend
vercel --prod --yes
```

### Opción B: Desde el repositorio (Recomendado)

```powershell
git add .
git commit -m "Fix: Configuración de deployment"
git push origin master
```

Vercel detectará automáticamente el push y desplegará la aplicación.

---

## 📝 CONFIGURACIÓN ACTUAL DEL WORKSPACE

El proyecto está configurado así:

```
artefacto-calitrack-360/          # ← Raíz del repositorio
├── frontend/                      # ← Código de la aplicación
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── vercel.json               # ← Configuración de Vercel
│   └── .vercel/                  # ← Enlace al proyecto
│       └── project.json          # ← ID del proyecto
└── deploy-vercel.ps1             # ← Script de deployment
```

El archivo `frontend/.vercel/project.json` ya está enlazado correctamente a:
```json
{
  "projectId": "prj_3S69xXcyqW53Qruc97PRsaUJHiTZ",
  "orgId": "team_SzZM9UUotBq10Z80gIsZpAzv",
  "projectName": "artefacto-calitrack-360-frontend-production"
}
```

---

## 🎯 URL FINAL DE PRODUCCIÓN

Una vez configurado correctamente, tu aplicación estará disponible en:

**https://artefacto-calitrack-360-frontend-pr.vercel.app**

Y todos los deployments futuros se harán automáticamente a esta URL cuando hagas `git push`.

---

## 🔄 DEPLOYMENT AUTOMÁTICO

Después de la configuración inicial, el flujo será:

1. **Haces cambios** en tu código
2. **Commiteas** los cambios:
   ```bash
   git add .
   git commit -m "Tus cambios"
   ```
3. **Push a GitHub**:
   ```bash
   git push origin master
   ```
4. **Vercel despliega automáticamente** (1-2 minutos)
5. **Tu app se actualiza** en la URL de producción

---

## ⚡ COMANDOS ÚTILES

```powershell
# Ver proyectos
vercel project ls

# Ver deployments
vercel ls

# Ver logs del último deployment
vercel logs

# Cancelar un deployment
vercel rm <deployment-url> --yes
```

---

## 🆘 SOPORTE

Si tienes problemas:

1. Verifica que el Root Directory esté en `.` o vacío
2. Revisa los logs en: https://vercel.com/dashboard
3. Verifica las variables de entorno
4. Asegúrate de que `npm run build` funcione localmente

---

**✅ RESUMEN**: Solo necesitas cambiar el **Root Directory** en Vercel Dashboard de `frontend` a `.` (punto) o dejarlo vacío, y todo funcionará perfectamente.
