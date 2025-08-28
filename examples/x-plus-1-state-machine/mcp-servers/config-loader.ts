/**
 * Configuration loader utility for MCP servers
 * Provides safe loading and caching of JSON configuration files
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface ConfigCache {
  [key: string]: any;
}

class ConfigLoader {
  private static instance: ConfigLoader;
  private cache: ConfigCache = {};
  private dataDir: string;

  private constructor() {
    this.dataDir = join(__dirname, 'data');
  }

  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  /**
   * Load a JSON configuration file with caching
   * @param filename Name of the JSON file (without extension)
   * @returns Parsed JSON object
   */
  public loadConfig<T = any>(filename: string): T {
    if (this.cache[filename]) {
      return this.cache[filename];
    }

    try {
      const filePath = join(this.dataDir, `${filename}.json`);
      const content = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      this.cache[filename] = parsed;
      return parsed;
    } catch (error) {
      console.error(`Error loading config file ${filename}.json:`, error);
      throw new Error(`Failed to load configuration: ${filename}`);
    }
  }

  /**
   * Clear the cache for a specific file or all files
   * @param filename Optional filename to clear, if not provided clears all cache
   */
  public clearCache(filename?: string): void {
    if (filename) {
      delete this.cache[filename];
    } else {
      this.cache = {};
    }
  }

  /**
   * Reload a configuration file (clears cache and loads fresh)
   * @param filename Name of the JSON file (without extension)
   * @returns Parsed JSON object
   */
  public reloadConfig<T = any>(filename: string): T {
    this.clearCache(filename);
    return this.loadConfig<T>(filename);
  }
}

// Export singleton instance
export const configLoader = ConfigLoader.getInstance();

// Type definitions for configuration files
export interface WikiTopicsConfig {
  dionisio: string[];
  apolo: string[];
}

export interface WikiContentConfig {
  cosmic: Record<string, string>;
  historical: Record<string, string>;
  fallbackTemplates: {
    cosmic: string;
    historical: string;
  };
}

export interface WikiMessagesConfig {
  messages: {
    server: {
      starting: string;
      started: string;
      error: string;
    };
    browsing: {
      template: string;
    };
  };
}

export interface XPlus1MessagesConfig {
  messages: {
    server: {
      starting: string;
      started: string;
      error: string;
    };
    client: {
      setAdvance: string;
      noReason: string;
    };
  };
}

// Helper functions for specific configs
export const loadWikiTopics = (): WikiTopicsConfig => 
  configLoader.loadConfig<WikiTopicsConfig>('wiki-topics');

export const loadWikiContent = (): WikiContentConfig => 
  configLoader.loadConfig<WikiContentConfig>('wiki-content');

export const loadWikiMessages = (): WikiMessagesConfig => 
  configLoader.loadConfig<WikiMessagesConfig>('wiki-messages');

export const loadXPlus1Messages = (): XPlus1MessagesConfig => 
  configLoader.loadConfig<XPlus1MessagesConfig>('xplus1-messages');
