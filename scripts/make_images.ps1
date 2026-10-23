param([string]$OutDir)
Add-Type -AssemblyName System.Drawing

function New-Brush([string]$hex) { return New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($hex)) }
function RoundRect([System.Drawing.Graphics]$g, $brush, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure(); $g.FillPath($brush, $p); $p.Dispose()
}
$fontName = 'Yu Gothic UI'
$installed = (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }
if (-not ($installed -contains $fontName)) { $fontName = 'Meiryo' }

# ---- OGP 1200x630 ----
$bmp = New-Object System.Drawing.Bitmap 1200, 630
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.InterpolationMode = 'HighQualityBicubic'
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#f5f6f3'))
$teal = New-Brush '#0f4c5c'; $ink = New-Brush '#18242a'; $muted = New-Brush '#5a6870'; $white = New-Brush '#ffffff'; $line = New-Brush '#dfe3df'
$g.FillRectangle($teal, 0, 0, 1200, 14)

$fTitle = New-Object System.Drawing.Font($fontName, 96, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fSub = New-Object System.Drawing.Font($fontName, 36, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fSmall = New-Object System.Drawing.Font($fontName, 28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$fKey = New-Object System.Drawing.Font($fontName, 30, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fRow = New-Object System.Drawing.Font($fontName, 26, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fRowS = New-Object System.Drawing.Font($fontName, 21, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

$g.DrawString('入札ノート', $fTitle, $ink, 62, 92)
$g.DrawString('国・自治体の入札公告と', $fSub, $muted, 70, 240)
$g.DrawString('国の落札結果を、会社ごとに無料で', $fSub, $muted, 70, 290)
RoundRect $g (New-Brush '#d8ece1') 70 376 380 56 28
$g.DrawString('無料・登録なし・毎日更新', $fKey, (New-Brush '#1d7a4f'), 92, 386)
$g.DrawString('micoficial.github.io/nyusatsu-note', $fSmall, $muted, 72, 540)

# notice list illustration
RoundRect $g $line 736 70 404 492 26
RoundRect $g $white 732 64 404 492 26
$g.DrawString('締切が近い公告', $fKey, $ink, 768, 92)
$g.FillRectangle($ink, 768, 140, 332, 3)
$rows = @(@('あと2日', '#c0392b', '道路舗装補修工事'), @('あと5日', '#1d7a4f', '庁舎清掃業務委託'), @('あと9日', '#1d7a4f', 'ノートパソコンの購入'), @('落札', '#0f4c5c', '会社ごとの落札額'))
$y = 162
foreach ($r in $rows) {
  RoundRect $g (New-Brush $r[1]) 768 ($y + 14) 104 36 8
  $sf = New-Object System.Drawing.StringFormat; $sf.Alignment = 'Center'; $sf.LineAlignment = 'Center'
  $g.DrawString($r[0], $fRowS, $white, (New-Object System.Drawing.RectangleF(768, ($y + 14), 104, 36)), $sf)
  $g.DrawString($r[2], $fRow, $ink, 884, ($y + 16))
  $g.FillRectangle($line, 768, ($y + 80), 332, 2)
  $y += 92
}
$bmp.Save((Join-Path $OutDir 'og.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()

# ---- アイコン 180x180 ----
$s = 180
$bmp = New-Object System.Drawing.Bitmap $s, $s
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#0f4c5c'))
$k = $s / 64
RoundRect $g $white (14 * $k) (11 * $k) (36 * $k) (44 * $k) (5 * $k)
RoundRect $g (New-Brush '#0f4c5c') (20 * $k) (19 * $k) (24 * $k) (4 * $k) (2 * $k)
RoundRect $g (New-Brush '#9bb8c0') (20 * $k) (28 * $k) (24 * $k) (4 * $k) (2 * $k)
RoundRect $g (New-Brush '#9bb8c0') (20 * $k) (37 * $k) (15 * $k) (4 * $k) (2 * $k)
$g.FillEllipse((New-Brush '#f2b45a'), (35 * $k), (37 * $k), (20 * $k), (20 * $k))
$pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#0f4c5c')), (3 * $k)
$pen.StartCap = 'Round'; $pen.EndCap = 'Round'; $pen.LineJoin = 'Round'
$g.DrawLines($pen, [System.Drawing.PointF[]]@((New-Object System.Drawing.PointF((40.5 * $k), (47.2 * $k))), (New-Object System.Drawing.PointF((43.7 * $k), (50.4 * $k))), (New-Object System.Drawing.PointF((49.7 * $k), (44 * $k)))))
$bmp.Save((Join-Path $OutDir 'icon-180.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
"font=$fontName"
