/**
 * State Machine MCP Driver - State Models
 * Defines interfaces for runtime state management and user data
 */

import { UserData, GameData } from "./StateData";


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


