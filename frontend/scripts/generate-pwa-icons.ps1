# Genera el set de iconos PWA para DAGMA 360.
# Paleta: verde #059669 sobre blanco. Tipografia Arial Bold.
param(
    [string]$OutDir = (Join-Path $PSScriptRoot '..\public')
)

Add-Type -AssemblyName System.Drawing

$OutDir = (Resolve-Path $OutDir).Path
Write-Host "Generando iconos PWA en: $OutDir"

$Green = [System.Drawing.ColorTranslator]::FromHtml('#059669')
$White = [System.Drawing.Color]::White

function New-DagmaIcon([int]$Size, [string]$Path, [bool]$Maskable)
{
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    $g.Clear($Green)

    $safe = if ($Maskable) { [int]($Size * 0.78) } else { [int]($Size * 0.88) }
    $offset = [int](($Size - $safe) / 2)

    $dagmaSize    = [single]($safe * 0.26)
    $dagmaFont    = New-Object System.Drawing.Font 'Arial', $dagmaSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $dagmaText    = 'DAGMA'
    $dagmaMeasure = $g.MeasureString($dagmaText, $dagmaFont)
    $dagmaX       = ($Size - $dagmaMeasure.Width) / 2
    $dagmaY       = $offset + ($safe * 0.18)
    $whiteBrush   = New-Object System.Drawing.SolidBrush $White
    $g.DrawString($dagmaText, $dagmaFont, $whiteBrush, $dagmaX, $dagmaY)

    $bigSize    = [single]($safe * 0.46)
    $bigFont    = New-Object System.Drawing.Font 'Arial', $bigSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $bigText    = '360'
    $bigMeasure = $g.MeasureString($bigText, $bigFont)
    $bigX       = ($Size - $bigMeasure.Width) / 2
    $bigY       = $dagmaY + $dagmaMeasure.Height - ($safe * 0.04)
    $g.DrawString($bigText, $bigFont, $whiteBrush, $bigX, $bigY)

    $lineY     = $dagmaY + $dagmaMeasure.Height * 0.92
    $lineColor = [System.Drawing.Color]::FromArgb(220, 255, 255, 255)
    $linePen   = New-Object System.Drawing.Pen $lineColor, ([single]($safe * 0.012))
    $lineW     = $dagmaMeasure.Width * 0.55
    $lineX1    = ($Size - $lineW) / 2
    $g.DrawLine($linePen, [single]$lineX1, [single]$lineY, [single]($lineX1 + $lineW), [single]$lineY)

    $dagmaFont.Dispose()
    $bigFont.Dispose()
    $whiteBrush.Dispose()
    $linePen.Dispose()
    $g.Dispose()

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "  OK $Path"
}

New-DagmaIcon 192 (Join-Path $OutDir 'pwa-192x192.png') $false
New-DagmaIcon 512 (Join-Path $OutDir 'pwa-512x512.png') $false
New-DagmaIcon 512 (Join-Path $OutDir 'pwa-maskable-512x512.png') $true
New-DagmaIcon 180 (Join-Path $OutDir 'apple-touch-icon.png') $false
New-DagmaIcon 32  (Join-Path $OutDir 'favicon-32.png') $false

$svg = @'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" ry="22" fill="black"/>
  <text x="50" y="38" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="18" fill="white">DAGMA</text>
  <line x1="28" y1="44" x2="72" y2="44" stroke="white" stroke-width="1.5"/>
  <text x="50" y="80" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="36" fill="white">360</text>
</svg>
'@
Set-Content -Path (Join-Path $OutDir 'masked-icon.svg') -Value $svg -Encoding UTF8
Write-Host "  OK masked-icon.svg"
Write-Host "Iconos generados."
