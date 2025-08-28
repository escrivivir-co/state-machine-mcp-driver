/**
 * State Machine MCP Driver - Validation Utilities
 * Provides validation functions for various data types and structures
 */

import { StateGraph, StateNode, Route, State, StateTransition } from '../models';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Include warnings in validation */
  includeWarnings?: boolean;
  /** Skip certain validation checks */
  skipChecks?: string[];
  /** Maximum allowed depth for recursive validation */
  maxDepth?: number;
}

/**
 * Common validation utilities
 */
export class Validators {
  /**
   * Validate if a string is a valid ID (alphanumeric, dashes, underscores)
   */
  static isValidId(id: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(id);
  }

  /**
   * Validate if a string is a valid URL
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate if a value is a non-empty string
   */
  static isNonEmptyString(value: any): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  /**
   * Validate if a value is a positive number
   */
  static isPositiveNumber(value: any): boolean {
    return typeof value === 'number' && value > 0 && !isNaN(value);
  }

  /**
   * Validate if a value is a valid timestamp
   */
  static isValidTimestamp(value: any): boolean {
    return typeof value === 'number' && value > 0 && value <= Date.now() + 86400000; // Max 1 day in future
  }

  /**
   * Validate if an object has required properties
   */
  static hasRequiredProperties(obj: any, requiredProps: string[]): string[] {
    const missing: string[] = [];
    requiredProps.forEach(prop => {
      if (!(prop in obj) || obj[prop] === undefined || obj[prop] === null) {
        missing.push(prop);
      }
    });
    return missing;
  }
}

/**
 * StateGraph validation utilities
 */
export class StateGraphValidator {
  /**
   * Validate a complete StateGraph
   */
  static validate(graph: StateGraph, options: ValidationOptions = {}): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic structure validation
    const requiredProps = ['id', 'name', 'initialState', 'states', 'version'];
    const missingProps = Validators.hasRequiredProperties(graph, requiredProps);
    if (missingProps.length > 0) {
      errors.push(`Missing required properties: ${missingProps.join(', ')}`);
    }

    // ID validation
    if (!Validators.isValidId(graph.id)) {
      errors.push('StateGraph ID must contain only alphanumeric characters, dashes, and underscores');
    }

    // Name validation
    if (!Validators.isNonEmptyString(graph.name)) {
      errors.push('StateGraph name must be a non-empty string');
    }

    // Initial state validation
    if (!graph.states || !graph.states[graph.initialState]) {
      errors.push(`Initial state '${graph.initialState}' not found in states`);
    }

    // States validation
    if (!graph.states || Object.keys(graph.states).length === 0) {
      errors.push('StateGraph must have at least one state');
    } else {
      Object.values(graph.states).forEach(state => {
        const stateValidation = this.validateStateNode(state, graph);
        errors.push(...stateValidation.errors);
        if (options.includeWarnings) {
          warnings.push(...(stateValidation.warnings || []));
        }
      });
    }

    // Version validation
    if (!Validators.isNonEmptyString(graph.version)) {
      errors.push('StateGraph version must be a non-empty string');
    }

    // Reachability analysis
    if (!options.skipChecks?.includes('reachability')) {
      const unreachableStates = this.findUnreachableStates(graph);
      if (unreachableStates.length > 0) {
        warnings.push(`Unreachable states found: ${unreachableStates.join(', ')}`);
      }
    }

    // Circular dependency check
    if (!options.skipChecks?.includes('circular')) {
      const circularPaths = this.findCircularDependencies(graph);
      if (circularPaths.length > 0) {
        warnings.push(`Potential circular paths detected`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: options.includeWarnings ? warnings : undefined
    };
  }

  /**
   * Validate a single StateNode
   */
  static validateStateNode(state: StateNode, graph?: StateGraph): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic structure validation
    const requiredProps = ['id', 'name', 'type', 'content', 'routes'];
    const missingProps = Validators.hasRequiredProperties(state, requiredProps);
    if (missingProps.length > 0) {
      errors.push(`Missing required properties: ${missingProps.join(', ')}`);
    }

    // ID validation
    if (!Validators.isValidId(state.id)) {
      errors.push('State ID must contain only alphanumeric characters, dashes, and underscores');
    }

    // Name validation
    if (!Validators.isNonEmptyString(state.name)) {
      errors.push('State name must be a non-empty string');
    }

    // Routes validation
    if (Array.isArray(state.routes)) {
      state.routes.forEach((route, index) => {
        const routeValidation = this.validateRoute(route, graph);
        routeValidation.errors.forEach(error => {
          errors.push(`Route ${index}: ${error}`);
        });
      });
    } else {
      errors.push('Routes must be an array');
    }

    // Check for unreachable state (no incoming routes)
    if (graph && state.id !== graph.initialState) {
      const hasIncomingRoutes = Object.values(graph.states).some(otherState =>
        otherState.routes.some(route => route.target === state.id)
      );
      if (!hasIncomingRoutes) {
        warnings.push(`State '${state.id}' has no incoming routes and may be unreachable`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate a single Route
   */
  static validateRoute(route: Route, graph?: StateGraph): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic structure validation
    const requiredProps = ['id', 'target', 'type'];
    const missingProps = Validators.hasRequiredProperties(route, requiredProps);
    if (missingProps.length > 0) {
      errors.push(`Missing required properties: ${missingProps.join(', ')}`);
    }

    // ID validation
    if (!Validators.isValidId(route.id)) {
      errors.push('Route ID must contain only alphanumeric characters, dashes, and underscores');
    }

    // Target validation
    if (graph && !graph.states[route.target]) {
      errors.push(`Target state '${route.target}' does not exist`);
    }

    // Condition validation
    if (route.condition && !Validators.isNonEmptyString(route.condition)) {
      errors.push('Route condition must be a non-empty string if provided');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Find unreachable states in a graph
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

  /**
   * Find potential circular dependencies
   */
  static findCircularDependencies(graph: StateGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const path: string[] = [];

    function dfs(stateId: string): void {
      if (path.includes(stateId)) {
        const cycleStart = path.indexOf(stateId);
        cycles.push(path.slice(cycleStart).concat(stateId));
        return;
      }

      if (visited.has(stateId)) return;

      visited.add(stateId);
      path.push(stateId);

      const state = graph.states[stateId];
      if (state) {
        state.routes.forEach(route => {
          dfs(route.target);
        });
      }

      path.pop();
    }

    Object.keys(graph.states).forEach(stateId => {
      if (!visited.has(stateId)) {
        dfs(stateId);
      }
    });

    return cycles;
  }
}

/**
 * State validation utilities
 */
export class StateValidator {
  /**
   * Validate a State object
   */
  static validate(state: State): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic structure validation
    const requiredProps = ['id', 'graphId', 'userId', 'currentStateId', 'userData', 'gameData', 'history', 'timestamp', 'version'];
    const missingProps = Validators.hasRequiredProperties(state, requiredProps);
    if (missingProps.length > 0) {
      errors.push(`Missing required properties: ${missingProps.join(', ')}`);
    }

    // ID validation
    if (!Validators.isNonEmptyString(state.id)) {
      errors.push('State ID must be a non-empty string');
    }

    // Graph ID validation
    if (!Validators.isValidId(state.graphId)) {
      errors.push('Graph ID must contain only alphanumeric characters, dashes, and underscores');
    }

    // User ID validation
    if (!Validators.isNonEmptyString(state.userId)) {
      errors.push('User ID must be a non-empty string');
    }

    // Current state ID validation
    if (!Validators.isValidId(state.currentStateId)) {
      errors.push('Current state ID must contain only alphanumeric characters, dashes, and underscores');
    }

    // Timestamp validation
    if (!Validators.isValidTimestamp(state.timestamp)) {
      errors.push('Invalid timestamp');
    }

    // History validation
    if (Array.isArray(state.history)) {
      state.history.forEach((transition, index) => {
        const transitionValidation = this.validateStateTransition(transition);
        transitionValidation.errors.forEach(error => {
          errors.push(`History[${index}]: ${error}`);
        });
      });
    } else {
      errors.push('History must be an array');
    }

    // UserData validation
    if (state.userData && !state.userData.id) {
      errors.push('UserData must have an ID');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate a StateTransition
   */
  static validateStateTransition(transition: StateTransition): ValidationResult {
    const errors: string[] = [];

    // Basic structure validation
    const requiredProps = ['fromState', 'toState', 'timestamp', 'trigger'];
    const missingProps = Validators.hasRequiredProperties(transition, requiredProps);
    if (missingProps.length > 0) {
      errors.push(`Missing required properties: ${missingProps.join(', ')}`);
    }

    // State IDs validation
    if (!Validators.isValidId(transition.fromState)) {
      errors.push('From state ID must contain only alphanumeric characters, dashes, and underscores');
    }

    if (!Validators.isValidId(transition.toState)) {
      errors.push('To state ID must contain only alphanumeric characters, dashes, and underscores');
    }

    // Timestamp validation
    if (!Validators.isValidTimestamp(transition.timestamp)) {
      errors.push('Invalid timestamp');
    }

    // Trigger validation
    if (!Validators.isNonEmptyString(transition.trigger)) {
      errors.push('Trigger must be a non-empty string');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
