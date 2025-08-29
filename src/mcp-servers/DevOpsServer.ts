/**
 * DevOps MCP Server
 * Provides DevOps automation tools, resources, and prompts management
 * Includes CRUD operations for prompts and resources
 * NEW: Plugin system for modular functionality
 */

import { z } from 'zod';
import { BaseMCPServer, MCPServerConfig } from './BaseMCPServer.js';
import { MCPDriverAdapter } from '../drivers/MCPDriverAdapter.js';
import { Logger } from '../utils/logger.js';
import { DevOpsPluginManager } from './plugins/DevOpsPluginManager.js';
import { XPlus1ControlPlugin } from './plugins/XPlus1ControlPlugin.js';
import { PluginContext } from './plugins/IDevOpsPlugin.js';

/**
 * Resource definition interface
 */
interface ResourceDefinition {
  id: string;
  name: string;
  description: string;
  uri: string;
  mimeType: string;
  content: string;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

/**
 * Prompt definition interface
 */
interface PromptDefinition {
  id: string;
  name: string;
  description: string;
  parameters?: Record<string, any>;
  content: string;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

/**
 * DevOps MCP Server
 * Provides DevOps automation and management capabilities
 * NEW: Plugin system for modular functionality
 */
export class DevOpsServer extends BaseMCPServer {
  private resources: Map<string, ResourceDefinition> = new Map();
  private prompts: Map<string, PromptDefinition> = new Map();
  private mcpAdapter?: MCPDriverAdapter;
  private pluginManager?: DevOpsPluginManager;

  constructor() {
    const config: MCPServerConfig = {
      name: 'devops-mcp-server',
      version: '1.0.0',
      description: 'DevOps automation and management server with CRUD capabilities and plugin system',
      port: 3003,
      capabilities: {
        tools: true,
        resources: true,
        prompts: true,
      },
    };

    super(config);
    // Initialize MCP adapter for connecting to other servers
    this.initializeMCPAdapter();
    // Initialize plugin system
    this.initializePluginSystem();
    // Initialize default content will be called in setupServerSpecifics
  }

  /**
   * Initialize MCP Driver Adapter for connecting to other servers
   */
  private initializeMCPAdapter(): void {
    try {
      this.mcpAdapter = new MCPDriverAdapter({
        useNativeProtocol: process.env.MCP_USE_NATIVE_PROTOCOL === 'true',
        enableFallback: true
      });

      // Add default MCP servers that might be running
      this.setupMCPConnections();
      
      Logger.mcpVerbose('DevOps: MCP Adapter initialized');
    } catch (error) {
      Logger.mcpError('DevOps: Failed to initialize MCP Adapter', { error });
      this.mcpAdapter = undefined;
    }
  }

  /**
   * Setup connections to other MCP servers
   */
  private async setupMCPConnections(): Promise<void> {
    if (!this.mcpAdapter) return;

    const mcpServers = [
      {
        id: 'xplus1-mcp-machine',
        name: 'X+1 MCP Machine',
        url: 'http://localhost:3001',
        timeout: 5000,
        maxRetries: 2
      },
      {
        id: 'wiki-mcp-browser',
        name: 'Wiki MCP Browser',
        url: 'http://localhost:3002',
        timeout: 5000,
        maxRetries: 2
      },
      {
        id: 'mcp-service-launcher',
        name: 'MCP Service Launcher',
        url: 'http://localhost:3000',
        timeout: 5000,
        maxRetries: 2
      }
    ];

    for (const server of mcpServers) {
      try {
        await this.mcpAdapter.addServer(server);
        Logger.mcpVerbose(`DevOps: Connected to ${server.name}`, { serverId: server.id });
      } catch (error) {
        Logger.mcpVerbose(`DevOps: Could not connect to ${server.name}`, { error });
      }
    }
  }

  /**
   * Initialize Plugin System
   * Sets up the plugin manager and loads default plugins
   */
  private initializePluginSystem(): void {
    try {
      // Create plugin context
      const pluginContext: Omit<PluginContext, 'config'> = {
        server: this.server,
        mcpAdapter: this.mcpAdapter,
        log: (level, message, data) => {
          switch (level) {
            case 'info': Logger.mcpInfo(message, data); break;
            case 'warn': Logger.mcpWarn(message, data); break;
            case 'error': Logger.mcpError(message, data); break;
            case 'debug': Logger.mcpVerbose(message, data); break;
          }
        }
      };

      // Initialize plugin manager
      this.pluginManager = new DevOpsPluginManager(pluginContext);

      // Register default plugins
      this.registerDefaultPlugins();

      Logger.mcpInfo('DevOps: Plugin system initialized');
    } catch (error) {
      Logger.mcpError('DevOps: Failed to initialize plugin system', { error });
      this.pluginManager = undefined;
    }
  }

  /**
   * Register default plugins
   */
  private async registerDefaultPlugins(): Promise<void> {
    if (!this.pluginManager) return;

    try {
      // Register XPlus1 Control Plugin
      const xplus1Plugin = new XPlus1ControlPlugin();
      await this.pluginManager.registerPlugin(xplus1Plugin, {
        forceEnable: true, // Enable by default
        customSettings: {
          priority: 'high',
          autoLoad: true
        }
      });

      Logger.mcpInfo('DevOps: Default plugins registered');
    } catch (error) {
      Logger.mcpError('DevOps: Failed to register default plugins', { error });
    }
  }

  /**
   * Initialize default resources and prompts
   */
  private initializeDefaultContent(): void {
    // Initialize default DevOps prompts
    this.addPrompt({
      id: 'start-system',
      name: 'Arrancar el sistema',
      description: 'Prompt para arrancar el sistema usando npm start',
      content: `🚀 **Sistema de Arranque**

Por favor, utiliza las herramientas base de VS Code para ejecutar el comando \`npm start\` en el terminal del proyecto.

**Pasos recomendados:**
1. Abre el terminal integrado de VS Code (Ctrl+\`)
2. Asegúrate de estar en el directorio raíz del proyecto
3. Ejecuta: \`npm start\`
4. Monitorea la salida para verificar que el sistema arranque correctamente

**Información del contexto:**
- Proyecto: state-machine-mcp-driver
- Script principal: npm start
- Puerto esperado: Verificar logs de arranque

¿Necesitas ayuda con algún paso específico del arranque del sistema?`,
      parameters: {
        projectPath: z.string().optional().describe('Ruta del proyecto'),
        environment: z.string().optional().describe('Entorno de ejecución')
      },
      metadata: {
        category: 'devops',
        priority: 'high'
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    this.addPrompt({
      id: 'open-web-console',
      name: 'Abrir consola web',
      description: 'Prompt para abrir la consola web en localhost:8080',
      content: `🌐 **Consola Web**

Por favor, abre el navegador simple de VS Code para acceder a la consola web del sistema.

**URL objetivo:** http://localhost:8080

**Pasos recomendados:**
1. Usa la herramienta de navegador simple de VS Code
2. Navega a: http://localhost:8080
3. Verifica que la aplicación web esté respondiendo correctamente

**Si el puerto 8080 no está disponible, verifica:**
- Que el sistema esté ejecutándose correctamente
- Los logs del servidor para identificar el puerto real
- Configuración de puertos en package.json o variables de entorno

¿El navegador web está funcionando correctamente?`,
      parameters: {
        port: z.number().optional().describe('Puerto del servidor web'),
        host: z.string().optional().describe('Host del servidor')
      },
      metadata: {
        category: 'devops',
        priority: 'medium'
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    // Initialize default resources
    this.addResource({
      id: 'project-status',
      name: 'Estado del Proyecto',
      description: 'Estado actual del proyecto y servicios',
      uri: 'devops://project/status',
      mimeType: 'application/json',
      content: JSON.stringify({
        projectName: 'state-machine-mcp-driver',
        status: 'initialized',
        services: [],
        lastCheck: new Date().toISOString()
      }, null, 2),
      metadata: {
        category: 'status',
        updateInterval: '30s'
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    this.addResource({
      id: 'npm-scripts',
      name: 'Scripts NPM Disponibles',
      description: 'Lista de scripts NPM disponibles en el proyecto',
      uri: 'devops://npm/scripts',
      mimeType: 'application/json',
      content: JSON.stringify({
        availableScripts: [
          'npm start',
          'npm run dev',
          'npm run build',
          'npm test',
          'npm run launcher',
          'npm run cleannode'
        ],
        recommended: 'npm start',
        description: 'Scripts principales para el desarrollo y despliegue'
      }, null, 2),
      metadata: {
        category: 'documentation',
        source: 'package.json'
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    // Add dynamic resources that query live game state
    this.setupDynamicResources();
  }

  /**
   * Setup DevOps specific tools, resources, and prompts
   */
  protected setupServerSpecifics(): void {
    this.initializeDefaultContent();
    this.setupTools();
    // Initialize plugins after core tools are setup
    this.initializePlugins();
  }

  /**
   * Initialize all registered plugins
   */
  private async initializePlugins(): Promise<void> {
    if (this.pluginManager) {
      try {
        await this.pluginManager.initializeAllPlugins();
        Logger.mcpInfo('DevOps: All plugins initialized');
      } catch (error) {
        Logger.mcpError('DevOps: Failed to initialize plugins', { error });
      }
    }
  }

  /**
   * Setup dynamic resources that query live game state
   */
  private setupDynamicResources(): void {
    // Live game state resource
    this.server.resource(
      'live-game-state',
      'devops://game/state/live',
      {
        name: 'Estado del Juego en Tiempo Real',
        description: 'Estado actual del juego X+1 consultado dinámicamente via MCP',
        mimeType: 'application/json'
      },
      async () => {
        try {
          const gameState = await this.queryLiveGameState();
          return {
            contents: [{
              uri: 'devops://game/state/live',
              mimeType: 'application/json',
              text: JSON.stringify(gameState, null, 2)
            }]
          };
        } catch (error) {
          return {
            contents: [{
              uri: 'devops://game/state/live',
              mimeType: 'application/json',
              text: JSON.stringify({
                error: 'Failed to query live game state',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
                available: false
              }, null, 2)
            }]
          };
        }
      }
    );

    // Runtime statistics resource
    this.server.resource(
      'runtime-stats',
      'devops://runtime/statistics',
      {
        name: 'Estadísticas del Runtime',
        description: 'Estadísticas detalladas del runtime del juego',
        mimeType: 'application/json'
      },
      async () => {
        try {
          const stats = await this.queryRuntimeStatistics();
          return {
            contents: [{
              uri: 'devops://runtime/statistics',
              mimeType: 'application/json',
              text: JSON.stringify(stats, null, 2)
            }]
          };
        } catch (error) {
          return {
            contents: [{
              uri: 'devops://runtime/statistics',
              mimeType: 'application/json',
              text: JSON.stringify({
                error: 'Failed to query runtime statistics',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
              }, null, 2)
            }]
          };
        }
      }
    );

    // MCP servers health resource
    this.server.resource(
      'mcp-servers-health',
      'devops://mcp/health',
      {
        name: 'Estado de Servidores MCP',
        description: 'Estado de salud de todos los servidores MCP',
        mimeType: 'application/json'
      },
      async () => {
        try {
          const health = await this.queryMCPServersHealth();
          return {
            contents: [{
              uri: 'devops://mcp/health',
              mimeType: 'application/json',
              text: JSON.stringify(health, null, 2)
            }]
          };
        } catch (error) {
          return {
            contents: [{
              uri: 'devops://mcp/health',
              mimeType: 'application/json',
              text: JSON.stringify({
                error: 'Failed to query MCP servers health',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
              }, null, 2)
            }]
          };
        }
      }
    );

    // Agents status resource
    this.server.resource(
      'agents-status',
      'devops://game/agents',
      {
        name: 'Estado de los Agentes',
        description: 'Estado actual de todos los agentes del juego',
        mimeType: 'application/json'
      },
      async () => {
        try {
          const agents = await this.queryAgentsStatus();
          return {
            contents: [{
              uri: 'devops://game/agents',
              mimeType: 'application/json',
              text: JSON.stringify(agents, null, 2)
            }]
          };
        } catch (error) {
          return {
            contents: [{
              uri: 'devops://game/agents',
              mimeType: 'application/json',
              text: JSON.stringify({
                error: 'Failed to query agents status',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
              }, null, 2)
            }]
          };
        }
      }
    );
  }

  /**
   * Setup DevOps tools including CRUD operations
   */
  private setupTools(): void {
    // ===== PROMPT CRUD TOOLS =====
    
    // List prompts
    this.server.tool(
      'list_prompts',
      'Listar todos los prompts disponibles en el servidor',
      {
        category: z.string().optional().describe('Filtrar por categoría'),
        search: z.string().optional().describe('Buscar en nombre o descripción')
      },
      async ({ category, search }) => {
        const promptsList = Array.from(this.prompts.values()).filter(prompt => {
          if (category && (!prompt.metadata?.category || prompt.metadata.category !== category)) {
            return false;
          }
          if (search && !prompt.name.toLowerCase().includes(search.toLowerCase()) && 
              !prompt.description.toLowerCase().includes(search.toLowerCase())) {
            return false;
          }
          return true;
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              total: promptsList.length,
              prompts: promptsList.map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                category: p.metadata?.category || 'general',
                updatedAt: new Date(p.updatedAt).toISOString()
              }))
            }, null, 2)
          }]
        };
      }
    );

    // Add prompt
    this.server.tool(
      'add_prompt',
      'Añadir un nuevo prompt al servidor',
      {
        id: z.string().describe('ID único del prompt'),
        name: z.string().describe('Nombre del prompt'),
        description: z.string().describe('Descripción del prompt'),
        content: z.string().describe('Contenido del prompt'),
        parameters: z.record(z.any()).optional().describe('Parámetros del prompt'),
        metadata: z.record(z.any()).optional().describe('Metadatos adicionales')
      },
      async ({ id, name, description, content, parameters, metadata }) => {
        if (this.prompts.has(id)) {
          throw new Error(`Prompt with ID '${id}' already exists`);
        }

        const prompt: PromptDefinition = {
          id,
          name,
          description,
          content,
          parameters,
          metadata,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        this.addPrompt(prompt);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Prompt '${name}' added successfully`,
              id,
              createdAt: new Date(prompt.createdAt).toISOString()
            }, null, 2)
          }]
        };
      }
    );

    // Edit prompt
    this.server.tool(
      'edit_prompt',
      'Editar un prompt existente',
      {
        id: z.string().describe('ID del prompt a editar'),
        name: z.string().optional().describe('Nuevo nombre'),
        description: z.string().optional().describe('Nueva descripción'),
        content: z.string().optional().describe('Nuevo contenido'),
        parameters: z.record(z.any()).optional().describe('Nuevos parámetros'),
        metadata: z.record(z.any()).optional().describe('Nuevos metadatos')
      },
      async ({ id, name, description, content, parameters, metadata }) => {
        const prompt = this.prompts.get(id);
        if (!prompt) {
          throw new Error(`Prompt with ID '${id}' not found`);
        }

        const updatedPrompt: PromptDefinition = {
          ...prompt,
          name: name ?? prompt.name,
          description: description ?? prompt.description,
          content: content ?? prompt.content,
          parameters: parameters ?? prompt.parameters,
          metadata: metadata ?? prompt.metadata,
          updatedAt: Date.now()
        };

        this.prompts.set(id, updatedPrompt);
        this.updatePromptHandler(updatedPrompt);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Prompt '${id}' updated successfully`,
              updatedAt: new Date(updatedPrompt.updatedAt).toISOString()
            }, null, 2)
          }]
        };
      }
    );

    // Delete prompt
    this.server.tool(
      'delete_prompt',
      'Eliminar un prompt del servidor',
      {
        id: z.string().describe('ID del prompt a eliminar')
      },
      async ({ id }) => {
        const prompt = this.prompts.get(id);
        if (!prompt) {
          throw new Error(`Prompt with ID '${id}' not found`);
        }

        this.prompts.delete(id);
        // Remove from server handlers
        const promptHandlers = (this.server as any)._promptHandlers;
        if (promptHandlers) {
          promptHandlers.delete(id);
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Prompt '${prompt.name}' deleted successfully`,
              deletedAt: new Date().toISOString()
            }, null, 2)
          }]
        };
      }
    );

    // Get prompt
    this.server.tool(
      'get_prompt',
      'Recuperar un prompt específico por ID',
      {
        id: z.string().describe('ID del prompt a recuperar')
      },
      async ({ id }) => {
        const prompt = this.prompts.get(id);
        if (!prompt) {
          throw new Error(`Prompt with ID '${id}' not found`);
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(prompt, null, 2)
          }]
        };
      }
    );

    // ===== RESOURCE CRUD TOOLS =====

    // List resources
    this.server.tool(
      'list_resources',
      'Listar todos los recursos disponibles en el servidor',
      {
        category: z.string().optional().describe('Filtrar por categoría'),
        search: z.string().optional().describe('Buscar en nombre o descripción')
      },
      async ({ category, search }) => {
        const resourcesList = Array.from(this.resources.values()).filter(resource => {
          if (category && (!resource.metadata?.category || resource.metadata.category !== category)) {
            return false;
          }
          if (search && !resource.name.toLowerCase().includes(search.toLowerCase()) && 
              !resource.description.toLowerCase().includes(search.toLowerCase())) {
            return false;
          }
          return true;
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              total: resourcesList.length,
              resources: resourcesList.map(r => ({
                id: r.id,
                name: r.name,
                description: r.description,
                uri: r.uri,
                mimeType: r.mimeType,
                category: r.metadata?.category || 'general',
                updatedAt: new Date(r.updatedAt).toISOString()
              }))
            }, null, 2)
          }]
        };
      }
    );

    // Add resource
    this.server.tool(
      'add_resource',
      'Añadir un nuevo recurso al servidor',
      {
        id: z.string().describe('ID único del recurso'),
        name: z.string().describe('Nombre del recurso'),
        description: z.string().describe('Descripción del recurso'),
        uri: z.string().describe('URI del recurso'),
        mimeType: z.string().describe('Tipo MIME del recurso'),
        content: z.string().describe('Contenido del recurso'),
        metadata: z.record(z.any()).optional().describe('Metadatos adicionales')
      },
      async ({ id, name, description, uri, mimeType, content, metadata }) => {
        if (this.resources.has(id)) {
          throw new Error(`Resource with ID '${id}' already exists`);
        }

        const resource: ResourceDefinition = {
          id,
          name,
          description,
          uri,
          mimeType,
          content,
          metadata,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        this.addResource(resource);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Resource '${name}' added successfully`,
              id,
              uri,
              createdAt: new Date(resource.createdAt).toISOString()
            }, null, 2)
          }]
        };
      }
    );

    // Edit resource
    this.server.tool(
      'edit_resource',
      'Editar un recurso existente',
      {
        id: z.string().describe('ID del recurso a editar'),
        name: z.string().optional().describe('Nuevo nombre'),
        description: z.string().optional().describe('Nueva descripción'),
        content: z.string().optional().describe('Nuevo contenido'),
        metadata: z.record(z.any()).optional().describe('Nuevos metadatos')
      },
      async ({ id, name, description, content, metadata }) => {
        const resource = this.resources.get(id);
        if (!resource) {
          throw new Error(`Resource with ID '${id}' not found`);
        }

        const updatedResource: ResourceDefinition = {
          ...resource,
          name: name ?? resource.name,
          description: description ?? resource.description,
          content: content ?? resource.content,
          metadata: metadata ?? resource.metadata,
          updatedAt: Date.now()
        };

        this.resources.set(id, updatedResource);
        this.updateResourceHandler(updatedResource);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Resource '${id}' updated successfully`,
              updatedAt: new Date(updatedResource.updatedAt).toISOString()
            }, null, 2)
          }]
        };
      }
    );

    // Delete resource
    this.server.tool(
      'delete_resource',
      'Eliminar un recurso del servidor',
      {
        id: z.string().describe('ID del recurso a eliminar')
      },
      async ({ id }) => {
        const resource = this.resources.get(id);
        if (!resource) {
          throw new Error(`Resource with ID '${id}' not found`);
        }

        this.resources.delete(id);
        // Remove from server handlers
        const resourceHandlers = (this.server as any)._resourceHandlers;
        if (resourceHandlers) {
          resourceHandlers.delete(id);
          resourceHandlers.delete(resource.uri);
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Resource '${resource.name}' deleted successfully`,
              deletedAt: new Date().toISOString()
            }, null, 2)
          }]
        };
      }
    );

    // Get resource
    this.server.tool(
      'get_resource',
      'Recuperar un recurso específico por ID',
      {
        id: z.string().describe('ID del recurso a recuperar')
      },
      async ({ id }) => {
        const resource = this.resources.get(id);
        if (!resource) {
          throw new Error(`Resource with ID '${id}' not found`);
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(resource, null, 2)
          }]
        };
      }
    );

    // ===== DEVOPS SPECIFIC TOOLS =====

    // Start system tool
    this.server.tool(
      'start_system',
      'Arrancar el sistema usando npm start',
      {
        environment: z.string().optional().describe('Entorno de ejecución'),
        verbose: z.boolean().optional().describe('Salida detallada')
      },
      async ({ environment, verbose }) => {
        Logger.mcpVerbose('DevOps: Starting system via npm start');

        const instructions = {
          action: 'start_system',
          command: 'npm start',
          environment: environment || 'development',
          steps: [
            'Open VS Code integrated terminal (Ctrl+`)',
            'Navigate to project root directory',
            'Execute: npm start',
            'Monitor output for successful startup',
            'Check for port information in logs'
          ],
          expectedResult: 'System should start on configured port',
          troubleshooting: [
            'Verify package.json exists',
            'Check node_modules are installed (npm install)',
            'Ensure no port conflicts',
            'Check system dependencies'
          ]
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(instructions, null, 2)
          }]
        };
      }
    );

    // Open web console tool
    this.server.tool(
      'open_web_console',
      'Abrir la consola web en el navegador',
      {
        port: z.number().optional().describe('Puerto del servidor web').default(8080),
        host: z.string().optional().describe('Host del servidor').default('localhost')
      },
      async ({ port = 8080, host = 'localhost' }) => {
        const url = `http://${host}:${port}`;
        Logger.mcpVerbose(`DevOps: Opening web console at ${url}`);

        const instructions = {
          action: 'open_web_console',
          url,
          steps: [
            'Use VS Code Simple Browser or external browser',
            `Navigate to: ${url}`,
            'Verify application is responding',
            'Check console for any errors'
          ],
          alternatives: [
            'Try different ports if 8080 is not available',
            'Check server logs for actual port',
            'Verify server is running before opening browser'
          ],
          vsCodeCommand: 'Simple Browser: Show',
          expectedResult: 'Web application should load successfully'
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(instructions, null, 2)
          }]
        };
      }
    );
  }

  /**
   * Setup resource handlers for dynamic resources
   */
  private setupResourceHandlers(): void {
    // Setup handlers for all existing resources
    for (const resource of this.resources.values()) {
      this.setupResourceHandler(resource);
    }
  }

  /**
   * Setup a resource handler for a specific resource
   */
  private setupResourceHandler(resource: ResourceDefinition): void {
    this.server.resource(
      resource.id,
      resource.uri,
      {
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType
      },
      async () => {
        return {
          contents: [{
            uri: resource.uri,
            mimeType: resource.mimeType,
            text: resource.content
          }]
        };
      }
    );
  }

  /**
   * Setup prompt handlers for dynamic prompts
   */
  private setupPromptHandlers(): void {
    // Setup handlers for all existing prompts
    for (const prompt of this.prompts.values()) {
      this.setupPromptHandler(prompt);
    }
  }

  /**
   * Setup a prompt handler for a specific prompt
   */
  private setupPromptHandler(prompt: PromptDefinition): void {
    this.server.prompt(
      prompt.id,
      prompt.description,
      prompt.parameters || {},
      async (variables) => {
        let content = prompt.content;
        
        // Simple variable substitution
        if (variables && typeof variables === 'object') {
          for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{{${key}}}`;
            content = content.replace(new RegExp(placeholder, 'g'), String(value));
          }
        }

        return {
          messages: [{
            role: 'user',
            content: {
              type: 'text',
              text: content
            }
          }]
        };
      }
    );

    // ===== PLUGIN MANAGEMENT TOOLS =====

    // List plugins
    this.server.tool(
      'list_plugins',
      'List all registered plugins and their status',
      {},
      async () => {
        if (!this.pluginManager) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'Plugin system not initialized',
                plugins: []
              }, null, 2)
            }]
          };
        }

        const plugins = this.pluginManager.getRegisteredPlugins();
        const status = await this.pluginManager.getAllPluginStatus();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              total: plugins.length,
              plugins: plugins.map(plugin => ({
                ...plugin,
                status: status[plugin.id]
              }))
            }, null, 2)
          }]
        };
      }
    );

    // Execute plugin command
    this.server.tool(
      'execute_plugin_command',
      'Execute a command on a specific plugin',
      {
        pluginId: z.string().describe('Plugin ID to execute command on'),
        command: z.string().describe('Command to execute'),
        params: z.record(z.any()).optional().describe('Command parameters')
      },
      async ({ pluginId, command, params }: { pluginId: string; command: string; params?: Record<string, any> }) => {
        if (!this.pluginManager) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Plugin system not initialized'
              }, null, 2)
            }]
          };
        }

        try {
          const result = await this.pluginManager.executePluginCommand(pluginId, command, params || {});
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error)
              }, null, 2)
            }]
          };
        }
      }
    );

    // Enable/disable plugin
    this.server.tool(
      'set_plugin_enabled',
      'Enable or disable a specific plugin',
      {
        pluginId: z.string().describe('Plugin ID to enable/disable'),
        enabled: z.boolean().describe('Enable (true) or disable (false) the plugin')
      },
      async ({ pluginId, enabled }: { pluginId: string; enabled: boolean }) => {
        if (!this.pluginManager) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Plugin system not initialized'
              }, null, 2)
            }]
          };
        }

        try {
          await this.pluginManager.setPluginEnabled(pluginId, enabled);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Plugin ${pluginId} ${enabled ? 'enabled' : 'disabled'}`,
                pluginId,
                enabled
              }, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error)
              }, null, 2)
            }]
          };
        }
      }
    );
  }

  /**
   * Add a new prompt and setup its handler
   */
  private addPrompt(prompt: PromptDefinition): void {
    this.prompts.set(prompt.id, prompt);
    this.setupPromptHandler(prompt);
  }

  /**
   * Add a new resource and setup its handler
   */
  private addResource(resource: ResourceDefinition): void {
    this.resources.set(resource.id, resource);
    this.setupResourceHandler(resource);
  }

  /**
   * Update prompt handler after editing
   */
  private updatePromptHandler(prompt: PromptDefinition): void {
    // Remove old handler
    const promptHandlers = (this.server as any)._promptHandlers;
    if (promptHandlers) {
      promptHandlers.delete(prompt.id);
    }
    
    // Add updated handler
    this.setupPromptHandler(prompt);
  }

  /**
   * Update resource handler after editing
   */
  private updateResourceHandler(resource: ResourceDefinition): void {
    // Remove old handlers
    const resourceHandlers = (this.server as any)._resourceHandlers;
    if (resourceHandlers) {
      resourceHandlers.delete(resource.id);
      resourceHandlers.delete(resource.uri);
    }
    
    // Add updated handler
    this.setupResourceHandler(resource);
  }

  // ===== LIVE GAME STATE QUERY METHODS =====

  /**
   * Query live game state from X+1 MCP Machine
   */
  private async queryLiveGameState(): Promise<any> {
    if (!this.mcpAdapter) {
      throw new Error('MCP Adapter not initialized');
    }

    try {
      // Get X value and status
      const xStatus = await this.mcpAdapter.executeTool(
        'xplus1-mcp-machine',
        'get_x_status',
        {}
      );

      // Get current game state
      const fullGameState = await this.mcpAdapter.executeTool(
        'xplus1-mcp-machine',
        'get_full_game_state',
        {}
      );

      // Get UI status
      const uiStatus = await this.mcpAdapter.executeTool(
        'xplus1-mcp-machine',
        'get_ui_status',
        {}
      );

      // Get interaction state
      const interactionState = await this.mcpAdapter.executeTool(
        'xplus1-mcp-machine',
        'get_interaction_state',
        {}
      );

      return {
        timestamp: new Date().toISOString(),
        serverId: 'xplus1-mcp-machine',
        gameState: {
          x: xStatus?.content?.[0]?.text || 'Unknown',
          fullState: fullGameState?.content?.[0]?.text || 'Unknown',
          uiStatus: uiStatus?.content?.[0]?.text || 'Unknown',
          interaction: interactionState?.content?.[0]?.text || 'Unknown'
        },
        available: true,
        lastUpdate: Date.now()
      };

    } catch (error) {
      Logger.mcpError('DevOps: Failed to query live game state', { error });
      throw error;
    }
  }

  /**
   * Query runtime statistics if available
   */
  private async queryRuntimeStatistics(): Promise<any> {
    if (!this.mcpAdapter) {
      throw new Error('MCP Adapter not initialized');
    }

    try {
      // Since the Runtime is typically embedded in the application,
      // we'll try to get statistics from the X+1 machine server
      const consoleOutput = await this.mcpAdapter.executeTool(
        'xplus1-mcp-machine',
        'get_console_output',
        {}
      );

      const conversationThread = await this.mcpAdapter.executeTool(
        'xplus1-mcp-machine',
        'get_current_conversation',
        {}
      );

      // Calculate some basic statistics
      const statistics = {
        timestamp: new Date().toISOString(),
        serverAvailable: true,
        gameMetrics: {
          consoleOutput: consoleOutput?.content?.[0]?.text || 'Not available',
          conversationThread: conversationThread?.content?.[0]?.text || 'Not available'
        },
        performance: {
          responseTime: Date.now(), // Simple timestamp
          serverStatus: 'active'
        }
      };

      return statistics;

    } catch (error) {
      Logger.mcpError('DevOps: Failed to query runtime statistics', { error });
      throw error;
    }
  }

  /**
   * Query MCP servers health status
   */
  private async queryMCPServersHealth(): Promise<any> {
    if (!this.mcpAdapter) {
      throw new Error('MCP Adapter not initialized');
    }

    const healthResults: Record<string, any> = {};
    const servers = ['xplus1-mcp-machine', 'wiki-mcp-browser', 'mcp-service-launcher'];

    for (const serverId of servers) {
      try {
        const isHealthy = await this.mcpAdapter.healthCheck(serverId);
        healthResults[serverId] = {
          status: isHealthy ? 'healthy' : 'unhealthy',
          lastCheck: new Date().toISOString(),
          available: true
        };
      } catch (error) {
        healthResults[serverId] = {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          lastCheck: new Date().toISOString(),
          available: false
        };
      }
    }

    // Also query service launcher for more detailed status
    try {
      const serviceStatus = await this.mcpAdapter.executeTool(
        'mcp-service-launcher',
        'get_server_status',
        {}
      );

      healthResults.launcher_detailed = {
        status: 'available',
        details: serviceStatus?.content?.[0]?.text || 'Status not available',
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      healthResults.launcher_detailed = {
        status: 'unavailable',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date().toISOString()
      };
    }

    return {
      timestamp: new Date().toISOString(),
      servers: healthResults,
      summary: {
        total: servers.length,
        healthy: Object.values(healthResults).filter((h: any) => h.status === 'healthy').length,
        unhealthy: Object.values(healthResults).filter((h: any) => h.status !== 'healthy').length
      }
    };
  }

  /**
   * Query agents status from the game
   */
  private async queryAgentsStatus(): Promise<any> {
    if (!this.mcpAdapter) {
      throw new Error('MCP Adapter not initialized');
    }

    try {
      // Get available agents/postulations
      const availableAgents = await this.mcpAdapter.executeTool(
        'xplus1-mcp-machine',
        'get_available_postulations',
        {}
      );

      // Get current conversation to see active agents
      const conversation = await this.mcpAdapter.executeTool(
        'xplus1-mcp-machine',
        'get_current_conversation',
        {}
      );

      // Get interaction state to see what agents are available
      const interactionState = await this.mcpAdapter.executeTool(
        'xplus1-mcp-machine',
        'get_interaction_state',
        {}
      );

      return {
        timestamp: new Date().toISOString(),
        agents: {
          available: availableAgents?.content?.[0]?.text || 'Not available',
          conversation: conversation?.content?.[0]?.text || 'Not available',
          interaction: interactionState?.content?.[0]?.text || 'Not available'
        },
        status: 'active',
        lastUpdate: Date.now()
      };

    } catch (error) {
      Logger.mcpError('DevOps: Failed to query agents status', { error });
      throw error;
    }
  }
}

// Export for standalone execution
export default DevOpsServer;

// Enable standalone execution
if (require.main === module) {
  const server = new DevOpsServer();
  server.start().catch(console.error);
}
