import { BaseMCPServerConfig } from "./MCPServerConfig";

export const DEFAULT_DEVOPS_MCP_SERVER_CONFIG: BaseMCPServerConfig = {
	id: "devops-mcp-server",
	name: "DevOps MCP Server",
	script: "src/mcp-servers/DevOpsServer.ts",
	port: 3003,
	capabilitiesCheck: {
		tools: true,
		resources: true,
		prompts: true,
	},
	features: {
		enableManagers: true,
		enableWebConsole: true,
		enableHealthChecks: true,
	},
	description: "DevOps automation and management server with CRUD capabilities",
	autoRestart: true,
	healthCheckInterval: 30000,
	url: "http://localhost",
	version: "1.0.0",
};
