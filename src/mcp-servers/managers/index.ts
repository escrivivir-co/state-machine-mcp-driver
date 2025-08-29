// Manager exports for MCP servers
export { ContentManager } from './ContentManager.js';
export { GenericCRUDManager } from './GenericCRUDManager.js';
export { CRUDToolsManager } from './CRUDToolsManager.js';
export { PluginSystemManager } from './PluginSystemManager.js';
export { CoreComponentsManager } from './CoreComponentsManager.js';

// Type definitions
export type {
  BaseContentDefinition,
  ResourceDefinition,
  PromptDefinition,
  CRUDOperations,
  ContentFilters
} from './ContentDefinitions.js';

export type {
  PluginInterface,
  PluginConfig,
  ToolDefinition
} from './PluginInterface.js';
