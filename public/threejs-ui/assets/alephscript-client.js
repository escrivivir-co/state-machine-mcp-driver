/**
 * AlephScript Frontend Client (ES6/JavaScript)
 * Universal client for HTML5, ThreeJS, and Unity frontends
 * Communicates with backend AlephScript servers through room-based Socket.IO
 */

class AlephScriptFrontendClient {
  constructor(config) {
    this.config = {
      reconnection: true,
      reconnectionAttempts: 5,
      debug: false,
      ...config
    };

    // Generate room name based on UI type and ID
    this.roomName = `${this.config.uiType}_${this.config.uiId}_ROOM`;
    this.isConnected = false;
    this.eventHandlers = new Map();
    
    this.initialize();
  }

  /**
   * Initialize Socket.IO connection
   */
  initialize() {
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
  setupEventHandlers() {
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
  sendUserInput(input, metadata = {}) {
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
  selectAgent(agentIndex, reasoning = '') {
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
  requestPostulations(context = {}) {
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
  sendGameAction(action, payload = {}) {
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
  requestGameState() {
    this.socket.emit('request_game_state', {
      timestamp: Date.now(),
      room: this.roomName
    });
    this.log('📊 Requested game state');
  }

  /**
   * Send heartbeat to server
   */
  sendHeartbeat() {
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
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  /**
   * Remove event handler
   */
  off(event, handler) {
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
  emit(event, data) {
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
  connect() {
    if (!this.isConnected) {
      this.socket.connect();
    }
  }

  /**
   * Disconnect from AlephScript server
   */
  disconnect() {
    if (this.isConnected) {
      this.socket.disconnect();
    }
  }

  /**
   * Check if connected
   */
  isSocketConnected() {
    return this.isConnected && this.socket.connected;
  }

  /**
   * Get room name
   */
  getRoomName() {
    return this.roomName;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      roomName: this.roomName,
      uiType: this.config.uiType,
      uiId: this.config.uiId
    };
  }

  /**
   * Log with prefix
   */
  log(...args) {
    if (this.config.debug) {
      console.log(`[AlephScript-${this.config.uiType.toUpperCase()}]`, ...args);
    }
  }

  /**
   * Destroy client and cleanup
   */
  destroy() {
    this.eventHandlers.clear();
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

/**
 * Factory function to create AlephScript client for different UI types
 */
function createAlephScriptClient(uiType, uiId, serverUrl = 'http://localhost:3000', options = {}) {
  return new AlephScriptFrontendClient({
    serverUrl,
    uiId,
    uiType,
    debug: true, // Enable debug by default
    ...options
  });
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  // Node.js
  module.exports = { AlephScriptFrontendClient, createAlephScriptClient };
} else if (typeof window !== 'undefined') {
  // Browser
  window.AlephScriptFrontendClient = AlephScriptFrontendClient;
  window.createAlephScriptClient = createAlephScriptClient;
}
