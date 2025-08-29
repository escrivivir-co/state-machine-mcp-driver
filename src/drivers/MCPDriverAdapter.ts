/**
 * MCP Driver Adapter
 * Allows switching between legacy MCPDriver and new MCPClientDriver
 * Provides seamless migration path
 */

import { IMCPDriver, MCPServerConfig } from './IMCPDriver';
import { MCPDriver } from './MCPDriver';
import { MCPClientDriver } from './MCPClientDriver';
import { logger, Logger } from '../utils/logger';

/**
 * Adapter configuration
 */
export interface MCPDriverAdapterConfig {
  /** Use new native MCP protocol */
  useNativeProtocol?: boolean;
  /** Fallback to legacy driver on errors */
  enableFallback?: boolean;
}

/**
 * MCP Driver Adapter - allows switching between implementations
 */
export class MCPDriverAdapter implements IMCPDriver {
  private nativeDriver: MCPClientDriver;
  private legacyDriver: MCPDriver;
  private config: MCPDriverAdapterConfig;
  private useNative: boolean;

  constructor(config: MCPDriverAdapterConfig = {}) {
    this.config = {
      useNativeProtocol: process.env.MCP_USE_NATIVE_PROTOCOL === 'true',
      enableFallback: true,
      ...config
    };

    this.useNative = this.config.useNativeProtocol || false;
    this.nativeDriver = new MCPClientDriver();
    this.legacyDriver = new MCPDriver();

    Logger.mcpVerbose(`MCPDriverAdapter: Initialized with ${this.useNative ? 'native' : 'legacy'} protocol`);
  }

  /**
   * Get the active driver instance
   */
  private getActiveDriver(): IMCPDriver {
    return this.useNative ? this.nativeDriver : this.legacyDriver;
  }

  /**
   * Execute with fallback support
   */
  private async executeWithFallback<T>(
    operation: string,
    nativeAction: () => Promise<T>,
    legacyAction: () => Promise<T>
  ): Promise<T> {
    try {
      if (this.useNative) {
        return await nativeAction();
      } else {
        return await legacyAction();
      }
    } catch (error) {
      if (this.config.enableFallback && this.useNative) {
        Logger.mcpVerbose(`MCPDriverAdapter: ${operation} failed with native driver, falling back to legacy`, { error });
        try {
          return await legacyAction();
        } catch (fallbackError) {
          Logger.mcpError(`MCPDriverAdapter: ${operation} failed with both drivers`, { original: error, fallback: fallbackError });
          throw error; // Throw original error
        }
      }
      throw error;
    }
  }

  // ===== IMCPDriver Implementation =====

  async addServer(config: MCPServerConfig): Promise<void> {
    return this.executeWithFallback(
      'addServer',
      () => this.nativeDriver.addServer(config),
      () => Promise.resolve(this.legacyDriver.addServer(config))
    );
  }

  async removeServer(serverId: string): Promise<boolean> {
    return this.executeWithFallback(
      'removeServer',
      () => this.nativeDriver.removeServer(serverId),
      () => Promise.resolve(this.legacyDriver.removeServer(serverId))
    );
  }

  getServers(): MCPServerConfig[] {
    return this.getActiveDriver().getServers();
  }

  getServer(serverId: string): MCPServerConfig | undefined {
    return this.getActiveDriver().getServer(serverId);
  }

  async executeTool(serverId: string, toolName: string, params: any): Promise<any> {
    return this.executeWithFallback(
      'executeTool',
      () => this.nativeDriver.executeTool(serverId, toolName, params),
      () => this.legacyDriver.executeTool(serverId, toolName, params)
    );
  }

  async getResource(serverId: string, resourceId: string, params?: any): Promise<any> {
    return this.executeWithFallback(
      'getResource',
      () => this.nativeDriver.getResource(serverId, resourceId, params),
      () => this.legacyDriver.getResource(serverId, resourceId, params)
    );
  }

  async getPromptById(serverId: string, promptId: string, variables?: Record<string, any>): Promise<string> {
    return this.executeWithFallback(
      'getPromptById',
      () => this.nativeDriver.getPromptById(serverId, promptId, variables),
      () => this.legacyDriver.getPrompt(serverId, promptId, variables)
    );
  }

  async getPrompt(serverId: string, promptId: string, variables?: Record<string, any>): Promise<string> {
    return this.getPromptById(serverId, promptId, variables);
  }

  async loadStateGraph(serverId: string, graphId: string): Promise<any> {
    return this.executeWithFallback(
      'loadStateGraph',
      async () => {
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
      },
      () => this.legacyDriver.loadStateGraph(serverId, graphId)
    );
  }

  async saveState(serverId: string, state: any): Promise<void> {
    return this.executeWithFallback(
      'saveState',
      () => this.nativeDriver.executeTool(serverId, 'save_state', { state }),
      () => this.legacyDriver.saveState(serverId, state)
    );
  }

  async loadState(serverId: string, graphId: string, userId: string): Promise<any> {
    try {
      return await this.executeWithFallback(
        'loadState',
        () => this.nativeDriver.getResource(serverId, `states/${graphId}/${userId}`),
        () => this.legacyDriver.loadState(serverId, graphId, userId)
      );
    } catch (error) {
      // Return null if state doesn't exist (new player)
      Logger.mcpVerbose(`MCPDriverAdapter: State not found for ${graphId}:${userId}, will create new state`);
      return null;
    }
  }

  async healthCheck(serverId: string): Promise<boolean> {
    return this.executeWithFallback(
      'healthCheck',
      () => this.nativeDriver.healthCheck(serverId),
      () => this.legacyDriver.healthCheck(serverId)
    );
  }

  async healthCheckAll(): Promise<Map<string, boolean>> {
    return this.executeWithFallback(
      'healthCheckAll',
      () => this.nativeDriver.healthCheckAll(),
      () => this.legacyDriver.healthCheckAll()
    );
  }

  getHealthStatus(): Map<string, boolean> {
    return this.getActiveDriver().getHealthStatus();
  }

  async close(): Promise<void> {
    const closePromises: Promise<void>[] = [];
    
    if (this.nativeDriver.close) {
      closePromises.push(this.nativeDriver.close());
    }
    
    await Promise.all(closePromises);
  }

  // ===== Adapter Specific Methods =====

  /**
   * Switch to native protocol
   */
  switchToNative(): void {
    this.useNative = true;
    Logger.mcpInfo('MCPDriverAdapter: Switched to native MCP protocol');
  }

  /**
   * Switch to legacy protocol
   */
  switchToLegacy(): void {
    this.useNative = false;
    Logger.mcpInfo('MCPDriverAdapter: Switched to legacy REST protocol');
  }

  /**
   * Get current protocol type
   */
  getCurrentProtocol(): 'native' | 'legacy' {
    return this.useNative ? 'native' : 'legacy';
  }

  /**
   * Get native driver for MCPClientLike usage
   */
  getNativeDriver(): MCPClientDriver {
    return this.nativeDriver;
  }

  /**
   * Get legacy driver for existing usage
   */
  getLegacyDriver(): MCPDriver {
    return this.legacyDriver;
  }
}
