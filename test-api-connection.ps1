# ?? Script de Prueba - Autenticaci?n API Railway
# Este script verifica la conectividad con la API de Railway

Write-Host "?? Iniciando pruebas de conectividad con API Railway..." -ForegroundColor Cyan
Write-Host ""

# Configuraci?n
$API_BASE_URL = "https://web-production-2d737.up.railway.app"

# Test 1: Health Check
Write-Host "?? Test 1: Health Check" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE_URL/health" -Method GET -TimeoutSec 10
    Write-Host "? Conexi?n exitosa" -ForegroundColor Green
    Write-Host "   Status: $($response.status)" -ForegroundColor Gray
    Write-Host ""
}
catch {
    Write-Host "? Error de conexi?n: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Test 2: Ping
Write-Host "?? Test 2: Ping" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE_URL/ping" -Method GET -TimeoutSec 10
    Write-Host "? Ping exitoso" -ForegroundColor Green
    Write-Host "   Response: $($response.message)" -ForegroundColor Gray
    Write-Host ""
}
catch {
    Write-Host "? Error en ping: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Test 3: Verificar endpoint de login (sin autenticar)
Write-Host "?? Test 3: Verificar endpoint /auth/login" -ForegroundColor Yellow
try {
    # Este test fallar?, pero nos dir? si el endpoint existe
    $body = @{
        id_token = "test-token"
        email    = "test@test.com"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$API_BASE_URL/auth/login" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
}
catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    if ($errorResponse.detail -like "*Token inv*") {
        Write-Host "? Endpoint existe (token de prueba rechazado correctamente)" -ForegroundColor Green
        Write-Host "   Mensaje: $($errorResponse.detail)" -ForegroundColor Gray
    }
    else {
        Write-Host "??  Respuesta inesperada: $($errorResponse.detail)" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Test 4: Verificar CORS
Write-Host "?? Test 4: Verificar configuraci?n CORS" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE_URL/cors-test" -Method GET -TimeoutSec 10
    Write-Host "? CORS configurado correctamente" -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-Host "??  Error en CORS test: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
}

# Test 5: Verificar colecciones de Firebase
Write-Host "?? Test 5: Firebase Collections" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE_URL/firebase/status" -Method GET -TimeoutSec 10
    Write-Host "? Firebase conectado" -ForegroundColor Green
    Write-Host "   Status: $($response.status)" -ForegroundColor Gray
    Write-Host ""
}
catch {
    Write-Host "? Error en conexi?n Firebase: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Test 6: Verificar endpoint de init/parques
Write-Host "???  Test 6: Endpoint /init/parques" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE_URL/init/parques" -Method GET -TimeoutSec 10
    Write-Host "? Endpoint de parques disponible" -ForegroundColor Green
    if ($response.parques) {
        Write-Host "   Parques encontrados: $($response.parques.Count)" -ForegroundColor Gray
    }
    Write-Host ""
}
catch {
    Write-Host "??  Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
}

# Resumen
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "?? RESUMEN DE PRUEBAS" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "API Base URL: $API_BASE_URL" -ForegroundColor White
Write-Host "Documentaci?n: $API_BASE_URL/docs" -ForegroundColor White
Write-Host ""
Write-Host "? = Exitoso | ?? = Advertencia | ? = Error" -ForegroundColor Gray
Write-Host ""
Write-Host "?? Siguiente paso:" -ForegroundColor Yellow
Write-Host "   1. Verifica que Firebase est? configurado en .env.local" -ForegroundColor White
Write-Host "   2. Ejecuta: npm run dev" -ForegroundColor White
Write-Host "   3. Abre http://localhost:5173 y prueba el login" -ForegroundColor White
Write-Host ""
