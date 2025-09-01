import { MCPEventType } from "./MCPTypes";

/**
 * Native MCP Client Driver using official SDK
 * Implements IMCPDriver interface for Runtime compatibility
 */

export type DEPRECATED_MCP_EVENTS = "tool" | "resource" | "prompt" | "state" | "health" | "error";
export type MCPEventData = any;

export interface MCPEvent {
    type: MCPEventType | DEPRECATED_MCP_EVENTS;
    action: string;
    serverId: string;
    timestamp: number;    
    data?: MCPEventData;
    error?: string;
}
