# Script para configurar automáticamente FIREBASE_SERVICE_ACCOUNT_JSON en Vercel

param(
    [Parameter(Mandatory = $false)]
    [string]$ServiceAccountJsonPath = ""
)

Write-Host "🔧 Configurador de variables Vercel para FIREBASE_SERVICE_ACCOUNT_JSON" -ForegroundColor Cyan

# Si no se proporciona ruta, buscar en directorio actual
if ([string]::IsNullOrWhiteSpace($ServiceAccountJsonPath)) {
    $possiblePaths = @(
        ".\service-account.json",
        ".\dagma-85aad-firebase-adminsdk-fbsvc-1e7612eab5.json",
        "..\dagma-85aad-firebase-adminsdk-fbsvc-1e7612eab5.json",
        "$env:USERPROFILE\service-account.json"
    )
  
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $ServiceAccountJsonPath = $path
            Write-Host "✅ Archivo encontrado: $ServiceAccountJsonPath" -ForegroundColor Green
            break
        }
    }
  
    if ([string]::IsNullOrWhiteSpace($ServiceAccountJsonPath)) {
        Write-Host "❌ No se encontró service-account.json" -ForegroundColor Red
        Write-Host "Uso: .\setup-vercel-env.ps1 -ServiceAccountJsonPath 'C:\ruta\service-account.json'" -ForegroundColor Yellow
        exit 1
    }
}

if (-not (Test-Path $ServiceAccountJsonPath)) {
    Write-Host "❌ No existe el archivo: $ServiceAccountJsonPath" -ForegroundColor Red
    exit 1
}

# Verificar que vercel CLI está instalado
try {
    $vercelVersion = vercel --version 2>&1
    Write-Host "✅ Vercel CLI encontrado: $vercelVersion" -ForegroundColor Green
}
catch {
    Write-Host "❌ Vercel CLI no está instalado" -ForegroundColor Red
    Write-Host "Instala con: npm install -g vercel" -ForegroundColor Yellow
    exit 1
}

# Leer y convertir JSON
try {
    Write-Host "`n📄 Procesando archivo de credenciales..." -ForegroundColor Cyan
    $jsonRaw = Get-Content $ServiceAccountJsonPath -Raw
    $jsonOneLine = ($jsonRaw | ConvertFrom-Json | ConvertTo-Json -Compress)
    Write-Host "✅ JSON convertido a una línea" -ForegroundColor Green
}
catch {
    Write-Host "❌ Error procesando JSON: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Configurar en Vercel para cada ambiente
$environments = @("production", "preview", "development")
$successCount = 0

Write-Host "`n🔐 Configurando variables en Vercel..." -ForegroundColor Cyan

foreach ($env in $environments) {
    Write-Host "`n  Ambiente: $env" -ForegroundColor Yellow
  
    try {
        # Vercel espera entrada del usuario para confirmar, así que lo hacemos interactivamente
        Write-Host "  Pegando valor en: " -NoNewline
    
        $process = Start-Process -FilePath "vercel" -ArgumentList "env", "add", "FIREBASE_SERVICE_ACCOUNT_JSON", $env -PassThru -NoNewWindow
    
        # Esperar a que se complete
        Start-Sleep -Milliseconds 500
    
        # Lamentablemente vercel env add es interactivo, así que mostrar instrucciones
        Write-Host "  ⚠️ Vercel CLI abrirá un diálogo interactivo" -ForegroundColor Yellow
    }
    catch {
        Write-Host "  ⚠️ Error ejecutando vercel: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Ofrecer alternativa con fichero temporal
Write-Host "`n📋 ALTERNATIVA (si el método interactivo falla):" -ForegroundColor Cyan
Write-Host "  1. Copia este valor (sin comillas):" -ForegroundColor Gray
Write-Host "  `"$jsonOneLine`"" -ForegroundColor White
Write-Host ""
Write-Host "  2. Ve a: https://vercel.com/account/settings/environment-variables" -ForegroundColor Gray
Write-Host "  3. Crea variable: FIREBASE_SERVICE_ACCOUNT_JSON con ese valor" -ForegroundColor Gray
Write-Host "  4. Para cada ambiente: production, preview, development" -ForegroundColor Gray
Write-Host "  5. Redeploy: vercel --prod --yes" -ForegroundColor Gray

# Copiar al portapapeles si es Windows
if ($PSVersionTable.Platform -eq "Win32NT" -or $PSVersionTable.OS -like "*Windows*") {
    try {
        $jsonOneLine | Set-Clipboard
        Write-Host "`n✅ JSON copiado al portapapeles (Ctrl+V para pegar)" -ForegroundColor Green
    }
    catch {
        Write-Host "`n⚠️ No se pudo copiar al portapapeles automáticamente" -ForegroundColor Yellow
    }
}

Write-Host "`n🎯 Una vez configuradas las variables, redeploy con:" -ForegroundColor Cyan
Write-Host "  vercel --prod --yes" -ForegroundColor White

