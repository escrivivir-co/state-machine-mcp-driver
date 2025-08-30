import { Observable } from 'rxjs';
import { BaseChannel } from '../base-channel';
import { UIMessage, UIChannel } from '../types';

/**
 * UI Channel Implementation
 * Handles user interactions, display updates, and UI state changes
 */

export class UIChannelImpl extends BaseChannel<UIMessage> implements UIChannel {
	constructor(enableReplay = false, replayBufferSize = 30, enableLogging = true) {
		super('UI', enableReplay, replayBufferSize, enableLogging);
	}

	protected onStart(): void {
		console.log('🎨 UI Channel: Ready for user interactions and display updates');
	}

	protected onStop(): void {
		console.log('🛑 UI Channel: Stopped UI event processing');
	}

	/**
	 * Send user input message
	 */
	public sendUserInput(
		source: string,
		input: string,
		command?: string,
		args?: string[],
		metadata?: Record<string, any>
	): void {
		this.send({
			source,
			type: 'user_input',
			payload: {
				input,
				command,
				args
			},
			metadata
		});
	}

	/**
	 * Send display update message
	 */
	public sendDisplayUpdate(
		source: string,
		component: string,
		displayType: 'info' | 'success' | 'warning' | 'error',
		message: string,
		metadata?: Record<string, any>
	): void {
		this.send({
			source,
			type: 'display_update',
			payload: {
				component,
				displayType,
				message
			},
			metadata
		});
	}

	/**
	 * Send notification message
	 */
	public sendNotification(
		source: string,
		title: string,
		message: string,
		displayType: 'info' | 'success' | 'warning' | 'error' = 'info',
		metadata?: Record<string, any>
	): void {
		this.send({
			source,
			type: 'notification',
			payload: {
				title,
				message,
				displayType
			},
			metadata
		});
	}

	/**
	 * Send UI phase change
	 */
	public sendPhaseChange(
		source: string,
		phase: string,
		uiState?: any,
		metadata?: Record<string, any>
	): void {
		this.send({
			source,
			type: 'phase_change',
			payload: {
				phase,
				uiState
			},
			metadata
		});
	}

	/**
	 * Send render request
	 */
	public sendRenderRequest(
		source: string,
		component: string,
		renderData: any,
		metadata?: Record<string, any>
	): void {
		this.send({
			source,
			type: 'render_request',
			payload: {
				component,
				renderData
			},
			metadata
		});
	}

	/**
	 * Send generic UI event
	 */
	public sendUIEvent(
		source: string,
		eventData: any,
		metadata?: Record<string, any>
	): void {
		this.send({
			source,
			type: 'ui_event',
			payload: eventData,
			metadata
		});
	}

	// Convenience filters
	public userInputs$(): Observable<UIMessage & { type: 'user_input'; }> {
		return this.filter('user_input');
	}

	public displayUpdates$(): Observable<UIMessage & { type: 'display_update'; }> {
		return this.filter('display_update');
	}

	public notifications$(): Observable<UIMessage & { type: 'notification'; }> {
		return this.filter('notification');
	}

	public phaseChanges$(): Observable<UIMessage & { type: 'phase_change'; }> {
		return this.filter('phase_change');
	}

	public renderRequests$(): Observable<UIMessage & { type: 'render_request'; }> {
		return this.filter('render_request');
	}

	public uiEvents$(): Observable<UIMessage & { type: 'ui_event'; }> {
		return this.filter('ui_event');
	}
}
