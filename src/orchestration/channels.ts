/**
 * Specific Channel Implementations
 * Concrete implementations of the three communication channels
 */

import { Observable } from 'rxjs';
import { BaseChannel } from './BaseChannel';
import { AppMessage, SysMessage, UIMessage, AppChannel, SysChannel, UIChannel } from './types';

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
  public stateTransitions$(): Observable<AppMessage & { type: 'state_transition' }> {
    return this.filter('state_transition');
  }

  public actionRequests$(): Observable<AppMessage & { type: 'action_request' }> {
    return this.filter('action_request');
  }

  public actionResults$(): Observable<AppMessage & { type: 'action_result' }> {
    return this.filter('action_result');
  }

  public agentCommands$(): Observable<AppMessage & { type: 'agent_command' }> {
    return this.filter('agent_command');
  }
}

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
  public healthChecks$(): Observable<SysMessage & { type: 'health_check' }> {
    return this.filter('health_check');
  }

  public errors$(): Observable<SysMessage & { type: 'error' }> {
    return this.filter('error');
  }

  public warnings$(): Observable<SysMessage & { type: 'warning' }> {
    return this.filter('warning');
  }

  public infoMessages$(): Observable<SysMessage & { type: 'info' }> {
    return this.filter('info');
  }

  public configChanges$(): Observable<SysMessage & { type: 'config_change' }> {
    return this.filter('config_change');
  }

  public serviceStatuses$(): Observable<SysMessage & { type: 'service_status' }> {
    return this.filter('service_status');
  }
}

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
  public userInputs$(): Observable<UIMessage & { type: 'user_input' }> {
    return this.filter('user_input');
  }

  public displayUpdates$(): Observable<UIMessage & { type: 'display_update' }> {
    return this.filter('display_update');
  }

  public notifications$(): Observable<UIMessage & { type: 'notification' }> {
    return this.filter('notification');
  }

  public phaseChanges$(): Observable<UIMessage & { type: 'phase_change' }> {
    return this.filter('phase_change');
  }

  public renderRequests$(): Observable<UIMessage & { type: 'render_request' }> {
    return this.filter('render_request');
  }

  public uiEvents$(): Observable<UIMessage & { type: 'ui_event' }> {
    return this.filter('ui_event');
  }
}
