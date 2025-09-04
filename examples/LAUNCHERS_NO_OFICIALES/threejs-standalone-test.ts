/**
 * ThreeJS Standalone Test
 * Simple test for ThreeJSGamificationUI with auto-build and browser opening
 */


import { MCPDriverAdapter } from "@/drivers";
import { Runtime } from "@/runtime";
import { ThreeJSGamificationUI } from "@/ui";
import { Logger } from "@/utils";
import path from "path";

async function testThreeJSUI() {
  try {
    Logger.info("🧪 Starting ThreeJS UI Standalone Test...");

    // Initialize MCP Driver and Runtime
    const mcpAdapter = new MCPDriverAdapter();
    
    const runtime = new Runtime(mcpAdapter, {
      mcpServerId: "threejs-test-server",
      graphId: "test-graph",
      userId: "test-user",
      sessionId: "threejs-standalone-session",
      maxMessagesPerThread: 50,
      sessionTimeout: 3600000,
      autoSave: true,
      autoSaveInterval: 30000,
    });

    // Configure ThreeJS UI with auto-build and browser opening
    const threejsUI = new ThreeJSGamificationUI(runtime, mcpAdapter, {
      gameTitle: "ThreeJS Standalone Test",
      port: 9090,
      staticDir: path.resolve(process.cwd(), "../threejs-gamify-ui/dist/threegamification-ui"),
      corsOrigin: "*",
      debugMode: true,
      enablePostulations: true,
      autoSelectSingleAgent: false,
      maxMessagesPerThread: 50,
      // Template provider options
      provideTemplate: true,
      autoOpenBrowser: true,
      angularProjectPath: path.resolve(process.cwd(), "../threejs-gamify-ui")
    });

    // Initialize runtime
    await runtime.initialize();
    Logger.info("✅ Runtime initialized");

    // Start ThreeJS UI (this will build Angular app and open browser)
    await threejsUI.start();
    Logger.info("✅ ThreeJS UI started successfully");

    Logger.info("");
    Logger.info("🎮 ThreeJS UI Test Running:");
    Logger.info(`   🌐 Web Interface: http://localhost:9090`);
    Logger.info(`   🔧 API Status: http://localhost:9090/api/status`);
    Logger.info(`   📊 API Config: http://localhost:9090/api/config`);
    Logger.info(`   🤖 API Agents: http://localhost:9090/api/agents`);
    Logger.info("");
    Logger.info("Press Ctrl+C to stop...");

    // Graceful shutdown
    process.on("SIGINT", async () => {
      Logger.info("\n🛑 Shutting down ThreeJS UI test...");
      try {
        await threejsUI.stop();
        Logger.info("✅ Shutdown complete");
        process.exit(0);
      } catch (error) {
        Logger.error("❌ Error during shutdown", error as Error);
        process.exit(1);
      }
    });

    // Keep process alive and monitor
    setInterval(() => {
      // Just keep alive - we removed the isActive check since it's protected
      Logger.info("💓 ThreeJS UI test still running...");
    }, 60000); // Every minute

  } catch (error) {
    Logger.error("❌ Failed to start ThreeJS UI test", error as Error);
    process.exit(1);
  }
}

// Run the test
testThreeJSUI().catch((error) => {
  Logger.error("❌ Unhandled error in ThreeJS UI test", error);
  process.exit(1);
});
