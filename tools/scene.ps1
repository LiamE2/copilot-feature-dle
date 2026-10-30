<#
  Screenshot a scenario at a given viewport (the app runs inside an iframe so responsive breakpoints are accurate):
    powershell -ExecutionPolicy Bypass -File tools\scene.ps1 -Do win -Width 390 -Height 2400 -Out win-m.png
#>
param(
  [string]$Do = 'none', [string]$Hash = '', [int]$Width = 1280, [int]$Height = 1000,
  [Parameter(Mandatory)] [string]$Out, [string]$Base = 'http://localhost:8765', [int]$Budget = 15000
)
$q = "w=$Width&h=$Height&do=$Do" + $(if ($Hash) { "&hash=$([Uri]::EscapeDataString($Hash))" } else { '' })
$url = "$Base/tests/scenario.html?$q"
& (Join-Path $PSScriptRoot 'shot.ps1') -Url $url -Out $Out -Width ($Width + 16) -Height ($Height + 16) -Budget $Budget
