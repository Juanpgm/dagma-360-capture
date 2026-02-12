# Test Login API
$API_URL = "https://web-production-2d737.up.railway.app"

Write-Host "🔐 Testing Login Flow..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Check API health
Write-Host "1. Checking API health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$API_URL/health" -Method Get -TimeoutSec 10
    Write-Host "   ✅ API is reachable" -ForegroundColor Green
    Write-Host "   Response: $($health | ConvertTo-Json -Compress)" -ForegroundColor Gray
}
catch {
    Write-Host "   ❌ API health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Verify login endpoint exists
Write-Host "2. Testing /auth/login endpoint..." -ForegroundColor Yellow
$testBody = @{
    id_token = "test_token"
    email    = "test@test.com"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$API_URL/auth/login" -Method Post -Body $testBody -ContentType "application/json" -TimeoutSec 10
    Write-Host "   Response Status: $($response.StatusCode)" -ForegroundColor Gray
}
catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "   Response Status: $statusCode" -ForegroundColor Gray
    
    if ($statusCode -eq 401 -or $statusCode -eq 422) {
        Write-Host "   ✅ Endpoint exists (expected auth error)" -ForegroundColor Green
    }
    else {
        Write-Host "   ⚠️  Unexpected status code" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "💡 To test with real credentials, provide email and password:" -ForegroundColor Cyan
Write-Host '   $email = "your.email@example.com"' -ForegroundColor Gray
Write-Host '   $password = "your_password"' -ForegroundColor Gray
