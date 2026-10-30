<#
  Copilot Feature-dle  - link checker. Every "Learn more" link in data\features.json should open a real Microsoft page.
    powershell -ExecutionPolicy Bypass -File tools\check-links.ps1
#>
param([string]$Json = (Join-Path $PSScriptRoot '..\data\features.json'))
$lib = [System.IO.File]::ReadAllText((Resolve-Path $Json), [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$items = @($lib.features | Where-Object { $_.learnMore } | ForEach-Object { [pscustomobject]@{ Name = $_.name; Url = $_.learnMore } })
Write-Host "Checking $($items.Count) links..." -ForegroundColor Cyan
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
$results = $items | ForEach-Object -Begin { } -Process {
  $it = $_
  $status = 0; $final = $it.Url; $note = ''
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $it.Url -Method Get -UserAgent $ua -MaximumRedirection 8 -TimeoutSec 30 -ErrorAction Stop
    $status = [int]$r.StatusCode; $final = $r.BaseResponse.ResponseUri.AbsoluteUri
  } catch {
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode } else { $status = -1; $note = $_.Exception.Message }
  }
  [pscustomobject]@{ Name = $it.Name; Status = $status; Url = $it.Url; Final = $final; Note = $note }
}
$bad = @($results | Where-Object { $_.Status -lt 200 -or $_.Status -ge 400 })
$moved = @($results | Where-Object { $_.Status -eq 200 -and $_.Final -ne $_.Url })
$results | Sort-Object Status, Name | ForEach-Object { '{0,4}  {1,-38} {2}' -f $_.Status, $_.Name, $_.Url } | Write-Host
if ($moved.Count) { Write-Host "`nRedirected (still fine, but you may want to update the link):" -ForegroundColor Yellow; $moved | ForEach-Object { Write-Host ("  {0}`n    -> {1}" -f $_.Url, $_.Final) } }
if ($bad.Count) { Write-Host "`n$($bad.Count) link(s) need attention." -ForegroundColor Red; exit 1 } else { Write-Host "`nAll $($items.Count) links responded OK." -ForegroundColor Green }
