#!/bin/bash
# Upload reverse index chunks to Cloudflare KV
# This is for TESTING - uses a separate KV namespace
# Run: ./workers/upload_reverse_index_kv.sh

set -e

echo "🚀 Uploading Padakanaja reverse index to Cloudflare KV (TEST namespace)..."
echo "⚠️  Using TEST namespace: c0d0459e763b45c2816c8d26fb4771a1"
echo ""

# Check if wrangler is available
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx not found. Install Node.js first."
    exit 1
fi

# Use test namespace
KV_NAMESPACE_ID="c0d0459e763b45c2816c8d26fb4771a1"

# Upload chunk index (small file)
echo "📤 Uploading chunk index..."
npx wrangler kv key put --namespace-id=$KV_NAMESPACE_ID --remote padakanaja_reverse_index_chunk_index --path padakanaja/padakanaja_reverse_index_chunk_index.json

# Upload metadata
echo "📤 Uploading metadata..."
npx wrangler kv key put --namespace-id=$KV_NAMESPACE_ID --remote padakanaja_reverse_index_metadata --path padakanaja/padakanaja_reverse_index_metadata.json

# Upload all chunks
echo "📤 Uploading chunks (this may take a while)..."
for i in {1..13}; do
    if [ -f "padakanaja/padakanaja_reverse_index_part${i}.json" ]; then
        echo "  Uploading chunk ${i}/13..."
        npx wrangler kv key put --namespace-id=$KV_NAMESPACE_ID --remote padakanaja_reverse_index_part${i} --path padakanaja/padakanaja_reverse_index_part${i}.json
    fi
done

echo ""
echo "✅ Reverse index uploaded successfully!"
echo ""
echo "Next steps:"
echo "1. Create a TEST KV namespace: npx wrangler kv:namespace create DICTIONARY"
echo "2. Update wrangler.test.toml with the new namespace ID"
echo "3. Deploy test worker: npx wrangler deploy --config wrangler.test.toml workers/src/index.reverse.js"
echo "4. Test at: https://rala-search-test.YOUR_SUBDOMAIN.workers.dev/?q=test"

