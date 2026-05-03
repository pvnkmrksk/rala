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
| **Primary search** (user direct search; synonym calls excluded) | `GET ?q=…` with header `X-Rala-Intent: primary`. Worker emits versioned JSON logs (`event_version`, `log_level`) with `rala_event: "search_primary"` and `q` (search text, truncated), plus rough geo/network context in `ctx`. |
| **PWA installed** | `POST /__rala/v1/event` body `{"e":"pwa_install"}` after `appinstalled`. |
| **Audio play** (optional) | `POST` body `{"e":"audio_play","w":"…"}` — Kannada headword for the row whose play button was pressed. |
| **R2 archival** (optional) | If `LOG_ARCHIVE` bucket binding exists, events are written under UTC hour folders. Default: `events/YYYY/MM/DD/HH/<ts>-<uuid>.json`. **User feedback** uses its own prefix: `events/user_feedback/YYYY/MM/DD/HH/<ts>-<uuid>.json` (same JSON shape, `rala_event: "user_feedback"`, `w` = text). Filter in R2 by prefix `events/user_feedback/` or via archive API `event=user_feedback`. |

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
   - Filter or search for `search_primary` / `audio_play` / `pwa_install` / `user_feedback` in the log viewer (exact UI varies by plan).

3. **R2 durable archive (raw JSON events)**  
   With `LOG_ARCHIVE` bound, each event is stored as its own JSON object in R2.
   Default path: `events/YYYY/MM/DD/HH/<ts>-<uuid>.json`. **User feedback** from the site is under **`events/user_feedback/YYYY/MM/DD/HH/`** so you can filter by prefix or by `rala_event` in JSON. Use Cloudflare R2 tools/UI to download and analyze offline for custom dashboards.

## Development

```bash
# Run locally
wrangler dev

# Deploy
wrangler deploy
```


