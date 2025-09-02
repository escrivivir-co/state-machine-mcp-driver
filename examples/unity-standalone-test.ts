/**
 * Unity Standalone Test
 * Simple test for UnityGamificationUI with auto-build and browser opening
 */

import { Runtime } from "../src/runtime/Runtime";
import { MCPDriverAdapter } from "../src/drivers/MCPDriverAdapter";
import { UnityGamificationUI } from "../src/ui/UnityGamificationUI";
import { Logger } from "../src/utils/logger";
import path from "path";

async function testUnityUI() {
  try {
    Logger.info("🧪 Starting Unity UI Standalone Test...");

    // Initialize MCP Driver and Runtime
    const mcpAdapter = new MCPDriverAdapter();
    
    const runtime = new Runtime(mcpAdapter, {
      mcpServerId: "unity-test-server",
      graphId: "test-graph",
      userId: "test-user",
      sessionId: "unity-standalone-session",
      maxMessagesPerThread: 50,
      sessionTimeout: 3600000,
      autoSave: true,
      autoSaveInterval: 30000,
    });

    // Configure Unity UI with auto-build and browser opening
    const unityUI = new UnityGamificationUI(runtime, mcpAdapter, {
      gameTitle: "Unity Standalone Test",
      port: 9080,
      buildDir: path.resolve(process.cwd(), "../unity-builds/webgl"),
      unityBuildName: "index.html",
      corsOrigin: "*",
      debugMode: true,
      enablePostulations: true,
      autoSelectSingleAgent: false,
      maxMessagesPerThread: 50,
      // New auto-build options
      autoBuild: true,
      autoOpenBrowser: true,
      unityProjectPath: path.resolve(process.cwd(), "../unity-project"),
      unityBuildTarget: "WebGL"
    });

    // Initialize runtime
    await runtime.initialize();
    Logger.info("✅ Runtime initialized");

    // Start Unity UI (this will build Unity WebGL and open browser)
    await unityUI.start();
    Logger.info("✅ Unity UI started successfully");

    Logger.info("");
    Logger.info("🎮 Unity UI Test Running:");
    Logger.info(`   🌐 Web Interface: http://localhost:9080`);
    Logger.info(`   🔧 API Status: http://localhost:9080/api/status`);
    Logger.info(`   📊 API Config: http://localhost:9080/api/config`);
    Logger.info(`   🎯 Unity Runtime Info: http://localhost:9080/api/runtime-info`);
    Logger.info("");
    Logger.info("Press Ctrl+C to stop...");

    // Graceful shutdown
    process.on("SIGINT", async () => {
      Logger.info("\n🛑 Shutting down Unity UI test...");
      try {
        await unityUI.stop();
        Logger.info("✅ Shutdown complete");
        process.exit(0);
      } catch (error) {
        Logger.error("❌ Error during shutdown", error as Error);
        process.exit(1);
      }
    });

    // Keep process alive and monitor
    setInterval(() => {
      // Log connected Unity instances
      Logger.info(`📊 Connected Unity instances: ${unityUI.getConnectedInstancesCount()}`);
    }, 60000); // Every minute

  } catch (error) {
    Logger.error("❌ Failed to start Unity UI test", error as Error);
    process.exit(1);
  }
}

// Run the test
testUnityUI().catch((error) => {
  Logger.error("❌ Unhandled error in Unity UI test", error);
  process.exit(1);
});
