/**
 * State Machine MCP Driver - State Models
 * Defines interfaces for runtime state management and user data
 */

/**
 * User profile and preference data
 */
export interface UserData {
  /** Unique user identifier */
  id: string;
  /** User profile information */
  profile?: {
    name?: string;
    avatar?: string;
    level?: number;
    experience?: number;
    [key: string]: any;
  };
  /** User preferences and settings */
  preferences?: {
    language?: string;
    theme?: string;
    sound?: boolean;
    notifications?: boolean;
    [key: string]: any;
  };
  /** Achievements unlocked by this user */
  achievements?: string[];
  /** User statistics and metrics */
  statistics?: Record<string, number>;
}

/**
 * Game-specific data and variables
 */
export interface GameData {
  /** Current game score */
  score?: number;
  /** Current game level */
  level?: number;
  /** User's inventory items */
  inventory?: any[];
  /** Boolean flags for game state */
  flags?: Record<string, boolean>;
  /** Game variables and counters */
  variables?: Record<string, any>;
  /** Temporary session data */
  session?: Record<string, any>;
}

/**
 * Represents a single state transition in history
 */
export interface StateTransition {
  /** Source state ID */
  fromState: string;
  /** Destination state ID */
  toState: string;
  /** Timestamp when transition occurred */
  timestamp: number;
  /** What triggered this transition */
  trigger: string;
  /** Route ID that was taken */
  routeId?: string;
  /** Additional metadata about the transition */
  metadata?: Record<string, any>;
}

/**
 * Complete state instance for a user's session
 */
export interface State {
  /** Unique state instance identifier */
  id: string;
  /** ID of the StateGraph this state belongs to */
  graphId: string;
  /** ID of the user this state belongs to */
  userId: string;
  /** Current active state in the graph */
  currentStateId: string;
  /** User-specific data */
  userData: UserData;
  /** Game-specific data */
  gameData: GameData;
  /** History of state transitions */
  history: StateTransition[];
  /** When this state was last updated */
  timestamp: number;
  /** Optional session identifier */
  sessionId?: string;
  /** Version of the state format */
  version: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Configuration for creating a new state
 */
export interface StateConfig {
  graphId: string;
  userId: string;
  initialStateId: string;
  sessionId?: string;
  initialUserData?: Partial<UserData>;
  initialGameData?: Partial<GameData>;
}

/**
 * Utilities for working with State objects
 */
export class StateManager {
  /**
   * Creates a new State instance with default values
   */
  static createNew(config: StateConfig): State {
    const now = Date.now();
    
    return {
      id: `state_${config.userId}_${config.graphId}_${now}`,
      graphId: config.graphId,
      userId: config.userId,
      currentStateId: config.initialStateId,
      userData: {
        id: config.userId,
        profile: config.initialUserData?.profile || {},
        preferences: config.initialUserData?.preferences || {},
        achievements: config.initialUserData?.achievements || [],
        statistics: config.initialUserData?.statistics || {
          games_played: 0,
          total_time: 0,
          states_visited: 0,
          transitions_made: 0
        }
      },
      gameData: {
        score: config.initialGameData?.score || 0,
        level: config.initialGameData?.level || 1,
        inventory: config.initialGameData?.inventory || [],
        flags: config.initialGameData?.flags || {},
        variables: config.initialGameData?.variables || {},
        session: {}
      },
      history: [],
      timestamp: now,
      sessionId: config.sessionId,
      version: '1.0.0',
      metadata: {}
    };
  }

  /**
   * Records a state transition in the history
   */
  static recordTransition(
    state: State, 
    fromState: string, 
    toState: string, 
    trigger: string,
    routeId?: string,
    metadata?: Record<string, any>
  ): void {
    const transition: StateTransition = {
      fromState,
      toState,
      timestamp: Date.now(),
      trigger,
      routeId,
      metadata
    };

    state.history.push(transition);
    state.currentStateId = toState;
    state.timestamp = transition.timestamp;

    // Update statistics
    if (state.userData.statistics) {
      state.userData.statistics.transitions_made = 
        (state.userData.statistics.transitions_made || 0) + 1;
    }
  }

  /**
   * Gets the last N transitions from history
   */
  static getRecentTransitions(state: State, count: number = 10): StateTransition[] {
    return state.history.slice(-count);
  }

  /**
   * Checks if a state has visited a particular state node
   */
  static hasVisitedState(state: State, stateId: string): boolean {
    return state.history.some(transition => 
      transition.toState === stateId || transition.fromState === stateId
    ) || state.currentStateId === stateId;
  }

  /**
   * Gets unique states visited by this state instance
   */
  static getVisitedStates(state: State): string[] {
    const visited = new Set<string>();
    
    // Add current state
    visited.add(state.currentStateId);
    
    // Add states from history
    state.history.forEach(transition => {
      visited.add(transition.fromState);
      visited.add(transition.toState);
    });

    return Array.from(visited);
  }

  /**
   * Calculates session duration in milliseconds
   */
  static getSessionDuration(state: State): number {
    if (state.history.length === 0) {
      return Date.now() - state.timestamp;
    }

    const firstTransition = state.history[0];
    return Date.now() - firstTransition.timestamp;
  }

  /**
   * Creates a summary of the state for logging/debugging
   */
  static createSummary(state: State): any {
    return {
      id: state.id,
      graphId: state.graphId,
      userId: state.userId,
      currentState: state.currentStateId,
      transitionCount: state.history.length,
      sessionDuration: StateManager.getSessionDuration(state),
      visitedStates: StateManager.getVisitedStates(state).length,
      score: state.gameData.score,
      level: state.gameData.level
    };
  }

  /**
   * Validates a State object for completeness
   */
  static validate(state: State): string[] {
    const errors: string[] = [];

    if (!state.id) errors.push('State ID is required');
    if (!state.graphId) errors.push('Graph ID is required');
    if (!state.userId) errors.push('User ID is required');
    if (!state.currentStateId) errors.push('Current state ID is required');
    if (!state.userData?.id) errors.push('User data ID is required');
    if (state.timestamp <= 0) errors.push('Valid timestamp is required');

    return errors;
  }
}
