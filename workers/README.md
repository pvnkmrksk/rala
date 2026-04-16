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
| **R2 archival** (optional) | If `LOG_ARCHIVE` bucket binding exists, each custom event is written to `events/YYYY/MM/DD/HH/<ts>-<uuid>.json`. |

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

3. **R2 archive API for local dashboard**  
   - Set a secret token once:
     ```bash
     npx wrangler secret put LOG_DASHBOARD_TOKEN
     ```
   - Query recent archived events:
     ```bash
     curl "https://rala-search.rala-search.workers.dev/__rala/v1/archive?hours=24&limit=1000" \
       -H "X-Rala-Dashboard-Token: <token>"
     ```
   - Optional filter by event:
     `...&event=search_primary` (or `audio_play`, `pwa_install`).

## Local dashboard

The repo includes a simple dashboard at `tools/log-dashboard/` that reads from
`/__rala/v1/archive` and shows chronology, top words, geo split, plus raw JSON.

Run locally:

```bash
cd /Users/pavan/src/rala
python3 -m http.server 8090
```

Open:

- `http://127.0.0.1:8090/tools/log-dashboard/`

Enter:

- Worker URL (`https://rala-search.rala-search.workers.dev`)
- `LOG_DASHBOARD_TOKEN`

## Development

```bash
# Run locally
wrangler dev

# Deploy
wrangler deploy
```


