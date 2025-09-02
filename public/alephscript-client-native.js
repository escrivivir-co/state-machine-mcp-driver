/**
 * AlephScript Frontend Client (ES6/JavaScript) - Native WebSocket Version
 * Universal client for HTML5, ThreeJS, and Unity frontends
 * Communicates with backend AlephScript servers through native WebSockets
 * NO DEPENDENCY ON SOCKET.IO CLIENT
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
    this.reconnectAttempts = 0;
    this.messageId = 0;
  }

  /**
   * Connect to AlephScript server
   */
  connect() {
    const wsUrl = this.config.serverUrl.replace('http', 'ws') + '/socket.io/?EIO=4&transport=websocket';
    this.log(`🔌 Connecting to: ${wsUrl}`);
    
    this.socket = new WebSocket(wsUrl);
    this.setupEventHandlers();
  }

  /**
   * Setup native WebSocket event handlers
   */
  setupEventHandlers() {
    this.socket.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.log('✅ Connected to AlephScript server');
      
      // Send Socket.IO handshake simulation
      this.sendRawMessage('40');
      
      // Join UI-specific room after handshake
      setTimeout(() => {
        this.joinRoom();
        this.emit('connected', { roomName: this.roomName });
      }, 100);
    };

    this.socket.onclose = () => {
      this.isConnected = false;
      this.log('❌ Disconnected from AlephScript server');
      this.emit('disconnected', {});
      
      // Auto-reconnect if enabled
      if (this.config.reconnection && this.reconnectAttempts < this.config.reconnectionAttempts) {
        this.reconnectAttempts++;
        this.log(`🔄 Reconnecting... attempt ${this.reconnectAttempts}`);
        setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
      }
    };

    this.socket.onerror = (error) => {
      this.log('❌ WebSocket error:', error);
      this.emit('connection_error', { error: error.message || 'WebSocket error' });
    };

    this.socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(data) {
    if (this.config.debug) {
      this.log('📥 Raw message:', data);
    }

    // Handle Socket.IO protocol messages
    if (data.startsWith('42')) {
      // Socket.IO event message
      try {
        const jsonData = data.substring(2);
        const [eventName, eventData] = JSON.parse(jsonData);
        this.handleAlephScriptEvent(eventName, eventData);
      } catch (e) {
        this.log('❌ Error parsing Socket.IO message:', e);
      }
    } else if (data === '40') {
      // Socket.IO connection ack
      this.log('🤝 Socket.IO handshake complete');
    } else if (data.startsWith('3')) {
      // Socket.IO ping/pong
      if (data === '3') {
        this.sendRawMessage('3'); // Pong response
      }
    }
  }

  /**
   * Handle AlephScript-specific events
   */
  handleAlephScriptEvent(eventName, data) {
    this.log(`📨 AlephScript event: ${eventName}`, data);

    switch (eventName) {
      case 'ui_message':
        this.emit('message', data);
        break;
      case 'agent_message':
        this.emit('agent_message', data);
        break;
      case 'system_message':
        this.emit('system_message', data);
        break;
      case 'notification':
        this.emit('notification', data);
        break;
      case 'state_display':
        this.emit('state_display', data);
        break;
      case 'phase_change':
        this.emit('phase_change', data);
        break;
      case 'game_message':
        this.emit('game_message', data);
        break;
      case 'agent_postulations':
        this.emit('agent_postulations', data);
        break;
      case 'sys_info':
        this.emit('sys_info', data);
        break;
      default:
        this.emit(eventName, data);
    }
  }

  /**
   * Join the UI-specific room
   */
  joinRoom() {
    this.sendAlephScriptMessage('join_room', { room: this.roomName });
    this.log(`🏠 Joined room: ${this.roomName}`);
  }

  /**
   * Send raw WebSocket message
   */
  sendRawMessage(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(message);
    }
  }

  /**
   * Send Socket.IO formatted message
   */
  sendAlephScriptMessage(eventName, data) {
    const message = `42["${eventName}",${JSON.stringify(data)}]`;
    this.sendRawMessage(message);
    
    if (this.config.debug) {
      this.log(`📤 Sent: ${eventName}`, data);
    }
  }

  /**
   * Send user input to the backend
   */
  sendUserInput(input) {
    this.sendAlephScriptMessage('user_input', {
      input: input,
      source: this.config.uiType,
      room: this.roomName,
      timestamp: Date.now()
    });
  }

  /**
   * Send agent selection
   */
  selectAgent(agentId) {
    this.sendAlephScriptMessage('select_agent', {
      agentId: agentId,
      source: this.config.uiType,
      room: this.roomName,
      timestamp: Date.now()
    });
  }

  /**
   * Send generic message
   */
  sendMessage(data) {
    this.sendAlephScriptMessage('client_message', {
      ...data,
      source: this.config.uiType,
      room: this.roomName,
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast message to all clients in room
   */
  broadcast(eventName, data) {
    this.sendAlephScriptMessage('broadcast', {
      event: eventName,
      data: data,
      room: this.roomName,
      timestamp: Date.now()
    });
  }

  /**
   * Event emitter functionality
   */
  on(eventName, callback) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName).push(callback);
  }

  emit(eventName, data) {
    if (this.eventHandlers.has(eventName)) {
      this.eventHandlers.get(eventName).forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          this.log('❌ Error in event handler:', e);
        }
      });
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    this.config.reconnection = false; // Disable auto-reconnect
    if (this.socket) {
      this.socket.close();
    }
    this.isConnected = false;
  }

  /**
   * Debug logging
   */
  log(...args) {
    if (this.config.debug) {
      console.log(`[AlephScript-${this.config.uiType}]`, ...args);
    }
  }
}

/**
 * Factory function to create AlephScript clients
 */
function createAlephScriptClient(uiType, uiId, serverUrl, debug = false) {
  return new AlephScriptFrontendClient({
    uiType: uiType,
    uiId: uiId,
    serverUrl: serverUrl,
    debug: debug,
    reconnection: true,
    reconnectionAttempts: 5
  });
}

// Make it available globally
if (typeof window !== 'undefined') {
  window.createAlephScriptClient = createAlephScriptClient;
  window.AlephScriptFrontendClient = AlephScriptFrontendClient;
}

// For Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createAlephScriptClient,
    AlephScriptFrontendClient
  };
}
