/**
 * Plugin System Manager for MCP Servers
 * Provides generic plugin system management for any MCP server
 */

import { PluginInterface, ToolDefinition } from './PluginInterface.js';

/**
 * Plugin System Manager
 * Manages plugin registration, lifecycle, and tool registration
 */
export class PluginSystemManager {
  private plugins: Map<string, PluginInterface> = new Map();
  private server: any; // McpServer type (avoiding circular dependency)

  constructor(server: any) {
    this.server = server;
  }

  /**
   * Register a plugin
   */
  registerPlugin(plugin: PluginInterface): void {
    this.plugins.set(plugin.getName(), plugin);
    
    // Initialize plugin
    plugin.initialize();
    
    // Register plugin tools
    const tools = plugin.getTools();
    tools.forEach((tool: ToolDefinition) => {
      this.server.tool(
        tool.name,
        tool.description,
        tool.inputSchema,
        tool.handler
      );
    });

    console.log(`[PluginSystem] Plugin '${plugin.getName()}' registered successfully`);
  }

  /**
   * Unregister a plugin
   */
  unregisterPlugin(pluginName: string): void {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      plugin.cleanup();
      this.plugins.delete(pluginName);
      console.log(`[PluginSystem] Plugin '${pluginName}' unregistered successfully`);
    }
  }

  /**
   * Get a registered plugin
   */
  getPlugin(pluginName: string): PluginInterface | undefined {
    return this.plugins.get(pluginName);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): PluginInterface[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Check if a plugin is registered
   */
  hasPlugin(pluginName: string): boolean {
    return this.plugins.has(pluginName);
  }

  /**
   * Get plugin status
   */
  getPluginStatus(): Array<{name: string, status: string, description: string}> {
    return Array.from(this.plugins.values()).map(plugin => ({
      name: plugin.getName(),
      status: 'active',
      description: plugin.getDescription()
    }));
  }

  /**
   * Cleanup all plugins
   */
  cleanup(): void {
    this.plugins.forEach(plugin => {
      try {
        plugin.cleanup();
      } catch (error) {
        console.error(`Error cleaning up plugin '${plugin.getName()}':`, error);
      }
    });
    this.plugins.clear();
    console.log('[PluginSystem] All plugins cleaned up');
  }
}
