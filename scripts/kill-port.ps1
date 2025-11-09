param(
  [Parameter(Mandatory=$true)][int]$Port
)

$ErrorActionPreference = 'Stop'

Write-Host "Closing processes bound to port $Port..." -ForegroundColor Cyan

try {
  $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction Stop
} catch {
  # Fallback for older PowerShell versions
  $lines = & netstat -ano | Select-String ":$Port\s"
  $pids = @()
  foreach ($l in $lines) {
    $cols = ($l -split "\s+") | Where-Object { $_ -ne '' }
    if ($cols.Length -ge 5) { $pids += [int]$cols[-1] }
  }
  $pids = $pids | Sort-Object -Unique
  foreach ($pid in $pids) {
    try { Stop-Process -Id $pid -Force -ErrorAction Stop; Write-Host "Killed PID $pid" -ForegroundColor DarkGray } catch {}
  }
  if ($pids.Count -eq 0) { Write-Host "No processes found on port $Port" -ForegroundColor Yellow }
  exit 0
}

$pids = $conns | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique
if (-not $pids -or $pids.Count -eq 0) {
  Write-Host "No processes found on port $Port" -ForegroundColor Yellow
  exit 0
}

foreach ($pid in $pids) {
  try {
    Stop-Process -Id $pid -Force -ErrorAction Stop
    Write-Host "Killed PID $pid" -ForegroundColor DarkGray
  } catch {}
}

Write-Host "Done." -ForegroundColor Green

