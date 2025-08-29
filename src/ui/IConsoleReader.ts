/**
 * Console Reader Interface
 * Base interface for reading console/UI state
 */

/**
 * Current state of the console output
 */
export interface ConsoleOutput {
  /** Complete current output text */
  fullText: string;
  /** Last N lines of output */
  lastLines: string[];
  /** Timestamp of last output */
  timestamp: number;
  /** Whether console is actively showing content */
  isActive: boolean;
}

/**
 * Current prompt state and available options
 */
export interface PromptState {
  /** Current prompt text being shown */
  promptText: string;
  /** Available user options */
  availableOptions: PromptOption[];
  /** Whether waiting for user input */
  isWaitingForInput: boolean;
  /** Type of input expected */
  inputType: 'selection' | 'text' | 'yes_no' | 'numeric';
  /** Current context/phase */
  context: string;
}

/**
 * Individual prompt option
 */
export interface PromptOption {
  /** Option key/identifier */
  key: string;
  /** Human-readable description */
  description: string;
  /** Whether option is currently available */
  enabled: boolean;
  /** Additional metadata */
  metadata?: any;
}

/**
 * Overall UI interaction state
 */
export interface UIInteractionState {
  /** Current UI phase */
  phase: 'startup' | 'menu' | 'conversation' | 'waiting' | 'decision' | 'completed';
  /** Last user action performed */
  lastUserAction?: string;
  /** Pending actions in queue */
  pendingActions: string[];
  /** Available commands at this moment */
  availableCommands: string[];
  /** Whether UI is responsive to input */
  isResponsive: boolean;
  /** Current interaction context */
  interactionContext?: any;
}

/**
 * Overall UI status information  
 */
export interface UIStatus {
  /** Current interaction state */
  interaction: UIInteractionState;
  /** Current prompt state */
  prompt: PromptState;
  /** Current console output */
  console: ConsoleOutput;
  /** Timestamp of this status */
  timestamp: number;
}

/**
 * Capabilities for console reading operations
 */
export interface ConsoleReadingCapabilities {
  /** Can read current console output */
  canReadOutput: boolean;
  /** Can read current prompt state */
  canReadPrompt: boolean;
  /** Can read interaction state */
  canReadInteraction: boolean;
  /** Can stream real-time updates */
  canStream: boolean;
  /** Additional capability metadata */
  metadata?: any;
}

/**
 * Interface for reading console/UI state
 * 
 * This interface provides methods to read the current state of a console-based UI,
 * enabling remote control systems to understand what's currently displayed
 * before sending commands.
 */
export interface IConsoleReader {
  /**
   * Get the current console output
   * @returns Current state of console output
   */
  getCurrentOutput(): Promise<ConsoleOutput>;

  /**
   * Get the current prompt and available options
   * @returns Current prompt state
   */
  getCurrentPrompt(): Promise<PromptState>;

  /**
   * Get the current UI interaction state
   * @returns Current interaction state
   */
  getInteractionState(): Promise<UIInteractionState>;

  /**
   * Get complete UI status (combination of all states)
   * @returns Complete UI status
   */
  getUIStatus(): Promise<UIStatus>;

  /**
   * Get console reading capabilities
   * @returns Available capabilities
   */
  getCapabilities(): ConsoleReadingCapabilities;

  /**
   * Start streaming console state changes (optional)
   * @param callback Function to call when state changes
   * @returns Cleanup function to stop streaming
   */
  startStreaming?(callback: (status: UIStatus) => void): () => void;

  /**
   * Check if console is currently active and responsive
   * @returns Whether console is ready for reading
   */
  isReady(): boolean;
}

/**
 * Event types for console state changes
 */
export interface ConsoleStateChangeEvent {
  type: 'output_changed' | 'prompt_changed' | 'interaction_changed' | 'status_changed';
  data: any;
  timestamp: number;
}
