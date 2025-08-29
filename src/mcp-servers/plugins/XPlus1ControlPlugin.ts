/**
 * XPlus1 Control Plugin for DevOps Server
 * Provides remote control capabilities for the X+1 MCP Machine and UserSimulator
 */

import { z } from 'zod';
import { BaseDevOpsPlugin, IDevOpsPlugin, PluginConfig, PluginMetadata, PluginContext, PluginResult } from './IDevOpsPlugin.js';
import { MCPDriverAdapter } from '../../drivers/MCPDriverAdapter.js';

/**
 * UserSimulator personality types
 */
export type UserSimulatorPersonality = 'cautious' | 'balanced' | 'risk_taker' | 'passive';

/**
 * User decision types
 */
export type UserDecision = 'yes' | 'no' | 'clarify';

/**
 * Simulator context interface
 */
export interface SimulatorContext {
  x: number;
  turnHistory: Array<{ advance: number; x: number; timestamp: number }>;
  lastMessage?: string;
  needsExplanation?: boolean;
  emotionalState?: 'ok' | 'needs_support';
  personality?: string;
  messageCount?: number;
  maxMessages?: number;
  availableAgents?: string[];
}

/**
 * XPlus1 Control Plugin
 * Enables DevOps server to control UserSimulator and X+1 game state
 */
export class XPlus1ControlPlugin extends BaseDevOpsPlugin implements IDevOpsPlugin {
  private mcpAdapter?: MCPDriverAdapter;
  private simulatorStats = {
    personalityChanges: 0,
    decisionsSimulated: 0,
    agentsSelected: 0,
    lastSimulatorActivity: 0
  };

  constructor() {
    const config: PluginConfig = {
      id: 'xplus1-control',
      name: 'X+1 Control Plugin',
      description: 'Remote control for X+1 MCP Machine and UserSimulator',
      version: '1.0.0',
      category: 'game-control',
      enabled: true,
      settings: {
        defaultPersonality: 'balanced',
        autoSimulatorMode: false,
        enableRemoteControl: true,
        simulatorTimeout: 30000
      }
    };

    const metadata: PluginMetadata = {
      tools: [
        {
          name: 'set_user_personality',
          description: 'Change UserSimulator personality and behavior',
          schema: z.object({
            personality: z.enum(['cautious', 'balanced', 'risk_taker', 'passive']),
            reason: z.string().optional()
          })
        },
        {
          name: 'simulate_user_decision',
          description: 'Simulate user consumption decision (yes/no)',
          schema: z.object({
            forceDecision: z.enum(['yes', 'no', 'clarify', 'auto']).optional(),
            context: z.object({
              currentX: z.number().optional(),
              messageCount: z.number().optional(),
              recentReset: z.boolean().optional()
            }).optional()
          })
        },
        {
          name: 'simulate_agent_selection',
          description: 'Select specific agent for next message',
          schema: z.object({
            agentId: z.string(),
            reasoning: z.string().optional()
          })
        },
        {
          name: 'control_simulator_mode',
          description: 'Enable/disable automatic UserSimulator mode',
          schema: z.object({
            mode: z.enum(['on', 'off', 'toggle']),
            duration: z.number().optional()
          })
        },
        {
          name: 'get_simulator_status',
          description: 'Get current UserSimulator status and statistics',
          schema: z.object({
            includeHistory: z.boolean().optional()
          })
        },
        {
          name: 'analyze_game_context',
          description: 'Analyze current game state for intelligent decisions',
          schema: z.object({
            includeRecommendations: z.boolean().optional()
          })
        }
      ],
      resources: [
        {
          id: 'simulator-status',
          name: 'UserSimulator Status',
          description: 'Current status and configuration of UserSimulator',
          mimeType: 'application/json'
        },
        {
          id: 'game-context-analysis',
          name: 'Game Context Analysis',
          description: 'Analysis of current game state and recommended actions',
          mimeType: 'application/json'
        },
        {
          id: 'simulator-history',
          name: 'Simulator Activity History',
          description: 'History of UserSimulator actions and decisions',
          mimeType: 'application/json'
        }
      ],
      prompts: [
        {
          id: 'simulator-control',
          name: 'UserSimulator Control Guide',
          description: 'Guide for controlling UserSimulator via MCP tools',
          parameters: {
            currentContext: z.object({}).optional()
          }
        },
        {
          id: 'decision-strategy',
          name: 'Decision Strategy Helper',
          description: 'Strategic guidance for consumption decisions',
          parameters: {
            gameState: z.object({}).optional(),
            personality: z.string().optional()
          }
        }
      ]
    };

    super(config, metadata);
  }

  /**
   * Initialize the XPlus1 Control Plugin
   */
  async initialize(context: PluginContext): Promise<void> {
    await super.initialize(context);
    
    this.mcpAdapter = context.mcpAdapter;
    if (!this.mcpAdapter) {
      this.log('warn', 'No MCP adapter available - plugin functionality will be limited');
    }

    this.log('info', 'XPlus1 Control Plugin initialized');
  }

  /**
   * Setup MCP handlers for X+1 control tools
   */
  async setupMCPHandlers(context: PluginContext): Promise<void> {
    const { server } = context;

    // === SIMULATOR CONTROL TOOLS ===

    // Set UserSimulator personality
    server.tool(
      'set_user_personality',
      'Change UserSimulator personality and behavior',
      {
        personality: z.enum(['cautious', 'balanced', 'risk_taker', 'passive']).describe('UserSimulator personality'),
        reason: z.string().optional().describe('Reason for personality change')
      },
      async ({ personality, reason }: { personality: UserSimulatorPersonality; reason?: string }) => {
        this.updateActivity();
        this.simulatorStats.personalityChanges++;

        try {
          const mcpAdapter = this.requireMCPAdapter();

          // Send personality change command to X+1 machine
          const result = await mcpAdapter.executeTool(
            'xplus1-mcp-machine',
            'send_user_input',
            {
              text: `!set-personality ${personality}`,
              context: { 
                isSystemCommand: true, 
                reason,
                source: 'devops-xplus1-plugin'
              }
            }
          );

          this.log('info', `UserSimulator personality changed to ${personality}`, { reason });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `UserSimulator personality set to ${personality}`,
                personality,
                reason,
                timestamp: Date.now(),
                result: result
              }, null, 2)
            }]
          };

        } catch (error) {
          this.log('error', 'Failed to set user personality', { error, personality });
          throw error;
        }
      }
    );

    // Simulate user decision
    server.tool(
      'simulate_user_decision',
      'Simulate user consumption decision intelligently',
      {
        forceDecision: z.enum(['yes', 'no', 'clarify', 'auto']).optional().describe('Force specific decision or use auto'),
        context: z.object({
          currentX: z.number().optional(),
          messageCount: z.number().optional(),
          recentReset: z.boolean().optional()
        }).optional().describe('Game context for decision')
      },
      async ({ forceDecision, context: gameContext }: { 
        forceDecision?: 'yes' | 'no' | 'clarify' | 'auto'; 
        context?: { currentX?: number; messageCount?: number; recentReset?: boolean } 
      }) => {
        this.updateActivity();
        this.simulatorStats.decisionsSimulated++;

        try {
          const mcpAdapter = this.requireMCPAdapter();

          if (forceDecision && forceDecision !== 'auto') {
            // Force specific decision
            const result = await mcpAdapter.executeTool(
              'xplus1-mcp-machine',
              'answer_critical_question',
              {
                answer: forceDecision === 'yes' ? 'yes' : 'no',
                reasoning: `DevOps controlled decision: ${forceDecision} (via XPlus1 Control Plugin)`
              }
            );

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  decision: forceDecision,
                  forced: true,
                  context: gameContext,
                  result
                }, null, 2)
              }]
            };
          }

          // Enable simulator for automatic decision
          const result = await mcpAdapter.executeTool(
            'xplus1-mcp-machine',
            'toggle_simulator_mode',
            { mode: 'on' }
          );

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'UserSimulator activated for automatic decision',
                simulatorMode: 'on',
                context: gameContext,
                result
              }, null, 2)
            }]
          };

        } catch (error) {
          this.log('error', 'Failed to simulate user decision', { error });
          throw error;
        }
      }
    );

    // Simulate agent selection
    server.tool(
      'simulate_agent_selection',
      'Select specific agent for next message',
      {
        agentId: z.string().describe('ID of agent to select'),
        reasoning: z.string().optional().describe('Reasoning for selection')
      },
      async ({ agentId, reasoning }: { agentId: string; reasoning?: string }) => {
        this.updateActivity();
        this.simulatorStats.agentsSelected++;

        try {
          const mcpAdapter = this.requireMCPAdapter();

          const result = await mcpAdapter.executeTool(
            'xplus1-mcp-machine',
            'select_agent',
            { 
              agentId, 
              reason: reasoning || `DevOps controlled selection via XPlus1 Control Plugin`
            }
          );

          this.log('info', `Agent ${agentId} selected via DevOps control`, { reasoning });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                agentSelected: agentId,
                reasoning,
                timestamp: Date.now(),
                result
              }, null, 2)
            }]
          };

        } catch (error) {
          this.log('error', 'Failed to select agent', { error, agentId });
          throw error;
        }
      }
    );

    // Control simulator mode
    server.tool(
      'control_simulator_mode',
      'Enable/disable automatic UserSimulator mode',
      {
        mode: z.enum(['on', 'off', 'toggle']).describe('Simulator mode control'),
        duration: z.number().optional().describe('Duration in milliseconds for temporary mode')
      },
      async ({ mode, duration }: { mode: 'on' | 'off' | 'toggle'; duration?: number }) => {
        this.updateActivity();

        try {
          const mcpAdapter = this.requireMCPAdapter();

          const result = await mcpAdapter.executeTool(
            'xplus1-mcp-machine',
            'toggle_simulator_mode',
            { mode }
          );

          // Handle temporary mode with timeout
          if (duration && mode === 'on') {
            setTimeout(async () => {
              try {
                await mcpAdapter.executeTool(
                  'xplus1-mcp-machine',
                  'toggle_simulator_mode',
                  { mode: 'off' }
                );
                this.log('info', `Simulator mode automatically disabled after ${duration}ms`);
              } catch (error) {
                this.log('error', 'Failed to disable simulator after timeout', { error });
              }
            }, duration);
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                simulatorMode: mode,
                duration,
                message: `Simulator mode ${mode}${duration ? ` for ${duration}ms` : ''}`,
                result
              }, null, 2)
            }]
          };

        } catch (error) {
          this.log('error', 'Failed to control simulator mode', { error });
          throw error;
        }
      }
    );

    // Get simulator status
    server.tool(
      'get_simulator_status',
      'Get current UserSimulator status and statistics',
      {
        includeHistory: z.boolean().optional().describe('Include activity history')
      },
      async ({ includeHistory }: { includeHistory?: boolean }) => {
        this.updateActivity();

        try {
          const mcpAdapter = this.requireMCPAdapter();

          // Get current game state
          const gameState = await mcpAdapter.executeTool(
            'xplus1-mcp-machine',
            'get_full_game_state',
            {}
          );

          // Get UI status
          const uiStatus = await mcpAdapter.executeTool(
            'xplus1-mcp-machine',
            'get_ui_status',
            {}
          );

          const status = {
            timestamp: new Date().toISOString(),
            plugin: {
              name: this.config.name,
              version: this.config.version,
              statistics: {
                ...this.simulatorStats,
                lastActivity: this.lastActivity
              }
            },
            gameState: gameState?.content?.[0]?.text || 'Unknown',
            uiStatus: uiStatus?.content?.[0]?.text || 'Unknown',
            history: includeHistory ? this.getActivityHistory() : undefined
          };

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(status, null, 2)
            }]
          };

        } catch (error) {
          this.log('error', 'Failed to get simulator status', { error });
          throw error;
        }
      }
    );

    // Analyze game context
    server.tool(
      'analyze_game_context',
      'Analyze current game state for intelligent decisions',
      {
        includeRecommendations: z.boolean().optional().describe('Include strategic recommendations')
      },
      async ({ includeRecommendations }: { includeRecommendations?: boolean }) => {
        this.updateActivity();

        try {
          const mcpAdapter = this.requireMCPAdapter();

          // Get comprehensive game state
          const [xStatus, gameState, conversation, prompt] = await Promise.all([
            mcpAdapter.executeTool('xplus1-mcp-machine', 'get_x_status', {}),
            mcpAdapter.executeTool('xplus1-mcp-machine', 'get_full_game_state', {}),
            mcpAdapter.executeTool('xplus1-mcp-machine', 'get_current_conversation', {}),
            mcpAdapter.executeTool('xplus1-mcp-machine', 'get_current_prompt', {})
          ]);

          const analysis = this.analyzeGameContext(
            xStatus?.content?.[0]?.text,
            gameState?.content?.[0]?.text,
            conversation?.content?.[0]?.text,
            prompt?.content?.[0]?.text
          );

          if (includeRecommendations) {
            analysis.recommendations = this.generateRecommendations(analysis.context);
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(analysis, null, 2)
            }]
          };

        } catch (error) {
          this.log('error', 'Failed to analyze game context', { error });
          throw error;
        }
      }
    );

    // === RESOURCES ===

    // Simulator status resource
    server.resource(
      'simulator-status',
      'xplus1://simulator/status',
      {
        name: 'UserSimulator Status',
        description: 'Current UserSimulator status and configuration',
        mimeType: 'application/json'
      },
      async () => {
        try {
          const status = await this.getSimulatorStatus();
          return {
            contents: [{
              uri: 'xplus1://simulator/status',
              mimeType: 'application/json',
              text: JSON.stringify(status, null, 2)
            }]
          };
        } catch (error) {
          this.log('error', 'Failed to get simulator status resource', { error });
          throw error;
        }
      }
    );

    // === PROMPTS ===

    // Simulator control guide
    server.prompt(
      'simulator-control',
      'UserSimulator control guide with current context',
      {
        currentContext: z.string().optional().describe('Current game context as JSON string')
      },
      async (variables: { currentContext?: string }) => {
        let contextObj;
        try {
          contextObj = variables?.currentContext ? JSON.parse(variables.currentContext) : undefined;
        } catch {
          contextObj = undefined;
        }
        
        const guide = this.generateControlGuide(contextObj);
        
        return {
          messages: [{
            role: 'user',
            content: {
              type: 'text',
              text: guide
            }
          }]
        };
      }
    );

    this.log('info', 'XPlus1 Control Plugin MCP handlers setup complete');
  }

  /**
   * Plugin-specific execute commands
   */
  async execute(command: string, params: any): Promise<PluginResult> {
    this.updateActivity();

    switch (command) {
      case 'get_stats':
        return {
          success: true,
          data: this.getStatistics()
        };

      case 'reset_stats':
        this.simulatorStats = {
          personalityChanges: 0,
          decisionsSimulated: 0,
          agentsSelected: 0,
          lastSimulatorActivity: Date.now()
        };
        return {
          success: true,
          message: 'Statistics reset successfully'
        };

      default:
        return await super.execute(command, params);
    }
  }

  /**
   * Get enhanced plugin statistics
   */
  protected getStatistics(): Record<string, any> {
    return {
      ...super.getStatistics(),
      simulator: this.simulatorStats,
      capabilities: {
        personalityControl: true,
        decisionSimulation: true,
        agentSelection: true,
        contextAnalysis: true
      }
    };
  }

  // === PRIVATE HELPER METHODS ===

  private async getSimulatorStatus(): Promise<any> {
    if (!this.mcpAdapter) {
      return { error: 'MCP adapter not available' };
    }

    try {
      const [gameState, uiStatus] = await Promise.all([
        this.mcpAdapter.executeTool('xplus1-mcp-machine', 'get_full_game_state', {}),
        this.mcpAdapter.executeTool('xplus1-mcp-machine', 'get_ui_status', {})
      ]);

      return {
        timestamp: new Date().toISOString(),
        plugin: this.config.name,
        statistics: this.simulatorStats,
        gameState: this.parseResponse(gameState),
        uiStatus: this.parseResponse(uiStatus)
      };
    } catch (error) {
      this.log('error', 'Failed to get simulator status', { error });
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  private analyzeGameContext(xStatus: any, gameState: any, conversation: any, prompt: any): any {
    return {
      timestamp: new Date().toISOString(),
      context: {
        xStatus: this.parseResponse(xStatus),
        gameState: this.parseResponse(gameState),
        conversation: this.parseResponse(conversation),
        prompt: this.parseResponse(prompt)
      },
      analysis: {
        phase: this.detectGamePhase(prompt),
        urgency: this.calculateUrgency(xStatus, gameState),
        recommendedAction: 'analyze_options'
      }
    };
  }

  private generateRecommendations(context: any): any {
    return {
      personality: this.recommendPersonality(context),
      nextAction: this.recommendNextAction(context),
      strategy: this.recommendStrategy(context)
    };
  }

  private generateControlGuide(context?: any): string {
    return `# 🎮 UserSimulator Control Guide

## 🛠️ Available Tools

### 1. **set_user_personality**
Change UserSimulator behavior:
- \`cautious\`: Conservative decisions, low consumption probability
- \`balanced\`: Moderate risk-taking
- \`risk_taker\`: Aggressive, high consumption probability  
- \`passive\`: Minimal intervention

### 2. **simulate_user_decision**
Control consumption decisions:
- \`forceDecision: 'yes'\`: Force consumption (X resets to 0)
- \`forceDecision: 'no'\`: Force restraint (X advances +1)
- \`forceDecision: 'auto'\`: Let simulator decide based on personality

### 3. **simulate_agent_selection**
Choose which agent responds next:
- \`dionisio-bot\`: Hedonistic, cosmic temptation
- \`apolo-bot\`: Disciplined, historical wisdom
- \`justice-bot\`: Impartial, decision-focused

### 4. **control_simulator_mode**
Enable/disable automatic mode:
- \`mode: 'on'\`: Activate UserSimulator
- \`mode: 'off'\`: Disable automation
- \`duration\`: Temporary activation (milliseconds)

## 🎯 Strategic Usage

${context ? `**Current Context:** ${JSON.stringify(context, null, 2)}` : ''}

**Conservative Strategy:** Use \`cautious\` personality + manual decision control
**Aggressive Strategy:** Use \`risk_taker\` personality + auto mode  
**Balanced Strategy:** Use \`balanced\` personality with selective agent control

## 📊 Monitor with:
- \`get_simulator_status\`: Current state and statistics
- \`analyze_game_context\`: Game analysis and recommendations

---
*Plugin: ${this.config.name} v${this.config.version}*`;
  }

  private parseResponse(response: any): any {
    if (!response) return null;
    
    try {
      const text = response?.content?.[0]?.text;
      return text ? JSON.parse(text) : response;
    } catch {
      return response;
    }
  }

  private detectGamePhase(prompt: any): string {
    const promptText = this.parseResponse(prompt)?.promptText || '';
    
    if (promptText.includes('Did you consume')) return 'decision';
    if (promptText.includes('Choose agent')) return 'agent_selection';
    if (promptText.includes('available for automated')) return 'simulator_ready';
    
    return 'conversation';
  }

  private calculateUrgency(xStatus: any, gameState: any): 'low' | 'medium' | 'high' {
    try {
      const x = this.parseResponse(xStatus)?.currentX || 0;
      const messages = this.parseResponse(gameState)?.messageCount || 0;
      const maxMessages = this.parseResponse(gameState)?.maxMessages || 10;
      
      if (messages >= maxMessages - 2) return 'high';
      if (x >= 5) return 'medium';
      return 'low';
    } catch {
      return 'low';
    }
  }

  private recommendPersonality(context: any): UserSimulatorPersonality {
    try {
      const x = context?.xStatus?.currentX || 0;
      
      if (x >= 5) return 'cautious';  // High streak - be careful
      if (x <= 1) return 'risk_taker'; // Low value - can afford risk
      return 'balanced';
    } catch {
      return 'balanced';
    }
  }

  private recommendNextAction(context: any): string {
    const phase = this.detectGamePhase(context?.prompt);
    
    switch (phase) {
      case 'decision': return 'simulate_user_decision';
      case 'agent_selection': return 'simulate_agent_selection';
      case 'simulator_ready': return 'control_simulator_mode';
      default: return 'analyze_game_context';
    }
  }

  private recommendStrategy(context: any): string {
    try {
      const x = context?.xStatus?.currentX || 0;
      const urgency = this.calculateUrgency(context?.xStatus, context?.gameState);
      
      if (urgency === 'high') return 'conservative_finish';
      if (x >= 7) return 'maximum_caution';
      if (x <= 2) return 'controlled_risk';
      return 'balanced_approach';
    } catch {
      return 'balanced_approach';
    }
  }

  private getActivityHistory(): any[] {
    // Return simplified activity history
    return [
      {
        timestamp: this.lastActivity,
        type: 'status_check',
        statistics: this.simulatorStats
      }
    ];
  }
}
