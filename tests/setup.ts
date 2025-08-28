/**
 * Test Setup Configuration
 * Sets up global test environment and utilities
 */

import { StateType, TransitionType } from '../src/models/StateGraph';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Export test utilities
export const testUtils = {
  /**
   * Create a mock StateGraph for testing
   */
  createMockStateGraph: () => ({
    id: 'test-graph',
    name: 'Test State Graph',
    initialState: 'start',
    states: {
      start: {
        id: 'start',
        name: 'Start State',
        type: StateType.INITIAL,
        content: { message: 'Welcome' },
        routes: [{
          id: 'route-1',
          target: 'end',
          type: TransitionType.USER_ACTION
        }]
      },
      end: {
        id: 'end',
        name: 'End State',
        type: StateType.FINAL,
        content: { message: 'Goodbye' },
        routes: []
      }
    },
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date()
  }),

  /**
   * Create a mock State for testing
   */
  createMockState: () => ({
    id: 'test-state',
    graphId: 'test-graph',
    userId: 'test-user',
    currentStateId: 'start',
    userData: {
      id: 'test-user',
      profile: {},
      preferences: {},
      achievements: [],
      statistics: {}
    },
    gameData: {
      score: 0,
      level: 1,
      inventory: [],
      flags: {},
      variables: {},
      session: {}
    },
    history: [],
    timestamp: Date.now(),
    version: '1.0.0'
  }),

  /**
   * Wait for async operations to complete
   */
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};
