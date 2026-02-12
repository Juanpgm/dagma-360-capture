# Test Reconocimiento Endpoint
$API_URL = "https://web-production-2d737.up.railway.app"

Write-Host "🔍 Testing /grupo-operativo/reconocimiento endpoint..." -ForegroundColor Cyan
Write-Host ""

# Intentar hacer una petición OPTIONS para ver qué acepta
try {
    Write-Host "1. Trying OPTIONS request..." -ForegroundColor Yellow
    $response = Invoke-WebRequest -Uri "$API_URL/grupo-operativo/reconocimiento" -Method Options -TimeoutSec 10
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Allowed Methods: $($response.Headers['Allow'])" -ForegroundColor Gray
}
catch {
    Write-Host "   No OPTIONS support or CORS issue" -ForegroundColor Yellow
}

Write-Host ""

# Intentar POST con datos mínimos para ver qué error da (revelará el schema)
Write-Host "2. Testing POST with minimal data to see schema requirements..." -ForegroundColor Yellow

$testBody = @{
    tipo_intervencion        = "test"
    descripcion_intervencion = "test description"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$API_URL/grupo-operativo/reconocimiento" -Method Post -Body $testBody -ContentType "application/json" -TimeoutSec 10
    Write-Host "   ✅ Status: $($response.StatusCode)" -ForegroundColor Green
}
catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "   Status: $statusCode" -ForegroundColor Yellow
    
    $result = $_.ErrorDetails.Message
    Write-Host ""
    Write-Host "📋 Response (reveals required schema):" -ForegroundColor Cyan
    Write-Host $result -ForegroundColor Gray
}
