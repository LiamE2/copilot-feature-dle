<#
  Run the browser tests headlessly (needs the local server running, see tools\serve.ps1):
    powershell -ExecutionPolicy Bypass -File tools\test.ps1            # unit + end-to-end flows, about a minute
  Exit code 0 = all passed.

  Accessibility (axe-core, WCAG 2.2 A/AA on every screen, dialog and game state) needs a real browser tab,
  because the headless runner can't wait long enough: with the server running, open
    http://localhost:8080/tests/e2e.html?axe=1
  in Chrome or Edge and wait for the tab title to change to "DONE OK".
#>
param([string]$Base = 'http://localhost:8765', [int]$Budget = 90000)
$tmp = Join-Path $env:TEMP ('fd-test-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.html')
& (Join-Path $PSScriptRoot 'shot.ps1') -Url "$Base/tests/e2e.html" -Out $tmp -Dom -Budget $Budget -Width 1400 -Height 1000
if (-not (Test-Path $tmp)) { Write-Host 'No output from the browser.' -ForegroundColor Red; exit 2 }
$text = [System.IO.File]::ReadAllText($tmp, [System.Text.Encoding]::UTF8)
Remove-Item $tmp -ErrorAction SilentlyContinue
$lines = [regex]::Matches($text, '<div class="(pass|fail|)">([^<]*)</div>') | ForEach-Object { [pscustomobject]@{ Cls = $_.Groups[1].Value; Text = [System.Net.WebUtility]::HtmlDecode($_.Groups[2].Value) } }
foreach ($l in $lines) { if ($l.Cls -eq 'fail') { Write-Host $l.Text -ForegroundColor Red } elseif ($l.Cls -eq 'pass') { Write-Host $l.Text -ForegroundColor DarkGreen } else { Write-Host $l.Text } }
if ($text -notmatch 'SUMMARY') { Write-Host 'Test run did not finish (increase -Budget?).' -ForegroundColor Yellow; exit 2 }
if ($text -match 'class="fail">SUMMARY') { exit 1 }
