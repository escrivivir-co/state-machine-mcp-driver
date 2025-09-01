import { BaseMCPServerConfig } from "./MCPServerConfig";


export const DEFAULT_XPLUS1_MCP_SERVER_CONFIG: BaseMCPServerConfig = {
	id: "deprecated-old-state-machine",
	name: "X+1 MCP Machine",
	script: "src/mcp-servers/-------------",
	port: 3001,
	description: "X+1 inductive pattern management and remote control server",
	autoRestart: true,
	healthCheckInterval: 30000,
	version: "1.0.0",
	url: "http://localhost"
};
