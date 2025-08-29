/**
 * Console Gamification UI - Common Component
 * Reusable console interface for state machine games
 */

import * as readline from 'readline';
import { EventEmitter } from 'events';
import { Runtime, RuntimeEvent } from '../runtime/Runtime';
import { Agent, AgentRole, AgentStatus } from '../models/Agent';
import { AgentPostulation, AgentPostulationManager, PostulationContext, AgentGreediness } from '../models/AgentPostulation';
import { State } from '../models/State';
import { logger, Logger } from '../utils/logger';

/**
 * Configuration for console UI
 */
export interface ConsoleUIConfig {
  /** Maximum messages per conversation thread */
  maxMessagesPerThread: number;
  /** Game title to display */
  gameTitle: string;
  /** Welcome message */
  welcomeMessage?: string;
  /** Enable debug mode */
  debugMode?: boolean;
  /** Prompt prefix for user input */
  userPrompt?: string;
  /** Colors enabled */
  enableColors?: boolean;
  /** Enable agent postulation system */
  enablePostulations?: boolean;
  /** Auto-select agents when only one postulates */
  autoSelectSingleAgent?: boolean;
}

/**
 * Message in the conversation thread
 */
export interface ConversationMessage {
  /** Message ID */
  id: string;
  /** Who sent the message */
  sender: 'user' | 'agent' | 'system';
  /** Agent ID if sender is agent */
  agentId?: string;
  /** Agent name for display */
  agentName?: string;
  /** Message content */
  content: string;
  /** Message timestamp */
  timestamp: number;
  /** Message metadata */
  metadata?: Record<string, any>;
}

/**
 * Current conversation thread state
 */
export interface ConversationThread {
  /** Thread ID */
  id: string;
  /** Messages in thread */
  messages: ConversationMessage[];
  /** Current message count */
  messageCount: number;
  /** Thread start time */
  startTime: number;
  /** Thread status */
  status: 'active' | 'completed' | 'aborted';
}

/**
 * Console UI Events
 */
export enum ConsoleUIEvent {
  USER_INPUT = 'userInput',
  AGENT_MESSAGE = 'agentMessage',
  THREAD_STARTED = 'threadStarted',
  THREAD_COMPLETED = 'threadCompleted',
  GAME_EXIT = 'gameExit',
  DEBUG_MESSAGE = 'debugMessage',
  AGENT_SELECTION_REQUESTED = 'agentSelectionRequested',
  AGENT_SELECTED = 'agentSelected',
  POSTULATIONS_GENERATED = 'postulationsGenerated'
}

/**
 * Reusable Console Gamification UI
 */
export class ConsoleGamificationUI extends EventEmitter {
  private runtime: Runtime;
  private config: ConsoleUIConfig;
  private rl: readline.Interface;
  private currentThread?: ConversationThread;
  private isGameActive = false;
  private messageIdCounter = 0;
  private postulationManager?: AgentPostulationManager;
  private pendingPostulations: AgentPostulation[] = [];
  private awaitingAgentSelection = false;
  private gameCommands: Map<string, (input: string) => Promise<void>> = new Map();

  // Color codes for console output
  private colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
  };

  constructor(runtime: Runtime, config: ConsoleUIConfig) {
    super();
    this.runtime = runtime;
    this.config = {
      userPrompt: '> ',
      enableColors: true,
      debugMode: false,
      enablePostulations: false,
      autoSelectSingleAgent: true,
      ...config
    };

    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.config.userPrompt
    });

    // Initialize postulation manager if enabled
    if (this.config.enablePostulations) {
      this.postulationManager = new AgentPostulationManager();
    }

    this.setupEventHandlers();
  }

  /**
   * Start the game UI
   */
  async start(): Promise<void> {
    try {
      this.isGameActive = true;
      
      // Display welcome
      this.displayWelcome();
      
      // Initialize runtime if not already done
      if (!this.runtime.getCurrentState) {
        await this.runtime.initialize();
      }

      // Start first conversation thread
      await this.startNewThread();

      // Start input loop
      this.startInputLoop();

      Logger.mcpVerbose('Console UI started successfully');

    } catch (error) {
      logger.error('Failed to start console UI', error as Error);
      throw error;
    }
  }

  /**
   * Stop the game UI
   */
  async stop(): Promise<void> {
    try {
      this.isGameActive = false;
      
      if (this.currentThread && this.currentThread.status === 'active') {
        this.currentThread.status = 'aborted';
        this.emit(ConsoleUIEvent.THREAD_COMPLETED, this.currentThread);
      }

      this.rl.close();
      await this.runtime.shutdown();
      
      this.displayMessage('🎮 Game ended. Thanks for playing!', 'system');
      
      logger.info('Console UI stopped');

    } catch (error) {
      logger.error('Error stopping console UI', error as Error);
      throw error;
    }
  }

  /**
   * Send a message from an agent
   */
  async sendAgentMessage(agentId: string, content: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.currentThread || this.currentThread.status !== 'active') {
      throw new Error('No active conversation thread');
    }

    const agent = this.runtime.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Check thread limits
    if (this.currentThread.messageCount >= this.config.maxMessagesPerThread) {
      await this.completeCurrentThread();
      return;
    }

    const message: ConversationMessage = {
      id: this.generateMessageId(),
      sender: 'agent',
      agentId: agent.id,
      agentName: agent.name,
      content,
      timestamp: Date.now(),
      metadata
    };

    this.addMessageToThread(message);
    this.displayAgentMessage(agent, content, metadata);
    
    this.emit(ConsoleUIEvent.AGENT_MESSAGE, { agent, message });
  }

  /**
   * Send agent message with postulation context (enhanced version)
   */
  async sendAgentMessageWithPostulation(
    agentId: string, 
    content: string, 
    postulation?: AgentPostulation,
    autoSelected = false
  ): Promise<void> {
    // Show selection info if not auto-selected
    if (postulation && !autoSelected && !postulation.metadata?.greedyRandomSelection) {
      console.log(`\n🎯 You selected: ${postulation.agent.name}`);
      console.log(`📝 Reason: ${postulation.reason}\n`);
    } else if (postulation?.metadata?.greedyRandomSelection) {
      console.log(`\n🎲 Randomly selected: ${postulation.agent.name}`);
      console.log(`📝 Reason: ${postulation.reason}\n`);
    }

    // Send the message with postulation metadata
    const metadata = {
      postulation: postulation ? {
        reason: postulation.reason,
        priority: postulation.priority,
        greediness: postulation.greediness,
        autoSelected,
        forcedSelection: postulation.metadata?.forcedGreedySelection || false
      } : undefined
    };

    await this.sendAgentMessage(agentId, content, metadata);
  }

  /**
   * Get current thread status
   */
  getCurrentThread(): ConversationThread | undefined {
    return this.currentThread;
  }

  /**
   * Get active agents
   */
  getActiveAgents(): Agent[] {
    return this.runtime.getAgents().filter(agent => agent.status === AgentStatus.ACTIVE);
  }

  /**
   * Get current game state
   */
  getCurrentState(): State {
    return this.runtime.getCurrentState();
  }

  /**
   * Set the postulation manager (for games that use agent postulations)
   */
  setPostulationManager(manager: AgentPostulationManager): void {
    this.postulationManager = manager;
    this.config.enablePostulations = true;
  }

  /**
   * Generate agent postulations for next message
   */
  generateAgentPostulations(context?: Partial<PostulationContext>): AgentPostulation[] {
    if (!this.postulationManager || !this.currentThread) {
      return [];
    }

    const fullContext: PostulationContext = {
      messageCount: this.currentThread.messageCount,
      maxMessages: this.config.maxMessagesPerThread,
      availableAgents: this.getActiveAgents(),
      gameState: this.runtime.getCurrentState().gameData,
      ...context
    };

    const postulations = this.postulationManager.generatePostulations(fullContext);
    this.pendingPostulations = postulations;
    
    // Automatically display postulation info if debug mode or when many postulations
    if (this.config.debugMode || postulations.length > 1) {
      this.displayPostulationInfo(postulations);
    }
    
    this.emit(ConsoleUIEvent.POSTULATIONS_GENERATED, { postulations, context: fullContext });
    
    return postulations;
  }

  /**
   * Display agent postulations to user for selection
   */
  displayAgentPostulations(postulations: AgentPostulation[]): void {
    if (postulations.length === 0) {
      this.displayMessage('📝 No agents are postulating for the next message', 'system');
      return;
    }

    console.log('\n🎭 Agents postulating for next message:');
    
    postulations.forEach((postulation, index) => {
      const priorityStars = '⭐'.repeat(Math.min(5, Math.max(1, postulation.priority)));
      const greediness = this.formatGreediness(postulation.greediness);
      const agentName = this.colorize(postulation.agent.name, this.getAgentRoleColor(postulation.agent.role), true);
      
      console.log(`  ${index + 1}. ${agentName} ${this.colorize(`(${priorityStars})`, 'yellow')} - ${postulation.reason}`);
      
      if (this.config.debugMode) {
        console.log(`     ${this.colorize(`[${greediness}, weight: ${postulation.weight.toFixed(1)}]`, 'dim')}`);
      }
    });
    
    console.log(`\n${this.colorize('Choose agent (1-' + postulations.length + ') or type your own message:', 'cyan')}`);
  }

  /**
   * Display information about generated postulations (debug/info)
   * Can be overridden by subclasses for custom display
   */
  protected displayPostulationInfo(postulations: AgentPostulation[]): void {
    if (postulations.length === 0) {
      console.log('\n🤐 No agents are postulating this turn');
      console.log('🎲 A greedy random agent will be selected...');
      return;
    }

    console.log(`\n📊 ${postulations.length} agent(s) postulating:`);
    postulations.forEach((p, i) => {
      const priority = '⭐'.repeat(Math.min(3, Math.max(1, Math.floor(p.priority / 2))));
      let agentInfo = `  ${i + 1}. ${p.agent.name} ${priority} - ${p.reason}`;
      
      // Add special indicators
      if (p.metadata?.forcedGreedySelection) {
        agentInfo += ' 🎯';
      }
      if (p.metadata?.greedyRandomSelection) {
        agentInfo += ' 🎲';
      }
      
      console.log(agentInfo);
    });

    // Show helpful info about forced selections
    const forcedSelections = postulations.filter(p => p.metadata?.forcedGreedySelection);
    if (forcedSelections.length > 0) {
      console.log(`\n🎯 ${forcedSelections.length} greedy agent(s) forced to ensure options available`);
    }
  }

  /**
   * Request agent selection from user
   */
  async requestAgentSelection(postulations?: AgentPostulation[]): Promise<void> {
    if (!this.config.enablePostulations) {
      return;
    }

    const activePostulations = postulations || this.generateAgentPostulations();
    
    if (activePostulations.length === 0) {
      // Handle no postulations - select a greedy random agent
      const greedyAgent = this.selectGreedyRandomAgent();
      if (greedyAgent) {
        this.displayMessage('🤐 No agents are postulating this turn', 'system');
        this.displayMessage(`🎲 Selecting greedy random agent: ${greedyAgent.agent.name}`, 'system');
        this.emit(ConsoleUIEvent.AGENT_SELECTED, { postulation: greedyAgent, autoSelected: true });
      }
      return;
    }

    // Auto-select if only one agent and auto-select is enabled
    if (activePostulations.length === 1 && this.config.autoSelectSingleAgent) {
      const selected = activePostulations[0];
      this.displayMessage(`🤖 ${selected.agent.name} is the only agent postulating`, 'system');
      this.emit(ConsoleUIEvent.AGENT_SELECTED, { postulation: selected, autoSelected: true });
      return;
    }

    this.awaitingAgentSelection = true;
    this.displayAgentPostulations(activePostulations);
    
    this.emit(ConsoleUIEvent.AGENT_SELECTION_REQUESTED, { postulations: activePostulations });
  }

  /**
   * Handle agent selection from user input
   */
  handleAgentSelection(input: string): boolean {
    if (!this.awaitingAgentSelection || this.pendingPostulations.length === 0) {
      return false;
    }

    const selection = parseInt(input.trim());
    
    if (isNaN(selection) || selection < 1 || selection > this.pendingPostulations.length) {
      return false; // Not a valid agent selection
    }

    const selectedPostulation = this.pendingPostulations[selection - 1];
    this.awaitingAgentSelection = false;
    this.pendingPostulations = [];
    
    this.displayMessage(`🎯 Selected: ${selectedPostulation.agent.name}`, 'system');
    this.emit(ConsoleUIEvent.AGENT_SELECTED, { postulation: selectedPostulation, autoSelected: false });
    
    return true;
  }

  /**
   * Check if currently awaiting agent selection
   */
  isAwaitingAgentSelection(): boolean {
    return this.awaitingAgentSelection;
  }

  /**
   * Cancel pending agent selection
   */
  cancelAgentSelection(): void {
    this.awaitingAgentSelection = false;
    this.pendingPostulations = [];
  }

  /**
   * Select a greedy random agent when no agents are postulating
   */
  protected selectGreedyRandomAgent(): AgentPostulation | null {
    const activeAgents = this.getActiveAgents();
    if (activeAgents.length === 0) {
      return null;
    }

    // IMPROVED: Prioritize greedy agents more intelligently
    const greedyAgents = activeAgents.filter(agent => {
      const config = this.postulationManager?.getAgentConfigs().get(agent.id);
      return config?.greediness === AgentGreediness.VERY_GREEDY;
    });

    const neutralAgents = activeAgents.filter(agent => {
      const config = this.postulationManager?.getAgentConfigs().get(agent.id);
      return config?.greediness === AgentGreediness.NEUTRAL;
    });

    // Selection priority: Very Greedy > Neutral > Any Available
    let selectedAgents = greedyAgents;
    let greedyType = 'very greedy';
    
    if (selectedAgents.length === 0) {
      selectedAgents = neutralAgents;
      greedyType = 'moderately greedy';
    }
    
    if (selectedAgents.length === 0) {
      selectedAgents = activeAgents;
      greedyType = 'any available';
    }

    const randomAgent = selectedAgents[Math.floor(Math.random() * selectedAgents.length)];

    // Create a postulation with appropriate greediness
    return {
      agent: randomAgent,
      greediness: greedyAgents.includes(randomAgent) ? AgentGreediness.VERY_GREEDY : AgentGreediness.NEUTRAL,
      reason: `selected randomly from ${greedyType} agents when no postulations occurred`,
      priority: 1,
      weight: 1.0,
      metadata: {
        greedyRandomSelection: true,
        selectedFromPool: greedyType,
        poolSize: selectedAgents.length
      }
    };
  }

  /**
   * Check if thread has capacity for more messages
   */
  hasThreadCapacity(): boolean {
    return this.currentThread ? 
      this.currentThread.messageCount < this.config.maxMessagesPerThread : 
      false;
  }

  /**
   * Force complete current thread
   */
  async completeCurrentThread(): Promise<void> {
    if (this.currentThread && this.currentThread.status === 'active') {
      this.currentThread.status = 'completed';
      this.emit(ConsoleUIEvent.THREAD_COMPLETED, this.currentThread);
      
      this.displayMessage(`\n📋 Thread completed (${this.currentThread.messageCount}/${this.config.maxMessagesPerThread} messages)`, 'system');
      
      // Start new thread
      await this.startNewThread();
    }
  }

  /**
   * Register a game command that can be executed by user input
   */
  protected registerGameCommand(command: string, handler: (input: string) => Promise<void>): void {
    this.gameCommands.set(command.toLowerCase(), handler);
  }

  /**
   * Check if input matches a registered game command
   */
  protected async handleGameCommand(input: string): Promise<boolean> {
    const parts = input.toLowerCase().split(' ');
    const command = parts[0];
    
    const handler = this.gameCommands.get(command);
    if (handler) {
      await handler(input);
      return true;
    }
    
    return false;
  }

  /**
   * Show help for available commands (can be overridden by subclasses)
   */
  protected showHelp(): void {
    console.log('\n📖 Available Commands:');
    console.log('  help     - Show this help message');
    console.log('  status   - Show current game status');
    console.log('  exit     - Exit the game');
    console.log('  /debug   - Debug commands (on, off, state, agents, stats)');
    
    if (this.gameCommands.size > 0) {
      console.log('\n🎮 Game-specific commands:');
      for (const command of this.gameCommands.keys()) {
        console.log(`  ${command}    - Game-specific command`);
      }
    }
    
    console.log('');
  }

  /**
   * Show current status (can be overridden by subclasses)
   */
  protected showStatus(): void {
    console.log('\n📊 Current Status:');
    console.log(`  Current thread: ${this.currentThread?.id || 'none'}`);
    console.log(`  Messages: ${this.currentThread?.messageCount || 0}/${this.config.maxMessagesPerThread}`);
    console.log(`  Thread status: ${this.currentThread?.status || 'none'}`);
    console.log(`  Active agents: ${this.getActiveAgents().length}`);
    console.log(`  Game active: ${this.isGameActive}`);
    console.log('');
  }

  // Private methods

  private setupEventHandlers(): void {
    // Runtime events
    this.runtime.on(RuntimeEvent.STATE_TRANSITION, (data) => {
      this.displayMessage(`🔄 State changed: ${data.from} → ${data.to}`, 'system');
      if (this.config.debugMode) {
        this.displayDebug(`Transition trigger: ${data.trigger}`);
      }
    });

    this.runtime.on(RuntimeEvent.AGENT_ADDED, (data) => {
      this.displayMessage(`🤖 ${data.agent.name} joined the game`, 'system');
    });

    this.runtime.on(RuntimeEvent.ACTION_EXECUTED, (data) => {
      if (this.config.debugMode) {
        this.displayDebug(`Action: ${data.action.type} by ${data.agent.name}`);
      }
    });

    this.runtime.on(RuntimeEvent.ERROR_OCCURRED, (data) => {
      this.displayMessage(`❌ Error: ${data.error}`, 'system');
    });

    // Handle process exit
    process.on('SIGINT', async () => {
      await this.stop();
      process.exit(0);
    });
  }

  private displayWelcome(): void {
    this.clearScreen();
    
    const title = this.colorize(this.config.gameTitle, 'cyan', true);
    const border = '='.repeat(this.config.gameTitle.length + 4);
    
    console.log(this.colorize(border, 'cyan'));
    console.log(this.colorize(`  ${title}  `, 'cyan'));
    console.log(this.colorize(border, 'cyan'));
    
    if (this.config.welcomeMessage) {
      console.log(`\n${this.config.welcomeMessage}\n`);
    }

    // Display runtime info
    const state = this.runtime.getCurrentState();
    console.log(this.colorize(`📍 Current State: ${state.currentStateId}`, 'yellow'));
    console.log(this.colorize(`🎯 Max Messages per Thread: ${this.config.maxMessagesPerThread}`, 'yellow'));
    
    const agents = this.getActiveAgents();
    console.log(this.colorize(`🤖 Active Agents: ${agents.map(a => a.name).join(', ')}`, 'yellow'));
    
    console.log('\n' + this.colorize('Type "exit" to quit the game\n', 'dim'));
  }

  private async startNewThread(): Promise<void> {
    this.currentThread = {
      id: `thread-${Date.now()}`,
      messages: [],
      messageCount: 0,
      startTime: Date.now(),
      status: 'active'
    };

    this.emit(ConsoleUIEvent.THREAD_STARTED, this.currentThread);
    this.displayMessage(`\n🎬 New conversation thread started (${this.currentThread.id})`, 'system');
  }

  private startInputLoop(): void {
    this.rl.prompt();
    
    this.rl.on('line', async (input: string) => {
      const trimmedInput = input.trim();
      
      if (!trimmedInput) {
        this.rl.prompt();
        return;
      }

      // Handle exit command
      if (trimmedInput.toLowerCase() === 'exit') {
        await this.stop();
        return;
      }

      // Handle debug commands
      if (trimmedInput.startsWith('/debug')) {
        this.handleDebugCommand(trimmedInput);
        this.rl.prompt();
        return;
      }

      // Process user input
      await this.handleUserInput(trimmedInput);
      this.rl.prompt();
    });

    this.rl.on('close', async () => {
      await this.stop();
    });
  }

  private async handleUserInput(input: string): Promise<void> {
    if (!this.currentThread || this.currentThread.status !== 'active') {
      this.displayMessage('❌ No active conversation thread', 'system');
      return;
    }

    // Check if we're awaiting agent selection
    if (this.awaitingAgentSelection && this.handleAgentSelection(input)) {
      return; // Agent selection was handled
    }

    const trimmedInput = input.trim().toLowerCase();

    // Handle built-in commands
    if (trimmedInput === 'help') {
      this.showHelp();
      return;
    }
    if (trimmedInput === 'status') {
      this.showStatus();
      return;
    }

    // Try game-specific commands
    if (await this.handleGameCommand(input)) {
      return; // Command was handled
    }

    // Check thread capacity
    if (this.currentThread.messageCount >= this.config.maxMessagesPerThread) {
      await this.completeCurrentThread();
      return;
    }

    // Add user message to thread
    const message: ConversationMessage = {
      id: this.generateMessageId(),
      sender: 'user',
      content: input,
      timestamp: Date.now()
    };

    this.addMessageToThread(message);
    this.emit(ConsoleUIEvent.USER_INPUT, { input, message, thread: this.currentThread });
  }

  private handleDebugCommand(command: string): void {
    const parts = command.split(' ');
    const action = parts[1];

    switch (action) {
      case 'on':
        this.config.debugMode = true;
        this.displayMessage('🔧 Debug mode enabled', 'system');
        break;
      case 'off':
        this.config.debugMode = false;
        this.displayMessage('🔧 Debug mode disabled', 'system');
        break;
      case 'state':
        const state = this.runtime.getCurrentState();
        this.displayDebug(`Current state: ${JSON.stringify(state, null, 2)}`);
        break;
      case 'agents':
        const agents = this.getActiveAgents();
        this.displayDebug(`Agents: ${JSON.stringify(agents.map(a => ({ id: a.id, name: a.name, role: a.role })), null, 2)}`);
        break;
      case 'stats':
        const stats = this.runtime.getStatistics();
        this.displayDebug(`Stats: ${JSON.stringify(stats, null, 2)}`);
        break;
      case 'verbose':
        Logger.enableVerbose();
        this.displayMessage('🔊 Verbose logging enabled', 'system');
        break;
      case 'quiet':
        Logger.enableQuiet();
        this.displayMessage('🔇 Quiet logging enabled', 'system');
        break;
      case 'normal':
        Logger.normalMode();
        this.displayMessage('🔧 Normal logging mode enabled', 'system');
        break;
      case 'logmode':
        const currentMode = Logger.getMode();
        this.displayMessage(`📊 Current logging mode: ${currentMode}`, 'system');
        break;
      default:
        this.displayMessage('🔧 Debug commands: on, off, state, agents, stats, verbose, quiet, normal, logmode', 'system');
    }
  }

  private addMessageToThread(message: ConversationMessage): void {
    if (this.currentThread) {
      this.currentThread.messages.push(message);
      this.currentThread.messageCount++;
    }
  }

  private displayAgentMessage(agent: Agent, content: string, metadata?: Record<string, any>): void {
    const roleColor = this.getAgentRoleColor(agent.role);
    const agentName = this.colorize(`${agent.name}:`, roleColor, true);
    const messageContent = this.colorize(content, roleColor);
    
    // Add postulation indicators if available
    let indicators = '';
    if (metadata?.postulation) {
      if (metadata.postulation.forcedSelection) {
        indicators += ' 🎯';
      }
      if (metadata.postulation.autoSelected) {
        indicators += ' 🤖';
      }
    }
    
    console.log(`\n${agentName}${indicators} ${messageContent}`);
  }

  private displayMessage(content: string, type: 'system' | 'user' | 'error' = 'system'): void {
    let color: keyof typeof this.colors = 'white';
    let prefix = '';

    switch (type) {
      case 'system':
        color = 'cyan';
        prefix = '📢 ';
        break;
      case 'error':
        color = 'red';
        prefix = '❌ ';
        break;
      case 'user':
        color = 'green';
        prefix = '👤 ';
        break;
    }

    console.log(this.colorize(`${prefix}${content}`, color));
  }

  private displayDebug(content: string): void {
    if (this.config.debugMode) {
      console.log(this.colorize(`🔧 DEBUG: ${content}`, 'dim'));
    }
  }

  private getAgentRoleColor(role: AgentRole): keyof typeof this.colors {
    switch (role) {
      case AgentRole.NARRATOR:
        return 'magenta';
      case AgentRole.GUIDE:
        return 'blue';
      case AgentRole.PLAYER:
        return 'green';
      case AgentRole.SYSTEM:
        return 'yellow';
      default:
        return 'white';
    }
  }

  private colorize(text: string, color: keyof typeof this.colors, bright = false): string {
    if (!this.config.enableColors) {
      return text;
    }
    
    const colorCode = this.colors[color];
    const brightCode = bright ? this.colors.bright : '';
    return `${brightCode}${colorCode}${text}${this.colors.reset}`;
  }

  private clearScreen(): void {
    console.clear();
  }

  private generateMessageId(): string {
    return `msg-${++this.messageIdCounter}-${Date.now()}`;
  }

  private formatGreediness(greediness: string): string {
    switch (greediness) {
      case 'very_greedy':
        return 'Very Greedy';
      case 'satisfied':
        return 'Satisfied';
      case 'neutral':
        return 'Neutral';
      case 'passive':
        return 'Passive';
      default:
        return greediness;
    }
  }
}

/**
 * Export for use in examples
 */
export default ConsoleGamificationUI;
