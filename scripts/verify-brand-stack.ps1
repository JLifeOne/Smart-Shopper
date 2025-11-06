param(
  [Parameter(Mandatory=$true)][string]$ProjectRef,
  [Parameter(Mandatory=$true)][string]$AnonKey,
  [string]$ServiceKey
)

if ([string]::IsNullOrWhiteSpace($ServiceKey)) {
  $ServiceKey = $AnonKey
}

$Headers = @{
  "Authorization" = "Bearer $ServiceKey"
  "apikey" = "$AnonKey"
  "Content-Type" = "application/json"
}

$Base = "https://$ProjectRef.functions.supabase.co"

function Invoke-WebRequestSafe {
  param(
    [Parameter(Mandatory=$true)][string]$Url,
    [Parameter(Mandatory=$true)][ValidateSet('GET','POST')][string]$Method,
    [hashtable]$Headers,
    [string]$Body
  )
  try {
    $resp = Invoke-WebRequest -Method $Method -Uri $Url -Headers $Headers -Body $Body -ErrorAction Stop
    [pscustomobject]@{ StatusCode = $resp.StatusCode; Content = $resp.Content }
  } catch {
    $we = $_.Exception
    $status = $null
    $content = $null
    if ($we.Response) {
      try { $status = [int]$we.Response.StatusCode } catch { $status = 0 }
      try {
        $sr = New-Object System.IO.StreamReader($we.Response.GetResponseStream())
        $content = $sr.ReadToEnd()
        $sr.Dispose()
      } catch { $content = $we.Message }
    } else {
      $content = $we.Message
    }
    [pscustomobject]@{ StatusCode = $status; Content = $content }
  }
}

Write-Host "Testing brand-insights-job..." -ForegroundColor Cyan
$t0 = Get-Date
$r = Invoke-WebRequestSafe -Method POST -Url "$Base/brand-insights-job" -Headers $Headers -Body "{}"
$ms = ((Get-Date) - $t0).TotalMilliseconds
$color = if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) { 'Green' } else { 'Yellow' }
Write-Host "Status: $($r.StatusCode) (${ms}ms)" -ForegroundColor $color
Write-Output $r.Content

Write-Host "Testing brand-resolve..." -ForegroundColor Cyan
$body = '{"rawName":"Grace Baked Beans 300g","storeId":null}'
$t0 = Get-Date
$r = Invoke-WebRequestSafe -Method POST -Url "$Base/brand-resolve" -Headers $Headers -Body $body
$ms = ((Get-Date) - $t0).TotalMilliseconds
$color = if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) { 'Green' } else { 'Yellow' }
Write-Host "Status: $($r.StatusCode) (${ms}ms)" -ForegroundColor $color
Write-Output $r.Content
