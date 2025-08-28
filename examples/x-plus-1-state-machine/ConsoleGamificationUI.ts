/**
 * Console Gamification UI for X+1 State Machine
 * 
 * Provides a text-based interface for playing the X+1 inductive pattern game
 * Uses stdin/stdout for user interaction as described in the RE      // Get response from chat provider
      const response = await this.chatProvider.send(conversationId, userPrompt, {
        model: process.env.OLLAMA_MODEL || 'GPT-OSS:20b', // Use configured model
        temperature: AGENT_PROMPTS[agentType].temperature,
        max_tokens: AGENT_PROMPTS[agentType].maxTokens
      }); */

import * as readline from 'readline';
import { Runtime, RuntimeConfig } from '../../src/runtime/Runtime';
import { MCPDriver } from '../../src/drivers/MCPDriver';
import { AgentRole, AgentStatus } from '../../src/models/Agent';
import { xPlus1StateGraph } from './stategraph';
import { 
  createXPlus1RuntimeConfig, 
  GAME_CONFIG, 
  AGENT_PROMPTS, 
  MESSAGE_TEMPLATES,
  type AgentType,
  type GamePhase
} from './game-config';
import { UserSimulator, AgentPostulation } from './user-simulator';
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
  simulateUser: boolean;
  simulator: UserSimulator | null;
  };

  constructor() {
    this.gameState = {
      x: 0,
      messageCount: 0,
      isActive: false,
      currentPhase: 'start',
  turnHistory: [],
  simulateUser: true,
  simulator: null
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
    
    // Use environment variables for MCP server URLs if available
    const xplus1Url = process.env.MCP_XPLUS1_URL || 'http://localhost:3001';
    const wikiUrl = process.env.MCP_WIKI_URL || 'http://localhost:3002';
    
    // Add MCP servers for X+1 game
    this.mcpDriver.addServer({
      id: 'xplus1-mcp-machine',
      name: 'X+1 MCP Machine',
      url: xplus1Url,
      timeout: 5000
    });

    this.mcpDriver.addServer({
      id: 'wiki-mcp-browser', 
      name: 'Wiki MCP Browser',
      url: wikiUrl,
      timeout: 5000
    });
    
    console.log(`🔗 MCP Servers configured:`);
    console.log(`   X+1 Machine: ${xplus1Url}`);
    console.log(`   Wiki Browser: ${wikiUrl}`);
  }

  private setupChatProvider(): void {
    // Use environment variables if available
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const defaultModel = process.env.OLLAMA_MODEL || 'GPT-OSS:20b'; // Updated default
    
    this.chatProvider = new OllamaChatProvider({
      baseUrl: ollamaUrl,
      defaultModel: defaultModel,
      defaultTemperature: 0.7,
      defaultMaxTokens: 150
    });
    
    console.log(`🤖 Chat Provider configured:`);
    console.log(`   Ollama URL: ${ollamaUrl}`);
    console.log(`   Model: ${defaultModel}`);
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

  // Determine simulation mode from runtime agent status, then sync to MCP state flag
  const simAgent = this.runtime.getAgent('user-simulator');
  const simEnabled = simAgent?.status === AgentStatus.ACTIVE;
  this.gameState.simulateUser = !!simEnabled;
  if (simEnabled) this.gameState.simulator = new UserSimulator(simAgent?.config?.personality || 'balanced');
  // Persist initial flag so it can be toggled later from state
  try {
    const st = this.runtime.getCurrentState();
    st.gameData.flags = st.gameData.flags || {};
    st.gameData.flags['userSimulatorEnabled'] = this.gameState.simulateUser;
    await this.runtime.saveCurrentState();
  } catch {}

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
  // Keep simulation mode in sync with MCP state
  this.updateSimulateModeFromState();
    });

    // Keep UI in sync if state is loaded externally
    this.runtime.on('stateLoaded', () => {
      this.updateSimulateModeFromState();
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
    
    console.log('\n🎭 Starting new conversation turn...');
    console.log(`📝 Messages available: ${GAME_CONFIG.MAX_MESSAGES_THREAD}`);
    
    // Start the message allocation loop
    await this.handleNextMessage();
  }

  private async handleNextMessage(): Promise<void> {
    // Check if we need to force JusticeBot question
    const remainingMessages = GAME_CONFIG.MAX_MESSAGES_THREAD - this.gameState.messageCount;
    
    if (remainingMessages <= 2 && this.gameState.currentPhase === 'conversation') {
      // Force transition to decision phase
      this.gameState.currentPhase = 'decision';
      console.log(`\n${MESSAGE_TEMPLATES.questionTime(this.gameState.x)}`);
      
      if (this.gameState.simulateUser) {
        await this.autoSimulateDecision();
      }
      return;
    }

    if (remainingMessages <= 0) {
      // No messages left, force reset
      console.log('\n⏰ No messages remaining! X will be reset to 0.');
      await this.applyAdvancement(-1);
      setTimeout(async () => await this.startNewTurn(), 2000);
      return;
    }

    // Generate agent postulations
    const postulations = this.generateAgentPostulations();
    
    if (this.gameState.simulateUser && this.gameState.simulator) {
      // Simulator decides
      await this.handleSimulatedMessageAssignment(postulations);
    } else {
      // Human user decides
      await this.handleManualMessageAssignment(postulations);
    }
  }

  private generateAgentPostulations(): AgentPostulation[] {
    if (!this.gameState.simulator) {
      // Fallback when no simulator
      return [
        {
          agentId: 'dionisio-bot',
          agentName: 'DionisioBot',
          greediness: 'very_greedy',
          reason: 'wants to speak',
          priority: 2
        },
        {
          agentId: 'apolo-bot',
          agentName: 'ApoloBot',
          greediness: 'very_greedy',
          reason: 'wants to speak',
          priority: 2
        }
      ];
    }

    return this.gameState.simulator.generateAgentPostulations({
      x: this.gameState.x,
      turnHistory: this.gameState.turnHistory,
      messageCount: this.gameState.messageCount,
      maxMessages: GAME_CONFIG.MAX_MESSAGES_THREAD
    });
  }

  private async handleSimulatedMessageAssignment(postulations: AgentPostulation[]): Promise<void> {
    if (!this.gameState.simulator) return;

    const chosenAgentId = this.gameState.simulator.chooseFromPostulations(postulations, {
      x: this.gameState.x,
      turnHistory: this.gameState.turnHistory,
      messageCount: this.gameState.messageCount,
      maxMessages: GAME_CONFIG.MAX_MESSAGES_THREAD
    });

    console.log(`\n🤖 SimUser assigns message ${this.gameState.messageCount + 1} to: ${chosenAgentId}`);
    
    await this.executeAgentMessage(chosenAgentId);
    
    // Continue to next message
    if (this.gameState.currentPhase === 'conversation') {
      setTimeout(() => this.handleNextMessage(), 1000);
    }
  }

  private async handleManualMessageAssignment(postulations: AgentPostulation[]): Promise<void> {
    console.log(`\n📋 Agent Postulations for Message ${this.gameState.messageCount + 1}:`);
    
    if (postulations.length === 0) {
      console.log('   No agents are postulating for messages.');
      console.log('   Ending conversation phase...');
      this.gameState.currentPhase = 'decision';
      console.log(`\n${MESSAGE_TEMPLATES.questionTime(this.gameState.x)}`);
      return;
    }

    postulations.forEach((post, index) => {
      const urgency = post.priority > 5 ? '🚨' : post.greediness === 'very_greedy' ? '🔥' : '📝';
      console.log(`   ${index + 1}. ${urgency} ${post.agentName}: ${post.reason}`);
    });

    console.log('\n📝 Choose an agent by number, or type your own message:');
    console.log('   Commands: 1-N (assign to agent), "quit", "status", "sim on/off"');
    // Human input will be handled by existing handleUserInput method
  }

  private async executeAgentMessage(agentId: string): Promise<void> {
    const agentType = agentId.replace('-bot', '') as AgentType;
    
    if (agentType === 'justice') {
      // JusticeBot triggers decision phase
      this.gameState.currentPhase = 'decision';
      console.log(`\n${MESSAGE_TEMPLATES.questionTime(this.gameState.x)}`);
      this.gameState.messageCount++;
      
      if (this.gameState.simulateUser) {
        await this.autoSimulateDecision();
      }
    } else {
      // Regular agent speaks
      await this.agentSpeak(agentType);
      this.gameState.messageCount++;
    }
  }

  private async autoSimulateDecision(): Promise<void> {
    if (!this.gameState.simulator) return;
    
    const decision = this.gameState.simulator.decideConsumption({
      x: this.gameState.x,
      turnHistory: this.gameState.turnHistory.map(t => ({ advance: t.advance, x: t.x, timestamp: t.timestamp }))
    });

    const input = decision === 'yes' ? 'yes' : 'no';
    console.log(`\n👤 SimUser: ${input}`);
    this.gameState.messageCount++;
    await this.handleDecisionPhase(input);
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

    // Simulator controls
    if (input.toLowerCase().startsWith('sim ')) {
      const [, sub] = input.split(/\s+/, 2);
      if (sub === 'on') {
        await this.setSimulatorEnabled(true);
      } else if (sub === 'off') {
        await this.setSimulatorEnabled(false);
      } else if (sub === 'toggle') {
        await this.setSimulatorEnabled(!this.gameState.simulateUser);
      } else if (sub === 'status') {
        console.log(`\n🔧 Simulator is ${this.gameState.simulateUser ? 'ON' : 'OFF'}`);
      } else {
        console.log('\nUsage: sim on|off|toggle|status');
      }
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

    // Handle numeric selection during conversation phase
    if (this.gameState.currentPhase === 'conversation') {
      const num = parseInt(input.trim());
      if (!isNaN(num) && num >= 1) {
        await this.handleAgentSelection(num);
        this.rl.prompt();
        return;
      }
    }

    // Handle game input for decision phase
    if (this.gameState.currentPhase === 'decision') {
      console.log(`\n👤 Player: ${input}`);
      this.gameState.messageCount++;
      await this.handleDecisionPhase(input);
      this.rl.prompt();
      return;
    }

    // Regular conversation message
    console.log(`\n👤 Player: ${input}`);
    this.gameState.messageCount++;
    
    // Continue to next message allocation
    await this.handleNextMessage();
    this.rl.prompt();
  }

  private async handleAgentSelection(selection: number): Promise<void> {
    const postulations = this.generateAgentPostulations();
    
    if (selection > postulations.length) {
      console.log(`\n❌ Invalid selection. Choose 1-${postulations.length}`);
      return;
    }

    const selectedAgent = postulations[selection - 1];
    console.log(`\n✅ Assigned message ${this.gameState.messageCount + 1} to ${selectedAgent.agentName}`);
    
    await this.executeAgentMessage(selectedAgent.agentId);
    
    // Continue to next message if still in conversation phase
    if (this.gameState.currentPhase === 'conversation') {
      await this.handleNextMessage();
    }
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

    // Ask MCP to evaluate the advancement decision
    try {
      const evalRes = await this.mcpDriver.executeTool('xplus1-mcp-machine', 'evaluate_advancement', {
        userInput: answer
      });
      const payloadText = evalRes?.content?.[0]?.text;
      const payload = payloadText ? JSON.parse(payloadText) : evalRes;
      const decision = payload.decision as 'advance' | 'reset' | 'clarify' | undefined;

      if (decision === 'reset') {
        advance = -1;
        console.log('\n⚖️ JusticeBot: You chose consumption. X will be reset to 0.');
        await this.mcpDriver.executeTool('xplus1-mcp-machine', 'reset_x', {
          reason: 'user_consumed',
          metadata: { source: 'user-simulator' }
        });
      } else if (decision === 'advance') {
        advance = 1;
        console.log('\n⚖️ JusticeBot: You chose restraint. X will advance by 1.');
        await this.mcpDriver.executeTool('xplus1-mcp-machine', 'advance_x', {
          reason: 'user_did_not_consume',
          metadata: { source: 'user-simulator' }
        });
      } else {
        console.log('\n⚖️ JusticeBot: Please answer clearly with "yes" or "no". Did you consume today, do I reset?');
        return;
      }

      // Sync X with server status
      const status = await this.mcpDriver.executeTool('xplus1-mcp-machine', 'get_x_status', {});
      const statusText = status?.content?.[0]?.text;
      const statusObj = statusText ? JSON.parse(statusText) : status;
      const serverX = statusObj.currentX ?? this.gameState.x;

      await this.applyAdvancement(advance, serverX);
    } catch (err) {
      console.error('❌ MCP evaluation/apply failed:', err);
      // Fallback: local apply
      if (answer.includes('yes') || answer.includes('y')) {
        advance = -1;
      } else if (answer.includes('no') || answer.includes('n')) {
        advance = 1;
      } else {
        console.log('\n⚖️ JusticeBot: Please answer clearly with "yes" or "no". Did you consume today, do I reset?');
        return;
      }
      await this.applyAdvancement(advance);
    }
    
    // Start new turn
    setTimeout(async () => {
      await this.startNewTurn();
    }, 2000);
  }

  private async applyAdvancement(advance: number, newXOverride?: number): Promise<void> {
    const oldX = this.gameState.x;

    if (typeof newXOverride === 'number') {
      this.gameState.x = newXOverride;
    } else if (advance > 0) {
      this.gameState.x++;
    } else {
      this.gameState.x = 0;
    }

    // Transition based on sign
    if (advance > 0) {
      await this.runtime.transitionTo('playing', 'positive_advance', {
        advance,
        oldX,
        newX: this.gameState.x
      });
    } else {
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

  private async startNewTurn(): Promise<void> {
    this.gameState.messageCount = 0;
    this.gameState.currentPhase = 'start';
    
    console.log('\n' + '='.repeat(50));
    console.log(MESSAGE_TEMPLATES.turnStart(this.gameState.x, this.gameState.messageCount));
    console.log('New conversation turn begins...');
    
    // Start new conversation
    await this.startConversationTurn();
  }

  private updateGameStateFromTransition(data: any): void {
    // Update game state based on runtime state transitions
    const currentState = this.runtime.getCurrentState();
    // Additional state synchronization logic here
  }

  private updateSimulateModeFromState(): void {
    try {
      const s = this.runtime.getCurrentState();
      const flag = s?.gameData?.flags?.['userSimulatorEnabled'];
      if (typeof flag === 'boolean') {
        this.gameState.simulateUser = flag;
        // lazily create simulator if turned on and missing
        if (flag && !this.gameState.simulator) {
          const simAgent = this.runtime.getAgent('user-simulator');
          this.gameState.simulator = new UserSimulator(simAgent?.config?.personality || 'balanced');
        }
      }
    } catch {
      // ignore if state not ready
    }
  }

  private async setSimulatorEnabled(enabled: boolean): Promise<void> {
    try {
      const st = this.runtime.getCurrentState();
      st.gameData.flags = st.gameData.flags || {};
      st.gameData.flags['userSimulatorEnabled'] = enabled;
      await this.runtime.saveCurrentState();
      this.gameState.simulateUser = enabled;
      if (enabled && !this.gameState.simulator) {
        const simAgent = this.runtime.getAgent('user-simulator');
        this.gameState.simulator = new UserSimulator(simAgent?.config?.personality || 'balanced');
      }
      console.log(`\n🔧 Simulator ${enabled ? 'ENABLED' : 'DISABLED'}`);
    } catch (e) {
      console.log('Failed to update simulator flag in state:', e);
    }
  }

  private showHelp(): void {
    console.log('\n📖 X+1 Game Commands:');
    console.log('  help    - Show this help message');
    console.log('  status  - Show current game status');
    console.log('  quit    - Exit the game');
    console.log('  sim on/off/toggle/status - Control user simulator');
    console.log('\n🎯 How to play:');
    console.log('  - Each turn has up to 10 messages');
    console.log('  - Agents postulate for messages based on their greediness:');
    console.log('    • DionisioBot & ApoloBot: Very greedy (want many messages)');
    console.log('    • JusticeBot: Satisfied (just needs to ask the question)');
    console.log('  - Choose agents by number (1, 2, 3...) or type your own message');
    console.log('  - JusticeBot will eventually ask: "Did you consume today, do I reset?"');
    console.log('  - Answer honestly: Yes = X resets to 0, No = X increases by 1');
    console.log('  - Goal: Keep X growing by choosing restraint over consumption');
    console.log('\n🤖 Simulator Mode:');
    console.log('  - When ON: AI makes all decisions automatically');
    console.log('  - When OFF: You control agent selection and answers\n');
  }

  private showStatus(): void {
    console.log('\n📊 Current Game Status:');
    console.log(`  X Value: ${this.gameState.x}`);
    console.log(`  Messages used: ${this.gameState.messageCount}/${GAME_CONFIG.MAX_MESSAGES_THREAD}`);
    console.log(`  Game phase: ${this.gameState.currentPhase}`);
    console.log(`  Total turns: ${this.gameState.turnHistory.length}`);
  console.log(`  Active agents: ${this.runtime?.getAgents().length || 0}`);
  console.log(`  User simulator: ${this.gameState.simulateUser ? 'enabled' : 'disabled'}\n`);
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
