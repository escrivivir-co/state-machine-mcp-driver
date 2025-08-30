/**
 * Dual Mode Integration Example
 * Demonstrates Console + HTML5 UI working together with MCPDriverAdapter
 */

import { Runtime } from "../src/runtime/Runtime";
import { MCPDriverAdapter } from "../src/drivers/MCPDriverAdapter";
import { InterfaceOrchestrator } from "../src/orchestration/InterfaceOrchestrator";
import { ConsoleGamificationUI } from "../src/ui/ConsoleGamificationUI";
import { HTML5GamificationUI } from "../src/ui/HTML5GamificationUI";
import { OllamaChatProvider } from "../src/chat-provider/OllamaChatProvider";
import { Logger } from "../src/utils/logger";

// Import X+1 specific components
import { createXPlus1RuntimeConfig } from "./x-plus-1-state-machine/game-config";

/**
 * Dual Mode Game Configuration
 */
interface DualModeConfig {
    /** Enable console interface */
    enableConsole: boolean;
    /** Enable web interface */
    enableWeb: boolean;
    /** Web UI port */
    webPort: number;
    /** Game title */
    gameTitle: string;
    /** Debug mode */
    debugMode: boolean;
}

/**
 * Dual Mode Game Manager
 * Manages both Console and HTML5 interfaces simultaneously
 */
class DualModeGameManager {
    private runtime!: Runtime; // Will be initialized in start()
    private mcpAdapter: MCPDriverAdapter;
    private orchestrator!: InterfaceOrchestrator; // Will be initialized in start()
    private chatProvider?: OllamaChatProvider;
    private consoleUI?: ConsoleGamificationUI;
    private webUI?: HTML5GamificationUI;
    private config: DualModeConfig;
    private runtimeConfig?: any;

    constructor(config: DualModeConfig) {
        this.config = config;

        // Initialize MCP adapter
        this.mcpAdapter = new MCPDriverAdapter();

        Logger.info(
            "DualModeGameManager: Initialized with dual interface support"
        );
    }

    /**
     * Start the dual mode game
     */
    async start(): Promise<void> {
        try {
            // 1. Create runtime configuration
            this.runtimeConfig = await createXPlus1RuntimeConfig();

            // 2. Initialize runtime
            this.runtime = new Runtime(
                this.runtimeConfig.mcpServerId,
                this.runtimeConfig.graphId
            );

            // 3. Initialize orchestrator
            this.orchestrator = new InterfaceOrchestrator(
                this.runtime,
                this.mcpAdapter,
                {
                    enableChatProvider: true,
                    enableUI: true,
                    enableAgentControl: true,
                }
            );

            // 4. Setup MCP servers
            await this.setupMCPServers();

            // 5. Initialize runtime with game configuration
            await this.initializeRuntime();

            // 6. Setup chat provider if needed
            await this.setupChatProvider();

            // 7. Setup Console UI if enabled
            if (this.config.enableConsole) {
                await this.setupConsoleUI();
            }

            // 8. Setup Web UI if enabled
            if (this.config.enableWeb) {
                await this.setupWebUI();
            }

            Logger.info(
                "DualModeGameManager: All interfaces started successfully"
            );
            this.displayStartupInfo();
        } catch (error) {
            Logger.error("Failed to start dual mode game", error as Error);
            throw error;
        }
    }

    /**
     * Stop the dual mode game
     */
    async stop(): Promise<void> {
        Logger.info("DualModeGameManager: Stopping all interfaces...");

        const stopPromises: Promise<void>[] = [];

        if (this.consoleUI) {
            stopPromises.push(this.consoleUI.stop());
        }

        if (this.webUI) {
            stopPromises.push(this.webUI.stop());
        }

        await Promise.all(stopPromises);
        await this.mcpAdapter.close();

        Logger.info("DualModeGameManager: All interfaces stopped");
    }

    // ===== Setup Methods =====

    private async setupMCPServers(): Promise<void> {
        // Add X+1 MCP Machine server
        await this.mcpAdapter.addServer({
            id: "xplus1-mcp-machine",
            name: "X+1 MCP Machine",
            url: "stdio",
        });

        // Add Wiki MCP Browser server (if configured)
        await this.mcpAdapter.addServer({
            id: "wiki-mcp-browser",
            name: "Wiki MCP Browser",
            url: "stdio",
        });

        // Health check all servers
        const healthResults = await this.mcpAdapter.healthCheckAll();
        Logger.info("MCP servers health check", {
            results: Array.from(healthResults.entries()),
        });
    }

    private async initializeRuntime(): Promise<void> {
        if (!this.runtimeConfig) {
            throw new Error("Runtime config not initialized");
        }

        // Add agents from configuration
        if (this.runtimeConfig.agentConfigs) {
            this.runtimeConfig.agentConfigs.forEach((agentConfig: any) => {
                this.runtime.addAgent(agentConfig);
            });
        }

        await this.runtime.initialize();
    }

    private async setupChatProvider(): Promise<void> {
        // For now, skip chat provider setup since it's not in the config
        // This can be enhanced later
        Logger.info("Chat provider setup skipped for now");
    }

    private async setupConsoleUI(): Promise<void> {
        this.consoleUI = new ConsoleGamificationUI(this.runtime, {
            gameTitle: this.config.gameTitle,
            maxMessagesPerThread: 50,
            debugMode: this.config.debugMode,
            enablePostulations: true,
            autoSelectSingleAgent: false,
            enableColors: true,
            welcomeMessage:
                "Welcome to the X+1 Game! Console interface is active.",
        });

        // Connect to orchestrator
        this.orchestrator.connectUI(this.consoleUI);

        // Setup dual-mode specific event handlers
        this.setupConsoleEventHandlers();

        await this.consoleUI.start();

        Logger.info("Console UI started and connected to orchestrator");
    }

    private async setupWebUI(): Promise<void> {
        this.webUI = new HTML5GamificationUI(this.runtime, this.mcpAdapter, {
            port: this.config.webPort,
            gameTitle: this.config.gameTitle,
            debugMode: this.config.debugMode,
            enablePostulations: true,
            autoSelectSingleAgent: false,
            enableVoice: false,
            enableMobile: true,
            welcomeMessage: "Welcome to the X+1 Game! Web interface is active.",
        });

        // Setup dual-mode specific event handlers
        this.setupWebEventHandlers();

        await this.webUI.start();

        Logger.info(`Web UI started on port ${this.config.webPort}`);
    }

    // ===== Event Handlers for Cross-Interface Sync =====

    private setupConsoleEventHandlers(): void {
        if (!this.consoleUI) return;

        // Forward console events to web UI
        this.consoleUI.on("userInput", (data) => {
            if (this.webUI) {
                this.webUI.displayNotification(
                    "Console Input",
                    `User input from console: "${data.input}"`,
                    "info"
                );
            }
        });

        this.consoleUI.on("agentMessage", (data) => {
            if (this.webUI) {
                this.webUI.displayMessage({
                    id: data.message.id,
                    type: "agent",
                    agent: {
                        id: data.agent.id,
                        name: data.agent.name,
                        role: data.agent.role,
                    },
                    content: data.message.content,
                    timestamp: data.message.timestamp,
                    metadata: { ...data.message.metadata, source: "console" },
                });
            }
        });

        this.consoleUI.on("agentSelectionRequested", (data) => {
            if (this.webUI) {
                this.webUI.displayAgentPostulations(data.postulations);
            }
        });
    }

    private setupWebEventHandlers(): void {
        if (!this.webUI) return;

        // Forward web events to console UI
        this.webUI.on("userInput", (data) => {
            if (this.consoleUI) {
                console.log(`[Web] User input: "${data.input}"`);
            }
        });

        this.webUI.on("agentMessage", (data) => {
            if (this.consoleUI) {
                this.consoleUI.sendAgentMessage(
                    data.agent.id,
                    data.message.content,
                    { ...data.message.metadata, source: "web" }
                );
            }
        });

        this.webUI.on("agentSelected", (data) => {
            if (this.consoleUI) {
                console.log(
                    `[Web] Agent selected: ${data.postulation.agent.name} - ${data.postulation.reason}`
                );
            }
        });
    }

    // ===== Utility Methods =====

    private displayStartupInfo(): void {
        console.log("\n🎮 === X+1 DUAL MODE GAME STARTED ===");
        console.log(`📊 Game Title: ${this.config.gameTitle}`);
        console.log(`🔧 MCP Protocol: ${this.getCurrentMCPProtocol()}`);

        if (this.config.enableConsole) {
            console.log("💻 Console Interface: ACTIVE");
        }

        if (this.config.enableWeb) {
            console.log(
                `🌐 Web Interface: http://localhost:${this.config.webPort}`
            );
        }

        if (this.chatProvider) {
            console.log("🤖 Chat Provider: CONNECTED");
        }

        console.log("🎯 Orchestrator: COORDINATING ALL INTERFACES");
        console.log("===============================================\n");
    }

    // ===== Public API =====

    /**
     * Get current game state
     */
    public getCurrentState(): any {
        return this.runtime.getCurrentState();
    }

    /**
     * Get connected web clients count
     */
    public getWebClientsCount(): number {
        return this.webUI ? this.webUI.getConnectedClientsCount() : 0;
    }

    /**
     * Send message to both interfaces
     */
    public async broadcastMessage(
        content: string,
        type: "system" | "info" = "system"
    ): Promise<void> {
        const promises: Promise<void>[] = [];

        if (this.consoleUI) {
            console.log(`[Broadcast] ${content}`);
        }

        if (this.webUI) {
            promises.push(
                this.webUI.displayNotification("Broadcast", content, "info")
            );
        }

        await Promise.all(promises);
    }

    /**
     * Get current MCP protocol
     */
    public getCurrentMCPProtocol(): string {
        return "default";
    }
}

// ===== Main Execution =====

async function main() {
    const config: DualModeConfig = {
        enableConsole: process.env.ENABLE_CONSOLE !== "false",
        enableWeb: process.env.ENABLE_WEB !== "false",
        webPort: parseInt(process.env.WEB_PORT || "3000"),
        gameTitle: "X+1 Dual Mode Game",
        debugMode: process.env.DEBUG_MODE === "true",
    };

    const gameManager = new DualModeGameManager(config);

    // Graceful shutdown
    process.on("SIGINT", async () => {
        console.log("\n🛑 Shutting down dual mode game...");
        await gameManager.stop();
        process.exit(0);
    });

    try {
        await gameManager.start();
    } catch (error) {
        console.error("❌ Failed to start dual mode game:", error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}

export { DualModeGameManager, DualModeConfig };
