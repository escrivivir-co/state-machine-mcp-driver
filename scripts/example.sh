#!/bin/bash
# Example script that runs cleanup then launches the X+1 game

echo "🚀 Starting Example with Cleanup Process"
echo "=========================================="
echo ""

echo "📍 Step 1: Cleaning up existing Node.js processes..."
npm run launcher:kill-all-node
echo ""

echo "⏳ Waiting 2 seconds for cleanup to complete..."
sleep 2
echo ""

echo "📍 Step 2: Launching X+1 State Machine Game..."
echo "🚀 Starting launcher with full configuration..."
OLLAMA_MODEL=gpt-oss:20b MCP_USE_NATIVE_PROTOCOL=true npm run launcher:x-plus-1

echo ""
echo "✅ Example process completed!"
