/**
 * Agent Postulation System
 * 
 * Handles the mechanics of agents "postulating" for message turns
 * based on their greediness levels and context.
 */

import { DEFAULT_AGENT_CONFIG } from '@/ui/DEFAULT_AGENT_CONFIG';
import { Agent } from './Agent';

/**
 * Agent greediness levels that determine postulation behavior
 */
export enum AgentGreediness {
  VERY_GREEDY = 'very_greedy',    // Always wants to participate
  SATISFIED = 'satisfied',        // Only participates when needed
  NEUTRAL = 'neutral',           // Moderate participation
  PASSIVE = 'passive'            // Rarely participates
}

/**
 * Context for postulation decisions
 */
export interface PostulationContext {
  /** Current message count in thread */
  messageCount: number;
  /** Maximum messages allowed in thread */
  maxMessages: number;
  /** Current game state data */
  gameState?: Record<string, any>;
  /** Last message content for context */
  lastMessage?: string;
  /** Available agents for postulation */
  availableAgents: Agent[];
  /** Special context flags */
  flags?: {
    needsExplanation?: boolean;
    needsSupport?: boolean;
    isUrgent?: boolean;
  };
}

/**
 * Agent postulation for a message turn
 */
export interface AgentPostulation {
  /** Agent making the postulation */
  agent: Agent;
  /** Agent's greediness level */
  greediness: AgentGreediness;
  /** Reason for postulating */
  reason: string;
  /** Priority level (higher = more urgent) */
  priority: number;
  /** Weight for selection algorithm */
  weight: number;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Configuration for agent postulation behavior
 */
export interface AgentPostulationConfig {
  /** Agent ID */
  agentId: string;
  /** Greediness level */
  greediness: AgentGreediness;
  /** Base reason template */
  baseReason: string;
  /** Priority multiplier */
  priorityMultiplier: number;
  /** Selection weight */
  baseWeight: number;
  /** Custom postulation logic */
  customLogic?: (ctx: PostulationContext) => Partial<AgentPostulation> | null;
}

/**
 * Agent Postulation Manager
 * 
 * Manages the postulation system for agent message turns
 */
export class AgentPostulationManager {
  private agentConfigs: Map<string, AgentPostulationConfig> = new Map();

  /**
   * Register an agent's postulation configuration
   */
  registerAgent(config: AgentPostulationConfig): void {
    this.agentConfigs.set(config.agentId, config);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    this.agentConfigs.delete(agentId);
  }

  /**
   * Generate postulations from all registered agents
   */
  generatePostulations(context: PostulationContext): AgentPostulation[] {
    const postulations: AgentPostulation[] = [];
    const remainingMessages = context.maxMessages - context.messageCount;

    for (const agent of context.availableAgents) {
      const config = this.agentConfigs.get(agent.id);
      if (!config) continue;

      const postulation = this.generateAgentPostulation(agent, config, context, remainingMessages);
      if (postulation) {
        postulations.push(postulation);
      }
    }

    // IMPROVEMENT: Ensure at least one greedy agent is always available
    if (postulations.length === 0 || !this.hasGreedyAgent(postulations)) {
      const forceGreedyPostulation = this.forceGreedyAgentPostulation(context, remainingMessages);
      if (forceGreedyPostulation) {
        postulations.push(forceGreedyPostulation);
      }
    }

    // Sort by priority (descending) then by weight (descending)
    return postulations.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return b.weight - a.weight;
    });
  }

  /**
   * Generate a single agent's postulation
   */
  private generateAgentPostulation(
    agent: Agent,
    config: AgentPostulationConfig,
    context: PostulationContext,
    remainingMessages: number
  ): AgentPostulation | null {
    // Check if agent should postulate based on greediness
    const shouldPostulate = this.shouldAgentPostulate(
      config.greediness,
      remainingMessages,
      context
    );

    if (!shouldPostulate) {
      return null;
    }

    // Calculate priority and weight
    const priority = this.calculatePriority(config, context, remainingMessages);
    const weight = this.calculateWeight(config, context, remainingMessages);
    const reason = this.generateReason(config, context, remainingMessages);

    // Apply custom logic if provided
    let postulation: AgentPostulation = {
      agent,
      greediness: config.greediness,
      reason,
      priority,
      weight,
      metadata: {
        remainingMessages,
        configId: config.agentId
      }
    };

    if (config.customLogic) {
      const customResult = config.customLogic(context);
      if (customResult === null) {
        return null; // Custom logic vetoed the postulation
      }
      postulation = { ...postulation, ...customResult };
    }

    return postulation;
  }

  /**
   * Determine if an agent should postulate based on greediness
   */
  private shouldAgentPostulate(
    greediness: AgentGreediness,
    remainingMessages: number,
    context: PostulationContext
  ): boolean {
    switch (greediness) {
      case AgentGreediness.VERY_GREEDY:
        // IMPROVED: Always want to participate if there's any room (was > 2, now > 0)
        // This ensures greedy agents are almost always available
        return remainingMessages > 0;

      case AgentGreediness.SATISFIED:
        // Only when needed or urgent
        return remainingMessages <= 3 || context.messageCount === 0 || !!context.flags?.isUrgent;

      case AgentGreediness.NEUTRAL:
        // IMPROVED: More generous participation (was > 1 && random > 0.3, now > 0 && random > 0.2)
        return remainingMessages > 0 && Math.random() > 0.2;

      case AgentGreediness.PASSIVE:
        // Rarely participates
        return remainingMessages <= 2 || Math.random() > 0.8;

      default:
        return false;
    }
  }

  /**
   * Calculate priority for postulation
   */
  private calculatePriority(
    config: AgentPostulationConfig,
    context: PostulationContext,
    remainingMessages: number
  ): number {
    let priority = config.priorityMultiplier;

    // Urgent flag boosts priority
    if (context.flags?.isUrgent) {
      priority += 10;
    }

    // Low remaining messages boost priority for certain agents
    if (remainingMessages <= 2) {
      if (config.greediness === AgentGreediness.SATISFIED) {
        priority += 8; // Critical agents get high priority when time runs out
      }
    }

    // Context-based priority adjustments
    if (context.flags?.needsExplanation && config.agentId.includes('guide')) {
      priority += 5;
    }

    if (context.flags?.needsSupport && config.agentId.includes('support')) {
      priority += 5;
    }

    return Math.max(1, priority);
  }

  /**
   * Calculate weight for selection algorithm
   */
  private calculateWeight(
    config: AgentPostulationConfig,
    context: PostulationContext,
    remainingMessages: number
  ): number {
    let weight = config.baseWeight;

    // Adjust weight based on remaining messages
    if (config.greediness === AgentGreediness.VERY_GREEDY) {
      weight *= Math.max(0.5, remainingMessages / context.maxMessages);
    }

    return Math.max(0.1, weight);
  }

  /**
   * Generate reason for postulation
   */
  private generateReason(
    config: AgentPostulationConfig,
    context: PostulationContext,
    remainingMessages: number
  ): string {
    let reason = config.baseReason;

    // Add context information
    if (remainingMessages <= 2) {
      reason += ' (URGENT - few messages left)';
    } else if (remainingMessages > 7) {
      reason += ` (${remainingMessages} messages available)`;
    }

    // Add special context
    if (context.flags?.needsExplanation) {
      reason += ' [explanation needed]';
    }

    if (context.flags?.needsSupport) {
      reason += ' [support requested]';
    }

    return reason;
  }

  /**
   * Select an agent from postulations using weighted random selection
   */
  selectAgent(postulations: AgentPostulation[]): AgentPostulation | null {
    if (postulations.length === 0) {
      return null;
    }

    // If only one postulation, return it
    if (postulations.length === 1) {
      return postulations[0];
    }

    // Weighted random selection
    const totalWeight = postulations.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;

    for (const postulation of postulations) {
      random -= postulation.weight;
      if (random <= 0) {
        return postulation;
      }
    }

    // Fallback to first (highest priority)
    return postulations[0];
  }

  /**
   * Get registered agent configurations
   */
  getAgentConfigs(): Map<string, AgentPostulationConfig> {
    return new Map(this.agentConfigs || DEFAULT_AGENT_CONFIG);
  }

  /**
   * Check if there's at least one greedy agent in the postulations
   */
  private hasGreedyAgent(postulations: AgentPostulation[]): boolean {
    return postulations.some(p => 
      p.greediness === AgentGreediness.VERY_GREEDY || 
      p.greediness === AgentGreediness.NEUTRAL
    );
  }

  /**
   * Force at least one greedy agent to postulate
   */
  private forceGreedyAgentPostulation(
    context: PostulationContext, 
    remainingMessages: number
  ): AgentPostulation | null {
    // Find the most greedy agent that isn't currently postulating
    const greedyConfigs = Array.from(this.agentConfigs.values())
      .filter(config => 
        config.greediness === AgentGreediness.VERY_GREEDY ||
        config.greediness === AgentGreediness.NEUTRAL
      )
      .sort((a, b) => {
        // Prioritize VERY_GREEDY over NEUTRAL
        if (a.greediness === AgentGreediness.VERY_GREEDY && b.greediness !== AgentGreediness.VERY_GREEDY) {
          return -1;
        }
        if (b.greediness === AgentGreediness.VERY_GREEDY && a.greediness !== AgentGreediness.VERY_GREEDY) {
          return 1;
        }
        return b.priorityMultiplier - a.priorityMultiplier;
      });

    for (const config of greedyConfigs) {
      // Find the corresponding agent
      const agent = context.availableAgents.find(a => a.id === config.agentId);
      if (!agent) continue;

      // Force generate a postulation for this agent
      const forcedPostulation: AgentPostulation = {
        agent,
        greediness: config.greediness,
        reason: `${config.baseReason} (forced to ensure greedy option available)`,
        priority: Math.max(1, config.priorityMultiplier - 1), // Lower priority since it's forced
        weight: Math.max(0.5, config.baseWeight * 0.8), // Lower weight since it's forced
        metadata: {
          remainingMessages,
          configId: config.agentId,
          forcedGreedySelection: true,
          originallyWouldNotPostulate: true
        }
      };

      // Apply custom logic but with forced context
      if (config.customLogic) {
        const customResult = config.customLogic(context);
        if (customResult && customResult !== null) {
          // Merge but keep the forced nature
          Object.assign(forcedPostulation, customResult, {
            metadata: {
              ...forcedPostulation.metadata,
              ...customResult.metadata,
              forcedGreedySelection: true
            }
          });
        }
      }

      return forcedPostulation;
    }

    return null; // No greedy agents available to force
  }
}
