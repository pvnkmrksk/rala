# Rala Search Worker

Cloudflare Worker for server-side dictionary search.

## Setup

1. Follow instructions in `../CLOUDFLARE_SETUP.md`

2. Update `wrangler.toml` with your KV namespace ID:
   ```toml
   [[kv_namespaces]]
   binding = "DICTIONARY"
   id = "YOUR_NAMESPACE_ID"  # Replace this!
   ```

3. Upload dictionary to KV:
   ```bash
   wrangler kv:key put "combined_dictionaries_ultra" \
     --path=../padakanaja/combined_dictionaries_ultra.json \
     --namespace-id=YOUR_NAMESPACE_ID
   ```

4. Deploy:
   ```bash
   wrangler deploy
   ```

## API Usage

### GET Request
```
https://your-worker.workers.dev/?q=hello
```

### POST Request
```json
POST https://your-worker.workers.dev
Content-Type: application/json

{
  "query": "hello"
}
```

### Response
```json
{
  "query": "hello",
  "results": [
    {
      "kannada": "ನಮಸ್ಕಾರ",
      "definition": "hello",
      "type": "Noun",
      "source": "padakanaja",
      "dict_title": "...",
      "matchedWord": "hello",
      "matchType": "direct"
    }
  ],
  "count": 1
}
```

## Development

```bash
# Run locally
wrangler dev

# Deploy
wrangler deploy
```

