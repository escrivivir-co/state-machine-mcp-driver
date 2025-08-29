/**
 * CRUD Tools Manager for MCP Servers
 * Provides generic CRUD tools that can be registered by any MCP server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { z } from 'zod';
import { ContentManager } from './ContentManager.js';
import { ResourceDefinition, PromptDefinition } from './ContentDefinitions.js';

/**
 * CRUD Tools Manager
 * Registers generic CRUD tools for prompts and resources
 */
export class CRUDToolsManager {
  private contentManager: ContentManager;
  private server: McpServer;
  private serverName: string;

  constructor(server: McpServer, contentManager: ContentManager, serverName: string) {
    this.server = server;
    this.contentManager = contentManager;
    this.serverName = serverName;
  }

  /**
   * Register all CRUD tools
   */
  registerAllTools(): void {
    this.registerPromptCRUDTools();
    this.registerResourceCRUDTools();
  }

  // ===== PROMPT CRUD TOOLS =====

  private registerPromptCRUDTools(): void {
    // List prompts
    this.server.tool(
      'list_prompts',
      'Listar todos los prompts disponibles en el servidor',
      {
        category: z.string().optional().describe('Filtrar por categoría'),
        search: z.string().optional().describe('Buscar en nombre o descripción')
      },
      async ({ category, search }) => {
        const promptsList = this.contentManager.listPrompts({ category, search });

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

        this.contentManager.addPrompt(prompt);

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
        const updatedPrompt = this.contentManager.updatePrompt(id, {
          name,
          description,
          content,
          parameters,
          metadata
        });

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
        const prompt = this.contentManager.getPrompt(id);
        if (!prompt) {
          throw new Error(`Prompt with ID '${id}' not found`);
        }

        this.contentManager.deletePrompt(id);

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
        const prompt = this.contentManager.getPrompt(id);
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
  }

  // ===== RESOURCE CRUD TOOLS =====

  private registerResourceCRUDTools(): void {
    // List resources
    this.server.tool(
      'list_resources',
      'Listar todos los recursos disponibles en el servidor',
      {
        category: z.string().optional().describe('Filtrar por categoría'),
        search: z.string().optional().describe('Buscar en nombre o descripción')
      },
      async ({ category, search }) => {
        const resourcesList = this.contentManager.listResources({ category, search });

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

        this.contentManager.addResource(resource);

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
        const updatedResource = this.contentManager.updateResource(id, {
          name,
          description,
          content,
          metadata
        });

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
        const resource = this.contentManager.getResource(id);
        if (!resource) {
          throw new Error(`Resource with ID '${id}' not found`);
        }

        this.contentManager.deleteResource(id);

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
        const resource = this.contentManager.getResource(id);
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
  }
}
