#!/bin/bash
# Upload merged dictionary chunks to Cloudflare KV

KV_NAMESPACE="3c0a155119644621bd656231b4ec9063"

echo "Uploading merged dictionary chunks to KV..."
for i in {1..10}; do
    echo "  Uploading part $i..."
    npx wrangler kv:key put "merged_dictionary_part$i" --path="padakanaja/merged_dictionary_part$i.json" --namespace-id="$KV_NAMESPACE" --remote
done

echo "✓ Done!"
