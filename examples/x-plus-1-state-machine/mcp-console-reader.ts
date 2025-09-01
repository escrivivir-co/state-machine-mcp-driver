/**
 * MCP Console Reader Example
 * Demonstrates how to use the console reading tools with X+1 Game
 */

import { DEPRECATED_OLD_STATE_MACHINE_SERVER } from '../../src/mcp-servers/DEPRECATED';
import { XPlus1GameConsole } from './ConsoleGamificationUI';
import { logger } from '../../src/utils/logger';

/**
 * Enhanced X+1 MCP Machine with Console Reading Integration
 */
export class EnhancedXPlus1MCPMachine extends DEPRECATED_OLD_STATE_MACHINE_SERVER {
  private consoleUI?: XPlus1GameConsole;

  /**
   * Connect to a console UI instance for reading
   */
  connectConsoleUI(consoleUI: XPlus1GameConsole): void {
    this.consoleUI = consoleUI;
    logger.info('X+1 MCP: Console UI connected for reading');
    this.setupConsoleIntegration();
  }

  /**
   * Setup integration between MCP tools and console UI
   */
  private setupConsoleIntegration(): void {
    if (!this.consoleUI) return;

    // Override the placeholder console reading tools with real implementations
    this.replaceConsoleReadingTools();
    
    // Setup streaming if supported
    if (this.consoleUI.startStreaming) {
      this.consoleUI.startStreaming((status) => {
        logger.debug('X+1 MCP: Console status update', { 
          phase: status.interaction.phase,
          prompt: status.prompt.promptText,
          options: status.prompt.availableOptions.length
        });
      });
    }
  }

  /**
   * Replace placeholder console reading tools with real implementations
   */
  private replaceConsoleReadingTools(): void {
    if (!this.consoleUI) return;

    // Clear existing tools and re-add with real implementations
    // Note: This is a simplified approach - in a real implementation you might want
    // to handle tool replacement more elegantly

    // Get console output tool (real implementation)
    this.server.tool(
      'get_console_output',
      'Get the current console output and display state',
      {},
      async () => {
        if (!this.consoleUI) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Console UI not connected',
                timestamp: Date.now()
              }, null, 2)
            }]
          };
        }

        try {
          const output = await this.consoleUI.getCurrentOutput();
          logger.info('X+1 MCP: Console output retrieved', { 
            lines: output.lastLines.length,
            active: output.isActive 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                output: output,
                timestamp: Date.now()
              }, null, 2)
            }]
          };
        } catch (error) {
          logger.error('X+1 MCP: Error getting console output', { error });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
              }, null, 2)
            }]
          };
        }
      }
    );

    // Get current prompt tool (real implementation)
    this.server.tool(
      'get_current_prompt',
      'Get the current prompt text and available options',
      {},
      async () => {
        if (!this.consoleUI) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Console UI not connected',
                timestamp: Date.now()
              }, null, 2)
            }]
          };
        }

        try {
          const prompt = await this.consoleUI.getCurrentPrompt();
          logger.info('X+1 MCP: Current prompt retrieved', { 
            text: prompt.promptText,
            options: prompt.availableOptions.length,
            waiting: prompt.isWaitingForInput
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                prompt: prompt,
                timestamp: Date.now()
              }, null, 2)
            }]
          };
        } catch (error) {
          logger.error('X+1 MCP: Error getting current prompt', { error });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
              }, null, 2)
            }]
          };
        }
      }
    );

    // Get UI status tool (real implementation)
    this.server.tool(
      'get_ui_status',
      'Get the current UI status and interaction state',
      {},
      async () => {
        if (!this.consoleUI) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Console UI not connected',
                timestamp: Date.now()
              }, null, 2)
            }]
          };
        }

        try {
          const status = await this.consoleUI.getUIStatus();
          logger.info('X+1 MCP: UI status retrieved', { 
            phase: status.interaction.phase,
            responsive: status.interaction.isResponsive,
            commands: status.interaction.availableCommands.length
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                status: status,
                timestamp: Date.now()
              }, null, 2)
            }]
          };
        } catch (error) {
          logger.error('X+1 MCP: Error getting UI status', { error });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
              }, null, 2)
            }]
          };
        }
      }
    );

    // Get interaction state tool (real implementation)
    this.server.tool(
      'get_interaction_state',
      'Get the current interaction state and available commands',
      {},
      async () => {
        if (!this.consoleUI) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Console UI not connected',
                timestamp: Date.now()
              }, null, 2)
            }]
          };
        }

        try {
          const interaction = await this.consoleUI.getInteractionState();
          logger.info('X+1 MCP: Interaction state retrieved', { 
            phase: interaction.phase,
            lastAction: interaction.lastUserAction,
            pending: interaction.pendingActions.length
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                interaction: interaction,
                timestamp: Date.now()
              }, null, 2)
            }]
          };
        } catch (error) {
          logger.error('X+1 MCP: Error getting interaction state', { error });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
              }, null, 2)
            }]
          };
        }
      }
    );

    logger.info('X+1 MCP: Console reading tools replaced with real implementations');
  }

  /**
   * Disconnect console UI
   */
  disconnectConsoleUI(): void {
    this.consoleUI = undefined;
    logger.info('X+1 MCP: Console UI disconnected');
  }

  /**
   * Check if console UI is connected
   */
  isConsoleUIConnected(): boolean {
    return !!this.consoleUI;
  }

  /**
   * Get console UI capabilities if connected
   */
  getConsoleCapabilities() {
    return this.consoleUI?.getCapabilities() || null;
  }
}

/**
 * Example usage of console reading with MCP
 */
export async function runConsoleReadingDemo(): Promise<void> {
  logger.info('🎮 Starting X+1 Console Reading Demo');

  // Create enhanced MCP server
  const mcpServer = new EnhancedXPlus1MCPMachine();

  try {
    // Start MCP server
    logger.info('🔌 Starting MCP server...');
    await mcpServer.start();

    // Create console UI using factory pattern
    logger.info('🎮 Creating console UI...');
    const consoleUI = await XPlus1GameConsole.create();

    // Connect console UI to MCP server
    logger.info('🔗 Connecting console UI to MCP server...');
    mcpServer.connectConsoleUI(consoleUI);

    // Start console UI
    logger.info('🎮 Starting console UI...');
    await consoleUI.start();

    logger.info('✅ Console reading demo ready!');
    logger.info('📋 Available MCP tools:');
    logger.info('   - get_console_output: Read current console display');
    logger.info('   - get_current_prompt: Read prompt and options');
    logger.info('   - get_ui_status: Get complete UI status');
    logger.info('   - get_interaction_state: Get interaction state');
    logger.info('');
    logger.info('🌐 MCP server running on: http://localhost:3001');
    logger.info('💡 Try using MCP tools to read the console state!');

  } catch (error) {
    logger.error('❌ Error in console reading demo', { error });
    throw error;
  }
}

/**
 * CLI entry point for demo
 */
if (require.main === module) {
  runConsoleReadingDemo()
    .then(() => {
      logger.info('🎉 Demo started successfully');
    })
    .catch((error) => {
      logger.error('💥 Demo failed to start', { error });
      process.exit(1);
    });
}
