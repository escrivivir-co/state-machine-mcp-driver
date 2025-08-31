/**
 * Xplus1 Launcher Script
 * Launches multiple GamificationUI instances based on configuration
 */

// Import game-specific configurations
import { AppConfig, Logger } from "@/utils";
import { readFile } from "fs/promises";
import { getBasicRuntimeConfig } from "./getBasicRuntimeConfig";
import { ApplicationLauncher } from "@/scripts/launcher";

/**
 * Main Xplus1 Launcher function
 */
async function main(): Promise<void> {
    const configPath = process.argv[2];

    if (!configPath) {
        console.error("❌ Usage: npx tsx xplus1-app.ts <config-file>");
        process.exit(1);
    }

    let launcher!: ApplicationLauncher;

    try {
        let config: AppConfig;

        // 1. Load configuration
        console.log(`📋 Loading XPlus1 configuration from: ${configPath}`);
        const configContent = await readFile(configPath, "utf-8");
        config = JSON.parse(configContent);

        console.log(`🎮 Starting XPlus1 Game: ${config.game.name}`);

        launcher = new ApplicationLauncher(config);
        await launcher.launch(config);

        await launcher.launchApplication(await getBasicRuntimeConfig(config));
		await launcher.launchGamificationUIs();
        console.log(
            `📋 FINISHED: Loading XPlus1 configuration from: ${configPath}`
        );
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
