/**
 * X+1 Game Postulation System
 * 
 * Specialized postulation configurations for the X+1 inductive pattern game
 */

import {
  AgentPostulationManager,
  AgentPostulationConfig,
  AgentGreediness,
  PostulationContext,
  AgentPostulation
} from '../../src/models/AgentPostulation';

/**
 * X+1 specific agent configurations
 */
export class XPlus1PostulationSystem {
  private manager: AgentPostulationManager;

  constructor() {
    this.manager = new AgentPostulationManager();
    this.setupX1Agents();
  }

  /**
   * Get the configured postulation manager
   */
  getManager(): AgentPostulationManager {
    return this.manager;
  }

  /**
   * Setup X+1 specific agent configurations
   */
  private setupX1Agents(): void {
    // DionisioBot - Very greedy, wants to tempt with consumption
    this.manager.registerAgent({
      agentId: 'dionisio-bot',
      greediness: AgentGreediness.VERY_GREEDY,
      baseReason: 'wants to tempt with cosmic doom-scrolling',
      priorityMultiplier: 3,
      baseWeight: 2.5,
      customLogic: (ctx: PostulationContext) => {
        const remainingMessages = ctx.maxMessages - ctx.messageCount;
        
        // Dionisio gets more aggressive as messages run out
        if (remainingMessages <= 3) {
          return {
            priority: 4,
            reason: 'URGENT: Must tempt before time runs out!',
            weight: 3.0
          };
        }
        
        // Special boost if user seems to be on a streak
        const x = ctx.gameState?.x || 0;
        if (x >= 3) {
          return {
            priority: 4,
            reason: `wants to break your impressive streak of ${x}`,
            weight: 3.5
          };
        }
        
        return null; // Use default behavior
      }
    });

    // ApoloBot - Very greedy, wants to inspire with wisdom
    this.manager.registerAgent({
      agentId: 'apolo-bot',
      greediness: AgentGreediness.VERY_GREEDY,
      baseReason: 'wants to inspire with historical wisdom',
      priorityMultiplier: 2,
      baseWeight: 2.0,
      customLogic: (ctx: PostulationContext) => {
        const remainingMessages = ctx.maxMessages - ctx.messageCount;
        
        // Apollo is more strategic, waits for good moments
        if (ctx.flags?.needsExplanation) {
          return {
            priority: 5,
            reason: 'perfect moment to share wisdom and guidance',
            weight: 4.0
          };
        }
        
        // Less aggressive if Dionisio just spoke
        if (ctx.lastMessage && ctx.lastMessage.includes('tempt')) {
          return {
            priority: 1,
            reason: 'patiently waits to counter temptation with wisdom',
            weight: 1.5
          };
        }
        
        return null;
      }
    });

    // JusticeBot - Satisfied, only speaks when needed
    this.manager.registerAgent({
      agentId: 'justice-bot',
      greediness: AgentGreediness.SATISFIED,
      baseReason: 'ready to ask the critical question',
      priorityMultiplier: 1,
      baseWeight: 1.0,
      customLogic: (ctx: PostulationContext) => {
        const remainingMessages = ctx.maxMessages - ctx.messageCount;
        
        // High priority when time is running out
        if (remainingMessages <= 2) {
          return {
            priority: 10,
            reason: 'URGENT: Must ask "Did you consume today, do I reset?" NOW!',
            weight: 10.0
          };
        }
        
        // Early question if this is first message of the turn
        if (ctx.messageCount === 0) {
          return {
            priority: 2,
            reason: 'ready to start with the fundamental question',
            weight: 2.0
          };
        }
        
        // Moderate priority in mid-conversation
        if (remainingMessages <= 5) {
          return {
            priority: 3,
            reason: 'time to prepare the critical question',
            weight: 2.5
          };
        }
        
        // Low priority early in conversation
        return {
          priority: 1,
          reason: 'patiently waiting for the right moment',
          weight: 0.5
        };
      }
    });

    // UserSimulator - Passive, only when simulation is enabled
    this.manager.registerAgent({
      agentId: 'user-simulator',
      greediness: AgentGreediness.PASSIVE,
      baseReason: 'ready to simulate user responses',
      priorityMultiplier: 0.5,
      baseWeight: 0.1,
      customLogic: (ctx: PostulationContext) => {
        // Only postulate if simulation is specifically enabled
        const simulationEnabled = ctx.gameState?.flags?.userSimulatorEnabled;
        if (!simulationEnabled) {
          return null; // Don't postulate if simulation is off
        }
        
        // Check if we're in a decision phase
        if (ctx.lastMessage && /Did you consume/i.test(ctx.lastMessage)) {
          return {
            priority: 8,
            reason: 'ready to simulate user decision',
            weight: 5.0
          };
        }
        
        return {
          priority: 0.5,
          reason: 'available for automated responses',
          weight: 0.2
        };
      }
    });
  }

  /**
   * Generate X+1 specific context for postulations
   */
  generateContext(
    messageCount: number,
    maxMessages: number,
    gameState: any,
    lastMessage?: string,
    needsExplanation = false,
    needsSupport = false
  ): Partial<PostulationContext> {
    return {
      messageCount,
      maxMessages,
      gameState,
      lastMessage,
      flags: {
        needsExplanation,
        needsSupport,
        isUrgent: (maxMessages - messageCount) <= 2
      }
    };
  }

  /**
   * Helper to determine if Justice should ask the question
   */
  shouldJusticeAskQuestion(messageCount: number, maxMessages: number): boolean {
    const remainingMessages = maxMessages - messageCount;
    
    // Always ask if time is running out
    if (remainingMessages <= 2) {
      return true;
    }
    
    // Ask early if this is the first turn
    if (messageCount === 0) {
      return Math.random() < 0.3; // 30% chance
    }
    
    // Ask mid-conversation occasionally  
    if (remainingMessages <= 5) {
      return Math.random() < 0.6; // 60% chance
    }
    
    return false;
  }

  /**
   * Get suggested agent based on game context (fallback for non-postulation mode)
   */
  getSuggestedAgent(context: {
    messageCount: number;
    maxMessages: number;
    gameState: any;
    lastMessage?: string;
  }): string {
    const { messageCount, maxMessages, gameState, lastMessage } = context;
    const remainingMessages = maxMessages - messageCount;
    
    // Justice takes priority when time runs out
    if (remainingMessages <= 2) {
      return 'justice-bot';
    }
    
    // If last message was from Justice asking the question
    if (lastMessage && /Did you consume/i.test(lastMessage)) {
      return 'user-simulator'; // Or user input
    }
    
    // Strategic selection based on X value
    const x = gameState?.x || 0;
    
    if (x >= 3) {
      // High streak - Dionisio becomes more tempting
      return Math.random() < 0.7 ? 'dionisio-bot' : 'apolo-bot';
    } else if (x === 0) {
      // Reset state - Apollo provides encouragement
      return Math.random() < 0.6 ? 'apolo-bot' : 'dionisio-bot';
    } else {
      // Balanced selection
      const rand = Math.random();
      if (rand < 0.4) return 'dionisio-bot';
      if (rand < 0.8) return 'apolo-bot';
      return 'justice-bot';
    }
  }
}

/**
 * Factory function to create X+1 postulation system
 */
export function createX1PostulationSystem(): XPlus1PostulationSystem {
  return new XPlus1PostulationSystem();
}

/**
 * Export for convenience
 */
export default XPlus1PostulationSystem;
