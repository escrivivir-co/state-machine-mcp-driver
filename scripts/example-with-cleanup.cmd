@echo off
echo.
echo 🚀 Starting Example with Cleanup Process
echo ==========================================
echo.

echo 📍 Step 1: Cleaning up existing Node.js processes...
echo 🔄 Running cleanup command...

REM Kill all Node.js processes directly with taskkill
echo ⚠️  Killing all Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
if errorlevel 1 (
    echo ℹ️  No Node.js processes found to terminate
) else (
    echo ✅ Node.js processes terminated successfully
)

echo.
echo ⏳ Waiting 3 seconds for cleanup to complete...
timeout /t 3 /nobreak >nul

echo.
echo 📍 Step 2: Launching X+1 State Machine Game...
echo 🚀 Starting launcher with full configuration...
set OLLAMA_MODEL=gpt-oss:20b
set MCP_USE_NATIVE_PROTOCOL=true
npx tsx scripts/launcher.ts x-plus-1

echo.
echo ✅ Example process completed!
