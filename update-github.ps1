$ErrorActionPreference = "Stop"

Set-Location -LiteralPath $PSScriptRoot

Write-Host "Thai Asia Map - update GitHub"
Write-Host "Repo: $PSScriptRoot"
Write-Host ""

$targetFiles = @(
  "index.html",
  "manifest.json",
  "sw.js",
  "icon-180.png",
  "icon-192.png",
  "icon-512.png",
  "shipper-car-top.png",
  "shipper-car-side.png",
  "Update-GitHub.bat",
  "update-github.ps1"
)

$stagedFiles = @(git diff --cached --name-only)
$unexpectedStaged = @($stagedFiles | Where-Object { $targetFiles -notcontains $_ })

if ($unexpectedStaged.Count -gt 0) {
  Write-Host "There are already staged files outside the app update list:" -ForegroundColor Red
  $unexpectedStaged | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  Write-Host ""
  Write-Host "Unstage them first, then run this button again."
  exit 1
}

$modifiedFiles = @(git diff --name-only -- $targetFiles)
$cachedFiles = @(git diff --cached --name-only -- $targetFiles)
$untrackedFiles = @(git ls-files --others --exclude-standard -- $targetFiles)
$changedFiles = @($modifiedFiles + $cachedFiles + $untrackedFiles | Sort-Object -Unique)

if ($changedFiles.Count -eq 0) {
  Write-Host "No app changes to commit."
  exit 0
}

Write-Host "Files to update:"
$changedFiles | ForEach-Object { Write-Host "  $_" }
Write-Host ""

git add -- $changedFiles
if ($LASTEXITCODE -ne 0) {
  throw "git add failed"
}

$message = "Update app " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
git commit -m $message
if ($LASTEXITCODE -ne 0) {
  throw "git commit failed"
}

git push origin main
if ($LASTEXITCODE -ne 0) {
  throw "git push failed"
}

Write-Host ""
Write-Host "Done. GitHub has been updated." -ForegroundColor Green
