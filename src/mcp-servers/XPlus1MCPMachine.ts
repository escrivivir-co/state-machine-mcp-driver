/**
 * X+1 MCP Machine Server
 * Provides tools, resources and prompts for X+1 inductive pattern management
 */

import { BaseMCPServer } from './BaseMCPServer';
import { BaseMCPServerConfig } from "./MCPServerConfig";
import { z } from 'zod';
import { Logger } from '../utils/logger';
import { DEFAULT_XPLUS1_MCP_SERVER_CONFIG } from "./DEFAULT_XPLUS1_MCP_SERVER_CONFIG";
import { DEFAULT_STATE_MACHINE_MCP_SERVER_CONFIG } from "./DEFAULT_STATE_MACHINE_MCP_SERVER_CONFIG";

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
 * Remote control command types
 */
interface RemoteCommand {
  type: 'user_input' | 'select_agent' | 'answer_question' | 'toggle_simulator';
  payload: any;
  timestamp: number;
  id: string;
}

/**
 * Shared game state for remote control
 */
interface SharedGameState {
  currentX: number;
  currentPhase: 'waiting_input' | 'selecting_agent' | 'answering_question' | 'idle';
  availableAgents: string[];
  conversationThread: Array<{
    id: string;
    sender: string;
    message: string;
    timestamp: number;
  }>;
  lastAction: string;
  isWaitingForRemote: boolean;
  simulatorMode: boolean;
}

/**
 * X+1 MCP Machine Server
 * Handles the X+1 inductive pattern logic via MCP protocol
 */
export class MCPBasicStateMachineServer extends BaseMCPServer {
  private state: XPlusOneState;
  private gameState: SharedGameState;
  private commandQueue: RemoteCommand[] = [];
  private eventListeners: Set<(event: any) => void> = new Set();

  constructor() {
    const config: BaseMCPServerConfig = DEFAULT_STATE_MACHINE_MCP_SERVER_CONFIG;

    super(config);

    // Initialize X+1 state
    this.state = {
      x: 0,
      lastAdvancement: 'neutral',
      resetCount: 0,
      advancementHistory: [],
      sessionStart: Date.now()
    };

    // Initialize shared game state for remote control
    this.gameState = {
      currentX: 0,
      currentPhase: 'idle',
      availableAgents: [],
      conversationThread: [],
      lastAction: 'initialization',
      isWaitingForRemote: false,
      simulatorMode: false
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

  // === REMOTE CONTROL EVENT METHODS ===

  /**
   * Get recent events for streaming
   */
  private getRecentEvents(): Array<any> {
    // For now, return a sample of recent activities
    return [
      {
        type: 'state_update',
        data: { currentX: this.state.x, phase: this.gameState.currentPhase },
        timestamp: Date.now()
      },
      {
        type: 'queue_status',
        data: { queueSize: this.commandQueue.length },
        timestamp: Date.now()
      }
    ];
  }

  /**
   * Publish event to listeners
   */
  private publishEvent(event: any): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        Logger.mcpError('Error in event listener', { error, event: event.type });
      }
    });
  }

  /**
   * Update conversation thread
   */
  public updateConversation(message: { id: string; sender: string; message: string }): void {
    this.gameState.conversationThread.push({
      ...message,
      timestamp: Date.now()
    });
    
    this.publishEvent({
      type: 'conversation_update',
      data: message,
      timestamp: Date.now()
    });
  }

  /**
   * Update available agents
   */
  public updateAvailableAgents(agents: string[]): void {
    this.gameState.availableAgents = agents;
    this.gameState.currentPhase = agents.length > 0 ? 'selecting_agent' : 'idle';
    
    this.publishEvent({
      type: 'postulation_update',
      data: { availableAgents: agents },
      timestamp: Date.now()
    });
  }

  /**
   * Process pending remote commands
   */
  public getNextCommand(): RemoteCommand | null {
    return this.commandQueue.shift() || null;
  }

  /**
   * Update game phase
   */
  public updateGamePhase(phase: SharedGameState['currentPhase']): void {
    this.gameState.currentPhase = phase;
    this.publishEvent({
      type: 'phase_change',
      data: { phase },
      timestamp: Date.now()
    });
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

        Logger.mcpOperation('advance_x', this.config.name || '', true, undefined, undefined);
        Logger.mcpVerbose(`X advanced: ${previousX} → ${this.state.x}`, { reason, metadata });

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

        Logger.mcpOperation('reset_x', this.config.name || '', true, undefined, undefined);
        Logger.mcpVerbose(`X reset: ${previousX} → 0`, { reason, resetCount: this.state.resetCount });

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
        Logger.mcpVerbose('State save requested', { stateSize: JSON.stringify(state).length });
        
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
        Logger.mcpVerbose('State load requested', { graphId, userId });
        
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

    // === REMOTE CONTROL TOOLS ===
    
    // Send user input tool
    this.server.tool(
      'send_user_input',
      'Send input as if typed by the user',
      {
        text: z.string().describe('Text to send as user input'),
        context: z.object({
          simulateTyping: z.boolean().optional().describe('Simulate typing delay'),
          delayMs: z.number().optional().describe('Delay in milliseconds')
        }).optional()
      },
      async ({ text, context }) => {
        const command: RemoteCommand = {
          type: 'user_input',
          payload: { text, context },
          timestamp: Date.now(),
          id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        this.commandQueue.push(command);
        this.gameState.lastAction = `user_input: ${text}`;
        
        Logger.mcpVerbose('Remote command queued', { type: 'user_input', text: text.substring(0, 50), commandId: command.id });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              command: 'user_input',
              text: text,
              commandId: command.id,
              queued: true,
              timestamp: Date.now()
            }, null, 2)
          }]
        };
      }
    );

    // Select agent tool
    this.server.tool(
      'select_agent',
      'Select a specific agent from available postulations',
      {
        agentId: z.string().describe('ID or name of the agent to select'),
        reason: z.string().optional().describe('Reason for selecting this agent')
      },
      async ({ agentId, reason }) => {
        const command: RemoteCommand = {
          type: 'select_agent',
          payload: { agentId, reason },
          timestamp: Date.now(),
          id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        this.commandQueue.push(command);
        this.gameState.lastAction = `select_agent: ${agentId}`;
        
        Logger.mcpVerbose('Remote command queued', { type: 'select_agent', agentId, reason, commandId: command.id });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              command: 'select_agent',
              agentId: agentId,
              reason: reason,
              commandId: command.id,
              queued: true,
              timestamp: Date.now()
            }, null, 2)
          }]
        };
      }
    );

    // Answer critical question tool
    this.server.tool(
      'answer_critical_question',
      'Answer yes/no to the critical question from JusticeBot',
      {
        answer: z.enum(['yes', 'no']).describe('Answer to the critical question'),
        reasoning: z.string().optional().describe('Reasoning behind the answer')
      },
      async ({ answer, reasoning }) => {
        const command: RemoteCommand = {
          type: 'answer_question',
          payload: { answer, reasoning },
          timestamp: Date.now(),
          id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        this.commandQueue.push(command);
        this.gameState.lastAction = `answer_question: ${answer}`;
        
        Logger.mcpVerbose('Remote command queued', { type: 'answer_question', answer, reasoning, commandId: command.id });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              command: 'answer_critical_question',
              answer: answer,
              reasoning: reasoning,
              commandId: command.id,
              queued: true,
              timestamp: Date.now()
            }, null, 2)
          }]
        };
      }
    );

    // Get current conversation tool
    this.server.tool(
      'get_current_conversation',
      'Get the current conversation thread',
      {},
      async () => {
        Logger.mcpVerbose('Conversation data requested', { threadLength: this.gameState.conversationThread.length });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              conversation: this.gameState.conversationThread,
              messageCount: this.gameState.conversationThread.length,
              timestamp: Date.now()
            }, null, 2)
          }]
        };
      }
    );

    // Get available postulations tool
    this.server.tool(
      'get_available_postulations',
      'Get the list of available agent postulations',
      {},
      async () => {
        Logger.mcpVerbose('Available postulations requested', { agentCount: this.gameState.availableAgents.length });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              availableAgents: this.gameState.availableAgents,
              currentPhase: this.gameState.currentPhase,
              isWaitingForSelection: this.gameState.currentPhase === 'selecting_agent',
              timestamp: Date.now()
            }, null, 2)
          }]
        };
      }
    );

    // Toggle simulator mode tool
    this.server.tool(
      'toggle_simulator_mode',
      'Toggle between manual and automatic simulator mode',
      {
        mode: z.enum(['on', 'off', 'toggle']).optional().describe('Set mode explicitly or toggle')
      },
      async ({ mode }) => {
        const command: RemoteCommand = {
          type: 'toggle_simulator',
          payload: { mode },
          timestamp: Date.now(),
          id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        this.commandQueue.push(command);
        
        if (mode === 'on') {
          this.gameState.simulatorMode = true;
        } else if (mode === 'off') {
          this.gameState.simulatorMode = false;
        } else {
          this.gameState.simulatorMode = !this.gameState.simulatorMode;
        }

        this.gameState.lastAction = `toggle_simulator: ${this.gameState.simulatorMode ? 'on' : 'off'}`;
        
        Logger.mcpVerbose('Simulator mode toggled', { 
          mode: this.gameState.simulatorMode ? 'on' : 'off', 
          commandId: command.id 
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              command: 'toggle_simulator_mode',
              simulatorMode: this.gameState.simulatorMode,
              commandId: command.id,
              timestamp: Date.now()
            }, null, 2)
          }]
        };
      }
    );

    // === STATE SYNCHRONIZATION TOOLS ===

    // Get next remote command tool
    this.server.tool(
      'get_next_command',
      'Get the next remote command from the queue',
      {},
      async () => {
        const command = this.commandQueue.shift();
        
        Logger.mcpVerbose('Command queue accessed', { 
          commandFound: !!command, 
          queueSize: this.commandQueue.length,
          commandType: command?.type 
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              command: command || null,
              queueSize: this.commandQueue.length,
              timestamp: Date.now()
            }, null, 2)
          }]
        };
      }
    );

    // Update shared game state tool
    this.server.tool(
      'update_game_state',
      'Update the shared game state from the UI',
      {
        phase: z.string().optional().describe('Current game phase'),
        messageCount: z.number().optional().describe('Current message count'),
        availableAgents: z.array(z.string()).optional().describe('Available agents'),
        lastAction: z.string().optional().describe('Last action performed')
      },
      async ({ phase, messageCount, availableAgents, lastAction }) => {
        // Update shared game state
        if (phase) this.gameState.currentPhase = phase as any;
        if (availableAgents) this.gameState.availableAgents = availableAgents;
        if (lastAction) this.gameState.lastAction = lastAction;
        
        // Sync X value with internal state
        this.gameState.currentX = this.state.x;
        
        // Publish update event
        this.publishEvent({
          type: 'game_state_updated',
          data: { 
            phase, 
            messageCount, 
            availableAgents, 
            lastAction,
            currentX: this.state.x
          },
          timestamp: Date.now()
        });

        Logger.mcpVerbose('Game state synchronized', { 
          phase, 
          messageCount, 
          agentCount: availableAgents?.length || 0,
          lastAction,
          currentX: this.state.x
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              updatedState: {
                currentX: this.gameState.currentX,
                currentPhase: this.gameState.currentPhase,
                availableAgents: this.gameState.availableAgents,
                lastAction: this.gameState.lastAction
              },
              timestamp: Date.now()
            }, null, 2)
          }]
        };
      }
    );

    // Add conversation message tool
    this.server.tool(
      'add_conversation_message',
      'Add a message to the conversation thread',
      {
        sender: z.string().describe('Message sender (user, agent name, etc.)'),
        message: z.string().describe('Message content'),
        messageId: z.string().optional().describe('Optional message ID')
      },
      async ({ sender, message, messageId }) => {
        const msgId = messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const conversationMessage = {
          id: msgId,
          sender,
          message,
          timestamp: Date.now()
        };

        this.gameState.conversationThread.push(conversationMessage);
        
        // Keep only last 50 messages to prevent memory issues
        if (this.gameState.conversationThread.length > 50) {
          this.gameState.conversationThread = this.gameState.conversationThread.slice(-50);
        }

        // Publish conversation update event
        this.publishEvent({
          type: 'conversation_message_added',
          data: conversationMessage,
          timestamp: Date.now()
        });

        Logger.mcpVerbose('Conversation message added', { sender, messageLength: message.length, threadSize: this.gameState.conversationThread.length });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              messageId: msgId,
              conversationLength: this.gameState.conversationThread.length,
              timestamp: Date.now()
            }, null, 2)
          }]
        };
      }
    );

    // Get full game state tool
    this.server.tool(
      'get_full_game_state',
      'Get the complete shared game state',
      {},
      async () => {
        // Ensure state is synchronized
        this.gameState.currentX = this.state.x;

        Logger.mcpVerbose('Full game state requested', { currentX: this.state.x, phase: this.gameState.currentPhase });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              internalState: {
                x: this.state.x,
                lastAdvancement: this.state.lastAdvancement,
                resetCount: this.state.resetCount,
                sessionStart: this.state.sessionStart,
                advancementHistory: this.state.advancementHistory
              },
              sharedState: this.gameState,
              commandQueueSize: this.commandQueue.length,
              timestamp: Date.now()
            }, null, 2)
          }]
        };
      }
    );

    // === CONSOLE READING TOOLS ===
    
    // Get console output tool
    this.server.tool(
      'get_console_output',
      'Get the current console output and display state',
      {},
      async () => {
        // For now, return a placeholder implementation
        // This would be connected to the actual ConsoleGamificationUI instance
        Logger.mcpVerbose('Console output placeholder accessed');

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Console reading not yet connected to UI instance',
              placeholder: true,
              implementationNeeded: 'Connect to ConsoleGamificationUI.getCurrentOutput()',
              timestamp: Date.now()
            }, null, 2)
          }]
        };
      }
    );

    // Get current prompt tool
    this.server.tool(
      'get_current_prompt',
      'Get the current prompt text and available options',
      {},
      async () => {
        Logger.mcpVerbose('Current prompt placeholder accessed');

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Prompt reading not yet connected to UI instance',
              placeholder: true,
              implementationNeeded: 'Connect to ConsoleGamificationUI.getCurrentPrompt()',
              timestamp: Date.now()
            }, null, 2)
          }]
        };
      }
    );

    // Get UI status tool
    this.server.tool(
      'get_ui_status',
      'Get the current UI status and interaction state',
      {},
      async () => {
        Logger.mcpVerbose('UI status placeholder accessed');

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'UI status reading not yet connected to UI instance',
              placeholder: true,
              implementationNeeded: 'Connect to ConsoleGamificationUI.getUIStatus()',
              timestamp: Date.now()
            }, null, 2)
          }]
        };
      }
    );

    // Get interaction state tool
    this.server.tool(
      'get_interaction_state',
      'Get the current interaction state and available commands',
      {},
      async () => {
        Logger.mcpVerbose('Interaction state placeholder accessed');

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Interaction state reading not yet connected to UI instance',
              placeholder: true,
              implementationNeeded: 'Connect to ConsoleGamificationUI.getInteractionState()',
              currentPhase: this.gameState.currentPhase,
              availableAgents: this.gameState.availableAgents,
              timestamp: Date.now()
            }, null, 2)
          }]
        };
      }
    );
  }

  /**
   * Setup X+1 resources
   */
  private setupResources(): void {
    Logger.mcpInfo('Setting up X+1 resources...');
    
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
    Logger.mcpVerbose('Registering StateGraph resource', { id: 'stategraphs/x-plus-1-game' });
    this.server.resource(
      'stategraphs/x-plus-1-game',
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

    // === REMOTE CONTROL RESOURCES ===
    
    // Game events stream resource
    this.server.resource(
      'game-events',
      'xplus1://events/stream',
      {
        name: 'Game Events Stream',
        description: 'Stream of real-time game events for remote monitoring',
        mimeType: 'application/json'
      },
      async () => {
        const events = this.getRecentEvents();
        return {
          contents: [
            {
              uri: 'xplus1://events/stream',
              mimeType: 'application/json',
              text: JSON.stringify({
                events: events,
                timestamp: Date.now(),
                totalEvents: events.length
              }, null, 2)
            }
          ]
        };
      }
    );

    // Conversation updates resource
    this.server.resource(
      'conversation-updates',
      'xplus1://conversation/current',
      {
        name: 'Conversation Updates',
        description: 'Updates to the current conversation thread',
        mimeType: 'application/json'
      },
      async () => {
        return {
          contents: [
            {
              uri: 'xplus1://conversation/current',
              mimeType: 'application/json',
              text: JSON.stringify({
                conversation: this.gameState.conversationThread,
                messageCount: this.gameState.conversationThread.length,
                lastUpdate: Date.now(),
                currentPhase: this.gameState.currentPhase
              }, null, 2)
            }
          ]
        };
      }
    );

    // Postulation events resource
    this.server.resource(
      'postulation-events',
      'xplus1://postulations/current',
      {
        name: 'Postulation Events',
        description: 'Current available agent postulations for selection',
        mimeType: 'application/json'
      },
      async () => {
        return {
          contents: [
            {
              uri: 'xplus1://postulations/current',
              mimeType: 'application/json',
              text: JSON.stringify({
                availableAgents: this.gameState.availableAgents,
                currentPhase: this.gameState.currentPhase,
                isWaitingForSelection: this.gameState.currentPhase === 'selecting_agent',
                lastAction: this.gameState.lastAction,
                timestamp: Date.now()
              }, null, 2)
            }
          ]
        };
      }
    );

    // Command queue status resource
    this.server.resource(
      'command-queue-status',
      'xplus1://commands/queue',
      {
        name: 'Command Queue Status',
        description: 'Status of pending remote commands',
        mimeType: 'application/json'
      },
      async () => {
        return {
          contents: [
            {
              uri: 'xplus1://commands/queue',
              mimeType: 'application/json',
              text: JSON.stringify({
                queueSize: this.commandQueue.length,
                pendingCommands: this.commandQueue.map(cmd => ({
                  id: cmd.id,
                  type: cmd.type,
                  timestamp: cmd.timestamp
                })),
                isProcessing: this.gameState.isWaitingForRemote,
                timestamp: Date.now()
              }, null, 2)
            }
          ]
        };
      }
    );

    Logger.mcpInfo('X+1 resources setup completed');
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

    // === REMOTE CONTROL PROMPTS ===

    // Remote control guide prompt
    this.server.prompt(
      'remote_control_guide',
      'Guide for controlling the X+1 game remotely via MCP',
      {
        context: z.string().optional().describe('Current context or situation'),
        phase: z.string().optional().describe('Current game phase')
      },
      async ({ context, phase }) => {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `🎮 **Remote Control Guide for X+1 Game**\n\n` +
                      `**Available Commands:**\n` +
                      `• send_user_input: Send text as if typed by user\n` +
                      `• select_agent: Choose specific agent from postulations\n` +
                      `• answer_critical_question: Respond yes/no to JusticeBot\n` +
                      `• get_current_conversation: View conversation thread\n` +
                      `• get_available_postulations: See available agents\n` +
                      `• toggle_simulator_mode: Switch manual/auto mode\n\n` +
                      `**Current Context:** ${context || 'Starting game'}\n` +
                      `**Current Phase:** ${phase || 'Unknown'}\n\n` +
                      `**Game Flow:**\n` +
                      `1. Agents postulate for turns\n` +
                      `2. Select agent or let simulator choose\n` +
                      `3. Agent speaks, conversation continues\n` +
                      `4. JusticeBot asks critical question\n` +
                      `5. Answer determines X advancement\n\n` +
                      `Use the MCP tools above to control the game remotely.`
              }
            }
          ]
        };
      }
    );

    // Decision helper prompt
    this.server.prompt(
      'decision_helper',
      'Help with agent selection and critical decisions',
      {
        availableAgents: z.string().optional().describe('Available agent names (comma-separated)'),
        conversationContext: z.string().optional().describe('Recent conversation context'),
        currentX: z.string().optional().describe('Current X value')
      },
      async ({ availableAgents, conversationContext, currentX }) => {
        const x = currentX ? parseInt(currentX) : this.state.x;
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `🎯 **Decision Helper for X+1 Game**\n\n` +
                      `**Current Situation:**\n` +
                      `• X Value: ${x}\n` +
                      `• Available Agents: ${availableAgents || 'None'}\n` +
                      `• Recent Context: ${conversationContext || 'No context'}\n\n` +
                      `**Agent Personalities:**\n` +
                      `• DionisioBot: Mystical, cosmic, philosophical\n` +
                      `• ApoloBot: Encouraging, optimistic, achievement-focused\n` +
                      `• JusticeBot: Neutral, asks critical consumption question\n\n` +
                      `**Decision Guidelines:**\n` +
                      `• Higher X = More risk, consider consumption patterns\n` +
                      `• DionisioBot good for reflection and big picture\n` +
                      `• ApoloBot good for motivation and progress\n` +
                      `• Answer "no" to critical question to advance X\n` +
                      `• Answer "yes" to reset X to 0\n\n` +
                      `Choose wisely based on your goals and current state.`
              }
            }
          ]
        };
      }
    );

    // Conversation analyzer prompt
    this.server.prompt(
      'conversation_analyzer',
      'Analyze current conversation state and suggest next actions',
      {
        conversationSummary: z.string().optional().describe('Summary of conversation messages'),
        messageCount: z.string().optional().describe('Current message count'),
        maxMessages: z.string().optional().describe('Maximum messages allowed')
      },
      async ({ conversationSummary, messageCount, maxMessages }) => {
        const count = messageCount ? parseInt(messageCount) : 0;
        const max = maxMessages ? parseInt(maxMessages) : 10;
        const remaining = max - count;

        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `📊 **Conversation Analysis**\n\n` +
                      `**Thread Status:**\n` +
                      `• Messages: ${count}/${max} (${remaining} remaining)\n\n` +
                      `**Recent Activity:**\n` +
                      `${conversationSummary || 'No conversation data available'}\n\n` +
                      `**Recommendations:**\n` +
                      `${remaining > 5 ? '• Continue conversation, plenty of messages left' : 
                        remaining > 2 ? '• Consider moving toward decision phase' :
                        '• Conversation nearing end, prepare for critical question'}\n` +
                      `${count === 0 ? '• Start with DionisioBot or ApoloBot for opening' : ''}\n` +
                      `${remaining <= 1 ? '• JusticeBot should ask critical question next' : ''}\n\n` +
                      `Use this analysis to make informed remote control decisions.`
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

export default MCPBasicStateMachineServer;

/**
 * CLI entry point - run as standalone MCP server
 */
async function main() {
  console.log(`🎮 Starting X+1 MCP Machine on port 3001`);
  
  try {
    const server = new MCPBasicStateMachineServer();
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
