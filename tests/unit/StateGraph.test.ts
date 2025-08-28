/**
 * State Graph Model Tests
 * Tests for StateGraph interfaces and utilities
 */

/// <reference types="jest" />

import {
  StateGraph,
  StateType,
  TransitionType,
  StateGraphValidator,
  StateGraphFactory
} from '../../src/models/StateGraph';
import { testUtils } from '../setup';

describe('StateGraph Models', () => {
  describe('StateGraphValidator', () => {
    test('should validate a correct StateGraph', () => {
      const graph = testUtils.createMockStateGraph();
      const errors = StateGraphValidator.validateStateGraph(graph);
      expect(errors).toHaveLength(0);
    });

    test('should detect missing initial state', () => {
      const graph = testUtils.createMockStateGraph();
      graph.initialState = 'nonexistent';
      const errors = StateGraphValidator.validateStateGraph(graph);
      expect(errors).toContain("Initial state 'nonexistent' not found in states");
    });

    test('should detect routes pointing to nonexistent states', () => {
      const graph = testUtils.createMockStateGraph();
      graph.states.start.routes[0].target = 'nonexistent';
      const errors = StateGraphValidator.validateStateGraph(graph);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(error => error.includes('nonexistent'))).toBe(true);
    });

    test('should find unreachable states', () => {
      const graph = testUtils.createMockStateGraph();
      // Add an unreachable state
      (graph.states as any).unreachable = {
        id: 'unreachable',
        name: 'Unreachable State',
        type: StateType.NORMAL,
        content: {},
        routes: []
      };
      
      const unreachable = StateGraphValidator.findUnreachableStates(graph as any);
      expect(unreachable).toContain('unreachable');
    });
  });

  describe('StateGraphFactory', () => {
    test('should create minimal StateGraph', () => {
      const graph = StateGraphFactory.createMinimal('test-id', 'Test Graph');
      
      expect(graph.id).toBe('test-id');
      expect(graph.name).toBe('Test Graph');
      expect(graph.initialState).toBe('start');
      expect(graph.states.start).toBeDefined();
      expect(graph.states.start.type).toBe(StateType.INITIAL);
    });

    test('should create linear StateGraph', () => {
      const steps = ['Step 1', 'Step 2', 'Step 3'];
      const graph = StateGraphFactory.createLinear('linear-test', 'Linear Test', steps);
      
      expect(graph.id).toBe('linear-test');
      expect(Object.keys(graph.states)).toHaveLength(3);
      expect(graph.states.step_0.type).toBe(StateType.INITIAL);
      expect(graph.states.step_2.type).toBe(StateType.FINAL);
      
      // Check routes connect properly
      expect(graph.states.step_0.routes[0].target).toBe('step_1');
      expect(graph.states.step_1.routes[0].target).toBe('step_2');
      expect(graph.states.step_2.routes).toHaveLength(0);
    });
  });

  describe('StateGraph Structure', () => {
    test('should have all required properties', () => {
      const graph = testUtils.createMockStateGraph();
      
      expect(graph).toHaveProperty('id');
      expect(graph).toHaveProperty('name');
      expect(graph).toHaveProperty('initialState');
      expect(graph).toHaveProperty('states');
      expect(graph).toHaveProperty('version');
      expect(graph).toHaveProperty('createdAt');
      expect(graph).toHaveProperty('updatedAt');
    });

    test('should have valid state nodes', () => {
      const graph = testUtils.createMockStateGraph();
      
      Object.values(graph.states).forEach(state => {
        expect(state).toHaveProperty('id');
        expect(state).toHaveProperty('name');
        expect(state).toHaveProperty('type');
        expect(state).toHaveProperty('content');
        expect(state).toHaveProperty('routes');
        expect(Array.isArray(state.routes)).toBe(true);
      });
    });

    test('should have valid routes', () => {
      const graph = testUtils.createMockStateGraph();
      const startState = graph.states.start;
      
      expect(startState.routes).toHaveLength(1);
      const route = startState.routes[0];
      
      expect(route).toHaveProperty('id');
      expect(route).toHaveProperty('target');
      expect(route).toHaveProperty('type');
      expect(route.type).toBe(TransitionType.USER_ACTION);
    });
  });
});
