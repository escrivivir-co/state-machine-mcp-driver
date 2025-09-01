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
import { AgentPostulation } from '../models/AgentPostulation';
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

    this.setupWebStreams();
    this.setupExpressApp();
  }

  // ===== Abstract Method Implementations =====

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.htmlConfig.port, () => {
        this.isServerRunning = true;
        this.isActive = true;
        this.changePhase('menu');
        
        Logger.info(`HTML5 Game UI started on port ${this.htmlConfig.port}`);
        console.log(`🌐 Game UI available at: http://localhost:${this.htmlConfig.port}`);
        
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

      if (this.server) {
        this.server.close(() => {
          this.isServerRunning = false;
          this.isActive = false;
          
          Logger.info('HTML5 Game UI server stopped');
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

    // Emit web event
    this.webEvents$.next({
      type: 'user_input',
      clientId,
      data: { input },
      timestamp: Date.now()
    });

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

    // Try to select agent
    const success = this.selectAgent(agentIndex);
    
    res.json({ success });
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
