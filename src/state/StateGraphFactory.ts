
/**
 * Factory utilities for creating StateGraph objects
 */

import { StateGraph, StateNode, StateType, TransitionType } from "@/models";

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
