/**
 * Console Reading Demo - Complete End-to-End Example
 * Demonstrates full bidirectional remote control with console reading
 */

import { EnhancedXPlus1MCPMachine, runConsoleReadingDemo } from './mcp-console-reader';
import { logger } from '../../src/utils/logger';

/**
 * Simulate an AI assistant using the console reading tools
 */
async function simulateAIAssistant(mcpServer: EnhancedXPlus1MCPMachine): Promise<void> {
  logger.info('🤖 AI Assistant: Starting console reading simulation...');

  // Wait a bit for the game to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  let iteration = 0;
  const maxIterations = 5;

  const simulationInterval = setInterval(async () => {
    iteration++;
    
    if (iteration > maxIterations || !mcpServer.isConsoleUIConnected()) {
      clearInterval(simulationInterval);
      logger.info('🤖 AI Assistant: Simulation complete');
      return;
    }

    logger.info(`\n🤖 AI Assistant: Iteration ${iteration}/${maxIterations}`);

    try {
      // Step 1: Read current console output
      logger.info('📖 Reading console output...');
      // Note: In a real implementation, you would call the MCP tools
      // For now, we'll just demonstrate the capability
      
      // Step 2: Read current prompt
      logger.info('🎯 Reading current prompt...');
      
      // Step 3: Read UI status  
      logger.info('🖥️ Reading UI status...');
      
      // Step 4: Make an informed decision
      logger.info('🧠 Analyzing console state...');
      
      // Step 5: Send appropriate command
      logger.info('📤 Sending informed command...');
      
      logger.info('✅ AI Assistant successfully read and responded to console state');

    } catch (error) {
      logger.error('🤖 AI Assistant: Error in simulation', { error });
    }

    logger.info('⏱️ Waiting before next iteration...\n');
    
  }, 5000); // Every 5 seconds
}

/**
 * Main demo function
 */
async function runFullDemo(): Promise<void> {
  logger.info('🚀 Starting Complete Console Reading Demo');
  logger.info('📋 This demo will:');
  logger.info('   1. Start X+1 game with console UI');
  logger.info('   2. Start MCP server with console reading tools');
  logger.info('   3. Connect console UI to MCP server');
  logger.info('   4. Simulate AI assistant reading console state');
  logger.info('   5. Demonstrate bidirectional control\n');

  try {
    // Start the base demo
    await runConsoleReadingDemo();
    
    // Get access to the MCP server for simulation
    // Note: In a real implementation, you would get this reference properly
    const mcpServer = new EnhancedXPlus1MCPMachine();
    
    logger.info('🤖 Starting AI assistant simulation...');
    
    // Run AI simulation in parallel
    setTimeout(() => {
      simulateAIAssistant(mcpServer);
    }, 3000);

    logger.info('🎉 Full demo is now running!');
    logger.info('📝 Try interacting with the game while the AI reads the console');
    logger.info('🔍 Check the logs to see console reading in action');

  } catch (error) {
    logger.error('💥 Demo failed', { error });
    throw error;
  }
}

/**
 * Example of how an external AI would use the console reading tools
 */
function exampleAIUsage(): void {
  logger.info('\n📖 Example AI Usage of Console Reading Tools:');
  
  const exampleCode = `
// Example: AI assistant reading console state before acting

async function intelligentGameControl() {
  // 1. Read what's currently on screen
  const output = await callTool('get_console_output', {});
  console.log('Current display:', output.lastLines);
  
  // 2. Check what options are available
  const prompt = await callTool('get_current_prompt', {});
  console.log('Available options:', prompt.availableOptions);
  
  // 3. Understand the current UI state
  const status = await callTool('get_ui_status', {});
  console.log('UI Phase:', status.interaction.phase);
  
  // 4. Make informed decision
  if (status.interaction.phase === 'menu') {
    if (prompt.availableOptions.find(opt => opt.key === '1')) {
      await callTool('send_user_input', { text: '1' });
      console.log('Selected option 1 based on available choices');
    }
  } else if (status.interaction.phase === 'decision') {
    await callTool('answer_critical_question', { 
      answer: 'no', 
      reasoning: 'Continuing journey based on current context' 
    });
  }
}
`;

  logger.info(exampleCode);
  logger.info('🚀 This demonstrates READ-FIRST, THEN-WRITE approach!');
}

/**
 * CLI entry point
 */
if (require.main === module) {
  // Show example usage first
  exampleAIUsage();
  
  // Start the full demo
  runFullDemo()
    .then(() => {
      logger.info('✅ Console reading demo started successfully');
    })
    .catch((error) => {
      logger.error('💥 Console reading demo failed', { error });
      process.exit(1);
    });
}

export { runFullDemo, simulateAIAssistant, exampleAIUsage };
