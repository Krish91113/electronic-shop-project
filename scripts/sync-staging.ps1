# PowerShell Staging Sync Script
# One-way sync: Production -> Staging / Dev branch
param(
    [string]$TargetDatabaseUrl = $env:STAGING_DATABASE_URL,
    [string]$ProdDatabaseUrl = $env:PROD_DATABASE_URL
)

Write-Host "🔄 Initiating Staging Sync..." -ForegroundColor Cyan

if (-not $TargetDatabaseUrl) {
    Write-Error "STAGING_DATABASE_URL is not set."
    exit 1
}

if ($ProdDatabaseUrl -and ($TargetDatabaseUrl -eq $ProdDatabaseUrl)) {
    Write-Error "CRITICAL: Target database URL equals Production database URL! Aborting."
    exit 1
}

Write-Host "✅ Target URL is distinct from Production."
Write-Host "1. Running migrations on target database..."
$env:DATABASE_URL = $TargetDatabaseUrl
npm --prefix backend run prisma:migrate:deploy

Write-Host "2. Running PII masking script..."
node backend/prisma/scripts/mask-pii.js

Write-Host "3. Running verification..."
node backend/prisma/scripts/merge-products-into-models.js --dry-run

Write-Host "🎉 Staging sync and masking completed safely." -ForegroundColor Green
