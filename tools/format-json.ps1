<#
  Copilot Feature-dle - tidy data\features.json
  Rewrites the library with a friendly, stable layout (2-space indent, one hint per line, real apostrophes and
  ampersands instead of \u0027 / \u0026) so it is pleasant to edit by hand and gives clean diffs.

    powershell -ExecutionPolicy Bypass -File tools\format-json.ps1
    powershell -ExecutionPolicy Bypass -File tools\format-json.ps1 -Check     # only report whether the file is already tidy

  The content is never changed: the script re-reads its own output and refuses to save if anything differs.
#>
param(
  [string]$Json = (Join-Path $PSScriptRoot '..\data\features.json'),
  [switch]$Check
)
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$inv = [Globalization.CultureInfo]::InvariantCulture

function Q([string]$s) {
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.Append('"')
  foreach ($ch in $s.ToCharArray()) {
    $n = [int]$ch
    if ($ch -ceq '"') { [void]$sb.Append('\"') }
    elseif ($ch -ceq '\') { [void]$sb.Append('\\') }
    elseif ($n -eq 10) { [void]$sb.Append('\n') }
    elseif ($n -eq 13) { [void]$sb.Append('\r') }
    elseif ($n -eq 9) { [void]$sb.Append('\t') }
    elseif ($n -lt 32 -or $n -eq 0x2028 -or $n -eq 0x2029) { [void]$sb.Append(('\u{0:x4}' -f $n)) }
    else { [void]$sb.Append($ch) }
  }
  [void]$sb.Append('"')
  $sb.ToString()
}

function Fmt($v, [int]$level) {
  $pad = '  ' * $level
  $pad1 = '  ' * ($level + 1)
  if ($null -eq $v) { return 'null' }
  if ($v -is [bool]) { if ($v) { return 'true' } else { return 'false' } }
  if ($v -is [string]) { return (Q $v) }
  if ($v -is [int] -or $v -is [long] -or $v -is [double] -or $v -is [decimal]) { return [string]::Format($inv, '{0}', $v) }
  if ($v -is [System.Array]) {
    $items = @($v)
    if ($items.Count -eq 0) { return '[]' }
    $nested = @($items | Where-Object { $_ -is [System.Management.Automation.PSCustomObject] -or $_ -is [System.Array] })
    # short lists of plain values (aliases, tags, packs...) stay on one line; hints and use cases get a line each
    if (-not $nested.Count) {
      $one = '[' + ((@($items | ForEach-Object { Fmt $_ 0 })) -join ', ') + ']'
      if ($one.Length + $pad1.Length + 20 -le 110) { return $one }
    }
    $lines = @($items | ForEach-Object { $pad1 + (Fmt $_ ($level + 1)) })
    return "[`n" + ($lines -join ",`n") + "`n$pad]"
  }
  if ($v -is [System.Management.Automation.PSCustomObject]) {
    $props = @($v.PSObject.Properties)
    if ($props.Count -eq 0) { return '{}' }
    $lines = @($props | ForEach-Object { $pad1 + (Q $_.Name) + ': ' + (Fmt $_.Value ($level + 1)) })
    return "{`n" + ($lines -join ",`n") + "`n$pad}"
  }
  return (Q ([string]$v))
}

$path = (Resolve-Path $Json).Path
$orig = [System.IO.File]::ReadAllText($path, $utf8)
$data = $orig | ConvertFrom-Json
$text = (Fmt $data 0) + "`n"

# safety net: the tidy copy must parse back to exactly the same content
$same = (($text | ConvertFrom-Json | ConvertTo-Json -Depth 30 -Compress) -ceq ($data | ConvertTo-Json -Depth 30 -Compress))
if (-not $same) { throw 'Formatting would change the content - nothing was written.' }

if ($Check) {
  if ($text -ceq $orig) { Write-Host 'features.json is already tidy.' -ForegroundColor Green } else { Write-Host 'features.json is valid but not tidy. Run tools\format-json.ps1 to tidy it.' -ForegroundColor Yellow; exit 1 }
  return
}
if ($text -ceq $orig) { Write-Host 'features.json was already tidy.' -ForegroundColor Green; return }
[System.IO.File]::WriteAllText($path, $text, $utf8)
Write-Host ("Tidied {0} ({1:N0} KB -> {2:N0} KB, {3} lines)." -f $path, ($orig.Length / 1KB), ($text.Length / 1KB), ($text -split "`n").Count) -ForegroundColor Green
