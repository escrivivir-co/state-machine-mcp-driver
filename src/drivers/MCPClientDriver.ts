/**
 * MCP Client Driver - Native MCP Protocol Implementation
 * Uses @modelcontextprotocol/sdk for native MCP communication
 * Implements IMCPDriver interface      Logger.mcpVerbose(`MCPClientDriver: Tool ${toolName} executed successfully`, { serverId, executionTime: mcpResponse.executionTime });
      
      return mcpResponse.content;
    } catch (error) {
      Logger.mcpError(`MCPClientDriver: Tool execution failed:`, { serverId, toolName, error });compatibility with Runtime
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { 
  ListToolsResultSchema, 
  CallToolResultSchema,
  ListResourcesResultSchema,
  ReadResourceResultSchema,
  ListPromptsResultSchema,
  GetPromptResultSchema
} from '@modelcontextprotocol/sdk/types.js';
import { IMCPDriver, MCPServerConfig } from './IMCPDriver';
import { MCPToolResponse } from './MCPTypes';
import { logger, Logger } from '../utils/logger';

/**
 * Native MCP Client Driver using official SDK
 * Implements IMCPDriver interface for Runtime compatibility
 */
export class MCPClientDriver implements IMCPDriver {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, StreamableHTTPClientTransport> = new Map();
  private configs: Map<string, MCPServerConfig> = new Map();
  private healthStatus: Map<string, boolean> = new Map();

  constructor() {
    Logger.mcpVerbose('MCPClientDriver: Initializing native MCP client driver');
  }

  /**
   * Add a new MCP server configuration
   */
  async addServer(config: MCPServerConfig): Promise<void> {
    try {
      // Validate configuration
      this.validateServerConfig(config);
      
      // Store configuration
      this.configs.set(config.id, config);
      
      // Create MCP client
      const client = new Client({
        name: 'mcp-driver-client',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      // Set up error handler
      client.onerror = (error) => {
        Logger.mcpError(`MCPClientDriver: Client error for ${config.id}:`, { error });
      };

      // Create transport
      const baseUrl = new URL(`${config.url}/mcp`);
      const transport = new StreamableHTTPClientTransport(baseUrl);

      // Connect to server
      await client.connect(transport);
      
      // Store client and transport
      this.clients.set(config.id, client);
      this.transports.set(config.id, transport);
      this.healthStatus.set(config.id, true);
      
      Logger.mcpInfo(`MCPClientDriver: Successfully connected to ${config.name} at ${config.url}`);
      
    } catch (error) {
      Logger.mcpError(`MCPClientDriver: Failed to add server ${config.id}:`, { error });
      this.healthStatus.set(config.id, false);
      throw error;
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
      
      if (removed) {
        Logger.mcpVerbose(`MCPClientDriver: Removed server ${serverId}`);
      }
      
      return removed;
    } catch (error) {
      Logger.mcpError(`MCPClientDriver: Error removing server ${serverId}:`, { error });
      return false;
    }
  }

  /**
   * Get a list of all configured servers
   */
  getServers(): MCPServerConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Get server by ID
   */
  getServer(serverId: string): MCPServerConfig | undefined {
    return this.configs.get(serverId);
  }

  // ===== MCPClientLike Interface Methods =====

  /**
   * Call a tool (MCPClientLike interface)
   */
  async callTool(name: string, args: Record<string, any>): Promise<MCPToolResponse> {
    // Use the first available server for MCPClientLike calls
    const firstServerId = Array.from(this.clients.keys())[0];
    if (!firstServerId) {
      throw new Error('No MCP servers configured');
    }
    
    return this.executeTool(firstServerId, name, args);
  }

  // ===== Legacy MCPDriver API Compatibility =====

  /**
   * Execute a tool on the specified MCP server (legacy API)
   */
  async executeTool(serverId: string, toolName: string, params: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      const client = this.getClient(serverId);
      
      const request = {
        method: 'tools/call' as const,
        params: {
          name: toolName,
          arguments: params || {}
        }
      };
      
      const result = await client.request(request, CallToolResultSchema);
      
      // Convert MCP result to legacy format
      const mcpResponse: MCPToolResponse = {
        success: true,
        result: result.content,
        executionTime: Date.now() - startTime
      };

      logger.debug(`MCPClientDriver: Tool ${toolName} executed successfully`, { serverId, executionTime: mcpResponse.executionTime });
      
      return mcpResponse.result;
    } catch (error) {
      Logger.mcpError(`MCPClientDriver: Tool execution failed:`, { serverId, toolName, error });
      throw error;
    }
  }

  /**
   * Get a resource from the specified MCP server (legacy API)
   */
  async getResource(serverId: string, resourceId: string, params?: any): Promise<any> {
    try {
      const client = this.getClient(serverId);
      
      const request = {
        method: 'resources/read' as const,
        params: {
          uri: resourceId,
          ...params
        }
      };
      
      const result = await client.request(request, ReadResourceResultSchema);
      return result.contents;
    } catch (error) {
      Logger.mcpError(`MCPClientDriver: Resource retrieval failed:`, { serverId, resourceId, error });
      throw error;
    }
  }

  /**
   * Get a prompt from the specified MCP server (legacy API)
   */
  async getPromptById(serverId: string, promptId: string, variables?: Record<string, any>): Promise<string> {
    try {
      const client = this.getClient(serverId);
      
      const request = {
        method: 'prompts/get' as const,
        params: {
          name: promptId,
          arguments: variables || {}
        }
      };
      
      const result = await client.request(request, GetPromptResultSchema);
      
      // Convert messages to string
      return result.messages.map(msg => 
        'content' in msg ? msg.content.text : JSON.stringify(msg)
      ).join('\n');
    } catch (error) {
      Logger.mcpError(`MCPClientDriver: Prompt retrieval failed:`, { serverId, promptId, error });
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
        method: 'tools/list' as const,
        params: {}
      };
      
      await client.request(request, ListToolsResultSchema);
      this.healthStatus.set(serverId, true);
      return true;
    } catch (error) {
      Logger.mcpError(`MCPClientDriver: Health check failed for ${serverId}:`, error);
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

  private validateServerConfig(config: MCPServerConfig): void {
    if (!config.id) throw new Error('Server ID is required');
    if (!config.name) throw new Error('Server name is required');
    if (!config.url) throw new Error('Server URL is required');
    if (this.configs.has(config.id)) {
      throw new Error(`Server with ID '${config.id}' already exists`);
    }
  }

  private getClient(serverId: string): Client {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server with ID '${serverId}' not found or not connected`);
    }
    return client;
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    const closePromises = Array.from(this.transports.values()).map(
      transport => transport.close().catch(error => 
        Logger.mcpError('MCPClientDriver: Error closing transport:', error)
      )
    );
    
    await Promise.all(closePromises);
    
    this.clients.clear();
    this.transports.clear();
    this.configs.clear();
    this.healthStatus.clear();
    
    logger.info('MCPClientDriver: All connections closed');
  }

  // ===== Runtime Compatibility Methods =====

  /**
   * Load state graph from MCP server
   */
  async loadStateGraph(serverId: string, graphId: string): Promise<any> {
    try {
      return await this.getResource(serverId, `stategraph:${graphId}`);
    } catch (error) {
      Logger.mcpError(`MCPClientDriver: Error loading state graph ${graphId}:`, error);
      throw error;
    }
  }

  /**
   * Save state to MCP server
   */
  async saveState(serverId: string, state: any): Promise<void> {
    try {
      await this.executeTool(serverId, 'save_state', { state });
    } catch (error) {
      Logger.mcpError('MCPClientDriver: Error saving state:', error);
      throw error;
    }
  }

  /**
   * Load state from MCP server
   */
  async loadState(serverId: string, graphId: string, userId: string): Promise<any> {
    try {
      return await this.getResource(serverId, `state:${graphId}:${userId}`);
    } catch (error) {
      Logger.mcpError(`MCPClientDriver: Error loading state for ${graphId}:${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get prompt from MCP server
   */
  async getPrompt(serverId: string, promptId: string, variables?: Record<string, any>): Promise<string> {
    try {
      const client = this.getClient(serverId);
      const request = {
        method: 'prompts/get' as const,
        params: {
          name: promptId,
          arguments: variables || {}
        }
      };
      
      const result = await client.request(request, GetPromptResultSchema);
      
      // Combine all message parts into a single string
      return result.messages.map(msg => 
        typeof msg.content === 'string' ? msg.content : 
        Array.isArray(msg.content) ? msg.content.map(c => c.text || '').join('') : ''
      ).join('\n');
    } catch (error) {
      Logger.mcpError(`MCPClientDriver: Error getting prompt ${promptId}:`, error);
      throw error;
    }
  }
}
