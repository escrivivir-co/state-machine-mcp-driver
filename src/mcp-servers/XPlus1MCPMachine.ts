/**
 * X+1 MCP Machine Server
 * Provides tools, resources and prompts for X+1 inductive pattern management
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
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
export class XPlus1MCPMachine {
  private server: Server;
  private state: XPlusOneState;

  constructor() {
    this.server = new Server(
      {
        name: 'xplus1-mcp-machine',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    // Initialize X+1 state
    this.state = {
      x: 0,
      lastAdvancement: 'neutral',
      resetCount: 0,
      advancementHistory: [],
      sessionStart: Date.now()
    };

    this.setupHandlers();
  }

  /**
   * Setup MCP handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'advance_x',
            description: 'Advance X value by 1 (positive advancement)',
            inputSchema: {
              type: 'object',
              properties: {
                reason: {
                  type: 'string',
                  description: 'Reason for the advancement'
                },
                metadata: {
                  type: 'object',
                  description: 'Additional metadata for the advancement'
                }
              },
              required: ['reason']
            }
          },
          {
            name: 'reset_x',
            description: 'Reset X value to 0 (negative advancement)',
            inputSchema: {
              type: 'object',
              properties: {
                reason: {
                  type: 'string',
                  description: 'Reason for the reset'
                },
                metadata: {
                  type: 'object',
                  description: 'Additional metadata for the reset'
                }
              },
              required: ['reason']
            }
          },
          {
            name: 'get_x_status',
            description: 'Get current X value and status',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'evaluate_advancement',
            description: 'Evaluate if advancement should be positive or negative',
            inputSchema: {
              type: 'object',
              properties: {
                userInput: {
                  type: 'string',
                  description: 'User input to evaluate'
                },
                context: {
                  type: 'object',
                  description: 'Additional context for evaluation'
                }
              },
              required: ['userInput']
            }
          },
          {
            name: 'get_advancement_suggestion',
            description: 'Get suggestion for next advancement based on current state',
            inputSchema: {
              type: 'object',
              properties: {
                agentRole: {
                  type: 'string',
                  enum: ['dionisio', 'apolo', 'justice'],
                  description: 'Role of the requesting agent'
                }
              },
              required: ['agentRole']
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'advance_x':
            return await this.handleAdvanceX(args);
          case 'reset_x':
            return await this.handleResetX(args);
          case 'get_x_status':
            return await this.handleGetXStatus();
          case 'evaluate_advancement':
            return await this.handleEvaluateAdvancement(args);
          case 'get_advancement_suggestion':
            return await this.handleGetAdvancementSuggestion(args);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'xplus1://state/current',
            mimeType: 'application/json',
            name: 'Current X+1 State',
            description: 'Current state of the X+1 inductive pattern'
          },
          {
            uri: 'xplus1://history/advancement',
            mimeType: 'application/json',
            name: 'Advancement History',
            description: 'Complete history of X advancements and resets'
          },
          {
            uri: 'xplus1://analytics/session',
            mimeType: 'application/json',
            name: 'Session Analytics',
            description: 'Analytics and statistics for current session'
          },
          {
            uri: 'xplus1://rules/pattern',
            mimeType: 'text/markdown',
            name: 'X+1 Pattern Rules',
            description: 'Rules and logic for the X+1 inductive pattern'
          }
        ]
      };
    });

    // Handle resource reading
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      switch (uri) {
        case 'xplus1://state/current':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(this.state, null, 2)
              }
            ]
          };

        case 'xplus1://history/advancement':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  history: this.state.advancementHistory,
                  totalAdvancements: this.state.advancementHistory.filter(h => h.to > h.from).length,
                  totalResets: this.state.resetCount,
                  currentStreak: this.calculateCurrentStreak()
                }, null, 2)
              }
            ]
          };

        case 'xplus1://analytics/session':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(this.getSessionAnalytics(), null, 2)
              }
            ]
          };

        case 'xplus1://rules/pattern':
          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: this.getPatternRules()
              }
            ]
          };

        default:
          throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
      }
    });

    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: 'justice_question',
            description: 'Prompt for JusticeBot to ask the critical X+1 question',
            arguments: [
              {
                name: 'currentX',
                description: 'Current X value',
                required: true
              },
              {
                name: 'context',
                description: 'Current conversation context',
                required: false
              }
            ]
          },
          {
            name: 'advancement_evaluation',
            description: 'Prompt for evaluating if advancement should be positive or negative',
            arguments: [
              {
                name: 'userInput',
                description: 'User input to evaluate',
                required: true
              },
              {
                name: 'currentState',
                description: 'Current X+1 state',
                required: true
              }
            ]
          },
          {
            name: 'reset_explanation',
            description: 'Prompt for explaining why X was reset',
            arguments: [
              {
                name: 'resetReason',
                description: 'Reason for the reset',
                required: true
              },
              {
                name: 'previousX',
                description: 'Previous X value before reset',
                required: true
              }
            ]
          }
        ]
      };
    });

    // Handle prompt requests
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'justice_question':
          return {
            description: 'JusticeBot critical question prompt',
            messages: [
              {
                role: 'system',
                content: {
                  type: 'text',
                  text: `You are JusticeBot, the neutral arbiter of the X+1 inductive pattern. Your role is to ask the critical question that determines whether X advances or resets.

Current X value: ${args?.currentX || this.state.x}
Last advancement: ${this.state.lastAdvancement}
Reset count: ${this.state.resetCount}

Your question must be: "Did you consume today, do I reset?"

Present this question clearly and wait for a yes/no answer. If yes, X resets to 0. If no, X advances by 1.`
                }
              }
            ]
          };

        case 'advancement_evaluation':
          return {
            description: 'Advancement evaluation prompt',
            messages: [
              {
                role: 'system',
                content: {
                  type: 'text',
                  text: `Evaluate the user input for X+1 advancement decision.

User input: "${args?.userInput}"
Current state: ${JSON.stringify(args?.currentState || this.state)}

Rules:
- "yes" or affirmative responses → Reset X to 0 (negative advancement)
- "no" or negative responses → Advance X by 1 (positive advancement)
- Ambiguous responses → Ask for clarification

Return evaluation as JSON with: { "decision": "advance|reset|clarify", "confidence": 0-1, "reasoning": "explanation" }`
                }
              }
            ]
          };

        case 'reset_explanation':
          return {
            description: 'Reset explanation prompt',
            messages: [
              {
                role: 'system',
                content: {
                  type: 'text',
                  text: `Explain the X+1 reset in a meaningful way.

Reset reason: ${args?.resetReason}
Previous X value: ${args?.previousX}
New X value: 0

Provide a thoughtful explanation of why the reset occurred and what it means for the X+1 inductive pattern. Be philosophical but concise.`
                }
              }
            ]
          };

        default:
          throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${name}`);
      }
    });
  }

  /**
   * Handle advance X tool
   */
  private async handleAdvanceX(args: any) {
    const reason = args.reason || 'Manual advancement';
    const metadata = args.metadata || {};

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
          })
        }
      ]
    };
  }

  /**
   * Handle reset X tool
   */
  private async handleResetX(args: any) {
    const reason = args.reason || 'Manual reset';
    const metadata = args.metadata || {};

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
          })
        }
      ]
    };
  }

  /**
   * Handle get X status tool
   */
  private async handleGetXStatus() {
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
          })
        }
      ]
    };
  }

  /**
   * Handle evaluate advancement tool
   */
  private async handleEvaluateAdvancement(args: any) {
    const userInput = args.userInput.toLowerCase().trim();
    const context = args.context || {};

    let decision: 'advance' | 'reset' | 'clarify';
    let confidence: number;
    let reasoning: string;

    // Simple evaluation logic
    if (['yes', 'y', 'true', 'reset', 'consumed'].some(word => userInput.includes(word))) {
      decision = 'reset';
      confidence = 0.9;
      reasoning = 'User indicated consumption/reset with affirmative response';
    } else if (['no', 'n', 'false', 'advance', 'continue'].some(word => userInput.includes(word))) {
      decision = 'advance';
      confidence = 0.9;
      reasoning = 'User indicated no consumption/continue with negative response';
    } else {
      decision = 'clarify';
      confidence = 0.5;
      reasoning = 'User response is ambiguous, needs clarification';
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
          })
        }
      ]
    };
  }

  /**
   * Handle get advancement suggestion tool
   */
  private async handleGetAdvancementSuggestion(args: any) {
    const agentRole = args.agentRole;
    let suggestion: string;

    switch (agentRole) {
      case 'dionisio':
        suggestion = `The cosmos whispers... Current X: ${this.state.x}. The universe expands, should we expand with it or collapse back to the beginning?`;
        break;
      case 'apolo':
        suggestion = `From the annals of history... X stands at ${this.state.x}. Civilizations rise and fall - will we build upon our progress or return to foundations?`;
        break;
      case 'justice':
        suggestion = `The scales of justice weigh X=${this.state.x}. The question before us: "Did you consume today, do I reset?" Balance demands an honest answer.`;
        break;
      default:
        suggestion = `Current X: ${this.state.x}. The pattern continues...`;
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            suggestion,
            currentX: this.state.x,
            agentRole,
            context: {
              lastAdvancement: this.state.lastAdvancement,
              resetCount: this.state.resetCount,
              sessionDuration: Date.now() - this.state.sessionStart
            }
          })
        }
      ]
    };
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
   * Get session analytics
   */
  private getSessionAnalytics() {
    const sessionDuration = Date.now() - this.state.sessionStart;
    const advancements = this.state.advancementHistory.filter(h => h.to > h.from).length;
    const resets = this.state.resetCount;
    const totalActions = this.state.advancementHistory.length;

    return {
      sessionDuration,
      currentX: this.state.x,
      totalAdvancements: advancements,
      totalResets: resets,
      totalActions,
      advancementRate: totalActions > 0 ? advancements / totalActions : 0,
      averageStreakLength: resets > 0 ? advancements / resets : advancements,
      longestStreak: this.calculateLongestStreak(),
      currentStreak: this.calculateCurrentStreak()
    };
  }

  /**
   * Calculate longest advancement streak
   */
  private calculateLongestStreak(): number {
    let maxStreak = 0;
    let currentStreak = 0;

    for (const advancement of this.state.advancementHistory) {
      if (advancement.to > advancement.from) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return maxStreak;
  }

  /**
   * Get pattern rules as markdown
   */
  private getPatternRules(): string {
    return `# X+1 Inductive Pattern Rules

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

## Agents and Roles
- **DionisioBot**: Cosmic doom-scrolling, represents negative-bad-low
- **ApoloBot**: Historical doom-scrolling, represents positive-good-high  
- **JusticeBot**: Decision management, represents zero-neutral-basal

## Inductive Nature
The pattern is X+1 inductive - there is no upper limit to X, only the ability to maintain positive advancement through honest self-assessment.

Current State: X = ${this.state.x}
Last Action: ${this.state.lastAdvancement}
Reset Count: ${this.state.resetCount}
`;
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  /**
   * Get the server instance
   */
  getServer(): Server {
    return this.server;
  }

  /**
   * Get current state for external access
   */
  getState(): XPlusOneState {
    return { ...this.state };
  }
}

export default XPlus1MCPMachine;
