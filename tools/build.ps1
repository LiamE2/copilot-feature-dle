<#
  Copilot Feature-dle - build + validate
    powershell -ExecutionPolicy Bypass -File tools\build.ps1            # validate library, refresh data\features.js and sw.js
    powershell -ExecutionPolicy Bypass -File tools\build.ps1 -Single    # ...and also write the single-file edition (Copilot-Feature-dle.html)

  What it does
   1. Validates data\features.json (schema, hints, links, duplicates, difficulty mix), data\changelog.json, data\daily.json (the Daily
      Challenge plan: real weekday dates, puzzles that exist, no repeats too close together, how many days ahead are planned),
      data\prompts.json (the Prompt Lab scenarios: four prompts each, exactly one best, honest ingredient tags) and data\scenarios.json
      (the Scenario Match scenarios, which are also each feature's example scenarios: a first-person need, how Copilot helps, three
      other features that look plausible), and prints a friendly report.
   2. Writes data\features.js, data\changelog.js, data\daily.js, data\prompts.js and data\scenarios.js (script mirrors so the game also works when opened straight from a folder).
   3. Rewrites the BUILD block in sw.js (cache version + file list) so offline play always matches the files on disk.
   4. With -Single: inlines CSS, JS, fonts, logos and data into one portable HTML file.
#>
param(
  [switch]$Single,
  [string]$SingleOut = (Join-Path $PSScriptRoot '..\Copilot-Feature-dle.html')
)
$ErrorActionPreference = 'Stop'
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
function Edit-Distance($a, $b) {
  $prev = 0..$b.Length
  for ($i = 1; $i -le $a.Length; $i++) {
    $cur = New-Object 'int[]' ($b.Length + 1); $cur[0] = $i
    for ($j = 1; $j -le $b.Length; $j++) {
      $cost = if ($a[$i - 1] -eq $b[$j - 1]) { 0 } else { 1 }
      $cur[$j] = [Math]::Min([Math]::Min($cur[$j - 1] + 1, $prev[$j] + 1), $prev[$j - 1] + $cost)
    }
    $prev = $cur
  }
  $prev[$b.Length]
}
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
  if (@(L $f.useCases).Count) { $warns.Add("$label still has 'useCases' in features.json. Example scenarios now live in data\scenarios.json; these are only used if the feature has no scenarios there") }
  if (-not $f.learnMore) { $warns.Add("$label has no learnMore link") } elseif ($f.learnMore -notmatch '^https://') { $errors.Add("$label learnMore must be https") }
  foreach ($p in @(L $f.packs)) { if ($packIds -notcontains $p) { $errors.Add("$label pack '$p' is not defined in packs") } }
  foreach ($a in @(L $f.aliases)) { $key = $a.ToLower(); if ($aliasMap.ContainsKey($key) -and $aliasMap[$key] -ne $f.name) { $warns.Add("$label alias '$a' is also used by $($aliasMap[$key])") } else { $aliasMap[$key] = $f.name } }
  foreach ($r in @(L $f.related)) { if (-not ($lib.features | Where-Object { ($_.id -eq $r) -or ((Slug $_.name) -eq $r) })) { $errors.Add("$label related '$r' does not exist") } }
}
if ($lib.PSObject.Properties.Name -contains 'schedule') { $warns.Add("features.json still has a 'schedule' list, which the game no longer reads. Move those dates into data\daily.json.") }
$themeIds = @{}; $themeSlots = @{}
foreach ($t in @($lib.themes)) {
  if (-not $t.id) { $errors.Add("a monthly spotlight ('$($t.title)') has no id") } elseif ($themeIds.ContainsKey($t.id)) { $errors.Add("monthly spotlight id '$($t.id)' is used twice (ids must be unique across every year)") } else { $themeIds[$t.id] = 1 }
  if (-not ($t.month -is [int] -or $t.month -is [long]) -or $t.month -lt 1 -or $t.month -gt 12) { $errors.Add("monthly spotlight '$($t.title)': month must be a number from 1 to 12") }
  if (-not $t.year) { $warns.Add("monthly spotlight '$($t.title)' has no year (it will count as the year the library was last updated)") } elseif ("$($t.year)" -notmatch '^\d{4}$') { $errors.Add("monthly spotlight '$($t.title)': year must look like 2026") }
  $slot = "$($t.year)-$($t.month)"; if ($themeSlots.ContainsKey($slot)) { $warns.Add("two monthly spotlights share $slot") } else { $themeSlots[$slot] = 1 }
  if (-not ($lib.features | Where-Object { (@(L $_.tags)) -contains $t.tag })) { $warns.Add("theme '$($t.title)' (tag '$($t.tag)') matches no features") }
}

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

# ------------------------------------------------------------------ 2b. changelog ("What's new" popup)
Write-Host '== Validating data\changelog.json' -ForegroundColor Cyan
$clPath = Join-Path $root 'data\changelog.json'
$clRaw = Read-Text $clPath
$cl = $clRaw | ConvertFrom-Json
$clErrors = New-Object System.Collections.Generic.List[string]
if ($cl.version -notmatch '^\d+\.\d+\.\d+$') { $clErrors.Add("version must look like 1.2.0 (it is '$($cl.version)')") }
if ($cl.date -notmatch '^\d{4}-\d{2}-\d{2}$') { $clErrors.Add("date must be YYYY-MM-DD (it is '$($cl.date)')") }
if (@(L $cl.game).Count -lt 1) { $clErrors.Add('"game" needs at least one item') }
foreach ($g in @(L $cl.game)) { if (-not $g.title) { $clErrors.Add('a "game" item has no title') } }
foreach ($m in @(L $cl.microsoft)) {
  if (-not $m.title) { $clErrors.Add('a "microsoft" item has no title') }
  if ($m.link -and $m.link -notmatch '^https://') { $clErrors.Add("link for '$($m.title)' must be https") }
  if ($m.date -and $m.date -notmatch '^\d{4}-\d{2}(-\d{2})?$') { $clErrors.Add("date for '$($m.title)' must be YYYY-MM or YYYY-MM-DD") }
}
$cfgVersion = [regex]::Match((Read-Text (Join-Path $root 'js\05-config.js')), "version:\s*'([^']+)'").Groups[1].Value
if ($cfgVersion -and $cfgVersion -ne $cl.version) { Write-Host "   warn: js\05-config.js says version $cfgVersion but the changelog says $($cl.version)" -ForegroundColor Yellow }
$clErrors | ForEach-Object { Write-Host "   ERROR: $_" -ForegroundColor Red }
if ($clErrors.Count) { throw "Changelog validation failed with $($clErrors.Count) error(s)." }
$clMin = ($clRaw | ConvertFrom-Json | ConvertTo-Json -Depth 20 -Compress)
Write-Text (Join-Path $root 'data\changelog.js') ("/* generated by tools\build.ps1 from changelog.json - do not edit */`nwindow.FD_CHANGELOG = $clMin;`n")
Write-Host ("   version {0}: {1} game updates, {2} Microsoft updates. Wrote data\changelog.js" -f $cl.version, @(L $cl.game).Count, @(L $cl.microsoft).Count) -ForegroundColor Green

# ------------------------------------------------------------------ 2c. Daily plan (data\daily.json: which puzzle is on which day)
Write-Host '== Checking data\daily.json (the Daily Challenge plan)' -ForegroundColor Cyan
# the scenario ids the plan may name: Scenario Match ones from scenarios.json, Prompt Lab ones from prompts.json (feature id for each)
$scnFeature = @{}; $prmFeature = @{}
foreach ($pair in @(@('data\scenarios.json', $scnFeature), @('data\prompts.json', $prmFeature))) {
  $pp = Join-Path $root $pair[0]
  if (Test-Path $pp) { try { foreach ($sc in @(L ((Read-Text $pp | ConvertFrom-Json).scenarios))) { if ($sc.id) { $pair[1]["$($sc.id)"] = "$($sc.feature)" } } } catch { } }
}
$dlPath = Join-Path $root 'data\daily.json'
$dlErrors = New-Object System.Collections.Generic.List[string]
$dlWarns = New-Object System.Collections.Generic.List[string]
$dlRows = New-Object System.Collections.Generic.List[object]
$dlMin = '{"days":[]}'
if (-not (Test-Path $dlPath)) {
  Write-Host '   no data\daily.json: every day uses the random rotation' -ForegroundColor Yellow
} else {
  $dlRaw = Read-Text $dlPath
  $dl = $null
  try { $dl = $dlRaw | ConvertFrom-Json } catch { $dlErrors.Add("data\daily.json is not valid JSON ($($_.Exception.Message)). The usual slips are a missing comma between two lines, a comma after the last line, or a missing quote.") }
  if ($dl -and -not ($dl.PSObject.Properties.Name -contains 'days')) { $dlErrors.Add('the file needs a "days" list, like { "days": [ { "date": "2026-11-17", "feature": "copilot-pages" } ] }') }
  if ($dl -and ($dl.PSObject.Properties.Name -contains 'days')) {
    $nameSlug = @{}
    foreach ($f in $lib.features) { if ($f.name) { $nameSlug[(Slug $f.name)] = $f } }
    $seenDates = @{}; $n = 0
    foreach ($d in @(L $dl.days)) {
      $n++
      $date = "$($d.date)".Trim(); $ref = "$($d.feature)".Trim(); $at = "entry $n"; if ($date) { $at += " ($date)" }
      $kind = if ($d.PSObject.Properties.Name -contains 'type' -and "$($d.type)".Trim()) { "$($d.type)".Trim().ToLower() } else { 'hunt' }
      $sid = if ($d.PSObject.Properties.Name -contains 'scenario') { "$($d.scenario)".Trim() } else { '' }
      $dt = [datetime]::MinValue
      if ($date -notmatch '^\d{4}-\d{2}-\d{2}$' -or -not [datetime]::TryParseExact($date, 'yyyy-MM-dd', [cultureinfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::None, [ref]$dt)) { $dlErrors.Add("${at}: the date must be a real day written like 2026-11-17"); continue }
      if (@('hunt', 'match', 'prompt') -notcontains $kind) { $dlErrors.Add("${at}: the type must be hunt, match or prompt (not '$kind')"); continue }
      if (-not $ref -and -not $sid) { $dlErrors.Add("${at}: no feature given" + $(if ($kind -ne 'hunt') { ' (give a feature, or the id of the scenario to ask)' } else { '' })); continue }
      if ($dt.DayOfWeek -eq 'Saturday' -or $dt.DayOfWeek -eq 'Sunday') { $dlWarns.Add("${at}: there is no Daily Challenge on a $($dt.DayOfWeek), so the game ignores this entry"); continue }
      if ($seenDates.ContainsKey($date)) { $dlErrors.Add("${at}: $date is listed twice (entry $($seenDates[$date]) is the first)"); continue }
      $seenDates[$date] = $n
      # a Scenario Match or Prompt Lab day can name its question, and then the feature comes from it
      if ($kind -ne 'hunt' -and $sid) {
        $src = if ($kind -eq 'match') { $scnFeature } else { $prmFeature }
        if (-not $src.ContainsKey($sid)) { $dlErrors.Add("${at}: no $(if ($kind -eq 'match') { 'Scenario Match' } else { 'Prompt Lab' }) scenario has the id '$sid'"); continue }
        if (-not $ref) { $ref = $src[$sid] }
        elseif ((Slug $ref) -ne (Slug $src[$sid]) -and $ref -ne $src[$sid]) { $dlWarns.Add("${at}: the scenario '$sid' is about $($src[$sid]), not '$ref', so the game uses $($src[$sid])"); $ref = $src[$sid] }
      }
      $s = Slug $ref
      $feat = $null
      if ($ids.ContainsKey($ref)) { $feat = $ids[$ref] } elseif ($s -and $ids.ContainsKey($s)) { $feat = $ids[$s] } elseif ($s -and $nameSlug.ContainsKey($s)) { $feat = $nameSlug[$s] }
      if (-not $feat) {
        $near = @($lib.features | ForEach-Object {
            $fid2 = if ($_.id) { "$($_.id)" } else { Slug $_.name }; $k = Slug $_.name
            $score = [Math]::Min((Edit-Distance $s $fid2), (Edit-Distance $s $k))
            if ($s.Length -ge 4 -and ($k.Contains($s) -or $s.Contains($k))) { $score = [Math]::Min($score, 3) }
            [pscustomobject]@{ Id = $fid2; Score = $score }
          } | Where-Object { $_.Score -le 3 } | Sort-Object Score, Id | Select-Object -First 4 | ForEach-Object { $_.Id })
        $tip = if ($near.Count) { ' Did you mean: ' + ($near -join ', ') + '?' } else { ' Use a feature id from features.json.' }
        $dlErrors.Add("${at}: no feature is called '$ref'.$tip"); continue
      }
      $fid = if ($feat.id) { $feat.id } else { Slug $feat.name }
      if ($kind -ne 'hunt' -and -not $sid) {
        $src = if ($kind -eq 'match') { $scnFeature } else { $prmFeature }
        if (-not @($src.Values | Where-Object { $_ -eq $fid }).Count) { $dlErrors.Add("${at}: $($feat.name) has no $(if ($kind -eq 'match') { 'Scenario Match' } else { 'Prompt Lab' }) scenarios, so it can't be a $kind day"); continue }
      }
      $dlRows.Add([pscustomobject]@{ Date = $dt; Key = $date; Id = $fid; Name = $feat.name; Difficulty = $feat.difficulty; Kind = $kind })
    }
    # the same feature planned again very soon in the same game mode is almost always a slip
    $lastSeen = @{}
    foreach ($r in @($dlRows | Sort-Object Date)) {
      $lk = "$($r.Kind)|$($r.Id)"
      if ($lastSeen.ContainsKey($lk)) { $gap = ($r.Date - $lastSeen[$lk]).Days; if ($gap -lt 14) { $dlWarns.Add("$($r.Name) ($($r.Kind)) is planned on $($lastSeen[$lk].ToString('yyyy-MM-dd')) and again on $($r.Key), only $gap days apart") } }
      $lastSeen[$lk] = $r.Date
    }
  }
  $dlErrors | ForEach-Object { Write-Host "   ERROR: $_" -ForegroundColor Red }
  if ($dlErrors.Count) { throw "daily.json validation failed with $($dlErrors.Count) error(s)." }

  # how far ahead is planned? (everything beyond that uses the random rotation, so this is a nudge, not a problem)
  $sorted = @($dlRows | Sort-Object Date)
  $today = (Get-Date).Date
  if ($sorted.Count) {
    $first = $sorted[0]; $last = $sorted[$sorted.Count - 1]
    Write-Host ("   {0} planned {1}, {2} to {3}" -f $sorted.Count, $(if ($sorted.Count -eq 1) { 'day' } else { 'days' }), $first.Key, $last.Key)
    $covered = @{}; foreach ($r in $sorted) { $covered[$r.Key] = 1 }
    $day = $today; while ($day.DayOfWeek -eq 'Saturday' -or $day.DayOfWeek -eq 'Sunday') { $day = $day.AddDays(1) }
    $run = 0; $runEnd = $null
    while ($covered.ContainsKey($day.ToString('yyyy-MM-dd'))) { $run++; $runEnd = $day; do { $day = $day.AddDays(1) } while ($day.DayOfWeek -eq 'Saturday' -or $day.DayOfWeek -eq 'Sunday') }
    if ($last.Date -lt $today) { $dlWarns.Add("the plan has run out (its last day was $($last.Key)), so the random rotation has been choosing since. Add more dates when you are ready") }
    elseif ($run -eq 0) { Write-Host ("   today and the next weekdays use the random rotation; the plan starts on {0}" -f (@($sorted | Where-Object { $_.Date -ge $today })[0].Key)) }
    elseif ($run -lt 10) { $dlWarns.Add("the plan only covers the next $run weekdays (to $($runEnd.ToString('yyyy-MM-dd'))). After that the random rotation takes over until you add more dates") }
    else { Write-Host ("   the plan covers the next {0} weekdays in a row (to {1}); after that the random rotation takes over" -f $run, $runEnd.ToString('yyyy-MM-dd')) }
    foreach ($r in @($sorted | Where-Object { $_.Date -ge $today } | Select-Object -First 5)) { Write-Host ("   {0}  {1,-7} {2,-34} {3}" -f $r.Date.ToString('ddd d MMM yyyy'), $r.Kind, $r.Name, $r.Difficulty) }
    Write-Host ("   game modes planned: {0} Feature Hunt, {1} Scenario Match, {2} Prompt Lab" -f @($sorted | Where-Object { $_.Kind -eq 'hunt' }).Count, @($sorted | Where-Object { $_.Kind -eq 'match' }).Count, @($sorted | Where-Object { $_.Kind -eq 'prompt' }).Count)
  } else { Write-Host '   nothing planned yet: every day uses the random rotation' }
  $dlWarns | ForEach-Object { Write-Host "   warn: $_" -ForegroundColor Yellow }
  $dlMin = ($dlRaw | ConvertFrom-Json | ConvertTo-Json -Depth 20 -Compress)
}
Write-Text (Join-Path $root 'data\daily.js') ("/* generated by tools\build.ps1 from daily.json - do not edit */`nwindow.FD_DAILY = $dlMin;`n")
Write-Host '   Wrote data\daily.js' -ForegroundColor Green

# ------------------------------------------------------------------ 2d. Prompt Lab (data\prompts.json: the scenarios and the four prompt ingredients)
Write-Host '== Checking data\prompts.json (Prompt Lab)' -ForegroundColor Cyan
$plPath = Join-Path $root 'data\prompts.json'
$plErrors = New-Object System.Collections.Generic.List[string]
$plWarns = New-Object System.Collections.Generic.List[string]
$plMin = '{"scenarios":[]}'
if (-not (Test-Path $plPath)) {
  Write-Host '   no data\prompts.json: Prompt Lab will say it has no questions yet' -ForegroundColor Yellow
} else {
  $plRaw = Read-Text $plPath
  $pl = $null
  try { $pl = $plRaw | ConvertFrom-Json } catch { $plErrors.Add("data\prompts.json is not valid JSON ($($_.Exception.Message)). The usual slips are a missing comma between two items, a comma after the last item, or a missing quote.") }
  if ($pl) {
    $ingIds = @(L $pl.ingredients | ForEach-Object { "$($_.id)" })
    foreach ($need in 'goal', 'context', 'source', 'expectations') { if ($ingIds -notcontains $need) { $plErrors.Add("'ingredients' needs an entry with the id '$need' (the four are goal, context, source and expectations)") } }
    foreach ($g in @(L $pl.ingredients)) { if (-not $g.name) { $plErrors.Add("the ingredient '$($g.id)' needs a name") } }
    if ($pl.learnMore -and $pl.learnMore.url -and "$($pl.learnMore.url)" -notmatch '^https://') { $plErrors.Add("learnMore.url must be an https link") }
    $plSeen = @{}; $plApps = @{}; $n = 0
    foreach ($s in @(L $pl.scenarios)) {
      $n++; $at = "scenario $n"; if ($s.id) { $at += " ($($s.id))" }
      if (-not $s.id -or "$($s.id)" -notmatch '^[a-z0-9-]{3,60}$') { $plErrors.Add("${at}: the id must be 3 to 60 lowercase letters, numbers or dashes, like missed-meeting-recap"); continue }
      if ($plSeen.ContainsKey("$($s.id)")) { $plErrors.Add("${at}: the id '$($s.id)' is used twice"); continue }
      $plSeen["$($s.id)"] = 1
      if (-not $s.situation) { $plErrors.Add("${at}: it needs a situation (what is going on at work?)") } elseif ("$($s.situation)".Length -gt 200) { $plWarns.Add("${at}: the situation is $("$($s.situation)".Length) characters long (aim for 200 or fewer)") }
      if (-not $s.app) { $plWarns.Add("${at}: no app label (like Outlook or Teams)") } else { $plApps["$($s.app)"] = 1 + [int]$plApps["$($s.app)"] }
      if ($s.feature) {
        $fref = "$($s.feature)"
        if (-not $ids.ContainsKey($fref)) {
          $near = @($lib.features | Where-Object { $k = if ($_.id) { "$($_.id)" } else { Slug $_.name }; (Edit-Distance $fref $k) -le 4 } | Select-Object -First 3 | ForEach-Object { if ($_.id) { $_.id } else { Slug $_.name } })
          $plErrors.Add("${at}: the feature '$fref' is not in features.json." + $(if ($near.Count) { ' Did you mean: ' + ($near -join ', ') + '?' } else { ' Use a feature id, or leave "feature" out.' }))
        }
      }
      if (-not $s.tip) { $plWarns.Add("${at}: no tip (the one-line takeaway shown after the answer)") }
      $opts = @(L $s.options)
      if ($opts.Count -ne 4) { $plErrors.Add("${at}: it needs exactly 4 prompts (it has $($opts.Count))"); continue }
      $bestOpts = @($opts | Where-Object { $_.best -eq $true })
      if ($bestOpts.Count -ne 1) { $plErrors.Add("${at}: exactly one prompt must have `"best`": true (it has $($bestOpts.Count))") }
      $oi = 0
      foreach ($o in $opts) {
        $oi++
        if (-not $o.text) { $plErrors.Add("${at}, prompt ${oi}: no text") } elseif ("$($o.text)".Length -gt 330) { $plWarns.Add("${at}, prompt ${oi}: the text is $("$($o.text)".Length) characters long (aim for 330 or fewer)") }
        if (-not $o.why) { $plErrors.Add("${at}, prompt ${oi}: no 'why' (the explanation shown after it is picked)") } elseif ("$($o.why)".Length -gt 230) { $plWarns.Add("${at}, prompt ${oi}: the 'why' is $("$($o.why)".Length) characters long (aim for 230 or fewer)") }
        foreach ($h in @(L $o.has)) { if ($ingIds -notcontains "$h") { $plErrors.Add("${at}, prompt ${oi}: '$h' is not one of the ingredients ($($ingIds -join ', '))") } }
      }
      if ($bestOpts.Count -eq 1) {
        $most = (@($opts | Where-Object { $_.best -ne $true } | ForEach-Object { @(L $_.has).Count }) | Measure-Object -Maximum).Maximum
        if (@(L $bestOpts[0].has).Count -le $most) { $plWarns.Add("${at}: the best prompt should have more ingredients than the others, otherwise the lesson is muddy") }
      }
    }
    Write-Host ("   {0} scenarios across {1} apps (a Prompt Lab game plays up to 10 of them)" -f $plSeen.Count, $plApps.Count)
    if ($plSeen.Count -lt 12) { $plWarns.Add("only $($plSeen.Count) scenarios: players will see repeats quickly (aim for 30 or more)") }
    $plErrors | ForEach-Object { Write-Host "   ERROR: $_" -ForegroundColor Red }
    $plWarns | ForEach-Object { Write-Host "   warn: $_" -ForegroundColor Yellow }
    if ($plErrors.Count) { throw "prompts.json validation failed with $($plErrors.Count) error(s)." }
    $plMin = ($plRaw | ConvertFrom-Json | ConvertTo-Json -Depth 20 -Compress)
  } else {
    $plErrors | ForEach-Object { Write-Host "   ERROR: $_" -ForegroundColor Red }
    throw "prompts.json validation failed with $($plErrors.Count) error(s)."
  }
}
Write-Text (Join-Path $root 'data\prompts.js') ("/* generated by tools\build.ps1 from prompts.json - do not edit */`nwindow.FD_PROMPTS = $plMin;`n")
Write-Host '   OK. Wrote data\prompts.js' -ForegroundColor Green

# ------------------------------------------------------------------ 2e. Scenario Match (data\scenarios.json: a need, how Copilot helps, three other features) + what each pack holds
Write-Host '== Checking data\scenarios.json (Scenario Match)' -ForegroundColor Cyan
$scPath = Join-Path $root 'data\scenarios.json'
$scErrors = New-Object System.Collections.Generic.List[string]
$scWarns = New-Object System.Collections.Generic.List[string]
$scMin = '{"scenarios":[]}'
$scList = @()
$scSeen = @{}
if (-not (Test-Path $scPath)) {
  Write-Host '   no data\scenarios.json: Scenario Match will say it has no questions yet' -ForegroundColor Yellow
} else {
  $scRaw = Read-Text $scPath
  $sc = $null
  try { $sc = $scRaw | ConvertFrom-Json } catch { $scErrors.Add("data\scenarios.json is not valid JSON ($($_.Exception.Message)). The usual slips are a missing comma between two items, a comma after the last item, or a missing quote.") }
  if ($sc) {
    $scList = @(L $sc.scenarios)
    $plIds = @{}; if ($pl) { foreach ($ps in @(L $pl.scenarios)) { if ($ps.id) { $plIds["$($ps.id)"] = 1 } } }
    $perFeature = @{}; $n = 0
    foreach ($s in $scList) {
      $n++; $at = "scenario $n"; if ($s.id) { $at += " ($($s.id))" }
      if (-not $s.id -or "$($s.id)" -notmatch '^[a-z0-9-]{3,60}$') { $scErrors.Add("${at}: the id must be 3 to 60 lowercase letters, numbers or dashes, like chat-web-and-work-files"); continue }
      if ($scSeen.ContainsKey("$($s.id)")) { $scErrors.Add("${at}: the id '$($s.id)' is used twice"); continue }
      if ($plIds.ContainsKey("$($s.id)")) { $scErrors.Add("${at}: the id '$($s.id)' is also a Prompt Lab scenario id (ids must be different across both files, so a pack can list either)"); continue }
      $scSeen["$($s.id)"] = 1
      $fref = "$($s.feature)"
      if (-not $fref) { $scErrors.Add("${at}: no feature (the feature that is the right answer)"); continue }
      if (-not $ids.ContainsKey($fref)) {
        $near = @($lib.features | Where-Object { $k = if ($_.id) { "$($_.id)" } else { Slug $_.name }; (Edit-Distance $fref $k) -le 4 } | Select-Object -First 3 | ForEach-Object { if ($_.id) { $_.id } else { Slug $_.name } })
        $scErrors.Add("${at}: the feature '$fref' is not in features.json." + $(if ($near.Count) { ' Did you mean: ' + ($near -join ', ') + '?' } else { '' })); continue
      }
      $perFeature[$fref] = 1 + [int]$perFeature[$fref]
      $need = "$($s.need)"
      if (-not $need) { $scErrors.Add("${at}: no need (the first-person 'I want ...' line players read)") }
      else {
        if ($need.Length -gt 300) { $scErrors.Add("${at}: the need is $($need.Length) characters long (300 is the most the game shows)") } elseif ($need.Length -gt 220) { $scWarns.Add("${at}: the need is $($need.Length) characters long (aim for 220 or fewer)") }
        if ($need -notmatch "^(I|I'm|I've|I'd|I'll|My|We|We're|We've|Our|Everyone|Someone|Staff|People)\b") { $scWarns.Add("${at}: the need reads best in the first person ('I want ...', 'My team ...'): $need") }
        $fe = $ids[$fref]; $core = ($fe.name -replace '^(Microsoft 365 )?Copilot( in| for)? ', '').Trim()
        foreach ($cand in @($fe.name, $core)) { if ($cand.Length -ge 5 -and $need -match ('(?i)\b' + [regex]::Escape($cand) + '\b')) { $scWarns.Add("${at}: the need mentions '$cand', which gives the answer away") } }
      }
      if (-not $s.title) { $scWarns.Add("${at}: no title (the short name shown in the Feature Book)") }
      if (-not $s.text) { $scWarns.Add("${at}: no text (how Copilot helps, shown after the answer and in the Feature Book)") }
      $good = @{}
      foreach ($o in @(L $s.options)) {
        $of = if ($o -is [string]) { "$o" } else { "$($o.feature)" }
        if (-not $ids.ContainsKey($of)) { $scErrors.Add("${at}: the option '$of' is not a feature in features.json") }
        elseif ($of -eq $fref) { $scErrors.Add("${at}: an option is the right answer itself ('$of'). 'options' lists the OTHER features") }
        else { $good[$of] = 1 }
      }
      if ($good.Count -lt 3) { $scErrors.Add("${at}: it needs 3 different wrong features in 'options' (it has $($good.Count))") }
    }
    $short = @($lib.features | Where-Object { [int]$perFeature[$(if ($_.id) { "$($_.id)" } else { Slug $_.name })] -lt 3 })
    foreach ($fe in $short) { $scWarns.Add("$($fe.name) has only $([int]$perFeature[$(if ($fe.id) { "$($fe.id)" } else { Slug $fe.name })]) scenarios (3 or more is ideal: they are its example scenarios in the Feature Book)") }
    $counts = @($lib.features | ForEach-Object { [int]$perFeature[$(if ($_.id) { "$($_.id)" } else { Slug $_.name })] })
    $cm = $counts | Measure-Object -Minimum -Maximum -Average
    Write-Host ("   {0} scenarios across {1} of {2} features (per feature: {3} to {4}, average {5:N1})" -f $scSeen.Count, @($counts | Where-Object { $_ -gt 0 }).Count, $counts.Count, $cm.Minimum, $cm.Maximum, $cm.Average)

    # packs and monthly spotlights hold a Feature Hunt puzzle for each feature, one Scenario Match question for each (its first scenario) and the Prompt Lab questions about it,
    # unless the pack lists its own "scenarios" (ids from either file; [] means Feature Hunt puzzles only)
    Write-Host '   what each pack and monthly spotlight holds:'
    $rows = @()
    foreach ($pkDef in @(L $lib.packs)) { $rows += , @("pack $($pkDef.id)", $pkDef, @($lib.features | Where-Object { $own = @(L $_.packs); if ($own.Count) { $own -contains $pkDef.id } else { $pkDef.id -eq 'core' } })) }
    foreach ($tDef in @(L $lib.themes)) { $rows += , @("spotlight $($tDef.id)", $tDef, @($lib.features | Where-Object { @(L $_.tags) -contains $tDef.tag })) }
    foreach ($row in $rows) {
      $rowLabel = $row[0]; $rowDef = $row[1]
      $memberIds = @(@($row[2]) | ForEach-Object { if ($_.id) { "$($_.id)" } else { Slug $_.name } })
      $ownList = $rowDef.PSObject.Properties['scenarios']
      $nm = 0; $np = 0
      if ($ownList) {
        foreach ($sid in @(L $ownList.Value)) {
          if ($scSeen.ContainsKey("$sid")) { $nm++ } elseif ($plIds.ContainsKey("$sid")) { $np++ } else { $scErrors.Add("${rowLabel}: scenarios lists '$sid', which is not in scenarios.json or prompts.json") }
        }
      } else {
        $nm = @($memberIds | Where-Object { $perFeature.ContainsKey("$_") }).Count
        $np = @(@(L $pl.scenarios) | Where-Object { $_.feature -and ($memberIds -contains "$($_.feature)") }).Count
      }
      Write-Host ("   {0,-36} {1,3} Feature Hunt + {2,3} Scenario Match + {3,3} Prompt Lab{4}" -f $rowLabel, $memberIds.Count, $nm, $np, $(if ($ownList) { ' (its own list)' } else { '' }))
    }
    $scMin = ($scRaw | ConvertFrom-Json | ConvertTo-Json -Depth 20 -Compress)
  }
}
$scErrors | ForEach-Object { Write-Host "   ERROR: $_" -ForegroundColor Red }
$scWarns | ForEach-Object { Write-Host "   warn: $_" -ForegroundColor Yellow }
if ($scErrors.Count) { throw "scenarios.json validation failed with $($scErrors.Count) error(s)." }
Write-Text (Join-Path $root 'data\scenarios.js') ("/* generated by tools\build.ps1 from scenarios.json - do not edit */`nwindow.FD_SCENARIOS = $scMin;`n")
Write-Host '   OK. Wrote data\scenarios.js' -ForegroundColor Green

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
  [void]$js.AppendLine("window.FD_CHANGELOG = $clMin;")
  [void]$js.AppendLine("window.FD_DAILY = $dlMin;")
  [void]$js.AppendLine("window.FD_PROMPTS = $plMin;")
  [void]$js.AppendLine("window.FD_SCENARIOS = $scMin;")
  foreach ($m in [regex]::Matches($page, '<script src="([^"]+)"></script>')) {
    $code = Read-Text (Join-Path $root $m.Groups[1].Value)

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
