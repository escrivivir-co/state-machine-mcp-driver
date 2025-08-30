/**
 * DevOps Plugin Interface
 * Base interface for creating modular DevOps server plugins
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MCPDriverAdapter } from "../../drivers/MCPDriverAdapter.js";
import { z } from "zod";

/**
 * Plugin configuration interface
 */
export interface PluginConfig {
    /** Plugin identifier */
    id: string;
    /** Plugin display name */
    name: string;
    /** Plugin description */
    description: string;
    /** Plugin version */
    version: string;
    /** Plugin category */
    category: string;
    /** Enabled by default */
    enabled: boolean;
    /** Plugin-specific configuration */
    settings?: Record<string, any>;
}

/**
 * Plugin metadata interface
 */
export interface PluginMetadata {
    /** Tools provided by this plugin */
    tools: Array<{
        name: string;
        description: string;
        schema: z.ZodSchema;
    }>;
    /** Resources provided by this plugin */
    resources: Array<{
        id: string;
        name: string;
        description: string;
        mimeType: string;
    }>;
    /** Prompts provided by this plugin */
    prompts: Array<{
        id: string;
        name: string;
        description: string;
        parameters?: Record<string, z.ZodSchema>;
    }>;
}

/**
 * Plugin context interface
 * Provides access to DevOpsServer resources
 */
export interface PluginContext {
    /** MCP server instance */
    server: McpServer;
    /** MCP adapter for connecting to other servers */
    mcpAdapter?: MCPDriverAdapter;
    /** Plugin configuration */
    config: PluginConfig;
    /** Logger function */
    log: (
        level: "info" | "warn" | "error" | "debug",
        message: string,
        data?: any
    ) => void;
}

/**
 * Plugin execution result
 */
export interface PluginResult {
    success: boolean;
    message?: string;
    data?: any;
    error?: Error;
}

/**
 * Base interface for DevOps plugins
 */
export interface IDevOpsPlugin {
    /** Plugin configuration */
    readonly config: PluginConfig;

    /** Plugin metadata */
    readonly metadata: PluginMetadata;

    /**
     * Initialize the plugin
     * Called when the plugin is first loaded
     */
    initialize(context: PluginContext): Promise<void>;

    /**
     * Setup plugin-specific tools, resources, and prompts
     * Called after initialization
     */
    setupMCPHandlers(context: PluginContext): Promise<void>;

    /**
     * Cleanup plugin resources
     * Called when the plugin is unloaded or server shuts down
     */
    cleanup(): Promise<void>;

    /**
     * Get plugin status and health information
     */
    getStatus(): Promise<{
        healthy: boolean;
        status: string;
        lastActivity?: number;
        statistics?: Record<string, any>;
    }>;

    /**
     * Execute a plugin-specific command
     * Used for internal plugin operations
     */
    execute(command: string, params: any): Promise<PluginResult>;
}

/**
 * Abstract base class for DevOps plugins
 * Provides common functionality and structure
 */
export abstract class BaseDevOpsPlugin implements IDevOpsPlugin {
    public readonly config: PluginConfig;
    public readonly metadata: PluginMetadata;
    protected context?: PluginContext;
    protected isInitialized = false;
    protected lastActivity = 0;

    constructor(config: PluginConfig, metadata: PluginMetadata) {
        this.config = config;
        this.metadata = metadata;
    }

    /**
     * Default initialization
     */
    async initialize(context: PluginContext): Promise<void> {
        this.context = context;
        this.isInitialized = true;
        this.lastActivity = Date.now();

        this.log("info", `Plugin ${this.config.name} initialized`);
    }

    /**
     * Abstract method - must be implemented by subclasses
     */
    abstract setupMCPHandlers(context: PluginContext): Promise<void>;

    /**
     * Default cleanup
     */
    async cleanup(): Promise<void> {
        this.isInitialized = false;
        this.log("info", `Plugin ${this.config.name} cleaned up`);
    }

    /**
     * Default status implementation
     */
    async getStatus(): Promise<{
        healthy: boolean;
        status: string;
        lastActivity?: number;
        statistics?: Record<string, any>;
    }> {
        return {
            healthy: this.isInitialized,
            status: this.isInitialized ? "active" : "inactive",
            lastActivity: this.lastActivity,
            statistics: this.getStatistics(),
        };
    }

    /**
     * Default execution - override in subclasses for specific commands
     */
    async execute(command: string, params: any): Promise<PluginResult> {
        this.lastActivity = Date.now();

        switch (command) {
            case "ping":
                return {
                    success: true,
                    message: `Plugin ${this.config.name} is responsive`,
                    data: { timestamp: Date.now() },
                };

            case "status":
                const status = await this.getStatus();
                return {
                    success: true,
                    data: status,
                };

            default:
                return {
                    success: false,
                    message: `Unknown command: ${command}`,
                    error: new Error(`Command '${command}' not implemented`),
                };
        }
    }

    /**
     * Helper method for logging
     */
    protected log(
        level: "info" | "warn" | "error" | "debug",
        message: string,
        data?: any
    ): void {
        if (this.context) {
            this.context.log(level, `[${this.config.name}] ${message}`, data);
        }
    }

    /**
     * Helper method for updating activity timestamp
     */
    protected updateActivity(): void {
        this.lastActivity = Date.now();
    }

    /**
     * Get plugin-specific statistics - override in subclasses
     */
    protected getStatistics(): Record<string, any> {
        return {
            initialized: this.isInitialized,
            lastActivity: this.lastActivity,
            uptime: this.isInitialized ? Date.now() - this.lastActivity : 0,
        };
    }

    /**
     * Helper method to ensure context is available
     */
    protected requireContext(): PluginContext {
        if (!this.context) {
            throw new Error(
                `Plugin ${this.config.name} not initialized - context not available`
            );
        }
        return this.context;
    }

    /**
     * Helper method to ensure MCP adapter is available
     */
    protected requireMCPAdapter(): MCPDriverAdapter {
        const context = this.requireContext();
        if (!context.mcpAdapter) {
            throw new Error(
                `Plugin ${this.config.name} requires MCP adapter but none is available`
            );
        }
        return context.mcpAdapter;
    }
}
