/**
 * Base MCP Server Implementation with HttpStreamable Transport
 * Provides common functionality for all MCP servers using @modelcontextprotocol/sdk
 */

import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { logger } from '../utils/logger';

/**
 * MCP Server Configuration
 */
export interface MCPServerConfig {
  name: string;
  version: string;
  description?: string;
  port: number;
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
}

/**
 * Abstract base class for MCP servers with HttpStreamable transport
 */
export abstract class BaseMCPServer {
  protected server: McpServer;
  protected config: MCPServerConfig;
  protected app: express.Application;

  constructor(config: MCPServerConfig) {
    this.config = config;
    
    // Initialize Express app
    this.app = express();
    this.app.use(express.json());
    
    // Initialize MCP server with capabilities
    this.server = new McpServer(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: config.capabilities?.tools ? {} : undefined,
          resources: config.capabilities?.resources ? {} : undefined,
          prompts: config.capabilities?.prompts ? {} : undefined,
        },
      }
    );

    this.setupExpressRoutes();
  }

  /**
   * Setup Express routes for MCP HTTP transport
   */
  private setupExpressRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        server: this.config.name,
        version: this.config.version,
        timestamp: new Date().toISOString()
      });
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: this.config.name,
        version: this.config.version,
        description: this.config.description || 'MCP Server',
        capabilities: ['tools', 'resources', 'prompts'] // Static capabilities
      });
    });
  }

  /**
   * Abstract method to be implemented by subclasses
   * This is where each server defines its specific tools, resources, and prompts
   */
  protected abstract setupServerSpecifics(): void;

  /**
   * Initialize the server
   */
  async initialize(): Promise<void> {
    logger.info(`${this.config.name}: Initializing MCP server`);
    
    // Let subclass setup its specifics
    this.setupServerSpecifics();
    
    logger.info(`${this.config.name}: Server initialized successfully`);
  }

  /**
   * Start the MCP server with HttpStreamable transport
   */
  async start(): Promise<void> {
    await this.initialize();
    
    // Setup MCP endpoints following the SDK pattern
    this.app.post('/mcp', async (req, res) => {
      try {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });
        await this.server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        
        res.on('close', () => {
          logger.debug(`${this.config.name}: Request closed`);
          transport.close();
          this.server.close();
        });
      } catch (error) {
        logger.error(`${this.config.name}: Error handling MCP request`, { error });
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
      }
    });

    this.app.get('/mcp', async (req, res) => {
      logger.debug(`${this.config.name}: Received GET MCP request`);
      res.writeHead(405).end(JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed."
        },
        id: null
      }));
    });
    
    // Start Express server
    this.app.listen(this.config.port, () => {
      logger.info(`${this.config.name}: MCP server started on port ${this.config.port}`);
      console.log(`✅ ${this.config.name} ready on port ${this.config.port}`);
      console.log('📡 Listening for MCP protocol connections...');
    });
  }

  /**
   * Get the underlying server instance
   */
  getServer(): McpServer {
    return this.server;
  }

  /**
   * Get Express app instance
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * Get server configuration
   */
  getConfig(): MCPServerConfig {
    return { ...this.config };
  }

  /**
   * Shutdown the server gracefully
   */
  async shutdown(): Promise<void> {
    logger.info(`${this.config.name}: Shutting down MCP server`);
    // Add any cleanup logic here
  }
}

export default BaseMCPServer;
