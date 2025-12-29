# Cloudflare Workers Setup - Step by Step

## Prerequisites
- GitHub account (for storing code)
- Cloudflare account (free, no credit card required)

## Step 1: Create Cloudflare Account

1. Go to https://dash.cloudflare.com/sign-up
2. Sign up with email (no credit card required)
3. Verify your email address

## Step 2: Install Wrangler CLI

```bash
npm install -g wrangler
```

Or if you prefer using npx (no installation needed):
```bash
# Just use npx wrangler instead of wrangler in commands below
```

## Step 3: Login to Cloudflare

```bash
wrangler login
```

This will open a browser window to authenticate.

## Step 4: Create Workers KV Namespace

**Option A: Using wrangler CLI**
```bash
wrangler kv namespace create "DICTIONARY"
```

This will output something like:
```
🌀  Creating namespace with title "rala-DICTIONARY"
✨  Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "DICTIONARY", id = "abc123..." }
```

**Option B: Using Cloudflare Dashboard (Easier)**
1. Go to https://dash.cloudflare.com
2. Select your account
3. Go to **Workers & Pages** → **KV**
4. Click **Create a namespace**
5. Name it: `DICTIONARY`
6. Click **Add**
7. Copy the **Namespace ID** from the list

**Save the `id` value - you'll need it for `wrangler.toml`!**

## Step 5: Upload Dictionary to KV

**⚠️ Important:** The dictionary file is 21MB. The CLI may have issues with files this large. Use one of these methods:

### Method 1: Cloudflare Dashboard (Recommended - Easiest)

1. Go to https://dash.cloudflare.com
2. Select your account
3. Go to **Workers & Pages** → **KV**
4. Click on your namespace (DICTIONARY)
5. Click **Add entry**
6. Key: `combined_dictionaries_ultra`
7. Value: Copy/paste the entire JSON content from `padakanaja/combined_dictionaries_ultra.json`
   - Open the file in a text editor
   - Select all (Cmd+A) and copy (Cmd+C)
   - Paste into the Value field
8. Click **Save**

### Method 2: CLI (Try this first, may fail with 21MB)

```bash
# From the rala directory
wrangler kv key put "combined_dictionaries_ultra" --path=padakanaja/combined_dictionaries_ultra.json --namespace-id=YOUR_NAMESPACE_ID --remote
```

Replace `YOUR_NAMESPACE_ID` with the id from Step 4.

**⚠️ Important:** Add `--remote` flag to upload to Cloudflare, not just local storage!

**If this fails with "file too large" error, use Method 1 (Dashboard) instead.**

### Method 3: Use R2 Storage (Better for Large Files)

R2 has 10GB free tier and handles large files much better:

```bash
# Create R2 bucket
wrangler r2 bucket create dictionary-data

# Upload file
wrangler r2 object put dictionary-data/combined_dictionaries_ultra.json --file=padakanaja/combined_dictionaries_ultra.json
```

Then update `workers/src/index.js` to fetch from R2 instead of KV (I can help with this).

## Step 6: Create Worker Project

The worker code will be created in `workers/` directory. The setup script will handle this.

## Step 7: Register workers.dev Subdomain

Before deploying, you need to register a workers.dev subdomain:

**Option 1: Via Wrangler CLI (Interactive)**
When you run `wrangler deploy`, it will prompt you:
```
✔ Would you like to register a workers.dev subdomain now? … yes
? What would you like your workers.dev subdomain to be? › rala-search
```

**Recommended:** Type `rala-search` (or `rala-dict` if that's taken)

**Option 2: Via Cloudflare Dashboard**
1. Go to: https://dash.cloudflare.com
2. Navigate to **Workers & Pages** → **Overview**
3. Click **Get started** or **Register subdomain**
4. Choose a subdomain (e.g., `rala-search`)
5. Complete the registration

**Note:** This is a one-time setup. After registration, you can deploy workers.

## Step 8: Deploy Worker

```bash
cd workers
npx wrangler deploy
```

Or if wrangler is installed globally:
```bash
cd workers
wrangler deploy
```

After successful deployment, you'll see a URL like:
```
https://rala-search.your-subdomain.workers.dev
```

**Save this URL - you'll need it for the client!**

## Step 9: Update Client Configuration

After deployment, update `js/config.js`:

```javascript
const WORKER_API_URL = 'https://rala-search.your-subdomain.workers.dev';
```

Replace with your actual Worker URL.

**Important:** This Worker URL is only used internally by the client code. Users still visit your same GitHub Pages site (or wherever you host the frontend). The Worker API is called in the background automatically - users never see or need to know about the Worker URL.

## Step 9: Update Client Code

The client code will be updated to call the Worker API instead of loading dictionaries locally.

## Troubleshooting

### KV Upload Fails
- Make sure the file path is correct
- Check that the namespace ID is correct
- If file is too large (21MB), you have options:
  1. **Use wrangler kv key put with --preview flag** (if available)
  2. **Upload via Cloudflare Dashboard** (Web UI)
  3. **Split into smaller chunks** and combine in Worker
  4. **Use R2 storage instead** (free tier: 10GB) and fetch from Worker

### Worker Deployment Fails
- Check that `wrangler.toml` has correct account_id
- Verify KV namespace binding is correct
- Check Worker code for syntax errors

### Search Not Working
- Verify Worker URL is correct in client config
- Check browser console for errors
- Verify KV namespace has data (use `wrangler kv:key get`)

## Next Steps

After setup is complete:
1. Test the Worker endpoint manually
2. Update client to use Worker API
3. Test on mobile device
4. Monitor usage in Cloudflare dashboard

