/**
 * Example Components for RxJS Orchestrator
 * Demonstrates how to create components that work with the orchestrator
 */

import { 
  OrchestratorComponent, 
  IOrchestratorChannels,
  AppMessage,
  SysMessage,
  UIMessage
} from './types';
import { Logger } from '../utils/logger';

/**
 * Example State Manager Component
 * Manages application state and responds to state transition requests
 */
export class StateManagerComponent implements OrchestratorComponent {
  public readonly id = 'state-manager';
  public readonly name = 'State Manager';
  
  private channels?: IOrchestratorChannels;
  private currentState = 'initial';
  private stateHistory: string[] = ['initial'];
  
  async initialize(orchestrator: IOrchestratorChannels): Promise<void> {
    this.channels = orchestrator;
    
    // Listen for state transition requests
    orchestrator.app.filter('state_transition').subscribe(message => {
      this.handleStateTransition(message);
    });
    
    // Listen for action requests that might affect state
    orchestrator.app.filter('action_request').subscribe(message => {
      this.handleActionRequest(message);
    });
    
    // Report component is ready
    orchestrator.sys.sendInfo(this.id, 'State Manager component initialized');
    
    Logger.info('📊 State Manager component initialized');
  }
  
  async shutdown(): Promise<void> {
    if (this.channels) {
      this.channels.sys.sendInfo(this.id, 'State Manager component shutting down');
    }
    Logger.info('📊 State Manager component shutdown');
  }
  
  private handleStateTransition(message: AppMessage & { type: 'state_transition' }): void {
    const { targetState } = message.payload;
    
    if (!targetState) {
      this.channels?.sys.sendWarning(this.id, 'State transition requested without target state');
      return;
    }
    
    const previousState = this.currentState;
    this.currentState = targetState;
    this.stateHistory.push(targetState);
    
    // Notify about successful transition
    this.channels?.app.sendActionResult(
      this.id,
      'state_transition',
      {
        from: previousState,
        to: targetState,
        history: this.stateHistory
      },
      true
    );
    
    // Update UI
    this.channels?.ui.sendPhaseChange(this.id, targetState, {
      previousState,
      history: this.stateHistory
    });
    
    Logger.info(`📊 State transition: ${previousState} → ${targetState}`);
  }
  
  private handleActionRequest(message: AppMessage & { type: 'action_request' }): void {
    const { actionType, actionParams } = message.payload;
    
    if (actionType === 'get_state') {
      this.channels?.app.sendActionResult(
        this.id,
        'get_state',
        {
          currentState: this.currentState,
          history: this.stateHistory
        },
        true
      );
    } else if (actionType === 'reset_state') {
      this.currentState = 'initial';
      this.stateHistory = ['initial'];
      
      this.channels?.app.sendActionResult(this.id, 'reset_state', { state: 'initial' }, true);
      this.channels?.ui.sendPhaseChange(this.id, 'initial');
      this.channels?.sys.sendInfo(this.id, 'State has been reset to initial');
    }
  }
}

/**
 * Example UI Controller Component
 * Handles user input and manages UI updates
 */
export class UIControllerComponent implements OrchestratorComponent {
  public readonly id = 'ui-controller';
  public readonly name = 'UI Controller';
  
  private channels?: IOrchestratorChannels;
  private activeUsers = new Set<string>();
  
  async initialize(orchestrator: IOrchestratorChannels): Promise<void> {
    this.channels = orchestrator;
    
    // Listen for user input
    orchestrator.ui.filter('user_input').subscribe(message => {
      this.handleUserInput(message);
    });
    
    // Listen for display update requests
    orchestrator.ui.filter('display_update').subscribe(message => {
      this.handleDisplayUpdate(message);
    });
    
    // Listen for app events that need UI updates
    orchestrator.app.filter('action_result').subscribe(message => {
      this.handleActionResult(message);
    });
    
    orchestrator.sys.sendInfo(this.id, 'UI Controller component initialized');
    Logger.info('🎨 UI Controller component initialized');
  }
  
  async shutdown(): Promise<void> {
    if (this.channels) {
      this.channels.sys.sendInfo(this.id, 'UI Controller component shutting down');
    }
    Logger.info('🎨 UI Controller component shutdown');
  }
  
  private handleUserInput(message: UIMessage & { type: 'user_input' }): void {
    const { input, command, args } = message.payload;
    
    // Track active users
    this.activeUsers.add(message.source);
    
    if (command) {
      // Route command to app layer
      this.channels?.app.sendActionRequest(this.id, command, args || []);
      
      // Provide immediate feedback
      this.channels?.ui.sendDisplayUpdate(
        this.id,
        'command-feedback',
        'info',
        `Processing command: ${command}`
      );
    } else if (input) {
      // Handle raw input
      this.channels?.ui.sendDisplayUpdate(
        this.id,
        'input-echo',
        'info',
        `Received input: ${input}`
      );
    }
    
    Logger.info(`🎨 User input from ${message.source}: ${input || command}`);
  }
  
  private handleDisplayUpdate(message: UIMessage & { type: 'display_update' }): void {
    const { component, displayType, message: displayMessage } = message.payload;
    
    // Log display updates for debugging
    Logger.info(`🎨 Display update for ${component}: ${displayMessage} (${displayType})`);
    
    // Could trigger additional UI updates based on component
    if (component === 'error-display' && displayType === 'error') {
      this.channels?.ui.sendNotification(
        this.id,
        'Error Occurred',
        displayMessage || 'An error occurred',
        'error'
      );
    }
  }
  
  private handleActionResult(message: AppMessage & { type: 'action_result' }): void {
    const { actionType, result, success } = message.payload;
    
    // Provide user feedback for action results
    const displayType = success ? 'success' : 'error';
    const displayMessage = success 
      ? `✅ ${actionType} completed successfully`
      : `❌ ${actionType} failed`;
    
    this.channels?.ui.sendDisplayUpdate(
      this.id,
      'action-result',
      displayType,
      displayMessage
    );
    
    // Show detailed result if available
    if (result && typeof result === 'object') {
      this.channels?.ui.sendRenderRequest(this.id, 'result-display', {
        actionType,
        result,
        success,
        timestamp: Date.now()
      });
    }
  }
}

/**
 * Example System Monitor Component
 * Monitors system health and performance
 */
export class SystemMonitorComponent implements OrchestratorComponent {
  public readonly id = 'system-monitor';
  public readonly name = 'System Monitor';
  
  private channels?: IOrchestratorChannels;
  private monitoringInterval?: NodeJS.Timeout;
  private healthChecks = new Map<string, boolean>();
  
  async initialize(orchestrator: IOrchestratorChannels): Promise<void> {
    this.channels = orchestrator;
    
    // Listen for health check messages
    orchestrator.sys.filter('health_check').subscribe(message => {
      this.handleHealthCheck(message);
    });
    
    // Listen for error messages
    orchestrator.sys.filter('error').subscribe(message => {
      this.handleError(message);
    });
    
    // Start periodic monitoring
    this.startMonitoring();
    
    orchestrator.sys.sendInfo(this.id, 'System Monitor component initialized');
    Logger.info('🔍 System Monitor component initialized');
  }
  
  async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.channels) {
      this.channels.sys.sendInfo(this.id, 'System Monitor component shutting down');
    }
    Logger.info('🔍 System Monitor component shutdown');
  }
  
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.performHealthChecks();
    }, 10000); // Every 10 seconds
  }
  
  private performHealthChecks(): void {
    if (!this.channels) return;
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    if (memUsageMB > 500) { // Warn if using more than 500MB
      this.channels.sys.sendWarning(
        this.id,
        `High memory usage: ${memUsageMB}MB`,
        { memoryUsage: memUsage }
      );
    }
    
    // Send health check
    this.channels.sys.sendHealthCheck(
      this.id,
      'orchestrator',
      true,
      `System healthy - Memory: ${memUsageMB}MB`
    );
    
    // Update UI with system stats
    this.channels.ui.sendRenderRequest(this.id, 'system-stats', {
      memory: memUsageMB,
      uptime: Math.round(process.uptime()),
      healthChecks: Object.fromEntries(this.healthChecks),
      timestamp: Date.now()
    });
  }
  
  private handleHealthCheck(message: SysMessage & { type: 'health_check' }): void {
    const { serviceId, health } = message.payload;
    
    if (serviceId) {
      this.healthChecks.set(serviceId, health || false);
      
      if (!health) {
        this.channels?.ui.sendNotification(
          this.id,
          'Service Health Alert',
          `Service ${serviceId} is unhealthy`,
          'warning'
        );
      }
    }
    
    Logger.info(`🔍 Health check for ${serviceId}: ${health ? 'healthy' : 'unhealthy'}`);
  }
  
  private handleError(message: SysMessage & { type: 'error' }): void {
    const { error, message: errorMessage } = message.payload;
    
    // Count errors and alert if too many
    const errorCount = Array.from(this.healthChecks.values()).filter(healthy => !healthy).length;
    
    if (errorCount > 3) {
      this.channels?.ui.sendNotification(
        this.id,
        'System Alert',
        'Multiple system errors detected',
        'error'
      );
    }
    
    Logger.error(`🔍 System error from ${message.source}: ${errorMessage}`, error);
  }
}
