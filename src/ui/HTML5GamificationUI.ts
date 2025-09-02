/**
 * HTML5 Gamification UI with RxJS
 * Web-based interface for state machine games using reactive streams and MCPDriverAdapter
 */

import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { 
  Observable, 
  Subject, 
  timer} from 'rxjs';
import { 
  filter, 
  tap, 
  throttleTime,
  takeUntil
} from 'rxjs/operators';

import { Runtime } from '../runtime/Runtime';
import { MCPDriverAdapter } from '../drivers/MCPDriverAdapter';
import { 
  GamificationUI, 
  BaseGamificationUIConfig, 
  GameMessage, 
  UIPhase,
  GamificationUIEvent
} from './GamificationUI';
import { 
  AgentPostulation, 
  AgentPostulationManager,
  PostulationContext 
} from '../models/AgentPostulation';
import { Agent, AgentRole } from '../models/Agent';
import { ConversationThread } from './ConversationThread';
import { ConversationMessage } from './ConversationMessage';
import { AlephScriptClient } from '../clients/alephscript-client';
import { IOrchestratorChannels } from '../orchestration/types';
import { Logger } from '../utils/logger';

/**
 * Configuration for HTML5 Game UI (extends base config)
 */
export interface HTML5GameUIConfig extends BaseGamificationUIConfig {
  /** Port for web server */
  port: number;
  /** Maximum concurrent connections */
  maxConnections?: number;
  /** Enable voice input */
  enableVoice?: boolean;
  /** Enable mobile optimization */
  enableMobile?: boolean;
  /** Custom CSS theme */
  customTheme?: string;
  /** Static assets directory */
  staticDir?: string;
}

/**
 * Connected web client
 */
export interface WebClient {
  /** Connection ID */
  id: string;
  /** User agent string */
  userAgent: string;
  /** Connection timestamp */
  connectedAt: number;
  /** Last activity timestamp */
  lastActivity: number;
  /** Client metadata */
  metadata?: Record<string, any>;
}

/**
 * Web UI event data
 */
export interface WebEventData {
  type: 'user_input' | 'agent_selection' | 'heartbeat' | 'connection';
  clientId: string;
  data: any;
  timestamp: number;
}

/**
 * HTML5 Gamification UI
 * Web-based interface using Server-Sent Events and Fetch API (no Socket.IO)
 */
export class HTML5GamificationUI extends GamificationUI {
  private htmlConfig: HTML5GameUIConfig;
  private app!: express.Application; // Initialized in setupExpressApp
  private server: any;
  
  // Web-specific state
  private connectedClients: Map<string, WebClient> = new Map();
  private isServerRunning = false;
  private currentTheme: 'light' | 'dark' | 'game' = 'game';
  
  // RxJS streams for web events
  private webEvents$ = new Subject<WebEventData>();
  private clientConnections$ = new Subject<{ type: 'connect' | 'disconnect'; client: WebClient }>();
  private sseClients = new Set<express.Response>();

  // ===== Orchestrator Integration =====
  private proserpinaBot!: AlephScriptClient;
  private orchestratorChannels?: IOrchestratorChannels;

  // ===== Agent Postulation System =====
  protected postulationManager?: AgentPostulationManager;
  protected pendingPostulations: AgentPostulation[] = [];
  protected awaitingAgentSelection = false;
  protected currentThread?: ConversationThread;
  protected messageIdCounter = 0;

  constructor(
    runtime: Runtime, 
    mcpAdapter: MCPDriverAdapter, 
    config: HTML5GameUIConfig
  ) {
    // Call parent constructor with base config
    super(runtime, mcpAdapter, config);
    
    this.htmlConfig = {
      maxConnections: 10,
      enableVoice: false,
      enableMobile: true,
      staticDir: path.join(__dirname, '../../public'),
      ...config
    };

    // Initialize AlephScript client (Proserpina)
    this.initAlephScriptClient();

    // Initialize PostulationManager if postulations are enabled
    if (this.config.enablePostulations) {
      this.postulationManager = new AgentPostulationManager();
    }

    this.setupWebStreams();
    this.setupExpressApp();
  }

  // ===== AlephScript Integration =====

  /**
   * Initialize AlephScript client (Proserpina) for orchestrator communication
   */
  private initAlephScriptClient(): void {
    this.proserpinaBot = new AlephScriptClient(
      `HTML5UI_${this.config.gameTitle}`,
      'http://localhost:3000',
      '/runtime',
      true
    );

    Logger.info(`🤖 Initialized AlephScript client (Proserpina) for HTML5UI: ${this.config.gameTitle}`);
  }

  /**
   * Connect to orchestrator channels for synchronized communication
   */
  public connectOrchestrator(channels: IOrchestratorChannels): void {
    this.orchestratorChannels = channels;
    
    // Initialize sys channel integration
    this.proserpinaBot.initializeSysChannelIntegration(channels);

    // Subscribe to UI channel messages
    channels.ui.subscribe((message) => {
      this.handleOrchestratorUIMessage(message);
    });

    // Subscribe to app channel messages for agent updates
    channels.app.subscribe((message) => {
      this.handleOrchestratorAppMessage(message);
    });

    Logger.info('🔗 HTML5UI connected to orchestrator channels');
  }

  /**
   * Handle UI messages from orchestrator
   */
  private handleOrchestratorUIMessage(message: any): void {
    switch (message.type) {
      case 'agent_postulations':
        this.broadcastSSE('agent_postulations', message.payload);
        break;
      case 'phase_change':
        this.changePhase(message.payload.phase);
        break;
      case 'render_request':
        this.handleRenderRequest(message);
        break;
      default:
        if (this.config.debugMode) {
          Logger.debug(`HTML5UI: Unhandled UI message type: ${message.type}`, message);
        }
    }
  }

  /**
   * Handle app messages from orchestrator
   */
  private handleOrchestratorAppMessage(message: any): void {
    switch (message.type) {
      case 'agent_message':
        this.displayAgentMessageFromOrchestrator(message.payload);
        break;
      case 'game_state_update':
        this.broadcastSSE('game_state_update', message.payload);
        break;
      default:
        if (this.config.debugMode) {
          Logger.debug(`HTML5UI: Unhandled app message type: ${message.type}`, message);
        }
    }
  }

  /**
   * Display agent message from orchestrator
   */
  private async displayAgentMessageFromOrchestrator(payload: any): Promise<void> {
    const message: GameMessage = {
      id: this.generateMessageId(),
      type: 'agent',
      agent: payload.agent,
      content: payload.content,
      metadata: payload.metadata,
      timestamp: Date.now()
    };

    await this.displayMessage(message);
  }

  /**
   * Handle render requests from orchestrator
   */
  private handleRenderRequest(message: any): void {
    // Broadcast render request to web clients
    this.broadcastSSE('render_request', message.payload);
  }

  // ===== Agent Postulation System =====

  /**
   * Set the postulation manager (for games that use agent postulations)
   */
  public setPostulationManager(manager: AgentPostulationManager): void {
    this.postulationManager = manager;
  }

  /**
   * Generate agent postulations for next message
   */
  public async generateAgentPostulations(context?: Partial<PostulationContext>): Promise<AgentPostulation[]> {
    if (!this.postulationManager || !this.currentThread) {
      return [];
    }

    const fullContext: PostulationContext = {
      messageCount: this.currentThread.messageCount,
      maxMessages: this.config.maxMessagesPerThread || 10,
      gameState: this.getCurrentState(),
      lastMessage: this.currentThread.messages[this.currentThread.messages.length - 1]?.content,
      availableAgents: await this.getActiveAgents(),
      ...context
    };

    const postulations = this.postulationManager.generatePostulations(fullContext);
    
    // Store for web client selection
    this.pendingPostulations = postulations;
    
    if (this.config.debugMode) {
      Logger.debug(`HTML5UI: Generated ${postulations.length} agent postulations`, postulations);
    }

    return postulations;
  }

  /**
   * Send user input through orchestrator channels
   */
  public sendUserInputThroughOrchestrator(input: string, clientId: string): void {
    if (this.orchestratorChannels) {
      this.orchestratorChannels.ui.send({
        type: 'user_input',
        payload: { input },
        source: 'HTML5UI',
        metadata: { clientId }
      });
    }

    // Also process locally
    this.sendUserInput(input);
  }

  /**
   * Send agent selection through orchestrator
   */
  public sendAgentSelectionThroughOrchestrator(agentIndex: number, clientId: string): void {
    if (this.orchestratorChannels && this.pendingPostulations[agentIndex]) {
      const selectedPostulation = this.pendingPostulations[agentIndex];
      
      this.orchestratorChannels.app.send({
        type: 'agent_command',
        payload: { 
          agentId: selectedPostulation.agent.id,
          command: 'select_agent',
          data: { 
            postulation: selectedPostulation, 
            clientId,
            agentIndex 
          }
        },
        source: 'HTML5UI',
      });

      // Clear pending postulations
      this.pendingPostulations = [];
      this.awaitingAgentSelection = false;
    }
  }

  /**
   * Generate unique message ID
   */
  protected generateMessageId(): string {
    return `html5_msg_${++this.messageIdCounter}_${Date.now()}`;
  }

  // ===== Abstract Method Implementations =====

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.htmlConfig.port, () => {
        this.isServerRunning = true;
        this.isActive = true;
        this.changePhase('menu');
        
        // Start AlephScript connection
        if (this.proserpinaBot) {
          this.proserpinaBot.run();
        }
        
        Logger.info(`HTML5 Game UI started on port ${this.htmlConfig.port}`);
        console.log(`🌐 Game UI available at: http://localhost:${this.htmlConfig.port}`);
        console.log(`🤖 Proserpina (AlephScript client) initialized for orchestrator communication`);
        
        this.emit(GamificationUIEvent.GAME_STARTED);
        resolve();
      });

      this.server.on('error', (error: Error) => {
        Logger.error('Failed to start HTML5 Game UI server', error);
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all SSE connections
      this.sseClients.forEach(res => {
        res.end();
      });
      this.sseClients.clear();

      // Disconnect AlephScript client
      if (this.proserpinaBot) {
        this.proserpinaBot.disconnect();
      }

      if (this.server) {
        this.server.close(() => {
          this.isServerRunning = false;
          this.isActive = false;
          
          Logger.info('HTML5 Game UI server stopped');
          Logger.info('🤖 Proserpina (AlephScript client) disconnected');
          this.emit(GamificationUIEvent.GAME_STOPPED);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async displayMessage(message: GameMessage): Promise<void> {
    const messageData = {
      ...message,
      timestamp: Date.now()
    };

    // Broadcast to all connected clients via SSE
    this.broadcastSSE('message', messageData);
    
    // Log for debugging
    if (this.config.debugMode) {
      Logger.mcpVerbose('HTML5UI: Displaying message', { message: messageData });
    }
  }

  async displayAgentPostulations(postulations: AgentPostulation[]): Promise<void> {
    const postulationData = {
      postulations: postulations.map(p => ({
        agentId: p.agent.id,
        agentName: p.agent.name,
        agentRole: p.agent.role,
        reason: p.reason,
        priority: p.priority,
        greediness: p.greediness,
        weight: p.weight
      })),
      timestamp: Date.now()
    };

    this.broadcastSSE('agent_postulations', postulationData);
    
    if (this.config.debugMode) {
      Logger.mcpVerbose('HTML5UI: Displaying agent postulations', { count: postulations.length });
    }
  }

  async displayNotification(
    title: string, 
    message: string, 
    type: 'info' | 'success' | 'warning' | 'error' = 'info'
  ): Promise<void> {
    const notification = {
      title,
      message,
      type,
      timestamp: Date.now()
    };

    this.broadcastSSE('notification', notification);
  }

  async updatePhaseDisplay(phase: UIPhase): Promise<void> {
    const phaseData = {
      phase,
      timestamp: Date.now()
    };

    this.broadcastSSE('phase_change', phaseData);
    
    if (this.config.debugMode) {
      Logger.mcpVerbose('HTML5UI: Phase changed', { phase });
    }
  }

  // ===== Web-Specific Methods =====

  /**
   * Broadcast message to all clients via Server-Sent Events
   */
  private broadcastSSE(event: string, data: any): void {
    if (!this.sseClients || this.sseClients.size === 0) {
      return; // No clients connected
    }
    
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    
    this.sseClients.forEach(res => {
      try {
        res.write(message);
      } catch (error) {
        // Remove dead connections
        this.sseClients.delete(res);
      }
    });
  }

  /**
   * Set the visual theme for all clients
   */
  public async setTheme(theme: 'light' | 'dark' | 'game'): Promise<void> {
    this.currentTheme = theme;
    this.broadcastSSE('theme_change', { theme });
  }

  /**
   * Get connected clients count
   */
  public getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get connected clients info
   */
  public getConnectedClients(): WebClient[] {
    return Array.from(this.connectedClients.values());
  }

  // ===== Express App Setup =====

  private setupExpressApp(): void {
    this.app = express();
    
    // Middleware
    this.app.use(express.json());
    this.app.use(express.static(this.htmlConfig.staticDir || path.join(__dirname, '../../public')));
    
    // CORS headers for SSE
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });

    // === Routes ===

    // Main game page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../../public/game.html'));
    });

    // Game status API
    this.app.get('/api/status', (req, res) => {
      res.json({
        gameTitle: this.config.gameTitle,
        isActive: this.isActive,
        connectedClients: this.connectedClients.size,
        currentPhase: this.currentPhase,
        maxConnections: this.htmlConfig.maxConnections
      });
    });

    // Game configuration API
    this.app.get('/api/config', (req, res) => {
      res.json({
        gameTitle: this.config.gameTitle,
        welcomeMessage: this.config.welcomeMessage,
        enableVoice: this.htmlConfig.enableVoice,
        enableMobile: this.htmlConfig.enableMobile,
        debugMode: this.config.debugMode,
        enablePostulations: this.config.enablePostulations
      });
    });

    // Server-Sent Events endpoint
    this.app.get('/events', (req, res) => {
      this.handleSSEConnection(req, res);
    });

    // User input endpoint
    this.app.post('/api/input', (req, res) => {
      this.handleUserInput(req, res);
    });

    // Agent selection endpoint
    this.app.post('/api/select-agent', (req, res) => {
      this.handleAgentSelection(req, res);
    });

    // Game action endpoint
    this.app.post('/api/action', (req, res) => {
      this.handleGameAction(req, res);
    });

    // === New Agent Postulation Routes ===

    // Get agent postulations
    this.app.get('/api/postulations', (req, res) => {
      this.handleGetPostulations(req, res);
    });

    // Generate new postulations
    this.app.post('/api/postulations/generate', (req, res) => {
      this.handleGeneratePostulations(req, res);
    });

    // Get active agents
    this.app.get('/api/agents', (req, res) => {
      this.handleGetAgents(req, res);
    });

    // Get current game state
    this.app.get('/api/game-state', (req, res) => {
      this.handleGetGameState(req, res);
    });

    // Get current conversation thread
    this.app.get('/api/thread', (req, res) => {
      this.handleGetCurrentThread(req, res);
    });

    // Start new conversation thread
    this.app.post('/api/thread/start', (req, res) => {
      this.handleStartNewThread(req, res);
    });

    // Complete current thread
    this.app.post('/api/thread/complete', (req, res) => {
      this.handleCompleteThread(req, res);
    });

    // Create HTTP server
    this.server = createServer(this.app);
  }

  // ===== Web Streams Setup =====

  private setupWebStreams(): void {
    // Process web events
    this.webEvents$
      .pipe(
        takeUntil(this.destroy$),
        throttleTime(10), // Prevent spam
        tap(event => this.logWebEvent(event))
      )
      .subscribe(event => this.processWebEvent(event));

    // Handle client connections/disconnections
    this.clientConnections$
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(event => this.onClientConnectionChange(event));

    // Heartbeat timer for client health
    timer(0, 30000) // Every 30 seconds
      .pipe(
        takeUntil(this.destroy$),
        filter(() => this.isServerRunning)
      )
      .subscribe(() => this.sendHeartbeat());
  }

  // ===== HTTP Handlers =====

  private handleSSEConnection(req: express.Request, res: express.Response): void {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userAgent = req.get('User-Agent') || 'Unknown';

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Create client record
    const client: WebClient = {
      id: clientId,
      userAgent,
      connectedAt: Date.now(),
      lastActivity: Date.now()
    };

    this.connectedClients.set(clientId, client);
    this.sseClients.add(res);

    // Send initial state
    const initialData = {
      clientId,
      gameState: {
        title: this.config.gameTitle,
        phase: this.currentPhase,
        welcomeMessage: this.config.welcomeMessage
      },
      timestamp: Date.now()
    };
    
    res.write(`event: initial_state\ndata: ${JSON.stringify(initialData)}\n\n`);

    // Handle client disconnect
    res.on('close', () => {
      this.connectedClients.delete(clientId);
      this.sseClients.delete(res);
      
      this.clientConnections$.next({
        type: 'disconnect',
        client
      });
    });

    this.clientConnections$.next({
      type: 'connect',
      client
    });

    Logger.info(`HTML5UI: Client connected ${clientId} (${userAgent})`);
  }

  private handleUserInput(req: express.Request, res: express.Response): void {
    const { input, clientId } = req.body;
    
    if (!input || !clientId) {
      res.status(400).json({ error: 'Missing input or clientId' });
      return;
    }

    const client = this.connectedClients.get(clientId);
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    // Update client activity
    client.lastActivity = Date.now();

    // Send through orchestrator if connected
    if (this.orchestratorChannels) {
      this.sendUserInputThroughOrchestrator(input, clientId);
    } else {
      // Fallback to local processing
      this.webEvents$.next({
        type: 'user_input',
        clientId,
        data: { input },
        timestamp: Date.now()
      });
    }

    res.json({ success: true });
  }

  private handleAgentSelection(req: express.Request, res: express.Response): void {
    const { agentIndex, clientId } = req.body;
    
    if (agentIndex === undefined || !clientId) {
      res.status(400).json({ error: 'Missing agentIndex or clientId' });
      return;
    }

    const client = this.connectedClients.get(clientId);
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    // Update client activity
    client.lastActivity = Date.now();

    // Validate agent index
    if (agentIndex < 0 || agentIndex >= this.pendingPostulations.length) {
      res.status(400).json({ error: 'Invalid agent index' });
      return;
    }

    // Send through orchestrator if connected
    if (this.orchestratorChannels) {
      this.sendAgentSelectionThroughOrchestrator(agentIndex, clientId);
    } else {
      // Fallback to local selection
      const success = this.selectAgent(agentIndex);
      if (!success) {
        res.status(400).json({ error: 'Failed to select agent' });
        return;
      }
    }
    
    res.json({ 
      success: true,
      selectedAgent: this.pendingPostulations[agentIndex]?.agent.name
    });
  }

  private handleGameAction(req: express.Request, res: express.Response): void {
    const { action, payload, clientId } = req.body;
    
    if (!action || !clientId) {
      res.status(400).json({ error: 'Missing action or clientId' });
      return;
    }

    const client = this.connectedClients.get(clientId);
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    // Update client activity
    client.lastActivity = Date.now();

    // Emit web event
    this.webEvents$.next({
      type: 'user_input', // Treat game actions as user input
      clientId,
      data: { action, payload },
      timestamp: Date.now()
    });

    res.json({ success: true });
  }

  // ===== New Agent Postulation HTTP Handlers =====

  /**
   * Get current agent postulations
   */
  private handleGetPostulations(req: express.Request, res: express.Response): void {
    res.json({
      postulations: this.pendingPostulations.map(p => ({
        agentId: p.agent.id,
        agentName: p.agent.name,
        agentRole: p.agent.role,
        reason: p.reason,
        priority: p.priority,
        greediness: p.greediness,
        weight: p.weight,
        metadata: p.metadata
      })),
      awaitingSelection: this.awaitingAgentSelection,
      timestamp: Date.now()
    });
  }

  /**
   * Generate new agent postulations
   */
  private async handleGeneratePostulations(req: express.Request, res: express.Response): Promise<void> {
    const { context, clientId } = req.body;

    try {
      const postulations = await this.generateAgentPostulations(context);
      
      // Set awaiting selection flag
      this.awaitingAgentSelection = postulations.length > 0;

      // Broadcast to all clients
      this.broadcastSSE('agent_postulations_generated', {
        postulations: postulations.map(p => ({
          agentId: p.agent.id,
          agentName: p.agent.name,
          agentRole: p.agent.role,
          reason: p.reason,
          priority: p.priority,
          greediness: p.greediness,
          weight: p.weight
        })),
        clientId,
        timestamp: Date.now()
      });

      res.json({ 
        success: true, 
        postulations: postulations.length,
        awaitingSelection: this.awaitingAgentSelection
      });
    } catch (error) {
      Logger.error('Failed to generate postulations', error as Error);
      res.status(500).json({ error: 'Failed to generate postulations' });
    }
  }

  /**
   * Get active agents
   */
  private async handleGetAgents(req: express.Request, res: express.Response): Promise<void> {
    try {
      const agents = await this.getActiveAgents();
      res.json({
        agents: agents.map(agent => ({
          id: agent.id,
          name: agent.name,
          role: agent.role,
          metadata: agent.metadata
        })),
        count: agents.length,
        timestamp: Date.now()
      });
    } catch (error) {
      Logger.error('Failed to get active agents', error as Error);
      res.status(500).json({ error: 'Failed to get active agents' });
    }
  }

  /**
   * Get current game state
   */
  private handleGetGameState(req: express.Request, res: express.Response): void {
    const gameState = this.getCurrentState();
    res.json({
      gameState,
      currentPhase: this.currentPhase,
      isActive: this.isActive,
      timestamp: Date.now()
    });
  }

  /**
   * Get current conversation thread
   */
  private handleGetCurrentThread(req: express.Request, res: express.Response): void {
    const thread = this.getCurrentThread();
    res.json({
      thread: thread ? {
        id: thread.id,
        messageCount: thread.messageCount,
        startTime: thread.startTime,
        status: thread.status,
        messages: thread.messages.map(msg => ({
          id: msg.id,
          type: msg.type,
          content: msg.content,
          agent: msg.agent,
          timestamp: msg.timestamp
        }))
      } : null,
      hasCapacity: this.hasThreadCapacity(),
      maxMessages: this.config.maxMessagesPerThread || 10,
      timestamp: Date.now()
    });
  }

  /**
   * Start new conversation thread
   */
  private handleStartNewThread(req: express.Request, res: express.Response): void {
    try {
      this.startNewThread();
      
      // Broadcast thread started event
      this.broadcastSSE('thread_started', {
        threadId: this.currentThread?.id,
        timestamp: Date.now()
      });

      res.json({ 
        success: true, 
        threadId: this.currentThread?.id,
        timestamp: Date.now()
      });
    } catch (error) {
      Logger.error('Failed to start new thread', error as Error);
      res.status(500).json({ error: 'Failed to start new thread' });
    }
  }

  /**
   * Complete current conversation thread
   */
  private handleCompleteThread(req: express.Request, res: express.Response): void {
    try {
      if (this.currentThread) {
        this.completeCurrentThread();
        
        // Broadcast thread completed event
        this.broadcastSSE('thread_completed', {
          threadId: this.currentThread?.id,
          timestamp: Date.now()
        });
      }

      res.json({ 
        success: true,
        timestamp: Date.now()
      });
    } catch (error) {
      Logger.error('Failed to complete thread', error as Error);
      res.status(500).json({ error: 'Failed to complete thread' });
    }
  }

  /**
   * Check if thread has capacity for more messages
   */
  private hasThreadCapacity(): boolean {
    if (!this.currentThread) return true;
    const maxMessages = this.config.maxMessagesPerThread || 10;
    return this.currentThread.messageCount < maxMessages;
  }

  /**
   * Start a new conversation thread
   */
  protected startNewThread(): void {
    const threadId = `html5_thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentThread = {
      id: threadId,
      messages: [],
      messageCount: 0,
      startTime: Date.now(),
      status: 'active'
    };

    this.changePhase('game');
    
    if (this.config.debugMode) {
      Logger.debug(`HTML5UI: Started new thread ${threadId}`);
    }
  }

  /**
   * Complete the current conversation thread
   */
  protected completeCurrentThread(): void {
    if (this.currentThread) {
      this.currentThread.status = 'completed';
      
      if (this.config.debugMode) {
        Logger.debug(`HTML5UI: Completed thread ${this.currentThread.id}`);
      }
      
      this.changePhase('complete');
    }
  }

  /**
   * Get current conversation thread
   */
  public getCurrentThread(): ConversationThread | undefined {
    return this.currentThread;
  }

  // ===== Event Processing =====

  private processWebEvent(event: WebEventData): void {
    switch (event.type) {
      case 'user_input':
        if (event.data.input) {
          // Regular user input
          this.sendUserInput(event.data.input);
        } else if (event.data.action) {
          // Game action
          this.handleWebGameAction(event.data.action, event.data.payload);
        }
        break;
        
      case 'heartbeat':
        this.updateClientActivity(event.clientId);
        break;
    }
  }

  private handleWebGameAction(action: string, payload: any): void {
    // Handle specific game actions
    switch (action) {
      case 'request_postulations':
        this.requestAgentSelection();
        break;
        
      case 'change_theme':
        this.setTheme(payload.theme);
        break;
        
      default:
        if (this.config.debugMode) {
          Logger.mcpVerbose('HTML5UI: Unknown game action', { action, payload });
        }
    }
  }

  private onClientConnectionChange(event: { type: 'connect' | 'disconnect'; client: WebClient }): void {
    if (event.type === 'connect') {
      this.displayNotification(
        'Client Connected',
        `New client connected (${this.connectedClients.size} total)`,
        'info'
      );
    } else {
      this.displayNotification(
        'Client Disconnected',
        `Client disconnected (${this.connectedClients.size} total)`,
        'info'
      );
    }
  }

  private updateClientActivity(clientId: string): void {
    const client = this.connectedClients.get(clientId);
    if (client) {
      client.lastActivity = Date.now();
    }
  }

  private sendHeartbeat(): void {
    this.broadcastSSE('heartbeat', { timestamp: Date.now() });
  }

  private logWebEvent(event: WebEventData): void {
    if (this.config.debugMode) {
      Logger.mcpVerbose('HTML5UI: Web event', { event });
    }
  }

  // ===== Override Parent Methods for Web-Specific Behavior =====

  protected async onPhaseChange(phase: UIPhase): Promise<void> {
    await super.onPhaseChange(phase);
    
    // Send phase-specific data to clients
    let phaseData: any = { phase };
    
    switch (phase) {
      case 'game':
        phaseData.gameState = await this.getCurrentState();
        phaseData.agents = (await this.getActiveAgents()).map(agent => ({
          id: agent.id,
          name: agent.name,
          role: agent.role
        }));
        break;
        
      case 'postulation':
        // Phase data will be sent when displayAgentPostulations is called
        break;
    }
    
    this.broadcastSSE('phase_data', phaseData);
  }

  protected onUserInput(input: string): void {
    super.onUserInput(input);
    
    // Broadcast user input to all clients for transparency
    this.broadcastSSE('user_input_echo', {
      input,
      timestamp: Date.now()
    });
  }

  // ===== Cleanup =====

  public async destroy(): Promise<void> {
    await super.destroy();
    
    // Close all SSE connections
    this.sseClients.forEach(res => {
      res.end();
    });
    this.sseClients.clear();
    this.connectedClients.clear();
  }
}

export default HTML5GamificationUI;
