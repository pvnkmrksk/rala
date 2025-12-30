# Reverse Index Testing Guide

This branch (`reverse-index-optimization`) implements a reverse index for O(1) dictionary lookups, which should eliminate CPU limit errors.

## 📊 Size Comparison

- **Current (linear search)**: 21MB, O(n) search, CPU-intensive
- **Reverse index**: ~160MB total (13 chunks × ~12MB), O(1) lookup, instant

## 🧪 Testing Setup

### Option 1: Test Worker (Recommended - Safe)

1. **Create a test KV namespace:**
   ```bash
   cd workers
   npx wrangler kv:namespace create DICTIONARY --preview
   ```
   Note the namespace ID.

2. **Update `wrangler.test.toml`:**
   ```toml
   [[kv_namespaces]]
   binding = "DICTIONARY"
   id = "YOUR_TEST_NAMESPACE_ID"
   ```

3. **Upload reverse index to test namespace:**
   ```bash
   chmod +x workers/upload_reverse_index_kv.sh
   ./workers/upload_reverse_index_kv.sh
   ```
   (Update the script to use your test namespace)

4. **Deploy test worker:**
   ```bash
   cd workers
   npx wrangler deploy --config wrangler.test.toml --name rala-search-test src/index.reverse.js
   ```

5. **Test locally:**
   - Update `js/config.js` temporarily: `WORKER_API_URL = 'https://rala-search-test.YOUR_SUBDOMAIN.workers.dev'`
   - Run `./test-local.sh`
   - Test searches: "test", "elytra", "neuron"

### Option 2: Backup Production First (If testing on production)

1. **Backup current Worker:**
   ```bash
   git tag backup-before-reverse-index
   ```

2. **Create backup KV namespace:**
   ```bash
   npx wrangler kv:namespace create DICTIONARY_BACKUP
   ```
   Copy current `combined_dictionaries_ultra` to backup.

3. **Upload reverse index to production KV:**
   ```bash
   ./workers/upload_reverse_index_kv.sh
   ```
   (Update script to use production namespace)

4. **Deploy reverse index Worker:**
   ```bash
   cd workers
   cp src/index.reverse.js src/index.js
   npx wrangler deploy
   ```

## 🔄 Reverting Back

### If on test worker:
Just switch back to main branch:
```bash
git checkout main
```

### If deployed to production:

1. **Revert Worker code:**
   ```bash
   git checkout main
   cd workers
   npx wrangler deploy
   ```

2. **Revert KV (if needed):**
   ```bash
   # Restore from backup namespace
   npx wrangler kv:key get --binding=DICTIONARY_BACKUP combined_dictionaries_ultra > backup.json
   npx wrangler kv:key put --binding=DICTIONARY combined_dictionaries_ultra backup.json --remote
   ```

## 📈 Expected Performance

- **Search speed**: < 50ms (vs 500-3000ms with linear search)
- **CPU usage**: Minimal (O(1) lookup vs O(n) scan)
- **503 errors**: Should be eliminated
- **Memory**: ~160MB KV storage (vs 21MB)

## 🐛 Troubleshooting

- **Chunk not found**: Verify all 13 chunks uploaded
- **Empty results**: Check chunk index is uploaded
- **Still slow**: Verify chunks are being lazy-loaded correctly

## ✅ Success Criteria

- [ ] No 503 errors after multiple searches
- [ ] Search completes in < 100ms
- [ ] All test words return results ("test", "elytra", "neuron")
- [ ] Synonym searches work without rate limiting

