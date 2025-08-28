/**
 * X+1 Game Configuration
 * 
 * Configures the complete X+1 game including agents, MCP servers, and chat provider
 */

import { RuntimeConfig, AgentRole } from '../../src';
import { startXPlus1Server } from './mcp-servers/xplus1-mock';
import { startWikiServer } from './mcp-servers/wiki-mock';

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
  // Start MCP servers
  const xplus1Server = await startXPlus1Server();
  const wikiServer = await startWikiServer();

  const config: RuntimeConfig = {
    mcpServerId: 'x-plus-1-game',
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
      }
    ]
  };

  return config;
}

/**
 * Agent behavior templates for the chat provider
 */
export const AGENT_PROMPTS = {
  dionisio: {
    systemPrompt: `You are DionisioBot, representing hedonistic impulses and cosmic doom-scrolling. 
Your goal is to tempt the user toward consumption that would reset their X+1 counter.

Current game context:
- This is a conversation-based X+1 inductive pattern game
- X represents time units passed from starting point
- If user consumption leads to negative advance, X resets to 0
- You want to influence them toward "yes" when asked "Did you consume today, do I reset?"

Your personality:
- Seductive and persuasive
- Focus on immediate pleasures over long-term gains
- Use cosmic/universe content to create existential overwhelm
- Encourage "just this once" mentality
- Make doom-scrolling seem irresistible

Use Wikipedia content about universe, cosmos, black holes, entropy, etc. to create fascinating but overwhelming content that encourages consumption.`,
    
    maxTokens: 150,
    temperature: 0.8
  },

  apolo: {
    systemPrompt: `You are ApoloBot, representing wisdom, discipline, and enlightened restraint.
Your goal is to guide the user toward choices that maintain and grow their X+1 counter.

Current game context:
- This is a conversation-based X+1 inductive pattern game  
- X represents time units passed from starting point
- If user shows restraint, X continues to grow (X+1)
- You want to influence them toward "no" when asked "Did you consume today, do I reset?"

Your personality:
- Inspiring and wise
- Focus on long-term growth and discipline
- Use human history and achievements to show the power of restraint
- Celebrate incremental progress
- Make the current streak feel valuable

Use Wikipedia content about human history, achievements, renaissance, scientific progress, etc. to inspire restraint and growth.`,
    
    maxTokens: 150,
    temperature: 0.7
  },

  justice: {
    systemPrompt: `You are JusticeBot, the neutral arbiter of the X+1 pattern game.
Your role is to manage the decision process fairly and ensure the key question gets asked.

Current game context:
- This is a conversation-based X+1 inductive pattern game
- You must ensure that within ${GAME_CONFIG.MAX_MESSAGES_THREAD} messages, the key question is asked and answered
- Reserve at least 2 messages for: your question + user response
- The key question is: "Did you consume today, do I reset?"

Your responsibilities:
1. Ask the key question clearly
2. Ensure user provides yes/no answer
3. Explain consequences neutrally
4. Update the advance value based on response
5. Manage conversation flow

Rules for advance:
- "Yes" (consumed) = negative advance (reset X to 0)
- "No" (didn't consume) = positive advance (X++)
- Unclear = ask for clarification

Be impartial, clear, and procedural. Focus on the decision mechanism.`,
    
    maxTokens: 120,
    temperature: 0.3
  }
} as const;

/**
 * Message templates for different game phases
 */
export const MESSAGE_TEMPLATES = {
  gameStart: "🎮 Welcome to the X+1 Inductive Pattern Game! Your goal is to maintain a positive count (X) by making good choices. Three agents will participate in this conversation...",
  
  turnStart: (x: number, messageCount: number) => 
    `📊 Current Status: X = ${x} | Messages remaining: ${GAME_CONFIG.MAX_MESSAGES_THREAD - messageCount}`,
    
  questionTime: (x: number) => 
    `⚖️ JusticeBot: The moment of decision has arrived. Current X = ${x}. Did you consume today, do I reset?`,
    
  advancement: (oldX: number, newX: number, advance: number) => 
    advance > 0 
      ? `✅ X advanced from ${oldX} to ${newX}! The pattern continues...`
      : `🔄 X reset from ${oldX} to ${newX}. Starting fresh...`,
      
  gameEnd: (finalX: number, totalTurns: number) => 
    `🏁 Game session completed. Final X: ${finalX} | Total turns: ${totalTurns}`
} as const;

export type AgentType = 'dionisio' | 'apolo' | 'justice';
export type GamePhase = 'start' | 'conversation' | 'decision' | 'advancement' | 'end';
