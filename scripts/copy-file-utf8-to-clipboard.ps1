param(
  [Parameter(Mandatory = $true)]
  [string]$Path
)

$resolved = Resolve-Path -LiteralPath $Path
$text = [System.IO.File]::ReadAllText($resolved, [System.Text.Encoding]::UTF8)
Set-Clipboard -Value $text
Write-Output "Copied UTF-8 text to clipboard: $resolved"
