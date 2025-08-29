/**
 * Generic CRUD Manager for MCP Server Content
 * Provides reusable CRUD operations for prompts, resources, and other content
 */

import { BaseContentDefinition, CRUDOperations, ContentFilters } from './ContentDefinitions.js';

/**
 * Generic CRUD Manager implementation
 */
export class GenericCRUDManager<T extends BaseContentDefinition> implements CRUDOperations<T> {
  protected items: Map<string, T> = new Map();
  protected contentType: string;

  constructor(contentType: string) {
    this.contentType = contentType;
  }

  /**
   * List items with optional filtering
   */
  list(filters?: ContentFilters): T[] {
    const items = Array.from(this.items.values());
    
    if (!filters) {
      return items;
    }

    return items.filter(item => {
      // Category filter
      if (filters.category && (!item.metadata?.category || item.metadata.category !== filters.category)) {
        return false;
      }
      
      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        return item.name.toLowerCase().includes(searchTerm) || 
               item.description.toLowerCase().includes(searchTerm);
      }
      
      return true;
    });
  }

  /**
   * Get item by ID
   */
  get(id: string): T | undefined {
    return this.items.get(id);
  }

  /**
   * Add new item
   */
  add(item: T): void {
    if (this.items.has(item.id)) {
      throw new Error(`${this.contentType} with ID '${item.id}' already exists`);
    }
    
    this.items.set(item.id, item);
  }

  /**
   * Update existing item
   */
  update(id: string, updates: Partial<T>): T {
    const item = this.items.get(id);
    if (!item) {
      throw new Error(`${this.contentType} with ID '${id}' not found`);
    }

    const updatedItem: T = {
      ...item,
      ...updates,
      id, // Preserve original ID
      updatedAt: Date.now()
    };

    this.items.set(id, updatedItem);
    return updatedItem;
  }

  /**
   * Delete item
   */
  delete(id: string): boolean {
    const item = this.items.get(id);
    if (!item) {
      return false;
    }

    this.items.delete(id);
    return true;
  }

  /**
   * Check if item exists
   */
  has(id: string): boolean {
    return this.items.has(id);
  }

  /**
   * Get all items
   */
  getAll(): Map<string, T> {
    return new Map(this.items);
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.items.clear();
  }

  /**
   * Get items count
   */
  size(): number {
    return this.items.size;
  }

  /**
   * Get items by category
   */
  getByCategory(category: string): T[] {
    return this.list({ category });
  }

  /**
   * Search items
   */
  search(searchTerm: string): T[] {
    return this.list({ search: searchTerm });
  }
}
