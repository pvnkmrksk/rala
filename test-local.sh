#!/bin/bash
# Quick local test server for Rala

PORT="${1:-8000}"

echo "🚀 Starting local test server..."
echo "📁 Serving from: $(pwd)"
echo "🌐 URL: http://localhost:$PORT"
echo ""
echo "✅ Worker API is already live and will be used automatically"
echo "   (configured in js/config.js)"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start Python HTTP server
python3 -m http.server "$PORT" 2>/dev/null || python -m SimpleHTTPServer "$PORT" 2>/dev/null || {
    echo "❌ Python not found. Try:"
    echo "   npm install -g http-server && http-server -p $PORT"
    exit 1
}

