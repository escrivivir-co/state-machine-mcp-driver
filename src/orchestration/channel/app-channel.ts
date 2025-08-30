import { Observable } from 'rxjs';
import { BaseChannel } from '../base-channel';
import { AppMessage, AppChannel } from '../types';

/**
 * Application Channel Implementation
 * Handles business logic, state transitions, and agent commands
 */

export class AppChannelImpl extends BaseChannel<AppMessage> implements AppChannel {
	constructor(enableReplay = true, replayBufferSize = 50, enableLogging = true) {
		super('APP', enableReplay, replayBufferSize, enableLogging);
	}

	protected onStart(): void {
		console.log('🚀 Application Channel: Ready for business logic events');
	}

	protected onStop(): void {
		console.log('🛑 Application Channel: Stopped processing business events');
	}

	/**
	 * Send state transition message
	 */
	public sendStateTransition(
		source: string,
		currentState: string,
		targetState: string,
		metadata?: Record<string, any>
	): void {
		this.send({
			source,
			type: 'state_transition',
			payload: {
				stateId: currentState,
				targetState,
				data: { currentState, targetState }
			},
			metadata
		});
	}

	/**
	 * Send action request
	 */
	public sendActionRequest(
		source: string,
		actionType: string,
		actionParams: any,
		metadata?: Record<string, any>
	): void {
		this.send({
			source,
			type: 'action_request',
			payload: {
				actionType,
				actionParams
			},
			metadata
		});
	}

	/**
	 * Send action result
	 */
	public sendActionResult(
		source: string,
		actionType: string,
		result: any,
		success: boolean,
		metadata?: Record<string, any>
	): void {
		this.send({
			source,
			type: 'action_result',
			payload: {
				actionType,
				result,
				success
			},
			metadata
		});
	}

	/**
	 * Send agent command
	 */
	public sendAgentCommand(
		source: string,
		agentId: string,
		command: any,
		metadata?: Record<string, any>
	): void {
		this.send({
			source,
			type: 'agent_command',
			payload: {
				agentId,
				command
			},
			metadata
		});
	}

	// Convenience filters
	public stateTransitions$(): Observable<AppMessage & { type: 'state_transition'; }> {
		return this.filter('state_transition');
	}

	public actionRequests$(): Observable<AppMessage & { type: 'action_request'; }> {
		return this.filter('action_request');
	}

	public actionResults$(): Observable<AppMessage & { type: 'action_result'; }> {
		return this.filter('action_result');
	}

	public agentCommands$(): Observable<AppMessage & { type: 'agent_command'; }> {
		return this.filter('agent_command');
	}
}
