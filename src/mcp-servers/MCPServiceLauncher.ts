/**
 * MCP Service Launcher Server
 * Manages launching and monitoring other MCP servers in separate console processes
 */

import { BaseMCPServer, MCPServerConfig } from './BaseMCPServer';
import { z } from 'zod';
import { spawn, ChildProcess } from 'child_process';
import { logger, Logger } from '../utils/logger';
import * as path from 'path';
import axios from 'axios';

/**
 * Configuration for a managed MCP server
 */
interface ManagedServerConfig {
  id: string;
  name: string;
  script: string;
  port: number;
  description?: string;
  args?: string[];
  env?: Record<string, string>;
  autoRestart?: boolean;
  healthCheckInterval?: number;
}

/**
 * Status of a managed server
 */
interface ServerStatus {
  id: string;
  name: string;
  status: 'stopped' | 'starting' | 'running' | 'failed' | 'restarting';
  pid?: number;
  port: number;
  startTime?: number;
  lastHealthCheck?: number;
  restartCount: number;
  lastError?: string;
  uptime: number;
}

/**
 * Launch session tracking
 */
interface LaunchSession {
  sessionId: string;
  startTime: number;
  managedServers: Map<string, ServerStatus>;
  globalHealthStatus: 'healthy' | 'degraded' | 'failed';
  totalRestarts: number;
  lastGlobalCheck: number;
}

/**
 * MCP Service Launcher Server
 * Provides tools to launch, monitor and manage other MCP servers
 */
export class MCPServiceLauncher extends BaseMCPServer {
  private session: LaunchSession;
  private processes: Map<string, ChildProcess> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private defaultConfigs: Map<string, ManagedServerConfig> = new Map();

  constructor() {
    const config: MCPServerConfig = {
      name: 'mcp-service-launcher',
      version: '1.0.0',
      description: 'MCP server manager for launching and monitoring other MCP servers',
      port: 3000,
      capabilities: {
        tools: true,
        resources: true,
        prompts: true,
      },
    };

    super(config);

    // Initialize launch session
    this.session = {
      sessionId: `launcher-session-${Date.now()}`,
      startTime: Date.now(),
      managedServers: new Map(),
      globalHealthStatus: 'healthy',
      totalRestarts: 0,
      lastGlobalCheck: 0
    };

    this.setupDefaultConfigs();
  }

  /**
   * Setup MCP Service Launcher specific tools, resources, and prompts
   */
  protected setupServerSpecifics(): void {
    this.setupTools();
    this.setupResources();
    this.setupPrompts();
  }

  /**
   * Setup default server configurations
   */
  private setupDefaultConfigs(): void {
    this.defaultConfigs.set('xplus1-mcp-machine', {
      id: 'xplus1-mcp-machine',
      name: 'X+1 MCP Machine',
      script: 'src/mcp-servers/XPlus1MCPMachine.ts',
      port: 3001,
      description: 'X+1 inductive pattern management server',
      autoRestart: true,
      healthCheckInterval: 30000
    });

    this.defaultConfigs.set('wiki-mcp-browser', {
      id: 'wiki-mcp-browser', 
      name: 'Wiki MCP Browser',
      script: 'src/mcp-servers/WikiMCPBrowser.ts',
      port: 3002,
      description: 'Real Wikipedia browsing server with doom-scrolling prevention',
      autoRestart: true,
      healthCheckInterval: 30000
    });
  }

  /**
   * Setup MCP Service Launcher tools
   */
  private setupTools(): void {
    // Launch MCP server tool
    this.server.tool(
      'launch_mcp_server',
      'Launch an MCP server in a separate console process',
      {
        serverId: z.string().describe('ID of the server to launch (e.g., xplus1-mcp-machine, wiki-mcp-browser)'),
        customConfig: z.object({
          port: z.number().optional().describe('Override default port'),
          args: z.array(z.string()).optional().describe('Additional arguments'),
          env: z.record(z.string()).optional().describe('Environment variables'),
          autoRestart: z.boolean().optional().describe('Enable auto-restart on failure')
        }).optional().describe('Custom configuration overrides')
      },
      async ({ serverId, customConfig }) => {
        try {
          const config = this.getServerConfig(serverId, customConfig);
          const result = await this.launchServer(config);

          Logger.mcpVerbose(`MCP Launcher: Successfully launched ${config.name}`, { serverId, port: config.port });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `MCP server '${config.name}' launched successfully`,
                  serverId: config.id,
                  name: config.name,
                  port: config.port,
                  pid: result.pid,
                  status: 'starting',
                  timestamp: Date.now()
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          Logger.mcpError(`MCP Launcher: Failed to launch server ${serverId}`, { error });
          
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: `Failed to launch server '${serverId}': ${errorMessage}`,
                  serverId,
                  timestamp: Date.now()
                }, null, 2)
              }
            ]
          };
        }
      }
    );

    // Stop MCP server tool
    this.server.tool(
      'stop_mcp_server',
      'Stop a running MCP server',
      {
        serverId: z.string().describe('ID of the server to stop'),
        graceful: z.boolean().optional().describe('Graceful shutdown (default: true)')
      },
      async ({ serverId, graceful = true }) => {
        try {
          const result = await this.stopServer(serverId, graceful);

          Logger.mcpVerbose(`MCP Launcher: Successfully stopped ${serverId}`, { graceful });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `MCP server '${serverId}' stopped successfully`,
                  serverId,
                  graceful,
                  timestamp: Date.now()
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          Logger.mcpError(`MCP Launcher: Failed to stop server ${serverId}`, { error });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: `Failed to stop server '${serverId}': ${this.getErrorMessage(error)}`,
                  serverId,
                  timestamp: Date.now()
                }, null, 2)
              }
            ]
          };
        }
      }
    );

    // Get server status tool
    this.server.tool(
      'get_server_status',
      'Get status of a specific MCP server or all servers',
      {
        serverId: z.string().optional().describe('ID of specific server (if not provided, returns all)')
      },
      async ({ serverId }) => {
        try {
          const status = serverId ? 
            this.getServerStatus(serverId) : 
            this.getAllServerStatus();

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(status, null, 2)
              }
            ]
          };
        } catch (error) {
          Logger.mcpError(`MCP Launcher: Failed to get server status`, { serverId, error });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: `Failed to get server status: ${this.getErrorMessage(error)}`,
                  serverId,
                  timestamp: Date.now()
                }, null, 2)
              }
            ]
          };
        }
      }
    );

    // Restart MCP server tool
    this.server.tool(
      'restart_mcp_server',
      'Restart an MCP server (stop and start)',
      {
        serverId: z.string().describe('ID of the server to restart'),
        graceful: z.boolean().optional().describe('Graceful restart (default: true)')
      },
      async ({ serverId, graceful = true }) => {
        try {
          await this.restartServer(serverId, graceful);

          Logger.mcpVerbose(`MCP Launcher: Successfully restarted ${serverId}`, { graceful });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `MCP server '${serverId}' restarted successfully`,
                  serverId,
                  graceful,
                  timestamp: Date.now()
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          Logger.mcpError(`MCP Launcher: Failed to restart server ${serverId}`, { error });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: `Failed to restart server '${serverId}': ${this.getErrorMessage(error)}`,
                  serverId,
                  timestamp: Date.now()
                }, null, 2)
              }
            ]
          };
        }
      }
    );

    // Launch all default servers tool
    this.server.tool(
      'launch_all_servers',
      'Launch all default MCP servers (XPlus1 and Wiki)',
      {
        healthCheck: z.boolean().optional().describe('Perform health checks after launch (default: true)')
      },
      async ({ healthCheck = true }) => {
        try {
          const results = await this.launchAllServers(healthCheck);

          Logger.mcpVerbose(`MCP Launcher: Launched all servers`, { results });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: 'All MCP servers launched successfully',
                  results,
                  timestamp: Date.now()
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          Logger.mcpError(`MCP Launcher: Failed to launch all servers`, { error });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: `Failed to launch all servers: ${this.getErrorMessage(error)}`,
                  timestamp: Date.now()
                }, null, 2)
              }
            ]
          };
        }
      }
    );

    // Generate VS Code MCP configuration tool
    this.server.tool(
      'generate_vscode_mcp_config',
      'Generate VS Code MCP configuration file (.vscode/mcp.json) for running servers',
      {
        includeDescription: z.boolean().optional().describe('Include server descriptions in config (default: true)'),
        outputPath: z.string().optional().describe('Custom output path for mcp.json (default: .vscode/mcp.json)')
      },
      async ({ includeDescription = true, outputPath = '.vscode/mcp.json' }) => {
        try {
          const mcpConfig = await this.generateVSCodeMCPConfig(includeDescription);
          const success = await this.saveVSCodeMCPConfig(mcpConfig, outputPath);

          if (success) {
            Logger.mcpVerbose(`MCP Launcher: Generated VS Code MCP config at ${outputPath}`);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: `VS Code MCP configuration generated successfully`,
                    outputPath,
                    configFile: mcpConfig,
                    instructions: this.getVSCodeInstructions(outputPath),
                    timestamp: Date.now()
                  }, null, 2)
                }
              ]
            };
          } else {
            throw new Error('Failed to save configuration file');
          }
        } catch (error) {
          Logger.mcpError(`MCP Launcher: Failed to generate VS Code config`, { error });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: `Failed to generate VS Code MCP config: ${this.getErrorMessage(error)}`,
                  timestamp: Date.now()
                }, null, 2)
              }
            ]
          };
        }
      }
    );

    // Health check tool
    this.server.tool(
      'health_check_servers',
      'Perform health check on all or specific MCP servers',
      {
        serverId: z.string().optional().describe('ID of specific server (if not provided, checks all)')
      },
      async ({ serverId }) => {
        try {
          const results = serverId ? 
            await this.healthCheckServer(serverId) : 
            await this.healthCheckAllServers();

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  healthCheck: results,
                  timestamp: Date.now()
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          Logger.mcpError(`MCP Launcher: Health check failed`, { serverId, error });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: `Health check failed: ${this.getErrorMessage(error)}`,
                  serverId,
                  timestamp: Date.now()
                }, null, 2)
              }
            ]
          };
        }
      }
    );

    // Check port availability tool
    this.server.tool(
      'check_port_availability',
      'Check if a port is available or identify what server is using it',
      {
        port: z.number().describe('Port number to check'),
        includeDetails: z.boolean().optional().describe('Include detailed server information if port is occupied')
      },
      async ({ port, includeDetails = true }) => {
        try {
          const isAvailable = await this.isPortAvailable(port);
          
          if (isAvailable) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    port,
                    available: true,
                    message: `Port ${port} is available`,
                    timestamp: Date.now()
                  }, null, 2)
                }
              ]
            };
          } else {
            const managedServerId = await this.isPortOccupiedByManagedServer(port);
            let details = {};
            
            if (includeDetails) {
              try {
                const response = await axios.get(`http://localhost:${port}/health`, { timeout: 1000 });
                details = response.data;
              } catch {
                details = { error: 'Could not get server details' };
              }
            }
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    port,
                    available: false,
                    message: `Port ${port} is occupied`,
                    managedServer: managedServerId,
                    isOurServer: !!managedServerId,
                    ...(includeDetails && { serverDetails: details }),
                    timestamp: Date.now()
                  }, null, 2)
                }
              ]
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: `Port check failed: ${this.getErrorMessage(error)}`,
                  port,
                  timestamp: Date.now()
                }, null, 2)
              }
            ]
          };
        }
      }
    );
  }

  /**
   * Setup MCP Service Launcher resources
   */
  private setupResources(): void {
    // Launch session resource
    this.server.resource(
      'launch-session',
      'launcher://session/current',
      {
        name: 'Current Launch Session',
        description: 'Information about the current MCP servers launch session',
        mimeType: 'application/json'
      },
      async () => {
        const sessionData = {
          ...this.session,
          managedServers: Object.fromEntries(this.session.managedServers),
          uptime: Date.now() - this.session.startTime
        };

        return {
          contents: [
            {
              uri: 'launcher://session/current',
              mimeType: 'application/json',
              text: JSON.stringify(sessionData, null, 2)
            }
          ]
        };
      }
    );

    // Available servers configuration resource
    this.server.resource(
      'available-servers',
      'launcher://servers/available',
      {
        name: 'Available Server Configurations',
        description: 'List of all available MCP servers that can be launched',
        mimeType: 'application/json'
      },
      async () => {
        const availableServers = Object.fromEntries(this.defaultConfigs);

        return {
          contents: [
            {
              uri: 'launcher://servers/available',
              mimeType: 'application/json',
              text: JSON.stringify(availableServers, null, 2)
            }
          ]
        };
      }
    );

    // Launcher status resource
    this.server.resource(
      'launcher-status',
      'launcher://status/global',
      {
        name: 'Global Launcher Status',
        description: 'Overall status of the MCP Service Launcher',
        mimeType: 'application/json'
      },
      async () => {
        const status = {
          sessionId: this.session.sessionId,
          uptime: Date.now() - this.session.startTime,
          globalHealthStatus: this.session.globalHealthStatus,
          totalManagedServers: this.session.managedServers.size,
          runningServers: Array.from(this.session.managedServers.values())
            .filter(s => s.status === 'running').length,
          totalRestarts: this.session.totalRestarts,
          lastGlobalCheck: this.session.lastGlobalCheck,
          processCount: this.processes.size,
          availableConfigs: Array.from(this.defaultConfigs.keys())
        };

        return {
          contents: [
            {
              uri: 'launcher://status/global',
              mimeType: 'application/json',
              text: JSON.stringify(status, null, 2)
            }
          ]
        };
      }
    );

    // VS Code MCP configuration resource
    this.server.resource(
      'vscode-mcp-config',
      'launcher://vscode/mcp-config',
      {
        name: 'VS Code MCP Configuration',
        description: 'Generated VS Code MCP configuration for running servers',
        mimeType: 'application/json'
      },
      async () => {
        const config = await this.generateVSCodeMCPConfig(true);
        const instructions = this.getVSCodeInstructions('.vscode/mcp.json');

        const response = {
          configuration: config,
          instructions,
          runningServers: Array.from(this.session.managedServers.entries())
            .filter(([_, status]) => status.status === 'running')
            .map(([id, status]) => ({
              id,
              name: status.name,
              port: status.port,
              uptime: status.startTime ? Date.now() - status.startTime : 0
            }))
        };

        return {
          contents: [
            {
              uri: 'launcher://vscode/mcp-config',
              mimeType: 'application/json',
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      }
    );
  }

  /**
   * Setup MCP Service Launcher prompts
   */
  private setupPrompts(): void {
    // Launch status prompt
    this.server.prompt(
      'launch-status',
      'Current status of all managed MCP servers',
      {},
      async () => {
        const runningServers = Array.from(this.session.managedServers.values())
          .filter(s => s.status === 'running');
        const failedServers = Array.from(this.session.managedServers.values())
          .filter(s => s.status === 'failed');

        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `🚀 **MCP Service Launcher Status**\n\n` +
                      `Session: ${this.session.sessionId}\n` +
                      `Uptime: ${Math.floor((Date.now() - this.session.startTime) / 60000)} minutes\n` +
                      `Global Health: ${this.session.globalHealthStatus}\n\n` +
                      `**Running Servers (${runningServers.length}):**\n` +
                      runningServers.map(s => 
                        `✅ ${s.name} (port ${s.port}) - ${Math.floor((Date.now() - s.startTime!) / 60000)}min uptime`
                      ).join('\n') + '\n\n' +
                      (failedServers.length > 0 ? 
                        `**Failed Servers (${failedServers.length}):**\n` +
                        failedServers.map(s => 
                          `❌ ${s.name} - ${s.lastError || 'Unknown error'}`
                        ).join('\n') + '\n\n' : '') +
                      `Total Restarts: ${this.session.totalRestarts}\n` +
                      `Available Configs: ${Array.from(this.defaultConfigs.keys()).join(', ')}`
              }
            }
          ]
        };
      }
    );

    // Launch recommendation prompt
    this.server.prompt(
      'launch-recommendations',
      'Recommendations for launching MCP servers based on current state',
      {
        context: z.string().optional().describe('Additional context for recommendations')
      },
      async ({ context }) => {
        const notRunning = Array.from(this.defaultConfigs.keys())
          .filter(id => !this.session.managedServers.has(id) || 
                       this.session.managedServers.get(id)?.status !== 'running');
        
        const failing = Array.from(this.session.managedServers.values())
          .filter(s => s.status === 'failed' && s.restartCount > 2);

        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `🎯 **MCP Launch Recommendations**\n\n` +
                      (context ? `Context: ${context}\n\n` : '') +
                      (notRunning.length > 0 ? 
                        `**Servers to Launch:**\n` +
                        notRunning.map(id => {
                          const config = this.defaultConfigs.get(id)!;
                          return `🔄 ${config.name} (${id}) - Port ${config.port}`;
                        }).join('\n') + '\n\n' : 
                        `✅ All default servers are running\n\n`) +
                      (failing.length > 0 ? 
                        `**Servers Need Attention:**\n` +
                        failing.map(s => 
                          `⚠️ ${s.name} - Failed ${s.restartCount} times`
                        ).join('\n') + '\n\n' : '') +
                      `**Quick Actions:**\n` +
                      `• Launch all: Use 'launch_all_servers'\n` +
                      `• Health check: Use 'health_check_servers'\n` +
                      `• Status check: Use 'get_server_status'`
              }
            }
          ]
        };
      }
    );

    // VS Code setup prompt
    this.server.prompt(
      'vscode-setup-guide',
      'Step-by-step guide for setting up VS Code with MCP servers',
      {
        showConfiguration: z.string().optional().describe('Include full configuration in guide (true/false, default: true)')
      },
      async ({ showConfiguration = 'true' }) => {
        const includeConfig = showConfiguration.toLowerCase() === 'true';
        const runningServers = Array.from(this.session.managedServers.values())
          .filter(s => s.status === 'running');
        
        const configSample = includeConfig ? 
          JSON.stringify(await this.generateVSCodeMCPConfig(true), null, 2) : 
          '// Configuration will be generated automatically';

        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `🔧 **VS Code MCP Setup Guide**\n\n` +
                      `**Current Status:**\n` +
                      `• Running Servers: ${runningServers.length}\n` +
                      `• Available for VS Code: ${runningServers.map(s => s.name).join(', ')}\n\n` +
                      `**Setup Steps:**\n\n` +
                      `1. **Generate Configuration**\n` +
                      `   Use the 'generate_vscode_mcp_config' tool to create .vscode/mcp.json\n\n` +
                      `2. **Install VS Code Extension**\n` +
                      `   Search for "Model Context Protocol" in VS Code Extensions\n\n` +
                      `3. **Open Configuration File**\n` +
                      `   Navigate to .vscode/mcp.json in your workspace\n\n` +
                      `4. **Connect to Servers**\n` +
                      `   • Press Ctrl+Shift+P (Cmd+Shift+P on Mac)\n` +
                      `   • Search for "MCP: Connect to Server"\n` +
                      `   • Select from available servers\n\n` +
                      `5. **Start Using Tools**\n` +
                      `   • MCP: List Available Tools\n` +
                      `   • MCP: Browse Resources\n` +
                      `   • MCP: Use Prompt\n\n` +
                      (includeConfig ? 
                        `**Generated Configuration Preview:**\n` +
                        `\`\`\`json\n${configSample}\n\`\`\`\n\n` : '') +
                      `**Next Steps:**\n` +
                      `• Run the generate_vscode_mcp_config tool\n` +
                      `• Open VS Code in this workspace\n` +
                      `• Follow the setup instructions provided`
              }
            }
          ]
        };
      }
    );
  }

  // Private implementation methods

  /**
   * Helper function to get error message from unknown error type
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * Generate VS Code MCP configuration object
   */
  private async generateVSCodeMCPConfig(includeDescription: boolean = true): Promise<any> {
    const runningServers = Array.from(this.session.managedServers.values())
      .filter(s => s.status === 'running');

    const servers: Record<string, any> = {};

    // Add service launcher itself
    servers['mcp-service-launcher'] = {
      type: 'http',
      url: `http://localhost:${this.config.port}`
    };

    // Add running servers
    for (const server of runningServers) {
      const defaultConfig = this.defaultConfigs.get(server.id);
      if (defaultConfig) {
        servers[server.id] = {
          type: 'http',
          url: `http://localhost:${server.port}`
        };
      }
    }

    return {
      servers
    };
  }

  /**
   * Save VS Code MCP configuration to file
   */
  private async saveVSCodeMCPConfig(config: any, outputPath: string): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Ensure directory exists
      const dir = path.dirname(outputPath);
      await fs.mkdir(dir, { recursive: true });

      // Write configuration file
      const configJson = JSON.stringify(config, null, 2);
      await fs.writeFile(outputPath, configJson, 'utf8');

      return true;
    } catch (error) {
      Logger.mcpError(`MCP Launcher: Failed to save VS Code config`, { error, outputPath });
      return false;
    }
  }

  /**
   * Get VS Code usage instructions
   */
  private getVSCodeInstructions(configPath: string): any {
    return {
      steps: [
        {
          step: 1,
          action: "Open VS Code",
          description: "Open Visual Studio Code in your workspace folder"
        },
        {
          step: 2,
          action: "Install MCP Extension",
          description: "Install the official Model Context Protocol extension from the VS Code marketplace"
        },
        {
          step: 3,
          action: "Open MCP Configuration",
          description: `Navigate to the generated file: ${configPath}`
        },
        {
          step: 4,
          action: "Use VS Code Intellisense",
          description: "Use VS Code's IntelliSense to connect to MCP servers. Press Ctrl+Shift+P (or Cmd+Shift+P on Mac) and search for 'MCP: Connect to Server'"
        },
        {
          step: 5,
          action: "Select Server",
          description: "Choose from the available MCP servers listed in the configuration file"
        },
        {
          step: 6,
          action: "Start Using Tools",
          description: "Once connected, you can use MCP tools, resources, and prompts directly in VS Code"
        }
      ],
      quickCommands: [
        "Ctrl+Shift+P → 'MCP: Connect to Server'",
        "Ctrl+Shift+P → 'MCP: List Available Tools'",
        "Ctrl+Shift+P → 'MCP: Browse Resources'",
        "Ctrl+Shift+P → 'MCP: Use Prompt'"
      ],
      availableServers: Array.from(this.session.managedServers.keys()),
      configurationFile: configPath,
      note: "Make sure all MCP servers are running before connecting from VS Code"
    };
  }

  /**
   * Get server configuration with custom overrides
   */
  private getServerConfig(serverId: string, customConfig?: any): ManagedServerConfig {
    const defaultConfig = this.defaultConfigs.get(serverId);
    if (!defaultConfig) {
      throw new Error(`Unknown server ID: ${serverId}`);
    }

    return {
      ...defaultConfig,
      ...customConfig
    };
  }

  /**
   * Launch a single MCP server
   */
  private async launchServer(config: ManagedServerConfig): Promise<{ pid: number }> {
    // Check if already running
    if (this.processes.has(config.id)) {
      throw new Error(`Server ${config.id} is already running`);
    }

    // Pre-check: is the desired port already in use?
    let portOccupied = false;
    try {
      const response = await axios.get(`http://localhost:${config.port}/health`, { timeout: 1000 });
      if (response.status === 200) {
        portOccupied = true;
        Logger.mcpVerbose(`MCP Launcher: Port ${config.port} is already in use by a running server`);
        
        // Check if this might be our server already running
        try {
          const healthData = response.data;
          if (healthData.server === config.id || healthData.name === config.name) {
            Logger.mcpVerbose(`MCP Launcher: Found existing ${config.name} on port ${config.port}, registering it`);
            
            // Register the existing server without launching a new one
            const status: ServerStatus = {
              id: config.id,
              name: config.name,
              status: 'running',
              pid: -1, // Unknown PID for existing process
              port: config.port,
              startTime: Date.now(), // We don't know the real start time
              restartCount: 0,
              uptime: 0
            };
            
            this.session.managedServers.set(config.id, status);
            
            // Setup health check
            if (config.healthCheckInterval) {
              this.setupHealthCheck(config);
            }
            
            return { pid: -1 }; // Return -1 to indicate existing process
          }
        } catch (error) {
          // Health response doesn't match our server, continue with port conflict error
        }
        
        throw new Error(`Port ${config.port} is already in use by another process. Cannot launch ${config.name}.`);
      }
    } catch (error) {
      // Port is free or error occurred - continue with launch
      if (error instanceof Error && error.message.includes('already in use')) {
        throw error; // Re-throw port conflict errors
      }
      // Otherwise, port is likely free, continue
    }

    // Get tsx command for launching TypeScript files
    const tsxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const args = ['tsx', config.script];
    
    if (config.args) {
      args.push(...config.args);
    }

    // Set environment variables
    const env = {
      ...process.env,
      ...config.env,
      MCP_SERVER_PORT: config.port.toString()
    };

    Logger.mcpVerbose(`MCP Launcher: Starting ${config.name}`, { 
      script: config.script, 
      port: config.port,
      args 
    });

    // Launch in separate process (hidden console on Windows)
    const serverProcess = spawn(tsxCmd, args, {
      stdio: 'pipe',
      env,
      detached: true,
      shell: process.platform === 'win32',
      windowsHide: true
    });

    if (!serverProcess.pid) {
      throw new Error(`Failed to start server ${config.id}`);
    }

    // Store process reference
    this.processes.set(config.id, serverProcess);

    // Create server status
    const status: ServerStatus = {
      id: config.id,
      name: config.name,
      status: 'starting',
      pid: serverProcess.pid,
      port: config.port,
      startTime: Date.now(),
      restartCount: 0,
      uptime: 0
    };

    this.session.managedServers.set(config.id, status);

    // Setup process event handlers
    this.setupProcessHandlers(config, serverProcess);

    // Poll for server readiness (port exposed)
    const start = Date.now();
    const timeoutMs = 15000;
    let reachable = false;
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await axios.get(`http://localhost:${config.port}/health`, { timeout: 1000 });
        if (res.status === 200) { reachable = true; break; }
      } catch {/* retry */}
      await this.sleep(500);
    }
    if (reachable) {
      Logger.mcpVerbose(`MCP Launcher: ${config.name} exposed on port ${config.port}`);
      status.status = 'running';
    } else {
      Logger.mcpVerbose(`MCP Launcher: ${config.name} did not become reachable on port ${config.port} within ${timeoutMs}ms`);
    }

    // Setup periodic health checks if configured
    if (config.healthCheckInterval) {
      this.setupHealthCheck(config);
    }

    // Update status to running (basic assumption)
    this.session.managedServers.set(config.id, status);

    return { pid: serverProcess.pid };
  }

  /**
   * Setup process event handlers
   */
  private setupProcessHandlers(config: ManagedServerConfig, process: ChildProcess): void {
    process.on('exit', (code, signal) => {
      Logger.mcpVerbose(`MCP Launcher: Process ${config.id} exited`, { code, signal });
      
      const status = this.session.managedServers.get(config.id);
      if (status) {
        status.status = code === 0 ? 'stopped' : 'failed';
        status.lastError = code !== 0 ? `Process exited with code ${code}` : undefined;
        this.session.managedServers.set(config.id, status);
      }

      this.processes.delete(config.id);
      this.clearHealthCheck(config.id);

      // Auto-restart if configured
      if (config.autoRestart && code !== 0) {
        this.autoRestartServer(config);
      }
    });

    process.on('error', (error) => {
      Logger.mcpError(`MCP Launcher: Process ${config.id} error`, { error });
      
      const status = this.session.managedServers.get(config.id);
      if (status) {
        status.status = 'failed';
        status.lastError = error.message;
        this.session.managedServers.set(config.id, status);
      }
    });

    // Log stdout/stderr for debugging
    if (process.stdout) {
      process.stdout.on('data', (data) => {
        Logger.mcpVerbose(`MCP Launcher: ${config.id} stdout`, { data: data.toString() });
      });
    }

    if (process.stderr) {
      process.stderr.on('data', (data) => {
        Logger.mcpVerbose(`MCP Launcher: ${config.id} stderr`, { data: data.toString() });
      });
    }
  }

  /**
   * Setup health check for a server
   */
  private setupHealthCheck(config: ManagedServerConfig): void {
    const interval = setInterval(async () => {
      try {
        await this.healthCheckServer(config.id);
      } catch (error) {
        Logger.mcpVerbose(`MCP Launcher: Health check failed for ${config.id}`, { error });
      }
    }, config.healthCheckInterval!);

    this.healthCheckIntervals.set(config.id, interval);
  }

  /**
   * Clear health check for a server
   */
  private clearHealthCheck(serverId: string): void {
    const interval = this.healthCheckIntervals.get(serverId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(serverId);
    }
  }

  /**
   * Auto-restart a failed server
   */
  private async autoRestartServer(config: ManagedServerConfig): Promise<void> {
    const status = this.session.managedServers.get(config.id);
    if (!status) return;

    // Limit restart attempts
    if (status.restartCount >= 3) {
      Logger.mcpVerbose(`MCP Launcher: Max restart attempts reached for ${config.id}`);
      return;
    }

    Logger.mcpVerbose(`MCP Launcher: Auto-restarting ${config.id}`, { 
      restartCount: status.restartCount + 1 
    });

    status.restartCount += 1;
    status.status = 'restarting';
    this.session.managedServers.set(config.id, status);
    this.session.totalRestarts += 1;

    // Wait before restart
    await this.sleep(5000);

    try {
      await this.launchServer(config);
    } catch (error) {
      Logger.mcpError(`MCP Launcher: Auto-restart failed for ${config.id}`, { error });
      status.status = 'failed';
      status.lastError = `Auto-restart failed: ${this.getErrorMessage(error)}`;
      this.session.managedServers.set(config.id, status);
    }
  }

  /**
   * Stop a server
   */
  private async stopServer(serverId: string, graceful: boolean = true): Promise<void> {
    const process = this.processes.get(serverId);
    if (!process) {
      throw new Error(`Server ${serverId} is not running`);
    }

    const status = this.session.managedServers.get(serverId);
    if (status) {
      status.status = 'stopped';
      this.session.managedServers.set(serverId, status);
    }

    this.clearHealthCheck(serverId);

    if (graceful) {
      process.kill('SIGTERM');
      // Wait for graceful shutdown
      await this.sleep(5000);
    }

    // Force kill if still running
    if (!process.killed) {
      process.kill('SIGKILL');
    }

    this.processes.delete(serverId);
  }

  /**
   * Restart a server
   */
  private async restartServer(serverId: string, graceful: boolean = true): Promise<void> {
    const config = this.defaultConfigs.get(serverId);
    if (!config) {
      throw new Error(`Unknown server ID: ${serverId}`);
    }

    // Stop if running
    if (this.processes.has(serverId)) {
      await this.stopServer(serverId, graceful);
    }

    // Wait a bit
    await this.sleep(2000);

    // Start again
    await this.launchServer(config);
  }

  /**
   * Launch all default servers
   */
  private async launchAllServers(healthCheck: boolean = true): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    for (const [serverId, config] of this.defaultConfigs) {
      try {
        const result = await this.launchServer(config);
        results[serverId] = {
          success: true,
          ...result,
          name: config.name,
          port: config.port
        };
      } catch (error) {
        results[serverId] = {
          success: false,
          error: this.getErrorMessage(error),
          name: config.name,
          port: config.port
        };
      }
    }

    if (healthCheck) {
      // Wait for servers to start
      await this.sleep(5000);
      
      try {
        const healthResults = await this.healthCheckAllServers();
        return { ...results, healthCheck: healthResults };
      } catch (error) {
        return { ...results, healthCheckError: this.getErrorMessage(error) };
      }
    }

    return results;
  }

  /**
   * Get status of a specific server
   */
  private getServerStatus(serverId: string): ServerStatus {
    const status = this.session.managedServers.get(serverId);
    if (!status) {
      throw new Error(`Server ${serverId} not found`);
    }

    // Update uptime
    if (status.startTime) {
      status.uptime = Date.now() - status.startTime;
    }

    return { ...status };
  }

  /**
   * Get status of all servers
   */
  private getAllServerStatus(): Record<string, ServerStatus> {
    const allStatus: Record<string, ServerStatus> = {};
    
    for (const [serverId, status] of this.session.managedServers) {
      // Update uptime
      if (status.startTime) {
        status.uptime = Date.now() - status.startTime;
      }
      allStatus[serverId] = { ...status };
    }

    return allStatus;
  }

  /**
   * Health check a specific server
   */
  private async healthCheckServer(serverId: string): Promise<any> {
    const status = this.session.managedServers.get(serverId);
    if (!status) {
      throw new Error(`Server ${serverId} not found`);
    }

    try {
      const response = await axios.get(`http://localhost:${status.port}/health`, {
        timeout: 5000
      });

      status.lastHealthCheck = Date.now();
      this.session.managedServers.set(serverId, status);

      return {
        serverId,
        name: status.name,
        status: 'healthy',
        response: response.data,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        serverId,
        name: status.name,
        status: 'unhealthy',
        error: this.getErrorMessage(error),
        timestamp: Date.now()
      };
    }
  }

  /**
   * Health check all servers
   */
  private async healthCheckAllServers(): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    for (const serverId of this.session.managedServers.keys()) {
      try {
        results[serverId] = await this.healthCheckServer(serverId);
      } catch (error) {
        results[serverId] = {
          serverId,
          status: 'error',
          error: this.getErrorMessage(error),
          timestamp: Date.now()
        };
      }
    }

    this.session.lastGlobalCheck = Date.now();
    
    // Update global health status
    const healthyCount = Object.values(results).filter(r => r.status === 'healthy').length;
    const totalCount = Object.keys(results).length;
    
    if (healthyCount === totalCount) {
      this.session.globalHealthStatus = 'healthy';
    } else if (healthyCount > 0) {
      this.session.globalHealthStatus = 'degraded';
    } else {
      this.session.globalHealthStatus = 'failed';
    }

    return results;
  }

  /**
   * Get current session for external access
   */
  getSession(): LaunchSession {
    return { 
      ...this.session,
      managedServers: new Map(this.session.managedServers)
    };
  }

  /**
   * Utility: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Utility: Check if a port is available
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    try {
      await axios.get(`http://localhost:${port}/health`, { timeout: 1000 });
      return false; // Port is occupied
    } catch {
      return true; // Port is available
    }
  }

  /**
   * Utility: Check if port is occupied by one of our managed servers
   */
  private async isPortOccupiedByManagedServer(port: number): Promise<string | null> {
    try {
      const response = await axios.get(`http://localhost:${port}/health`, { timeout: 1000 });
      const healthData = response.data;
      
      // Check if response matches any of our managed servers
      for (const [serverId, status] of this.session.managedServers) {
        if (status.port === port && 
            (healthData.server === serverId || healthData.name === status.name)) {
          return serverId;
        }
      }
      
      // Check against default configs
      for (const [serverId, config] of this.defaultConfigs) {
        if (config.port === port && 
            (healthData.server === serverId || healthData.name === config.name)) {
          return serverId;
        }
      }
      
      return null; // Port occupied by unknown server
    } catch {
      return null; // Port is available or unreachable
    }
  }

  /**
   * Shutdown all managed servers
   */
  async shutdown(): Promise<void> {
    logger.info('MCP Launcher: Shutting down all managed servers');

    // Clear all health checks
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();

    // Stop all processes
    for (const [serverId, process] of this.processes) {
      try {
        await this.stopServer(serverId, true);
      } catch (error) {
        Logger.mcpVerbose(`MCP Launcher: Error stopping ${serverId}`, { error });
      }
    }

    await super.shutdown();
  }
}

export default MCPServiceLauncher;

/**
 * CLI entry point - run as standalone MCP server
 */
async function main() {
  console.log(`🚀 Starting MCP Service Launcher on port 3000`);
  
  try {
    const launcher = new MCPServiceLauncher();
    await launcher.start();
    console.log('✅ MCP Service Launcher ready');
    console.log('📡 Waiting for commands...');
  // Keep the process alive regardless of TTY state
  // try { process.stdin.resume(); } catch {} // COMMENTED OUT - This interferes with readline in the game console
    
    // Keep process alive
    process.on('SIGINT', async () => {
      console.log('\n🔄 Received SIGINT, shutting down gracefully...');
      await launcher.shutdown();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n🔄 Received SIGTERM, shutting down gracefully...');
      await launcher.shutdown();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start MCP Service Launcher:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly or flagged as service
if (require.main === module || process.env.RUN_AS_SERVICE === 'true') {
  main();
}
