/**
 * Chat Provider Types
 * Types and interfaces for chat provider functionality
 */

import { MCPToolResponse } from '../drivers/MCPTypes';

/**
 * Chat message role types
 */
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Individual chat message
 */
export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

/**
 * Tool call information
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Chat completion request
 */
export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | { type: 'function', function: { name: string } };
}

/**
 * Tool definition for MCP integration
 */
export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

/**
 * Chat completion response
 */
export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Chat choice in response
 */
export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'function_call' | 'tool_calls' | null;
}

/**
 * Chat provider configuration
 */
export interface ChatProviderConfig {
  /** Ollama base URL */
  baseUrl: string;
  /** Default model to use */
  defaultModel: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Default temperature for chat completions */
  defaultTemperature?: number;
  /** Default max tokens */
  defaultMaxTokens?: number;
  /** Enable MCP tool integration */
  enableMCP?: boolean;
}

/**
 * Conversation context for maintaining state
 */
export interface ConversationContext {
  /** Unique conversation ID */
  id: string;
  /** Messages in this conversation */
  messages: ChatMessage[];
  /** Available MCP tools */
  mcpTools: Tool[];
  /** User ID associated with this conversation */
  userId?: string;
  /** Session metadata */
  metadata: Record<string, any>;
  /** Creation timestamp */
  created: number;
  /** Last updated timestamp */
  updated: number;
}

/**
 * Chat provider events
 */
export type ChatProviderEventType = 
  | 'conversation_started'
  | 'message_sent'
  | 'message_received'
  | 'tool_called'
  | 'tool_response'
  | 'error'
  | 'conversation_ended';

/**
 * Chat provider event data
 */
export interface ChatProviderEvent {
  type: ChatProviderEventType;
  conversationId: string;
  data: any;
  timestamp: number;
}

/**
 * Chat statistics
 */
export interface ChatStats {
  totalConversations: number;
  activeConversations: number;
  totalMessages: number;
  totalTokensUsed: number;
  totalToolCalls: number;
  averageResponseTime: number;
  conversationsByModel: Record<string, number>;
}
