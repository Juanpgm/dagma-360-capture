# ✅ Plan de Acción - Resolver Calendar Event Error

## 📌 Resumen del Problema

El endpoint `/convocar_actividad` **SÍ crea la convocatoria**, pero falla al intentar crear un evento en Google Calendar porque busca credenciales en una ruta fija que no existe en Railway.

**Respuesta actual:**

```json
{
  "success": true,
  "id": "a1dd9a42-c2f1-4f24-a220-6c4d5ddd8dcd",
  "message": "Actividad convocada exitosamente",
  "calendar_event_error": "[Errno 2] No such file or directory: '/app/dagma-85aad-firebase-adminsdk-fbsvc-1e7612eab5.json'"
}
```

**Lo bueno:** La convocatoria está guardada ✅  
**Lo que falta:** Crear el evento de calendario en Google Calendar ⏳

---

## 🎯 Solución en 3 pasos

### PASO 1: Obtener el service account JSON

Necesitas el archivo service account de Firebase con credenciales de Google Calendar.

**Dónde obtenerlo:**

1. Firebase Console → Tu proyecto (dagma-85aad)
2. Project Settings → Service Accounts → Firebase Admin SDK
3. Haz clic en "Generate New Private Key"
4. Se descarga un JSON

**¿Ya lo tienes?** ✅  
Guárdalo como: `C:\Users\TuUsuario\service-account.json` (o donde prefieras)

---

### PASO 2: Cargar en local y Vercel

#### Opción A: Script Automático (RECOMENDADO)

```powershell
# Terminal PowerShell, en la carpeta del proyecto

# Cargar en .env.local
.\frontend\setup-firebase-service-account.ps1 -ServiceAccountJsonPath "C:\Users\TuUsuario\service-account.json"

# Resultado: .env.local tendrá FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

#### Opción B: Manual

1. Abre tu `service-account.json` con Notepad
2. Copia TODO el contenido
3. Edita `frontend/.env.local` y reemplaza `FIREBASE_SERVICE_ACCOUNT_JSON=` con el JSON completo
4. Guarda

---

### PASO 3: Actualizar Backend en Railway

El backend aún lee desde ruta fija. Necesitas actualizar el código.

**Archivos a modificar en tu repo del backend:**

- Busca: `dagma-85aad-firebase-adminsdk-fbsvc-1e7612eab5.json`
- Busca: `credentials.Certificate('/app/...json')`
- Busca: `from_service_account_file(`

**Cambios necesarios:**
Ver [BACKEND_CALENDAR_FIX.md](./BACKEND_CALENDAR_FIX.md) para código exacto.

**Resumen:**
Cambia de:

```python
cred = credentials.Certificate('/app/dagma-85aad-firebase-adminsdk-fbsvc-1e7612eab5.json')
```

A:

```python
import os, json
firebase_service_account_json = os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON')
cred_dict = json.loads(firebase_service_account_json)
cred = credentials.Certificate(cred_dict)
```

---

### PASO 4: Subir cambios del backend a Railway

```powershell
cd C:\tu\repo\backend  # Tu repo del backend

git add .
git commit -m "fix: Leer FIREBASE_SERVICE_ACCOUNT_JSON desde env para calendar"
git push origin main

# Railway redeploy automático (esperar ~2-3 mins)
```

---

### PASO 5: Configurar variable en Railway Dashboard

Ve a: https://railway.app/project/[tu-project-id]/settings

1. **Variables** → **Add Variable**
2. **Name:** `FIREBASE_SERVICE_ACCOUNT_JSON`
3. **Value:** Pega el JSON (de tu service-account.json completo)
4. **Save** y **Redeploy**

---

### PASO 6: Configurar en Vercel (Opcional si uses frontend en Vercel)

```powershell
# Script automático
.\frontend\setup-vercel-env.ps1 -ServiceAccountJsonPath "C:\Users\TuUsuario\service-account.json"

# Luego redeploy
vercel --prod --yes
```

O manualmente:

1. https://vercel.com/account/settings/environment-variables
2. Crea variable `FIREBASE_SERVICE_ACCOUNT_JSON`
3. AsígnaIa a: `production`, `preview`, `development`
4. Redeploy

---

## ✅ Verifica que funcionó

1. **En local:**

   ```powershell
   cd frontend
   npm run dev
   # Abre http://localhost:5173, intenta crear convocatoria
   # Debería aparecer sin `calendar_event_error`
   ```

2. **En Railway/Vercel:**

   ```
   POST https://web-production-2d737.up.railway.app/convocar_actividad

   Response:
   {
     "success": true,
     "calendar_event_id": "..." ✅ SIN calendar_event_error
   }
   ```

---

## 📋 Checklist de ejecución

- [ ] Descargué service-account.json desde Firebase
- [ ] Ejecuté script local: `setup-firebase-service-account.ps1`
- [ ] .env.local tiene `FIREBASE_SERVICE_ACCOUNT_JSON=...` poblado
- [ ] Actualicé código del backend (búsqueda/reemplazo de rutas)
- [ ] Subí cambios al repo del backend (`git push`)
- [ ] Configuré variable en Railway Dashboard
- [ ] Railway redeployó automáticamente
- [ ] Probé endpoint `/convocar_actividad` y desapareció `calendar_event_error`

---

## 🆘 Si algo falla

| Síntoma                          | Causa                              | Solución                                                   |
| -------------------------------- | ---------------------------------- | ---------------------------------------------------------- |
| `calendar_event_error` persiste  | Env var no llegó a Railway         | Verifica variable en Railway Dashboard                     |
| JSON inválido en .env.local      | Caracteres especiales no escapados | Usa script automático `setup-firebase-service-account.ps1` |
| "Module not found" en backend    | Olvido actualizar código           | Busca y reemplaza rutas hardcodeadas                       |
| Convocatoria falla completamente | Backend no compatible              | Verifica que se usó `os.getenv()` correctamente            |

---

## 📞 Comandos útiles

```powershell
# Ver logs railway
railway logs

# Redeploy railway manual
railway up --prod

# Ver variables vercel
vercel env list

# Ver logsvercel
vercel logs

# Limpiar cache local
rm frontend/.env.local (y regenerar)
```
