/**
 * Multi-UI Launcher Script
 * Launches multiple GamificationUI instances based on configuration
 */

import { readFile } from "fs/promises";
import { Runtime, RuntimeConfig } from "../src/runtime/Runtime";
import {
    MCPDriverAdapter,
    MCPDriverAdapterConfig,
} from "../src/drivers/MCPDriverAdapter";
import { MultiUIGameManager } from "../src/ui/MultiUIGameManager";
import { MultiUIGameConfig } from "../src/ui/MultiUIGameConfig";
import { Logger } from "../src/utils/logger";
import { MCPServerTransportConfig } from "../src/drivers/IMCPDriver";

// Import game-specific configurations
import { createXPlus1RuntimeConfig } from "./x-plus-1-state-machine/game-config";
import { ChannelConsumer } from "@/orchestration/channel/deprecated-channel-consumer";
import { DEFAULT_APP_CONFIG, getConfigOrDefault, parseMcpConfigToTransportConfig } from "@/utils/config";

/**
 * Retry configuration
 */
interface RetryConfig {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 5,
    baseDelay: 2000,
    maxDelay: 10000,
    backoffMultiplier: 1.5,
};

/**
 * Check if MCP servers are ready
 */
async function checkMCPServersHealth(): Promise<boolean> {
    const serverUrls = [
        "http://localhost:3001", // X+1 MCP Machine
        "http://localhost:3002", // Wiki MCP Browser
    ];

    for (const url of serverUrls) {
        try {
            const response = await fetch(url, {
                method: "GET",
                signal: AbortSignal.timeout(2000),
            });
            if (!response.ok) {
                console.warn(
                    `⚠️  MCP server ${url} returned status ${response.status}`
                );
                return false;
            }
        } catch (error) {
            console.warn(
                `⚠️  MCP server ${url} not responding: ${
                    (error as Error).message
                }`
            );
            return false;
        }
    }

    return true;
}

/**
 * Start MCP servers if they're not running
 */
async function ensureMCPServersRunning(): Promise<void> {
    const isHealthy = await checkMCPServersHealth();

    if (isHealthy) {
        console.log("✅ MCP servers are already running");
        return;
    }

    console.log("🚀 Starting MCP servers...");
    console.log("💡 This may take a few seconds...");

    // Import spawn for cross-platform process management
    const { spawn } = require("child_process");

    // Start servers in background
    const servers = [
        {
            name: "MCP Service Launcher",
            script: "npm run mcp:launcher",
            port: 3000,
        },
        { name: "X+1 MCP Machine", script: "npm run mcp:xplus1", port: 3001 },
        { name: "Wiki MCP Browser", script: "npm run mcp:wiki", port: 3002 },
        { name: "DevOps MCP Server", script: "npm run mcp:devops", port: 3003 },
    ];

    for (const server of servers) {
        try {
            const [cmd, ...args] = server.script.split(" ");
            const child = spawn(cmd, args, {
                detached: true,
                stdio: "ignore",
                shell: true,
            });

            child.unref(); // Allow parent to exit independently
            console.log(`   ✅ Started ${server.name} (port ${server.port})`);

            // Small delay between server starts
            await sleep(500);
        } catch (error) {
            console.warn(
                `   ⚠️  Failed to start ${server.name}: ${
                    (error as Error).message
                }`
            );
        }
    }

    console.log("⏳ Waiting for servers to initialize...");
    await sleep(3000); // Give servers time to start
}

/**
 * Sleep utility
 */
async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry wrapper with exponential backoff
 */
async function withRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = DEFAULT_RETRY_CONFIG,
    operationName = "operation"
): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;

            if (attempt === config.maxAttempts) {
                console.error(
                    `❌ ${operationName} failed after ${config.maxAttempts} attempts`
                );
                throw lastError;
            }

            const delay = Math.min(
                config.baseDelay *
                    Math.pow(config.backoffMultiplier, attempt - 1),
                config.maxDelay
            );

            console.warn(
                `⚠️  ${operationName} failed (attempt ${attempt}/${config.maxAttempts}). Retrying in ${delay}ms...`
            );
            console.warn(`   Error: ${lastError.message}`);

            await sleep(delay);
        }
    }

    throw lastError;
}

/**
 * Main multi-UI launcher function
 */
async function main(): Promise<void> {
    const configPath = process.argv[2];

    if (!configPath) {
        console.error("❌ Usage: npx tsx multi-ui-launcher.ts <config-file>");
        process.exit(1);
    }

    let config: MultiUIGameConfig;
    let runtime: Runtime | undefined;
    let mcpAdapter: MCPDriverAdapter | undefined;
    let orchestrator: ChannelConsumer | undefined;
    let multiUIManager: MultiUIGameManager | undefined;

    try {
        // 0. Ensure MCP servers are running
        console.log("🔄 Checking MCP servers...");
        await ensureMCPServersRunning();

        // 1. Load configuration
        console.log(`📋 Loading multi-UI configuration from: ${configPath}`);
        const configContent = await readFile(configPath, "utf-8");
        config = JSON.parse(configContent);

        console.log(`🎮 Starting Multi-UI Game: ${config.game.name}`);
        console.log(
            `📱 UI Instances: ${config.ui.filter((ui) => ui.enabled).length}`
        );

        // Initialize components
        console.log("\n🔧 Initializing components...");

        // 1. Initialize MCP Driver Adapter first
        console.log("🔄 Initializing MCP Driver...");
        const adapterConfig: MCPDriverAdapterConfig = {};
        mcpAdapter = new MCPDriverAdapter();

        // Configure MCP servers
		for ( const key of Object.keys(config.mcp.servers)){
			const server = getConfigOrDefault(key, DEFAULT_APP_CONFIG);
			const transportConfig = parseMcpConfigToTransportConfig(server);
			mcpAdapter.addServer(transportConfig);
		}

        console.log("✅ MCP Driver initialized");

        // 1.5. Wait for MCP servers to be ready
        console.log("🔄 Waiting for MCP servers to be ready...");
        await withRetry(
            async () => {
                const isReady = await checkMCPServersHealth();
                if (!isReady) {
                    throw new Error("MCP servers not ready");
                }
                return true;
            },
            {
                maxAttempts: 10,
                baseDelay: 2000,
                maxDelay: 8000,
                backoffMultiplier: 1.2,
            },
            "MCP servers health check"
        );
        console.log("✅ MCP servers are ready");

        // 2. Initialize Runtime with MCP adapter (with retries)
        console.log("🔄 Initializing Runtime...");
        let runtimeConfig: RuntimeConfig;

        switch (config.game.id) {
            case "x-plus-1-multi":
                const gameConfig = await createXPlus1RuntimeConfig();
                runtimeConfig = {
                    mcpServerId: "xplus1-mcp-machine",
                    graphId: gameConfig.graphId,
                    userId: gameConfig.userId,
                    agentConfigs: gameConfig.agentConfigs,
                };
                break;
            default:
                throw new Error(`Unknown game ID: ${config.game.id}`);
        }

        runtime = new Runtime(mcpAdapter, runtimeConfig);

        // Initialize runtime with retries
        await withRetry(
            async () => await runtime!.initialize(),
            {
                maxAttempts: 8,
                baseDelay: 3000,
                maxDelay: 15000,
                backoffMultiplier: 1.3,
            },
            "Runtime initialization"
        );
        console.log("✅ Runtime initialized");

        // 3. Initialize Interface Orchestrator
        console.log("🔄 Initializing Interface Orchestrator...");
        orchestrator = new ChannelConsumer(runtime, mcpAdapter, {
            syncInterval: config.orchestration?.syncInterval || 100,
            enableChatProvider: false, // Disable for now
            enableUI: true,
            enableAgentControl: true,
        });
        console.log("✅ Interface Orchestrator initialized");

        // 4. Initialize Multi-UI Manager
        console.log("🔄 Initializing Multi-UI Manager...");
        multiUIManager = new MultiUIGameManager(
            runtime,
            mcpAdapter,
            orchestrator,
            config
        );

        // Setup event handlers
        multiUIManager.on("allUIsReady", (data) => {
            console.log(`🎉 All ${data.uiCount} UI instances are ready!`);
            displayGameInfo(config, multiUIManager!);
        });

        multiUIManager.on("uiStarted", (data) => {
            console.log(`✅ UI started: ${data.config.name} (${data.uiId})`);
        });

        multiUIManager.on("uiError", (data) => {
            console.error(`❌ UI error in ${data.uiId}:`, data.error.message);
        });

        // 5. Start Multi-UI Manager
        console.log("🚀 Starting Multi-UI Manager...");
        await multiUIManager.start();

        // Setup graceful shutdown
        setupGracefulShutdown(multiUIManager, runtime, mcpAdapter);

        console.log("\n🎮 Multi-UI Game is running!");
        console.log("Press Ctrl+C to stop all interfaces.");
    } catch (error) {
        Logger.error("Multi-UI Launcher failed", error as Error);
        console.error("❌ Multi-UI Launcher failed:", error);

        // Cleanup
        if (multiUIManager) await multiUIManager.destroy();
        if (runtime) await runtime.shutdown();
        if (mcpAdapter) await mcpAdapter.close();

        process.exit(1);
    }
}

/**
 * Display game information and available interfaces
 */
function displayGameInfo(
    config: MultiUIGameConfig,
    manager: MultiUIGameManager
): void {
    console.log("\n" + "=".repeat(60));
    console.log(`🎮 ${config.game.name} - Multi-UI Active`);
    console.log("=".repeat(60));

    const activeUIs = manager.getActiveUIInstances();
    console.log("\n📱 Active Interfaces:");

    for (const [uiId, ui] of activeUIs) {
        const uiConfig = config.ui.find((u) => u.id === uiId);
        if (uiConfig) {
            console.log(`  • ${uiConfig.name} (${uiConfig.type})`);

            if (uiConfig.type === "html5" && uiConfig.config.port) {
                console.log(
                    `    🌐 Web URL: http://localhost:${uiConfig.config.port}`
                );
            }

            if (uiConfig.config.isPrimary) {
                console.log("    👑 Primary Interface");
            }
        }
    }

    const stats = manager.getStats();
    console.log(`\n📊 Status: ${stats.activeUIs}/${stats.totalUIs} UIs active`);

    if (stats.primaryUIId) {
        console.log(`🎯 Primary UI: ${stats.primaryUIId}`);
    }

    console.log("\n🎮 Game Commands:");
    console.log("  • Type in any active interface to interact");
    console.log("  • Console UI: Full command support");
    console.log("  • Web UI: Click and interact through browser");
    console.log("  • Ctrl+C: Stop all interfaces");

    console.log("\n" + "=".repeat(60));
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(
    manager: MultiUIGameManager,
    runtime: Runtime,
    mcpAdapter: MCPDriverAdapter
): void {
    const shutdown = async (signal: string) => {
        console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

        try {
            console.log("🔄 Stopping Multi-UI Manager...");
            await manager.destroy();
            console.log("✅ Multi-UI Manager stopped");

            console.log("🔄 Shutting down Runtime...");
            await runtime.shutdown();
            console.log("✅ Runtime stopped");

            console.log("🔄 Shutting down MCP Driver...");
            await mcpAdapter.close();
            console.log("✅ MCP Driver stopped");

            console.log("👋 Multi-UI Game shutdown complete");
            process.exit(0);
        } catch (error) {
            console.error("❌ Error during shutdown:", error);
            process.exit(1);
        }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    // Handle uncaught exceptions
    process.on("uncaughtException", async (error) => {
        console.error("💥 Uncaught exception:", error);
        await shutdown("UNCAUGHT_EXCEPTION");
    });

    process.on("unhandledRejection", async (reason) => {
        console.error("💥 Unhandled rejection:", reason);
        await shutdown("UNHANDLED_REJECTION");
    });
}

// Start the launcher
main().catch((error) => {
    console.error("❌ Multi-UI Launcher startup failed:");
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
