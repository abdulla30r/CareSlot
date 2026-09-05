Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   CareSlot Production Package Builder   " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Build Angular Client
Write-Host "`n[1/3] Building Angular 22 SPA..." -ForegroundColor Yellow
Push-Location CareSlot.Client
npm run build
Pop-Location

# 2. Bundle Frontend into CareSlot.API/wwwroot
Write-Host "`n[2/3] Bundling frontend into API wwwroot..." -ForegroundColor Yellow
if (Test-Path "CareSlot.API/wwwroot") {
    Remove-Item "CareSlot.API/wwwroot" -Recurse -Force
}
New-Item -ItemType Directory -Path "CareSlot.API/wwwroot" -Force | Out-Null

if (Test-Path "CareSlot.Client/dist/CareSlot.Client/browser") {
    Copy-Item -Path "CareSlot.Client/dist/CareSlot.Client/browser/*" -Destination "CareSlot.API/wwwroot/" -Recurse -Force
} elseif (Test-Path "CareSlot.Client/dist/CareSlot.Client") {
    Copy-Item -Path "CareSlot.Client/dist/CareSlot.Client/*" -Destination "CareSlot.API/wwwroot/" -Recurse -Force
}

# 3. Publish .NET API to ./publish
Write-Host "`n[3/3] Publishing ASP.NET Core Release bundle..." -ForegroundColor Yellow
dotnet publish CareSlot.API/CareSlot.API.csproj -c Release -o ./publish

# 4. Create CareSlot-Deploy.zip for 1-click deployment
Write-Host "`n[4/4] Compressing to CareSlot-Deploy.zip..." -ForegroundColor Yellow
if (Test-Path ".\CareSlot-Deploy.zip") {
    Remove-Item ".\CareSlot-Deploy.zip" -Force
}
Compress-Archive -Path .\publish\* -DestinationPath .\CareSlot-Deploy.zip -Force

Write-Host "`n=========================================" -ForegroundColor Green
Write-Host "SUCCESS! Deployment zip created: ./CareSlot-Deploy.zip" -ForegroundColor Green
Write-Host "Upload and Unpack CareSlot-Deploy.zip in MonsterASP.net File Manager." -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

