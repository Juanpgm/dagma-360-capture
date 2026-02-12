# Especificación de Endpoints - Sistema de Seguimiento de Reportes

## Contexto

Este documento especifica los endpoints necesarios para el **Sistema de Seguimiento de Reportes/Reconocimientos** del proyecto Artefacto 360 DAGMA. El sistema permite gestionar el ciclo de vida completo de los reportes generados durante las visitas de campo, incluyendo cambios de estado, asignación de encargados, y registro detallado del historial de gestión.

---

## Modelo de Datos

### Tabla: `reportes_seguimiento`

Extensión de la tabla de reportes existente para incluir información de seguimiento:

```sql
CREATE TABLE reportes_seguimiento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporte_id UUID NOT NULL REFERENCES reportes(id) ON DELETE CASCADE,

  -- Estado y Prioridad
  estado VARCHAR(20) NOT NULL DEFAULT 'notificado',
  prioridad VARCHAR(10) NOT NULL DEFAULT 'media',
  porcentaje_avance INTEGER NOT NULL DEFAULT 0 CHECK (porcentaje_avance >= 0 AND porcentaje_avance <= 100),

  -- Responsables
  encargado VARCHAR(255),
  centro_gestor VARCHAR(255),

  -- Auditoría
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_estado CHECK (estado IN ('notificado', 'radicado', 'en-gestion', 'asignado', 'en-proceso', 'resuelto', 'cerrado')),
  CONSTRAINT valid_prioridad CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente'))
);

-- Índices para optimización
CREATE INDEX idx_reportes_seguimiento_reporte_id ON reportes_seguimiento(reporte_id);
CREATE INDEX idx_reportes_seguimiento_estado ON reportes_seguimiento(estado);
CREATE INDEX idx_reportes_seguimiento_prioridad ON reportes_seguimiento(prioridad);
```

### Tabla: `historial_avance_reportes`

Registro de todos los cambios de estado y avances en los reportes:

```sql
CREATE TABLE historial_avance_reportes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporte_id UUID NOT NULL REFERENCES reportes(id) ON DELETE CASCADE,

  -- Información del Avance
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  autor VARCHAR(255) NOT NULL,
  descripcion TEXT NOT NULL,

  -- Cambio de Estado
  estado_anterior VARCHAR(20) NOT NULL,
  estado_nuevo VARCHAR(20) NOT NULL,
  porcentaje INTEGER NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),

  -- Auditoría
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_estado_anterior CHECK (estado_anterior IN ('notificado', 'radicado', 'en-gestion', 'asignado', 'en-proceso', 'resuelto', 'cerrado')),
  CONSTRAINT valid_estado_nuevo CHECK (estado_nuevo IN ('notificado', 'radicado', 'en-gestion', 'asignado', 'en-proceso', 'resuelto', 'cerrado'))
);

-- Índices
CREATE INDEX idx_historial_avance_reporte_id ON historial_avance_reportes(reporte_id);
CREATE INDEX idx_historial_avance_fecha ON historial_avance_reportes(fecha DESC);
```

### Tabla: `evidencias_avance_reportes`

Evidencias fotográficas o documentales asociadas a los avances:

```sql
CREATE TABLE evidencias_avance_reportes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  historial_avance_id UUID NOT NULL REFERENCES historial_avance_reportes(id) ON DELETE CASCADE,

  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('foto', 'documento')),
  url TEXT NOT NULL,
  descripcion VARCHAR(500),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_evidencias_historial_id ON evidencias_avance_reportes(historial_avance_id);
```

---

## Endpoints de la API

### Base URL

```
https://api.tudominio.com/api/v1
```

### Autenticación

Todos los endpoints requieren autenticación mediante **Bearer Token**:

```
Authorization: Bearer {token}
```

---

## 1. Obtener Reportes con Seguimiento

### `GET /reportes/seguimiento`

Obtiene la lista completa de reportes con su información de seguimiento y historial.

#### Request

```http
GET /reportes/seguimiento
Authorization: Bearer {token}

Query Parameters (opcionales):
  - estado: string (filtrar por estado: 'notificado', 'radicado', etc.)
  - prioridad: string (filtrar por prioridad: 'baja', 'media', 'alta', 'urgente')
  - encargado: string (filtrar por nombre del encargado)
  - fecha_desde: string (formato: YYYY-MM-DD)
  - fecha_hasta: string (formato: YYYY-MM-DD)
  - page: number (default: 1)
  - limit: number (default: 50, max: 100)
```

#### Response Success (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": "rep-123abc",
      "nombre_parque": "Parque de los Poetas",
      "tipo_intervencion": "Mantenimiento",
      "descripcion_intervencion": "Poda de césped y limpieza general",
      "direccion": "Carrera 50 #13-10",
      "fecha_registro": "2026-02-10T14:30:00Z",
      "photos_uploaded": 5,
      "photosUrl": [
        "https://storage.example.com/foto1.jpg",
        "https://storage.example.com/foto2.jpg"
      ],
      "observaciones": "Se requiere seguimiento",

      // Información de Seguimiento
      "estado": "radicado",
      "prioridad": "media",
      "porcentaje_avance": 25,
      "encargado": "Juan Pérez García",
      "centro_gestor": "Secretaría de Infraestructura",

      // Historial (ordenado por fecha descendente)
      "historial": [
        {
          "id": "hist-456def",
          "reporte_id": "rep-123abc",
          "fecha": "2026-02-12T10:15:00Z",
          "autor": "María López",
          "descripcion": "Se radicó ante la Secretaría de Infraestructura con radicado No. RAD-2026-001234",
          "estado_anterior": "notificado",
          "estado_nuevo": "radicado",
          "porcentaje": 25,
          "evidencias": [
            {
              "tipo": "documento",
              "url": "https://docs.example.com/radicado.pdf",
              "descripcion": "Radicado oficial No. RAD-2026-001234"
            }
          ]
        },
        {
          "id": "hist-789ghi",
          "reporte_id": "rep-123abc",
          "fecha": "2026-02-10T14:30:00Z",
          "autor": "Sistema",
          "descripcion": "Reporte creado y notificado",
          "estado_anterior": "notificado",
          "estado_nuevo": "notificado",
          "porcentaje": 0,
          "evidencias": []
        }
      ],

      "updated_at": "2026-02-12T10:15:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 50,
    "totalPages": 3
  }
}
```

#### Response Error (400/401/500)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_FILTERS",
    "message": "Los filtros proporcionados no son válidos"
  }
}
```

---

## 2. Registrar Avance / Cambiar Estado

### `POST /reportes/{reporteId}/avance`

Registra un nuevo avance en el reporte, cambia su estado y actualiza el porcentaje de avance.

#### Request

```http
POST /reportes/rep-123abc/avance
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "estado_nuevo": "en-gestion",
  "descripcion": "Se coordinó visita técnica con el ingeniero Carlos Méndez de la Secretaría. La inspección está programada para el 15 de febrero a las 10:00 AM. Se requiere presupuesto para reparación de juegos infantiles.",
  "autor": "María López García",
  "porcentaje": 45,
  "evidencias": [
    {
      "tipo": "foto",
      "url": "https://storage.example.com/evidencia1.jpg",
      "descripcion": "Reunión de coordinación"
    },
    {
      "tipo": "documento",
      "url": "https://docs.example.com/acta.pdf",
      "descripcion": "Acta de reunión"
    }
  ]
}
```

#### Validaciones

- `estado_nuevo`: Requerido. Debe ser un estado válido.
- `descripcion`: Requerido. Mínimo 10 caracteres, máximo 2000 caracteres.
- `autor`: Requerido. Nombre del funcionario que registra el avance.
- `porcentaje`: Requerido. Entre 0 y 100.
- `evidencias`: Opcional. Array de evidencias.

#### Response Success (201 Created)

```json
{
  "success": true,
  "message": "Avance registrado exitosamente",
  "data": {
    "historial_id": "hist-new123",
    "reporte_actualizado": {
      "id": "rep-123abc",
      "estado": "en-gestion",
      "porcentaje_avance": 45,
      "updated_at": "2026-02-12T15:30:00Z",
      "historial": [
        {
          "id": "hist-new123",
          "fecha": "2026-02-12T15:30:00Z",
          "autor": "María López García",
          "descripcion": "Se coordinó visita técnica con el ingeniero Carlos Méndez...",
          "estado_anterior": "radicado",
          "estado_nuevo": "en-gestion",
          "porcentaje": 45,
          "evidencias": [...]
        },
        // ... historial anterior
      ]
    }
  }
}
```

#### Response Error (400)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "La descripción debe tener al menos 10 caracteres",
    "field": "descripcion"
  }
}
```

#### Response Error (404)

```json
{
  "success": false,
  "error": {
    "code": "REPORTE_NOT_FOUND",
    "message": "No se encontró el reporte con ID: rep-123abc"
  }
}
```

---

## 3. Asignar Encargado

### `PATCH /reportes/{reporteId}/encargado`

Asigna un encargado responsable al reporte.

#### Request

```http
PATCH /reportes/rep-123abc/encargado
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "encargado": "Ing. Carlos Andrés Méndez Rojas",
  "centro_gestor": "Secretaría de Infraestructura y Valorización"
}
```

#### Response Success (200 OK)

```json
{
  "success": true,
  "message": "Encargado asignado exitosamente",
  "data": {
    "id": "rep-123abc",
    "encargado": "Ing. Carlos Andrés Méndez Rojas",
    "centro_gestor": "Secretaría de Infraestructura y Valorización",
    "updated_at": "2026-02-12T16:00:00Z"
  }
}
```

---

## 4. Cambiar Prioridad

### `PATCH /reportes/{reporteId}/prioridad`

Cambia la prioridad de un reporte.

#### Request

```http
PATCH /reportes/rep-123abc/prioridad
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "prioridad": "urgente"
}
```

#### Valores válidos para prioridad:

- `baja`
- `media`
- `alta`
- `urgente`

#### Response Success (200 OK)

```json
{
  "success": true,
  "message": "Prioridad actualizada exitosamente",
  "data": {
    "id": "rep-123abc",
    "prioridad": "urgente",
    "updated_at": "2026-02-12T16:15:00Z"
  }
}
```

---

## 5. Obtener Historial de un Reporte

### `GET /reportes/{reporteId}/historial`

Obtiene el historial completo de avances de un reporte específico.

#### Request

```http
GET /reportes/rep-123abc/historial
Authorization: Bearer {token}
```

#### Response Success (200 OK)

```json
{
  "success": true,
  "data": {
    "reporte_id": "rep-123abc",
    "nombre_parque": "Parque de los Poetas",
    "historial": [
      {
        "id": "hist-new123",
        "fecha": "2026-02-12T15:30:00Z",
        "autor": "María López García",
        "descripcion": "Se coordinó visita técnica...",
        "estado_anterior": "radicado",
        "estado_nuevo": "en-gestion",
        "porcentaje": 45,
        "evidencias": [...]
      },
      {
        "id": "hist-456def",
        "fecha": "2026-02-12T10:15:00Z",
        "autor": "María López",
        "descripcion": "Se radicó ante la Secretaría...",
        "estado_anterior": "notificado",
        "estado_nuevo": "radicado",
        "porcentaje": 25,
        "evidencias": [...]
      }
    ]
  }
}
```

---

## 6. Obtener Estadísticas

### `GET /reportes/seguimiento/estadisticas`

Obtiene estadísticas agregadas del sistema de seguimiento.

#### Request

```http
GET /reportes/seguimiento/estadisticas
Authorization: Bearer {token}

Query Parameters (opcionales):
  - fecha_desde: string (formato: YYYY-MM-DD)
  - fecha_hasta: string (formato: YYYY-MM-DD)
```

#### Response Success (200 OK)

```json
{
  "success": true,
  "data": {
    "total_reportes": 150,
    "avance_promedio": 37,

    "por_estado": {
      "notificado": 25,
      "radicado": 30,
      "en-gestion": 40,
      "asignado": 20,
      "en-proceso": 15,
      "resuelto": 10,
      "cerrado": 10
    },

    "por_prioridad": {
      "baja": 30,
      "media": 70,
      "alta": 40,
      "urgente": 10
    },

    "por_centro_gestor": [
      {
        "nombre": "Secretaría de Infraestructura",
        "total": 65,
        "resueltos": 12,
        "en_proceso": 53
      },
      {
        "nombre": "EMCALI",
        "total": 40,
        "resueltos": 8,
        "en_proceso": 32
      }
    ],

    "tendencia_ultimos_30_dias": [
      {
        "fecha": "2026-02-12",
        "nuevos": 5,
        "resueltos": 3,
        "en_proceso": 52
      }
      // ... más días
    ]
  }
}
```

---

## Códigos de Error

| Código                     | Descripción                               |
| -------------------------- | ----------------------------------------- |
| `VALIDATION_ERROR`         | Error de validación en los datos enviados |
| `REPORTE_NOT_FOUND`        | Reporte no encontrado                     |
| `UNAUTHORIZED`             | Token inválido o expirado                 |
| `FORBIDDEN`                | Usuario sin permisos para esta operación  |
| `INVALID_STATE_TRANSITION` | Transición de estado no permitida         |
| `DATABASE_ERROR`           | Error en la base de datos                 |
| `INTERNAL_ERROR`           | Error interno del servidor                |

---

## Reglas de Negocio

### Estados Permitidos

Los estados siguen un flujo lógico:

1. **notificado** → radicado, cerrado
2. **radicado** → en-gestion, asignado, cerrado
3. **en-gestion** → asignado, en-proceso, cerrado
4. **asignado** → en-proceso, cerrado
5. **en-proceso** → resuelto, cerrado
6. **resuelto** → cerrado
7. **cerrado** → (estado final)

### Validaciones Importantes

- El porcentaje de avance debe incrementar o mantenerse (no puede retroceder)
- Si el estado es "resuelto", el porcentaje debe ser >= 90%
- Si el estado es "cerrado", el porcentaje debe ser 100%
- La descripción de cada avance debe ser clara y detallada (mínimo 10 caracteres)

### Notificaciones

El sistema debería enviar notificaciones cuando:

- Se cambia el estado a "asignado" → notificar al encargado
- Se cambia el estado a "resuelto" → notificar al solicitante original
- Un reporte lleva más de 15 días sin actualización → notificar al equipo

---

## Notas de Implementación

### Seguridad

- Implementar rate limiting: máximo 100 requests por minuto por usuario
- Validar y sanitizar todas las entradas
- Registrar todas las operaciones en logs de auditoría
- Implementar CORS apropiadamente

### Performance

- Implementar caché para la lista de reportes (TTL: 5 minutos)
- Paginar resultados en listas grandes
- Optimizar queries con índices apropiados
- Considerar CDN para las imágenes de evidencias

### Almacenamiento de Evidencias

- Las URLs de evidencias deben ser signed URLs con expiración
- Tamaño máximo por evidencia fotográfica: 5MB
- Tamaño máximo por documento: 10MB
- Formatos permitidos fotos: JPG, PNG, WebP
- Formatos permitidos documentos: PDF, DOC, DOCX

---

## Casos de Prueba

### Caso 1: Registrar Avance Normal

```bash
POST /reportes/rep-123abc/avance
{
  "estado_nuevo": "en-gestion",
  "descripcion": "Se contactó con el encargado del centro gestor",
  "autor": "María López",
  "porcentaje": 30
}
```

**Esperado**: 201 Created, reporte actualizado

### Caso 2: Validación de Descripción Corta

```bash
POST /reportes/rep-123abc/avance
{
  "estado_nuevo": "radicado",
  "descripcion": "Ok",
  "autor": "María López",
  "porcentaje": 20
}
```

**Esperado**: 400 Bad Request, error de validación

### Caso 3: Porcentaje Inválido

```bash
POST /reportes/rep-123abc/avance
{
  "estado_nuevo": "cerrado",
  "descripcion": "Cerrado sin completar",
  "autor": "María López",
  "porcentaje": 50
}
```

**Esperado**: 400 Bad Request, porcentaje debe ser 100 para cerrado

---

## Recursos Adicionales

### Swagger/OpenAPI

El backend debería exponer la documentación interactiva en:

```
https://api.tudominio.com/api/docs
```

### Postman Collection

Incluir una colección de Postman con ejemplos de todos los endpoints.

### Webhooks (Opcional)

Considerar implementar webhooks para notificar a sistemas externos sobre cambios importantes:

- `reporte.estado.cambiado`
- `reporte.resuelto`
- `reporte.cerrado`

---

## Checklist de Implementación

- [ ] Crear tablas en base de datos
- [ ] Implementar endpoint GET /reportes/seguimiento
- [ ] Implementar endpoint POST /reportes/{id}/avance
- [ ] Implementar endpoint PATCH /reportes/{id}/encargado
- [ ] Implementar endpoint PATCH /reportes/{id}/prioridad
- [ ] Implementar endpoint GET /reportes/{id}/historial
- [ ] Implementar endpoint GET /reportes/seguimiento/estadisticas
- [ ] Configurar validaciones
- [ ] Implementar logging y auditoría
- [ ] Agregar tests unitarios
- [ ] Agregar tests de integración
- [ ] Documentar con Swagger
- [ ] Configurar rate limiting
- [ ] Implementar caché
- [ ] Deploy en ambiente de staging
- [ ] Pruebas de carga
- [ ] Deploy en producción

---

**Versión**: 1.0  
**Última actualización**: Febrero 12, 2026  
**Autor**: Sistema de Seguimiento DAGMA
