/**
 * Web Game UI Interface
 * Base interface for web-based game interfaces with real-time capabilities
 */

/**
 * Current state of the web game display
 */
export interface WebGameDisplay {
  /** Complete current display content */
  content: string;
  /** Last game messages */
  lastMessages: WebGameMessage[];
  /** Timestamp of last update */
  timestamp: number;
  /** Whether display is actively showing content */
  isActive: boolean;
  /** Current visual theme/mode */
  theme: 'light' | 'dark' | 'game';
}

/**
 * Web game message
 */
export interface WebGameMessage {
  /** Message ID */
  id: string;
  /** Message type */
  type: 'user' | 'agent' | 'system' | 'game' | 'error';
  /** Agent info if applicable */
  agent?: {
    id: string;
    name: string;
    role: string;
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
 * Current web prompt state and interactive elements
 */
export interface WebPromptState {
  /** Current prompt text being shown */
  promptText: string;
  /** Available interactive elements */
  interactiveElements: WebInteractiveElement[];
  /** Whether waiting for user input */
  isWaitingForInput: boolean;
  /** Type of input expected */
  inputType: 'text' | 'selection' | 'button' | 'form' | 'voice';
  /** Current context/phase */
  context: string;
  /** Visual style hints */
  style?: {
    urgency: 'low' | 'medium' | 'high';
    highlight: boolean;
    animated: boolean;
  };
}

/**
 * Interactive web element
 */
export interface WebInteractiveElement {
  /** Element ID */
  id: string;
  /** Element type */
  type: 'button' | 'input' | 'select' | 'checkbox' | 'slider' | 'agent-card';
  /** Display label */
  label: string;
  /** Element value */
  value?: any;
  /** Whether element is enabled */
  enabled: boolean;
  /** CSS classes for styling */
  cssClasses?: string[];
  /** Click/interaction handler */
  action?: string;
  /** Additional metadata */
  metadata?: any;
}

/**
 * Web UI interaction state (equivalent to UIInteractionState)
 */
export interface WebUIInteractionState {
  /** Current interaction phase */
  phase: 'startup' | 'menu' | 'game' | 'postulation' | 'decision' | 'complete' | 'error';
  /** Last user action */
  lastUserAction?: string;
  /** Pending actions to process */
  pendingActions: string[];
  /** Available commands/actions */
  availableCommands: string[];
  /** Whether UI is responsive to input */
  isResponsive: boolean;
  /** Interaction context details */
  interactionContext: {
    currentSession?: string;
    messageCount: number;
    maxMessages: number;
    connectedUsers: number;
    pendingPostulations: number;
    awaitingUserInput: boolean;
  };
}

/**
 * Complete web UI status
 */
export interface WebUIStatus {
  /** Current display state */
  display: WebGameDisplay;
  /** Current prompt state */
  prompt: WebPromptState;
  /** Current interaction state */
  interaction: WebUIInteractionState;
  /** Connection status */
  connection: {
    isConnected: boolean;
    connectionId?: string;
    lastHeartbeat: number;
    latency?: number;
  };
  /** Timestamp of status */
  timestamp: number;
}

/**
 * Web UI capabilities
 */
export interface WebUICapabilities {
  /** Can display rich content */
  canDisplayRichContent: boolean;
  /** Can handle interactive elements */
  canHandleInteractivity: boolean;
  /** Can stream real-time updates */
  canStream: boolean;
  /** Can handle voice input */
  canHandleVoice: boolean;
  /** Can handle touch/mobile */
  canHandleMobile: boolean;
  /** Additional metadata */
  metadata: {
    maxConcurrentUsers: number;
    supportsWebRTC: boolean;
    supportsNotifications: boolean;
    supportsPWA: boolean;
    frameworkVersion: string;
  };
}

/**
 * Web Game UI Interface
 * 
 * This interface provides methods to control and monitor a web-based game UI,
 * enabling real-time bidirectional communication between server and browser clients.
 */
export interface IWebGameUI {
  /**
   * Get the current web display state
   * @returns Current state of web display
   */
  getCurrentDisplay(): Promise<WebGameDisplay>;

  /**
   * Get the current prompt and interactive elements
   * @returns Current web prompt state
   */
  getCurrentPrompt(): Promise<WebPromptState>;

  /**
   * Get the current web UI interaction state
   * @returns Current interaction state
   */
  getInteractionState(): Promise<WebUIInteractionState>;

  /**
   * Get complete web UI status
   * @returns Complete web UI status
   */
  getWebUIStatus(): Promise<WebUIStatus>;

  /**
   * Get web UI capabilities
   * @returns Available capabilities
   */
  getCapabilities(): WebUICapabilities;

  /**
   * Start streaming web UI state changes
   * @param callback Function to call when state changes
   * @returns Cleanup function to stop streaming
   */
  startStreaming(callback: (status: WebUIStatus) => void): () => void;

  /**
   * Check if web UI is ready and responsive
   * @returns Whether web UI is ready
   */
  isReady(): boolean;

  // === Web-specific methods ===

  /**
   * Send a message to all connected clients
   * @param message Message to broadcast
   */
  broadcastMessage(message: WebGameMessage): Promise<void>;

  /**
   * Send a message to a specific client
   * @param connectionId Target connection ID
   * @param message Message to send
   */
  sendToClient(connectionId: string, message: WebGameMessage): Promise<void>;

  /**
   * Update interactive elements for all clients
   * @param elements New interactive elements
   */
  updateInteractiveElements(elements: WebInteractiveElement[]): Promise<void>;

  /**
   * Set the visual theme
   * @param theme Theme to apply
   */
  setTheme(theme: 'light' | 'dark' | 'game'): Promise<void>;

  /**
   * Show notification to clients
   * @param notification Notification to show
   */
  showNotification(notification: {
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    duration?: number;
  }): Promise<void>;

  /**
   * Get list of connected clients
   * @returns List of connected clients
   */
  getConnectedClients(): Promise<Array<{
    connectionId: string;
    userAgent: string;
    connectedAt: number;
    lastActivity: number;
  }>>;
}

/**
 * Event types for web UI state changes
 */
export interface WebUIStateChangeEvent {
  type: 'display_changed' | 'prompt_changed' | 'interaction_changed' | 'client_connected' | 'client_disconnected' | 'message_received';
  data: any;
  timestamp: number;
  connectionId?: string;
}

/**
 * WebSocket message types for real-time communication
 */
export interface WebSocketMessage {
  type: 'state_update' | 'user_input' | 'system_message' | 'heartbeat' | 'error';
  payload: any;
  timestamp: number;
  messageId: string;
}

export default IWebGameUI;
