# Test: GET /grupos/{grupo_key}/reportes_intervenciones
# Uso: .\test-reporte-intervencion-get.ps1 [-Token "ey..."] [-GrupoFiltro gobernanza]

param(
  [string]$Token = "",
  [string]$GrupoFiltro = ""
)

$API_URL    = "https://web-production-2d737.up.railway.app"
$GRUPO_KEYS = @("cuadrilla", "vivero", "gobernanza", "ecosistemas", "umata")

if (-not $Token) { $Token = $env:DAGMA_API_TOKEN }
if ($GrupoFiltro -and ($GRUPO_KEYS -contains $GrupoFiltro)) {
  $GRUPO_KEYS = @($GrupoFiltro)
}

function Get-AuthHeaders {
  $h = @{ "Accept" = "application/json" }
  if ($Token) { $h["Authorization"] = "Bearer $Token" }
  return $h
}

function Test-GetReportes {
  param([string]$GrupoKey, [hashtable]$QParams = @{})
  $qs = ""
  if ($QParams.Count -gt 0) {
    $parts = $QParams.GetEnumerator() | ForEach-Object {
      "$($_.Key)=$([uri]::EscapeDataString($_.Value))"
    }
    $qs = "?" + ($parts -join "&")
  }
  $url = "$API_URL/grupos/$GrupoKey/reportes_intervenciones$qs"
  Write-Host "  -> GET $url" -ForegroundColor Gray
  try {
    $resp = Invoke-WebRequest -Uri $url -Method GET -Headers (Get-AuthHeaders) -TimeoutSec 20 -ErrorAction Stop
    $body = $resp.Content | ConvertFrom-Json
    $total = if ($null -ne $body.total) { $body.total } else { $body.data.Count }
    $count = if ($null -ne $body.data)  { $body.data.Count } else { 0 }
    $icon  = if ($body.success -eq $true) { "OK" } else { "??" }
    Write-Host "    [$icon] HTTP $($resp.StatusCode) | total=$total | data=$count items" -ForegroundColor Green
    if ($count -gt 0) {
      $first = $body.data[0]
      Write-Host "    Primer: id=$($first.id) | tipo=$($first.tipo_intervencion)" -ForegroundColor DarkGray
    }
    return $true
  }
  catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 401) {
      Write-Host "    [401] Requiere token. Pase -Token 'ey...'" -ForegroundColor Yellow
    } elseif ($code -eq 404) {
      Write-Host "    [404] Ruta no encontrada" -ForegroundColor Red
    } else {
      Write-Host "    [$code] $($_.Exception.Message)" -ForegroundColor Red
    }
    return $false
  }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host " GET reportes_intervenciones por grupo" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "0. Health check..." -ForegroundColor Yellow
try {
  $null = Invoke-RestMethod -Uri "$API_URL/health" -Method GET -TimeoutSec 10
  Write-Host "   OK: API disponible" -ForegroundColor Green
} catch {
  Write-Host "   FALLO: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

if (-not $Token) {
  Write-Host ""
  Write-Host "   AVISO: No se proveo -Token. Las llamadas pueden fallar con 401." -ForegroundColor Yellow
  Write-Host "   Uso: .\test-reporte-intervencion-get.ps1 -Token 'ey...'" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "1. GET sin filtros por grupo..." -ForegroundColor Yellow
$resultados = @{}
foreach ($key in $GRUPO_KEYS) {
  Write-Host "  Grupo: $key" -ForegroundColor Magenta
  $resultados[$key] = Test-GetReportes -GrupoKey $key
}

Write-Host ""
Write-Host "2. GET con filtro id_actividad (primer grupo)..." -ForegroundColor Yellow
$g0 = $GRUPO_KEYS[0]
Test-GetReportes -GrupoKey $g0 -QParams @{ id_actividad = "ACT-2026-0001" } | Out-Null

Write-Host ""
Write-Host "3. Verificar shape { success, total, data[] }..." -ForegroundColor Yellow
try {
  $url  = "$API_URL/grupos/$($GRUPO_KEYS[0])/reportes_intervenciones"
  $resp = Invoke-WebRequest -Uri $url -Method GET -Headers (Get-AuthHeaders) -TimeoutSec 20 -ErrorAction Stop
  $body = $resp.Content | ConvertFrom-Json
  $hasSuccess = $null -ne $body.success
  $hasData    = $null -ne $body.data
  Write-Host "  success: $(if ($hasSuccess) { 'SI' } else { 'NO - PROBLEMA' })" -ForegroundColor $(if ($hasSuccess) { "Green" } else { "Red" })
  Write-Host "  data:    $(if ($hasData)    { 'SI' } else { 'NO - PROBLEMA' })" -ForegroundColor $(if ($hasData)    { "Green" } else { "Red" })
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Host "  No se pudo verificar [$code]" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "===============================" -ForegroundColor Cyan
Write-Host " Resumen" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan
$ok  = ($resultados.Values | Where-Object { $_ -eq $true }).Count
$err = ($resultados.Values | Where-Object { $_ -ne $true }).Count
Write-Host "  OK:   $ok / $($GRUPO_KEYS.Count)" -ForegroundColor $(if ($err -eq 0) { "Green" } else { "Yellow" })
if ($err -gt 0) {
  $failed = ($resultados.GetEnumerator() | Where-Object { $_.Value -ne $true } | ForEach-Object { $_.Key }) -join ", "
  Write-Host "  Fallidos: $failed" -ForegroundColor Red
}
Write-Host ""
