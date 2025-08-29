/**
 * MCP Driver Adapter
 * Native MCP protocol implementation
 */

import { IMCPDriver, MCPServerConfig } from './IMCPDriver';
import { MCPClientDriver } from './MCPClientDriver';
import { logger, Logger } from '../utils/logger';

/**
 * Adapter configuration
 */
export interface MCPDriverAdapterConfig {
  /** Reserved for future use */
  reserved?: boolean;
}

/**
 * MCP Driver Adapter - Native MCP protocol only
 */
export class MCPDriverAdapter implements IMCPDriver {
  private nativeDriver: MCPClientDriver;
  private config: MCPDriverAdapterConfig;

  constructor(config: MCPDriverAdapterConfig = {}) {
    this.config = config;
    this.nativeDriver = new MCPClientDriver();

    Logger.mcpVerbose(`MCPDriverAdapter: Initialized with native MCP protocol`);
  }

  /**
   * Get the active driver instance
   */
  private getActiveDriver(): IMCPDriver {
    return this.nativeDriver;
  }

  // ===== IMCPDriver Implementation =====

  async addServer(config: MCPServerConfig): Promise<void> {
    return this.nativeDriver.addServer(config);
  }

  async removeServer(serverId: string): Promise<boolean> {
    return this.nativeDriver.removeServer(serverId);
  }

  getServers(): MCPServerConfig[] {
    return this.getActiveDriver().getServers();
  }

  getServer(serverId: string): MCPServerConfig | undefined {
    return this.getActiveDriver().getServer(serverId);
  }

  async executeTool(serverId: string, toolName: string, params: any): Promise<any> {
    return this.nativeDriver.executeTool(serverId, toolName, params);
  }

  async getResource(serverId: string, resourceId: string, params?: any): Promise<any> {
    return this.nativeDriver.getResource(serverId, resourceId, params);
  }

  async getPromptById(serverId: string, promptId: string, variables?: Record<string, any>): Promise<string> {
    return this.nativeDriver.getPromptById(serverId, promptId, variables);
  }

  async getPrompt(serverId: string, promptId: string, variables?: Record<string, any>): Promise<string> {
    return this.getPromptById(serverId, promptId, variables);
  }

  async loadStateGraph(serverId: string, graphId: string): Promise<any> {
    // Helper to normalize MCP contents to object
    const toObject = (contents: any): any => {
      if (!contents) return undefined;
      const first = Array.isArray(contents) ? contents[0] : contents;
      if (!first) return undefined;
      const text = first.text || (typeof first === 'string' ? first : undefined);
      if (text) {
        try { return JSON.parse(text); } catch { return undefined; }
      }
      return first;
    };

    // Try stategraph: scheme first
    try {
      const contents = await this.nativeDriver.getResource(serverId, `stategraph:${graphId}`);
      const obj = toObject(contents);
      if (obj && obj.states) return obj;
    } catch (err1) {
      Logger.mcpVerbose('MCPDriverAdapter: native loadStateGraph failed with stategraph: scheme, trying server-specific URI', { serverId, graphId, err1 });
    }

    // Try server-specific URI (e.g., xplus1://stategraphs/<id>)
    const candidates: string[] = [];
    if (serverId.includes('xplus1')) {
      candidates.push(`xplus1://stategraphs/${graphId}`);
    }
    candidates.push(`stategraphs/${graphId}`); // legacy-ish fallback

    for (const uri of candidates) {
      try {
        const contents = await this.nativeDriver.getResource(serverId, uri);
        const obj = toObject(contents);
        if (obj && obj.states) return obj;
      } catch {/* try next */}
    }

    throw new Error(`StateGraph '${graphId}' not found or invalid from server '${serverId}'`);
  }

  async saveState(serverId: string, state: any): Promise<void> {
    return this.nativeDriver.executeTool(serverId, 'save_state', { state });
  }

  async loadState(serverId: string, graphId: string, userId: string): Promise<any> {
    try {
      return await this.nativeDriver.getResource(serverId, `states/${graphId}/${userId}`);
    } catch (error) {
      // Return null if state doesn't exist (new player)
      Logger.mcpVerbose(`MCPDriverAdapter: State not found for ${graphId}:${userId}, will create new state`);
      return null;
    }
  }

  async healthCheck(serverId: string): Promise<boolean> {
    return this.nativeDriver.healthCheck(serverId);
  }

  async healthCheckAll(): Promise<Map<string, boolean>> {
    return this.nativeDriver.healthCheckAll();
  }

  getHealthStatus(): Map<string, boolean> {
    return this.getActiveDriver().getHealthStatus();
  }

  async close(): Promise<void> {
    if (this.nativeDriver.close) {
      await this.nativeDriver.close();
    }
  }

  // ===== Adapter Specific Methods =====

  /**
   * Get current protocol type (always native now)
   */
  getCurrentProtocol(): 'native' {
    return 'native';
  }

  /**
   * Get native driver for MCPClientLike usage
   */
  getNativeDriver(): MCPClientDriver {
    return this.nativeDriver;
  }
}
