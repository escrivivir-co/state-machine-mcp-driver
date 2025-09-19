/**
 * Node-RED Gamification UI
 * Angular-based UI for Node-RED network discovery and management
 * Integrates with AlephScript ecosystem for multi-UI coordination
 */

import { GamificationUI, BaseGamificationUIConfig, GameMessage, GameThread } from "./GamificationUI";
import { Runtime } from "@/runtime";
import { MCPDriverAdapter } from "@/drivers";
import { Logger } from "@/utils";
import express from "express";
import * as path from "path";
import * as http from "http";
import { AlephScriptFrontendClient } from "./shared/AlephScriptFrontendClient";

/**
 * Configuration interface for Node-RED Gamification UI
 */
export interface NodeRedGamificationUIConfig extends BaseGamificationUIConfig {
    /** Port for the Angular web server */
    port: number;
    /** Static directory where Angular dist is located */
    staticDir?: string;
    /** Whether to provide compiled template (true) or use dynamic HTML (false) */
    provideTemplate?: boolean;
    /** Whether to auto-open browser */
    autoOpenBrowser?: boolean;
    /** CORS origin configuration */
    corsOrigin?: string;
    /** Enable debug mode */
    debugMode?: boolean;
    /** Features to enable in the UI */
    features?: string[];
}

/**
 * Node-RED Gamification UI Implementation
 * Serves Angular application with Node-RED discovery and management capabilities
 */
export class NodeRedGamificationUI extends GamificationUI {
    protected config: NodeRedGamificationUIConfig; // Make it protected to match base class
    private app: express.Application;
    private server: http.Server | null = null;
    private alephScriptClient: AlephScriptFrontendClient | null = null;
    private isStarted = false;

    constructor(
        runtime: Runtime,
        mcpAdapter: MCPDriverAdapter,
        config: NodeRedGamificationUIConfig
    ) {
        super(runtime, mcpAdapter, config);
        this.config = {
            // Default configuration
            staticDir: path.resolve(process.cwd(), "public_templates/node-red-gamify-ui"),
            provideTemplate: true,
            autoOpenBrowser: false,
            corsOrigin: "*",
            debugMode: false,
            features: ["node_red_discovery", "multi_instance_management"],
            ...config // User config overrides defaults
        };

        this.app = express();
        this.setupExpress();

        Logger.info(`NodeRedGamificationUI initialized on port ${this.config.port}`);
    }

    /**
     * Start the Node-RED UI server
     */
    async start(): Promise<void> {
        if (this.isStarted) {
            Logger.warn("NodeRedGamificationUI already started");
            return;
        }

        try {
            // Start Express server
            await this.startServer();

            // Initialize AlephScript client for ecosystem integration
            await this.initializeAlephScriptClient();

            this.isStarted = true;
            Logger.info(`✅ NodeRedGamificationUI started successfully on http://localhost:${this.config.port}`);

            // Auto-open browser if configured
            if (this.config.autoOpenBrowser) {
                const open = await import('open');
                await open.default(`http://localhost:${this.config.port}`);
            }

            // Emit start event
            this.emit("uiStarted", {
                type: "node-red-gamify-ui",
                port: this.config.port,
                url: `http://localhost:${this.config.port}`
            });

        } catch (error) {
            Logger.error("Failed to start NodeRedGamificationUI", error as Error);
            throw error;
        }
    }

    /**
     * Stop the Node-RED UI server
     */
    async stop(): Promise<void> {
        if (!this.isStarted) {
            Logger.warn("NodeRedGamificationUI not started");
            return;
        }

        try {
            // Disconnect AlephScript client
            if (this.alephScriptClient) {
                await this.alephScriptClient.disconnect();
                this.alephScriptClient = null;
            }

            // Stop Express server
            if (this.server) {
                await new Promise<void>((resolve) => {
                    this.server!.close(() => {
                        Logger.info("NodeRedGamificationUI server stopped");
                        resolve();
                    });
                });
                this.server = null;
            }

            this.isStarted = false;
            Logger.info("✅ NodeRedGamificationUI stopped successfully");

            // Emit stop event
            this.emit("uiStopped", {
                type: "node-red-gamify-ui"
            });

        } catch (error) {
            Logger.error("Error stopping NodeRedGamificationUI", error as Error);
            throw error;
        }
    }

    /**
     * Display a game message in the UI
     */
    async displayMessage(message: GameMessage): Promise<void> {
        if (this.config.debugMode) {
            Logger.info(`[NodeRED-UI] Message: ${message.content}`);
        }

        // Send message to Angular frontend via AlephScript
        if (this.alephScriptClient) {
            this.alephScriptClient.sendGameAction("ui_message", {
                type: "game_message",
                message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Display agent postulations in the UI
     */
    async displayAgentPostulations(postulations: any[]): Promise<void> {
        if (this.config.debugMode) {
            Logger.info(`[NodeRED-UI] Postulations: ${postulations.length} items`);
        }

        // Send postulations to Angular frontend
        if (this.alephScriptClient) {
            this.alephScriptClient.sendGameAction("agent_postulations", {
                type: "agent_postulations",
                postulations,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Display notification in the UI
     */
    async displayNotification(
        title: string,
        message: string,
        type: "info" | "success" | "warning" | "error" = "info"
    ): Promise<void> {
        Logger.info(`📢 [NodeRED-UI] ${title}: ${message}`);

        // Send notification to Angular frontend
        if (this.alephScriptClient) {
            this.alephScriptClient.sendGameAction("notification", {
                type: "notification",
                title,
                message,
                notificationType: type,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Update phase display in the UI
     */
    async updatePhaseDisplay(phase: string): Promise<void> {
        Logger.info(`📍 [NodeRED-UI] Phase: ${phase}`);

        // Send phase update to Angular frontend
        if (this.alephScriptClient) {
            this.alephScriptClient.sendGameAction("phase_update", {
                type: "phase_update",
                phase,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Handle game state updates
     */
    protected async handleGameStateUpdate(state: any): Promise<void> {
        if (this.config.debugMode) {
            Logger.info(`[NodeRED-UI] Game state update:`, state);
        }

        // Send state update to Angular frontend
        if (this.alephScriptClient) {
            this.alephScriptClient.sendGameAction("game_state", {
                type: "game_state_update",
                state,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Handle thread updates
     */
    protected async handleThreadUpdate(thread: GameThread): Promise<void> {
        if (this.config.debugMode) {
            Logger.info(`[NodeRED-UI] Thread update:`, thread);
        }

        // Send thread update to Angular frontend
        if (this.alephScriptClient) {
            this.alephScriptClient.sendGameAction("thread_update", {
                type: "thread_update",
                thread,
                timestamp: new Date().toISOString()
            });
        }
    }

    // ===== Private Methods =====

    /**
     * Setup Express application with routes and middleware
     */
    private setupExpress(): void {
        // CORS middleware
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', this.config.corsOrigin);
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'node-red-gamify-ui',
                port: this.config.port,
                features: this.config.features,
                timestamp: new Date().toISOString()
            });
        });

        // API endpoint for UI configuration
        this.app.get('/api/config', (req, res) => {
            res.json({
                gameTitle: this.config.gameTitle,
                features: this.config.features,
                debugMode: this.config.debugMode,
                alephScriptConnected: !!this.alephScriptClient
            });
        });

        // Serve static Angular application
        if (this.config.staticDir && this.config.provideTemplate) {
            Logger.info(`Serving Angular app from: ${this.config.staticDir}`);
            this.app.use(express.static(this.config.staticDir));

            // SPA fallback - serve index.html for all non-API routes
            this.app.get('*', (req, res) => {
                if (!req.path.startsWith('/api/') && !req.path.startsWith('/health')) {
                    const indexPath = path.resolve(this.config.staticDir!, 'index.html');
                    res.sendFile(indexPath);
                } else {
                    res.status(404).json({ error: 'API endpoint not found' });
                }
            });
        } else {
            // Dynamic HTML fallback
            this.app.get('*', (req, res) => {
                res.send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>${this.config.gameTitle}</title>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1">
                    </head>
                    <body>
                        <h1>Node-RED Gamification UI</h1>
                        <p>Angular application not available. Please build and install the dist.</p>
                        <p>Current configuration:</p>
                        <pre>${JSON.stringify(this.config, null, 2)}</pre>
                    </body>
                    </html>
                `);
            });
        }
    }

    /**
     * Start the Express server
     */
    private async startServer(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.config.port, () => {
                Logger.info(`🌐 NodeRedGamificationUI server listening on port ${this.config.port}`);
                resolve();
            });

            this.server.on('error', (error: any) => {
                if (error.code === 'EADDRINUSE') {
                    Logger.error(`Port ${this.config.port} is already in use`);
                    reject(new Error(`Port ${this.config.port} is already in use`));
                } else {
                    Logger.error('Server error:', error);
                    reject(error);
                }
            });
        });
    }

    /**
     * Initialize AlephScript client for ecosystem integration
     */
    private async initializeAlephScriptClient(): Promise<void> {
        try {
            this.alephScriptClient = new AlephScriptFrontendClient({
                serverUrl: this.appConfig?.launcher?.socketUrl || "http://localhost:3000", // Default AlephScript server
                uiType: "node-red-gamify-ui" as any, // Cast to avoid type issues
                uiId: "node-red-manager"
            });

            // Setup event handlers
            if (this.alephScriptClient) {
                this.alephScriptClient.on("user_input", (data) => {
                    this.emit("userInput", data);
                });

                this.alephScriptClient.on("agent_message", (data) => {
                    this.emit("agentMessage", data);
                });

                this.alephScriptClient.on("connection_status", (status) => {
                    Logger.info(`[NodeRED-UI] AlephScript connection: ${status}`);
                });

                // Connect to AlephScript ecosystem
                await this.alephScriptClient.connect();
            }

            Logger.info("✅ AlephScript client initialized for NodeRedGamificationUI");

        } catch (error) {
            Logger.warn("Failed to initialize AlephScript client:", { error: (error as Error).message });
            // Continue without AlephScript integration
        }
    }

    /**
     * Get UI information for monitoring
     */
    getUIInfo(): {
        type: string;
        port: number;
        isStarted: boolean;
        features: string[];
        alephScriptConnected: boolean;
    } {
        return {
            type: "node-red-gamify-ui",
            port: this.config.port,
            isStarted: this.isStarted,
            features: this.config.features || [],
            alephScriptConnected: !!this.alephScriptClient
        };
    }
}

export default NodeRedGamificationUI;
