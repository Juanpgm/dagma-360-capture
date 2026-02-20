# 🔧 Fix para Calendar Event Error - Backend (Railway)

## Problema

El endpoint `/convocar_actividad` intenta crear un evento en Google Calendar leyendo credenciales desde una ruta fija:

```
/app/dagma-85aad-firebase-adminsdk-fbsvc-1e7612eab5.json
```

Pero ese archivo no existe en Railway, causando:

```
calendar_event_error: "[Errno 2] No such file or directory: '/app/dagma-85aad-firebase-adminsdk-fbsvc-1e7612eab5.json'"
```

## Solución: Leer desde variable de entorno

### En tu código Python/FastAPI del backend

Busca el lugar donde inicializas Firebase Admin y creas eventos de calendario.

#### ❌ CÓDIGO ACTUAL (FALLIDO)

```python
import firebase_admin
from firebase_admin import credentials, firestore

# Intenta cargar desde archivo fijo (falla en Railway)
cred = credentials.Certificate('/app/dagma-85aad-firebase-adminsdk-fbsvc-1e7612eab5.json')
firebase_admin.initialize_app(cred)
```

#### ✅ CÓDIGO CORRECTO (LEE DESDE ENV)

```python
import os
import json
import firebase_admin
from firebase_admin import credentials, firestore

# Leer JSON de la variable de entorno
firebase_service_account_json = os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON')

if firebase_service_account_json:
    try:
        # Parse JSON desde string
        cred_dict = json.loads(firebase_service_account_json)
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase inicializado desde FIREBASE_SERVICE_ACCOUNT_JSON")
    except json.JSONDecodeError as e:
        print(f"❌ Error parseando JSON: {e}")
        # Fallback a credenciales por defecto
        firebase_admin.initialize_app()
else:
    # Si no hay variable, intentar credenciales por defecto (Workload Identity)
    firebase_admin.initialize_app()
    print("⚠️ FIREBASE_SERVICE_ACCOUNT_JSON no configurada, usando credenciales por defecto")
```

### Localizar línea exacta en tu código

Busca en tu repo del backend términos como:

- `dagma-85aad-firebase-adminsdk-fbsvc-1e7612eab5.json`
- `credentials.Certificate(`
- `firebase_admin.initialize_app(cred)`
- Archivo `/convocar_actividad` endpoint

### Para la parte de Calendar (crear eventos Google Calendar)

Si también creates eventos de calendario de forma similar:

#### ❌ FALLIDO

```python
from google.oauth2 import service_account

scopes = ['https://www.googleapis.com/auth/calendar']
creds = service_account.Credentials.from_service_account_file(
    '/app/dagma-85aad-firebase-adminsdk-fbsvc-1e7612eab5.json',
    scopes=scopes
)
```

#### ✅ CORRECTO

```python
import os
import json
from google.oauth2 import service_account

firebase_service_account_json = os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON')

if firebase_service_account_json:
    try:
        cred_dict = json.loads(firebase_service_account_json)
        scopes = ['https://www.googleapis.com/auth/calendar']
        creds = service_account.Credentials.from_service_account_info(
            cred_dict,
            scopes=scopes
        )
        print("✅ Google Calendar credentials desde FIREBASE_SERVICE_ACCOUNT_JSON")
    except Exception as e:
        print(f"❌ Error con Calendar creds: {e}")
        creds = None
else:
    print("⚠️ FIREBASE_SERVICE_ACCOUNT_JSON no configurada")
    creds = None
```

## Pasos para implementar

### 1. Encuentra tu repo del backend

- Según el error, está en Railway: `https://web-production-2d737.up.railway.app/`
- El código fuente debe estar en un repositorio Git (GitHub)

### 2. Actualiza el código

Reemplaza las líneas de carga de credenciales con el patrón de `os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON')`

### 3. Setea la variable en Railway

```bash
# SSH a Railway o por dashboard
railway variable add FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
```

O en **Railway Dashboard**:

1. Abre tu servicio
2. **Variables** → **Add Variable**
3. Name: `FIREBASE_SERVICE_ACCOUNT_JSON`
4. Value: (pega JSON completo en una sola línea)
5. **Save** y **Redeploy**

### 4. Redeploy en Railway

```bash
git push origin main  # Activa webhook automático en Railway
# O manualmente: railway up
```

## Verificación

Una vez desplegado, intenta registrar convocatoria de nuevo:

- Si sigue fallando calendar pero con ID creada: ✅ La convocatoria se guardó (calendar es secundario)
- Si calendar funciona: ✅ Todo OK

## Alternativa: Desactivar Calendar si no lo necesitas

Si la creación de eventos de calendario no es crítica, puedes envolverla en try/except para que no bloquee:

```python
try:
    # Código que crea evento en Google Calendar
    calendar_service.events().insert(...).execute()
    response['calendar_event_id'] = event_id
except Exception as e:
    print(f"⚠️ Calendar error (no crítico): {e}")
    response['calendar_event_error'] = str(e)
    # Continuar sin fallar
```

Así la convocatoria se crea aunque Calendar falle.

---

## Resumen

- **Variable estándar**: `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON en una sola línea)
- **Lectura segura**: `os.getenv()` + `json.loads()`
- **Lugares que cambiar**: Firebase `initialize_app()` + Google Calendar credentials
- **Deploy**: Push a Git → Railway redeploy automático
