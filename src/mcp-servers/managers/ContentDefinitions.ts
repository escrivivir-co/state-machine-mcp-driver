/**
 * Content Definitions for MCP Servers
 * Common interfaces and types for prompts and resources
 */

/**
 * Base content definition interface
 */
export interface BaseContentDefinition {
  id: string;
  name: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

/**
 * Resource definition interface
 */
export interface ResourceDefinition extends BaseContentDefinition {
  uri: string;
  mimeType: string;
  content: string;
}

/**
 * Prompt definition interface
 */
export interface PromptDefinition extends BaseContentDefinition {
  parameters?: Record<string, any>;
  content: string;
}

/**
 * Generic CRUD operations interface
 */
export interface CRUDOperations<T extends BaseContentDefinition> {
  list(filters?: { category?: string; search?: string }): T[];
  get(id: string): T | undefined;
  add(item: T): void;
  update(id: string, updates: Partial<T>): T;
  delete(id: string): boolean;
  has(id: string): boolean;
}

/**
 * Content filter options
 */
export interface ContentFilters {
  category?: string;
  search?: string;
}

/**
 * Content creation options
 */
export interface ContentCreationOptions {
  overwrite?: boolean;
  validate?: boolean;
}
