/**
 * Xplus1 Launcher Script
 * Launches multiple GamificationUI instances based on configuration
 */

// Import game-specific configurations
import { createDevelopmentOrchestrator, Orchestrator } from "@/orchestration";
import { AppConfig, Logger } from "@/utils";
import { readFile } from "fs/promises";

/**
 * Main Xplus1 Launcher function
 */
async function main(): Promise<void> {
    const configPath = process.argv[2];

    if (!configPath) {
        console.error(
            "❌ Usage: npx tsx xplus1-state-machine-app.ts <config-file>"
        );
        process.exit(1);
    }

    let orchestrator: Orchestrator | undefined;
    try {
		let config: AppConfig;

        // 1. Load configuration
        console.log(`📋 Loading XPlus1 configuration from: ${configPath}`);
        const configContent = await readFile(configPath, "utf-8");
        config = JSON.parse(configContent);

        console.log(`🎮 Starting XPlus1 Game: ${config.game.name}`);
        console.log(
            `📱 Orchestrator Config Agents requested: ${config?.orchestration?.autoRegisterComponentsKeys?.length || 'not detected'}`
        );

        // 3. Initialize Interface Orchestrator
        console.log("🔄 Initializing Interface Orchestrator...");
        orchestrator = createDevelopmentOrchestrator(config);
		orchestrator.start();
        console.log("✅ Interface Orchestrator initialized");

        console.log("Press Ctrl+C to stop all interfaces.");
    } catch (error) {
        Logger.error("❌ Xplus1 Launcher failed", error as Error);
        process.exit(1);
    }
}

// Start the launcher
main().catch((error) => {
    console.error("❌ Xplus1 Launcher startup failed:");
    console.error(`   Error: ${error.message}`);
    if (error.type) {
        console.error(`   Type: ${error.type}`);
    }
    if (error.serverId) {
        console.error(`   Server: ${error.serverId}`);
    }

    console.log("\n💡 Troubleshooting tips:");
    console.log("   1. Ensure MCP servers are running:");
    console.log("      npm run mcp:xplus1    # Port 3001");
    console.log("      npm run mcp:wiki      # Port 3002");
    console.log("   2. Check if ports are available:");
    console.log('      netstat -ano | findstr ":300"');
    console.log("   3. Try restarting all services:");
    console.log("      npm run cleannode && npm start");

    process.exit(1);
});
