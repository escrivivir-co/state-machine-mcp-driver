/**
 * State Machine MCP Driver - MCP Types
 * Defines types and interfaces for MCP protocol communication
 */

/**
 * Configuration for an MCP server connection
 */
export interface MCPServerConfig {
  /** Unique identifier for this server */
  id: string;
  /** Human-readable name for this server */
  name: string;
  /** Base URL for the MCP server */
  url: string;
  /** Optional API key for authentication */
  apiKey?: string;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Additional headers to send with requests */
  headers?: Record<string, string>;
  /** Server capabilities (populated after connection) */
  capabilities?: MCPServerCapabilities;
}

/**
 * Server capabilities returned by an MCP server
 */
export interface MCPServerCapabilities {
  /** Available tools on this server */
  tools?: string[];
  /** Available resources on this server */
  resources?: string[];
  /** Available prompts on this server */
  prompts?: string[];
  /** Server version */
  version?: string;
  /** Additional server metadata */
  metadata?: Record<string, any>;
}

/**
 * Request to execute a tool on an MCP server
 */
export interface MCPToolRequest {
  /** Name of the tool to execute */
  toolName: string;
  /** Parameters to pass to the tool */
  params: Record<string, any>;
  /** Optional timeout for this specific request */
  timeout?: number;
}

/**
 * Response from executing a tool
 */
export interface MCPToolResponse {
  /** Whether the tool execution was successful */
  success: boolean;
  /** Result data from the tool */
  result?: any;
  /** Error message if execution failed */
  error?: string;
  /** Additional metadata about the execution */
  metadata?: Record<string, any>;
  /** Execution time in milliseconds */
  executionTime?: number;
}

/**
 * Request to get a resource from an MCP server
 */
export interface MCPResourceRequest {
  /** ID of the resource to retrieve */
  resourceId: string;
  /** Optional parameters for resource retrieval */
  params?: Record<string, any>;
}

/**
 * Response containing a resource
 */
export interface MCPResourceResponse {
  /** Whether the resource retrieval was successful */
  success: boolean;
  /** The resource data */
  data?: any;
  /** Content type of the resource */
  contentType?: string;
  /** Error message if retrieval failed */
  error?: string;
  /** Resource metadata */
  metadata?: Record<string, any>;
}

/**
 * Request to get a prompt from an MCP server
 */
export interface MCPPromptRequest {
  /** ID of the prompt to retrieve */
  promptId: string;
  /** Variables to interpolate into the prompt */
  variables?: Record<string, any>;
}

/**
 * Response containing a prompt
 */
export interface MCPPromptResponse {
  /** Whether the prompt retrieval was successful */
  success: boolean;
  /** The generated prompt text */
  prompt?: string;
  /** Error message if retrieval failed */
  error?: string;
  /** Prompt metadata */
  metadata?: Record<string, any>;
}

/**
 * Health check response from an MCP server
 */
export interface MCPHealthResponse {
  /** Whether the server is healthy */
  healthy: boolean;
  /** Server status message */
  status: string;
  /** Server uptime in milliseconds */
  uptime?: number;
  /** Additional health metrics */
  metrics?: Record<string, any>;
}

/**
 * Configuration for MCP client behavior
 */
export interface MCPClientConfig {
  /** Default timeout for requests in milliseconds */
  defaultTimeout: number;
  /** Default number of retry attempts */
  defaultRetries: number;
  /** Connection pool size */
  poolSize: number;
  /** Enable request/response logging */
  enableLogging: boolean;
}

/**
 * Statistics about MCP operations
 */
export interface MCPStats {
  /** Total number of requests made */
  totalRequests: number;
  /** Number of successful requests */
  successfulRequests: number;
  /** Number of failed requests */
  failedRequests: number;
  /** Average response time in milliseconds */
  averageResponseTime: number;
  /** Number of active connections */
  activeConnections: number;
  /** Requests per server */
  requestsByServer: Record<string, number>;
}

/**
 * Event types emitted by MCP operations
 */
export enum MCPEventType {
  SERVER_CONNECTED = 'server_connected',
  SERVER_DISCONNECTED = 'server_disconnected',
  SERVER_ERROR = 'server_error',
  TOOL_EXECUTED = 'tool_executed',
  RESOURCE_RETRIEVED = 'resource_retrieved',
  PROMPT_RETRIEVED = 'prompt_retrieved',
  HEALTH_CHECK = 'health_check'
}

/**
 * Event data for MCP operations
 */
export interface MCPEvent {
  /** Type of event */
  type: MCPEventType;
  /** Server ID this event relates to */
  serverId: string;
  /** Timestamp when event occurred */
  timestamp: number;
  /** Event-specific data */
  data?: any;
  /** Error information if applicable */
  error?: string;
}

/**
 * Error types that can occur in MCP operations
 */
export enum MCPErrorType {
  CONNECTION_ERROR = 'connection_error',
  TIMEOUT_ERROR = 'timeout_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  VALIDATION_ERROR = 'validation_error',
  SERVER_ERROR = 'server_error',
  NOT_FOUND_ERROR = 'not_found_error',
  RATE_LIMIT_ERROR = 'rate_limit_error'
}

/**
 * Detailed error information for MCP operations
 */
export interface MCPError extends Error {
  /** Type of MCP error */
  type: MCPErrorType;
  /** Server ID where error occurred */
  serverId?: string;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Additional error details */
  details?: Record<string, any>;
}

/**
 * Default configurations for MCP operations
 */
export const MCP_DEFAULTS = {
  TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  POOL_SIZE: 10,
  HEALTH_CHECK_INTERVAL: 60000, // 1 minute
  REQUEST_TIMEOUT: 10000 // 10 seconds
} as const;
