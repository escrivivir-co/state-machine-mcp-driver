/**
 * RxJS-based Orchestrator Types and Interfaces
 * Defines the communication channels and message types for the orchestrator
 */

import { Observable } from 'rxjs';

// ===== Channel Message Types =====

/**
 * Base message interface for all channels
 */
export interface BaseMessage {
  id: string;
  timestamp: number;
  source: string;
  type: string;
  payload?: any;
  metadata?: Record<string, any>;
}

/**
 * Application-level messages (business logic, state changes, etc.)
 */
export interface AppMessage extends BaseMessage {
  type: 'state_transition' | 'action_request' | 'action_result' | 'app_event' | 'agent_command';
  payload: {
    stateId?: string;
    targetState?: string;
    actionType?: string;
    actionParams?: any;
    result?: any;
    success?: boolean;
    agentId?: string;
    command?: any;
    data?: any;
  };
}

/**
 * System-level messages (health, logging, errors, configuration)
 */
export interface SysMessage extends BaseMessage {
  type: 'health_check' | 'error' | 'warning' | 'info' | 'config_change' | 'service_status';
  payload: {
    level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    message?: string;
    error?: Error;
    serviceId?: string;
    status?: 'online' | 'offline' | 'degraded';
    health?: boolean;
    configKey?: string;
    configValue?: any;
  };
}

/**
 * UI-level messages (user interactions, display updates, notifications)
 */
export interface UIMessage extends BaseMessage {
  type: 'user_input' | 'display_update' | 'notification' | 'ui_event' | 'phase_change' | 'render_request';
  payload: {
    input?: string;
    command?: string;
    args?: string[];
    displayType?: 'info' | 'success' | 'warning' | 'error';
    title?: string;
    message?: string;
    component?: string;
    phase?: string;
    uiState?: any;
    renderData?: any;
  };
}

// ===== Channel Interfaces =====

/**
 * Application Channel - Business logic and state management
 */
export interface AppChannel {
  messages$: Observable<AppMessage>;
  send(message: Omit<AppMessage, 'id' | 'timestamp'>): void;
  subscribe(handler: (message: AppMessage) => void): () => void;
  filter<T extends AppMessage['type']>(type: T): Observable<AppMessage & { type: T }>;
  
  // Convenience methods
  sendStateTransition(source: string, currentState: string, targetState: string, metadata?: Record<string, any>): void;
  sendActionRequest(source: string, actionType: string, actionParams: any, metadata?: Record<string, any>): void;
  sendActionResult(source: string, actionType: string, result: any, success: boolean, metadata?: Record<string, any>): void;
  sendAgentCommand(source: string, agentId: string, command: any, metadata?: Record<string, any>): void;
  
  // Filtered observables
  stateTransitions$(): Observable<AppMessage & { type: 'state_transition' }>;
  actionRequests$(): Observable<AppMessage & { type: 'action_request' }>;
  actionResults$(): Observable<AppMessage & { type: 'action_result' }>;
  agentCommands$(): Observable<AppMessage & { type: 'agent_command' }>;
}

/**
 * System Channel - System health, logging, and monitoring
 */
export interface SysChannel {
  messages$: Observable<SysMessage>;
  send(message: Omit<SysMessage, 'id' | 'timestamp'>): void;
  subscribe(handler: (message: SysMessage) => void): () => void;
  filter<T extends SysMessage['type']>(type: T): Observable<SysMessage & { type: T }>;
  
  // Convenience methods
  sendHealthCheck(source: string, serviceId: string, health: boolean, message?: string, metadata?: Record<string, any>): void;
  sendError(source: string, error: Error, message?: string, metadata?: Record<string, any>): void;
  sendWarning(source: string, message: string, metadata?: Record<string, any>): void;
  sendInfo(source: string, message: string, metadata?: Record<string, any>): void;
  sendConfigChange(source: string, configKey: string, configValue: any, metadata?: Record<string, any>): void;
  sendServiceStatus(source: string, serviceId: string, status: 'online' | 'offline' | 'degraded', metadata?: Record<string, any>): void;
  
  // Filtered observables
  healthChecks$(): Observable<SysMessage & { type: 'health_check' }>;
  errors$(): Observable<SysMessage & { type: 'error' }>;
  warnings$(): Observable<SysMessage & { type: 'warning' }>;
  infoMessages$(): Observable<SysMessage & { type: 'info' }>;
  configChanges$(): Observable<SysMessage & { type: 'config_change' }>;
  serviceStatuses$(): Observable<SysMessage & { type: 'service_status' }>;
}

/**
 * UI Channel - User interface interactions and updates
 */
export interface UIChannel {
  messages$: Observable<UIMessage>;
  send(message: Omit<UIMessage, 'id' | 'timestamp'>): void;
  subscribe(handler: (message: UIMessage) => void): () => void;
  filter<T extends UIMessage['type']>(type: T): Observable<UIMessage & { type: T }>;
  
  // Convenience methods
  sendUserInput(source: string, input: string, command?: string, args?: string[], metadata?: Record<string, any>): void;
  sendDisplayUpdate(source: string, component: string, displayType: 'info' | 'success' | 'warning' | 'error', message: string, metadata?: Record<string, any>): void;
  sendNotification(source: string, title: string, message: string, displayType?: 'info' | 'success' | 'warning' | 'error', metadata?: Record<string, any>): void;
  sendPhaseChange(source: string, phase: string, uiState?: any, metadata?: Record<string, any>): void;
  sendRenderRequest(source: string, component: string, renderData: any, metadata?: Record<string, any>): void;
  sendUIEvent(source: string, eventData: any, metadata?: Record<string, any>): void;
  
  // Filtered observables
  userInputs$(): Observable<UIMessage & { type: 'user_input' }>;
  displayUpdates$(): Observable<UIMessage & { type: 'display_update' }>;
  notifications$(): Observable<UIMessage & { type: 'notification' }>;
  phaseChanges$(): Observable<UIMessage & { type: 'phase_change' }>;
  renderRequests$(): Observable<UIMessage & { type: 'render_request' }>;
  uiEvents$(): Observable<UIMessage & { type: 'ui_event' }>;
}

// ===== Component Registration =====

/**
 * Component that can participate in orchestrator communication
 */
export interface OrchestratorComponent {
  id: string;
  name: string;
  initialize(orchestrator: IOrchestratorChannels): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Interface for accessing all communication channels
 */
export interface IOrchestratorChannels {
  app: AppChannel;
  sys: SysChannel;
  ui: UIChannel;
}

// ===== Configuration =====

/**
 * Orchestrator configuration options
 */
export interface OrchestratorConfig {
  /** Enable message replay buffer */
  enableReplay?: boolean;
  /** Number of messages to keep in replay buffer */
  replayBufferSize?: number;
  /** Enable message logging */
  enableLogging?: boolean;
  /** Message processing timeout (ms) */
  messageTimeout?: number;
  /** Enable cross-channel message routing */
  enableCrossChannelRouting?: boolean;
  /** Components to auto-register */
  autoRegisterComponents?: OrchestratorComponent[];
}

// ===== Events =====

/**
 * Orchestrator lifecycle events
 */
export interface OrchestratorEvents {
  'orchestrator:started': { timestamp: number };
  'orchestrator:stopped': { timestamp: number };
  'component:registered': { componentId: string; componentName: string };
  'component:unregistered': { componentId: string };
  'message:sent': { channel: string; messageType: string; messageId: string };
  'message:error': { channel: string; messageId: string; error: Error };
}
