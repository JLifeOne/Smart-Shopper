param(
  [Parameter(Mandatory=$true)][string]$ProjectRef,
  [Parameter(Mandatory=$true)][string]$AnonKey,
  [Parameter(Mandatory=$true)][string]$ServiceKey
)

$Headers = @{
  "Authorization" = "Bearer $ServiceKey"
  "apikey" = "$AnonKey"
  "Content-Type" = "application/json"
}

$Base = "https://$ProjectRef.functions.supabase.co"

Write-Host "Testing brand-insights-job..." -ForegroundColor Cyan
try {
  $t0 = Get-Date
  $r = Invoke-WebRequest -Method Post -Uri "$Base/brand-insights-job" -Headers $Headers -Body "{}"
  $ms = ((Get-Date) - $t0).TotalMilliseconds
  Write-Host "Status: $($r.StatusCode) (${ms}ms)" -ForegroundColor Green
  Write-Output $r.Content
} catch {
  Write-Host "brand-insights-job failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Testing brand-resolve..." -ForegroundColor Cyan
try {
  $body = '{"rawName":"Grace Baked Beans 300g","storeId":null}'
  $t0 = Get-Date
  $r = Invoke-WebRequest -Method Post -Uri "$Base/brand-resolve" -Headers $Headers -Body $body
  $ms = ((Get-Date) - $t0).TotalMilliseconds
  Write-Host "Status: $($r.StatusCode) (${ms}ms)" -ForegroundColor Green
  Write-Output $r.Content
} catch {
  Write-Host "brand-resolve failed: $($_.Exception.Message)" -ForegroundColor Red
}

