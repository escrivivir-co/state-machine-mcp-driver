/**
 * MCP Driver Adapter
 * Native MCP protocol implementation
 */

import { MCPClientDriver } from './MCPClientDriver';

/**
 * Adapter configuration
 */
export interface MCPDriverAdapterConfig {
  /** Reserved for future use */
  reserved?: boolean;
}

/**
 * MCP Driver Adapter - Native MCP protocol only
 */
export class MCPDriverAdapter extends MCPClientDriver {

}
