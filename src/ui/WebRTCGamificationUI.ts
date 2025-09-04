/**
 * WebRTC Gamification UI
 * Real-time communication interface using WebRTC with Angular UI components
 * Following NodeRedGamificationUI pattern exactly
 */

import path from 'path';
import fs from 'fs';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { ChildProcess } from 'child_process';
import { Subject } from 'rxjs';

import { GameMessage, GamificationUI, UIPhase } from './GamificationUI';
import { BaseGamificationUIConfig } from './GamificationUI';
import { AgentPostulation } from '../models';
import { Runtime } from '../runtime';
import { MCPDriverAdapter } from '../drivers';
import { Logger } from '../utils';
import { AlephScriptFrontendClient } from './shared/AlephScriptFrontendClient';
import { IOrchestratorChannels } from '../orchestration';
import { AlephScriptClient } from '@alephscript/client';

/**
 * WebRTC-specific configuration extending base config
 */
export interface WebRTCGameUIConfig extends BaseGamificationUIConfig {
  /** Express server port */
  port: number;
  /** Static files directory for Angular build */
  staticDir?: string;
  /** CORS origin settings */
  corsOrigin?: string;
  /** Use pre-compiled Angular template */
  provideTemplate?: boolean;
  /** Auto-open browser on start */
  autoOpenBrowser?: boolean;
  /** Enable debug mode */
  debugMode?: boolean;
  /** Path to webrtc-gamify-ui Angular project */
  angularProjectPath?: string;
  /** Maximum concurrent WebRTC connections */
  maxConnections?: number;
  /** Enable signaling server */
  enableSignaling?: boolean;
  /** STUN/TURN server configuration */
  iceServers?: RTCIceServer[];
  /** Room management settings */
  roomSettings?: {
    maxRoomsPerUser?: number;
    defaultRoomType?: 'public' | 'private' | 'protected';
    autoCleanupInterval?: number;
  };
}

/**
 * WebRTC Peer Connection Info
 */
export interface WebRTCPeer {
  id: string;
  name: string;
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  signalingState: RTCSignalingState;
  localDescription: RTCSessionDescription | null;
  remoteDescription: RTCSessionDescription | null;
  connectedAt: number;
  lastActivity: number;
  room?: string;
  metadata?: Record<string, any>;
}

/**
 * WebRTC Room Information
 */
export interface WebRTCRoom {
  id: string;
  name: string;
  type: 'public' | 'private' | 'protected';
  password?: string;
  maxParticipants: number;
  currentParticipants: string[];
  owner: string;
  createdAt: number;
  settings: {
    enableChat: boolean;
    enableFileSharing: boolean;
    enableRecording: boolean;
    muteNewcomers: boolean;
    requireApproval: boolean;
  };
}

/**
 * WebRTC signaling message types
 */
export interface WebRTCSignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join-room' | 'leave-room' | 'room-created' | 'room-destroyed';
  from: string;
  to?: string;
  room?: string;
  data: any;
  timestamp: number;
}

/**
 * WebRTC Gamification UI
 * Provides real-time communication interface using WebRTC technology
 * Follows exact NodeRedGamificationUI pattern for consistency
 */
export class WebRTCGamificationUI extends GamificationUI {
  protected config: WebRTCGameUIConfig;
  private app: express.Application;
  private server: http.Server | null = null;
  private alephScriptClient: AlephScriptClient | null = null;
  private isStarted = false;
  private clientLogs: Array<{ 
    level: string; 
    source?: string; 
    message: string; 
    stack?: string; 
    href?: string; 
    ts: number 
  }> = [];

  // WebRTC-specific state
  private connectedPeers: Map<string, WebRTCPeer> = new Map();
  private activeRooms: Map<string, WebRTCRoom> = new Map();
  private signalingMessages$ = new Subject<WebRTCSignalingMessage>();
  private peerConnections: Map<string, RTCPeerConnection> = new Map();

  // Orchestrator integration
  private orchestratorChannels?: IOrchestratorChannels;
  private connectedClients: Set<string> = new Set();
  
  // Browser management
  private browserProcess?: ChildProcess;

  constructor(runtime: Runtime, mcpAdapter: MCPDriverAdapter, config: WebRTCGameUIConfig) {
    super(runtime, mcpAdapter, config);
    this.config = {
      staticDir: path.resolve(process.cwd(), "public_templates/web-rtc-gamify-ui"),
      provideTemplate: true,
      autoOpenBrowser: false,
      corsOrigin: "*",
      debugMode: false,
      maxConnections: 50,
      enableSignaling: true,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      roomSettings: {
        maxRoomsPerUser: 5,
        defaultRoomType: 'public',
        autoCleanupInterval: 300000
      },
      ...config
    };

    // Express app creation (NodeRed pattern)
    this.app = express();
    this.setupExpress();

    // WebRTC-specific setup
    this.setupWebRTCEventHandlers();
    this.setupRoomManagement();

    Logger.info(`WebRTCGamificationUI initialized on port ${this.config.port}`);
  }

  // ===== Express Server Setup (NodeRed Pattern) =====

  /**
   * Setup Express application with routes and middleware
   * Following exact NodeRedGamificationUI pattern
   */
  private setupExpress(): void {
    // CORS middleware (exact NodeRed pattern)
    this.app.use(cors({
      origin: this.config.corsOrigin || "*",
      credentials: true
    }));

    // JSON parsing
    this.app.use(express.json());

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        service: 'WebRTC Gamification UI',
        timestamp: Date.now(),
        uptime: process.uptime()
      });
    });

    // API endpoint for UI configuration
    this.app.get('/api/config', (req, res) => {
      const safeConfig = { ...this.config };
      delete safeConfig.debugMode; // Security: don't expose debug mode
      res.json(safeConfig);
    });

    // WebRTC-specific API endpoints
    this.app.get('/api/webrtc/peers', (req, res) => {
      res.json(this.getConnectedPeers());
    });

    this.app.get('/api/webrtc/rooms', (req, res) => {
      res.json(this.getAvailableRooms());
    });

    // Serve static Angular application
    if (this.config.staticDir && fs.existsSync(this.config.staticDir)) {
      this.app.use(express.static(this.config.staticDir));
      
      // SPA fallback
      this.app.get('*', (req, res) => {
        res.sendFile(path.join(this.config.staticDir!, 'index.html'));
      });
    } else {
      // Dynamic HTML fallback
      this.app.get('*', (req, res) => {
        res.send(this.generateHTML());
      });
    }
  }

  // ===== Orchestrator Integration =====

  /**
   * Connect to orchestrator channels for multi-UI coordination
   */
  public connectOrchestrator(channels: IOrchestratorChannels): void {
    this.orchestratorChannels = channels;
    Logger.info(`🔗 WebRTC UI connected to orchestrator channels`);
  }

  // ===== Core UI Methods =====

  /**
   * Start the WebRTC UI server and initialize connections
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      Logger.warn("WebRTC UI already started");
      return;
    }

    try {
      await this.startServer();
      await this.initializeAlephScriptIntegration();
      
      this.isStarted = true;
      Logger.info(`🚀 WebRTC UI started successfully on port ${this.config.port}`);
      
      if (this.config.autoOpenBrowser) {
        await this.openBrowser();
      }
    } catch (error: any) {
      Logger.error("Failed to start WebRTC UI:", error);
      throw error;
    }
  }

  /**
   * Stop the WebRTC UI server and cleanup resources
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      Logger.warn("WebRTC UI not started");
      return;
    }

    try {
      // Close all peer connections
      for (const [peerId, connection] of this.peerConnections) {
        connection.close();
        this.peerConnections.delete(peerId);
      }

      // Close AlephScript client
      if (this.alephScriptClient) {
        await this.alephScriptClient.disconnect();
        this.alephScriptClient = null;
      }

      // Close Express server
      if (this.server) {
        this.server.close();
        this.server = null;
      }

      // Close browser
      if (this.browserProcess) {
        this.browserProcess.kill();
        this.browserProcess = undefined;
      }

      this.isStarted = false;
      Logger.info("🛑 WebRTC UI stopped successfully");
    } catch (error: any) {
      Logger.error("Error stopping WebRTC UI:", error);
      throw error;
    }
  }

  /**
   * Display message in the WebRTC UI
   */
  async displayMessage(message: GameMessage): Promise<void> {
    if (!this.isActive) {
      Logger.warn("WebRTC UI not active, cannot display message");
      return;
    }

    try {
      // Broadcast message to all connected clients
      this.broadcastToClients("game-message", { message });
      Logger.debug(`📨 Message displayed in WebRTC UI: ${message.content}`);
    } catch (error: any) {
      Logger.error("Error displaying message in WebRTC UI:", error);
    }
  }

  /**
   * Display agent postulations for user selection
   */
  async displayAgentPostulations(postulations: AgentPostulation[]): Promise<void> {
    if (!this.isActive) {
      Logger.warn("WebRTC UI not active, cannot display postulations");
      return;
    }

    try {
      this.broadcastToClients("agent-postulations", { postulations });
      Logger.info(`🎭 Displayed ${postulations.length} agent postulations in WebRTC UI`);
    } catch (error: any) {
      Logger.error("Error displaying postulations in WebRTC UI:", error);
    }
  }

  /**
   * Display system notification
   */
  async displayNotification(
    title: string, 
    message: string, 
    type: "info" | "success" | "warning" | "error" = "info"
  ): Promise<void> {
    if (!this.isActive) {
      Logger.warn("WebRTC UI not active, cannot display notification");
      return;
    }

    try {
      this.broadcastToClients("notification", { title, message, type, timestamp: Date.now() });
      Logger.debug(`🔔 Notification displayed: ${title} - ${message}`);
    } catch (error: any) {
      Logger.error("Error displaying notification in WebRTC UI:", error);
    }
  }

  /**
   * Update UI phase display
   */
  async updatePhaseDisplay(phase: UIPhase): Promise<void> {
    try {
      this.broadcastToClients("phase-update", { phase, timestamp: Date.now() });
      Logger.debug(`🎯 Phase updated to: ${phase}`);
    } catch (error: any) {
      Logger.error("Error updating phase in WebRTC UI:", error);
    }
  }

  // ===== WebRTC-Specific Methods =====

  /**
   * Get all active rooms
   */
  getAvailableRooms(): WebRTCRoom[] {
    return Array.from(this.activeRooms.values());
  }

  /**
   * Get all connected peers
   */
  getConnectedPeers(): WebRTCPeer[] {
    return Array.from(this.connectedPeers.values());
  }

  // ===== Private Methods =====

  /**
   * Start the Express server
   */
  private async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.config.port, () => {
        Logger.info(`🌐 WebRTC UI server listening on port ${this.config.port}`);
        resolve();
      });

      this.server.on('error', (error) => {
        Logger.error("Express server error:", error);
        reject(error);
      });
    });
  }

  /**
   * Initialize AlephScript integration for WebRTC communication
   */
  private async initializeAlephScriptIntegration(): Promise<void> {
    try {
      this.alephScriptClient = new AlephScriptClient(
        `webrtc-ui-${Date.now()}`,
        this.config.gameTitle || "WebRTC Gamification UI"
      );

      await this.alephScriptClient.connect();
      this.setupAlephScriptHandlers();

      Logger.info("🔗 AlephScript integration initialized for WebRTC UI");
    } catch (error: any) {
      Logger.error("Failed to initialize AlephScript integration:", error);
      throw error;
    }
  }

  /**
   * Setup WebRTC event handlers
   */
  private setupWebRTCEventHandlers(): void {
    this.signalingMessages$.subscribe((message: any) => {
      this.handleSignalingMessage(message);
    });
  }

  /**
   * Setup room management and cleanup
   */
  private setupRoomManagement(): void {
    // Auto-cleanup empty rooms
    setInterval(() => {
      this.cleanupEmptyRooms();
    }, this.config.roomSettings?.autoCleanupInterval || 300000);
  }

  /**
   * Clean up empty rooms
   */
  private cleanupEmptyRooms(): void {
    for (const [roomId, room] of this.activeRooms) {
      if (room.currentParticipants.length === 0) {
        this.activeRooms.delete(roomId);
        this.broadcastToClients("room-destroyed", { roomId });
        Logger.debug(`🧹 Cleaned up empty room: ${roomId}`);
      }
    }
  }

  /**
   * Setup AlephScript event handlers for WebRTC operations
   */
  private setupAlephScriptHandlers(): void {
    if (!this.alephScriptClient) return;

    this.alephScriptClient.onMessage((message: any) => {
      if (message.type === 'webrtc-signaling') {
        this.signalingMessages$.next(message.data);
      }
    });
  }

  /**
   * Handle WebRTC signaling
   */
  private async handleSignalingMessage(message: WebRTCSignalingMessage): Promise<void> {
    try {
      Logger.debug(`📡 WebRTC signaling: ${message.type} from ${message.from}`);
      
      // Route signaling message based on type
      switch (message.type) {
        case 'join-room':
          if (message.room) {
            // Handle room join logic
          }
          break;
        case 'leave-room':
          if (message.room) {
            // Handle room leave logic
          }
          break;
        default:
          // Handle other signaling messages
          break;
      }
    } catch (error: any) {
      Logger.error("Error handling signaling message:", error);
    }
  }

  /**
   * Broadcast message to all connected clients via AlephScript
   */
  private broadcastToClients(event: string, data: any): void {
    if (this.alephScriptClient) {
      this.alephScriptClient.broadcast({
        type: 'webrtc-ui-event',
        event,
        data,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Generate dynamic HTML for WebRTC UI when no static files available
   */
  private generateHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.config.gameTitle || 'WebRTC Gamification UI'}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f0f2f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
        .status.info { background: #d1ecf1; color: #0c5460; }
        .status.warning { background: #fff3cd; color: #856404; }
        .peers { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin-top: 20px; }
        .peer-card { background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #007bff; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌐 ${this.config.gameTitle || 'WebRTC Gamification UI'}</h1>
            <p>Real-time peer-to-peer communication interface</p>
        </div>
        
        <div class="status info">
            <strong>✅ WebRTC UI Active</strong><br>
            Server running on port ${this.config.port}<br>
            Connected peers: <span id="peer-count">${this.connectedPeers.size}</span>
        </div>
        
        <div class="status warning">
            <strong>⚠️ Angular App Not Found</strong><br>
            Static directory: ${this.config.staticDir}<br>
            Please build and install the Angular application using the postinstall script.
        </div>
        
        <div class="peers" id="peers-container">
            <!-- Peers will be populated by JavaScript -->
        </div>
    </div>
    
    <script>
        // Basic WebSocket connection for real-time updates
        console.log('WebRTC Gamification UI - Fallback mode active');
        
        // Update peer count periodically
        setInterval(() => {
            fetch('/api/webrtc/peers')
                .then(response => response.json())
                .then(peers => {
                    document.getElementById('peer-count').textContent = peers.length;
                    updatePeersDisplay(peers);
                })
                .catch(console.error);
        }, 5000);
        
        function updatePeersDisplay(peers) {
            const container = document.getElementById('peers-container');
            container.innerHTML = peers.map(peer => 
                '<div class="peer-card">' +
                '<strong>' + peer.name + '</strong><br>' +
                'Status: ' + peer.connectionState + '<br>' +
                'Connected: ' + new Date(peer.connectedAt).toLocaleTimeString() +
                '</div>'
            ).join('');
        }
    </script>
</body>
</html>`;
  }

  /**
   * Open browser to WebRTC UI
   */
  private async openBrowser(): Promise<void> {
    const url = `http://localhost:${this.config.port}`;
    
    try {
      const { spawn } = require('child_process');
      const platform = process.platform;
      
      let command: string;
      let args: string[];
      
      if (platform === 'win32') {
        command = 'cmd';
        args = ['/c', 'start', url];
      } else if (platform === 'darwin') {
        command = 'open';
        args = [url];
      } else {
        command = 'xdg-open';
        args = [url];
      }
      
      this.browserProcess = spawn(command, args, { detached: true, stdio: 'ignore' });
      this.browserProcess?.unref();
      
      Logger.info(`🌐 Browser opened to WebRTC UI: ${url}`);
    } catch (error: any) {
      Logger.warn("Could not open browser automatically:", error);
    }
  }

  // ===== Getter Methods =====

  get isActive(): boolean {
    return this.isStarted && this.server !== null;
  }

  get isServerRunning(): boolean {
    return this.server !== null;
  }
}

export default WebRTCGamificationUI;
