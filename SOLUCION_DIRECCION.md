# ✅ Correcciones Implementadas - Campo Dirección Requerido

## 📋 Análisis del Endpoint

Según la documentación de la API en `/openapi.json`, el endpoint `/grupo-operativo/reconocimiento` requiere:

### Campos Obligatorios (multipart/form-data):

- ✅ `tipo_intervencion` - Tipo de intervención
- ✅ `descripcion_intervencion` - Descripción detallada
- ✅ **`direccion`** - Dirección del lugar (REQUERIDO)
- ✅ `coordinates_type` - Tipo de geometría ("Point", "LineString", "Polygon")
- ✅ `coordinates_data` - Coordenadas GPS en formato JSON array
- ✅ `photos` - Archivos de fotos (al menos 1)
- ⭕ `observaciones` - Observaciones (OPCIONAL)

## 🔧 Cambios Realizados

### 1. Agregado campo `direccion` a las variables locales

**Archivo:** `VisitaVerificacion.svelte` (líneas 25-29)

```typescript
let tipoIntervencion = "";
let descripcionIntervencion = "";
let direccion = ""; // ← NUEVO
let observaciones = "";
```

### 2. Actualizada validación del paso 2

**Archivo:** `VisitaVerificacion.svelte` (líneas 45-47)

```typescript
? tipoIntervencion && descripcionIntervencion && direccion && state.data.coordenadas_gps
//                                               ^^^^^^^^^ NUEVO
```

### 3. Agregado campo en el formulario

**Archivo:** `Step2Formulario.svelte` (líneas 204-220)

```svelte
<div class="field">
  <label for="direccion">
    Dirección <span class="required">*</span>
  </label>
  <input
    id="direccion"
    type="text"
    bind:value={direccion}
    placeholder="Dirección del lugar de la intervención..."
    required
  />
  {#if selectedParque?.direccion && direccion !== selectedParque.direccion}
    <button type="button" class="btn-restore"
            on:click={() => (direccion = selectedParque.direccion || '')}>
      📍 Usar dirección del parque
    </button>
  {/if}
</div>
```

### 4. Auto-completar desde parque seleccionado

**Archivo:** `Step2Formulario.svelte` (líneas 69-81)

```typescript
onMount(async () => {
  // ... GPS capture ...

  // Auto-completar dirección desde el parque si está disponible
  if (selectedParque?.direccion && !direccion) {
    direccion = selectedParque.direccion;
  }
});
```

### 5. Sincronización antes de avanzar paso

**Archivo:** `VisitaVerificacion.svelte` (líneas 84-92)

```typescript
if (currentStep === 2) {
  visitaStore.updateData({
    tipo_intervencion: tipoIntervencion,
    descripcion_intervencion: descripcionIntervencion,
    direccion: direccion, // ← NUEVO
    observaciones: observaciones,
  });
}
```

### 6. Validación antes de submit

**Archivo:** `VisitaVerificacion.svelte` (líneas 175-182)

```typescript
if (
  !state.selectedParque ||
  !data.coordenadas_gps ||
  !tipoIntervencion ||
  !descripcionIntervencion ||
  !direccion || // ← NUEVO
  photoFiles.length === 0
) {
  throw new Error("Faltan campos requeridos...");
}
```

## 🧪 Resultado

### Antes:

❌ Botón "Continuar" bloqueado en Paso 2
❌ API rechazaba con 422: "Field required: direccion"

### Ahora:

✅ Campo dirección visible y requerido
✅ Auto-completado desde el parque seleccionado
✅ Botón para restaurar dirección del parque si se modifica
✅ Validación correcta antes de avanzar
✅ Todos los campos requeridos por la API están presentes

## 🎯 Flujo Completo

1. **Paso 1:** Seleccionar parque
2. **Paso 2:**
   - 📍 GPS se captura automáticamente
   - 📝 Llenar tipo de intervención (required)
   - 📝 Llenar descripción (required)
   - 🏠 **Dirección auto-completada** del parque o editable (required)
   - 📋 Observaciones (opcional)
   - ✅ Botón "Continuar" se habilita cuando TODO está llenado
3. **Paso 3:** Agregar fotos (mínimo 1)
4. **Enviar:** Se valida todo y se envía a la API

## ✅ Estado Actual

- ✅ Compilación exitosa
- ✅ Todos los tipos correctos
- ✅ Validación completa
- ✅ Listo para probar en http://localhost:5174
