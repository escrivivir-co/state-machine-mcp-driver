/**
 * X+1 Game Console Interface (Example)
 *
 * Refactored to EXTEND the reusable src UI component and use the modular
 * postulation system for agent selection.
 */
import { ConsoleGamificationUI, ConsoleUIConfig, ConsoleUIEvent } from '../../src/ui';
import { Runtime } from '../../src/runtime/Runtime';
import { MCPDriverAdapter } from '../../src/drivers/MCPDriverAdapter';
import { AgentStatus } from '../../src/models/Agent';
import { AgentPostulation } from '../../src/models/AgentPostulation';
import {
  createXPlus1RuntimeConfig,
  GAME_CONFIG,
  MESSAGE_TEMPLATES,
} from './game-config';
import { OllamaChatProvider } from '../../src/chat-provider/OllamaChatProvider';
import { XPlus1PostulationSystem } from './XPlus1PostulationSystem';

type GamePhase = 'start' | 'conversation' | 'decision' | 'advancement' | 'end';

export class XPlus1GameConsole extends ConsoleGamificationUI {
  private runtimeInstance: Runtime;
  private mcpDriver: MCPDriverAdapter;
  private chatProvider: OllamaChatProvider;
  private postulationSystem: XPlus1PostulationSystem;

  private gameState = {
    x: 0,
    messageCount: 0,
    isActive: false,
    currentPhase: 'start' as GamePhase,
    turnHistory: [] as Array<{ turn: number; x: number; advance: number; timestamp: number }>,
    simulateUser: true,
  };

  private constructor(runtime: Runtime, mcp: MCPDriverAdapter, chat: OllamaChatProvider, uiConfig: ConsoleUIConfig) {
    super(runtime, uiConfig);
    this.runtimeInstance = runtime;
    this.mcpDriver = mcp;
    this.chatProvider = chat;
    
    // Initialize X+1 postulation system
    this.postulationSystem = new XPlus1PostulationSystem();
    this.setPostulationManager(this.postulationSystem.getManager());

    this.setupX1EventHandlers();
  }

  /**
   * Factory to build the game console with async setup (MCP servers, runtime, chat provider)
   */
  static async create(): Promise<XPlus1GameConsole> {
    // MCP driver and servers with native protocol support
    const mcpDriver = new MCPDriverAdapter({
      useNativeProtocol: process.env.MCP_USE_NATIVE_PROTOCOL === 'true',
      enableFallback: true
    });

    // Configure MCP servers
    await mcpDriver.addServer({
      id: 'xplus1-mcp-machine',
      name: 'X+1 MCP Machine',
      url: process.env.MCP_XPLUS1_URL || 'http://localhost:3001',
      timeout: 5000
    });

    await mcpDriver.addServer({
      id: 'wiki-mcp-browser',
      name: 'Wiki MCP Browser', 
      url: process.env.MCP_WIKI_URL || 'http://localhost:3002',
      timeout: 5000
    });
    
    const runtimeConfig = await createXPlus1RuntimeConfig();

    const runtime = new Runtime(mcpDriver, runtimeConfig);

    // Chat provider with MCP integration
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const defaultModel = process.env.OLLAMA_MODEL || 'GPT-OSS:20b';
    const chatProvider = new OllamaChatProvider({
      baseUrl: ollamaUrl,
      defaultModel,
      defaultTemperature: 0.7,
      defaultMaxTokens: 150,
      enableMCP: true
    }); // MCPDriverAdapter is not required as a second parameter

    const uiConfig: ConsoleUIConfig = {
      maxMessagesPerThread: GAME_CONFIG.MAX_MESSAGES_THREAD,
      gameTitle: 'X+1 Inductive Pattern Game',
      welcomeMessage: MESSAGE_TEMPLATES.gameStart,
      userPrompt: '> ',
      enableColors: true,
      debugMode: false,
      enablePostulations: true,
      autoSelectSingleAgent: false, // Let user choose even with single agent
    };

    return new XPlus1GameConsole(runtime, mcpDriver, chatProvider, uiConfig);
  }

  /**
   * Setup X+1 specific event handlers
   */
  private setupX1EventHandlers(): void {
    // Handle user input for game commands
    this.on(ConsoleUIEvent.USER_INPUT, async ({ input }) => {
      await this.onUserInput(input);
    });

    // Handle agent selection events
    this.on(ConsoleUIEvent.AGENT_SELECTED, async ({ postulation, autoSelected }) => {
      await this.handleAgentSelected(postulation, autoSelected);
    });

    // Handle when postulations are generated
    this.on(ConsoleUIEvent.POSTULATIONS_GENERATED, ({ postulations }) => {
      this.displayPostulationInfo(postulations);
    });
  }

  /**
   * Start the X+1 game, initializing runtime then delegating to base UI start
   */
  async start(): Promise<void> {
    // Initialize runtime first so base UI can show state/agents
    await this.runtimeInstance.initialize();

    // Determine simulation mode from agent status and persist in state
    const simAgent = this.runtimeInstance.getAgent('user-simulator');
    const simEnabled = simAgent?.status === AgentStatus.ACTIVE;
    this.gameState.simulateUser = !!simEnabled;
    try {
      const st = this.runtimeInstance.getCurrentState();
      st.gameData.flags = st.gameData.flags || {};
      st.gameData.flags['userSimulatorEnabled'] = this.gameState.simulateUser;
      await this.runtimeInstance.saveCurrentState();
    } catch {}

    // Start base console UI (welcome, input loop, threads)
    await super.start();

    // Game intro
    // Note: base UI handles prompts and threads; we only print game context here
    this.gameState.isActive = true;
    this.gameState.currentPhase = 'start';
    console.log(MESSAGE_TEMPLATES.turnStart(this.gameState.x, this.gameState.messageCount));
    console.log('\nType "help" for commands, or start conversing with the agents...');

    // Trigger first postulation request
    await this.requestNextAgent();
  }

  /**
   * Request next agent selection using postulation system
   */
  private async requestNextAgent(): Promise<void> {
    if (!this.gameState.isActive || this.gameState.currentPhase === 'decision') {
      return;
    }

    const context = this.postulationSystem.generateContext(
      this.gameState.messageCount,
      GAME_CONFIG.MAX_MESSAGES_THREAD,
      { x: this.gameState.x, flags: { userSimulatorEnabled: this.gameState.simulateUser } },
      undefined, // lastMessage
      false, // needsExplanation  
      false  // needsSupport
    );

    await this.requestAgentSelection(this.generateAgentPostulations(context));
  }

  /**
   * Handle when an agent is selected from postulations
   */
  private async handleAgentSelected(postulation: AgentPostulation, autoSelected: boolean): Promise<void> {
    const agent = postulation.agent;
    
    if (!autoSelected) {
      console.log(`\n🎯 You selected: ${agent.name}`);
      console.log(`📝 Reason: ${postulation.reason}\n`);
    }

    // Simulate agent message (in real implementation, this would trigger chat provider)
    const agentMessage = await this.generateAgentMessage(agent.id, postulation);
    
    // Display the agent message
    await this.sendAgentMessage(agent.id, agentMessage);
    
    this.gameState.messageCount++;
    
    // Check if we should move to decision phase
    if (agent.id === 'justice-bot' && this.shouldEnterDecisionPhase()) {
      this.gameState.currentPhase = 'decision';
      console.log('\n⚖️ JusticeBot: Did you consume today, do I reset?');
      console.log('(Answer with "yes" or "no")');
    } else if (this.gameState.messageCount < GAME_CONFIG.MAX_MESSAGES_THREAD) {
      // Request next agent
      setTimeout(() => this.requestNextAgent(), 1000);
    }
  }

  /**
   * Display information about generated postulations (debug/info)
   */
  private displayPostulationInfo(postulations: AgentPostulation[]): void {
    if (postulations.length === 0) {
      console.log('\n🤐 No agents are postulating this turn');
      return;
    }

    console.log(`\n📊 ${postulations.length} agent(s) postulating:`);
    postulations.forEach((p, i) => {
      const priority = '⭐'.repeat(Math.min(3, Math.max(1, Math.floor(p.priority / 2))));
      console.log(`  ${i + 1}. ${p.agent.name} ${priority} - ${p.reason}`);
    });
  }

  /**
   * Generate a simulated agent message based on postulation
   */
  private async generateAgentMessage(agentId: string, postulation: AgentPostulation): Promise<string> {
    // This is a simplified simulation - in real implementation, 
    // this would use the chat provider with appropriate prompts
    
    const templates = {
      'dionisio-bot': [
        'Life is short! Why deny yourself the small pleasures? That coffee, that snack, that moment of indulgence...',
        'You\'ve been so disciplined lately. Don\'t you think you deserve a little reward?',
        'Come on, live a little! One small indulgence won\'t hurt your progress.',
        'The universe is vast and we are so small. Why not enjoy what little pleasures we can find?'
      ],
      'apolo-bot': [
        'Consider the path of growth. Each "no" to immediate pleasure builds your inner strength.',
        'True fulfillment comes from discipline and conscious choice, not instant gratification.',
        'Remember: you are building habits that will serve your future self.',
        'The strongest trees grow slowly, with deep roots. Same with human character.'
      ],
      'justice-bot': [
        'The moment of truth approaches. How will you choose?',
        'Every decision shapes who you become. Choose wisely.',
        'Balance is key. Both restraint and enjoyment have their place.',
        'The question that matters most is coming...'
      ]
    };

    const agentTemplates = templates[agentId as keyof typeof templates] || ['Ready to proceed.'];
    const randomMessage = agentTemplates[Math.floor(Math.random() * agentTemplates.length)];
    
    return randomMessage;
  }

  /**
   * Determine if we should enter decision phase
   */
  private shouldEnterDecisionPhase(): boolean {
    return this.postulationSystem.shouldJusticeAskQuestion(
      this.gameState.messageCount, 
      GAME_CONFIG.MAX_MESSAGES_THREAD
    );
  }

  // Minimal user input handler for the example; extend as needed
  private async onUserInput(input: string): Promise<void> {
    if (!this.gameState.isActive) {
      return;
    }

    const lower = input.toLowerCase();
    
    if (lower === 'help') {
      this.showHelp();
      return;
    }
    if (lower === 'status') {
      this.showStatus();
      return;
    }
    if (lower === 'quit') {
      await this.stop();
      return;
    }

    // Handle simulator commands
    if (lower.startsWith('sim ') || lower === 'sim') {
      await this.handleSimulatorCommand(input);
      return;
    }

    // Handle decision phase responses
    if (this.gameState.currentPhase === 'decision') {
      await this.handleDecisionPhase(input);
      return;
    }

    // Fallback: echo as a player message and continue game flow
    console.log(`\n👤 Player: ${input}`);
    this.gameState.messageCount++;
    
    // Continue with next agent selection if not in decision phase
    if (this.gameState.messageCount < GAME_CONFIG.MAX_MESSAGES_THREAD) {
      setTimeout(() => this.requestNextAgent(), 1000);
    }
  }

  /**
   * Handle simulator commands (sim on/off/status/toggle)
   */
  private async handleSimulatorCommand(input: string): Promise<void> {
    const parts = input.toLowerCase().split(' ');
    const command = parts[1] || 'status';

    switch (command) {
      case 'on':
        await this.setSimulatorEnabled(true);
        break;
      case 'off':
        await this.setSimulatorEnabled(false);
        break;
      case 'toggle':
        await this.setSimulatorEnabled(!this.gameState.simulateUser);
        break;
      case 'status':
        console.log(`\n🤖 User simulator: ${this.gameState.simulateUser ? 'ENABLED' : 'DISABLED'}`);
        break;
      default:
        console.log('\n📖 Simulator commands: on, off, toggle, status');
    }
  }

  // --- Optional advanced game loop (simplified placeholder) ---
  private async startConversationTurn(): Promise<void> {
    this.gameState.messageCount = 0;
    this.gameState.currentPhase = 'conversation';
    console.log('\n🎭 Starting new conversation turn...');
    console.log(`📝 Messages available: ${GAME_CONFIG.MAX_MESSAGES_THREAD}`);
  }
  // Advanced flow omitted in example subclass

  // Advanced flow omitted in example subclass

  // Advanced flow omitted in example subclass

  // Advanced flow omitted in example subclass

  // Advanced flow omitted in example subclass

  // Advanced flow omitted in example subclass

  // Advanced flow omitted in example subclass

  // Advanced flow omitted in example subclass

  // Advanced flow omitted in example subclass

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
  await this.runtimeInstance.transitionTo('playing', 'positive_advance', {
        advance,
        oldX,
        newX: this.gameState.x
      });
    } else {
  await this.runtimeInstance.transitionTo('start', 'negative_advance', {
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
  const currentState = this.runtimeInstance.getCurrentState();
    // Additional state synchronization logic here
  }

  private updateSimulateModeFromState(): void {
    try {
  const s = this.runtimeInstance.getCurrentState();
      const flag = s?.gameData?.flags?.['userSimulatorEnabled'];
      if (typeof flag === 'boolean') {
        this.gameState.simulateUser = flag;
      }
    } catch {
      // ignore if state not ready
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
  console.log(`  Active agents: ${this.runtimeInstance?.getAgents().length || 0}`);
  console.log(`  User simulator: ${this.gameState.simulateUser ? 'enabled' : 'disabled'}\n`);
  }

  /**
   * Enable or disable the user simulator
   */
  private async setSimulatorEnabled(enabled: boolean): Promise<void> {
    try {
      const st = this.runtimeInstance.getCurrentState();
      st.gameData.flags = st.gameData.flags || {};
      st.gameData.flags['userSimulatorEnabled'] = enabled;
      await this.runtimeInstance.saveCurrentState();
      this.gameState.simulateUser = enabled;
      console.log(`\n🔧 User simulator ${enabled ? 'ENABLED' : 'DISABLED'}`);
    } catch (e) {
      console.log('Failed to update simulator flag in state:', e);
    }
  }

  // Shutdown uses base stop()
  private async shutdown(): Promise<void> {
    console.log('\n🔄 Shutting down X+1 game...');
    await this.stop();
    const totalTurns = this.gameState.turnHistory.length;
    console.log(MESSAGE_TEMPLATES.gameEnd(this.gameState.x, totalTurns));
    console.log('Thanks for playing! 👋');
  }
}
