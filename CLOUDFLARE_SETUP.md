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

**Save the `id` value - you'll need it!**

## Step 5: Upload Dictionary to KV

```bash
# From the rala directory
wrangler kv:key put "combined_dictionaries_ultra" --path=padakanaja/combined_dictionaries_ultra.json --namespace-id=YOUR_NAMESPACE_ID
```

Replace `YOUR_NAMESPACE_ID` with the id from Step 4.

## Step 6: Create Worker Project

The worker code will be created in `workers/` directory. The setup script will handle this.

## Step 7: Deploy Worker

```bash
cd workers
wrangler deploy
```

## Step 8: Get Worker URL

After deployment, you'll get a URL like:
```
https://rala-search.your-subdomain.workers.dev
```

**Save this URL - you'll need it for the client!**

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

