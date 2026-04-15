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

## Metrics and logs

| Signal | How |
|--------|-----|
| **Primary search** (user direct search; synonym calls excluded) | `GET ?q=…` with header `X-Rala-Intent: primary`. Worker emits **`console.log` JSON** with `rala_event: "search_primary"` and **`q`** (search text, truncated). If `ANALYTICS` is bound in `wrangler.toml`, also writes **Analytics Engine** rows. |
| **PWA installed** | `POST /__rala/v1/event` body `{"e":"pwa_install"}` after `appinstalled`. |
| **Audio play** (optional) | `POST` body `{"e":"audio_play","w":"…"}` — Kannada headword for the row whose play button was pressed. |

### Viewing search terms and events in Cloudflare

1. **Real-time tail (best for local testing before push)**  
   From the `workers/` directory:
   ```bash
   npx wrangler tail --format pretty
   ```
   Leave it running, use the site (or `curl` the Worker with `X-Rala-Intent: primary`). Lines look like:  
   `{"rala_event":"search_primary","q":"house","ts":…}`.

2. **Dashboard (already deployed Worker)**  
   - **Workers & Pages** → **rala-search** → **Observability** → **Logs** (enable **Workers Logs** if prompted).  
   - Filter or search for `search_primary` / `audio_play` / `pwa_install` in the log viewer (exact UI varies by plan).

3. **Analytics Engine** (optional; **requires one-time account enable**)  
   If `wrangler deploy` fails with **code 10089** (“enable Analytics Engine”), open the URL Wrangler prints (`…/workers/analytics-engine`), turn **Analytics Engine** on for the account, then uncomment the `[[analytics_engine_datasets]]` block in `wrangler.toml` (binding `ANALYTICS`, dataset `rala_usage`) and deploy again.  
   Without that binding, **Worker Logs still contain every `search_primary` line with `q`**; you only skip AE SQL/charts.

If the `[[analytics_engine_datasets]]` block is commented out, **primary searches still appear in Worker Logs** via `console.log`; only Analytics Engine writes are skipped.

## Development

```bash
# Run locally
wrangler dev

# Deploy
wrangler deploy
```


