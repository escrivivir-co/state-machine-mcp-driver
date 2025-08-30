import { Observable } from 'rxjs';
import { BaseChannel } from '../base-channel';
import { SysMessage, SysChannel } from '../types';


/**
 * System Channel Implementation
 * Handles system health, logging, errors, and configuration
 */

export class SysChannelImpl extends BaseChannel<SysMessage> implements SysChannel {
	constructor(enableReplay = true, replayBufferSize = 100, enableLogging = true) {
		super('SYS', enableReplay, replayBufferSize, enableLogging);
	}

	protected onStart(): void {
		console.log('🔧 System Channel: Monitoring system health and logs');
	}

	protected onStop(): void {
		console.log('🛑 System Channel: Stopped system monitoring');
	}

	/**
	 * Send health check message
	 */
	public sendHealthCheck(
		source: string,
		serviceId: string,
		health: boolean,
		message?: string,
		metadata?: Record<string, any>
	): void {
		this.send({
			source,
			type: 'health_check',
			payload: {
				serviceId,
				health,
				message,
				status: health ? 'online' : 'offline'
			},
			metadata
		});
	}

	/**
	 * Send error message
	 */
	public sendError(
		source: string,
		error: Error,
		message?: string,
		metadata?: Record<string, any>
	): void {
		this.send({
			source,
			type: 'error',
			payload: {
				level: 'error',
				error,
				message: message || error.message
			},
			metadata
		});
	}

	/**
	 * Send warning message
	 */
	public sendWarning(
		source: string,
		message: string,
		metadata?: Record<string, any>
	): void {
		this.send({
			source,
			type: 'warning',
			payload: {
				level: 'warn',
				message
			},
			metadata
		});
	}

	/**
	 * Send info message
	 */
	public sendInfo(
		source: string,
		message: string,
		metadata?: Record<string, any>
	): void {
		this.send({
			source,
			type: 'info',
			payload: {
				level: 'info',
				message
			},
			metadata
		});
	}

	/**
	 * Send configuration change
	 */
	public sendConfigChange(
		source: string,
		configKey: string,
		configValue: any,
		metadata?: Record<string, any>
	): void {
		this.send({
			source,
			type: 'config_change',
			payload: {
				configKey,
				configValue
			},
			metadata
		});
	}

	/**
	 * Send service status update
	 */
	public sendServiceStatus(
		source: string,
		serviceId: string,
		status: 'online' | 'offline' | 'degraded',
		metadata?: Record<string, any>
	): void {
		this.send({
			source,
			type: 'service_status',
			payload: {
				serviceId,
				status
			},
			metadata
		});
	}

	// Convenience filters
	public healthChecks$(): Observable<SysMessage & { type: 'health_check'; }> {
		return this.filter('health_check');
	}

	public errors$(): Observable<SysMessage & { type: 'error'; }> {
		return this.filter('error');
	}

	public warnings$(): Observable<SysMessage & { type: 'warning'; }> {
		return this.filter('warning');
	}

	public infoMessages$(): Observable<SysMessage & { type: 'info'; }> {
		return this.filter('info');
	}

	public configChanges$(): Observable<SysMessage & { type: 'config_change'; }> {
		return this.filter('config_change');
	}

	public serviceStatuses$(): Observable<SysMessage & { type: 'service_status'; }> {
		return this.filter('service_status');
	}
}
