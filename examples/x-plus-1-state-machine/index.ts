/**
 * X+1 State Machine Example - Main Entry Point
 * 
 * Demonstrates the complete usage of the State Machine MCP Driver
 * with the X+1 inductive pattern game.
 */

import { XPlus1GameConsole } from './ConsoleGamificationUI';
import { logger } from '../../src/utils/logger';

/**
 * Main function to run the X+1 game
 */
async function main() {
  try {
    console.log('🎮 Initializing X+1 Inductive Pattern Game...');
    
  // Create and start the console game (async factory)
  const game = await XPlus1GameConsole.create();
  await game.start();
    
  } catch (error) {
    logger.error('Failed to start X+1 game', error as Error);
    console.error('❌ Failed to start game:', error);
    process.exit(1);
  }
}

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', error);
  process.exit(1);
});

// Run the game if this file is executed directly
if (require.main === module) {
  main();
}

export { main, XPlus1GameConsole };
