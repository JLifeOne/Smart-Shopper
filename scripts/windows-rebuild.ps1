param()

$ErrorActionPreference = 'Stop'

function Invoke-Step {
    param(
        [string]$Title,
        [scriptblock]$Action
    )
    Write-Host "`n=== $Title ===" -ForegroundColor Cyan
    & $Action
    $exit = $LASTEXITCODE
    if ($exit -ne 0) {
        throw "Step '$Title' failed with exit code $exit"
    }
}

function Remove-Path {
    param(
        [string]$Path
    )
    if (Test-Path $Path) {
        Write-Host "Removing $Path" -ForegroundColor DarkGray
        Remove-Item -Recurse -Force $Path
    }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot
Write-Host "Smart Shopper • Windows rebuild" -ForegroundColor Green

Invoke-Step "Stop Metro/Expo processes" {
    $processes = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
        $_.Path -and ($_.Path -like '*expo*' -or $_.Path -like '*metro*')
    }
    foreach ($proc in $processes) {
        Write-Host "Stopping process $($proc.Id) ($($proc.Path))" -ForegroundColor DarkGray
        $proc | Stop-Process -Force -ErrorAction SilentlyContinue
    }
}

Invoke-Step "Clear JS caches" {
    $cachePaths = @(
        'apps/mobile/.expo',
        'apps/mobile/.expo-shared',
        'apps/mobile/.cache',
        'apps/mobile/node_modules/.cache/metro'
    )
    foreach ($path in $cachePaths) {
        Remove-Path $path
    }
}

Invoke-Step "Clear Android build artifacts" {
    $androidPaths = @(
        'apps/mobile/android/app/.cxx',
        'apps/mobile/android/app/build/generated',
        'apps/mobile/android/app/build/intermediates',
        'apps/mobile/android/app/build/outputs/apk'
    )
    foreach ($path in $androidPaths) {
        Remove-Path $path
    }
}

Push-Location 'apps/mobile/android'
Invoke-Step "Gradle --stop" { & .\gradlew.bat --stop }
Invoke-Step "Gradle clean" { & .\gradlew.bat clean }
Invoke-Step "Generate codegen artifacts" { & .\gradlew.bat -Pkotlin.incremental=false :app:generateCodegenArtifactsFromSchema }
Invoke-Step "Assemble debug build" { & .\gradlew.bat :app:assembleDebug }
Invoke-Step "Install debug build" { & .\gradlew.bat :app:installDebug }
Pop-Location

Write-Host '`nRebuild complete. Restart Metro with:`' -ForegroundColor Green
Write-Host '  pnpm --filter @smart-shopper/mobile start' -ForegroundColor Yellow
Write-Host '  Run the command below before launching:' -ForegroundColor Yellow
Write-Host '    pnpm --filter @smart-shopper/mobile verify' -ForegroundColor Yellow