/**
 * ThreeJS Library Integration Example
 * Demonstrates the new library-based approach vs external build approach
 */

import { ThreeJSLibraryServer } from "@/ui/ThreeJSLibraryServer";
import { Logger } from "@/utils";


async function runThreeJSLibraryExample() {
  console.log("🎮 Starting ThreeJS Library Integration Example...");

  const libraryServer = new ThreeJSLibraryServer({
    port: 9090,
    gameTitle: "ThreeJS UI Library Demo",
    corsOrigin: "*",
    autoOpenBrowser: true
  });

  try {
    await libraryServer.start();
    
    Logger.info("🎮 ThreeJS Library Server is running!");
    Logger.info("📚 Library approach benefits:");
    Logger.info("  ✅ No external Angular builds needed");
    Logger.info("  ✅ npm package management");
    Logger.info("  ✅ Simplified deployment");
    Logger.info("  ✅ Version control");
    Logger.info("  ✅ Direct integration with state-machine-mcp-driver");
    
    // Keep the server running
    process.on('SIGINT', async () => {
      Logger.info("🛑 Shutting down...");
      await libraryServer.stop();
      process.exit(0);
    });
    
  } catch (error) {
    Logger.error("❌ Failed to start ThreeJS Library Server:", error as Error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  runThreeJSLibraryExample().catch(console.error);
}

export { runThreeJSLibraryExample };
