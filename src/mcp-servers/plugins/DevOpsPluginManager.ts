/**
 * DevOps Plugin Manager
 * Manages loading, initialization, and lifecycle of DevOps plugins
 */

import {
    IDevOpsPlugin,
    PluginConfig,
    PluginContext,
    PluginResult,
} from "./IDevOpsPlugin.js";
import { Logger } from "../../utils/logger.js";

/**
 * Plugin registry entry
 */
interface PluginRegistryEntry {
    plugin: IDevOpsPlugin;
    config: PluginConfig;
    context: PluginContext;
    loadedAt: number;
    active: boolean;
}

/**
 * Plugin loading options
 */
interface PluginLoadOptions {
    /** Override default enabled status */
    forceEnable?: boolean;
    /** Custom settings to merge with plugin config */
    customSettings?: Record<string, any>;
    /** Skip initialization */
    skipInitialization?: boolean;
}

/**
 * Plugin Manager for DevOps server
 * Handles plugin lifecycle and coordination
 */
export class DevOpsPluginManager {
    private registry = new Map<string, PluginRegistryEntry>();
    private baseContext: Omit<PluginContext, "config">;

    constructor(baseContext: Omit<PluginContext, "config">) {
        this.baseContext = baseContext;
    }

    /**
     * Register a plugin with the manager
     */
    async registerPlugin(
        plugin: IDevOpsPlugin,
        options: PluginLoadOptions = {}
    ): Promise<void> {
        const config = plugin.config;

        if (this.registry.has(config.id)) {
            Logger.mcpWarn(`Plugin ${config.id} already registered, skipping`);
            return;
        }

        // Create plugin-specific context
        const pluginContext: PluginContext = {
            ...this.baseContext,
            config: {
                ...config,
                enabled: options.forceEnable ?? config.enabled,
                settings: {
                    ...config.settings,
                    ...options.customSettings,
                },
            },
        };

        // Register the plugin
        const entry: PluginRegistryEntry = {
            plugin,
            config: pluginContext.config,
            context: pluginContext,
            loadedAt: Date.now(),
            active: false,
        };

        this.registry.set(config.id, entry);

        Logger.mcpInfo(`Plugin ${config.name} (${config.id}) registered`);

        // Initialize if enabled and not skipped
        if (entry.config.enabled && !options.skipInitialization) {
            await this.initializePlugin(config.id);
        }
    }

    /**
     * Initialize a specific plugin
     */
    async initializePlugin(pluginId: string): Promise<void> {
        const entry = this.registry.get(pluginId);
        if (!entry) {
            throw new Error(`Plugin ${pluginId} not found in registry`);
        }

        if (entry.active) {
            Logger.mcpWarn(`Plugin ${pluginId} already initialized`);
            return;
        }

        try {
            // Initialize the plugin
            await entry.plugin.initialize(entry.context);

            // Setup MCP handlers
            await entry.plugin.setupMCPHandlers(entry.context);

            entry.active = true;
            Logger.mcpInfo(
                `Plugin ${entry.config.name} initialized successfully`
            );
        } catch (error) {
            Logger.mcpError(`Failed to initialize plugin ${pluginId}`, {
                error,
            });
            throw error;
        }
    }

    /**
     * Unload a specific plugin
     */
    async unloadPlugin(pluginId: string): Promise<void> {
        const entry = this.registry.get(pluginId);
        if (!entry) {
            Logger.mcpWarn(`Plugin ${pluginId} not found for unloading`);
            return;
        }

        try {
            if (entry.active) {
                await entry.plugin.cleanup();
                entry.active = false;
            }

            this.registry.delete(pluginId);
            Logger.mcpInfo(`Plugin ${pluginId} unloaded successfully`);
        } catch (error) {
            Logger.mcpError(`Error unloading plugin ${pluginId}`, { error });
            throw error;
        }
    }

    /**
     * Initialize all registered plugins
     */
    async initializeAllPlugins(): Promise<void> {
        const initPromises = Array.from(this.registry.entries())
            .filter(([, entry]) => entry.config.enabled && !entry.active)
            .map(([pluginId]) => this.initializePlugin(pluginId));

        const results = await Promise.allSettled(initPromises);

        // Log any failures
        results.forEach((result, index) => {
            if (result.status === "rejected") {
                const pluginId = Array.from(this.registry.keys())[index];
                Logger.mcpError(`Failed to initialize plugin ${pluginId}`, {
                    error: result.reason,
                });
            }
        });
    }

    /**
     * Cleanup all plugins
     */
    async cleanupAllPlugins(): Promise<void> {
        const cleanupPromises = Array.from(this.registry.values())
            .filter((entry) => entry.active)
            .map((entry) => entry.plugin.cleanup());

        await Promise.allSettled(cleanupPromises);

        // Mark all as inactive
        for (const entry of this.registry.values()) {
            entry.active = false;
        }

        Logger.mcpInfo("All plugins cleaned up");
    }

    /**
     * Execute a command on a specific plugin
     */
    async executePluginCommand(
        pluginId: string,
        command: string,
        params: any = {}
    ): Promise<PluginResult> {
        const entry = this.registry.get(pluginId);
        if (!entry) {
            return {
                success: false,
                message: `Plugin ${pluginId} not found`,
                error: new Error(`Plugin not registered: ${pluginId}`),
            };
        }

        if (!entry.active) {
            return {
                success: false,
                message: `Plugin ${pluginId} not active`,
                error: new Error(`Plugin not initialized: ${pluginId}`),
            };
        }

        try {
            return await entry.plugin.execute(command, params);
        } catch (error) {
            Logger.mcpError(`Plugin ${pluginId} command ${command} failed`, {
                error,
            });
            return {
                success: false,
                message: `Plugin command failed: ${error}`,
                error:
                    error instanceof Error ? error : new Error(String(error)),
            };
        }
    }

    /**
     * Get status of all plugins
     */
    async getAllPluginStatus(): Promise<Record<string, any>> {
        const status: Record<string, any> = {};

        for (const [pluginId, entry] of this.registry.entries()) {
            try {
                if (entry.active) {
                    status[pluginId] = await entry.plugin.getStatus();
                } else {
                    status[pluginId] = {
                        healthy: false,
                        status: "inactive",
                        registered: true,
                        enabled: entry.config.enabled,
                    };
                }
            } catch (error) {
                status[pluginId] = {
                    healthy: false,
                    status: "error",
                    error:
                        error instanceof Error ? error.message : String(error),
                };
            }
        }

        return status;
    }

    /**
     * Get list of registered plugins
     */
    getRegisteredPlugins(): Array<{
        id: string;
        name: string;
        category: string;
        version: string;
        enabled: boolean;
        active: boolean;
        loadedAt: number;
    }> {
        return Array.from(this.registry.entries()).map(([id, entry]) => ({
            id,
            name: entry.config.name,
            category: entry.config.category,
            version: entry.config.version,
            enabled: entry.config.enabled,
            active: entry.active,
            loadedAt: entry.loadedAt,
        }));
    }

    /**
     * Enable/disable a plugin
     */
    async setPluginEnabled(pluginId: string, enabled: boolean): Promise<void> {
        const entry = this.registry.get(pluginId);
        if (!entry) {
            throw new Error(`Plugin ${pluginId} not found`);
        }

        entry.config.enabled = enabled;

        if (enabled && !entry.active) {
            await this.initializePlugin(pluginId);
        } else if (!enabled && entry.active) {
            await entry.plugin.cleanup();
            entry.active = false;
        }

        Logger.mcpInfo(
            `Plugin ${pluginId} ${enabled ? "enabled" : "disabled"}`
        );
    }

    /**
     * Get a specific plugin by ID
     */
    getPlugin(pluginId: string): IDevOpsPlugin | undefined {
        return this.registry.get(pluginId)?.plugin;
    }

    /**
     * Check if a plugin is registered and active
     */
    isPluginActive(pluginId: string): boolean {
        const entry = this.registry.get(pluginId);
        return entry?.active ?? false;
    }

    /**
     * Get plugin metadata
     */
    getPluginMetadata(pluginId: string): any {
        const entry = this.registry.get(pluginId);
        if (!entry) return null;

        return {
            id: entry.config.id,
            name: entry.config.name,
            description: entry.config.description,
            version: entry.config.version,
            category: entry.config.category,
            enabled: entry.config.enabled,
            active: entry.active,
            metadata: entry.plugin.metadata,
            loadedAt: entry.loadedAt,
        };
    }
}
