
/**
 * Utilities for working with State objects
 */

import { StateConfig, State, StateTransition } from "@/models";

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
					transitions_made: 0,
				},
			},
			gameData: {
				score: config.initialGameData?.score || 0,
				level: config.initialGameData?.level || 1,
				inventory: config.initialGameData?.inventory || [],
				flags: config.initialGameData?.flags || {},
				variables: config.initialGameData?.variables || {},
				session: {},
			},
			history: [],
			timestamp: now,
			sessionId: config.sessionId,
			version: "1.0.0",
			metadata: {},
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
			metadata,
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
	static getRecentTransitions(
		state: State,
		count: number = 10
	): StateTransition[] {
		return state.history.slice(-count);
	}

	/**
	 * Checks if a state has visited a particular state node
	 */
	static hasVisitedState(state: State, stateId: string): boolean {
		return (
			state.history.some(
				(transition) => transition.toState === stateId ||
					transition.fromState === stateId
			) || state.currentStateId === stateId
		);
	}

	/**
	 * Gets unique states visited by this state instance
	 */
	static getVisitedStates(state: State): string[] {
		const visited = new Set<string>();

		// Add current state
		visited.add(state.currentStateId);

		// Add states from history
		state.history.forEach((transition) => {
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
			level: state.gameData.level,
		};
	}

}
