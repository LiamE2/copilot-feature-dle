<#
  Copilot Feature-dle - build + validate
    powershell -ExecutionPolicy Bypass -File tools\build.ps1            # validate library, refresh data\features.js and sw.js
    powershell -ExecutionPolicy Bypass -File tools\build.ps1 -Single    # ...and also write the single-file edition (Copilot-Feature-dle.html)
    powershell -ExecutionPolicy Bypass -File tools\build.ps1 -Single -ShareUrl https://yourname.github.io/copilot-feature-dle/
        # -ShareUrl puts your public address on share cards/links made from the single file (which has no web address of its own)

  What it does
   1. Validates data\features.json (schema, hints, links, duplicates, difficulty mix) and prints a friendly report.
   2. Writes data\features.js (a script mirror so the game also works when opened straight from a folder).
   3. Rewrites the BUILD block in sw.js (cache version + file list) so offline play always matches the files on disk.
   4. With -Single: inlines CSS, JS, fonts, logos and data into one portable HTML file.
#>
param(
  [switch]$Single,
  [string]$SingleOut = (Join-Path $PSScriptRoot '..\Copilot-Feature-dle.html'),
  [string]$ShareUrl = ''
)
$ErrorActionPreference = 'Stop'
if ($ShareUrl -and $ShareUrl -notmatch '^https://[^\s''"\\<>]+$') { throw "-ShareUrl must be a plain https:// address, for example https://yourname.github.io/copilot-feature-dle/" }
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Read-Text($p) { [System.IO.File]::ReadAllText($p, $utf8) }
function Write-Text($p, $t) { [System.IO.File]::WriteAllText($p, $t, $utf8) }

# ------------------------------------------------------------------ 1. validate
Write-Host '== Validating data\features.json' -ForegroundColor Cyan
$jsonPath = Join-Path $root 'data\features.json'
$raw = Read-Text $jsonPath
$lib = $raw | ConvertFrom-Json
$errors = New-Object System.Collections.Generic.List[string]
$warns = New-Object System.Collections.Generic.List[string]
$diffs = 'Easy', 'Medium', 'Hard', 'Expert'
$catNames = @($lib.categories | ForEach-Object { $_.name })
$packIds = @($lib.packs | ForEach-Object { $_.id })
$ids = @{}; $names = @{}; $aliasMap = @{}

function L($x) { if ($null -ne $x) { $x } }
function Slug($s) { ($s.ToLower() -replace '[^a-z0-9]+', '-').Trim('-') }
foreach ($f in $lib.features) {
  $label = "[$($f.name)]"
  if (-not $f.name) { $errors.Add("A feature has no name."); continue }
  $id = if ($f.id) { $f.id } else { Slug $f.name }
  if ($ids.ContainsKey($id)) { $errors.Add("$label duplicate id '$id'") } else { $ids[$id] = $f }
  if ($names.ContainsKey($f.name.ToLower())) { $errors.Add("$label duplicate name") } else { $names[$f.name.ToLower()] = 1 }
  if ($diffs -notcontains $f.difficulty) { $errors.Add("$label difficulty must be one of $($diffs -join ', ')") }
  if ($catNames -notcontains $f.category) { $errors.Add("$label category '$($f.category)' is not listed in categories") }
  $h = @(L $f.hints)
  if ($h.Count -lt 3) { $errors.Add("$label needs at least 3 hints") } elseif ($h.Count -ne 5) { $warns.Add("$label has $($h.Count) hints (5 is ideal)") }
  for ($i = 0; $i -lt [Math]::Min(3, $h.Count); $i++) {
    $core = ($f.name -replace '^(Microsoft 365 )?Copilot( in)? ', '')
    if ($core.Length -ge 4 -and $h[$i] -match [regex]::Escape($core)) { $warns.Add("$label hint $($i + 1) mentions '$core'") }
  }
  foreach ($k in 'description', 'why', 'prompt') { if (-not $f.$k) { $warns.Add("$label missing '$k'") } }
  $uc = @(L $f.useCases); if ($uc.Count -ne 3) { $warns.Add("$label has $($uc.Count) use cases (3 expected)") }
  if (-not $f.learnMore) { $warns.Add("$label has no learnMore link") } elseif ($f.learnMore -notmatch '^https://') { $errors.Add("$label learnMore must be https") }
  foreach ($p in @(L $f.packs)) { if ($packIds -notcontains $p) { $errors.Add("$label pack '$p' is not defined in packs") } }
  foreach ($a in @(L $f.aliases)) { $key = $a.ToLower(); if ($aliasMap.ContainsKey($key) -and $aliasMap[$key] -ne $f.name) { $warns.Add("$label alias '$a' is also used by $($aliasMap[$key])") } else { $aliasMap[$key] = $f.name } }
  foreach ($r in @(L $f.related)) { if (-not ($lib.features | Where-Object { ($_.id -eq $r) -or ((Slug $_.name) -eq $r) })) { $errors.Add("$label related '$r' does not exist") } }
}
if ($lib.schedule) { foreach ($p in $lib.schedule.PSObject.Properties) { if (-not $ids.ContainsKey($p.Value)) { $errors.Add("schedule $($p.Name) points to unknown id '$($p.Value)'") } } }
foreach ($t in @($lib.themes)) { if (-not ($lib.features | Where-Object { (@(L $_.tags)) -contains $t.tag })) { $warns.Add("theme '$($t.title)' (tag '$($t.tag)') matches no features") } }

Write-Host ("   {0} features  |  " -f @($lib.features).Count) -NoNewline
foreach ($d in $diffs) { Write-Host ("{0}: {1}  " -f $d, @($lib.features | Where-Object { $_.difficulty -eq $d }).Count) -NoNewline }
Write-Host ''
foreach ($c in $catNames) { Write-Host ("   {0,-24} {1}" -f $c, @($lib.features | Where-Object { $_.category -eq $c }).Count) }
foreach ($p in $packIds) { Write-Host ("   pack {0,-22} {1}" -f $p, @($lib.features | Where-Object { (@(L $_.packs)) -contains $p }).Count) }
$warns | ForEach-Object { Write-Host "   warn: $_" -ForegroundColor Yellow }
$errors | ForEach-Object { Write-Host "   ERROR: $_" -ForegroundColor Red }
if ($errors.Count) { throw "Validation failed with $($errors.Count) error(s)." }
Write-Host '   OK' -ForegroundColor Green

# ------------------------------------------------------------------ 2. script mirror
$min = ($raw | ConvertFrom-Json | ConvertTo-Json -Depth 20 -Compress)
Write-Text (Join-Path $root 'data\features.js') ("/* generated by tools\build.ps1 from features.json - do not edit */`nwindow.FD_DATA = $min;`n")
Write-Host '== Wrote data\features.js' -ForegroundColor Cyan

# ------------------------------------------------------------------ 3. service worker
$files = Get-ChildItem -Path $root -Recurse -File | Where-Object {
  $_.FullName -notmatch '\\(tools|tests|docs)\\' -and $_.Name -notin 'sw.js', 'README.md', 'leaderboard-data.json', 'Copilot-Feature-dle.html' -and $_.Extension -in '.html', '.css', '.js', '.json', '.webmanifest', '.png', '.svg', '.woff2'
} | Sort-Object FullName
$rel = @($files | ForEach-Object { $_.FullName.Substring($root.Length + 1).Replace('\', '/') })
$sha = [System.Security.Cryptography.SHA1]::Create()
$all = New-Object System.IO.MemoryStream
foreach ($f in $files) { $b = [System.IO.File]::ReadAllBytes($f.FullName); $all.Write($b, 0, $b.Length) }
$ver = 'copilot-feature-dle-' + (($sha.ComputeHash($all.ToArray()) | Select-Object -First 5 | ForEach-Object { $_.ToString('x2') }) -join '')
$list = "'./', " + (($rel | ForEach-Object { "'$_'" }) -join ', ')
$block = "/* BUILD:START */`nconst VERSION = '$ver';`nconst CORE = [$list];`n/* BUILD:END */"
$sw = Read-Text (Join-Path $root 'sw.js')
$sw = [regex]::Replace($sw, '/\* BUILD:START \*/.*?/\* BUILD:END \*/', { param($m) $block }, 'Singleline')
Write-Text (Join-Path $root 'sw.js') $sw
Write-Host "== sw.js -> $ver ($($rel.Count) files cached for offline)" -ForegroundColor Cyan

# ------------------------------------------------------------------ 4. single-file edition
if ($Single) {
  Write-Host '== Building single-file edition' -ForegroundColor Cyan
  function DataUri($path, $mime) { "data:$mime;base64," + [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($path)) }
  $page = Read-Text (Join-Path $root 'index.html')

  # CSS (with fonts inlined)
  $cssAll = New-Object System.Text.StringBuilder
  foreach ($m in [regex]::Matches($page, '<link rel="stylesheet" href="([^"]+)">')) {
    $css = Read-Text (Join-Path $root $m.Groups[1].Value)
    $css = [regex]::Replace($css, 'url\("\.\./(assets/[^"]+)"\)', { param($u) 'url("' + (DataUri (Join-Path $root $u.Groups[1].Value) 'font/woff2') + '")' })
    [void]$cssAll.AppendLine($css)
  }
  $page = [regex]::Replace($page, '\s*<link rel="stylesheet" href="[^"]+">', '')
  $page = $page.Replace('</head>', "<style>`n$($cssAll.ToString())</style>`n</head>")

  # drop manifest + point icons at inline data
  $page = [regex]::Replace($page, '\s*<link rel="manifest"[^>]*>', '')
  $page = $page.Replace('href="assets/icons/favicon.svg"', 'href="' + (DataUri (Join-Path $root 'assets\icons\favicon.svg') 'image/svg+xml') + '"')
  $page = [regex]::Replace($page, '\s*<link rel="apple-touch-icon"[^>]*>', '')

  # everything is inlined, so the file may not talk to the network at all (a nice privacy promise for a double-clickable file)
  $singleCsp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; object-src 'none'; base-uri 'none'; form-action 'none'"
  $page = [regex]::Replace($page, '<meta http-equiv="Content-Security-Policy"[^>]*>', { param($m) '<meta http-equiv="Content-Security-Policy" content="' + $singleCsp + '">' })

  # scripts: embedded data first, then every app script inline
  $logos = 'assets/img/engage-squared-logo.png', 'assets/img/engage-squared-logo-white.png', 'assets/img/engage-squared-symbol.png'
  $js = New-Object System.Text.StringBuilder
  [void]$js.AppendLine("window.FD_DATA = $min;")
  foreach ($m in [regex]::Matches($page, '<script src="([^"]+)"></script>')) {
    $code = Read-Text (Join-Path $root $m.Groups[1].Value)
    if ($ShareUrl -and $m.Groups[1].Value -eq 'js/05-config.js') {
      if (-not $code.Contains("shareUrl: ''")) { throw "Could not find shareUrl: '' in js/05-config.js to set -ShareUrl." }
      $code = $code.Replace("shareUrl: ''", "shareUrl: '$ShareUrl'")
    }
    foreach ($l in $logos) { $code = $code.Replace($l, (DataUri (Join-Path $root $l) 'image/png')) }
    [void]$js.AppendLine($code.Replace('</script', '<\/script'))
  }
  $page = [regex]::Replace($page, '\s*<script src="[^"]+"></script>', '')
  $page = $page.Replace('</body>', "<script>`n$($js.ToString())</script>`n</body>")

  # keep the font licence and trademark notice with the embedded fonts
  $notice = "<!--`n  Copilot Feature-dle - single-file edition - by Engage Squared (https://www.engagesquared.com)`n  Works offline: everything it needs is inside this file, and it never contacts a server.`n  Fonts: Montserrat (c) The Montserrat Project Authors and Noto Sans (c) The Noto Project Authors, both under the SIL Open Font License 1.1 (https://openfontlicense.org).`n  Microsoft, Microsoft 365, Copilot and other product names are trademarks of the Microsoft group of companies. This game is independent and not endorsed by Microsoft.`n-->"
  $page = [regex]::Replace($page, '^<!doctype html>', { param($m) $m.Value + "`n" + $notice })

  # a single file must not point at anything outside itself
  $leftover = [regex]::Matches($page, '(?:src|href)="(?!data:|#|\$\{|https://www\.engagesquared\.com|https://learn\.microsoft\.com|https://support\.microsoft\.com)([^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
  if ($leftover) { Write-Host ("   warn: single file still references: " + ($leftover -join ', ')) -ForegroundColor Yellow }

  $outPath = [System.IO.Path]::GetFullPath($SingleOut)
  Write-Text $outPath $page
  Write-Host ("   wrote {0} ({1:N0} KB)" -f $outPath, ((Get-Item $outPath).Length / 1KB)) -ForegroundColor Green
}
Write-Host 'Done.' -ForegroundColor Green
