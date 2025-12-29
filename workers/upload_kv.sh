#!/bin/bash
# Upload dictionary chunks to Cloudflare KV

NAMESPACE_ID="3c0a155119644621bd656231b4ec9063"
BASE_DIR="../padakanaja"

echo "Uploading English reverse index chunks to Cloudflare KV..."
echo "Namespace ID: $NAMESPACE_ID"
echo ""

# Upload metadata
echo "Uploading metadata..."
npx wrangler kv key put --remote "english_reverse_index_metadata" \
  --path="$BASE_DIR/english_reverse_index_metadata.json" \
  --namespace-id=$NAMESPACE_ID

# Upload all chunks
for i in {1..21}; do
  if [ -f "$BASE_DIR/english_reverse_index_part$i.json" ]; then
    echo "Uploading chunk $i/21..."
    npx wrangler kv key put --remote "english_reverse_index_part$i" \
      --path="$BASE_DIR/english_reverse_index_part$i.json" \
      --namespace-id=$NAMESPACE_ID
  fi
done

echo ""
echo "✓ Upload complete!"
