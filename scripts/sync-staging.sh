#!/usr/bin/env bash
set -euo pipefail

TARGET_URL="${STAGING_DATABASE_URL:-${DATABASE_URL:-}}"
PROD_URL="${PROD_DATABASE_URL:-}"

echo "🔄 Initiating Staging Sync..."

if [ -z "$TARGET_URL" ]; then
    echo "❌ Error: STAGING_DATABASE_URL or DATABASE_URL is not set." >&2
    exit 1
fi

if [ -n "$PROD_URL" ] && [ "$TARGET_URL" = "$PROD_URL" ]; then
    echo "❌ CRITICAL: Target database URL equals Production database URL! Aborting." >&2
    exit 1
fi

echo "✅ Target URL verified safe."
echo "1. Running migrations on target database..."
DATABASE_URL="$TARGET_URL" npm --prefix backend run prisma:migrate:deploy

echo "2. Running PII masking script..."
DATABASE_URL="$TARGET_URL" node backend/prisma/scripts/mask-pii.js

echo "3. Running verification..."
DATABASE_URL="$TARGET_URL" node backend/prisma/scripts/merge-products-into-models.js --dry-run

echo "🎉 Staging sync completed safely."
