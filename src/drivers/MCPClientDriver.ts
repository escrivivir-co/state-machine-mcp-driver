/**
 * MCP Client Driver - Native MCP Protocol Implementation
 * Uses @modelcontextprotocol/sdk for native MCP communication
 * Implements IMCPDriver interface
 * 
 * Logger.mcpVerbose(`MCPClientDriver: Tool ${toolName} executed successfully`, { serverId, executionTime: mcpResponse.executionTime });
      return mcpResponse.content;
    } catch (error) {
      Logger.mcpError(`MCPClientDriver: Tool execution failed:`, { serverId, toolName, error });compatibility with Runtime
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
    ListToolsResultSchema,
    CallToolResultSchema,
    ListResourcesResultSchema,
    ReadResourceResultSchema,
    ListPromptsResultSchema,
    GetPromptResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { IMCPDriver, MCPServerTransportConfig } from "./IMCPDriver";
import { MCPToolResponse } from "./MCPTypes";
import { logger, Logger } from "../utils/logger";
import { EventEmitter } from "events";
import { MCPEvent } from "./MCPEvent";

export interface MCPResource {
    mimeType: string;
    uri: string;
    text: string;
    value: any;
}
export class MCPClient extends Client {
    name: string | undefined = "notset";
}

export class MCPClientDriver extends EventEmitter implements IMCPDriver {
    private clients: Map<string, Client> = new Map();
    private transports: Map<string, StreamableHTTPClientTransport> = new Map();
    public configs: Map<string, MCPServerTransportConfig> = new Map();
    private healthStatus: Map<string, boolean> = new Map();
    private healthIntervals: Map<string, NodeJS.Timeout> = new Map();
    private requestMutex: Map<string, Promise<any>> = new Map(); // Prevent concurrent requests

    constructor() {
        super();
        Logger.mcpVerbose(
            "MCPClientDriver: Initializing native MCP client driver"
        );

        // Set up global sync error handler
        this.on("mcp-sync-error", async (event) => {
            Logger.mcpWarn(
                `MCPClientDriver: Auto-handling sync error for server ${event.serverId}`
            );

            // Automatically attempt to resolve sync issues
            const resolved = await this.handleSyncIssues(event.serverId);

            if (resolved) {
                Logger.mcpInfo(
                    `MCPClientDriver: Auto-resolved sync error for ${event.serverId}`
                );
            } else {
                Logger.mcpError(
                    `MCPClientDriver: Failed to auto-resolve sync error for ${event.serverId}`
                );
            }
        });
    }

    /**
     * Add a new MCP server configuration
     */
    async addServer(config: MCPServerTransportConfig): Promise<void> {
        try {
            // Validate configuration
            this.validateServerConfig(config);

            const existing = this.configs.get(config.id);

            if (existing) {
                console.log("SET HERE TO OVERWRITE OR NOT CONFIG", existing.id)
                return;
            }

            // Store configuration
            this.configs.set(config.id, config);

            // Create MCP client
            const client = new MCPClient(
                {
                    name: config.id,
                    version: "1.0.0",
                },
                {
                    capabilities: {},
                }
            );
            client.name = "MCPC_" + config.id;

            // Set up error handler
            client.onerror = (error) => {
                Logger.mcpError(
                    `MCPClientDriver: Client error for ${config.id}/${client.name}:`,
                    { error: error.message, serverId: config.id }
                );

                // Check if it's the "unknown message ID" error
                if (error.message.includes("unknown message ID")) {
                    Logger.mcpWarn(
                        `MCPClientDriver: Message ID synchronization issue detected for ${config.id}`,
                        {
                            suggestion:
                                "Consider reconnecting or checking for concurrent requests",
                            serverId: config.id,
                        }
                    );

                    // Emit event for monitoring
                    this.emit("mcp-sync-error", {
                        type: "sync-error",
                        serverId: config.id,
                        error: error.message,
                        timestamp: Date.now(),
                    });
                }
            };

            // Create transport
            const baseUrl = new URL(`${config.url}/mcp`);
            const transport = new StreamableHTTPClientTransport(baseUrl);

            // Connect to server
            try {
                await client.connect(transport);
            } catch (err) {
                // Skip
                this.healthStatus.set(config.id, false);
            }

            // Store client and transport
            console.log(
                `MCPClientDriver: ADDING CLIENT connected to ${config.name} at ${config.url}`
            );
            this.clients.set(config.id, client);
            this.transports.set(config.id, transport);

            Logger.info(
                `MCPClientDriver: Successfully connected to ${config.name} at ${config.url}`
            );
        } catch (error) {
            Logger.mcpError(
                `MCPClientDriver: Failed to add server ${config.id}${
                    "MCPC_" + config.id
                }:`,
                { error }
            );
            this.healthStatus.set(config.id, false);
            throw error;
        }
    }

    public async reconnectClient(configId: string): Promise<boolean> {
        try {
            Logger.mcpVerbose(
                `MCPClientDriver: Attempting to reconnect client ${configId}`
            );

            // Get existing client and transport
            const client = this.clients.get(configId);
            const transport = this.transports.get(configId);
            const config = this.configs.get(configId);

            if (!client || !transport || !config) {
                Logger.mcpError(
                    `MCPClientDriver: Cannot reconnect - missing client/transport/config for ${configId}`
                );
                return false;
            }

            // Close existing connection gracefully
            try {
                await transport.close();
                Logger.mcpVerbose(
                    `MCPClientDriver: Closed existing transport for ${configId}`
                );
            } catch (err) {
                Logger.mcpWarn(
                    `MCPClientDriver: Error closing transport for ${configId}:`,
                    { error: err }
                );
            }

            // Create new transport
            const baseUrl = new URL(`${config.url}/mcp`);
            const newTransport = new StreamableHTTPClientTransport(baseUrl);

            // Reconnect with new transport
            await client.connect(newTransport);

            // Update stored transport
            this.transports.set(configId, newTransport);
            this.healthStatus.set(configId, true);

            Logger.mcpInfo(
                `MCPClientDriver: Successfully reconnected client ${configId}`
            );

            // Emit reconnection event
            this.emit("mcp-reconnected", {
                type: "reconnected",
                serverId: configId,
                timestamp: Date.now(),
            });

            return true;
        } catch (err) {
            Logger.mcpError(
                `MCPClientDriver: Failed to reconnect client ${configId}:`,
                { error: err }
            );
            this.healthStatus.set(configId, false);
            return false;
        }
    }
    /**
     * Remove a server configuration
     */
    async removeServer(serverId: string): Promise<boolean> {
        try {
            const transport = this.transports.get(serverId);
            if (transport) {
                await transport.close();
            }

            const removed = this.configs.delete(serverId);
            this.clients.delete(serverId);
            this.transports.delete(serverId);
            this.healthStatus.delete(serverId);
            this.requestMutex.delete(serverId); // Clean up mutex

            if (removed) {
                Logger.mcpVerbose(
                    `MCPClientDriver: Removed server ${serverId}`
                );
            }

            return removed;
        } catch (error) {
            Logger.mcpError(
                `MCPClientDriver: Error removing server ${serverId}:`,
                { error }
            );
            return false;
        }
    }

    /**
     * Get a list of all configured servers
     */
    getServers(): MCPServerTransportConfig[] {
        return Array.from(this.configs.values());
    }

    /**
     * Get server by ID
     */
    getServer(serverId: string): MCPServerTransportConfig | undefined {
        return this.configs.get(serverId);
    }

    /**
     * Check and handle synchronization issues
     */
    public async handleSyncIssues(serverId: string): Promise<boolean> {
        Logger.mcpVerbose(
            `MCPClientDriver: Handling sync issues for ${serverId}`
        );

        try {
            // Try to reconnect the client to reset message ID state
            const reconnected = await this.reconnectClient(serverId);

            if (reconnected) {
                Logger.mcpInfo(
                    `MCPClientDriver: Sync issues resolved for ${serverId} via reconnection`
                );
                return true;
            } else {
                Logger.mcpWarn(
                    `MCPClientDriver: Could not resolve sync issues for ${serverId}`
                );
                return false;
            }
        } catch (error) {
            Logger.mcpError(
                `MCPClientDriver: Error handling sync issues for ${serverId}:`,
                { error }
            );
            return false;
        }
    }

    /**
     * Get health status of a server
     */
    public getServerHealth(serverId: string): boolean {
        return this.healthStatus.get(serverId) ?? false;
    }

    /**
     * Get health status of all servers
     */
    public getAllServerHealth(): Map<string, boolean> {
        return new Map(this.healthStatus);
    }

    // ===== MCPClientLike Interface Methods =====

    /**
     * Call a tool (MCPClientLike interface)
     */
    async callTool(
        name: string,
        args: Record<string, any>
    ): Promise<MCPToolResponse> {
        // Use the first available server for MCPClientLike calls
        const firstServerId = Array.from(this.clients.keys())[0];
        if (!firstServerId) {
            throw new Error("No MCP servers configured");
        }

        return this.executeTool(firstServerId, name, args);
    }

    // ===== Legacy MCPDriver API Compatibility =====

    /**
     * Execute a tool on the specified MCP server (legacy API)
     */
    async executeTool(
        serverId: string,
        toolName: string,
        params: any
    ): Promise<any> {
        const startTime = Date.now();
        const requestKey = `${serverId}:${toolName}:${startTime}`;

        try {
            // Check if there's an ongoing request for this server
            const ongoingRequest = this.requestMutex.get(serverId);
            if (ongoingRequest) {
                Logger.mcpVerbose(
                    `MCPClientDriver: Waiting for ongoing request to complete for ${serverId}`
                );
                await ongoingRequest;
            }

            const client = this.getClient(serverId);

            const request = {
                method: "tools/call" as const,
                params: {
                    name: toolName,
                    arguments: params || {},
                },
            };

            // Store the promise to prevent concurrent requests
            const requestPromise = client.request(
                request,
                CallToolResultSchema
            );
            this.requestMutex.set(serverId, requestPromise);

            const result = await requestPromise;

            // Clear the mutex after completion
            this.requestMutex.delete(serverId);

            // Convert MCP result to legacy format
            const mcpResponse: MCPToolResponse = {
                success: true,
                result: result.content,
                executionTime: Date.now() - startTime,
            };

            Logger.mcpVerbose(
                `MCPClientDriver: Tool ${toolName} executed successfully`,
                { serverId, executionTime: mcpResponse.executionTime }
            );

            return mcpResponse.result;
        } catch (error) {
            // Clear the mutex on error
            this.requestMutex.delete(serverId);

            // Check if it's a sync error
            if (
                error instanceof Error &&
                error.message.includes("unknown message ID")
            ) {
                Logger.mcpWarn(
                    `MCPClientDriver: Sync error detected during tool execution for ${serverId}`
                );

                // Emit sync error event for auto-handling
                this.emit("mcp-sync-error", {
                    type: "sync-error",
                    serverId,
                    error: error.message,
                    timestamp: Date.now(),
                    context: { toolName, requestKey },
                });
            }

            Logger.mcpError(`MCPClientDriver: Tool execution failed:`, {
                serverId,
                toolName,
                error,
            });
            throw error;
        }
    }

    /**
     * Get a resource from the specified MCP server (legacy API)
     */
    async getResource(
        serverId: string,
        resourceId: string,
        params?: any
    ): Promise<MCPResource | null> {
        try {
            const client = this.getClient(serverId);
            const request = {
                method: "resources/read" as const,
                params: {
                    uri: resourceId,
                    ...params,
                },
            };

            const result = await client.request(
                request,
                ReadResourceResultSchema
            );
            const resource: MCPResource | null =
                Array.isArray(result.contents) && result.contents.length > 0
                    ? (result.contents[0] as unknown as MCPResource)
                    : null;
            if (resource) {
                resource.value = JSON.parse(resource.text);
            }

            return resource as MCPResource;
        } catch (error: any) {
            Logger.mcpError(`MCPClientDriver: Resource retrieval failed:`, {
                serverId,
                resourceId,
                error: error.message || error,
            });
            throw error;
        }
    }

    /**
     * Get a prompt from the specified MCP server (legacy API)
     */
    async getPromptById(
        serverId: string,
        promptId: string,
        variables?: Record<string, any>
    ): Promise<string> {
        try {
            const client = this.getClient(serverId);

            const request = {
                method: "prompts/get" as const,
                params: {
                    name: promptId,
                    arguments: variables || {},
                },
            };

            const result = await client.request(request, GetPromptResultSchema);

            // Convert messages to string
            return result.messages
                .map((msg) =>
                    "content" in msg ? msg.content.text : JSON.stringify(msg)
                )
                .join("\n");
        } catch (error) {
            Logger.mcpError(`MCPClientDriver: Prompt retrieval failed:`, {
                serverId,
                promptId,
                error,
            });
            throw error;
        }
    }

    /**
     * Perform health check on a specific server
     */
    async healthCheck(serverId: string): Promise<boolean> {
        try {
            const client = this.getClient(serverId);

            // Try listing tools as a health check
            const request = {
                method: "tools/list" as const,
                params: {},
            };

            await client.request(request, ListToolsResultSchema);
            this.healthStatus.set(serverId, true);
            return true;
        } catch (error) {
            Logger.mcpError(
                `MCPClientDriver: Health check failed for ${serverId}:`,
                { error }
            );
            this.healthStatus.set(serverId, false);
            return false;
        }
    }

    /**
     * Perform health check on all servers
     */
    async healthCheckAll(): Promise<Map<string, boolean>> {
        const healthPromises = Array.from(this.configs.keys()).map(
            async (serverId) => {
                const healthy = await this.healthCheck(serverId);
                return [serverId, healthy] as [string, boolean];
            }
        );

        const results = await Promise.all(healthPromises);
        return new Map(results);
    }

    /**
     * Get health status of all servers
     */
    getHealthStatus(): Map<string, boolean> {
        return new Map(this.healthStatus);
    }

    // ===== Private Helper Methods =====

    private validateServerConfig(config: MCPServerTransportConfig): void {
        if (!config.id) throw new Error("Server ID is required");
        if (!config.name) throw new Error("Server name is required");
        if (!config.url) throw new Error("Server URL is required");
        if (this.configs.has(config.id)) {
            throw new Error(`Server with ID '${config.id}' already exists`);
        }
    }

    private getClient(serverId: string): Client {
        const client = this.clients.get(serverId);
        if (!client) {
            throw new Error(
                `Client for with ID '${serverId}' not found or not connected`
            );
        }
        return client;
    }

    /**
     * Close all connections
     */
    async close(): Promise<void> {
        const closePromises = Array.from(this.transports.values()).map(
            (transport) =>
                transport
                    .close()
                    .catch((error) =>
                        Logger.mcpError(
                            "MCPClientDriver: Error closing transport:",
                            error
                        )
                    )
        );

        await Promise.all(closePromises);

        this.clients.clear();
        this.transports.clear();
        this.configs.clear();
        this.healthStatus.clear();

        logger.info("MCPClientDriver: All connections closed");
    }

    // ===== Runtime Compatibility Methods =====

    /**
     * Load state graph from MCP server
     */
    async loadStateGraph(
        serverId: string,
        graphId: string
    ): Promise<MCPResource | null> {
        try {
            return (await this.getResource(serverId, `stategraph:${graphId}`))?.value;
        } catch (error) {
            Logger.mcpError(
                `MCPClientDriver: Error loading state graph ${graphId}:`,
                { error }
            );
            throw error;
        }
    }

    /**
     * Save state to MCP server
     */
    async saveState(serverId: string, state: any): Promise<void> {
        try {
            await this.executeTool(serverId, "save_state", { state });
        } catch (error) {
            Logger.mcpError("MCPClientDriver: Error saving state:", { error });
            throw error;
        }
    }

    /**
     * Load state from MCP server
     */
    async loadState(
        serverId: string,
        graphId: string,
        userId: string
    ): Promise<any> {
        try {
			return (await this.getResource(serverId, "xplus1://state/current"))?.value;
        } catch (error) {
            Logger.mcpError(
                `MCPClientDriver: Error loading state for ${graphId}:${userId}:`,
                { error }
            );
            throw error;
        }
    }

    /**
     * Get prompt from MCP server
     */
    async getPrompt(
        serverId: string,
        promptId: string,
        variables?: Record<string, any>
    ): Promise<string> {
        try {
            const client = this.getClient(serverId);
            const request = {
                method: "prompts/get" as const,
                params: {
                    name: promptId,
                    arguments: variables || {},
                },
            };

            const result = await client.request(request, GetPromptResultSchema);

            // Combine all message parts into a single string
            return result.messages
                .map((msg) =>
                    typeof msg.content === "string"
                        ? msg.content
                        : Array.isArray(msg.content)
                        ? msg.content.map((c) => c.text || "").join("")
                        : ""
                )
                .join("\n");
        } catch (error: any) {
            Logger.mcpError(
                `MCPClientDriver: Error getting prompt ${promptId} at ${serverId}:`,
                { error: error.message || error }
            );
            throw error;
        }
    }

    /**
     * Emit structured MCP event
     */
    private emitMCPEvent(event: MCPEvent): void {
        // Emit specific event
        this.emit(`${event.type}:${event.action}`, event);

        // Emit general event
        this.emit("mcp:event", event);

        // Log event
        Logger.mcpVerbose(`MCP Event: ${event.type}:${event.action}`, {
            serverId: event.serverId,
            data: event.data,
        });
    }

    /**
     * List available tools from a server
     */
    async listTools(serverId: string): Promise<any[]> {
        const client = this.getClient(serverId);

        try {
            const response = await client.request(
                {
                    method: "tools/list" as const,
                    params: {},
                },
                ListToolsResultSchema
            );

            this.emitMCPEvent({
                type: "tool",
                action: "listed",
                serverId,
                data: response.tools,
                timestamp: Date.now(),
            });

            return response.tools;
        } catch (error) {
            this.emitMCPEvent({
                type: "error",
                action: "list_tools_failed",
                serverId,
                data: error,
                timestamp: Date.now(),
            });
            throw error;
        }
    }

    /**
     * Subscribe to server events
     */
    subscribeToServerEvents(serverId: string): void {
        // Note: MCP Client from @modelcontextprotocol/sdk doesn't expose direct event listeners
        // We'll simulate events by periodically checking health and emitting our own events
        Logger.mcpVerbose(
            `Setting up event monitoring for server: ${serverId}`
        );

        // Start health monitoring
        this.startHealthMonitoring(serverId);
    }

    /**
     * Start health monitoring for a server
     */
    private startHealthMonitoring(serverId: string): void {
        const interval = setInterval(async () => {
            try {
                // Try to ping the server by listing tools
                await this.listTools(serverId);

                const wasHealthy = this.healthStatus.get(serverId);
                if (!wasHealthy) {
                    this.healthStatus.set(serverId, true);
                    this.emitMCPEvent({
                        type: "health",
                        action: "connected",
                        serverId,
                        data: { status: "connected" },
                        timestamp: Date.now(),
                    });
                }
            } catch (error) {
                const wasHealthy = this.healthStatus.get(serverId);
                if (wasHealthy !== false) {
                    this.healthStatus.set(serverId, false);
                    this.emitMCPEvent({
                        type: "health",
                        action: "disconnected",
                        serverId,
                        data: { status: "disconnected", error },
                        timestamp: Date.now(),
                    });
                }
            }
        }, 5000); // Check every 5 seconds

        // Store interval for cleanup
        this.healthIntervals = this.healthIntervals || new Map();
        this.healthIntervals.set(serverId, interval);
    }

    /**
     * Cleanup resources
     */
    cleanup(): void {
        // Stop all health monitoring
        if (this.healthIntervals) {
            for (const interval of this.healthIntervals.values()) {
                clearInterval(interval);
            }
            this.healthIntervals.clear();
        }

        // Close all connections
        for (const [serverId, client] of this.clients) {
            try {
                client.close();
            } catch (error) {
                Logger.mcpError(
                    `Error closing client for ${serverId}:`,
                    error as Error
                );
            }
        }

        this.clients.clear();
        this.transports.clear();
        this.configs.clear();
        this.healthStatus.clear();
    }
}
