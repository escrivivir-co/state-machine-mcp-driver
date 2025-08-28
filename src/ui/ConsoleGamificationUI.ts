/**
 * Console Gamification UI - Common Component
 * Reusable console interface for state machine games
 */

import * as readline from 'readline';
import { EventEmitter } from 'events';
import { Runtime, RuntimeEvent } from '../runtime/Runtime';
import { Agent, AgentRole, AgentStatus } from '../models/Agent';
import { State } from '../models/State';
import { logger } from '../utils/logger';

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
  DEBUG_MESSAGE = 'debugMessage'
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
      ...config
    };

    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.config.userPrompt
    });

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

      logger.info('Console UI started successfully');

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
    this.displayAgentMessage(agent, content);
    
    this.emit(ConsoleUIEvent.AGENT_MESSAGE, { agent, message });
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
      default:
        this.displayMessage('🔧 Debug commands: on, off, state, agents, stats', 'system');
    }
  }

  private addMessageToThread(message: ConversationMessage): void {
    if (this.currentThread) {
      this.currentThread.messages.push(message);
      this.currentThread.messageCount++;
    }
  }

  private displayAgentMessage(agent: Agent, content: string): void {
    const roleColor = this.getAgentRoleColor(agent.role);
    const agentName = this.colorize(`${agent.name}:`, roleColor, true);
    const messageContent = this.colorize(content, roleColor);
    
    console.log(`\n${agentName} ${messageContent}`);
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
}

/**
 * Export for use in examples
 */
export default ConsoleGamificationUI;
