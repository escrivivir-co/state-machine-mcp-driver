/**
 * Type definitions for Unity WebGL integration with AlephScript
 */

export interface UnityGameConfig {
  instanceId?: string;
  gameType?: string;
  botConfig?: UnityBotConfig;
  performance?: UnityPerformanceConfig;
}

export interface UnityGameSession {
  id: string;
  instanceId: string;
  gameType: string;
  botConfig: UnityBotConfig;
  startTime: number;
  status: 'active' | 'paused' | 'ended';
  lastPerformance?: UnityPerformanceData;
}

export interface UnityBotConfig {
  bots?: UnityBot[];
  settings?: UnityBotSettings;
}

export interface UnityBot {
  id: string;
  name: string;
  type: 'main-character' | 'support-character' | 'npc';
  personality: string;
  capabilities: string[];
}

export interface UnityBotSettings {
  voiceEnabled: boolean;
  animationSpeed: number;
  interactionMode: 'conversational' | 'command' | 'hybrid';
}

export interface UnityPerformanceConfig {
  fpsThreshold: number;
  memoryThreshold: number;
  reportingInterval: number;
}

export interface UnityPerformanceData {
  fps: number;
  memoryUsage: number;
  timestamp: number;
}

export interface UnityMessage {
  type: string;
  payload: any;
  timestamp: number;
  source?: string;
}

export interface UnityChannelMessage {
  channel: 'app' | 'sys' | 'ui';
  type: string;
  data: any;
  sessionId?: string;
  timestamp: number;
}

export interface UnityGameEvent {
  eventType: string;
  payload: any;
  gameObject?: string;
  timestamp: number;
}

export interface UnityUserInput {
  input: string;
  inputType: 'text' | 'voice' | 'gesture' | 'click';
  timestamp: number;
  context?: any;
}

export interface UnityActionRequest {
  actionType: string;
  parameters: any[];
  timestamp: number;
  expectsResponse: boolean;
}

export interface UnityActionResult {
  actionType: string;
  success: boolean;
  result?: any;
  error?: string;
  timestamp: number;
}

export interface UnityStateTransition {
  fromState: string;
  toState: string;
  trigger: string;
  data?: any;
  timestamp: number;
}

export interface UnityNotification {
  message: string;
  level: 'info' | 'warning' | 'error' | 'success';
  duration?: number;
  timestamp: number;
}

export interface UnityDisplayUpdate {
  component: string;
  updateType: string;
  data: any;
  timestamp: number;
}

export interface UnityHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details?: {
    fps?: number;
    memory?: number;
    errors?: string[];
  };
  timestamp: number;
}
