/**
 * AlephScript Frontend Client (ES6/JavaScript) - Socket.IO Version
 * Universal client for HTML5, ThreeJS, and Unity frontends
 * Communicates with backend AlephScript servers through Socket.IO
 * Compatible with the working game.html implementation
 */

class AlephScriptFrontendClient {
  constructor(uiType, uiId, serverUrl, options = {}) {
    this.config = {
      uiType,
      uiId,
      serverUrl,
      reconnection: true,
      reconnectionAttempts: 5,
      debug: false,
      ...options
    };

    // Generate session ID based on UI type and ID
    this.sessionId = `${this.config.uiType}_${this.config.uiId}`;
    this.isConnected = false;
    this.eventHandlers = new Map();
    this.reconnectAttempts = 0;
    
    this.log('🔌 AlephScript client initialized');
  }

  /**
   * Initialize Socket.IO connection
   */
  initialize() {
    if (typeof io === 'undefined') {
      throw new Error('Socket.IO is not loaded. Please include Socket.IO CDN.');
    }

    this.log(`🔌 Connecting to: ${this.config.serverUrl}`);
    
    this.socket = io(this.config.serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: this.config.reconnection,
      reconnectionAttempts: this.config.reconnectionAttempts
    });
    
    this.setupEventHandlers();
  }

  /**
   * Setup Socket.IO event handlers
   */
  setupEventHandlers() {
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.log('🔌 Connected to AlephScript server');
      
      // Register client with server
      this.socket.emit('CLIENT_REGISTER', {
        usuario: this.sessionId,
        sesion: `>${Date.now()}`
      });
      
      // Subscribe to ENGINE_THREADS room
      this.socket.emit('CLIENT_SUSCRIBE', {
        room: 'ENGINE_THREADS'
      });
      
      this.emit('connected', { sessionId: this.sessionId });
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.log('❌ Disconnected from AlephScript server');
      this.emit('disconnected');
    });

    this.socket.on('connect_error', (error) => {
      this.log(`❌ Connection error: ${error}`);
      this.emit('connection_error', error);
    });

    // Handle incoming messages
    this.socket.on('ROOM_MESSAGE', (data) => {
      this.log('📨 Received room message:', data);
      this.emit('message', data);
    });

    // Handle other Socket.IO events
    this.socket.onAny((event, ...args) => {
      this.log(`📨 Received event: ${event}`, args);
      this.emit(event, ...args);
    });
  }

  /**
   * Connect to the server
   */
  connect() {
    if (!this.socket) {
      this.initialize();
    } else {
      this.socket.connect();
    }
  }

  /**
   * Disconnect from the server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  /**
   * Send a message to the server
   */
  sendMessage(data) {
    if (!this.isConnected || !this.socket) {
      this.log('❌ Cannot send message: not connected');
      return;
    }

    this.socket.emit('ROOM_MESSAGE', {
      event: 'USER_INPUT',
      room: 'ENGINE_THREADS',
      data: data
    });
    
    this.log('📤 Sent message:', data);
  }

  /**
   * Request game state from server
   */
  requestGameState() {
    this.sendMessage({
      type: 'request_game_state',
      timestamp: Date.now()
    });
  }

  /**
   * Send user input to server
   */
  sendUserInput(input) {
    this.sendMessage({
      type: 'user_input',
      input: input,
      timestamp: Date.now()
    });
  }

  /**
   * Subscribe to an event
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  /**
   * Emit an event to all handlers
   */
  emit(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.log(`❌ Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Remove event listener
   */
  off(event, handler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Logging utility
   */
  log(...args) {
    if (this.config.debug) {
      console.log(`[AlephScript-${this.config.uiType}]`, ...args);
    }
  }
}

/**
 * Factory function to create AlephScript client (compatible with game.html)
 */
function createAlephScriptClient(uiType, uiId, serverUrl, options = {}) {
  const client = new AlephScriptFrontendClient(uiType, uiId, serverUrl, options);
  return client;
}

// Make it globally available
window.createAlephScriptClient = createAlephScriptClient;
window.AlephScriptFrontendClient = AlephScriptFrontendClient;
