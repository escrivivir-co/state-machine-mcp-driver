import { loadUserSimulator, UserSimulatorConfig } from './mcp-servers/config-loader';

export type UserDecision = 'yes' | 'no' | 'clarify';

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

export interface AgentPostulation {
  agentId: string;
  agentName: string;
  greediness: 'very_greedy' | 'satisfied' | 'neutral';
  reason: string;
  priority: number;
}

export class UserSimulator {
  private config: UserSimulatorConfig;
  private personalityKey: string;

  constructor(personality?: string) {
    this.config = loadUserSimulator();
    this.personalityKey = personality || this.config.defaults.personality;
  }

  setPersonality(personality: string) {
    if (this.config.personalities[personality]) {
      this.personalityKey = personality;
    }
  }

  getPersonality() {
    return this.personalityKey;
  }

  decideConsumption(ctx: SimulatorContext): UserDecision {
    const p = this.config.personalities[this.personalityKey];
    let probability = p.baseConsumptionProbability;

    // Adjust by streak thresholds
    for (const t of p.streakThresholds) {
      if (ctx.x >= t.x) probability += t.delta;
    }

    // Recent reset penalty (encourage improvement)
    const recent = ctx.turnHistory.slice(-p.recentResetPenalty.window);
    const recentResets = recent.filter(h => h.advance < 0).length;
    if (recentResets > p.recentResetPenalty.threshold) {
      probability += p.recentResetPenalty.delta;
    }

    // Random jitter
    probability += (Math.random() - 0.5) * p.randomJitter;
    probability = Math.max(0, Math.min(1, probability));

    return Math.random() < probability ? 'yes' : 'no';
  }

  chooseNextAgent(ctx: SimulatorContext): string {
    const p = this.config.personalities[this.personalityKey];

    if (ctx.lastMessage && /Did you consume/i.test(ctx.lastMessage)) {
      return 'justice-bot';
    }
    if (ctx.needsExplanation) return 'apolo-bot';
    if (ctx.emotionalState === 'needs_support') return 'dionisio-bot';

    // Weighted random
    const entries = Object.entries(p.nextAgentWeights);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let rnd = Math.random() * total;
    for (const [id, w] of entries) {
      rnd -= w;
      if (rnd <= 0) return id;
    }
    return entries[0]?.[0] || 'justice-bot';
  }

  /**
   * Generate postulations from agents based on their greediness and current context
   */
  generateAgentPostulations(ctx: SimulatorContext): AgentPostulation[] {
    const postulations: AgentPostulation[] = [];
    const messageCount = ctx.messageCount || 0;
    const maxMessages = ctx.maxMessages || 10;
    const remainingMessages = maxMessages - messageCount;

    // Agent greediness configurations
    const agentProfiles = {
      'dionisio-bot': { 
        greediness: 'very_greedy' as const, 
        name: 'DionisioBot',
        baseReason: 'wants to tempt with cosmic doom-scrolling'
      },
      'apolo-bot': { 
        greediness: 'very_greedy' as const, 
        name: 'ApoloBot',
        baseReason: 'wants to inspire with historical wisdom'
      },
      'justice-bot': { 
        greediness: 'satisfied' as const, 
        name: 'JusticeBot',
        baseReason: 'needs to ask the critical question'
      }
    };

    for (const [agentId, profile] of Object.entries(agentProfiles)) {
      let shouldPostulate = false;
      let priority = 1;
      let reason = profile.baseReason;

      if (profile.greediness === 'very_greedy') {
        // Greedy agents always want messages
        shouldPostulate = remainingMessages > 2; // Leave room for Justice question
        priority = profile.name === 'DionisioBot' ? 3 : 2; // Dionisio slightly more aggressive
        reason = `${profile.baseReason} (${remainingMessages} messages left)`;
      } else if (profile.greediness === 'satisfied') {
        // JusticeBot only wants to ensure the question gets asked
        shouldPostulate = remainingMessages <= 3 || messageCount === 0;
        priority = remainingMessages <= 2 ? 10 : 1; // High priority when time is running out
        reason = remainingMessages <= 2 
          ? 'URGENT: Must ask the critical question!' 
          : 'Ready to ask the question when needed';
      }

      if (shouldPostulate) {
        postulations.push({
          agentId,
          agentName: profile.name,
          greediness: profile.greediness,
          reason,
          priority
        });
      }
    }

    // Sort by priority (higher = more urgent)
    return postulations.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Choose which agent should get the next message from postulations
   */
  chooseFromPostulations(postulations: AgentPostulation[], ctx: SimulatorContext): string {
    if (postulations.length === 0) {
      return this.chooseNextAgent(ctx); // Fallback to weighted random
    }

    const p = this.config.personalities[this.personalityKey];

    // Special cases override postulations
    if (ctx.lastMessage && /Did you consume/i.test(ctx.lastMessage)) {
      return 'justice-bot';
    }

    // Filter by context needs
    if (ctx.needsExplanation) {
      const apolloPost = postulations.find(p => p.agentId === 'apolo-bot');
      if (apolloPost) return apolloPost.agentId;
    }

    if (ctx.emotionalState === 'needs_support') {
      const dionisioPost = postulations.find(p => p.agentId === 'dionisio-bot');
      if (dionisioPost) return dionisioPost.agentId;
    }

    // Use personality weights to choose among postulating agents
    const weightedPostulations = postulations.map(post => ({
      ...post,
      weight: p.nextAgentWeights[post.agentId] || 1
    }));

    const totalWeight = weightedPostulations.reduce((sum, post) => sum + post.weight, 0);
    let rnd = Math.random() * totalWeight;

    for (const post of weightedPostulations) {
      rnd -= post.weight;
      if (rnd <= 0) return post.agentId;
    }

    // Fallback to highest priority
    return postulations[0].agentId;
  }
}
