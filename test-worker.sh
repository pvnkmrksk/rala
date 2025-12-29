#!/bin/bash
# Quick test script for Worker API

WORKER_URL="https://rala-search.rala-search.workers.dev"
QUERY="${1:-hello}"

echo "🧪 Testing Worker API..."
echo "URL: $WORKER_URL"
echo "Query: $QUERY"
echo ""

response=$(curl -s "${WORKER_URL}?q=${QUERY}")

if [ $? -eq 0 ]; then
    echo "✅ Worker is responding!"
    echo ""
    echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f'Query: {data.get(\"query\")}')
    print(f'Results: {data.get(\"count\", 0)}')
    if data.get('results'):
        print(f'\\nFirst 3 results:')
        for i, r in enumerate(data['results'][:3], 1):
            print(f'  {i}. {r.get(\"kannada\")} → {r.get(\"definition\")}')
    else:
        print('No results found')
except Exception as e:
    print(f'Error parsing response: {e}')
    print('Raw response:')
    print(sys.stdin.read())
" 2>/dev/null || echo "$response"
else
    echo "❌ Worker is not responding"
    exit 1
fi

