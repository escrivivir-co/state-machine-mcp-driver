/**
 * AlephScript Frontend Client
 * Standardized Socket.IO client for all frontend UIs (HTML5, ThreeJS, Unity)
 * Communicates through room-based channels with backend AlephScript servers
 */

import { io, Socket } from 'socket.io-client';

export interface AlephScriptFrontendConfig {
  /** AlephScript server URL */
  serverUrl: string;
  /** UI identifier for room naming */
  uiId: string;
  /** UI type (html5, threejs, unity) */
  uiType: 'html5' | 'threejs' | 'unity';
  /** Reconnection options */
  reconnection?: boolean;
  /** Reconnection attempts */
  reconnectionAttempts?: number;
  /** Debug mode */
  debug?: boolean;
}

export interface GameMessage {
  id: string;
  type: 'user' | 'agent' | 'system' | 'game' | 'error';
  agent?: {
    id: string;
    name: string;
    role: string;
    avatar?: string;
  };
  content: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface AgentPostulation {
  index: number;
  agentId: string;
  name: string;
  role: string;
  reason: string;
  priority: number;
  greediness: string;
  weight: number;
}

export interface GameState {
  currentPhase: string;
  isActive: boolean;
  gameState: any;
  timestamp: number;
}

/**
 * AlephScript Frontend Client
 * Provides standardized communication for all UI frontends
 */
export class AlephScriptFrontendClient {
  private socket!: Socket;
  private config: AlephScriptFrontendConfig;
  private roomName: string;
  private isConnected = false;
  private eventHandlers = new Map<string, Array<(data: any) => void>>();

  constructor(config: AlephScriptFrontendConfig) {
    this.config = {
      reconnection: true,
      reconnectionAttempts: 5,
      debug: false,
      ...config
    };

    // Generate room name based on UI type and ID
    this.roomName = `${this.config.uiType}_${this.config.uiId}_ROOM`;
    
    this.initialize();
  }

  /**
   * Initialize Socket.IO connection
   */
  private initialize(): void {
    this.socket = io(this.config.serverUrl, {
      reconnection: this.config.reconnection,
      reconnectionAttempts: this.config.reconnectionAttempts,
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
  }

  /**
   * Setup core Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.log('🔌 Connected to AlephScript server');
      
      // Join UI-specific room
      this.socket.emit('join_room', { room: this.roomName });
      this.emit('connected', { roomName: this.roomName });
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.log('🔌 Disconnected from AlephScript server');
      this.emit('disconnected', {});
    });

    this.socket.on('connect_error', (error) => {
      this.log('❌ Connection error:', error);
      this.emit('connection_error', { error: error.message });
    });

    // ===== Standardized Game Events =====

    // Message events
    this.socket.on('ui_message', (data) => {
      this.log('📨 Received message:', data);
      this.emit('message', data);
    });

    this.socket.on('agent_message', (data) => {
      this.log('🤖 Received agent message:', data);
      this.emit('agent_message', data);
    });

    this.socket.on('system_message', (data) => {
      this.log('🔧 Received system message:', data);
      this.emit('system_message', data);
    });

    // Agent postulation events
    this.socket.on('agent_postulations', (data) => {
      this.log('🎭 Received agent postulations:', data);
      this.emit('agent_postulations', data);
    });

    this.socket.on('agent_selection_result', (data) => {
      this.log('✅ Agent selection result:', data);
      this.emit('agent_selection_result', data);
    });

    // Game state events
    this.socket.on('game_state_update', (data) => {
      this.log('📊 Game state update:', data);
      this.emit('game_state_update', data);
    });

    this.socket.on('phase_change', (data) => {
      this.log('🔄 Phase change:', data);
      this.emit('phase_change', data);
    });

    // System events
    this.socket.on('notification', (data) => {
      this.log('📢 Notification:', data);
      this.emit('notification', data);
    });

    this.socket.on('error_message', (data) => {
      this.log('❌ Error message:', data);
      this.emit('error_message', data);
    });

    // Health check events
    this.socket.on('heartbeat', (data) => {
      this.log('💓 Heartbeat:', data);
      this.emit('heartbeat', data);
      
      // Respond to heartbeat
      this.socket.emit('heartbeat_response', { 
        timestamp: Date.now(),
        room: this.roomName 
      });
    });
  }

  /**
   * ===== PUBLIC API METHODS =====
   */

  /**
   * Send user input to backend
   */
  public sendUserInput(input: string, metadata?: Record<string, any>): void {
    this.socket.emit('user_input', {
      input,
      metadata,
      timestamp: Date.now(),
      room: this.roomName
    });
    this.log('📤 Sent user input:', input);
  }

  /**
   * Send agent selection
   */
  public selectAgent(agentIndex: number, reasoning?: string): void {
    this.socket.emit('agent_selection', {
      agentIndex,
      reasoning,
      timestamp: Date.now(),
      room: this.roomName
    });
    this.log('👆 Selected agent:', agentIndex);
  }

  /**
   * Request agent postulations
   */
  public requestPostulations(context?: Record<string, any>): void {
    this.socket.emit('request_postulations', {
      context,
      timestamp: Date.now(),
      room: this.roomName
    });
    this.log('🎭 Requested postulations');
  }

  /**
   * Send game action
   */
  public sendGameAction(action: string, payload?: any): void {
    this.socket.emit('game_action', {
      action,
      payload,
      timestamp: Date.now(),
      room: this.roomName
    });
    this.log('🎮 Sent game action:', action);
  }

  /**
   * Request current game state
   */
  public requestGameState(): void {
    this.socket.emit('request_game_state', {
      timestamp: Date.now(),
      room: this.roomName
    });
    this.log('📊 Requested game state');
  }

  /**
   * Send heartbeat to server
   */
  public sendHeartbeat(): void {
    this.socket.emit('client_heartbeat', {
      timestamp: Date.now(),
      room: this.roomName,
      uiType: this.config.uiType
    });
  }

  /**
   * ===== EVENT SYSTEM =====
   */

  /**
   * Register event handler
   */
  public on(event: string, handler: (data: any) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Remove event handler
   */
  public off(event: string, handler: (data: any) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to registered handlers
   */
  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.log('❌ Error in event handler:', error);
        }
      });
    }
  }

  /**
   * ===== CONNECTION MANAGEMENT =====
   */

  /**
   * Connect to AlephScript server
   */
  public connect(): void {
    if (!this.isConnected) {
      this.socket.connect();
    }
  }

  /**
   * Disconnect from AlephScript server
   */
  public disconnect(): void {
    if (this.isConnected) {
      this.socket.disconnect();
    }
  }

  /**
   * Check if connected
   */
  public isSocketConnected(): boolean {
    return this.isConnected && this.socket.connected;
  }

  /**
   * Get room name
   */
  public getRoomName(): string {
    return this.roomName;
  }

  /**
   * Get connection status
   */
  public getStatus(): {
    connected: boolean;
    roomName: string;
    uiType: string;
    uiId: string;
  } {
    return {
      connected: this.isConnected,
      roomName: this.roomName,
      uiType: this.config.uiType,
      uiId: this.config.uiId
    };
  }

  /**
   * ===== UTILITY METHODS =====
   */

  /**
   * Log with prefix
   */
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log(`[AlephScript-${this.config.uiType.toUpperCase()}]`, ...args);
    }
  }

  /**
   * Destroy client and cleanup
   */
  public destroy(): void {
    this.eventHandlers.clear();
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

/**
 * Factory function to create AlephScript client for different UI types
 */
export function createAlephScriptClient(
  uiType: 'html5' | 'threejs' | 'unity',
  uiId: string,
  serverUrl: string = 'http://localhost:3000',
  options?: Partial<AlephScriptFrontendConfig>
): AlephScriptFrontendClient {
  return new AlephScriptFrontendClient({
    serverUrl,
    uiId,
    uiType,
    ...options
  });
}

export default AlephScriptFrontendClient;
