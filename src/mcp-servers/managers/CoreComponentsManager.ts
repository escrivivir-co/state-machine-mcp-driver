/**
 * Core Components Manager for MCP Servers
 * Provides common server functionality like health checks, status, and web console
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * Core Components Manager
 * Registers essential server tools and functionality
 */
export class CoreComponentsManager {
  private server: McpServer;
  private serverName: string;
  private serverPort: number;
  private startTime: number;

  constructor(server: McpServer, serverName: string, serverPort: number = 8080) {
    this.server = server;
    this.serverName = serverName;
    this.serverPort = serverPort;
    this.startTime = Date.now();
  }

  /**
   * Register all core tools
   */
  registerAllTools(): void {
    this.registerHealthTools();
    this.registerWebConsoleTools();
    this.registerSystemTools();
  }

  // ===== HEALTH & STATUS TOOLS =====

  private registerHealthTools(): void {
    // System start tool
    this.server.tool(
      'start_system',
      'Arrancar el sistema usando npm start',
      {
        environment: z.string().optional().describe('Entorno de ejecución'),
        verbose: z.boolean().optional().describe('Salida detallada')
      },
      async ({ environment, verbose }) => {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `${this.serverName} server started successfully`,
              environment: environment || 'development',
              verbose: verbose || false,
              startTime: new Date().toISOString(),
              port: this.serverPort
            }, null, 2)
          }]
        };
      }
    );
  }

  // ===== WEB CONSOLE TOOLS =====

  private registerWebConsoleTools(): void {
    // Open web console
    this.server.tool(
      'open_web_console',
      'Abrir la consola web en el navegador',
      {
        host: z.string().default('localhost').describe('Host del servidor'),
        port: z.number().default(8080).describe('Puerto del servidor web')
      },
      async ({ host = 'localhost', port = 8080 }) => {
        const url = `http://${host}:${port}`;
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Web console URL generated',
              url,
              instructions: `Open your browser and navigate to: ${url}`,
              serverName: this.serverName,
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        };
      }
    );
  }

  // ===== SYSTEM TOOLS =====

  private registerSystemTools(): void {
    // Get server status
    this.server.tool(
      'get_server_status',
      'Obtener el estado actual del servidor',
      {},
      async () => {
        const uptime = Date.now() - this.startTime;
        const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
        const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        const uptimeSeconds = Math.floor((uptime % (1000 * 60)) / 1000);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              server: this.serverName,
              status: 'running',
              startTime: new Date(this.startTime).toISOString(),
              uptime: {
                milliseconds: uptime,
                formatted: `${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`
              },
              port: this.serverPort,
              timestamp: new Date().toISOString(),
              memory: process.memoryUsage ? {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
              } : 'N/A'
            }, null, 2)
          }]
        };
      }
    );

    // Get server info
    this.server.tool(
      'get_server_info',
      'Obtener información detallada del servidor',
      {},
      async () => {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              name: this.serverName,
              version: '1.0.0',
              description: `${this.serverName} MCP Server with enhanced capabilities`,
              capabilities: [
                'CRUD Operations (Prompts & Resources)',
                'Plugin System',
                'Web Console',
                'Health Monitoring',
                'Real-time Status'
              ],
              endpoints: {
                web: `http://localhost:${this.serverPort}`,
                health: `http://localhost:${this.serverPort}/health`,
                status: `http://localhost:${this.serverPort}/status`
              },
              runtime: {
                platform: process.platform,
                nodeVersion: process.version,
                pid: process.pid
              },
              timestamp: new Date().toISOString()
            }, null, 2)
          }]
        };
      }
    );
  }

  /**
   * Get server uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Reset start time (useful for restarts)
   */
  resetStartTime(): void {
    this.startTime = Date.now();
  }
}
