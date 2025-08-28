/**
 * State Machine MCP Driver - Runtime Unit Tests
 */

/// <reference types="jest" />

import { Runtime, RuntimeConfig, RuntimeEvent } from '../../src/runtime/Runtime';
import { MCPDriver } from '../../src/drivers/MCPDriver';
import { 
  AgentRole, 
  AgentStatus, 
  StateType, 
  TransitionType 
} from '../../src/models';

// Mock MCPDriver for testing
class MockMCPDriver extends MCPDriver {
  private mockStateGraph = {
    id: 'test-graph',
    name: 'Test State Graph',
    version: '1.0.0',
    initialState: 'start',
    states: {
      start: {
        id: 'start',
        name: 'Start State',
        type: StateType.NORMAL,
        routes: [
          {
            id: 'to-middle',
            target: 'middle',
            trigger: 'proceed',
            type: TransitionType.USER_ACTION
          }
        ]
      },
      middle: {
        id: 'middle',
        name: 'Middle State',
        type: StateType.NORMAL,
        routes: [
          {
            id: 'to-end',
            target: 'end',
            trigger: 'finish',
            type: TransitionType.USER_ACTION
          }
        ]
      },
      end: {
        id: 'end',
        name: 'End State',
        type: StateType.FINAL,
        routes: []
      }
    }
  };

  async loadStateGraph(): Promise<any> {
    return this.mockStateGraph;
  }

  async loadState(): Promise<any> {
    return null; // Force creation of new state
  }

  async saveState(): Promise<void> {
    // Mock implementation
  }

  async executeTool(): Promise<any> {
    return { result: 'mock_result' };
  }

  async getPrompt(): Promise<string> {
    return 'Mock prompt for agent';
  }
}

describe('Runtime', () => {
  let mockMCPDriver: MockMCPDriver;
  let runtime: Runtime;
  let config: RuntimeConfig;

  beforeEach(() => {
    mockMCPDriver = new MockMCPDriver();
    config = {
      mcpServerId: 'test-server',
      graphId: 'test-graph',
      userId: 'test-user',
      sessionId: 'test-session',
      autoSave: false,
      agentConfigs: [
        {
          id: 'test-agent',
          name: 'Test Agent',
          role: AgentRole.NARRATOR,
          autoStart: true,
          config: {
            maxActionsPerMinute: 10,
            allowedActions: ['narrate', 'describe']
          }
        }
      ]
    };
    runtime = new Runtime(mockMCPDriver, config);
  });

  afterEach(async () => {
    if (runtime) {
      await runtime.shutdown();
    }
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      const initPromise = new Promise((resolve) => {
        runtime.once(RuntimeEvent.INITIALIZED, resolve);
      });

      await runtime.initialize();
      await initPromise;

      expect(runtime.getCurrentState()).toBeDefined();
      expect(runtime.getCurrentState().currentStateId).toBe('start');
    });

    test('should emit initialized event', async () => {
      const eventSpy = jest.fn();
      runtime.on(RuntimeEvent.INITIALIZED, eventSpy);

      await runtime.initialize();

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          graphId: 'test-graph',
          userId: 'test-user',
          agentCount: 1
        })
      );
    });

    test('should create initial agents', async () => {
      await runtime.initialize();

      const agents = runtime.getAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe('test-agent');
      expect(agents[0].role).toBe(AgentRole.NARRATOR);
    });

    test('should throw error if state graph loading fails', async () => {
      jest.spyOn(mockMCPDriver, 'loadStateGraph').mockRejectedValue(new Error('Load failed'));

      await expect(runtime.initialize()).rejects.toThrow('Load failed');
    });
  });

  describe('state management', () => {
    beforeEach(async () => {
      await runtime.initialize();
    });

    test('should get current state', () => {
      const state = runtime.getCurrentState();
      expect(state.currentStateId).toBe('start');
      expect(state.graphId).toBe('test-graph');
      expect(state.userId).toBe('test-user');
    });

    test('should get current state node', () => {
      const stateNode = runtime.getCurrentStateNode();
      expect(stateNode.id).toBe('start');
      expect(stateNode.name).toBe('Start State');
    });

    test('should get available routes', () => {
      const routes = runtime.getAvailableRoutes();
      expect(routes).toHaveLength(1);
      expect(routes[0].target).toBe('middle');
      expect(routes[0].trigger).toBe('proceed');
    });

    test('should transition to valid state', async () => {
      const transitionSpy = jest.fn();
      runtime.on(RuntimeEvent.STATE_TRANSITION, transitionSpy);

      await runtime.transitionTo('middle', 'proceed');

      expect(runtime.getCurrentState().currentStateId).toBe('middle');
      expect(transitionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'start',
          to: 'middle',
          trigger: 'proceed'
        })
      );
    });

    test('should reject invalid transition', async () => {
      await expect(runtime.transitionTo('invalid-state', 'invalid')).rejects.toThrow(
        'Invalid transition from start to invalid-state'
      );
    });

    test('should maintain transition history', async () => {
      await runtime.transitionTo('middle', 'proceed');
      await runtime.transitionTo('end', 'finish');

      const state = runtime.getCurrentState();
      expect(state.history).toHaveLength(2);
      expect(state.history[0].fromState).toBe('start');
      expect(state.history[0].toState).toBe('middle');
      expect(state.history[1].fromState).toBe('middle');
      expect(state.history[1].toState).toBe('end');
    });
  });

  describe('agent management', () => {
    beforeEach(async () => {
      await runtime.initialize();
    });

    test('should add agent successfully', async () => {
      const agentAddedSpy = jest.fn();
      runtime.on(RuntimeEvent.AGENT_ADDED, agentAddedSpy);

      await runtime.addAgent({
        id: 'new-agent',
        name: 'New Agent',
        role: AgentRole.GUIDE,
        config: {
          maxActionsPerMinute: 5,
          allowedActions: ['help', 'suggest']
        }
      });

      const agents = runtime.getAgents();
      expect(agents).toHaveLength(2);
      expect(agentAddedSpy).toHaveBeenCalled();
    });

    test('should remove agent successfully', async () => {
      const agentRemovedSpy = jest.fn();
      runtime.on(RuntimeEvent.AGENT_REMOVED, agentRemovedSpy);

      const removed = runtime.removeAgent('test-agent');

      expect(removed).toBe(true);
      expect(runtime.getAgents()).toHaveLength(0);
      expect(agentRemovedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-agent'
        })
      );
    });

    test('should return false when removing non-existent agent', () => {
      const removed = runtime.removeAgent('non-existent');
      expect(removed).toBe(false);
    });

    test('should get agent by ID', async () => {
      const agent = runtime.getAgent('test-agent');
      expect(agent).toBeDefined();
      expect(agent!.id).toBe('test-agent');
      expect(agent!.name).toBe('Test Agent');
    });

    test('should return undefined for non-existent agent', () => {
      const agent = runtime.getAgent('non-existent');
      expect(agent).toBeUndefined();
    });
  });

  describe('action execution', () => {
    beforeEach(async () => {
      await runtime.initialize();
    });

    test('should execute action successfully', async () => {
      const actionExecutedSpy = jest.fn();
      runtime.on(RuntimeEvent.ACTION_EXECUTED, actionExecutedSpy);

      const action = {
        id: 'test-action',
        agentId: 'test-agent',
        type: 'narrate',
        params: { content: 'Test narration' },
        timestamp: Date.now()
      };

      const result = await runtime.executeAction(action);

      expect(result.success).toBe(true);
      expect(result.actionId).toBe('test-action');
      expect(actionExecutedSpy).toHaveBeenCalled();
    });

    test('should reject action from non-existent agent', async () => {
      const action = {
        id: 'test-action',
        agentId: 'non-existent',
        type: 'narrate',
        params: { content: 'Test narration' },
        timestamp: Date.now()
      };

      const result = await runtime.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent not found');
    });

    test('should reject unauthorized action', async () => {
      const action = {
        id: 'test-action',
        agentId: 'test-agent',
        type: 'unauthorized-action',
        params: {},
        timestamp: Date.now()
      };

      const result = await runtime.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot execute action');
    });
  });

  describe('statistics', () => {
    beforeEach(async () => {
      await runtime.initialize();
    });

    test('should provide runtime statistics', () => {
      const stats = runtime.getStatistics();

      expect(stats).toHaveProperty('sessionDuration');
      expect(stats).toHaveProperty('transitionsCount');
      expect(stats).toHaveProperty('actionsExecuted');
      expect(stats).toHaveProperty('activeAgents');
      expect(stats).toHaveProperty('currentState');
      expect(stats).toHaveProperty('performance');

      expect(stats.currentState.id).toBe('start');
      expect(stats.activeAgents).toBe(1);
    });

    test('should update statistics after transitions', async () => {
      const statsBefore = runtime.getStatistics();
      expect(statsBefore.transitionsCount).toBe(0);

      await runtime.transitionTo('middle', 'proceed');

      const statsAfter = runtime.getStatistics();
      expect(statsAfter.transitionsCount).toBe(1);
      expect(statsAfter.currentState.id).toBe('middle');
    });

    test('should update statistics after actions', async () => {
      const statsBefore = runtime.getStatistics();
      expect(statsBefore.actionsExecuted).toBe(0);

      await runtime.executeAction({
        id: 'test-action',
        agentId: 'test-agent',
        type: 'narrate',
        params: {},
        timestamp: Date.now()
      });

      const statsAfter = runtime.getStatistics();
      expect(statsAfter.actionsExecuted).toBe(1);
    });
  });

  describe('error handling', () => {
    test('should handle initialization errors', async () => {
      const errorSpy = jest.fn();
      runtime.on(RuntimeEvent.ERROR_OCCURRED, errorSpy);

      jest.spyOn(mockMCPDriver, 'loadStateGraph').mockRejectedValue(new Error('Network error'));

      await expect(runtime.initialize()).rejects.toThrow();
      expect(errorSpy).toHaveBeenCalled();
    });

    test('should handle transition errors', async () => {
      await runtime.initialize();

      const errorSpy = jest.fn();
      runtime.on(RuntimeEvent.ERROR_OCCURRED, errorSpy);

      await expect(runtime.transitionTo('invalid', 'test')).rejects.toThrow();
      expect(errorSpy).toHaveBeenCalled();
    });

    test('should emit error events for runtime errors', async () => {
      const errorPromise = new Promise<void>((resolve) => {
        runtime.once(RuntimeEvent.ERROR_OCCURRED, (data) => {
          expect(data.error).toBeDefined();
          expect(data.error).toContain('Invalid transition');
          resolve();
        });
      });

      // Initialize first
      await runtime.initialize();
      
      // Trigger an error by attempting invalid transition
      try {
        await runtime.transitionTo('invalid', 'test');
      } catch (error) {
        // Expected error, continue
      }
      
      await errorPromise;
    }, 15000);
  });

  describe('lifecycle', () => {
    test('should shutdown gracefully', async () => {
      const sessionEndedSpy = jest.fn();
      runtime.on(RuntimeEvent.SESSION_ENDED, sessionEndedSpy);

      await runtime.initialize();
      await runtime.shutdown();

      expect(sessionEndedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: expect.any(Number),
          stats: expect.any(Object)
        })
      );
    });

    test('should save state on shutdown if autoSave enabled', async () => {
      const saveStateSpy = jest.spyOn(mockMCPDriver, 'saveState');
      
      const autoSaveRuntime = new Runtime(mockMCPDriver, {
        ...config,
        autoSave: true
      });

      await autoSaveRuntime.initialize();
      await autoSaveRuntime.shutdown();

      expect(saveStateSpy).toHaveBeenCalled();
    });

    test('should deactivate agents on shutdown', async () => {
      await runtime.initialize();

      const agentBefore = runtime.getAgent('test-agent');
      expect(agentBefore!.status).toBe(AgentStatus.ACTIVE);

      await runtime.shutdown();

      const agentAfter = runtime.getAgent('test-agent');
      expect(agentAfter!.status).toBe(AgentStatus.INACTIVE);
    });
  });
});
