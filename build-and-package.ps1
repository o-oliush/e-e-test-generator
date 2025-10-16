Write-Host "Building package..." -ForegroundColor Green

# Clean deployment package directory
if (Test-Path "deployment-package") {
    Write-Host "Cleaning old deployment package..." -ForegroundColor Yellow
    Remove-Item "deployment-package" -Recurse -Force
}

# Build .NET
Push-Location "dotnet-wrapper"
dotnet publish -c Release -o "../deployment-package" --verbosity quiet
Pop-Location

# Copy Node.js application files
Write-Host "Copying Node.js application files..." -ForegroundColor Yellow

# Copy all .js files (server.js, testResultAnalyzer.js, etc.)
Get-ChildItem -Path "." -Filter "*.js" -File | ForEach-Object {
    Copy-Item $_.FullName -Destination "deployment-package" -Force
    Write-Host "  Copied: $($_.Name)" -ForegroundColor Gray
}

# Copy package.json
Copy-Item "package.json" -Destination "deployment-package" -Force -ErrorAction SilentlyContinue

# Copy web.config
Copy-Item "web.config" -Destination "deployment-package" -Force -ErrorAction SilentlyContinue

# Copy public directory
if (Test-Path "public") {
    Copy-Item "public" -Destination "deployment-package" -Recurse -Force
    Write-Host "  Copied: public/" -ForegroundColor Gray
}

# Create required directories
New-Item -Path "deployment-package/tests" -ItemType Directory -Force | Out-Null
New-Item -Path "deployment-package/uploads" -ItemType Directory -Force | Out-Null

# Install npm dependencies
Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    npm install
}
Copy-Item "node_modules" -Destination "deployment-package" -Recurse -Force

Write-Host "Package ready in: deployment-package" -ForegroundColor Green
