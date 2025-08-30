import { AgentRole } from "@/models";
import { RuntimeConfig } from "@/runtime";
import { GAME_CONFIG } from "../../examples/xplus1-app/xplus1-game";


export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
	mcpServerId: "state-machine-server",
	graphId: "x-plus-1-game",
	userId: "player-1",
	sessionId: `x-plus-1-${Date.now()}`,
	maxMessagesPerThread: GAME_CONFIG.MAX_MESSAGES_THREAD,
	sessionTimeout: GAME_CONFIG.SESSION_TIMEOUT,
	autoSave: true,
	autoSaveInterval: GAME_CONFIG.AUTO_SAVE_INTERVAL,

	agentConfigs: [
		{
			id: "dionisio-bot",
			name: "DionisioBot",
			role: AgentRole.NARRATOR,
			description: "Hedonistic agent that represents immediate gratification and cosmic doom-scrolling",
			mcpServerId: "wiki-mcp-browser",
			autoStart: true,
			priority: 10,
			config: {
				maxActionsPerMinute: 3,
				allowedActions: [
					"narrate",
					"describe",
					"present",
					"browse_cosmic",
				],
				personality: "hedonistic",
				influence: "negative",
				topics: "cosmic",
			},
		},
		{
			id: "apolo-bot",
			name: "ApoloBot",
			role: AgentRole.GUIDE,
			description: "Wisdom agent that represents discipline and historical learning",
			mcpServerId: "wiki-mcp-browser",
			autoStart: true,
			priority: 10,
			config: {
				maxActionsPerMinute: 3,
				allowedActions: [
					"guide",
					"help",
					"suggest",
					"explain",
					"browse_history",
				],
				personality: "wise",
				influence: "positive",
				topics: "historical",
			},
		},
		{
			id: "justice-bot",
			name: "JusticeBot",
			role: AgentRole.SYSTEM,
			description: "Neutral arbiter that manages the X+1 decision process",
			mcpServerId: "xplus1-mcp-machine",
			autoStart: true,
			priority: 100, // Highest priority for managing decisions
			config: {
				maxActionsPerMinute: 5,
				allowedActions: [
					"question",
					"validate",
					"update_state",
					"manage_turn",
				],
				personality: "neutral",
				influence: "balanced",
				keyQuestion: "Did you consume today, do I reset?",
			},
		},
		{
			id: "user-simulator",
			name: "UserSimulator",
			role: AgentRole.PLAYER,
			description: "Simulated user that decides yes/no and can choose next agent",
			autoStart: true,
			priority: 90,
			config: {
				personality: "balanced",
				allowedActions: ["choose", "interact"],
			},
		},
	],
};
