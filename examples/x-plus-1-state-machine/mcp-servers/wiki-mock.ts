/**
 * Mock Wiki MCP Server for Example
 * 
 * This is a simplified version that runs in the example environment
 * The full implementation is in src/mcp-servers/WikiMCPBrowser.ts
 */

import { WikiMCPBrowser } from '../../../src/mcp-servers/WikiMCPBrowser';

/**
 * Initialize and start the Wiki MCP Server for the example
 */
export async function startWikiServer(): Promise<WikiMCPBrowser> {
  const server = new WikiMCPBrowser();
  
  console.log('🌐 Starting Wiki MCP Server...');
  
  try {
    // WikiMCPBrowser doesn't need explicit start, it's ready after construction
    console.log('✅ Wiki MCP Server started successfully');
    return server;
  } catch (error) {
    console.error('❌ Failed to start Wiki MCP Server:', error);
    throw error;
  }
}

/**
 * Mock wiki topics for the different agents
 */
export const DIONISIO_TOPICS = [
  'Universe',
  'Big_Bang',
  'Cosmic_microwave_background',
  'Dark_matter',
  'Black_hole',
  'Multiverse',
  'Heat_death_of_the_universe',
  'Entropy',
  'Void_(astronomy)',
  'Existentialism'
];

export const APOLO_TOPICS = [
  'History_of_the_world',
  'Human_evolution',
  'Agriculture',
  'Writing',
  'Renaissance',
  'Scientific_revolution',
  'Industrial_Revolution',
  'Human_achievement',
  'Civilization',
  'Philosophy'
];

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
    
    console.log(`📖 ${agentType.toUpperCase()}Bot browsing: ${randomTopic}`);
    
    // Simulate doom-scrolling content based on agent type
    if (agentType === 'dionisio') {
      return this.generateCosmicContent(randomTopic);
    } else {
      return this.generateHistoricalContent(randomTopic);
    }
  }

  private generateCosmicContent(topic: string): string {
    const cosmicContent = {
      'Universe': 'The observable universe is estimated to contain more than 2 trillion galaxies. Each galaxy contains billions of stars, and the universe continues expanding...',
      'Big_Bang': 'The Big Bang occurred approximately 13.8 billion years ago. In the first moments, all matter and energy were concentrated in an infinitesimally small point...',
      'Black_hole': 'Black holes are regions of spacetime where gravity is so strong that nothing, not even light, can escape. They represent the ultimate cosmic mystery...',
      'Heat_death_of_the_universe': 'The heat death of the universe is a theory about the ultimate fate of the universe, which suggests the universe will evolve to maximum entropy...'
    };

    return cosmicContent[topic as keyof typeof cosmicContent] || `Exploring the cosmic mysteries of ${topic}...`;
  }

  private generateHistoricalContent(topic: string): string {
    const historicalContent = {
      'Human_evolution': 'Human evolution is the evolutionary process that led to the emergence of anatomically modern humans. This journey spans millions of years...',
      'Renaissance': 'The Renaissance was a period of cultural, artistic, political and economic rebirth following the Middle Ages, marking humanity\'s greatest achievements...',
      'Scientific_revolution': 'The Scientific Revolution was a series of events that marked the emergence of modern science during the early modern period...',
      'Industrial_Revolution': 'The Industrial Revolution marked a major turning point in history, transforming human society and accelerating progress...'
    };

    return historicalContent[topic as keyof typeof historicalContent] || `Discovering the human achievements in ${topic}...`;
  }

  getCurrentTopic(): string {
    return this.currentTopic;
  }
}

export { WikiMCPBrowser };
