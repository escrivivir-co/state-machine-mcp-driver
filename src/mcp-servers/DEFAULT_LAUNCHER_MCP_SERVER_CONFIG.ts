import { BaseMCPServerConfig } from "./MCPServerConfig";


export const DEFAULT_LAUNCHER_MCP_SERVER_CONFIG: BaseMCPServerConfig = {
	id: "mcp-service-launcher",
	name: "MCP Service Launcher",
	script: "src/mcp-servers/MCPLauncherServer.ts",
	port: 3000,
	description: "Main MCP root node",
	autoRestart: true,
	healthCheckInterval: 30000,
	capabilitiesCheck: {
		tools: true,
		resources: true,
		prompts: true,
	},
	version: "1.0.0",
	url: "http://localhost"
};
