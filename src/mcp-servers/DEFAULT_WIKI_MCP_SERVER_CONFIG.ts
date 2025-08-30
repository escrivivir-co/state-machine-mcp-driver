import { BaseMCPServerConfig } from "./MCPServerConfig";


export const DEFAULT_WIKI_MCP_SERVER_CONFIG: BaseMCPServerConfig = {
	id: "wiki-mcp-browser",
	name: "Wiki MCP Browser",
	script: "src/mcp-servers/MCPWikiBrowserServer.ts",
	port: 3002,
	description: "Real Wikipedia browsing server with doom-scrolling prevention",
	autoRestart: true,
	healthCheckInterval: 30000,
	version: "1.0.0",
	url: "http://localhost"
};
