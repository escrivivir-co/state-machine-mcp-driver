/**
 * Generic Plugin Interface for MCP Servers
 * Base interface for creating modular plugins
 */

import { z } from 'zod';

/**
 * Tool definition interface
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  handler: (args: any) => Promise<any>;
}

/**
 * Plugin configuration interface
 */
export interface PluginConfig {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  settings?: Record<string, any>;
}

/**
 * Base interface for plugins
 */
export interface PluginInterface {
  /**
   * Get plugin name
   */
  getName(): string;

  /**
   * Get plugin description
   */
  getDescription(): string;

  /**
   * Get plugin configuration
   */
  getConfig(): PluginConfig;

  /**
   * Initialize the plugin
   */
  initialize(): void;

  /**
   * Get tools provided by this plugin
   */
  getTools(): ToolDefinition[];

  /**
   * Plugin cleanup when unregistering
   */
  cleanup(): void;
}
