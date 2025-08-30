import { MCPDriverAdapter } from "@/drivers";
import { Logger } from "@/utils";
import BaseMCPServer from "./BaseMCPServer";
import { ContentManager, CRUDToolsManager, CoreComponentsManager } from "./managers";
import { DEFAULT_DEVOPS_MCP_SERVER_CONFIG } from "./MCPLauncherServer";
import { BaseMCPServerConfig } from "./MCPServerConfig";
import { DevOpsPluginManager, PluginContext, XPlus1ControlPlugin } from "./plugins";
import { z } from "zod";

/**
 * DevOps MCP Server
 * Provides DevOps automation and management capabilities
 * NEW: Plugin system for modular functionality
 */
export class DevOpsServer extends BaseMCPServer {
    private mcpAdapter?: MCPDriverAdapter;
    private pluginManager?: DevOpsPluginManager;

    // Manager architecture for better code organization (NEW)
    private contentManager?: ContentManager;
    private crudToolsManager?: CRUDToolsManager;
    private coreComponentsManager?: CoreComponentsManager;

    constructor() {
        const config: BaseMCPServerConfig = DEFAULT_DEVOPS_MCP_SERVER_CONFIG;
		console.log("Start")
        super(config);

        // Initialize manager architecture for better code organization
        // this.initializeManagers();

        // Initialize MCP adapter for connecting to other servers
        // this.initializeMCPAdapter();
        // Plugin system will be initialized in setupServerSpecifics
        // Initialize default content will be called in setupServerSpecifics
    }

    /**
     * Initialize the manager architecture for better code organization (NEW)
     */
    private initializeManagers(): void {
        try {
            // Content manager for CRUD operations
            this.contentManager = new ContentManager(
                this.server,
                "devops-mcp-server"
            );

            // CRUD tools manager
            this.crudToolsManager = new CRUDToolsManager(
                this.server,
                this.contentManager,
                "devops-mcp-server"
            );

            // Core components manager
            this.coreComponentsManager = new CoreComponentsManager(
                this.server,
                "devops-mcp-server",
                3003
            );

            Logger.mcpInfo("DevOps: Manager architecture initialized");
        } catch (error) {
            Logger.mcpError("DevOps: Failed to initialize managers", { error });
            // Disable managers if they fail
            this.contentManager = undefined;
            this.crudToolsManager = undefined;
            this.coreComponentsManager = undefined;
        }
    }

    /**
     * Initialize MCP Driver Adapter for connecting to other servers
     */
    private initializeMCPAdapter(): void {
        try {
            this.mcpAdapter = new MCPDriverAdapter();

            // Add default MCP servers that might be running
            this.setupMCPConnections();

            Logger.mcpVerbose("DevOps: MCP Adapter initialized");
        } catch (error) {
            Logger.mcpError("DevOps: Failed to initialize MCP Adapter", {
                error,
            });
            this.mcpAdapter = undefined;
        }
    }

    /**
     * Setup connections to other MCP servers
     */
    private async setupMCPConnections(): Promise<void> {
        if (!this.mcpAdapter) return;

        const mcpServers = [
            {
                id: "xplus1-mcp-machine",
                name: "X+1 MCP Machine",
                url: "http://localhost:3001",
                timeout: 5000,
                maxRetries: 2,
            },
            {
                id: "wiki-mcp-browser",
                name: "Wiki MCP Browser",
                url: "http://localhost:3002",
                timeout: 5000,
                maxRetries: 2,
            },
            {
                id: "mcp-service-launcher",
                name: "MCP Service Launcher",
                url: "http://localhost:3000",
                timeout: 5000,
                maxRetries: 2,
            },
        ];

        for (const server of mcpServers) {
            try {
                await this.mcpAdapter.addServer(server);
                Logger.mcpVerbose(`DevOps: Connected to ${server.name}`, {
                    serverId: server.id,
                });
            } catch (error) {
                Logger.mcpVerbose(
                    `DevOps: Could not connect to ${server.name}`,
                    { error }
                );
            }
        }
    }

    /**
     * Initialize Plugin System
     * Sets up the plugin manager and loads default plugins
     */
    private initializePluginSystem(): void {
        try {
            // Create plugin context
            const pluginContext: Omit<PluginContext, "config"> = {
                server: this.server,
                mcpAdapter: this.mcpAdapter,
                log: (level, message, data) => {
                    switch (level) {
                        case "info":
                            Logger.mcpInfo(message, data);
                            break;
                        case "warn":
                            Logger.mcpWarn(message, data);
                            break;
                        case "error":
                            Logger.mcpError(message, data);
                            break;
                        case "debug":
                            Logger.mcpVerbose(message, data);
                            break;
                    }
                },
            };

            // Initialize plugin manager
            this.pluginManager = new DevOpsPluginManager(pluginContext);

            // Register default plugins
            this.registerDefaultPlugins();

            Logger.mcpInfo("DevOps: Plugin system initialized");
        } catch (error) {
            Logger.mcpError("DevOps: Failed to initialize plugin system", {
                error,
            });
            this.pluginManager = undefined;
        }
    }

    /**
     * Register default plugins
     */
    private async registerDefaultPlugins(): Promise<void> {
        if (!this.pluginManager) return;

        try {
            // Optional env toggle to disable plugin entirely
            if (process.env.XPLUS1_PLUGIN_DISABLED === "true") {
                Logger.mcpInfo(
                    "DevOps: XPlus1 plugin disabled via env (XPLUS1_PLUGIN_DISABLED=true)"
                );
                return;
            }

            // Register XPlus1 Control Plugin with dependency health guard
            const xplus1Plugin = new XPlus1ControlPlugin();

            let isHealthy = false;
            if (this.mcpAdapter) {
                try {
                    isHealthy = await this.mcpAdapter.healthCheck(
                        "xplus1-mcp-machine"
                    );
                } catch (hcError) {
                    Logger.mcpVerbose(
                        "DevOps: Health check for xplus1-mcp-machine failed",
                        { error: hcError }
                    );
                }
            }

            await this.pluginManager.registerPlugin(xplus1Plugin, {
                forceEnable: isHealthy,
                skipInitialization: !isHealthy,
                customSettings: {
                    priority: "high",
                    autoLoad: isHealthy,
                },
            });

            if (!isHealthy) {
                Logger.mcpWarn(
                    "DevOps: XPlus1 server unavailable. Plugin registered but not initialized (will retry once in 15s)."
                );
                // One-off delayed retry to initialize if the dependency becomes available shortly after startup
                setTimeout(async () => {
                    try {
                        if (!this.pluginManager) return;
                        if (this.mcpAdapter) {
                            const ok = await this.mcpAdapter.healthCheck(
                                "xplus1-mcp-machine"
                            );
                            if (!ok) {
                                Logger.mcpWarn(
                                    "DevOps: XPlus1 server still unavailable on retry; leaving plugin inactive."
                                );
                                return;
                            }
                        }
                        await this.pluginManager.initializePlugin(
                            "xplus1-control"
                        );
                        await this.pluginManager.setPluginEnabled(
                            "xplus1-control",
                            true
                        );
                        Logger.mcpInfo(
                            "DevOps: XPlus1 plugin initialized successfully after retry"
                        );
                    } catch (retryErr) {
                        Logger.mcpWarn(
                            "DevOps: Failed to initialize XPlus1 plugin on retry",
                            { error: retryErr }
                        );
                    }
                }, 15000);
            } else {
                Logger.mcpInfo(
                    "DevOps: Default plugins registered and initialized"
                );
            }
        } catch (error) {
            Logger.mcpError("DevOps: Failed to register default plugins", {
                error,
            });
        }
    }

    /**
     * Initialize default resources and prompts
     */
    private initializeDefaultContent(): void {
        // Initialize default DevOps prompts
        this.contentManager?.addPrompt({
            id: "start-system",
            name: "Arrancar el sistema",
            description: "Prompt para arrancar el sistema usando npm start",
            content: `🚀 **Sistema de Arranque**

Por favor, utiliza las herramientas base de VS Code para ejecutar el comando \`npm start\` en el terminal del proyecto.

**Pasos recomendados:**
1. Abre el terminal integrado de VS Code (Ctrl+\`)
2. Asegúrate de estar en el directorio raíz del proyecto
3. Ejecuta: \`npm start\`
4. Monitorea la salida para verificar que el sistema arranque correctamente

**Información del contexto:**
- Proyecto: state-machine-mcp-driver
- Script principal: npm start
- Puerto esperado: Verificar logs de arranque

¿Necesitas ayuda con algún paso específico del arranque del sistema?`,
            parameters: {
                projectPath: z
                    .string()
                    .optional()
                    .describe("Ruta del proyecto"),
                environment: z
                    .string()
                    .optional()
                    .describe("Entorno de ejecución"),
            },
            metadata: {
                category: "devops",
                priority: "high",
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        this.contentManager?.addPrompt({
            id: "open-web-console",
            name: "Abrir consola web",
            description: "Prompt para abrir la consola web en localhost:8080",
            content: `🌐 **Consola Web**

Por favor, abre el navegador simple de VS Code para acceder a la consola web del sistema.

**URL objetivo:** http://localhost:8080

**Pasos recomendados:**
1. Usa la herramienta de navegador simple de VS Code
2. Navega a: http://localhost:8080
3. Verifica que la aplicación web esté respondiendo correctamente

**Si el puerto 8080 no está disponible, verifica:**
- Que el sistema esté ejecutándose correctamente
- Los logs del servidor para identificar el puerto real
- Configuración de puertos en packageon o variables de entorno

¿El navegador web está funcionando correctamente?`,
            parameters: {
                port: z.number().optional().describe("Puerto del servidor web"),
                host: z.string().optional().describe("Host del servidor"),
            },
            metadata: {
                category: "devops",
                priority: "medium",
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        // Initialize default resources
        this.contentManager?.addResource({
            id: "project-status",
            name: "Estado del Proyecto",
            description: "Estado actual del proyecto y servicios",
            uri: "devops://project/status",
            mimeType: "application/json",
            content: JSON.stringify(
                {
                    projectName: "state-machine-mcp-driver",
                    status: "initialized",
                    services: [],
                    lastCheck: new Date().toISOString(),
                },
                null,
                2
            ),
            metadata: {
                category: "status",
                updateInterval: "30s",
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        this.contentManager?.addResource({
            id: "npm-scripts",
            name: "Scripts NPM Disponibles",
            description: "Lista de scripts NPM disponibles en el proyecto",
            uri: "devops://npm/scripts",
            mimeType: "application/json",
            content: JSON.stringify(
                {
                    availableScripts: [
                        "npm start",
                        "npm run dev",
                        "npm run build",
                        "npm test",
                        "npm run launcher",
                        "npm run cleannode",
                    ],
                    recommended: "npm start",
                    description:
                        "Scripts principales para el desarrollo y despliegue",
                },
                null,
                2
            ),
            metadata: {
                category: "documentation",
                source: "packageon",
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        // Add dynamic resources that query live game state
        this.setupDynamicResources();
    }

    /**
     * Setup DevOps specific tools, resources, and prompts
     */
    protected async setupServerSpecifics(): Promise<void> {
        // Register manager tools first (NEW: Additional CRUD and core tools)
        this.registerManagerTools();

        this.initializeDefaultContent();
        this.setupTools();
        // Initialize plugin system after core tools are setup
        this.initializePluginSystem();
        // Note: Plugins are initialized during registration; avoid double init
    }

    /**
     * Register tools from all managers (NEW)
     */
    private registerManagerTools(): void {
        try {
            if (this.crudToolsManager) {
                this.crudToolsManager.registerAllTools();
                Logger.mcpInfo(
                    "DevOps: Additional CRUD tools registered via manager"
                );
            }

            if (this.coreComponentsManager) {
                this.coreComponentsManager.registerAllTools();
                Logger.mcpInfo(
                    "DevOps: Additional core tools registered via manager"
                );
            }
        } catch (error) {
            Logger.mcpError("DevOps: Failed to register manager tools", {
                error,
            });
        }
    }

    /**
     * Initialize all registered plugins
     */
    private async initializePlugins(): Promise<void> {
        if (this.pluginManager) {
            try {
                await this.pluginManager.initializeAllPlugins();
                Logger.mcpInfo("DevOps: All plugins initialized");
            } catch (error) {
                Logger.mcpError("DevOps: Failed to initialize plugins", {
                    error,
                });
            }
        }
    }

    /**
     * Setup dynamic resources that query live game state
     */
    private setupDynamicResources(): void {
        // Live game state resource
        this.server.resource(
            "live-game-state",
            "devops://game/state/live",
            {
                name: "Estado del Juego en Tiempo Real",
                description:
                    "Estado actual del juego X+1 consultado dinámicamente via MCP",
                mimeType: "application/json",
            },
            async () => {
                try {
                    const gameState = await this.queryLiveGameState();
                    return {
                        contents: [
                            {
                                uri: "devops://game/state/live",
                                mimeType: "application/json",
                                text: JSON.stringify(gameState, null, 2),
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        contents: [
                            {
                                uri: "devops://game/state/live",
                                mimeType: "application/json",
                                text: JSON.stringify(
                                    {
                                        error: "Failed to query live game state",
                                        message:
                                            error instanceof Error
                                                ? error.message
                                                : "Unknown error",
                                        timestamp: new Date().toISOString(),
                                        available: false,
                                    },
                                    null,
                                    2
                                ),
                            },
                        ],
                    };
                }
            }
        );

        // Runtime statistics resource
        this.server.resource(
            "runtime-stats",
            "devops://runtime/statistics",
            {
                name: "Estadísticas del Runtime",
                description: "Estadísticas detalladas del runtime del juego",
                mimeType: "application/json",
            },
            async () => {
                try {
                    const stats = await this.queryRuntimeStatistics();
                    return {
                        contents: [
                            {
                                uri: "devops://runtime/statistics",
                                mimeType: "application/json",
                                text: JSON.stringify(stats, null, 2),
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        contents: [
                            {
                                uri: "devops://runtime/statistics",
                                mimeType: "application/json",
                                text: JSON.stringify(
                                    {
                                        error: "Failed to query runtime statistics",
                                        message:
                                            error instanceof Error
                                                ? error.message
                                                : "Unknown error",
                                        timestamp: new Date().toISOString(),
                                    },
                                    null,
                                    2
                                ),
                            },
                        ],
                    };
                }
            }
        );

        // MCP servers health resource
        this.server.resource(
            "mcp-servers-health",
            "devops://mcp/health",
            {
                name: "Estado de Servidores MCP",
                description: "Estado de salud de todos los servidores MCP",
                mimeType: "application/json",
            },
            async () => {
                try {
                    const health = await this.queryMCPServersHealth();
                    return {
                        contents: [
                            {
                                uri: "devops://mcp/health",
                                mimeType: "application/json",
                                text: JSON.stringify(health, null, 2),
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        contents: [
                            {
                                uri: "devops://mcp/health",
                                mimeType: "application/json",
                                text: JSON.stringify(
                                    {
                                        error: "Failed to query MCP servers health",
                                        message:
                                            error instanceof Error
                                                ? error.message
                                                : "Unknown error",
                                        timestamp: new Date().toISOString(),
                                    },
                                    null,
                                    2
                                ),
                            },
                        ],
                    };
                }
            }
        );

        // Agents status resource
        this.server.resource(
            "agents-status",
            "devops://game/agents",
            {
                name: "Estado de los Agentes",
                description: "Estado actual de todos los agentes del juego",
                mimeType: "application/json",
            },
            async () => {
                try {
                    const agents = await this.queryAgentsStatus();
                    return {
                        contents: [
                            {
                                uri: "devops://game/agents",
                                mimeType: "application/json",
                                text: JSON.stringify(agents, null, 2),
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        contents: [
                            {
                                uri: "devops://game/agents",
                                mimeType: "application/json",
                                text: JSON.stringify(
                                    {
                                        error: "Failed to query agents status",
                                        message:
                                            error instanceof Error
                                                ? error.message
                                                : "Unknown error",
                                        timestamp: new Date().toISOString(),
                                    },
                                    null,
                                    2
                                ),
                            },
                        ],
                    };
                }
            }
        );
    }

    /**
     * Setup DevOps tools (excluding CRUD operations handled by managers)
     */
    private setupTools(): void {
        // CRUD operations are now handled by CRUDToolsManager
        // Core tools (start_system, open_web_console, get_server_status) are handled by CoreComponentsManager

        // This method is kept for any future DevOps-specific tools
        // that are not generic enough to be in the managers

        Logger.mcpInfo(
            "DevOps: Custom tools setup completed (using managers for CRUD and core tools)"
        );
    }

    // Note: Prompt/Resource handlers and storage are managed by ContentManager

    // ===== LIVE GAME STATE QUERY METHODS =====

    /**
     * Query live game state from X+1 MCP Machine
     */
    private async queryLiveGameState(): Promise<any> {
        if (!this.mcpAdapter) {
            throw new Error("MCP Adapter not initialized");
        }

        try {
            // Get X value and status
            const xStatus = await this.mcpAdapter.executeTool(
                "xplus1-mcp-machine",
                "get_x_status",
                {}
            );

            // Get current game state
            const fullGameState = await this.mcpAdapter.executeTool(
                "xplus1-mcp-machine",
                "get_full_game_state",
                {}
            );

            // Get UI status
            const uiStatus = await this.mcpAdapter.executeTool(
                "xplus1-mcp-machine",
                "get_ui_status",
                {}
            );

            // Get interaction state
            const interactionState = await this.mcpAdapter.executeTool(
                "xplus1-mcp-machine",
                "get_interaction_state",
                {}
            );

            return {
                timestamp: new Date().toISOString(),
                serverId: "xplus1-mcp-machine",
                gameState: {
                    x: xStatus?.content?.[0]?.text || "Unknown",
                    fullState: fullGameState?.content?.[0]?.text || "Unknown",
                    uiStatus: uiStatus?.content?.[0]?.text || "Unknown",
                    interaction:
                        interactionState?.content?.[0]?.text || "Unknown",
                },
                available: true,
                lastUpdate: Date.now(),
            };
        } catch (error) {
            Logger.mcpError("DevOps: Failed to query live game state", {
                error,
            });
            throw error;
        }
    }

    /**
     * Query runtime statistics if available
     */
    private async queryRuntimeStatistics(): Promise<any> {
        if (!this.mcpAdapter) {
            throw new Error("MCP Adapter not initialized");
        }

        try {
            // Since the Runtime is typically embedded in the application,
            // we'll try to get statistics from the X+1 machine server
            const consoleOutput = await this.mcpAdapter.executeTool(
                "xplus1-mcp-machine",
                "get_console_output",
                {}
            );

            const conversationThread = await this.mcpAdapter.executeTool(
                "xplus1-mcp-machine",
                "get_current_conversation",
                {}
            );

            // Calculate some basic statistics
            const statistics = {
                timestamp: new Date().toISOString(),
                serverAvailable: true,
                gameMetrics: {
                    consoleOutput:
                        consoleOutput?.content?.[0]?.text || "Not available",
                    conversationThread:
                        conversationThread?.content?.[0]?.text ||
                        "Not available",
                },
                performance: {
                    responseTime: Date.now(), // Simple timestamp
                    serverStatus: "active",
                },
            };

            return statistics;
        } catch (error) {
            Logger.mcpError("DevOps: Failed to query runtime statistics", {
                error,
            });
            throw error;
        }
    }

    /**
     * Query MCP servers health status
     */
    private async queryMCPServersHealth(): Promise<any> {
        if (!this.mcpAdapter) {
            throw new Error("MCP Adapter not initialized");
        }

        const healthResults: Record<string, any> = {};
        const servers = [
            "xplus1-mcp-machine",
            "wiki-mcp-browser",
            "mcp-service-launcher",
        ];

        for (const serverId of servers) {
            try {
                const isHealthy = await this.mcpAdapter.healthCheck(serverId);
                healthResults[serverId] = {
                    status: isHealthy ? "healthy" : "unhealthy",
                    lastCheck: new Date().toISOString(),
                    available: true,
                };
            } catch (error) {
                healthResults[serverId] = {
                    status: "error",
                    error:
                        error instanceof Error
                            ? error.message
                            : "Unknown error",
                    lastCheck: new Date().toISOString(),
                    available: false,
                };
            }
        }

        // Also query service launcher for more detailed status
        try {
            const serviceStatus = await this.mcpAdapter.executeTool(
                "mcp-service-launcher",
                "get_server_status",
                {}
            );

            healthResults.launcher_detailed = {
                status: "available",
                details:
                    serviceStatus?.content?.[0]?.text || "Status not available",
                lastCheck: new Date().toISOString(),
            };
        } catch (error) {
            healthResults.launcher_detailed = {
                status: "unavailable",
                error: error instanceof Error ? error.message : "Unknown error",
                lastCheck: new Date().toISOString(),
            };
        }

        return {
            timestamp: new Date().toISOString(),
            servers: healthResults,
            summary: {
                total: servers.length,
                healthy: Object.values(healthResults).filter(
                    (h: any) => h.status === "healthy"
                ).length,
                unhealthy: Object.values(healthResults).filter(
                    (h: any) => h.status !== "healthy"
                ).length,
            },
        };
    }

    /**
     * Query agents status from the game
     */
    private async queryAgentsStatus(): Promise<any> {
        if (!this.mcpAdapter) {
            throw new Error("MCP Adapter not initialized");
        }

        try {
            // Get available agents/postulations
            const availableAgents = await this.mcpAdapter.executeTool(
                "xplus1-mcp-machine",
                "get_available_postulations",
                {}
            );

            // Get current conversation to see active agents
            const conversation = await this.mcpAdapter.executeTool(
                "xplus1-mcp-machine",
                "get_current_conversation",
                {}
            );

            // Get interaction state to see what agents are available
            const interactionState = await this.mcpAdapter.executeTool(
                "xplus1-mcp-machine",
                "get_interaction_state",
                {}
            );

            return {
                timestamp: new Date().toISOString(),
                agents: {
                    available:
                        availableAgents?.content?.[0]?.text || "Not available",
                    conversation:
                        conversation?.content?.[0]?.text || "Not available",
                    interaction:
                        interactionState?.content?.[0]?.text || "Not available",
                },
                status: "active",
                lastUpdate: Date.now(),
            };
        } catch (error) {
            Logger.mcpError("DevOps: Failed to query agents status", { error });
            throw error;
        }
    }
}
