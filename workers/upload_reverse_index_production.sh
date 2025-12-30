#!/bin/bash
# Upload reverse index to PRODUCTION KV namespace
set -e

PROD_KV_NAMESPACE_ID="3c0a155119644621bd656231b4ec9063"

echo "🚀 Uploading reverse index to PRODUCTION KV namespace..."
echo "⚠️  Namespace ID: $PROD_KV_NAMESPACE_ID"
echo ""

# Upload chunk index
echo "📤 Uploading chunk index..."
npx wrangler kv key put --namespace-id=$PROD_KV_NAMESPACE_ID --remote padakanaja_reverse_index_chunk_index --path padakanaja/padakanaja_reverse_index_chunk_index.json

# Upload metadata
echo "📤 Uploading metadata..."
npx wrangler kv key put --namespace-id=$PROD_KV_NAMESPACE_ID --remote padakanaja_reverse_index_metadata --path padakanaja/padakanaja_reverse_index_metadata.json

# Upload all chunks
echo "📤 Uploading chunks..."
for i in {1..13}; do
    if [ -f "padakanaja/padakanaja_reverse_index_part${i}.json" ]; then
        echo "  Uploading chunk ${i}/13..."
        npx wrangler kv key put --namespace-id=$PROD_KV_NAMESPACE_ID --remote padakanaja_reverse_index_part${i} --path padakanaja/padakanaja_reverse_index_part${i}.json
    fi
done

echo ""
echo "✅ Reverse index uploaded to production!"
