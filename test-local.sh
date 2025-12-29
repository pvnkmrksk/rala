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

# Try different Python paths
PYTHON_CMD=""
for cmd in python3 python /usr/bin/python3 /opt/homebrew/bin/python3; do
    if command -v "$cmd" >/dev/null 2>&1; then
        PYTHON_CMD="$cmd"
        break
    fi
done

if [ -n "$PYTHON_CMD" ]; then
    # Start Python HTTP server
    "$PYTHON_CMD" -m http.server "$PORT" 2>/dev/null || "$PYTHON_CMD" -m SimpleHTTPServer "$PORT" 2>/dev/null
else
    # Fallback to Node.js http-server if available
    if command -v http-server >/dev/null 2>&1; then
        http-server -p "$PORT"
    elif command -v npx >/dev/null 2>&1; then
        echo "Using npx http-server..."
        npx -y http-server -p "$PORT"
    else
        echo "❌ Python or Node.js not found."
        echo "Install one of:"
        echo "  - Python 3: brew install python3"
        echo "  - Node.js http-server: npm install -g http-server"
        exit 1
    fi
fi

