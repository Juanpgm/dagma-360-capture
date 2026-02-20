param(
    [Parameter(Mandatory = $true)]
    [string]$ServiceAccountJsonPath
)

if (-not (Test-Path $ServiceAccountJsonPath)) {
    Write-Error "No existe el archivo: $ServiceAccountJsonPath"
    exit 1
}

$envFilePath = Join-Path $PSScriptRoot ".env.local"

try {
    $jsonRaw = Get-Content $ServiceAccountJsonPath -Raw
    $jsonOneLine = ($jsonRaw | ConvertFrom-Json | ConvertTo-Json -Compress)
    $envLine = "FIREBASE_SERVICE_ACCOUNT_JSON=$jsonOneLine"

    if (-not (Test-Path $envFilePath)) {
        New-Item -Path $envFilePath -ItemType File -Force | Out-Null
    }

    $existingContent = Get-Content $envFilePath -Raw

    if ($existingContent -match "(?m)^FIREBASE_SERVICE_ACCOUNT_JSON=") {
        $updated = [regex]::Replace(
            $existingContent,
            "(?m)^FIREBASE_SERVICE_ACCOUNT_JSON=.*$",
            [System.Text.RegularExpressions.MatchEvaluator] { param($m) $envLine }
        )
        Set-Content -Path $envFilePath -Value $updated -NoNewline
    }
    else {
        if ($existingContent.Trim().Length -gt 0 -and -not $existingContent.EndsWith("`n")) {
            Add-Content -Path $envFilePath -Value ""
        }
        Add-Content -Path $envFilePath -Value $envLine
    }

    Write-Host "✅ Variable FIREBASE_SERVICE_ACCOUNT_JSON actualizada en $envFilePath"
}
catch {
    Write-Error "Error procesando credenciales: $($_.Exception.Message)"
    exit 1
}
