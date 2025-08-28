/**
 * X+1 Game Configuration
 * 
 * Configures the complete X+1 game including agents, MCP servers, and chat provider
 */

import { RuntimeConfig, AgentRole } from '../../src';
import { startXPlus1Server } from './mcp-servers/xplus1-mock';
import { startWikiServer } from './mcp-servers/wiki-mock';
import { loadAgentPrompts, loadGameMessages } from './mcp-servers/config-loader';

/**
 * Game configuration constants
 */
export const GAME_CONFIG = {
  MAX_MESSAGES_THREAD: 10,
  SESSION_TIMEOUT: 1800000, // 30 minutes
  AUTO_SAVE_INTERVAL: 30000, // 30 seconds
} as const;

/**
 * Create runtime configuration for X+1 game
 */
export async function createXPlus1RuntimeConfig(): Promise<RuntimeConfig> {
  // Use existing MCP servers started by launcher (no need to start new ones)
  // const xplus1Server = await startXPlus1Server();
  // const wikiServer = await startWikiServer();

  const config: RuntimeConfig = {
    mcpServerId: 'xplus1-mcp-machine',
    graphId: 'x-plus-1-game',
    userId: 'player-1',
    sessionId: `x-plus-1-${Date.now()}`,
    maxMessagesPerThread: GAME_CONFIG.MAX_MESSAGES_THREAD,
    sessionTimeout: GAME_CONFIG.SESSION_TIMEOUT,
    autoSave: true,
    autoSaveInterval: GAME_CONFIG.AUTO_SAVE_INTERVAL,
    
  agentConfigs: [
      {
        id: 'dionisio-bot',
        name: 'DionisioBot',
        role: AgentRole.NARRATOR,
        description: 'Hedonistic agent that represents immediate gratification and cosmic doom-scrolling',
        mcpServerId: 'wiki-mcp-browser',
        autoStart: true,
        priority: 10,
        config: {
          maxActionsPerMinute: 3,
          allowedActions: ['narrate', 'describe', 'present', 'browse_cosmic'],
          personality: 'hedonistic',
          influence: 'negative',
          topics: 'cosmic'
        }
      },
      {
        id: 'apolo-bot', 
        name: 'ApoloBot',
        role: AgentRole.GUIDE,
        description: 'Wisdom agent that represents discipline and historical learning',
        mcpServerId: 'wiki-mcp-browser',
        autoStart: true,
        priority: 10,
        config: {
          maxActionsPerMinute: 3,
          allowedActions: ['guide', 'help', 'suggest', 'explain', 'browse_history'],
          personality: 'wise',
          influence: 'positive',
          topics: 'historical'
        }
      },
      {
        id: 'justice-bot',
        name: 'JusticeBot', 
        role: AgentRole.SYSTEM,
        description: 'Neutral arbiter that manages the X+1 decision process',
        mcpServerId: 'xplus1-mcp-machine',
        autoStart: true,
        priority: 100, // Highest priority for managing decisions
        config: {
          maxActionsPerMinute: 5,
          allowedActions: ['question', 'validate', 'update_state', 'manage_turn'],
          personality: 'neutral',
          influence: 'balanced',
          keyQuestion: 'Did you consume today, do I reset?'
        }
      },
      {
        id: 'user-simulator',
        name: 'UserSimulator',
        role: AgentRole.PLAYER,
        description: 'Simulated user that decides yes/no and can choose next agent',
        autoStart: true,
        priority: 90,
        config: {
          personality: 'balanced',
          allowedActions: ['choose', 'interact']
        }
      }
    ]
  };

  return config;
}

/**
 * Agent behavior templates for the chat provider
 */
const PROMPTS = loadAgentPrompts();
export const AGENT_PROMPTS = {
  dionisio: {
    systemPrompt: PROMPTS.dionisio.systemPrompt,
    maxTokens: PROMPTS.dionisio.maxTokens,
    temperature: PROMPTS.dionisio.temperature
  },
  apolo: {
    systemPrompt: PROMPTS.apolo.systemPrompt,
    maxTokens: PROMPTS.apolo.maxTokens,
    temperature: PROMPTS.apolo.temperature
  },
  justice: {
    systemPrompt: PROMPTS.justice.systemPrompt.replace('{maxMessages}', String(GAME_CONFIG.MAX_MESSAGES_THREAD)),
    maxTokens: PROMPTS.justice.maxTokens,
    temperature: PROMPTS.justice.temperature
  }
} as const;

/**
 * Message templates for different game phases
 */
const GAME_MSG = loadGameMessages();
export const MESSAGE_TEMPLATES = {
  gameStart: GAME_MSG.game.start,
  turnStart: (x: number, messageCount: number) =>
    GAME_MSG.game.turnStart
      .replace('{x}', String(x))
      .replace('{remaining}', String(GAME_CONFIG.MAX_MESSAGES_THREAD - messageCount)),
  questionTime: (x: number) =>
    GAME_MSG.game.questionTime.replace('{x}', String(x)),
  advancement: (oldX: number, newX: number, advance: number) =>
    (advance > 0
      ? GAME_MSG.game.advancementPositive
      : GAME_MSG.game.advancementNegative)
      .replace('{oldX}', String(oldX))
      .replace('{newX}', String(newX)),
  gameEnd: (finalX: number, totalTurns: number) =>
    GAME_MSG.game.end
      .replace('{finalX}', String(finalX))
      .replace('{turns}', String(totalTurns))
} as const;

export type AgentType = 'dionisio' | 'apolo' | 'justice';
export type GamePhase = 'start' | 'conversation' | 'decision' | 'advancement' | 'end';
