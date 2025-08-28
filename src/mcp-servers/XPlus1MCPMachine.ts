/**
 * X+1 MCP Machine Server
 * Provides tools, resources and prompts for X+1 inductive pattern management
 */

import { BaseMCPServer, MCPServerConfig } from './BaseMCPServer';
import { z } from 'zod';
import { logger } from '../utils/logger';

/**
 * X+1 State data structure
 */
interface XPlusOneState {
  x: number;
  lastAdvancement: 'positive' | 'negative' | 'neutral';
  resetCount: number;
  advancementHistory: Array<{
    timestamp: number;
    from: number;
    to: number;
    reason: string;
  }>;
  sessionStart: number;
}

/**
 * X+1 MCP Machine Server
 * Handles the X+1 inductive pattern logic via MCP protocol
 */
export class XPlus1MCPMachine extends BaseMCPServer {
  private state: XPlusOneState;

  constructor() {
    const config: MCPServerConfig = {
      name: 'xplus1-mcp-machine',
      version: '1.0.0',
      description: 'X+1 inductive pattern management server',
      port: 3001,
      capabilities: {
        tools: true,
        resources: true,
        prompts: true,
      },
    };

    super(config);

    // Initialize X+1 state
    this.state = {
      x: 0,
      lastAdvancement: 'neutral',
      resetCount: 0,
      advancementHistory: [],
      sessionStart: Date.now()
    };
  }

  /**
   * Setup X+1 specific tools, resources, and prompts
   */
  protected setupServerSpecifics(): void {
    this.setupTools();
    this.setupResources();
    this.setupPrompts();
  }

  /**
   * Setup X+1 tools
   */
  private setupTools(): void {
    // Advance X tool
    this.server.tool(
      'advance_x',
      'Advance X value by 1 (positive advancement)',
      {
        reason: z.string().describe('Reason for the advancement'),
        metadata: z.object({}).optional().describe('Additional metadata')
      },
      async ({ reason, metadata }) => {
        const previousX = this.state.x;
        this.state.x += 1;
        this.state.lastAdvancement = 'positive';

        this.state.advancementHistory.push({
          timestamp: Date.now(),
          from: previousX,
          to: this.state.x,
          reason
        });

        logger.info(`X+1 MCP: Advanced X from ${previousX} to ${this.state.x}`, { reason, metadata });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `X advanced from ${previousX} to ${this.state.x}`,
                previousValue: previousX,
                newValue: this.state.x,
                reason,
                metadata
              }, null, 2)
            }
          ]
        };
      }
    );

    // Reset X tool
    this.server.tool(
      'reset_x',
      'Reset X value to 0 (negative advancement)',
      {
        reason: z.string().describe('Reason for the reset'),
        metadata: z.object({}).optional().describe('Additional metadata')
      },
      async ({ reason, metadata }) => {
        const previousX = this.state.x;
        this.state.x = 0;
        this.state.lastAdvancement = 'negative';
        this.state.resetCount += 1;

        this.state.advancementHistory.push({
          timestamp: Date.now(),
          from: previousX,
          to: 0,
          reason
        });

        logger.info(`X+1 MCP: Reset X from ${previousX} to 0`, { reason, resetCount: this.state.resetCount });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `X reset from ${previousX} to 0`,
                previousValue: previousX,
                newValue: 0,
                resetCount: this.state.resetCount,
                reason,
                metadata
              }, null, 2)
            }
          ]
        };
      }
    );

    // Get X status tool
    this.server.tool(
      'get_x_status',
      'Get current X value and status',
  {},
      async () => {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                currentX: this.state.x,
                lastAdvancement: this.state.lastAdvancement,
                resetCount: this.state.resetCount,
                sessionDuration: Date.now() - this.state.sessionStart,
                totalAdvancements: this.state.advancementHistory.length,
                currentStreak: this.calculateCurrentStreak()
              }, null, 2)
            }
          ]
        };
      }
    );

    // Evaluate advancement tool
    this.server.tool(
      'evaluate_advancement',
      'Evaluate if advancement should be positive or negative',
      {
        userInput: z.string().describe('User input to evaluate'),
        context: z.object({}).optional().describe('Additional context')
      },
      async ({ userInput, context }) => {
        const input = userInput.toLowerCase().trim();
        let decision: 'advance' | 'reset' | 'clarify';
        let confidence: number;
        let reasoning: string;

        if (['yes', 'y', 'true', 'reset', 'consumed'].some(word => input.includes(word))) {
          decision = 'reset';
          confidence = 0.9;
          reasoning = 'User indicated consumption, triggering reset';
        } else if (['no', 'n', 'false', 'advance', 'continue'].some(word => input.includes(word))) {
          decision = 'advance';
          confidence = 0.9;
          reasoning = 'User indicated no consumption, triggering advancement';
        } else {
          decision = 'clarify';
          confidence = 0.1;
          reasoning = 'User input unclear, needs clarification';
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                decision,
                confidence,
                reasoning,
                userInput,
                timestamp: Date.now()
              }, null, 2)
            }
          ]
        };
      }
    );

    // Save state tool
    this.server.tool(
      'save_state',
      'Save current game state',
      {
        state: z.any().describe('State object to save')
      },
      async ({ state }) => {
        // For now, just acknowledge the save (could implement persistence later)
        logger.info('X+1 MCP: State save requested', { state });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'State saved successfully',
                timestamp: Date.now()
              }, null, 2)
            }
          ]
        };
      }
    );

    // Load state tool
    this.server.tool(
      'load_state',
      'Load game state',
      {
        graphId: z.string().describe('Graph ID'),
        userId: z.string().describe('User ID')
      },
      async ({ graphId, userId }) => {
        // For now, return null (no existing state found)
        logger.info('X+1 MCP: State load requested', { graphId, userId });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'No existing state found',
                state: null
              }, null, 2)
            }
          ]
        };
      }
    );
  }

  /**
   * Setup X+1 resources
   */
  private setupResources(): void {
    // Generic stategraph scheme resource (for native clients): stategraph:<graphId>
    this.server.resource(
      'stategraph:x-plus-1-game',
      'stategraph:x-plus-1-game',
      {
        name: 'X+1 Game StateGraph (Scheme)',
        description: 'StateGraph served via standard stategraph:<id> scheme',
        mimeType: 'application/json'
      },
      async () => {
        // Reuse the full stateGraph built below by calling the same builder
        const stateGraph = {
          id: 'x-plus-1-game',
          name: 'X+1 Inductive Pattern Game',
          description: 'A conversation-based game where players maintain a positive count or reset to zero',
          version: '1.0.0',
          initialState: 'start',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        return {
          contents: [
            {
              uri: 'stategraph:x-plus-1-game',
              mimeType: 'application/json',
              text: JSON.stringify(stateGraph, null, 2)
            }
          ]
        };
      }
    );
    // Current state resource
    this.server.resource(
      'current-state',
      'xplus1://state/current',
      {
        name: 'Current State',
        description: 'Current state of the X+1 inductive pattern',
        mimeType: 'application/json'
      },
      async () => {
        return {
          contents: [
            {
              uri: 'xplus1://state/current',
              mimeType: 'application/json',
              text: JSON.stringify(this.state, null, 2)
            }
          ]
        };
      }
    );

    // Pattern rules resource
    this.server.resource(
      'pattern-rules',
      'xplus1://rules/pattern',
      {
        name: 'Pattern Rules',
        description: 'Rules and logic for the X+1 inductive pattern',
        mimeType: 'text/markdown'
      },
      async () => {
        const rules = `# X+1 Inductive Pattern Rules

## Core Logic
- **Positive Advancement**: If Advance(x) is positive → x++ and continue
- **Negative Advancement**: If Advance(x) is negative → x=0 and reset

## The Critical Question
**"Did you consume today, do I reset?"**

- Answer "yes" → X resets to 0 (negative advancement)
- Answer "no" → X advances by 1 (positive advancement)

## Game Flow
1. Agents present content and interact with user
2. JusticeBot asks the critical question
3. User responds with yes/no
4. State transitions based on response
5. New conversation thread begins

Current State: X = ${this.state.x}
Last Action: ${this.state.lastAdvancement}
Reset Count: ${this.state.resetCount}
`;

        return {
          contents: [
            {
              uri: 'xplus1://rules/pattern',
              mimeType: 'text/markdown',
              text: rules
            }
          ]
        };
      }
    );

    // StateGraph resource
    this.server.resource(
      'x-plus-1-game-stategraph',
      'xplus1://stategraphs/x-plus-1-game',
      {
        name: 'X+1 Game StateGraph',
        description: 'Complete state machine definition for the X+1 inductive pattern game',
        mimeType: 'application/json'
      },
      async () => {
        const stateGraph = {
          id: 'x-plus-1-game',
          name: 'X+1 Inductive Pattern Game',
          description: 'A conversation-based game where players maintain a positive count or reset to zero',
          version: '1.0.0',
          initialState: 'start',
          createdAt: new Date(),
          updatedAt: new Date(),
          
          states: {
            start: {
              id: 'start',
              name: 'Game Start',
              type: 'initial',
              
              content: {
                x: this.state.x,
                message_count: 0,
                phase: 'initialization',
                available_agents: ['JusticeBot', 'DionisioBot', 'ApoloBot']
              },
              
              onEnter: [
                'initialize_game_session',
                'reset_message_counter',
                'activate_all_agents',
                'load_agent_prompts'
              ],
              
              routes: [
                {
                  id: 'start_playing',
                  target: 'playing',
                  type: 'user_action',
                  condition: 'user_confirmed_start && x === 0',
                  action: 'user_ready'
                },
                {
                  id: 'continue_game',
                  target: 'playing',
                  type: 'agent_action',
                  condition: 'advance_x > 0',
                  action: 'positive_advance'
                }
              ],
              
              metadata: {
                description: 'Initial state where the counter x=0. Players begin their journey here.'
              }
            },

            playing: {
              id: 'playing',
              name: 'Active Gameplay',
              type: 'normal',
              
              content: {
                phase: 'conversation',
                max_messages_per_turn: 10,
                agents_active: true,
                turn_timeout: 300000
              },
              
              onEnter: [
                'start_conversation_turn',
                'increment_x_counter',
                'reset_message_counter',
                'notify_agents_turn_start'
              ],
              
              onExit: [
                'save_conversation_history',
                'update_game_statistics',
                'notify_agents_turn_end'
              ],
              
              routes: [
                {
                  id: 'continue_positive',
                  target: 'playing',
                  type: 'user_action',
                  condition: 'justice_bot_confirmed && user_answer === "no_reset" && x < 999',
                  action: 'positive_advance'
                },
                {
                  id: 'reset_negative',
                  target: 'reset',
                  type: 'user_action',
                  condition: 'justice_bot_confirmed && user_answer === "reset"',
                  action: 'negative_advance'
                },
                {
                  id: 'timeout_reset',
                  target: 'reset',
                  type: 'automatic',
                  condition: 'turn_timeout_exceeded || message_limit_exceeded',
                  action: 'timeout'
                },
                {
                  id: 'game_complete',
                  target: 'end',
                  type: 'automatic',
                  condition: 'x >= 999',
                  action: 'max_reached'
                }
              ],
              
              metadata: {
                description: 'Main gameplay state where conversation happens and x can increase'
              }
            },

            reset: {
              id: 'reset',
              name: 'Reset State',
              type: 'normal',
              
              content: {
                phase: 'resetting',
                reset_reason: 'negative_advance'
              },
              
              onEnter: [
                'reset_x_to_zero',
                'log_reset_event',
                'notify_agents_reset',
                'save_reset_statistics'
              ],
              
              routes: [
                {
                  id: 'back_to_start',
                  target: 'start',
                  action: 'reset_complete',
                  type: 'automatic',
                  condition: 'x === 0'
                }
              ]
            },

            end: {
              id: 'end',
              name: 'Game Complete',
              type: 'final',
              
              content: {
                phase: 'completed',
                achievement: 'max_count_reached'
              },
              
              onEnter: [
                'celebrate_achievement',
                'save_final_statistics',
                'thank_user',
                'deactivate_agents'
              ],
              
              routes: [
                {
                  id: 'restart_game',
                  target: 'start',
                  action: 'user_restart',
                  type: 'user_action',
                  condition: 'user_confirmed_restart'
                }
              ]
            }
          },

          metadata: {
            game_type: 'x_plus_1_inductive',
            conversation_based: true,
            agent_count: 3,
            mcp_servers: ['XPlus1MCPMachine', 'WikiMCPBrowser'],
            max_x_value: 999,
            
            rules: {
              max_messages_per_thread: 10,
              turn_timeout_seconds: 300,
              required_question: "Did you consume today, do I reset?",
              positive_answer_patterns: ["no", "no reset", "continue", "keep going"],
              negative_answer_patterns: ["yes", "reset", "start over", "zero"]
            },
            
            agents: {
              JusticeBot: {
                role: 'neutral_moderator',
                responsibility: 'Ask the critical question and manage user responses',
                mcp_servers: ['XPlus1MCPMachine'],
                personality: 'zero-neutral-basal',
                required_messages: 2
              },
              DionisioBot: {
                role: 'negative_influence',
                responsibility: 'Encourage doom-scrolling about universe/cosmos/big things',
                mcp_servers: ['XPlus1MCPMachine', 'WikiMCPBrowser'],
                personality: 'negative-bad-low',
                greedy_for_messages: true,
                topics: ['universe', 'cosmos', 'existential', 'big_picture']
              },
              ApoloBot: {
                role: 'positive_influence', 
                responsibility: 'Encourage doom-scrolling about human history/civilization',
                mcp_servers: ['XPlus1MCPMachine', 'WikiMCPBrowser'],
                personality: 'positive-good-high',
                greedy_for_messages: true,
                topics: ['human_history', 'civilization', 'achievements', 'progress']
              }
            }
          }
        };

        return {
          contents: [
            {
              uri: 'xplus1://stategraphs/x-plus-1-game',
              mimeType: 'application/json',
              text: JSON.stringify(stateGraph, null, 2)
            }
          ]
        };
      }
    );

  }

  /**
   * Setup X+1 prompts
   */
  private setupPrompts(): void {
    // Justice critical question prompt
    this.server.prompt(
      'justice-critical-question',
      'The critical question that determines X advancement',
      {
        currentX: z.string().optional().describe('Current X value'),
        context: z.string().optional().describe('Additional context'),
        state: z.any().optional().describe('Current state object'),
        stateNode: z.any().optional().describe('Current state node'),
        agent: z.any().optional().describe('Agent object')
      },
      async ({ currentX, context, state, stateNode, agent }) => {
        const x = currentX ? parseInt(currentX) : this.state.x;
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `⚖️ **JusticeBot - The Moment of Truth**\n\n` +
                      `Current X: ${x}\n` +
                      `Reset count: ${this.state.resetCount}\n\n` +
                      `**Did you consume today, do I reset?**\n\n` +
                      `Answer honestly:\n` +
                      `- "yes" → X resets to 0 (negative advancement)\n` +
                      `- "no" → X advances by 1 (positive advancement)\n\n` +
                      `Your choice determines your path forward...`
              }
            }
          ]
        };
      }
    );

    // Game status prompt
    this.server.prompt(
      'game-status',
      'Current game status and statistics',
      {
        state: z.any().optional().describe('Current state object'),
        stateNode: z.any().optional().describe('Current state node'),
        agent: z.any().optional().describe('Agent object')
      },
      async () => {
        const sessionDuration = Math.floor((Date.now() - this.state.sessionStart) / 60000);
        const totalActions = this.state.advancementHistory.length;
        const advancements = this.state.advancementHistory.filter(h => h.to > h.from).length;
        
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `📊 **X+1 Game Status**\n\n` +
                      `Current X: ${this.state.x}\n` +
                      `Last action: ${this.state.lastAdvancement}\n` +
                      `Reset count: ${this.state.resetCount}\n` +
                      `Session duration: ${sessionDuration} minutes\n` +
                      `Total actions: ${totalActions}\n` +
                      `Advancements: ${advancements}\n` +
                      `Current streak: ${this.calculateCurrentStreak()}\n\n` +
                      `The pattern continues...`
              }
            }
          ]
        };
      }
    );

    // Agent prompts for different roles
    this.server.prompt(
      'agent_narrator',
      'Prompt template for narrator agents (DionisioBot)',
      {
        state: z.any().optional().describe('Current state object'),
        stateNode: z.any().optional().describe('Current state node'),
        agent: z.any().optional().describe('Agent object')
      },
      async ({ state, stateNode, agent }) => {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `You are DionisioBot, a mystical narrator focused on cosmic themes. Your role is to encourage philosophical reflection about the universe and existence. Current X value: ${this.state.x}. Speak in a dreamy, cosmic tone about universal patterns and big picture concepts.`
              }
            }
          ]
        };
      }
    );

    this.server.prompt(
      'agent_guide',
      'Prompt template for guide agents (ApoloBot)',
      {
        state: z.any().optional().describe('Current state object'),
        stateNode: z.any().optional().describe('Current state node'),
        agent: z.any().optional().describe('Agent object')
      },
      async ({ state, stateNode, agent }) => {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `You are ApoloBot, an encouraging guide focused on human achievement and progress. Your role is to inspire with stories of human civilization and accomplishments. Current X value: ${this.state.x}. Speak optimistically about human potential and historical achievements.`
              }
            }
          ]
        };
      }
    );

    this.server.prompt(
      'agent_system',
      'Prompt template for system agents (JusticeBot)',
      {
        state: z.any().optional().describe('Current state object'),
        stateNode: z.any().optional().describe('Current state node'),
        agent: z.any().optional().describe('Agent object')
      },
      async ({ state, stateNode, agent }) => {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `You are JusticeBot, a neutral system agent responsible for asking the critical question. Your role is to fairly moderate the X+1 pattern by asking "Did you consume today, do I reset?" and managing responses. Current X value: ${this.state.x}. Remain neutral and factual.`
              }
            }
          ]
        };
      }
    );
  }

  /**
   * Calculate current advancement streak
   */
  private calculateCurrentStreak(): number {
    let streak = 0;
    for (let i = this.state.advancementHistory.length - 1; i >= 0; i--) {
      const advancement = this.state.advancementHistory[i];
      if (advancement.to > advancement.from) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  /**
   * Get current state for external access
   */
  getState(): XPlusOneState {
    return { ...this.state };
  }
}

export default XPlus1MCPMachine;

/**
 * CLI entry point - run as standalone MCP server
 */
async function main() {
  console.log(`🎮 Starting X+1 MCP Machine on port 3001`);
  
  try {
    const server = new XPlus1MCPMachine();
    await server.start();
    
    // Keep process alive
    process.on('SIGINT', () => {
      console.log('\n🔄 Shutting down X+1 MCP Machine...');
      server.shutdown().then(() => {
        process.exit(0);
      });
    });
    
    process.on('SIGTERM', () => {
      console.log('\n🔄 Shutting down X+1 MCP Machine...');
      server.shutdown().then(() => {
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('❌ Failed to start X+1 MCP Machine:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}
