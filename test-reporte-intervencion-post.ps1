# Test: POST /grupos/{grupo_key}/reporte_intervencion
# Uso: .\test-reporte-intervencion-post.ps1 -Token "ey..." [-GrupoFiltro gobernanza]

param(
  [string]$Token = "",
  [string]$GrupoFiltro = ""
)

$API_URL = "https://web-production-2d737.up.railway.app"

if (-not $Token) { $Token = $env:DAGMA_API_TOKEN }

if (-not $Token) {
  Write-Host "FALLO: Se requiere un token Bearer." -ForegroundColor Red
  Write-Host "Uso: .\test-reporte-intervencion-post.ps1 -Token 'ey...'" -ForegroundColor Yellow
  Write-Host "O establezca la variable de entorno DAGMA_API_TOKEN" -ForegroundColor Yellow
  exit 1
}

# Crear JPEG 1x1 minimo valido en disco
$tempJpeg = [System.IO.Path]::GetTempFileName() -replace '\.tmp$', '.jpg'
$jpegBytes = [byte[]](
  0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,0x01,0x00,0x00,0x01,
  0x00,0x01,0x00,0x00,0xFF,0xDB,0x00,0x43,0x00,0x08,0x06,0x06,0x07,0x06,0x05,0x08,
  0x07,0x07,0x07,0x09,0x09,0x08,0x0A,0x0C,0x14,0x0D,0x0C,0x0B,0x0B,0x0C,0x19,0x12,
  0x13,0x0F,0x14,0x1D,0x1A,0x1F,0x1E,0x1D,0x1A,0x1C,0x1C,0x20,0x24,0x2E,0x27,0x20,
  0x22,0x2C,0x23,0x1C,0x1C,0x28,0x37,0x29,0x2C,0x30,0x31,0x34,0x34,0x34,0x1F,0x27,
  0x39,0x3D,0x38,0x32,0x3C,0x2E,0x33,0x34,0x32,0xFF,0xC0,0x00,0x0B,0x08,0x00,0x01,
  0x00,0x01,0x01,0x01,0x11,0x00,0xFF,0xC4,0x00,0x1F,0x00,0x00,0x01,0x05,0x01,0x01,
  0x01,0x01,0x01,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x02,0x03,0x04,
  0x05,0x06,0x07,0x08,0x09,0x0A,0x0B,0xFF,0xDA,0x00,0x08,0x01,0x01,0x00,0x00,0x3F,
  0x00,0xFB,0xD7,0xFF,0xD9
)
[System.IO.File]::WriteAllBytes($tempJpeg, $jpegBytes)

# Datos de prueba por grupo
$GRUPO_DATA = @{
  cuadrilla  = @{ tipo = "Poda de arboles";             desc = "Prueba POST cuadrilla";   extra_key = "arboles_data";       extra_val = '[{"especie":"Ceiba","cantidad":2}]' }
  vivero     = @{ tipo = "Siembra sitio definitivo";    desc = "Prueba POST vivero";       extra_key = "tipos_plantas";      extra_val = '{"Guayacan":3,"Ceiba":2}' }
  gobernanza = @{ tipo = "Jornada sensibilizacion";     desc = "Prueba POST gobernanza";   extra_key = "unidades_impactadas"; extra_val = "15" }
  ecosistemas= @{ tipo = "Restauracion ecologica";      desc = "Prueba POST ecosistemas";  extra_key = "unidades_impactadas"; extra_val = "200"; extra2_key = "unidad_medida"; extra2_val = "m2" }
  umata      = @{ tipo = "Visita tecnica predial";      desc = "Prueba POST umata";        extra_key = "unidades_impactadas"; extra_val = "4" }
}

function Invoke-PostReporte {
  param([string]$GrupoKey, [hashtable]$Cfg)

  $url      = "$API_URL/grupos/$GrupoKey/reporte_intervencion"
  $boundary = "boundary_" + [System.Guid]::NewGuid().ToString("N")
  $CRLF     = "`r`n"
  $enc      = [System.Text.Encoding]::UTF8

  function Get-FieldBytes([string]$Name, [string]$Value) {
    return $enc.GetBytes("--$boundary$CRLF" +
      "Content-Disposition: form-data; name=`"$Name`"$CRLF$CRLF" +
      "$Value$CRLF")
  }

  $buf = New-Object System.Collections.Generic.List[byte]

  # Campos comunes
  $buf.AddRange((Get-FieldBytes "tipo_intervencion"       $Cfg.tipo))
  $buf.AddRange((Get-FieldBytes "descripcion_intervencion" $Cfg.desc))
  $buf.AddRange((Get-FieldBytes "direccion"               "Cra 1 No 1-01, Cali"))
  $buf.AddRange((Get-FieldBytes "grupo"                   $GrupoKey))
  $buf.AddRange((Get-FieldBytes "id_actividad"            "ACT-TEST-0001"))
  $buf.AddRange((Get-FieldBytes "observaciones"           "Registro de prueba automatizado"))
  $buf.AddRange((Get-FieldBytes "registrado_por"          "Script de prueba"))
  $buf.AddRange((Get-FieldBytes "coordinates_type"        "Point"))
  $buf.AddRange((Get-FieldBytes "coordinates_data"        "[-76.5225,3.4516]"))

  # Campo especifico del grupo
  if ($Cfg.extra_key) { $buf.AddRange((Get-FieldBytes $Cfg.extra_key $Cfg.extra_val)) }
  if ($Cfg.extra2_key){ $buf.AddRange((Get-FieldBytes $Cfg.extra2_key $Cfg.extra2_val)) }

  # Foto 1
  $photoHeader = $enc.GetBytes("--$boundary$CRLF" +
    "Content-Disposition: form-data; name=`"photos`"; filename=`"test_photo.jpg`"$CRLF" +
    "Content-Type: image/jpeg$CRLF$CRLF")
  $photoBytes = [System.IO.File]::ReadAllBytes($tempJpeg)

  $buf.AddRange($photoHeader)
  $buf.AddRange($photoBytes)
  $buf.AddRange($enc.GetBytes($CRLF))

  # Foto 2 (workaround Pydantic v2 — enviar dos veces cuando hay una sola foto)
  $buf.AddRange($photoHeader)
  $buf.AddRange($photoBytes)
  $buf.AddRange($enc.GetBytes($CRLF))

  # Cierre
  $buf.AddRange($enc.GetBytes("--$boundary--$CRLF"))

  Write-Host "  -> POST $url" -ForegroundColor Gray
  try {
    $resp = Invoke-WebRequest `
      -Uri $url `
      -Method POST `
      -Headers @{ "Authorization" = "Bearer $Token"; "Accept" = "application/json" } `
      -ContentType "multipart/form-data; boundary=$boundary" `
      -Body $buf.ToArray() `
      -TimeoutSec 30 `
      -ErrorAction Stop

    $body = $resp.Content | ConvertFrom-Json
    if ($body.success -eq $true) {
      Write-Host "    [OK] HTTP $($resp.StatusCode) | id=$($body.id) | fotos=$($body.photos_uploaded)" -ForegroundColor Green
    } else {
      Write-Host "    [WARN] HTTP $($resp.StatusCode) | success=false | msg=$($body.message)" -ForegroundColor Yellow
    }
    return $true
  }
  catch {
    $code = $_.Exception.Response.StatusCode.value__
    $detail = ""
    try {
      $stream  = $_.Exception.Response.GetResponseStream()
      $reader  = New-Object System.IO.StreamReader($stream)
      $errBody = $reader.ReadToEnd()
      $reader.Close()
      $errJson = $errBody | ConvertFrom-Json -ErrorAction SilentlyContinue
      $detail  = if ($errJson.detail) { " | detail=$($errJson.detail)" } else { " | $errBody" }
    } catch {}
    Write-Host "    [$code] Error$detail" -ForegroundColor Red
    return $false
  }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host " POST reporte_intervencion por grupo  " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "0. Health check..." -ForegroundColor Yellow
try {
  $null = Invoke-RestMethod -Uri "$API_URL/health" -Method GET -TimeoutSec 10
  Write-Host "   OK: API disponible" -ForegroundColor Green
} catch {
  Write-Host "   FALLO: $($_.Exception.Message)" -ForegroundColor Red
  Remove-Item $tempJpeg -Force -ErrorAction SilentlyContinue
  exit 1
}

$GRUPO_KEYS = $GRUPO_DATA.Keys | Sort-Object
if ($GrupoFiltro -and $GRUPO_DATA.ContainsKey($GrupoFiltro)) {
  $GRUPO_KEYS = @($GrupoFiltro)
}

Write-Host ""
Write-Host "1. Registrar reporte por grupo..." -ForegroundColor Yellow
$resultados = @{}
foreach ($key in $GRUPO_KEYS) {
  Write-Host "  Grupo: $key" -ForegroundColor Magenta
  $resultados[$key] = Invoke-PostReporte -GrupoKey $key -Cfg $GRUPO_DATA[$key]
}

Remove-Item $tempJpeg -Force -ErrorAction SilentlyContinue

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
