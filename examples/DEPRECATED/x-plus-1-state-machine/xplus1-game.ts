/**
 * X+1 Game Configuration
 *
 * Configures the complete X+1 game including agents, MCP servers, and chat provider
 */

import { RuntimeConfig, AppConfig } from "../../src";
import {
    loadAgentPrompts,
    loadGameMessages,
} from "../x-plus-1-state-machine/mcp-servers/config-loader";
import { DEFAULT_RUNTIME_CONFIG } from "../../src/mcp-servers/DEFAULT_RUNTIME_CONFIG";

/**
 * Game configuration constants
 */
export const GAME_CONFIG = {
    MAX_MESSAGES_THREAD: 10,
    SESSION_TIMEOUT: 1800000, // 30 minutes
    AUTO_SAVE_INTERVAL: 30000, // 30 seconds
};

/**
 * Create runtime configuration for X+1 game
 */
export async function getBasicRuntimeConfig(
    config: AppConfig
): Promise<RuntimeConfig> {
    return {
        ...DEFAULT_RUNTIME_CONFIG,
        ...config.runtime,
    };
}

/**
 * Agent behavior templates for the chat provider
 */
let PROMPTS: any;
try {
    PROMPTS = loadAgentPrompts();
} catch (error) {
    console.warn("⚠️ Could not load agent prompts, using defaults");
    PROMPTS = {
        dionisio: {
            systemPrompt: "You are DionisioBot",
            maxTokens: 150,
            temperature: 0.8,
        },
        apolo: {
            systemPrompt: "You are ApoloBot",
            maxTokens: 150,
            temperature: 0.7,
        },
        justice: {
            systemPrompt: "You are JusticeBot",
            maxTokens: 100,
            temperature: 0.3,
        },
    };
}

export const AGENT_PROMPTS = {
    dionisio: {
        systemPrompt: PROMPTS.dionisio?.systemPrompt || "You are DionisioBot",
        maxTokens: PROMPTS.dionisio?.maxTokens || 150,
        temperature: PROMPTS.dionisio?.temperature || 0.8,
    },
    apolo: {
        systemPrompt: PROMPTS.apolo?.systemPrompt || "You are ApoloBot",
        maxTokens: PROMPTS.apolo?.maxTokens || 150,
        temperature: PROMPTS.apolo?.temperature || 0.7,
    },
    justice: {
        systemPrompt: (
            PROMPTS.justice?.systemPrompt || "You are JusticeBot"
        ).replace("{maxMessages}", String(GAME_CONFIG.MAX_MESSAGES_THREAD)),
        maxTokens: PROMPTS.justice?.maxTokens || 100,
        temperature: PROMPTS.justice?.temperature || 0.3,
    },
} as const;

/**
 * Message templates for different game phases
 */
let GAME_MSG: any;
try {
    GAME_MSG = loadGameMessages();
} catch (error) {
    console.warn("⚠️ Could not load game messages, using defaults");
    GAME_MSG = {
        game: {
            start: "Game started!",
            turnStart: "Turn {x} - {remaining} messages remaining",
            questionTime: "Time for the critical question at X={x}",
            advancementPositive: "X advanced from {oldX} to {newX}!",
            advancementNegative: "X reset from {oldX} to {newX}",
            end: "Game ended at X={finalX} after {turns} turns",
        },
    };
}

export const MESSAGE_TEMPLATES = {
    gameStart: GAME_MSG.game?.start || "Game started!",
    turnStart: (x: number, messageCount: number) =>
        (
            GAME_MSG.game?.turnStart ||
            "Turn {x} - {remaining} messages remaining"
        )
            .replace("{x}", String(x))
            .replace(
                "{remaining}",
                String(GAME_CONFIG.MAX_MESSAGES_THREAD - messageCount)
            ),
    questionTime: (x: number) =>
        (
            GAME_MSG.game?.questionTime ||
            "Time for the critical question at X={x}"
        ).replace("{x}", String(x)),
    advancement: (oldX: number, newX: number, advance: number) =>
        (advance > 0
            ? GAME_MSG.game?.advancementPositive ||
              "X advanced from {oldX} to {newX}!"
            : GAME_MSG.game?.advancementNegative ||
              "X reset from {oldX} to {newX}"
        )
            .replace("{oldX}", String(oldX))
            .replace("{newX}", String(newX)),
    gameEnd: (finalX: number, totalTurns: number) =>
        (GAME_MSG.game?.end || "Game ended at X={finalX} after {turns} turns")
            .replace("{finalX}", String(finalX))
            .replace("{turns}", String(totalTurns)),
} as const;

export type AgentType = "dionisio" | "apolo" | "justice";
export type GamePhase =
    | "start"
    | "conversation"
    | "decision"
    | "advancement"
    | "end";
