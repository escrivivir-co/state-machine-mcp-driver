/**
 * Base MCP Server Implementation with HttpStreamable Transport
 * Provides common functionality for all MCP servers using @modelcontextprotocol/sdk
 */
// https://docs.anthropic.com/en/docs/mcp
// https://github.com/modelcontextprotocol/servers?tab=readme-ov-file#%EF%B8%8F-official-integrations
// https://modelcontextprotocol.io/examples
//  "@modelcontextprotocol/sdk": "^1.17.4"
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
  // Allow overriding port via environment variable (used by launcher)
  const envPort = process.env.MCP_SERVER_PORT ? parseInt(process.env.MCP_SERVER_PORT, 10) : undefined;
  this.config = { ...config, port: envPort || config.port };
    
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

    // Legacy REST API endpoints for compatibility with MCPDriver
    this.setupLegacyRestAPI();
  }

  /**
   * Setup legacy REST API endpoints for backward compatibility
   */
  private setupLegacyRestAPI(): void {
    // Resources endpoints
    this.app.get('/resources/:resourceId(*)', async (req, res) => {
      try {
        const resourceId = req.params.resourceId;
        // Map legacy path for stategraphs/x-plus-1-game to proper URI when requested
        const requestedId = resourceId;
        let effectiveResourceId = resourceId;
        if (resourceId.startsWith('stategraphs/')) {
          // Keep as-is; downstream matching will handle
        }
        
        // Use MCP server's native resource handling
        const resourceResult = await this.handleResourceRequest(effectiveResourceId);
        
        if (resourceResult && resourceResult.contents && resourceResult.contents.length > 0) {
          const content = resourceResult.contents[0];
          
          // Set appropriate content type
          if (content.mimeType) {
            res.setHeader('Content-Type', content.mimeType);
          }
          
          // Return the resource content
          if (content.text) {
            res.send(content.text);
          } else if (content.blob) {
            res.send(content.blob);
          } else {
            res.json(content);
          }
        } else {
          res.status(404).json({ error: 'Resource not found', resourceId: requestedId });
        }
      } catch (error) {
        logger.error(`${this.config.name}: Error handling resource request:`, error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Tools endpoints
    this.app.post('/tools/:toolName', async (req, res) => {
      try {
        const toolName = req.params.toolName;
        const params = req.body;
        
        // Use MCP server's native tool handling
        const toolResult = await this.handleToolRequest(toolName, params);
        
        if (toolResult) {
          res.json(toolResult);
        } else {
          res.status(404).json({ error: 'Tool not found', toolName });
        }
      } catch (error) {
        logger.error(`${this.config.name}: Error handling tool request:`, error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Prompts endpoints
    this.app.post('/prompts/:promptId', async (req, res) => {
      try {
        const promptId = req.params.promptId;
        const variables = req.body.variables || req.body;
        
        // Use MCP server's native prompt handling
        const promptResult = await this.handlePromptRequest(promptId, variables);
        
        if (promptResult) {
          res.json(promptResult);
        } else {
          res.status(404).json({ error: 'Prompt not found', promptId });
        }
      } catch (error) {
        logger.error(`${this.config.name}: Error handling prompt request:`, error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  /**
   * Handle resource request using MCP server's native methods
   */
  private async handleResourceRequest(resourceId: string): Promise<any> {
    try {
      logger.debug(`${this.config.name}: Handling resource request for: ${resourceId}`);
      
      // Create a minimal MCP request
      const request = {
        method: 'resources/read' as const,
        params: {
          uri: resourceId
        }
      };
      
      // Get resource handlers from the MCP server
      const resourceHandlers = (this.server as any)._resourceHandlers;
      logger.debug(`${this.config.name}: Available resource handlers:`, resourceHandlers ? Array.from(resourceHandlers.keys()) : 'none');
      
      if (resourceHandlers) {
        // Try exact match first
        if (resourceHandlers.has(resourceId)) {
          const handler = resourceHandlers.get(resourceId);
          logger.debug(`${this.config.name}: Found exact match for resource: ${resourceId}`);
          return await handler.callback(request.params);
        }
        
        // Try pattern matching for more complex URIs
        for (const [handlerKey, handler] of resourceHandlers) {
          // Check if the resourceId matches patterns like:
          // stategraphs/x-plus-1-game -> x-plus-1-game-stategraph
          // or stategraphs/x-plus-1-game -> matches URI containing 'x-plus-1-game'
          if (resourceId.includes(handlerKey) || 
              handlerKey.includes(resourceId) ||
              (resourceId.includes('stategraphs/') && handlerKey.includes('stategraph')) ||
              (resourceId.includes('x-plus-1-game') && handlerKey.includes('x-plus-1-game'))) {
            
            logger.debug(`${this.config.name}: Found pattern match: ${resourceId} -> ${handlerKey}`);
            return await handler.callback(request.params);
          }
        }
        
        // If no match found, try to find by URI pattern from handler metadata
        for (const [handlerKey, handler] of resourceHandlers) {
          try {
            // Check if the handler URI matches the requested resourceId
            const handlerUri = handler.description?.uri || '';
            if (handlerUri && (handlerUri.includes(resourceId) || resourceId.includes(handlerUri.split('://')[1] || handlerUri))) {
              logger.debug(`${this.config.name}: Found URI match: ${resourceId} -> ${handlerUri}`);
              return await handler.callback(request.params);
            }
          } catch (error) {
            // Continue to next handler if this one fails
            logger.debug(`${this.config.name}: Handler ${handlerKey} failed, continuing...`);
          }
        }
      }
      
      logger.warn(`${this.config.name}: No resource handler found for: ${resourceId}`);
      return null;
    } catch (error) {
      logger.error(`${this.config.name}: Error in handleResourceRequest:`, error);
      throw error;
    }
  }

  /**
   * Handle tool request using MCP server's native methods
   */
  private async handleToolRequest(toolName: string, params: any): Promise<any> {
    try {
      // Create a minimal MCP request
      const request = {
        method: 'tools/call' as const,
        params: {
          name: toolName,
          arguments: params
        }
      };
      
      // Use server's request handler
      const toolHandlers = (this.server as any)._toolHandlers;
      if (toolHandlers && toolHandlers.has(toolName)) {
        const handler = toolHandlers.get(toolName);
        return await handler.callback(params);
      }
      
      return null;
    } catch (error) {
      logger.error(`${this.config.name}: Error in handleToolRequest:`, error);
      throw error;
    }
  }

  /**
   * Handle prompt request using MCP server's native methods
   */
  private async handlePromptRequest(promptId: string, variables: any): Promise<any> {
    try {
      // Create a minimal MCP request
      const request = {
        method: 'prompts/get' as const,
        params: {
          name: promptId,
          arguments: variables
        }
      };
      
      // Use server's request handler
      const promptHandlers = (this.server as any)._promptHandlers;
      if (promptHandlers && promptHandlers.has(promptId)) {
        const handler = promptHandlers.get(promptId);
        return await handler.callback(variables);
      }
      
      return null;
    } catch (error) {
      logger.error(`${this.config.name}: Error in handlePromptRequest:`, error);
      throw error;
    }
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
  // Connect once per request; do not close the entire server on response end
  await this.server.connect(transport);
  await transport.handleRequest(req, res, req.body);
  // Avoid closing transport/server here to keep process alive; transport will clean up per request
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
