/**
 * State Machine MCP Driver - StateGraph Models
 * Defines the core interfaces for state graphs, nodes, and transitions
 */

// Enums for better type safety and intellisense
export enum TransitionType {
  AUTOMATIC = 'automatic',
  USER_ACTION = 'user_action', 
  AGENT_ACTION = 'agent_action',
  CONDITIONAL = 'conditional'
}

export enum StateType {
  NORMAL = 'normal',
  INITIAL = 'initial',
  FINAL = 'final',
  CHECKPOINT = 'checkpoint'
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

/**
 * Validation utilities for StateGraph objects
 */
export class StateGraphValidator {
  /**
   * Validates a StateGraph object for structural integrity
   */
  static validateStateGraph(graph: StateGraph): string[] {
    const errors: string[] = [];

    // Check if initial state exists
    if (!graph.states[graph.initialState]) {
      errors.push(`Initial state '${graph.initialState}' not found in states`);
    }

    // Validate each state
    Object.values(graph.states).forEach(state => {
      // Check routes point to valid states
      state.routes.forEach(route => {
        if (!graph.states[route.target]) {
          errors.push(`Route '${route.id}' in state '${state.id}' points to non-existent state '${route.target}'`);
        }
      });

      // Check for duplicate route IDs within the state
      const routeIds = state.routes.map(r => r.id);
      const duplicateIds = routeIds.filter((id, index) => routeIds.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        errors.push(`Duplicate route IDs in state '${state.id}': ${duplicateIds.join(', ')}`);
      }
    });

    return errors;
  }

  /**
   * Checks if a state graph has unreachable states
   */
  static findUnreachableStates(graph: StateGraph): string[] {
    const reachable = new Set<string>();
    const toVisit = [graph.initialState];

    while (toVisit.length > 0) {
      const current = toVisit.pop()!;
      if (reachable.has(current)) continue;

      reachable.add(current);
      const state = graph.states[current];
      if (state) {
        state.routes.forEach(route => {
          if (!reachable.has(route.target)) {
            toVisit.push(route.target);
          }
        });
      }
    }

    return Object.keys(graph.states).filter(stateId => !reachable.has(stateId));
  }
}

/**
 * Factory utilities for creating StateGraph objects
 */
export class StateGraphFactory {
  /**
   * Creates a minimal valid StateGraph with just an initial state
   */
  static createMinimal(id: string, name: string): StateGraph {
    const now = new Date();
    return {
      id,
      name,
      initialState: 'start',
      states: {
        start: {
          id: 'start',
          name: 'Start',
          type: StateType.INITIAL,
          content: {},
          routes: []
        }
      },
      version: '1.0.0',
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Creates a simple linear StateGraph with start -> middle -> end
   */
  static createLinear(id: string, name: string, steps: string[]): StateGraph {
    const now = new Date();
    const states: Record<string, StateNode> = {};

    steps.forEach((step, index) => {
      const isFirst = index === 0;
      const isLast = index === steps.length - 1;
      const stateId = `step_${index}`;
      const nextStateId = isLast ? undefined : `step_${index + 1}`;

      states[stateId] = {
        id: stateId,
        name: step,
        type: isFirst ? StateType.INITIAL : isLast ? StateType.FINAL : StateType.NORMAL,
        content: { step: step, order: index },
        routes: nextStateId ? [{
          id: `route_${index}_to_${index + 1}`,
          target: nextStateId,
          type: TransitionType.USER_ACTION,
          action: 'continue'
        }] : []
      };
    });

    return {
      id,
      name,
      initialState: 'step_0',
      states,
      version: '1.0.0',
      createdAt: now,
      updatedAt: now
    };
  }
}
