/**
 * Unified MCP Driver Interface
 * Provides a common interface for both legacy MCPDriver and new MCPClientDriver
 */

export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
  apiKey?: string;
}

/**
 * Unified interface for MCP drivers
 * Implemented by both MCPDriver (legacy) and MCPClientDriver (native)
 */
export interface IMCPDriver {
  // Server management
  addServer(config: MCPServerConfig): void | Promise<void>;
  removeServer(serverId: string): boolean | Promise<boolean>;
  getServers(): MCPServerConfig[];
  getServer(serverId: string): MCPServerConfig | undefined;

  // Core MCP operations
  executeTool(serverId: string, toolName: string, params: any): Promise<any>;
  getResource(serverId: string, resourceId: string, params?: any): Promise<any>;

  // Runtime compatibility methods
  loadStateGraph(serverId: string, graphId: string): Promise<any>;
  saveState(serverId: string, state: any): Promise<void>;
  loadState(serverId: string, graphId: string, userId: string): Promise<any>;
  getPrompt(serverId: string, promptId: string, variables?: Record<string, any>): Promise<string>;

  // Health monitoring
  healthCheck(serverId: string): Promise<boolean>;
  healthCheckAll(): Promise<Map<string, boolean>>;
  getHealthStatus(): Map<string, boolean>;

  // Optional cleanup
  close?(): Promise<void>;
}
