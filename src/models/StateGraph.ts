/**
 * State Machine MCP Driver - StateGraph Models
 * Defines the core interfaces for state graphs, nodes, and transitions
 */

// Enums for better type safety and intellisense
export enum TransitionType {
    AUTOMATIC = "automatic",
    USER_ACTION = "user_action",
    AGENT_ACTION = "agent_action",
    CONDITIONAL = "conditional",
}

export enum StateType {
    NORMAL = "normal",
    INITIAL = "initial",
    FINAL = "final",
    CHECKPOINT = "checkpoint",
}

/**
 * Represents a transition route between states
 */
export interface Route {
    /** Unique identifier for this route */
    id: string;
    /** Target state ID this route leads to */
    target: string;
    /** Optional condition that must be met for this route to be valid */
    condition?: string;
    /** Action to execute when taking this route */
    action?: string;
    /** Type of transition this route represents */
    type: TransitionType;
    /** Additional metadata for the route */
    metadata?: Record<string, any>;
}

/**
 * Represents a single state node in the state graph
 */
export interface StateNode {
    /** Unique identifier for this state */
    id: string;
    /** Human-readable name for this state */
    name: string;
    /** Type of state (initial, normal, final, checkpoint) */
    type: StateType;
    /** Content/data associated with this state */
    content: any;
    /** Available routes from this state */
    routes: Route[];
    /** Actions to execute when entering this state */
    onEnter?: string[];
    /** Actions to execute when exiting this state */
    onExit?: string[];
    /** Additional metadata for the state */
    metadata?: Record<string, any>;
}

/**
 * Represents a complete state graph/state machine definition
 */
export interface StateGraph {
    /** Unique identifier for this state graph */
    id: string;
    /** Human-readable name for this state graph */
    name: string;
    /** Optional description of what this state graph represents */
    description?: string;
    /** ID of the initial state where execution begins */
    initialState: string;
    /** Map of state ID to StateNode definitions */
    states: Record<string, StateNode>;
    /** Version of this state graph */
    version: string;
    /** Author/creator of this state graph */
    author?: string;
    /** Tags for categorization and search */
    tags?: string[];
    /** Additional metadata for the state graph */
    metadata?: Record<string, any>;
    /** When this state graph was created */
    createdAt: Date;
    /** When this state graph was last updated */
    updatedAt: Date;
}
