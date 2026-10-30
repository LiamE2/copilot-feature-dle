<#
  Copilot Feature-dle - tiny local web server (no Node or Python needed)

  Usage (from the copilot-feature-dle folder):
    powershell -ExecutionPolicy Bypass -File tools\serve.ps1                # http://localhost:8080
    powershell -ExecutionPolicy Bypass -File tools\serve.ps1 -Port 9000 -Open
    powershell -ExecutionPolicy Bypass -File tools\serve.ps1 -Lan           # let phones on your Wi-Fi join (run as administrator)

  Serving over http(s) switches on the PWA features (offline play, install-to-home-screen).
  It also exposes a small shared leaderboard at /api/leaderboard so a room full of phones can compete live:
  set  leaderboard: { endpoint: 'api/leaderboard', eventCode: 'MYEVENT' }  in js/05-config.js.
#>
param(
  [int]$Port = 8080,
  [string]$Root = (Join-Path $PSScriptRoot '..'),
  [switch]$Lan,
  [switch]$Open
)

$Root = [System.IO.Path]::GetFullPath((Resolve-Path $Root).Path)
$rootDir = $Root.TrimEnd('\') + '\'
$prefix = if ($Lan) { "http://+:$Port/" } else { "http://localhost:$Port/" }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try { $listener.Start() }
catch {
  Write-Host "Could not listen on $prefix : $($_.Exception.Message)" -ForegroundColor Red
  if ($Lan) { Write-Host "For -Lan, run PowerShell as administrator (or: netsh http add urlacl url=$prefix user=Everyone)." -ForegroundColor Yellow }
  exit 1
}

$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.png' = 'image/png'; '.svg' = 'image/svg+xml'; '.woff2' = 'font/woff2'; '.ico' = 'image/x-icon'; '.txt' = 'text/plain; charset=utf-8'
}

# ---- tiny event leaderboard store (kept in memory, saved next to this script) ----
$boardFile = Join-Path $PSScriptRoot 'leaderboard-data.json'
$board = @{}
if (Test-Path -LiteralPath $boardFile) {
  try {
    $raw = Get-Content -LiteralPath $boardFile -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($ev in $raw.PSObject.Properties) {
      $board[$ev.Name] = @{}
      foreach ($pl in $ev.Value.PSObject.Properties) { $board[$ev.Name][$pl.Name] = $pl.Value }
    }
  } catch { Write-Host 'Could not read existing leaderboard data, starting fresh.' -ForegroundColor Yellow }
}
function Save-Board { ($board | ConvertTo-Json -Depth 8) | Set-Content -LiteralPath $boardFile -Encoding UTF8 }

function Send-Bytes($res, [int]$status, [byte[]]$bytes, [string]$type) {
  $res.StatusCode = $status
  $res.ContentType = $type
  $res.Headers.Add('Cache-Control', 'no-cache')
  $res.Headers.Add('X-Content-Type-Options', 'nosniff')
  $res.Headers.Add('Referrer-Policy', 'no-referrer')
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}
function Send-Text($res, [int]$status, [string]$text, [string]$type = 'text/plain; charset=utf-8') { Send-Bytes $res $status ([Text.Encoding]::UTF8.GetBytes($text)) $type }

# ---- input hygiene for the shared board: it is an honour-system leaderboard, so keep it small, tidy and bounded ----
$allowedColors = 'blue', 'red', 'purple', 'orange', 'green', 'pink', 'yellow', 'navy'
$maxBody = 8KB; $maxEvents = 50; $maxPlayersPerEvent = 500
function Clean-Id([string]$s, [int]$max) { $c = $s -replace '[^A-Za-z0-9_-]', ''; if ($c.Length -gt $max) { $c.Substring(0, $max) } else { $c } }
function Clean-Name([string]$s) { $c = ($s -replace '[\x00-\x1F\x7F<>]', '').Trim(); if ($c.Length -gt 24) { $c.Substring(0, 24) } else { $c } }
function Clamp-Int($v, [int]$min, [int]$max) {
  $n = [double]0
  if (-not [double]::TryParse([string]$v, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$n) -or [double]::IsNaN($n)) { return $min }
  [int][Math]::Max([double]$min, [Math]::Min([double]$max, [Math]::Round($n)))
}

Write-Host "Copilot Feature-dle is being served from $Root" -ForegroundColor Cyan
Write-Host "  -> $prefix  (Ctrl+C to stop)" -ForegroundColor Cyan
if ($Lan) {
  $ips = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) | Where-Object { $_.AddressFamily -eq 'InterNetwork' }
  foreach ($ip in $ips) { Write-Host "  -> http://$($ip.IPAddressToString):$Port/  (share this with the room)" -ForegroundColor Green }
}
if ($Open) { Start-Process "http://localhost:$Port/" }

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $res = $ctx.Response
    try {
      $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))

      if ($rel -eq 'api/leaderboard') {
        if ($req.HttpMethod -eq 'POST') {
          if ($req.ContentLength64 -gt $maxBody) { Send-Text $res 413 'Too large'; continue }
          $reader = New-Object System.IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
          $b = $null
          try { $b = $reader.ReadToEnd() | ConvertFrom-Json } catch { }
          $code = if ($b) { Clean-Id ([string]$b.eventCode) 40 } else { '' }
          $playerId = if ($b) { Clean-Id ([string]$b.playerId) 64 } else { '' }
          if (-not $code -or -not $playerId) { Send-Text $res 400 'Bad request'; continue }
          if (-not $board.ContainsKey($code)) {
            if ($board.Count -ge $maxEvents) { Send-Text $res 429 'Too many events'; continue }
            $board[$code] = @{}
          }
          if (-not $board[$code].ContainsKey($playerId) -and $board[$code].Count -ge $maxPlayersPerEvent) { Send-Text $res 429 'Event is full'; continue }
          $date = if ([string]$b.date -match '^\d{4}-\d{2}-\d{2}$') { [string]$b.date } else { '' }
          $today = $null
          if ($b.today) { $today = [pscustomobject]@{ score = Clamp-Int $b.today.score 0 2000; hints = Clamp-Int $b.today.hints 0 5; timeMs = Clamp-Int $b.today.timeMs 0 86400000; won = [bool]$b.today.won; date = $date } }
          $board[$code][$playerId] = [pscustomobject]@{
            name = Clean-Name ([string]$b.name); color = $(if ($allowedColors -contains [string]$b.color) { [string]$b.color } else { 'blue' }); today = $today
            maxStreak = Clamp-Int $b.maxStreak 0 10000; totalScore = Clamp-Int $b.totalScore 0 10000000; bestScore = Clamp-Int $b.bestScore 0 2000; played = Clamp-Int $b.played 0 100000
          }
          Save-Board
          Send-Text $res 200 '{"ok":true}' 'application/json; charset=utf-8'
        } else {
          $code = Clean-Id ([string]$req.QueryString['eventCode']) 40; $date = [string]$req.QueryString['date']
          $players = @()
          if ($board.ContainsKey($code)) {
            foreach ($k in $board[$code].Keys) {
              $p = $board[$code][$k]
              $today = if ($p.today -and $p.today.date -eq $date) { $p.today } else { $null }
              $players += [pscustomobject]@{ playerId = $k; name = $p.name; color = $p.color; today = $today; maxStreak = $p.maxStreak; totalScore = $p.totalScore; bestScore = $p.bestScore; played = $p.played }
            }
          }
          Send-Text $res 200 (@{ players = $players } | ConvertTo-Json -Depth 6 -Compress) 'application/json; charset=utf-8'
        }
        continue
      }

      if ([string]::IsNullOrEmpty($rel)) { $rel = 'index.html' }
      $full = [System.IO.Path]::GetFullPath((Join-Path $Root $rel))
      if (Test-Path -LiteralPath $full -PathType Container) { $full = Join-Path $full 'index.html' }   # a folder URL opens its index.html, like GitHub Pages
      $inside = $full.StartsWith($rootDir, [StringComparison]::OrdinalIgnoreCase)
      $shown = if ($inside) { $full.Substring($rootDir.Length) } else { '' }
      # only the game itself is served: never the tools folder, dotfiles, scripts or anything outside the root
      $hidden = (-not $inside) -or ($shown -match '^(tools)(\\|$)') -or ($shown -match '(^|\\)\.') -or ($shown -match '\.(ps1|bak|log)$')
      if ($hidden -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
        Send-Text $res 404 'Not found'
      } else {
        $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
        $type = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        Send-Bytes $res 200 ([System.IO.File]::ReadAllBytes($full)) $type
      }
    } catch {
      try { Send-Text $res 500 'Server error' } catch { }
    } finally {
      try { $res.OutputStream.Close() } catch { }
    }
  }
} finally {
  $listener.Stop()
}
