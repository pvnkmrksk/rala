# Testing on iPhone

## Option 1: Test via Local Network (Quickest)

1. **Start the local server:**
   ```bash
   python3 -m http.server 8009
   ```

2. **Find your Mac's IP address:**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
   Or check System Settings → Network → Wi-Fi → Details

3. **On your iPhone:**
   - Make sure iPhone is on the same Wi-Fi network as your Mac
   - Open Safari
   - Navigate to: `http://YOUR_MAC_IP:8009`
   - Example: `http://192.168.1.100:8009`

4. **Test "Add to Home Screen":**
   - Tap the Share button (square with arrow)
   - Scroll down and tap "Add to Home Screen"
   - Tap "Add"
   - Open the app from home screen
   - **Verify:** It should open in standalone mode (no Safari UI bars)

## Option 2: Push to GitHub and Deploy

1. **Push the branch:**
   ```bash
   git push origin cleanup-and-fixes
   ```

2. **Deploy to GitHub Pages or your hosting:**
   - If using GitHub Pages, create a branch or use a deployment service
   - Or use services like Netlify, Vercel, etc.

3. **Access from iPhone:**
   - Open Safari on iPhone
   - Navigate to your deployed URL
   - Test "Add to Home Screen" as above

## Option 3: Use ngrok (Tunnel to Local Server)

1. **Install ngrok:**
   ```bash
   brew install ngrok
   # or download from https://ngrok.com/
   ```

2. **Start local server:**
   ```bash
   python3 -m http.server 8009
   ```

3. **Create tunnel:**
   ```bash
   ngrok http 8009
   ```

4. **On iPhone:**
   - Use the HTTPS URL provided by ngrok (e.g., `https://abc123.ngrok.io`)
   - Test "Add to Home Screen"

## What to Verify

✅ **Standalone Mode:**
- App opens without Safari address bar
- App opens without Safari bottom toolbar
- Status bar shows black-translucent style

✅ **Functionality:**
- Search works correctly
- Dictionary loads properly
- All features work as expected

✅ **Manifest:**
- App icon appears correctly on home screen
- App name shows as "Rala"

## Troubleshooting

**If it still opens in Safari:**
- Clear Safari cache: Settings → Safari → Clear History and Website Data
- Remove old home screen icon and re-add
- Check that manifest.json is accessible: `http://YOUR_URL/manifest.json`

**If manifest.json not found:**
- Ensure the file is in the root directory
- Check file permissions
- Verify the path in index.html matches actual file location

