/**
 * State Machine MCP Driver - MCP Driver Implementation
 * Handles communication with MCP servers for tools, resources, and prompts
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { EventEmitter } from 'events';
import {
  MCPServerConfig,
  MCPServerCapabilities,
  MCPToolRequest,
  MCPToolResponse,
  MCPResourceRequest,
  MCPResourceResponse,
  MCPPromptRequest,
  MCPPromptResponse,
  MCPHealthResponse,
  MCPStats,
  MCPEvent,
  MCPEventType,
  MCPError,
  MCPErrorType,
  MCP_DEFAULTS
} from './MCPTypes';
import { State, StateGraph } from '../models';

/**
 * Main driver class for MCP server communication
 */
export class MCPDriver extends EventEmitter {
  private servers: Map<string, MCPServerConfig> = new Map();
  private clients: Map<string, AxiosInstance> = new Map();
  private healthStatus: Map<string, boolean> = new Map();
  private stats: MCPStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    activeConnections: 0,
    requestsByServer: {}
  };

  constructor() {
    super();
    this.setupGlobalErrorHandling();
  }

  /**
   * Add a new MCP server configuration
   */
  addServer(config: MCPServerConfig): void {
    // Validate configuration
    this.validateServerConfig(config);

    // Store configuration
    this.servers.set(config.id, config);

    // Create HTTP client
    const client = this.createHttpClient(config);
    this.clients.set(config.id, client);

    // Initialize health status
    this.healthStatus.set(config.id, false);

    // Initialize stats for this server
    this.stats.requestsByServer[config.id] = 0;

    // Emit event
    this.emitEvent(MCPEventType.SERVER_CONNECTED, config.id, {
      name: config.name,
      url: config.url
    });
  }

  /**
   * Remove a server configuration
   */
  removeServer(serverId: string): boolean {
    const removed = this.servers.delete(serverId);
    this.clients.delete(serverId);
    this.healthStatus.delete(serverId);
    delete this.stats.requestsByServer[serverId];

    if (removed) {
      this.emitEvent(MCPEventType.SERVER_DISCONNECTED, serverId);
    }

    return removed;
  }

  /**
   * Get a list of all configured servers
   */
  getServers(): MCPServerConfig[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get server by ID
   */
  getServer(serverId: string): MCPServerConfig | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Execute a tool on the specified MCP server
   */
  async executeTool(serverId: string, toolName: string, params: any): Promise<any> {
    const startTime = Date.now();

    try {
      const client = this.getClient(serverId);
      const request: MCPToolRequest = { toolName, params };
      
      const response = await this.makeRequest(
        client,
        'post',
        `/tools/${toolName}`,
        request
      );

      const result: MCPToolResponse = {
        success: true,
        result: response.data,
        executionTime: Date.now() - startTime
      };

      this.updateStats(serverId, true, Date.now() - startTime);
      this.emitEvent(MCPEventType.TOOL_EXECUTED, serverId, {
        toolName,
        params,
        result: result.result,
        executionTime: result.executionTime
      });

      return result.result;
    } catch (error) {
      this.updateStats(serverId, false, Date.now() - startTime);
      const mcpError = this.createMCPError(error, serverId, MCPErrorType.SERVER_ERROR);
      this.emitEvent(MCPEventType.SERVER_ERROR, serverId, { error: mcpError.message });
      throw mcpError;
    }
  }

  /**
   * Get a resource from the specified MCP server
   */
  async getResource(serverId: string, resourceId: string, params?: any): Promise<any> {
    const startTime = Date.now();

    try {
      const client = this.getClient(serverId);
      const queryParams = params ? `?${new URLSearchParams(params).toString()}` : '';
      
      const response = await this.makeRequest(
        client,
        'get',
        `/resources/${resourceId}${queryParams}`
      );

      const result: MCPResourceResponse = {
        success: true,
        data: response.data,
        contentType: response.headers['content-type']
      };

      this.updateStats(serverId, true, Date.now() - startTime);
      this.emitEvent(MCPEventType.RESOURCE_RETRIEVED, serverId, {
        resourceId,
        contentType: result.contentType
      });

      return result.data;
    } catch (error) {
      this.updateStats(serverId, false, Date.now() - startTime);
      const mcpError = this.createMCPError(error, serverId, MCPErrorType.NOT_FOUND_ERROR);
      throw mcpError;
    }
  }

  /**
   * Get a prompt from the specified MCP server
   */
  async getPrompt(serverId: string, promptId: string, variables?: Record<string, any>): Promise<string> {
    const startTime = Date.now();

    try {
      const client = this.getClient(serverId);
      const request: MCPPromptRequest = { promptId, variables };
      
      const response = await this.makeRequest(
        client,
        'post',
        `/prompts/${promptId}`,
        request
      );

      const result: MCPPromptResponse = {
        success: true,
        prompt: response.data.prompt || response.data
      };

      this.updateStats(serverId, true, Date.now() - startTime);
      this.emitEvent(MCPEventType.PROMPT_RETRIEVED, serverId, {
        promptId,
        variables
      });

      return result.prompt!;
    } catch (error) {
      this.updateStats(serverId, false, Date.now() - startTime);
      const mcpError = this.createMCPError(error, serverId, MCPErrorType.NOT_FOUND_ERROR);
      throw mcpError;
    }
  }

  /**
   * Perform health check on a specific server
   */
  async healthCheck(serverId: string): Promise<boolean> {
    try {
      const client = this.getClient(serverId);
      await this.makeRequest(client, 'get', '/health');
      
      this.healthStatus.set(serverId, true);
      this.emitEvent(MCPEventType.HEALTH_CHECK, serverId, { healthy: true });
      return true;
    } catch (error) {
      this.healthStatus.set(serverId, false);
      this.emitEvent(MCPEventType.HEALTH_CHECK, serverId, { healthy: false });
      return false;
    }
  }

  /**
   * Perform health check on all servers
   */
  async healthCheckAll(): Promise<Map<string, boolean>> {
    const healthPromises = Array.from(this.servers.keys()).map(
      async (serverId) => {
        const healthy = await this.healthCheck(serverId);
        return [serverId, healthy] as [string, boolean];
      }
    );

    const results = await Promise.all(healthPromises);
    return new Map(results);
  }

  /**
   * Get server capabilities
   */
  async getServerCapabilities(serverId: string): Promise<MCPServerCapabilities> {
    try {
      const client = this.getClient(serverId);
      const response = await this.makeRequest(client, 'get', '/capabilities');
      return response.data;
    } catch (error) {
      const mcpError = this.createMCPError(error, serverId, MCPErrorType.SERVER_ERROR);
      throw mcpError;
    }
  }

  /**
   * Load a state graph from an MCP server
   */
  async loadStateGraph(serverId: string, graphId: string): Promise<StateGraph> {
    return this.getResource(serverId, `stategraphs/${graphId}`);
  }

  /**
   * Save a state to an MCP server
   */
  async saveState(serverId: string, state: State): Promise<void> {
    try {
      const client = this.getClient(serverId);
      await this.makeRequest(client, 'post', '/states', state);
    } catch (error) {
      const mcpError = this.createMCPError(error, serverId, MCPErrorType.SERVER_ERROR);
      throw mcpError;
    }
  }

  /**
   * Load a state from an MCP server
   */
  async loadState(serverId: string, graphId: string, userId: string): Promise<State | null> {
    try {
      const client = this.getClient(serverId);
      const response = await this.makeRequest(
        client,
        'get',
        `/states/${graphId}/${userId}`
      );
      return response.data;
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null; // State not found
      }
      const mcpError = this.createMCPError(error, serverId, MCPErrorType.NOT_FOUND_ERROR);
      throw mcpError;
    }
  }

  /**
   * Get current statistics
   */
  getStats(): MCPStats {
    return { ...this.stats };
  }

  /**
   * Get health status of all servers
   */
  getHealthStatus(): Map<string, boolean> {
    return new Map(this.healthStatus);
  }

  // Private helper methods

  private validateServerConfig(config: MCPServerConfig): void {
    if (!config.id) throw new Error('Server ID is required');
    if (!config.name) throw new Error('Server name is required');
    if (!config.url) throw new Error('Server URL is required');
    if (this.servers.has(config.id)) {
      throw new Error(`Server with ID '${config.id}' already exists`);
    }
  }

  private createHttpClient(config: MCPServerConfig): AxiosInstance {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    return axios.create({
      baseURL: config.url,
      timeout: config.timeout || MCP_DEFAULTS.TIMEOUT,
      headers
    });
  }

  private getClient(serverId: string): AxiosInstance {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server with ID '${serverId}' not found`);
    }
    return client;
  }

  private async makeRequest(
    client: AxiosInstance,
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    data?: any
  ): Promise<AxiosResponse> {
    this.stats.totalRequests++;
    this.stats.activeConnections++;

    try {
      const response = await client.request({
        method,
        url,
        data
      });
      return response;
    } finally {
      this.stats.activeConnections--;
    }
  }

  private updateStats(serverId: string, success: boolean, responseTime: number): void {
    this.stats.requestsByServer[serverId]++;
    
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }

    // Update average response time
    const totalResponses = this.stats.successfulRequests + this.stats.failedRequests;
    this.stats.averageResponseTime = 
      (this.stats.averageResponseTime * (totalResponses - 1) + responseTime) / totalResponses;
  }

  private createMCPError(error: any, serverId: string, type: MCPErrorType): MCPError {
    const mcpError = new Error(error.message || 'Unknown MCP error') as MCPError;
    mcpError.type = type;
    mcpError.serverId = serverId;
    
    if (axios.isAxiosError(error)) {
      mcpError.statusCode = error.response?.status;
      mcpError.details = {
        url: error.config?.url,
        method: error.config?.method,
        data: error.response?.data
      };
    }

    return mcpError;
  }

  private emitEvent(type: MCPEventType, serverId: string, data?: any): void {
    const event: MCPEvent = {
      type,
      serverId,
      timestamp: Date.now(),
      data
    };
    this.emit(type, event);
  }

  private setupGlobalErrorHandling(): void {
    this.on('error', (error: any) => {
      console.error('MCPDriver error:', error);
    });
  }
}
