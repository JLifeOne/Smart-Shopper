<#
.SYNOPSIS
Fetch a Supabase JWT (password grant) and invoke the menu-regenerate edge function.

.NOTES
- Do not hardcode secrets. Prefer env vars or a local, untracked PowerShell profile.
- Requires a user that owns the target recipeId.

Env vars (optional):
  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_EMAIL, SUPABASE_PASSWORD
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$SupabaseUrl = $env:SUPABASE_URL,

  [Parameter(Mandatory = $false)]
  [string]$AnonKey = $env:SUPABASE_ANON_KEY,

  [Parameter(Mandatory = $false)]
  [string]$Email = $env:SUPABASE_EMAIL,

  [Parameter(Mandatory = $false)]
  [string]$Password = $env:SUPABASE_PASSWORD,

  [Parameter(Mandatory = $true)]
  [string]$RecipeId,

  [Parameter(Mandatory = $false)]
  [string]$SessionId,

  [Parameter(Mandatory = $false)]
  [int]$Servings,

  [Parameter(Mandatory = $false)]
  [string]$Title,

  [Parameter(Mandatory = $false)]
  [string]$CuisineStyle
)

function Require-Value([string]$Name, [string]$Value) {
  if (-not $Value -or -not $Value.Trim()) {
    throw "Missing required value: $Name"
  }
}

Require-Value -Name "SupabaseUrl" -Value $SupabaseUrl
Require-Value -Name "AnonKey" -Value $AnonKey
Require-Value -Name "Email" -Value $Email
Require-Value -Name "Password" -Value $Password
Require-Value -Name "RecipeId" -Value $RecipeId

$baseUrl = $SupabaseUrl.TrimEnd('/')
$correlationId = "menu-regenerate-$([guid]::NewGuid().ToString('N'))"
$idempotencyKey = $correlationId

Write-Host "CorrelationId: $correlationId"
Write-Host "IdempotencyKey: $idempotencyKey"

$tokenUrl = "$baseUrl/auth/v1/token?grant_type=password"
$tokenHeaders = @{
  apikey = $AnonKey
  "Content-Type" = "application/json"
}
$tokenBody = @{
  email = $Email
  password = $Password
} | ConvertTo-Json

try {
  $token = Invoke-RestMethod -Method Post -Uri $tokenUrl -Headers $tokenHeaders -Body $tokenBody
} catch {
  Write-Error "Failed to fetch JWT via password grant. $_"
  throw
}

if (-not $token.access_token) {
  throw "No access_token returned from Supabase."
}

$fnUrl = "$baseUrl/functions/v1/menu-regenerate"
$fnHeaders = @{
  apikey = $AnonKey
  Authorization = "Bearer $($token.access_token)"
  "Content-Type" = "application/json"
  "Idempotency-Key" = $idempotencyKey
  "x-correlation-id" = $correlationId
}

$payload = @{
  recipeId = $RecipeId
  sessionId = if ($SessionId) { $SessionId } else { $null }
}
if ($Servings) { $payload.servings = $Servings }
if ($Title) { $payload.title = $Title }
if ($CuisineStyle) { $payload.cuisineStyle = $CuisineStyle }

$body = $payload | ConvertTo-Json

try {
  $result = Invoke-RestMethod -Method Post -Uri $fnUrl -Headers $fnHeaders -Body $body
  $result | ConvertTo-Json -Depth 10
} catch {
  Write-Error "menu-regenerate call failed. $_"
  throw
}

