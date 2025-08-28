#!/bin/bash

echo ""
echo "🚀 Starting Example with Cleanup Process"
echo "=========================================="
echo ""

echo "📍 Step 1: Cleaning up existing Node.js processes..."
echo "🔄 Running cleanup command..."
npx tsx scripts/launcher.ts --kill-all-node

echo ""
echo "⏳ Waiting 3 seconds for cleanup to complete..."
sleep 3

echo ""
echo "📍 Step 2: Launching X+1 State Machine Game..."
echo "🚀 Starting launcher with full configuration..."
export OLLAMA_MODEL="gpt-oss:20b"
export MCP_USE_NATIVE_PROTOCOL="true"
npx tsx scripts/launcher.ts x-plus-1

echo ""
echo "✅ Example process completed!"
