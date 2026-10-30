<#
  Copilot Feature-dle - app icon generator (System.Drawing, no extra tools needed)
  Draws Pip on Engage Squared blue at the sizes a PWA needs. Re-run after changing the design:
    powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1
#>
Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot '..\assets\icons'
New-Item -ItemType Directory -Force -Path $out | Out-Null
function C($hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }

function Draw-Icon([int]$size, [bool]$maskable, [string]$file) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'; $g.Clear([System.Drawing.Color]::Transparent)

  # background: rounded square (any) or full bleed (maskable / apple touch)
  $bg = New-Object System.Drawing.Drawing2D.GraphicsPath
  if ($maskable) { $bg.AddRectangle((New-Object System.Drawing.RectangleF 0, 0, $size, $size)) }
  else {
    $r = $size * 28 / 128 * 2
    $bg.AddArc(0, 0, $r, $r, 180, 90); $bg.AddArc($size - $r, 0, $r, $r, 270, 90)
    $bg.AddArc($size - $r, $size - $r, $r, $r, 0, 90); $bg.AddArc(0, $size - $r, $r, $r, 90, 90); $bg.CloseFigure()
  }
  $g.FillPath((New-Object System.Drawing.SolidBrush (C '#165AF1')), $bg)

  # content scale: maskable keeps everything inside the central safe zone
  $k = if ($maskable) { $size / 128 * 0.74 } else { $size / 128 }
  $off = if ($maskable) { ($size - 128 * $k) / 2 } else { 0 }
  $g.TranslateTransform($off, $off); $g.ScaleTransform($k, $k)

  # body (arch)
  $body = New-Object System.Drawing.Drawing2D.GraphicsPath
  $body.AddArc(34, 32, 60, 60, 180, 180)
  $body.AddLine(94, 62, 94, 108)
  $body.AddArc(82, 102, 12, 12, 0, 90)
  $body.AddLine(88, 114, 40, 114)
  $body.AddArc(34, 102, 12, 12, 90, 90)
  $body.CloseFigure()
  $g.FillPath([System.Drawing.Brushes]::White, $body)

  # face pill
  $face = New-Object System.Drawing.Drawing2D.GraphicsPath
  $face.AddArc(42, 58, 34, 34, 90, 180); $face.AddArc(52, 58, 34, 34, 270, 180); $face.CloseFigure()
  $g.FillPath((New-Object System.Drawing.SolidBrush (C '#E8EEFE')), $face)

  # eyes + smile
  $navy = New-Object System.Drawing.SolidBrush (C '#12134B')
  $g.FillEllipse($navy, 51, 69, 8, 8); $g.FillEllipse($navy, 69, 69, 8, 8)
  $pen = New-Object System.Drawing.Pen (C '#12134B'), 3; $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
  $g.DrawCurve($pen, [System.Drawing.PointF[]]@((New-Object System.Drawing.PointF 57, 82), (New-Object System.Drawing.PointF 64, 87), (New-Object System.Drawing.PointF 71, 82)), 0.8)

  # bracket ears
  $ear = New-Object System.Drawing.Pen (C '#F3B029'), 6; $ear.StartCap = 'Round'; $ear.EndCap = 'Round'; $ear.LineJoin = 'Round'
  $g.DrawLines($ear, [System.Drawing.PointF[]]@((New-Object System.Drawing.PointF 30, 44), (New-Object System.Drawing.PointF 20, 54), (New-Object System.Drawing.PointF 30, 64)))
  $g.DrawLines($ear, [System.Drawing.PointF[]]@((New-Object System.Drawing.PointF 98, 44), (New-Object System.Drawing.PointF 108, 54), (New-Object System.Drawing.PointF 98, 64)))

  # sparkle
  $sp = [System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF 96, 20), (New-Object System.Drawing.PointF 99, 28), (New-Object System.Drawing.PointF 107, 31), (New-Object System.Drawing.PointF 99, 34),
    (New-Object System.Drawing.PointF 96, 42), (New-Object System.Drawing.PointF 93, 34), (New-Object System.Drawing.PointF 85, 31), (New-Object System.Drawing.PointF 93, 28))
  $g.FillPolygon((New-Object System.Drawing.SolidBrush (C '#F3B029')), $sp)

  $g.Dispose()
  $bmp.Save((Join-Path $out $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  "wrote $file ($size px)"
}

Draw-Icon 192 $false 'icon-192.png'
Draw-Icon 512 $false 'icon-512.png'
Draw-Icon 512 $true  'icon-maskable-512.png'
Draw-Icon 180 $true  'apple-touch-icon.png'
Draw-Icon 48  $false 'favicon-48.png'
