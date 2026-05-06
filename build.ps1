# Tower Defender — Windows Build & Release Script
# Usage: .\build.ps1 [command]
param(
    [Parameter(Position=0)]
    [ValidateSet("install","dev","build","clean","release","preview","test","typecheck","help")]
    [string]$Command = "help"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

function Show-Help {
    Write-Host "Tower Defender Build Tool" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\build.ps1 [command]" -ForegroundColor Green
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor Yellow
    Write-Host "  install    Install npm dependencies"
    Write-Host "  dev        Start Vite dev server (http://localhost:3000)"
    Write-Host "  build      TypeScript check + Vite production build"
    Write-Host "  clean      Remove dist/ output"
    Write-Host "  release    Full release: clean + typecheck + build"
    Write-Host "  preview    Build and preview production locally"
    Write-Host "  test       Run vitest unit tests"
    Write-Host "  typecheck  TypeScript check only (no emit)"
    Write-Host "  help       Show this help"
}

switch ($Command) {
    "install"   { npm install }
    "dev"       { npm run dev }
    "build"     { npm run build }
    "clean"     { npm run clean }
    "release"   { npm run release }
    "preview"   { npm run release:preview }
    "test"      { npm test }
    "typecheck" { npm run typecheck }
    "help"      { Show-Help }
    default     { Show-Help }
}
