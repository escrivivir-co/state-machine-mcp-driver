/**
 * Mock Wiki MCP Server for Example
 * 
 * This is a simplified version that runs in the example environment
 * The full implementation is in src/mcp-servers/WikiMCPBrowser.ts
 */

import { WikiMCPBrowser } from '../../../src/mcp-servers/WikiMCPBrowser';
import { 
  loadWikiTopics, 
  loadWikiContent, 
  loadWikiMessages,
  type WikiTopicsConfig,
  type WikiContentConfig,
  type WikiMessagesConfig
} from './config-loader';

// Load configuration from JSON files
const topicsConfig: WikiTopicsConfig = loadWikiTopics();
const contentConfig: WikiContentConfig = loadWikiContent();
const messagesConfig: WikiMessagesConfig = loadWikiMessages();

/**
 * Initialize and start the Wiki MCP Server for the example
 */
export async function startWikiServer(): Promise<WikiMCPBrowser> {
  const server = new WikiMCPBrowser();
  
  console.log(messagesConfig.messages.server.starting);
  
  try {
    // WikiMCPBrowser doesn't need explicit start, it's ready after construction
    console.log(messagesConfig.messages.server.started);
    return server;
  } catch (error) {
    console.error(messagesConfig.messages.server.error, error);
    throw error;
  }
}

/**
 * Mock wiki topics for the different agents (loaded from JSON)
 */
export const DIONISIO_TOPICS = topicsConfig.dionisio;

export const APOLO_TOPICS = topicsConfig.apolo;

/**
 * Mock client interface for testing Wikipedia browsing
 */
export class MockWikiClient {
  private server: WikiMCPBrowser;
  private currentTopic: string = '';

  constructor(server: WikiMCPBrowser) {
    this.server = server;
  }

  async browseTopic(topic: string, agentType: 'dionisio' | 'apolo'): Promise<string> {
    this.currentTopic = topic;
    
    const topics = agentType === 'dionisio' ? DIONISIO_TOPICS : APOLO_TOPICS;
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    
    const message = messagesConfig.messages.browsing.template
      .replace('{agentType}', agentType.toUpperCase())
      .replace('{topic}', randomTopic);
    console.log(message);
    
    // Simulate doom-scrolling content based on agent type
    if (agentType === 'dionisio') {
      return this.generateCosmicContent(randomTopic);
    } else {
      return this.generateHistoricalContent(randomTopic);
    }
  }

  private generateCosmicContent(topic: string): string {
    const cosmicContent = contentConfig.cosmic;
    return cosmicContent[topic as keyof typeof cosmicContent] || 
           contentConfig.fallbackTemplates.cosmic.replace('{topic}', topic);
  }

  private generateHistoricalContent(topic: string): string {
    const historicalContent = contentConfig.historical;
    return historicalContent[topic as keyof typeof historicalContent] || 
           contentConfig.fallbackTemplates.historical.replace('{topic}', topic);
  }

  getCurrentTopic(): string {
    return this.currentTopic;
  }
}

export { WikiMCPBrowser };
