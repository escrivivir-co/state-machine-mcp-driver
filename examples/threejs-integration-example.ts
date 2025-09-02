/**
 * ThreeJS Integration Example
 * Demonstrates how    {
      id: "unity-3d",
      name: "Unity 3D Interface",
      type: "unity",
      enabled: true,
      config: {
        gameTitle: "Unity 3D Demo",
        port: 9080,
        buildDir: "e:/LAB_AGOSTO/unity-builds/webgl",
        unityBuildName: "index.html",
        corsOrigin: "*",
        enablePostulations: true,
        autoSelectSingleAgent: false,
        maxMessagesPerThread: 100,
        debugMode: true,
        // New Unity-specific auto-build options
        autoBuild: true,
        autoOpenBrowser: true,
        unityProjectPath: "e:/LAB_AGOSTO/unity-project",
        unityBuildTarget: "WebGL"
      }
    },mificationUI with MultiUIGameManager and Orchestrator
 */

import { MultiUIGameManager } from "../src/ui/MultiUIGameManager";
import { MultiUIGameConfig } from "../src/ui/MultiUIGameConfig";
import { Runtime } from "../src/runtime/Runtime";
import { MCPDriverAdapter } from "../src/drivers/MCPDriverAdapter";
import { Orchestrator } from "../src/orchestration/orchestrator";
import { Logger } from "../src/utils/logger";

// Example configuration for multi-UI setup with ThreeJS integration
const exampleConfig: MultiUIGameConfig = {
  game: {
    id: "multi-ui-demo",
    name: "Multi-UI Integration Demo",
    version: "1.0.0",
    description: "Demo of ThreeJS + Unity + HTML5 UIs integrated with Orchestrator and AlephScript"
  },
  ui: [
    {
      id: "html5-primary",
      name: "HTML5 Primary UI",
      type: "html5",
      enabled: true,
      config: {
        gameTitle: "Multi-UI Integration Demo",
        port: 8080,
        isPrimary: true,
        enablePostulations: true,
        autoSelectSingleAgent: true,
        maxMessagesPerThread: 50,
        debugMode: true
      }
    },
    {
      id: "threejs-visual",
      name: "ThreeJS Visual Interface",
      type: "threejs",
      enabled: true,
      config: {
        gameTitle: "ThreeJS Visual Demo",
        port: 9090,
        staticDir: "e:/LAB_AGOSTO/threejs-gamify-ui/dist/threegamification-ui",
        corsOrigin: "*",
        enablePostulations: true,
        autoSelectSingleAgent: false,
        maxMessagesPerThread: 100,
        debugMode: true,
        // New ThreeJS-specific options
        autoBuild: true,
        autoOpenBrowser: true,
        angularProjectPath: "e:/LAB_AGOSTO/threejs-gamify-ui"
      }
    },
    {
      id: "unity-3d",
      name: "Unity 3D WebGL Interface",
      type: "unity",
      enabled: true,
      config: {
        gameTitle: "Unity 3D Demo",
        port: 9080,
        buildDir: "e:/LAB_AGOSTO/unity-builds/webgl",
        unityBuildName: "index.html",
        corsOrigin: "*",
        enablePostulations: true,
        autoSelectSingleAgent: false,
        maxMessagesPerThread: 100,
        debugMode: true
      }
    },
    {
      id: "console-debug",
      name: "Console Debug Interface",
      type: "console",
      enabled: false, // Disable by default, can be enabled for debugging
      config: {
        gameTitle: "Debug Console",
        enablePostulations: true,
        autoSelectSingleAgent: false,
        maxMessagesPerThread: 20,
        debugMode: true
      }
    }
  ],
  orchestration: {
    enableEventBroadcasting: true,
    syncInterval: 1000,
    primaryUIId: "html5-primary"
  },
  shared: {
    gameTitle: "Multi-UI Integration Demo",
    debugMode: true,
    enablePostulations: true,
    maxMessagesPerThread: 50
  },
  
  mcp: {
    servers: {
      // No MCP servers for this demo
    }
  }
};

/**
 * Example function to demonstrate the integration
 */
async function runThreeJSIntegrationExample() {
  Logger.info("🚀 Starting ThreeJS Integration Example");

  try {
    // Initialize core components
    const runtime = new Runtime();
    const mcpAdapter = new MCPDriverAdapter();
    const orchestrator = new Orchestrator({
      enableCrossChannelRouting: true,
      enableLogging: true
    });

    // Start orchestrator
    await orchestrator.start();
    Logger.info("✅ Orchestrator started");

    // Create and configure multi-UI manager
    const uiManager = new MultiUIGameManager(
      runtime,
      mcpAdapter,
      orchestrator,
      exampleConfig
    );

    // Setup event handlers for demonstration
    uiManager.on("uiStarted", (data) => {
      Logger.info(`🎮 UI Started: ${data.uiId} (${data.uiType})`);
    });

    uiManager.on("uiStopped", (data) => {
      Logger.info(`⏹️ UI Stopped: ${data.uiId}`);
    });

    uiManager.on("allUIsReady", () => {
      Logger.info("🎯 All UIs are ready and synchronized");
      demonstrateIntegration(uiManager, orchestrator);
    });

    // Start the multi-UI system
    await uiManager.start();

    // Keep running for demonstration
    Logger.info("🎮 Multi-UI Integration Demo is running...");
    Logger.info("📱 Open http://localhost:8080 for HTML5 UI");
    Logger.info("🎨 Open http://localhost:9090 for ThreeJS UI");
    Logger.info("🎯 Open http://localhost:9080 for Unity WebGL UI");
    Logger.info("🔌 AlephScript runtime available at http://localhost:3000/runtime");
    
    // Keep process alive
    process.on('SIGINT', async () => {
      Logger.info("🛑 Shutting down...");
      await uiManager.stop();
      await orchestrator.stop();
      process.exit(0);
    });

  } catch (error) {
    Logger.error("❌ Failed to start ThreeJS Integration Example", error as Error);
    process.exit(1);
  }
}

/**
 * Demonstrate the integration features
 */
function demonstrateIntegration(uiManager: MultiUIGameManager, orchestrator: Orchestrator) {
  const channels = orchestrator.getChannels();

  // Simulate some system events
  setTimeout(() => {
    Logger.info("📢 Broadcasting test system message");
    channels.sys.sendInfo("demo", "ThreeJS Integration is working!");
  }, 2000);

  setTimeout(() => {
    Logger.info("🎭 Broadcasting test UI notification");
    channels.ui.sendNotification("demo", "Welcome!", "ThreeJS and HTML5 UIs are synchronized", "success");
  }, 4000);

  setTimeout(() => {
    Logger.info("🎮 Broadcasting test phase change");
    channels.ui.sendDisplayUpdate("demo", "phase-change", "info", "game");
  }, 6000);

  // Monitor statistics
  setInterval(() => {
    const stats = orchestrator.getStatistics();
    Logger.info(`📊 Orchestrator Stats: ${stats.totalMessages} messages, ${stats.components.count} components`);
  }, 30000);
}

// Export for use in other examples
export { exampleConfig, runThreeJSIntegrationExample };

// Run if this file is executed directly
if (require.main === module) {
  runThreeJSIntegrationExample().catch(console.error);
}
