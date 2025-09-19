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
  public dataDir: string;

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

export interface AgentPromptsConfig {
  dionisio: { systemPrompt: string; maxTokens: number; temperature: number };
  apolo: { systemPrompt: string; maxTokens: number; temperature: number };
  justice: { systemPrompt: string; maxTokens: number; temperature: number };
}

export interface GameMessagesConfig {
  game: {
    start: string;
    turnStart: string; // template with {x} and {remaining}
    questionTime: string; // template with {x}
    advancementPositive: string; // template with {oldX}, {newX}
    advancementNegative: string; // template with {oldX}, {newX}
    end: string; // template with {finalX}, {turns}
  };
}

export interface UserSimulatorConfig {
  personalities: Record<string, {
    baseConsumptionProbability: number;
    streakThresholds: Array<{ x: number; delta: number }>;
    recentResetPenalty: { window: number; threshold: number; delta: number };
    randomJitter: number;
    nextAgentWeights: Record<string, number>;
  }>;
  defaults: { personality: string };
}

// Helper functions for specific configs
export const loadWikiTopics = (dataDir: string): WikiTopicsConfig => {
  setDataDir(dataDir);
  return configLoader.loadConfig<WikiTopicsConfig>('wiki-topics');
};

export const loadWikiContent = (dataDir: string): WikiContentConfig => {    
  setDataDir(dataDir);
  return configLoader.loadConfig<WikiContentConfig>('wiki-content');
};

export const loadWikiMessages = (dataDir: string): WikiMessagesConfig => {    
  setDataDir(dataDir);
  return configLoader.loadConfig<WikiMessagesConfig>('wiki-messages');
};

export const loadXPlus1Messages = (dataDir: string): XPlus1MessagesConfig => {
  setDataDir(dataDir);
  return configLoader.loadConfig<XPlus1MessagesConfig>('xplus1-messages');
};

export const loadAgentPrompts = (dataDir: string): AgentPromptsConfig => {
  setDataDir(dataDir);
  return configLoader.loadConfig<AgentPromptsConfig>('agent-prompts');
}

export const loadGameMessages = (dataDir: string): GameMessagesConfig => {
  setDataDir(dataDir);
  return configLoader.loadConfig<GameMessagesConfig>('game-messages');
} 

export const loadUserSimulator = (dataDir: string ): UserSimulatorConfig => {
  setDataDir(dataDir);
  return configLoader.loadConfig<UserSimulatorConfig>('user-simulator');
}
  

function setDataDir(dataDir: string) {
  const configLoader = ConfigLoader.getInstance();
  configLoader.dataDir = dataDir;
}