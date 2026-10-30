<#
  Headless screenshot helper (uses the Chrome/Edge already on this PC).
    powershell -ExecutionPolicy Bypass -File tools\shot.ps1 -Url "http://localhost:8765/?nowelcome#/stats" -Out shot.png -Width 1280 -Height 1000
#>
param(
  [Parameter(Mandatory)] [string]$Url,
  [Parameter(Mandatory)] [string]$Out,
  [int]$Width = 1280,
  [int]$Height = 1000,
  [int]$Budget = 4000,
  [switch]$Dom
)
$browser = @("C:\Program Files\Google\Chrome\Application\chrome.exe", "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'No Chrome or Edge found.' }
$profileDir = Join-Path $env:TEMP ('fd-shot-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$common = @("--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--user-data-dir=$profileDir", "--window-size=$Width,$Height", "--virtual-time-budget=$Budget")
if ($Dom) {
  & $browser @common "--dump-dom" $Url 2>$null | Out-File -FilePath $Out -Encoding utf8
} else {
  & $browser @common "--screenshot=$Out" $Url 2>$null | Out-Null
}
Remove-Item -Recurse -Force $profileDir -ErrorAction SilentlyContinue
