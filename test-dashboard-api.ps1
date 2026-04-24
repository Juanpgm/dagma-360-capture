# Script para probar el endpoint de reportes de intervenciones

$apiUrl = "https://web-production-2d737.up.railway.app/grupo-cuadrilla/reportes_intervenciones"

Write-Host "?? Probando endpoint: $apiUrl" -ForegroundColor Cyan
Write-Host ""

try {
    # Intentar sin autenticaci?n primero
    Write-Host "?? Intento 1: Sin autenticaci?n..." -ForegroundColor Yellow
    $response = Invoke-WebRequest -Uri $apiUrl -Method GET -ContentType "application/json" -ErrorAction Stop
    
    Write-Host "? Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "?? Contenido de la respuesta:" -ForegroundColor Green
    $content = $response.Content | ConvertFrom-Json
    $content | ConvertTo-Json -Depth 3
    
    Write-Host ""
    Write-Host "?? Total de reportes: $($content.reportes.Count)" -ForegroundColor Green
    
}
catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "? Error: Status Code $statusCode" -ForegroundColor Red
    Write-Host "Mensaje: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($statusCode -eq 401) {
        Write-Host ""
        Write-Host "??  El endpoint requiere autenticaci?n" -ForegroundColor Yellow
        Write-Host "Por favor, proporciona un token de autenticaci?n v?lido" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "? Prueba completada" -ForegroundColor Cyan
