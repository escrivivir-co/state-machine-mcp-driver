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
let PROMPTS: any;
try {
  PROMPTS = loadAgentPrompts();
} catch (error) {
  console.warn('⚠️ Could not load agent prompts, using defaults');
  PROMPTS = {
    dionisio: { systemPrompt: 'You are DionisioBot', maxTokens: 150, temperature: 0.8 },
    apolo: { systemPrompt: 'You are ApoloBot', maxTokens: 150, temperature: 0.7 },
    justice: { systemPrompt: 'You are JusticeBot', maxTokens: 100, temperature: 0.3 }
  };
}

export const AGENT_PROMPTS = {
  dionisio: {
    systemPrompt: PROMPTS.dionisio?.systemPrompt || 'You are DionisioBot',
    maxTokens: PROMPTS.dionisio?.maxTokens || 150,
    temperature: PROMPTS.dionisio?.temperature || 0.8
  },
  apolo: {
    systemPrompt: PROMPTS.apolo?.systemPrompt || 'You are ApoloBot',
    maxTokens: PROMPTS.apolo?.maxTokens || 150,
    temperature: PROMPTS.apolo?.temperature || 0.7
  },
  justice: {
    systemPrompt: (PROMPTS.justice?.systemPrompt || 'You are JusticeBot').replace('{maxMessages}', String(GAME_CONFIG.MAX_MESSAGES_THREAD)),
    maxTokens: PROMPTS.justice?.maxTokens || 100,
    temperature: PROMPTS.justice?.temperature || 0.3
  }
} as const;

/**
 * Message templates for different game phases
 */
let GAME_MSG: any;
try {
  GAME_MSG = loadGameMessages();
} catch (error) {
  console.warn('⚠️ Could not load game messages, using defaults');
  GAME_MSG = {
    game: {
      start: 'Game started!',
      turnStart: 'Turn {x} - {remaining} messages remaining',
      questionTime: 'Time for the critical question at X={x}',
      advancementPositive: 'X advanced from {oldX} to {newX}!',
      advancementNegative: 'X reset from {oldX} to {newX}',
      end: 'Game ended at X={finalX} after {turns} turns'
    }
  };
}

export const MESSAGE_TEMPLATES = {
  gameStart: GAME_MSG.game?.start || 'Game started!',
  turnStart: (x: number, messageCount: number) =>
    (GAME_MSG.game?.turnStart || 'Turn {x} - {remaining} messages remaining')
      .replace('{x}', String(x))
      .replace('{remaining}', String(GAME_CONFIG.MAX_MESSAGES_THREAD - messageCount)),
  questionTime: (x: number) =>
    (GAME_MSG.game?.questionTime || 'Time for the critical question at X={x}').replace('{x}', String(x)),
  advancement: (oldX: number, newX: number, advance: number) =>
    (advance > 0
      ? (GAME_MSG.game?.advancementPositive || 'X advanced from {oldX} to {newX}!')
      : (GAME_MSG.game?.advancementNegative || 'X reset from {oldX} to {newX}'))
      .replace('{oldX}', String(oldX))
      .replace('{newX}', String(newX)),
  gameEnd: (finalX: number, totalTurns: number) =>
    (GAME_MSG.game?.end || 'Game ended at X={finalX} after {turns} turns')
      .replace('{finalX}', String(finalX))
      .replace('{turns}', String(totalTurns))
} as const;

export type AgentType = 'dionisio' | 'apolo' | 'justice';
export type GamePhase = 'start' | 'conversation' | 'decision' | 'advancement' | 'end';
