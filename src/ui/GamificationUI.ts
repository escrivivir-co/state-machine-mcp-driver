/**
 * Base Gamification UI
 * Common functionality for all gamification interfaces (Console, HTML5, etc.)
 */

import { EventEmitter } from 'events';
import { 
  Observable, 
  Subject, 
  BehaviorSubject, 
  ReplaySubject,
  merge,
  combineLatest,
  timer,
  fromEvent,
  EMPTY
} from 'rxjs';
import { 
  map, 
  filter, 
  tap, 
  catchError, 
  shareReplay, 
  distinctUntilChanged,
  throttleTime,
  bufferTime,
  scan,
  takeUntil
} from 'rxjs/operators';

import { Runtime } from '../runtime/Runtime';
import { MCPDriverAdapter } from '../drivers/MCPDriverAdapter';
import { MCPEvent, MCPEventType } from '../drivers/MCPTypes';
import { Logger } from '../utils/logger';
import { Agent, AgentStatus, AgentRole } from '../models';
import { AgentPostulation, AgentPostulationManager, PostulationContext, AgentGreediness } from '../models/AgentPostulation';

/**
 * Base configuration for all gamification UIs
 */
export interface BaseGamificationUIConfig {
  /** Game title */
  gameTitle: string;
  /** Welcome message */
  welcomeMessage?: string;
  /** Enable debug mode */
  debugMode?: boolean;
  /** Maximum messages per conversation thread */
  maxMessagesPerThread?: number;
  /** Enable agent postulation system */
  enablePostulations?: boolean;
  /** Auto-select agents when only one postulates */
  autoSelectSingleAgent?: boolean;
}

/**
 * Game message (unified across all interfaces)
 */
export interface GameMessage {
  /** Message ID */
  id: string;
  /** Message type */
  type: 'user' | 'agent' | 'system' | 'game' | 'error';
  /** Agent info if applicable */
  agent?: {
    id: string;
    name: string;
    role: AgentRole;
    avatar?: string;
  };
  /** Message content */
  content: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
  /** Message timestamp */
  timestamp: number;
}

/**
 * Game thread state (unified across all interfaces)
 */
export interface GameThread {
  /** Thread ID */
  id: string;
  /** Messages in thread */
  messages: GameMessage[];
  /** Current message count */
  messageCount: number;
  /** Thread start time */
  startTime: number;
  /** Thread status */
  status: 'active' | 'completed' | 'aborted';
}

/**
 * UI interaction phase
 */
export type UIPhase = 'startup' | 'menu' | 'game' | 'postulation' | 'decision' | 'complete' | 'error';

/**
 * Game UI Events (unified)
 */
export enum GamificationUIEvent {
  // Thread events
  THREAD_STARTED = 'threadStarted',
  THREAD_COMPLETED = 'threadCompleted',
  
  // Message events
  USER_INPUT = 'userInput',
  AGENT_MESSAGE = 'agentMessage',
  SYSTEM_MESSAGE = 'systemMessage',
  
  // Agent events
  AGENT_SELECTION_REQUESTED = 'agentSelectionRequested',
  AGENT_SELECTED = 'agentSelected',
  POSTULATIONS_GENERATED = 'postulationsGenerated',
  
  // UI state events
  PHASE_CHANGED = 'phaseChanged',
  STATE_CHANGED = 'stateChanged',
  
  // Game events
  GAME_STARTED = 'gameStarted',
  GAME_STOPPED = 'gameStopped',
  GAME_EXIT = 'gameExit',
  
  // Error events
  ERROR_OCCURRED = 'errorOccurred',
  DEBUG_MESSAGE = 'debugMessage'
}

/**
 * Base Gamification UI
 * Common functionality for all game interfaces
 */
export abstract class GamificationUI extends EventEmitter {
  protected runtime: Runtime;
  protected mcpAdapter: MCPDriverAdapter;
  protected config: BaseGamificationUIConfig;

  // ===== RxJS Reactive Streams =====
  protected destroy$ = new Subject<void>();
  protected gameState$ = new BehaviorSubject<any>(null);
  protected currentThread$ = new BehaviorSubject<GameThread | null>(null);
  protected currentPhase$ = new BehaviorSubject<UIPhase>('startup');
  protected messages$ = new Subject<GameMessage>();
  protected userInput$ = new Subject<string>();
  protected agentSelection$ = new Subject<AgentPostulation>();
  protected mcpEvents$ = new Subject<MCPEvent>();
  protected errors$ = new Subject<Error>();

  // ===== State Management =====
  protected currentThread?: GameThread;
  protected currentPhase: UIPhase = 'startup';
  protected isActive = false;
  protected messageIdCounter = 0;
  protected postulationManager?: AgentPostulationManager;
  protected pendingPostulations: AgentPostulation[] = [];
  protected awaitingAgentSelection = false;

  constructor(
    runtime: Runtime, 
    mcpAdapter: MCPDriverAdapter, 
    config: BaseGamificationUIConfig
  ) {
    super();
    this.runtime = runtime;
    this.mcpAdapter = mcpAdapter;
    this.config = {
      maxMessagesPerThread: 50,
      enablePostulations: false,
      autoSelectSingleAgent: true,
      debugMode: false,
      ...config
    };

    this.setupRxJSStreams();
    this.setupMCPIntegration();
    this.setupRuntimeIntegration();
    
    if (this.config.enablePostulations) {
      this.postulationManager = new AgentPostulationManager();
    }
  }

  // ===== Abstract Methods (to be implemented by subclasses) =====

  /**
   * Start the UI interface
   */
  abstract start(): Promise<void>;

  /**
   * Stop the UI interface
   */
  abstract stop(): Promise<void>;

  /**
   * Display a message to the user
   */
  abstract displayMessage(message: GameMessage): Promise<void>;

  /**
   * Display agent postulations for selection
   */
  abstract displayAgentPostulations(postulations: AgentPostulation[]): Promise<void>;

  /**
   * Display system notification
   */
  abstract displayNotification(title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error'): Promise<void>;

  /**
   * Update UI phase display
   */
  abstract updatePhaseDisplay(phase: UIPhase): Promise<void>;

  // ===== RxJS Reactive Streams Setup =====

  private setupRxJSStreams(): void {
    // Combine all streams for centralized processing
    const allStreams$ = merge(
      this.messages$.pipe(map(msg => ({ type: 'message', data: msg }))),
      this.userInput$.pipe(map(input => ({ type: 'userInput', data: input }))),
      this.agentSelection$.pipe(map(selection => ({ type: 'agentSelection', data: selection }))),
      this.mcpEvents$.pipe(map(event => ({ type: 'mcpEvent', data: event }))),
      this.errors$.pipe(map(error => ({ type: 'error', data: error })))
    );

    // Process all events through a single stream
    allStreams$
      .pipe(
        takeUntil(this.destroy$),
        tap(event => this.logEvent(event)),
        catchError(error => {
          this.errors$.next(error);
          return EMPTY;
        })
      )
      .subscribe(event => this.processEvent(event));

    // Game state changes
    this.gameState$
      .pipe(
        takeUntil(this.destroy$),
        filter(state => state !== null),
        distinctUntilChanged()
      )
      .subscribe(state => this.onGameStateChange(state));

    // Thread changes
    this.currentThread$
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged()
      )
      .subscribe(thread => this.onThreadChange(thread));

    // Phase changes
    this.currentPhase$
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged()
      )
      .subscribe(phase => this.onPhaseChange(phase));

    // User input processing with throttling
    this.userInput$
      .pipe(
        takeUntil(this.destroy$),
        throttleTime(100), // Prevent spam
        filter(input => input.trim().length > 0)
      )
      .subscribe(input => this.processUserInput(input));

    // Agent selection processing
    this.agentSelection$
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(selection => this.processAgentSelection(selection));
  }

  // ===== MCP Integration =====

  private setupMCPIntegration(): void {
    // Listen to MCP events from both native and legacy drivers
    const nativeDriver = this.mcpAdapter.getNativeDriver();
    const legacyDriver = this.mcpAdapter.getLegacyDriver();

    // Native driver events
    if (nativeDriver && typeof nativeDriver.on === 'function') {
      Object.values(MCPEventType).forEach(eventType => {
        nativeDriver.on(eventType, (event: MCPEvent) => {
          this.mcpEvents$.next(event);
        });
      });
    }

    // Legacy driver events
    Object.values(MCPEventType).forEach(eventType => {
      legacyDriver.on(eventType, (event: MCPEvent) => {
        this.mcpEvents$.next(event);
      });
    });

    // MCP events stream processing
    this.mcpEvents$
      .pipe(
        takeUntil(this.destroy$),
        tap(event => this.logMCPEvent(event))
      )
      .subscribe(event => this.handleMCPEvent(event));
  }

  // ===== Runtime Integration =====

  private setupRuntimeIntegration(): void {
    // Runtime state changes
    this.runtime.on('state:transition', (data: any) => {
      this.gameState$.next(data);
      this.displaySystemMessage(`State changed: ${data.from} → ${data.to}`);
    });

    this.runtime.on('agent:added', (data: any) => {
      this.displaySystemMessage(`${data.agent.name} joined the game`);
    });

    this.runtime.on('agent:removed', (data: any) => {
      this.displaySystemMessage(`${data.agent.name} left the game`);
    });

    this.runtime.on('error', (error: Error) => {
      this.errors$.next(error);
    });
  }

  // ===== Public API Methods =====

  /**
   * Send user input (can be called by subclasses or external controllers)
   */
  public sendUserInput(input: string): void {
    this.userInput$.next(input);
  }

  /**
   * Send agent message
   */
  public async sendAgentMessage(agentId: string, content: string, metadata?: Record<string, any>): Promise<void> {
    const agent = this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const message: GameMessage = {
      id: this.generateMessageId(),
      type: 'agent',
      agent: {
        id: agent.id,
        name: agent.name,
        role: agent.role
      },
      content,
      timestamp: Date.now(),
      metadata
    };

    this.addMessageToThread(message);
    await this.displayMessage(message);
    this.messages$.next(message);
    this.emit(GamificationUIEvent.AGENT_MESSAGE, { agent, message });
  }

  /**
   * Send system message
   */
  public async sendSystemMessage(content: string, metadata?: Record<string, any>): Promise<void> {
    const message: GameMessage = {
      id: this.generateMessageId(),
      type: 'system',
      content,
      timestamp: Date.now(),
      metadata
    };

    this.addMessageToThread(message);
    await this.displayMessage(message);
    this.messages$.next(message);
    this.emit(GamificationUIEvent.SYSTEM_MESSAGE, { message });
  }

  /**
   * Generate agent postulations
   */
  public generateAgentPostulations(context?: Partial<PostulationContext>): AgentPostulation[] {
    if (!this.postulationManager || !this.currentThread) {
      return [];
    }

    const fullContext: PostulationContext = {
      messageCount: this.currentThread.messageCount,
      maxMessages: this.config.maxMessagesPerThread || 50,
      availableAgents: this.getActiveAgents(),
      gameState: this.runtime.getCurrentState().gameData,
      ...context
    };

    const postulations = this.postulationManager.generatePostulations(fullContext);
    this.pendingPostulations = postulations;
    
    this.emit(GamificationUIEvent.POSTULATIONS_GENERATED, { postulations, context: fullContext });
    
    return postulations;
  }

  /**
   * Request agent selection
   */
  public async requestAgentSelection(postulations?: AgentPostulation[]): Promise<void> {
    if (!this.config.enablePostulations) {
      return;
    }

    const activePostulations = postulations || this.generateAgentPostulations();
    
    if (activePostulations.length === 0) {
      // No postulations, try greedy random selection
      const greedySelection = this.selectGreedyRandomAgent();
      if (greedySelection) {
        this.agentSelection$.next(greedySelection);
      }
      return;
    }

    // Auto-select if only one agent and auto-select is enabled
    if (activePostulations.length === 1 && this.config.autoSelectSingleAgent) {
      this.agentSelection$.next(activePostulations[0]);
      return;
    }

    this.awaitingAgentSelection = true;
    await this.displayAgentPostulations(activePostulations);
    
    this.emit(GamificationUIEvent.AGENT_SELECTION_REQUESTED, { postulations: activePostulations });
  }

  /**
   * Select agent by index
   */
  public selectAgent(index: number): boolean {
    if (!this.awaitingAgentSelection || this.pendingPostulations.length === 0) {
      return false;
    }

    if (index < 0 || index >= this.pendingPostulations.length) {
      return false;
    }

    const selectedPostulation = this.pendingPostulations[index];
    this.awaitingAgentSelection = false;
    this.pendingPostulations = [];
    
    this.agentSelection$.next(selectedPostulation);
    this.emit(GamificationUIEvent.AGENT_SELECTED, { postulation: selectedPostulation, autoSelected: false });
    
    return true;
  }

  /**
   * Get current game state
   */
  public getCurrentState(): any {
    return this.runtime.getCurrentState();
  }

  /**
   * Get active agents
   */
  public getActiveAgents(): Agent[] {
    return this.runtime.getAgents().filter(agent => agent.status === AgentStatus.ACTIVE);
  }

  /**
   * Get current thread
   */
  public getCurrentThread(): GameThread | undefined {
    return this.currentThread;
  }

  /**
   * Change UI phase
   */
  public changePhase(phase: UIPhase): void {
    this.currentPhase = phase;
    this.currentPhase$.next(phase);
  }

  // ===== Protected Helper Methods =====

  protected async displaySystemMessage(content: string): Promise<void> {
    await this.sendSystemMessage(content);
  }

  protected getAgent(agentId: string): Agent | undefined {
    return this.runtime.getAgent(agentId);
  }

  protected addMessageToThread(message: GameMessage): void {
    if (!this.currentThread) {
      this.startNewThread();
    }

    if (this.currentThread) {
      this.currentThread.messages.push(message);
      this.currentThread.messageCount++;
      this.currentThread$.next(this.currentThread);
    }
  }

  protected startNewThread(): void {
    this.currentThread = {
      id: `thread_${Date.now()}`,
      messages: [],
      messageCount: 0,
      startTime: Date.now(),
      status: 'active'
    };

    this.currentThread$.next(this.currentThread);
    this.emit(GamificationUIEvent.THREAD_STARTED, { thread: this.currentThread });
  }

  protected completeCurrentThread(): void {
    if (this.currentThread) {
      this.currentThread.status = 'completed';
      this.currentThread$.next(this.currentThread);
      this.emit(GamificationUIEvent.THREAD_COMPLETED, { thread: this.currentThread });
    }
  }

  protected generateMessageId(): string {
    return `msg_${++this.messageIdCounter}_${Date.now()}`;
  }

  protected selectGreedyRandomAgent(): AgentPostulation | null {
    const activeAgents = this.getActiveAgents();
    if (activeAgents.length === 0) {
      return null;
    }

    // For now, select a random agent since we don't have greediness property in Agent
    // This can be enhanced when Agent model includes greediness
    const randomAgent = activeAgents[Math.floor(Math.random() * activeAgents.length)];

    return {
      agent: randomAgent,
      greediness: AgentGreediness.NEUTRAL, // Default to neutral
      reason: `selected randomly from available agents when no postulations occurred`,
      priority: 1,
      weight: 1.0,
      metadata: {
        greedyRandomSelection: true,
        selectedFromPool: 'all',
        poolSize: activeAgents.length
      }
    };
  }

  // ===== Event Processing =====

  private processEvent(event: { type: string; data: any }): void {
    switch (event.type) {
      case 'message':
        this.onMessage(event.data);
        break;
      case 'userInput':
        this.onUserInput(event.data);
        break;
      case 'agentSelection':
        this.onAgentSelection(event.data);
        break;
      case 'mcpEvent':
        this.onMCPEvent(event.data);
        break;
      case 'error':
        this.onError(event.data);
        break;
    }
  }

  private async processUserInput(input: string): Promise<void> {
    // Handle built-in commands
    if (input.toLowerCase() === 'exit') {
      await this.stop();
      return;
    }

    // Handle agent selection if awaiting
    if (this.awaitingAgentSelection) {
      const selection = parseInt(input.trim());
      if (!isNaN(selection) && this.selectAgent(selection - 1)) {
        return;
      }
    }

    // Process as user message
    const message: GameMessage = {
      id: this.generateMessageId(),
      type: 'user',
      content: input,
      timestamp: Date.now()
    };

    this.addMessageToThread(message);
    await this.displayMessage(message);
    this.messages$.next(message);
    this.emit(GamificationUIEvent.USER_INPUT, { input, message });
  }

  private async processAgentSelection(selection: AgentPostulation): Promise<void> {
    this.awaitingAgentSelection = false;
    this.pendingPostulations = [];
    
    await this.displayNotification(
      'Agent Selected',
      `${selection.agent.name}: ${selection.reason}`
    );

    // Send agent message based on selection
    await this.sendAgentMessage(
      selection.agent.id,
      `I'm ready to participate! ${selection.reason}`,
      { postulation: selection }
    );
  }

  private handleMCPEvent(event: MCPEvent): void {
    // Handle different MCP event types
    switch (event.type) {
      case MCPEventType.TOOL_EXECUTED:
        this.onMCPToolExecuted(event);
        break;
      case MCPEventType.SERVER_CONNECTED:
        this.onMCPServerConnected(event);
        break;
      case MCPEventType.SERVER_DISCONNECTED:
        this.onMCPServerDisconnected(event);
        break;
      case MCPEventType.SERVER_ERROR:
        this.onMCPServerError(event);
        break;
      default:
        if (this.config.debugMode) {
          Logger.mcpVerbose('GamificationUI: Unhandled MCP event', { event });
        }
    }
  }

  // ===== Event Handlers (can be overridden by subclasses) =====

  protected onMessage(message: GameMessage): void {
    // Default implementation - can be overridden
  }

  protected onUserInput(input: string): void {
    // Default implementation - can be overridden
  }

  protected onAgentSelection(selection: AgentPostulation): void {
    // Default implementation - can be overridden
  }

  protected onMCPEvent(event: MCPEvent): void {
    // Default implementation - can be overridden
  }

  protected onError(error: Error): void {
    Logger.error('GamificationUI Error', error);
    this.displayNotification('Error', error.message, 'error');
  }

  protected onGameStateChange(state: any): void {
    this.emit(GamificationUIEvent.STATE_CHANGED, { state });
  }

  protected onThreadChange(thread: GameThread | null): void {
    // Can be overridden by subclasses
  }

  protected async onPhaseChange(phase: UIPhase): Promise<void> {
    await this.updatePhaseDisplay(phase);
    this.emit(GamificationUIEvent.PHASE_CHANGED, { phase });
  }

  protected onMCPToolExecuted(event: MCPEvent): void {
    if (this.config.debugMode) {
      this.displaySystemMessage(`Tool executed: ${event.data?.toolName}`);
    }
  }

  protected onMCPServerConnected(event: MCPEvent): void {
    this.displaySystemMessage(`MCP Server connected: ${event.serverId}`);
  }

  protected onMCPServerDisconnected(event: MCPEvent): void {
    this.displaySystemMessage(`MCP Server disconnected: ${event.serverId}`);
  }

  protected onMCPServerError(event: MCPEvent): void {
    this.displayNotification(
      'MCP Server Error',
      `Server ${event.serverId}: ${event.data?.error}`,
      'error'
    );
  }

  // ===== Logging =====

  private logEvent(event: { type: string; data: any }): void {
    if (this.config.debugMode) {
      Logger.mcpVerbose('GamificationUI Event', { type: event.type, data: event.data });
    }
  }

  private logMCPEvent(event: MCPEvent): void {
    if (this.config.debugMode) {
      Logger.mcpVerbose('GamificationUI MCP Event', { event });
    }
  }

  // ===== Cleanup =====

  /**
   * Cleanup resources
   */
  public async destroy(): Promise<void> {
    this.destroy$.next();
    this.destroy$.complete();
    
    await this.stop();
    
    this.removeAllListeners();
  }
}

export default GamificationUI;
