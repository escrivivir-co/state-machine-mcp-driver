/**
 * Console Gamification UI for X+1 State Machine
 * 
 * Provides a text-based interface for playing the X+1 inductive pattern game
 * Uses stdin/stdout for user interaction as described in the README
 */

import * as readline from 'readline';
import { Runtime, RuntimeConfig } from '../../src/runtime/Runtime';
import { MCPDriver } from '../../src/drivers/MCPDriver';
import { AgentRole } from '../../src/models/Agent';
import { xPlus1StateGraph } from './stategraph';
import { 
  createXPlus1RuntimeConfig, 
  GAME_CONFIG, 
  AGENT_PROMPTS, 
  MESSAGE_TEMPLATES,
  type AgentType,
  type GamePhase
} from './game-config';
import { OllamaChatProvider } from '../../src/chat-provider/OllamaChatProvider';
import { ChatMessage } from '../../src/chat-provider/types';

/**
 * Console Game Interface
 */
export class ConsoleGamificationUI {
  private runtime: Runtime;
  private rl: readline.Interface;
  private mcpDriver: MCPDriver;
  private chatProvider: OllamaChatProvider;
  private gameState: {
    x: number;
    messageCount: number;
    isActive: boolean;
    currentPhase: GamePhase;
    turnHistory: Array<{
      turn: number;
      x: number;
      advance: number;
      timestamp: number;
    }>;
  };

  constructor() {
    this.gameState = {
      x: 0,
      messageCount: 0,
      isActive: false,
      currentPhase: 'start',
      turnHistory: []
    };
    
    this.setupConsole();
    this.setupMCPDriver();
    this.setupChatProvider();
  }

  private setupConsole(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });

    this.rl.on('line', (input) => {
      this.handleUserInput(input.trim());
    });

    this.rl.on('close', () => {
      this.shutdown();
    });
  }

  private setupMCPDriver(): void {
    this.mcpDriver = new MCPDriver();
    
    // Add MCP servers for X+1 game
    this.mcpDriver.addServer({
      id: 'xplus1-mcp-machine',
      name: 'X+1 MCP Machine',
      url: 'http://localhost:3001',
      timeout: 5000
    });

    this.mcpDriver.addServer({
      id: 'wiki-mcp-browser', 
      name: 'Wiki MCP Browser',
      url: 'http://localhost:3002',
      timeout: 5000
    });
  }

  private setupChatProvider(): void {
    this.chatProvider = new OllamaChatProvider({
      baseUrl: 'http://localhost:11434',
      defaultModel: 'llama3.2:3b',
      defaultTemperature: 0.7,
      defaultMaxTokens: 150
    });
  }

  /**
   * Start the X+1 game
   */
  async start(): Promise<void> {
    try {
      console.log('🎮 Starting X+1 Inductive Pattern Game...');
      console.log('=====================================');
      
      // Create runtime configuration
      const config = await createXPlus1RuntimeConfig();
      
      // Initialize runtime
      this.runtime = new Runtime(this.mcpDriver, config);
      await this.runtime.initialize();

      // Set up event handlers
      this.setupRuntimeEventHandlers();

      // Start the game loop
      this.gameState.isActive = true;
      this.gameState.currentPhase = 'start';
      
      console.log(MESSAGE_TEMPLATES.gameStart);
      console.log(MESSAGE_TEMPLATES.turnStart(this.gameState.x, this.gameState.messageCount));
      console.log('\nType "help" for commands, or start conversing with the agents...');
      
      // Start conversation with agents
      await this.startConversationTurn();
      
      this.rl.prompt();
      
    } catch (error) {
      console.error('❌ Failed to start game:', error);
      throw error;
    }
  }

  private setupRuntimeEventHandlers(): void {
    this.runtime.on('stateTransition', (data) => {
      console.log(`🔄 State transition: ${data.from} → ${data.to}`);
      this.updateGameStateFromTransition(data);
    });

    this.runtime.on('agentAdded', (data) => {
      console.log(`🤖 Agent joined: ${data.agent.name}`);
    });

    this.runtime.on('actionExecuted', (data) => {
      console.log(`⚡ ${data.agent.name} executed: ${data.action.type}`);
    });
  }

  private async startConversationTurn(): Promise<void> {
    this.gameState.messageCount = 0;
    this.gameState.currentPhase = 'conversation';
    
    // Let each agent make an opening statement
    const agents = this.runtime.getAgents();
    
    for (const agent of agents) {
      if (this.gameState.messageCount >= GAME_CONFIG.MAX_MESSAGES_THREAD - 2) {
        break; // Reserve space for decision
      }
      
      await this.agentSpeak(agent.id as AgentType);
      this.gameState.messageCount++;
    }
  }

  private async agentSpeak(agentType: AgentType): Promise<void> {
    try {
      const agent = this.runtime.getAgent(`${agentType}-bot`);
      if (!agent) return;

      // Create conversation context for this agent
      const conversationId = `${agentType}-${Date.now()}`;
      const systemPrompt = AGENT_PROMPTS[agentType].systemPrompt;
      const userPrompt = `Current X: ${this.gameState.x}, Messages used: ${this.gameState.messageCount}/${GAME_CONFIG.MAX_MESSAGES_THREAD}. Please make your contribution to the conversation.`;

      // Start conversation with system context
      this.chatProvider.startConversation(conversationId, [], []);
      
      // Send system message first
      await this.chatProvider.send(conversationId, systemPrompt);
      
      // Get response to user prompt
      const response = await this.chatProvider.send(conversationId, userPrompt, {
        model: 'llama3.2:3b',
        temperature: AGENT_PROMPTS[agentType].temperature,
        max_tokens: AGENT_PROMPTS[agentType].maxTokens
      });

      // Display agent message
      console.log(`\n🤖 ${agent.name}: ${response.choices[0]?.message?.content || 'No response'}`);
      
    } catch (error) {
      console.error(`❌ Error with ${agentType} agent:`, error);
    }
  }

  private async handleUserInput(input: string): Promise<void> {
    if (!this.gameState.isActive) return;

    if (input.toLowerCase() === 'help') {
      this.showHelp();
      this.rl.prompt();
      return;
    }

    if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
      await this.shutdown();
      return;
    }

    if (input.toLowerCase() === 'status') {
      this.showStatus();
      this.rl.prompt();
      return;
    }

    // Handle game input
    console.log(`\n👤 Player: ${input}`);
    this.gameState.messageCount++;

    // Check if it's time for the decision
    if (this.gameState.messageCount >= GAME_CONFIG.MAX_MESSAGES_THREAD - 1 || 
        this.gameState.currentPhase === 'decision') {
      await this.handleDecisionPhase(input);
    } else {
      // Continue conversation
      await this.handleConversationPhase(input);
    }

    this.rl.prompt();
  }

  private async handleDecisionPhase(input: string): Promise<void> {
    if (this.gameState.currentPhase !== 'decision') {
      // JusticeBot asks the key question
      this.gameState.currentPhase = 'decision';
      console.log(`\n${MESSAGE_TEMPLATES.questionTime(this.gameState.x)}`);
      return;
    }

    // Process user's yes/no answer
    const answer = input.toLowerCase();
    let advance = 0;
    
    if (answer.includes('yes') || answer.includes('y')) {
      advance = -1; // Negative advance = reset
      console.log('\n⚖️ JusticeBot: You chose consumption. X will be reset to 0.');
    } else if (answer.includes('no') || answer.includes('n')) {
      advance = 1; // Positive advance = increment
      console.log('\n⚖️ JusticeBot: You chose restraint. X will advance by 1.');
    } else {
      console.log('\n⚖️ JusticeBot: Please answer clearly with "yes" or "no". Did you consume today, do I reset?');
      return;
    }

    // Apply the advancement
    await this.applyAdvancement(advance);
    
    // Start new turn
    setTimeout(() => {
      this.startNewTurn();
    }, 2000);
  }

  private async handleConversationPhase(input: string): Promise<void> {
    // Let agents respond to user input
    const remainingMessages = GAME_CONFIG.MAX_MESSAGES_THREAD - this.gameState.messageCount - 2;
    const agents = this.runtime.getAgents().filter(a => a.id !== 'justice-bot');
    
    for (const agent of agents) {
      if (this.gameState.messageCount >= GAME_CONFIG.MAX_MESSAGES_THREAD - 2) {
        break;
      }
      
      const agentType = agent.id.replace('-bot', '') as AgentType;
      await this.agentRespond(agentType, input);
      this.gameState.messageCount++;
    }
  }

  private async agentRespond(agentType: AgentType, userInput: string): Promise<void> {
    try {
      const agent = this.runtime.getAgent(`${agentType}-bot`);
      if (!agent) return;

      // Create conversation context for this agent
      const conversationId = `${agentType}-response-${Date.now()}`;
      const systemPrompt = AGENT_PROMPTS[agentType].systemPrompt;
      const responsePrompt = `The player said: "${userInput}". Current X: ${this.gameState.x}. How do you respond? Messages remaining: ${GAME_CONFIG.MAX_MESSAGES_THREAD - this.gameState.messageCount - 2}`;

      // Start conversation with system context
      this.chatProvider.startConversation(conversationId, [], []);
      
      // Send system message first
      await this.chatProvider.send(conversationId, systemPrompt);
      
      // Get response to user input
      const response = await this.chatProvider.send(conversationId, responsePrompt, {
        model: 'llama3.2:3b',
        temperature: AGENT_PROMPTS[agentType].temperature,
        max_tokens: AGENT_PROMPTS[agentType].maxTokens
      });

      console.log(`\n🤖 ${agent.name}: ${response.choices[0]?.message?.content || 'No response'}`);
      
    } catch (error) {
      console.error(`❌ Error with ${agentType} agent response:`, error);
    }
  }

  private async applyAdvancement(advance: number): Promise<void> {
    const oldX = this.gameState.x;
    
    if (advance > 0) {
      this.gameState.x++;
      await this.runtime.transitionTo('playing', 'positive_advance', { 
        advance, 
        oldX, 
        newX: this.gameState.x 
      });
    } else {
      this.gameState.x = 0;
      await this.runtime.transitionTo('start', 'negative_advance', { 
        advance, 
        oldX, 
        newX: this.gameState.x 
      });
    }

    this.gameState.turnHistory.push({
      turn: this.gameState.turnHistory.length + 1,
      x: this.gameState.x,
      advance,
      timestamp: Date.now()
    });

    console.log(`\n${MESSAGE_TEMPLATES.advancement(oldX, this.gameState.x, advance)}`);
  }

  private startNewTurn(): void {
    this.gameState.messageCount = 0;
    this.gameState.currentPhase = 'start';
    
    console.log('\n' + '='.repeat(50));
    console.log(MESSAGE_TEMPLATES.turnStart(this.gameState.x, this.gameState.messageCount));
    console.log('New conversation turn begins...');
    
    // Start new conversation
    this.startConversationTurn();
  }

  private updateGameStateFromTransition(data: any): void {
    // Update game state based on runtime state transitions
    const currentState = this.runtime.getCurrentState();
    // Additional state synchronization logic here
  }

  private showHelp(): void {
    console.log('\n📖 X+1 Game Commands:');
    console.log('  help    - Show this help message');
    console.log('  status  - Show current game status');
    console.log('  quit    - Exit the game');
    console.log('\n🎯 How to play:');
    console.log('  - Engage in conversation with 3 agents');
    console.log('  - DionisioBot will tempt you toward consumption');
    console.log('  - ApoloBot will encourage restraint and growth');
    console.log('  - JusticeBot will ask the key question');
    console.log('  - Answer "Did you consume today, do I reset?" honestly');
    console.log('  - Yes = X resets to 0, No = X increases by 1');
    console.log(`  - Each turn has max ${GAME_CONFIG.MAX_MESSAGES_THREAD} messages\n`);
  }

  private showStatus(): void {
    console.log('\n📊 Current Game Status:');
    console.log(`  X Value: ${this.gameState.x}`);
    console.log(`  Messages used: ${this.gameState.messageCount}/${GAME_CONFIG.MAX_MESSAGES_THREAD}`);
    console.log(`  Game phase: ${this.gameState.currentPhase}`);
    console.log(`  Total turns: ${this.gameState.turnHistory.length}`);
    console.log(`  Active agents: ${this.runtime?.getAgents().length || 0}\n`);
  }

  private async shutdown(): Promise<void> {
    console.log('\n🔄 Shutting down X+1 game...');
    
    if (this.runtime) {
      await this.runtime.shutdown();
    }
    
    this.rl.close();
    
    const totalTurns = this.gameState.turnHistory.length;
    console.log(MESSAGE_TEMPLATES.gameEnd(this.gameState.x, totalTurns));
    console.log('Thanks for playing! 👋');
    
    process.exit(0);
  }
}
