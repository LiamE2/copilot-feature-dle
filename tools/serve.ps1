<#
  Copilot Feature-dle - tiny local web server (no Node or Python needed)

  Usage (from the copilot-feature-dle folder):
    powershell -ExecutionPolicy Bypass -File tools\serve.ps1                # http://localhost:8080
    powershell -ExecutionPolicy Bypass -File tools\serve.ps1 -Port 9000 -Open
    powershell -ExecutionPolicy Bypass -File tools\serve.ps1 -Lan           # let phones on your Wi-Fi join (run as administrator)

  Serving over http(s) switches on the PWA features (offline play, install-to-home-screen).
  It also exposes a small shared leaderboard at /api/leaderboard so a room full of phones can compete live:
  set  leaderboard: { endpoint: 'api/leaderboard', eventCode: 'MYEVENT' }  in js/05-config.js.

  -MockAuth switches on a pretend Microsoft identity provider at /mock-idp, so you can try (and test) the whole "Sign in with Microsoft" flow
  without registering an app. In js/05-config.js (or in the browser console) set  auth: { clientId: 'test', authority: 'http://localhost:8080/mock-idp/organizations' }.
  It only runs on this computer (it refuses -Lan) and signs in made-up people. Never use it on a real site.
#>
param(
  [int]$Port = 8080,
  [string]$Root = (Join-Path $PSScriptRoot '..'),
  [switch]$Lan,
  [switch]$Open,
  [switch]$MockAuth
)

if ($MockAuth -and $Lan) { Write-Host '-MockAuth is only for this computer, so it cannot be combined with -Lan.' -ForegroundColor Red; exit 1 }

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

# ---- optional pretend Microsoft identity provider (-MockAuth): the authorization-code + PKCE flow, with made-up people and unsigned tokens ----
if ($MockAuth) { Add-Type -AssemblyName System.Web }
function B64U([byte[]]$b) { [Convert]::ToBase64String($b).TrimEnd('=').Replace('+', '-').Replace('/', '_') }
function UnB64U([string]$s) { $p = $s.Replace('-', '+').Replace('_', '/'); switch ($p.Length % 4) { 2 { $p += '==' } 3 { $p += '=' } }; [Convert]::FromBase64String($p) }
$mockTenant = '9b2f4c6e-3a1d-4e7b-8f10-5d6a7b8c9d0e'
$mockUsers = [ordered]@{
  alex   = @{ name = 'Alex Morgan'; upn = 'alex.morgan@contoso.test'; oid = '3f2a1c5e-8b7d-4c6a-9e10-1a2b3c4d5e6f' }
  priya  = @{ name = 'Sharma, Priya'; upn = 'priya.sharma@contoso.test'; oid = '7c1d9e2b-5a4f-4b3c-8d6e-0f1a2b3c4d5e' }
  jordan = @{ name = 'Jordan Lee (Contractor)'; upn = 'jordan.lee@fabrikam.test'; oid = 'a4b5c6d7-e8f9-4a0b-9c1d-2e3f4a5b6c7d' }
}

Write-Host "Copilot Feature-dle is being served from $Root" -ForegroundColor Cyan
Write-Host "  -> $prefix  (Ctrl+C to stop)" -ForegroundColor Cyan
if ($MockAuth) { Write-Host '  -> Mock Microsoft sign-in is ON at /mock-idp (pretend people, for testing only)' -ForegroundColor Yellow }
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

      if ($MockAuth -and $rel -match '^mock-idp/[^/]+/oauth2/v2\.0/(authorize|token)$') {
        $origin = $req.Url.Scheme + '://' + $req.Url.Authority
        if ($Matches[1] -eq 'authorize') {
          # the sign-in page: pick a made-up person (or cancel) and the browser is sent back to the app with a one-time code
          $q = $req.QueryString
          $redirect = [string]$q['redirect_uri']; $state = [string]$q['state']; $nonce = [string]$q['nonce']; $challenge = [string]$q['code_challenge']; $client = [string]$q['client_id']
          $sameOrigin = $false; try { $u = [Uri]$redirect; $sameOrigin = ($u.Scheme + '://' + $u.Authority) -eq $origin } catch { }
          if (-not $sameOrigin -or -not $client -or -not $state -or -not $nonce -or -not $challenge -or [string]$q['code_challenge_method'] -ne 'S256' -or [string]$q['response_type'] -ne 'code') {
            Send-Text $res 400 'Mock sign-in: the request is missing something, or it points somewhere other than this server.'; continue
          }
          $links = foreach ($k in $mockUsers.Keys) {
            $payload = ([ordered]@{ n = $nonce; c = $challenge; u = $k; r = $redirect; a = $client; exp = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + 300) } | ConvertTo-Json -Compress)
            $href = $redirect + '#code=' + (B64U ([Text.Encoding]::UTF8.GetBytes($payload))) + '&state=' + [Uri]::EscapeDataString($state)
            '<li><a class="who" id="user-' + $k + '" href="' + [Net.WebUtility]::HtmlEncode($href) + '"><strong>' + [Net.WebUtility]::HtmlEncode($mockUsers[$k].name) + '</strong><span>' + [Net.WebUtility]::HtmlEncode($mockUsers[$k].upn) + '</span></a></li>'
          }
          $cancel = $redirect + '#error=access_denied&error_description=' + [Uri]::EscapeDataString('AADSTS65004: The user declined to consent to access the app. (mock)') + '&state=' + [Uri]::EscapeDataString($state)
          $page = '<!doctype html><html lang="en"><meta charset="utf-8"><title>Mock Microsoft sign-in</title><style>body{font:16px/1.5 "Segoe UI",sans-serif;max-width:30rem;margin:3rem auto;padding:0 1rem}h1{font-size:1.4rem}.tag{background:#fff3cd;padding:.4rem .7rem;border-radius:6px;font-size:.9rem}ul{list-style:none;padding:0}a.who{display:block;padding:.7rem 1rem;margin:.5rem 0;border:1px solid #8c8c8c;border-radius:6px;text-decoration:none;color:#1b1b1b}a.who:hover{background:#f3f3f3}a.who span{display:block;font-size:.85rem;color:#5e5e5e}</style><body><p class="tag">Mock sign-in for testing. Not Microsoft.</p><h1>Pick an account</h1><ul>' + ($links -join '') + '</ul><p><a id="cancel" href="' + [Net.WebUtility]::HtmlEncode($cancel) + '">Cancel</a></p></body></html>'
          Send-Text $res 200 $page 'text/html; charset=utf-8'
        } else {
          # the token endpoint: trades the code (and the PKCE verifier) for an ID token
          if ($req.HttpMethod -ne 'POST') { Send-Text $res 405 'POST only'; continue }
          $bodyText = (New-Object System.IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)).ReadToEnd()
          $f = [System.Web.HttpUtility]::ParseQueryString($bodyText)
          $err = $null; $c = $null; $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
          try { $c = [Text.Encoding]::UTF8.GetString((UnB64U ([string]$f['code']))) | ConvertFrom-Json } catch { $err = 'The code is not valid.' }
          if (-not $err) {
            $chal = B64U ([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::ASCII.GetBytes([string]$f['code_verifier'])))
            if ($c.exp -lt $now) { $err = 'The code has expired.' }
            elseif ($chal -ne $c.c) { $err = 'The code_verifier does not match the code_challenge (the PKCE check failed).' }
            elseif ([string]$f['client_id'] -ne $c.a) { $err = 'The client_id does not match.' }
            elseif ([string]$f['redirect_uri'] -ne $c.r) { $err = 'The redirect_uri does not match.' }
            elseif (-not $mockUsers.Contains([string]$c.u)) { $err = 'Unknown mock user.' }
          }
          if ($err) { Send-Text $res 400 (@{ error = 'invalid_grant'; error_description = "AADSTS70000: $err (mock)" } | ConvertTo-Json -Compress) 'application/json; charset=utf-8'; continue }
          $user = $mockUsers[[string]$c.u]
          $claims = [ordered]@{ ver = '2.0'; iss = "$origin/$mockTenant/v2.0"; aud = [string]$c.a; iat = $now; nbf = $now; exp = $now + 3600; name = $user.name; preferred_username = $user.upn; oid = $user.oid; sub = 'mock-' + $user.oid; tid = $mockTenant; nonce = [string]$c.n }
          $jwt = (B64U ([Text.Encoding]::UTF8.GetBytes('{"typ":"JWT","alg":"none"}'))) + '.' + (B64U ([Text.Encoding]::UTF8.GetBytes(($claims | ConvertTo-Json -Compress)))) + '.'
          Send-Text $res 200 (@{ token_type = 'Bearer'; scope = 'openid profile'; expires_in = 3600; id_token = $jwt } | ConvertTo-Json -Compress) 'application/json; charset=utf-8'
        }
        continue
      }

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
            xp = Clamp-Int $b.xp 0 10000000; collected = Clamp-Int $b.collected 0 1000; mastered = Clamp-Int $b.mastered 0 1000; achievements = Clamp-Int $b.achievements 0 200
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
              $players += [pscustomobject]@{ playerId = $k; name = $p.name; color = $p.color; today = $today; maxStreak = $p.maxStreak; totalScore = $p.totalScore; bestScore = $p.bestScore; played = $p.played; xp = [int]$p.xp; collected = [int]$p.collected; mastered = [int]$p.mastered; achievements = [int]$p.achievements }
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
