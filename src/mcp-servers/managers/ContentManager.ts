/**
 * Content Manager for MCP Servers
 * Manages prompts and resources with automatic handler registration
 */


import { GenericCRUDManager } from './GenericCRUDManager.js';
import { ResourceDefinition, PromptDefinition, ContentFilters } from './ContentDefinitions.js';
import { Logger } from '../../utils/logger.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Content Manager for handling prompts and resources
 */
export class ContentManager {
  private prompts: GenericCRUDManager<PromptDefinition>;
  private resources: GenericCRUDManager<ResourceDefinition>;
  private server: McpServer;
  private serverName: string;

  constructor(server: McpServer, serverName: string) {
    this.server = server;
    this.serverName = serverName;
    this.prompts = new GenericCRUDManager<PromptDefinition>('Prompt');
    this.resources = new GenericCRUDManager<ResourceDefinition>('Resource');
  }

  // ===== PROMPT MANAGEMENT =====

  /**
   * Add prompt with automatic handler registration
   */
  addPrompt(prompt: PromptDefinition): void {
    this.prompts.add(prompt);
    this.setupPromptHandler(prompt);
    Logger.mcpVerbose(`${this.serverName}: Prompt '${prompt.id}' added and handler registered`);
  }

  /**
   * Update prompt with handler re-registration
   */
  updatePrompt(id: string, updates: Partial<PromptDefinition>): PromptDefinition {
    const updatedPrompt = this.prompts.update(id, updates);
    this.updatePromptHandler(updatedPrompt);
    Logger.mcpVerbose(`${this.serverName}: Prompt '${id}' updated and handler re-registered`);
    return updatedPrompt;
  }

  /**
   * Delete prompt with handler removal
   */
  deletePrompt(id: string): boolean {
    const prompt = this.prompts.get(id);
    if (!prompt) {
      return false;
    }

    this.prompts.delete(id);
    this.removePromptHandler(id);
    Logger.mcpVerbose(`${this.serverName}: Prompt '${id}' deleted and handler removed`);
    return true;
  }

  /**
   * Get prompt by ID
   */
  getPrompt(id: string): PromptDefinition | undefined {
    return this.prompts.get(id);
  }

  /**
   * List prompts with filtering
   */
  listPrompts(filters?: ContentFilters): PromptDefinition[] {
    return this.prompts.list(filters);
  }

  // ===== RESOURCE MANAGEMENT =====

  /**
   * Add resource with automatic handler registration
   */
  addResource(resource: ResourceDefinition): void {
    this.resources.add(resource);
    this.setupResourceHandler(resource);
    Logger.mcpVerbose(`${this.serverName}: Resource '${resource.id}' added and handler registered`);
  }

  /**
   * Update resource with handler re-registration
   */
  updateResource(id: string, updates: Partial<ResourceDefinition>): ResourceDefinition {
    const updatedResource = this.resources.update(id, updates);
    this.updateResourceHandler(updatedResource);
    Logger.mcpVerbose(`${this.serverName}: Resource '${id}' updated and handler re-registered`);
    return updatedResource;
  }

  /**
   * Delete resource with handler removal
   */
  deleteResource(id: string): boolean {
    const resource = this.resources.get(id);
    if (!resource) {
      return false;
    }

    this.resources.delete(id);
    this.removeResourceHandler(resource);
    Logger.mcpVerbose(`${this.serverName}: Resource '${id}' deleted and handler removed`);
    return true;
  }

  /**
   * Get resource by ID
   */
  getResource(id: string): ResourceDefinition | undefined {
    return this.resources.get(id);
  }

  /**
   * List resources with filtering
   */
  listResources(filters?: ContentFilters): ResourceDefinition[] {
    return this.resources.list(filters);
  }

  // ===== HANDLER MANAGEMENT =====

  /**
   * Setup prompt handler
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
  }

  /**
   * Setup resource handler
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
   * Update prompt handler after editing
   */
  private updatePromptHandler(prompt: PromptDefinition): void {
    this.removePromptHandler(prompt.id);
    this.setupPromptHandler(prompt);
  }

  /**
   * Update resource handler after editing
   */
  private updateResourceHandler(resource: ResourceDefinition): void {
    this.removeResourceHandler(resource);
    this.setupResourceHandler(resource);
  }

  /**
   * Remove prompt handler
   */
  private removePromptHandler(id: string): void {
    const promptHandlers = (this.server as any)._promptHandlers;
    if (promptHandlers) {
      promptHandlers.delete(id);
    }
  }

  /**
   * Remove resource handler
   */
  private removeResourceHandler(resource: ResourceDefinition): void {
    const resourceHandlers = (this.server as any)._resourceHandlers;
    if (resourceHandlers) {
      resourceHandlers.delete(resource.id);
      resourceHandlers.delete(resource.uri);
    }
  }

  // ===== BULK OPERATIONS =====

  /**
   * Setup handlers for all existing content
   */
  setupAllHandlers(): void {
    // Setup prompt handlers
    for (const prompt of this.prompts.getAll().values()) {
      this.setupPromptHandler(prompt);
    }

    // Setup resource handlers
    for (const resource of this.resources.getAll().values()) {
      this.setupResourceHandler(resource);
    }

    Logger.mcpVerbose(`${this.serverName}: All content handlers registered`);
  }

  /**
   * Get content statistics
   */
  getStats(): { prompts: number; resources: number } {
    return {
      prompts: this.prompts.size(),
      resources: this.resources.size()
    };
  }
}
