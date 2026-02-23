# Script para verificar las propiedades del GeoJSON

Write-Host "🗺️ Verificando propiedades del GeoJSON de comunas..." -ForegroundColor Cyan
$comunasPath = "frontend/public/cartografia_base/comunas_corregimientos.geojson"

if (Test-Path $comunasPath) {
    $geojson = Get-Content $comunasPath | ConvertFrom-Json
    Write-Host "✅ Archivo encontrado" -ForegroundColor Green
    Write-Host "Total features: $($geojson.features.Count)" -ForegroundColor Yellow
    
    Write-Host "`n📋 Propiedades del primer feature:" -ForegroundColor Cyan
    $firstFeature = $geojson.features[0]
    $firstFeature.properties.PSObject.Properties | ForEach-Object {
        Write-Host "  - $($_.Name): $($_.Value)" -ForegroundColor White
    }
    
    Write-Host "`n📋 Primeros 10 features con todas sus propiedades:" -ForegroundColor Cyan
    $geojson.features[0..9] | ForEach-Object {
        $props = $_.properties
        Write-Host "  Feature:" -ForegroundColor Yellow
        $props.PSObject.Properties | ForEach-Object {
            if ($_.Value) {
                Write-Host "    $($_.Name): $($_.Value)" -ForegroundColor White
            }
        }
    }
}
else {
    Write-Host "❌ Archivo no encontrado: $comunasPath" -ForegroundColor Red
}

Write-Host "`n" -ForegroundColor White
Write-Host "🗺️ Verificando propiedades del GeoJSON de barrios..." -ForegroundColor Cyan
$barriosPath = "frontend/public/cartografia_base/barrios_veredas.geojson"

if (Test-Path $barriosPath) {
    $geojson = Get-Content $barriosPath | ConvertFrom-Json
    Write-Host "✅ Archivo encontrado" -ForegroundColor Green
    Write-Host "Total features: $($geojson.features.Count)" -ForegroundColor Yellow
    
    Write-Host "`n📋 Propiedades del primer feature:" -ForegroundColor Cyan
    $firstFeature = $geojson.features[0]
    $firstFeature.properties.PSObject.Properties | ForEach-Object {
        Write-Host "  - $($_.Name): $($_.Value)" -ForegroundColor White
    }
    
    Write-Host "`n📋 Primeros 5 features con todas sus propiedades:" -ForegroundColor Cyan
    $geojson.features[0..4] | ForEach-Object {
        $props = $_.properties
        Write-Host "  Feature:" -ForegroundColor Yellow
        $props.PSObject.Properties | ForEach-Object {
            if ($_.Value) {
                Write-Host "    $($_.Name): $($_.Value)" -ForegroundColor White
            }
        }
    }
}
else {
    Write-Host "❌ Archivo no encontrado: $barriosPath" -ForegroundColor Red
}
