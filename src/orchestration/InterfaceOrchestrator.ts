import { EventEmitter } from "events";
import { Runtime } from "../runtime/Runtime";
import { MCPDriverAdapter } from "../drivers/MCPDriverAdapter";
import { MCPClientDriver } from "../drivers/MCPClientDriver";
import { OllamaChatProvider } from "../chat-provider/OllamaChatProvider";
import { ConsoleGamificationUI } from "../ui/ConsoleGamificationUI";
import { Logger } from "../utils/logger";

export interface OrchestratorConfig {
    enableChatProvider?: boolean;
    enableUI?: boolean;
    enableAgentControl?: boolean;
    syncInterval?: number;
}

export interface InterfaceEvent {
    source: "chat" | "ui" | "agent";
    type: string;
    data: any;
    timestamp: number;
}

/**
 * Central orchestrator for all interaction interfaces
 * Coordinates between chat-provider, UI, and agent control
 */
export class InterfaceOrchestrator extends EventEmitter {
    private runtime: Runtime;
    private mcpAdapter: MCPDriverAdapter;
    private chatProvider?: OllamaChatProvider;
    private ui?: ConsoleGamificationUI;
    private config: OrchestratorConfig;
    private eventQueue: InterfaceEvent[] = [];
    private isProcessing = false;

    constructor(
        runtime: Runtime,
        mcpAdapter: MCPDriverAdapter,
        config: OrchestratorConfig = {}
    ) {
        super();
        this.runtime = runtime;
        this.mcpAdapter = mcpAdapter;
        this.config = {
            syncInterval: 100,
            ...config,
        };

        this.setupCoreEventHandlers();
    }

    /**
     * Connect chat provider for AI interactions
     */
    connectChatProvider(chatProvider: OllamaChatProvider): void {
        this.chatProvider = chatProvider;

        // Register MCP tools with chat provider
        const mcpClient = this.mcpAdapter;
        this.registerToolsWithChatProvider(mcpClient);

        // Listen to chat events
        this.chatProvider.on("message", (data) => {
            this.queueEvent({
                source: "chat",
                type: "message",
                data,
                timestamp: Date.now(),
            });
        });

        this.chatProvider.on("tool:executed", (data) => {
            this.queueEvent({
                source: "chat",
                type: "tool_execution",
                data,
                timestamp: Date.now(),
            });
        });

        Logger.info("InterfaceOrchestrator: Chat provider connected");
    }

    /**
     * Connect UI for user interactions
     */
    connectUI(ui: ConsoleGamificationUI): void {
        this.ui = ui;

        // Setup bidirectional event flow
        this.ui.on("command", (data) => {
            this.queueEvent({
                source: "ui",
                type: "command",
                data,
                timestamp: Date.now(),
            });
        });

        this.ui.on("state:request", () => {
            this.broadcastCurrentState();
        });

        // Connect UI to MCP events
        const mcpClient = this.mcpAdapter;
        this.setupMCPToUIBridge(mcpClient);

        Logger.info("InterfaceOrchestrator: UI connected");
    }

    /**
     * Enable agent control for autonomous operations
     */
    async enableAgentControl(): Promise<void> {
        const mcpClient = this.mcpAdapter;

        // Load agent control prompts
        const servers = mcpClient.getServers();
        for (const server of servers) {
            try {
                const agentPrompt = await mcpClient.getPromptById(
                    server.id,
                    "agent_control",
                    { runtime: this.runtime.getCurrentState() }
                );

                // Setup agent polling
                this.startAgentPolling(server.id);
            } catch (error) {
                Logger.warn(`Could not load agent prompt for ${server.id}`, {
                    error,
                });
            }
        }

        Logger.info("InterfaceOrchestrator: Agent control enabled");
    }

    /**
     * Process queued events from all interfaces
     */
    private async processEventQueue(): Promise<void> {
        if (this.isProcessing || this.eventQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.eventQueue.length > 0) {
            const event = this.eventQueue.shift()!;

            try {
                await this.processInterfaceEvent(event);
            } catch (error) {
                Logger.error(
                    "Failed to process interface event",
                    error as Error,
                    event
                );
                this.emit("error", { event, error });
            }
        }

        this.isProcessing = false;
    }

    /**
     * Process individual interface event
     */
    private async processInterfaceEvent(event: InterfaceEvent): Promise<void> {
        Logger.debug(
            `Processing ${event.source} event: ${event.type}`,
            event.data
        );

        switch (event.source) {
            case "chat":
                await this.processChatEvent(event);
                break;
            case "ui":
                await this.processUIEvent(event);
                break;
            case "agent":
                await this.processAgentEvent(event);
                break;
        }

        // Broadcast state changes to all interfaces
        this.broadcastStateUpdate(event);
    }

    /**
     * Process chat provider events
     */
    private async processChatEvent(event: InterfaceEvent): Promise<void> {
        if (event.type === "tool_execution") {
            // Chat provider executed a tool, update runtime
            const { tool, params, result } = event.data;

            // Check if this affects state
            if (tool === "transition_state") {
                await this.runtime.transitionTo(params.targetState, "chat", {
                    reason: params.reason,
                    chatContext: event.data,
                });
            }

            // Update UI if connected
            this.ui?.displayInfo(`Chat executed: ${tool}`, result);
        }
    }

    /**
     * Process UI events
     */
    private async processUIEvent(event: InterfaceEvent): Promise<void> {
        if (event.type === "command") {
            const { command, args } = event.data;

            // Route command through runtime
            if (command === "transition") {
                await this.runtime.transitionTo(args[0], "ui", {
                    command: event.data,
                });
            }

            // Notify chat provider for context
            if (this.chatProvider) {
                const conversation = this.chatProvider.getCurrentConversation();
                if (conversation) {
                    await this.chatProvider.send(
                        conversation.id,
                        `User executed command: ${command} ${args.join(" ")}`
                    );
                }
            }
        }
    }

    /**
     * Process agent control events
     */
    private async processAgentEvent(event: InterfaceEvent): Promise<void> {
        if (event.type === "remote_command") {
            const { command, source } = event.data;

            // Execute through runtime
            const action = {
                id: `agent-${Date.now()}`,
                agentId: source,
                type: command.action,
                params: command.params,
                timestamp: Date.now(),
            };

            const result = await this.runtime.executeAction(action);

            // Broadcast result to all interfaces
            this.broadcastActionResult(action, result);
        }
    }

    /**
     * Register MCP tools with chat provider
     */
    private async registerToolsWithChatProvider(
        mcpClient: MCPClientDriver
    ): Promise<void> {
        if (!this.chatProvider) return;

        const servers = mcpClient.getServers();

        for (const server of servers) {
            try {
                // Get available tools from server
                const tools = await mcpClient.listTools(server.id);

                // Register each tool with chat provider
                for (const tool of tools) {
                    this.chatProvider.registerTool({
                        name: tool.name,
                        description: tool.description,
                        parameters: tool.inputSchema,
                        execute: async (params: any) => {
                            return await mcpClient.executeTool(
                                server.id,
                                tool.name,
                                params
                            );
                        },
                    });
                }

                Logger.info(
                    `Registered ${tools.length} tools from ${server.id} with chat provider`
                );
            } catch (error) {
                Logger.warn(`Could not register tools from ${server.id}`, {
                    error,
                });
            }
        }
    }

    /**
     * Setup bridge between MCP events and UI
     */
    private setupMCPToUIBridge(mcpClient: MCPClientDriver): void {
        if (!this.ui) return;

        // Forward MCP events to UI
        mcpClient.on("tool:executed", (data) => {
            this.ui!.displayToolResult({
                tool: data.toolName,
                result: data.result,
                executionTime: data.executionTime,
            });
        });

        mcpClient.on("server:health-changed", (data) => {
            this.ui!.displayHealthStatus({
                serverId: data.serverId,
                healthy: data.healthy,
                message: `Server ${data.serverId} is ${
                    data.healthy ? "online" : "offline"
                }`,
            });
        });

        mcpClient.on("state:synced", (data) => {
            this.ui!.displayInfo("State synchronized", data.state);
        });
    }

    /**
     * Start polling for agent commands
     */
    private startAgentPolling(serverId: string): void {
        setInterval(async () => {
            try {
                const mcpClient = this.mcpAdapter;
                const command = await mcpClient.executeTool(
                    serverId,
                    "get_next_command",
                    { context: this.runtime.getCurrentState() }
                );

                if (command) {
                    this.queueEvent({
                        source: "agent",
                        type: "remote_command",
                        data: { command, source: serverId },
                        timestamp: Date.now(),
                    });
                }
            } catch (error) {
                // Silent fail - agent might not have commands
            }
        }, this.config.syncInterval);
    }

    /**
     * Broadcast state update to all interfaces
     */
    private broadcastStateUpdate(triggerEvent: InterfaceEvent): void {
        const state = this.runtime.getCurrentState();

        // Update UI
        this.ui?.updateState(state);

        // Update chat context
        if (this.chatProvider) {
            const conversation = this.chatProvider.getCurrentConversation();
            if (conversation) {
                conversation.metadata = {
                    ...conversation.metadata,
                    currentState: state,
                };
            }
        }

        // Emit for external listeners
        this.emit("state:updated", {
            state,
            trigger: triggerEvent,
        });
    }

    /**
     * Broadcast current state to all interfaces
     */
    private broadcastCurrentState(): void {
        const state = this.runtime.getCurrentState();
        const stats = this.runtime.getStatistics();

        this.emit("state:broadcast", { state, stats });
        this.ui?.displayGameStatus();
    }

    /**
     * Broadcast action result to all interfaces
     */
    private broadcastActionResult(action: any, result: any): void {
        // Update UI
        this.ui?.displayActionResult({
            action: action.type,
            result: result.result,
            success: result.success,
        });

        // Update chat context
        if (this.chatProvider) {
            const conversation = this.chatProvider.getCurrentConversation();
            if (conversation) {
                this.chatProvider.send(
                    conversation.id,
                    `Action executed: ${action.type} - ${
                        result.success ? "Success" : "Failed"
                    }`
                );
            }
        }

        this.emit("action:result", { action, result });
    }

    /**
     * Queue an event for processing
     */
    private queueEvent(event: InterfaceEvent): void {
        this.eventQueue.push(event);
        setImmediate(() => this.processEventQueue());
    }

    /**
     * Setup core event handlers
     */
    private setupCoreEventHandlers(): void {
        // Listen to runtime events
        this.runtime.on("stateTransition", (data) => {
            this.broadcastStateUpdate({
                source: "ui",
                type: "transition",
                data,
                timestamp: Date.now(),
            });
        });

        this.runtime.on("actionExecuted", (data) => {
            this.broadcastActionResult(data.action, data.result);
        });

        // Process event queue periodically
        setInterval(() => {
            this.processEventQueue();
        }, this.config.syncInterval);
    }

    /**
     * Get orchestrator statistics
     */
    getStatistics(): any {
        return {
            queueLength: this.eventQueue.length,
            isProcessing: this.isProcessing,
            connectedInterfaces: {
                chat: !!this.chatProvider,
                ui: !!this.ui,
                agent: this.config.enableAgentControl,
            },
            runtimeStats: this.runtime.getStatistics(),
        };
    }

    /**
     * Cleanup and shutdown
     */
    async shutdown(): Promise<void> {
        this.removeAllListeners();
        this.eventQueue = [];
        await this.runtime.shutdown();
        Logger.info("InterfaceOrchestrator: Shutdown complete");
    }
}
