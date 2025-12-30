#!/bin/bash
# Revert production worker back to linear search
# Run: ./workers/revert_to_linear.sh

set -e

cd "$(dirname "$0")"

if [ ! -f "src/index.backup.js" ]; then
    echo "❌ Error: Backup file not found (src/index.backup.js)"
    exit 1
fi

echo "🔄 Reverting production worker to linear search..."
cp src/index.backup.js src/index.js
echo "✅ Restored backup worker code"

echo "🚀 Deploying..."
npx wrangler deploy

echo ""
echo "✅ Production reverted to linear search!"
echo "   Note: Reverse index chunks are still in KV (harmless)"

