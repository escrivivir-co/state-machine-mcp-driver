/**
 * Mock X+1 MCP Server for Example
 * 
 * This is a simplified version that runs in the example environment
 * The full implementation is in src/mcp-servers/XPlus1MCPMachine.ts
 */

import { XPlus1MCPMachine } from '../../../src/mcp-servers/XPlus1MCPMachine';
import { loadXPlus1Messages, type XPlus1MessagesConfig } from './config-loader';

// Load configuration from JSON files
const messagesConfig: XPlus1MessagesConfig = loadXPlus1Messages();

/**
 * Initialize and start the X+1 MCP Server for the example
 */
export async function startXPlus1Server(): Promise<XPlus1MCPMachine> {
  const server = new XPlus1MCPMachine();
  
  console.log(messagesConfig.messages.server.starting);
  
  try {
    await server.start();
    console.log(messagesConfig.messages.server.started);
    return server;
  } catch (error) {
    console.error(messagesConfig.messages.server.error, error);
    throw error;
  }
}

/**
 * Mock client interface for testing
 */
export class MockXPlus1Client {
  private server: XPlus1MCPMachine;

  constructor(server: XPlus1MCPMachine) {
    this.server = server;
  }

  async getXValue(): Promise<number> {
    const state = this.server.getState();
    return state.x;
  }

  async setAdvance(advance: number, reason?: string): Promise<void> {
    // In a real implementation, this would call the MCP tool
    // For the mock, we'll simulate the tool call
    const reasonText = reason || messagesConfig.messages.client.noReason;
    const message = messagesConfig.messages.client.setAdvance
      .replace('{advance}', advance.toString())
      .replace('{reason}', reasonText);
    console.log(message);
  }

  async getStatistics() {
    const state = this.server.getState();
    return {
      currentX: state.x,
      resetCount: state.resetCount,
      totalAdvances: state.advancementHistory.length
    };
  }
}

export { XPlus1MCPMachine };
