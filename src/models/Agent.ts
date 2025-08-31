/**
 * State Machine MCP Driver - Agent Model
 * Defines interfaces and types for agent management
 */

/**
 * Agent roles define the behavior and permissions of agents
 */
export enum AgentRole {
    NARRATOR = "narrator",
    GUIDE = "guide",
    PLAYER = "player",
    SYSTEM = "system",
    CUSTOM = "custom",
}

/**
 * Agent status indicates the current state of the agent
 */
export enum AgentStatus {
    INACTIVE = "inactive",
    ACTIVE = "active",
    BUSY = "busy",
    ERROR = "error",
    SUSPENDED = "suspended",
}

/**
 * Agent configuration for runtime initialization
 */
export interface AgentConfig {
    /** Unique identifier for this agent */
    id: string;
    /** Human-readable name */
    name: string;
    /** Agent role determining behavior */
    role: AgentRole;
    /** Agent description */
    description?: string;
    /** MCP server ID for agent's tools and resources */
    mcpServerId?: string;
    /** Agent-specific configuration */
    config?: Record<string, any>;
    /** Whether agent starts active */
    autoStart?: boolean;
    /** Agent priority (higher numbers = higher priority) */
    priority?: number;
}

/**
 * Runtime agent instance
 */
export interface Agent {
    /** Unique identifier */
    id: string;
    /** Human-readable name */
    name: string;
    /** Agent role */
    role: AgentRole;
    /** Current status */
    status: AgentStatus;
    /** Agent description */
    description?: string;
    /** MCP server ID for this agent */
    mcpServerId?: string;
    /** Current prompt template */
    prompt?: string;
    /** Agent configuration */
    config: Record<string, any>;
    /** Agent priority */
    priority: number;
    /** Statistics */
    stats: {
        actionsExecuted: number;
        messagesProcessed: number;
        errorsEncountered: number;
        lastActivity: number;
    };
    /** Agent metadata */
    metadata?: Record<string, any>;
}

/**
 * Agent action request
 */
export interface AgentAction {
    /** Action identifier */
    id: string;
    /** Agent performing the action */
    agentId: string;
    /** Type of action */
    type: string;
    /** Action parameters */
    params: Record<string, any>;
    /** Target of the action (user, state, other agent) */
    target?: string;
    /** Timestamp when action was requested */
    timestamp: number;
    /** Action priority */
    priority?: number;
}

/**
 * Agent action result
 */
export interface AgentActionResult {
    /** Action that was executed */
    actionId: string;
    /** Whether action was successful */
    success: boolean;
    /** Result data */
    result?: any;
    /** Error message if failed */
    error?: string;
    /** Execution time in milliseconds */
    executionTime: number;
    /** Additional metadata */
    metadata?: Record<string, any>;
}

/**
 * Agent message for communication between agents
 */
export interface AgentMessage {
    /** Message identifier */
    id: string;
    /** Sender agent ID */
    from: string;
    /** Recipient agent ID(s) */
    to: string | string[];
    /** Message type */
    type: string;
    /** Message content */
    content: any;
    /** Message timestamp */
    timestamp: number;
    /** Message priority */
    priority?: number;
    /** Whether message requires response */
    requiresResponse?: boolean;
}

/**
 * Agent utilities and factory methods
 */
export class AgentFactory {
    /**
     * Create a new agent from configuration
     */
    static createAgent(config: AgentConfig): Agent {
        return {
            id: config.id,
            name: config.name,
            role: config.role,
            status: config.autoStart
                ? AgentStatus.ACTIVE
                : AgentStatus.INACTIVE,
            description: config.description,
            mcpServerId: config.mcpServerId,
            config: config.config || {},
            priority: config.priority || 0,
            stats: {
                actionsExecuted: 0,
                messagesProcessed: 0,
                errorsEncountered: 0,
                lastActivity: Date.now(),
            },
            metadata: {},
        };
    }

    /**
     * Create a narrator agent configuration
     */
    static createNarrator(
        id: string,
        name: string,
        mcpServerId?: string
    ): AgentConfig {
        return {
            id,
            name,
            role: AgentRole.NARRATOR,
            description:
                "Narrative agent that provides story context and descriptions",
            mcpServerId,
            autoStart: true,
            priority: 100,
            config: {
                maxMessages: 50,
                responseStyle: "narrative",
                contextWindow: 10,
            },
        };
    }

    /**
     * Create a guide agent configuration
     */
    static createGuide(
        id: string,
        name: string,
        mcpServerId?: string
    ): AgentConfig {
        return {
            id,
            name,
            role: AgentRole.GUIDE,
            description:
                "Guide agent that helps users navigate and understand the system",
            mcpServerId,
            autoStart: true,
            priority: 80,
            config: {
                helpLevel: "intermediate",
                proactive: true,
                contextSensitive: true,
            },
        };
    }

    /**
     * Create a system agent configuration
     */
    static createSystem(id: string, name: string): AgentConfig {
        return {
            id,
            name,
            role: AgentRole.SYSTEM,
            description: "System agent that handles technical operations",
            autoStart: true,
            priority: 200,
            config: {
                debugMode: false,
                autoRecovery: true,
                logLevel: "info",
            },
        };
    }
}

/**
 * Agent manager utilities
 */
export class AgentUtils {
    /**
     * Check if agent can execute a specific action
     */
    static canExecuteAction(agent: Agent, actionType: string): boolean {
        if (agent.status !== AgentStatus.ACTIVE) {
            return false;
        }

        // Role-based permissions
        switch (agent.role) {
            case AgentRole.SYSTEM:
                return true; // System agents can do everything
            case AgentRole.NARRATOR:
                return ["narrate", "describe", "present"].includes(actionType);
            case AgentRole.GUIDE:
                return ["guide", "help", "suggest", "explain"].includes(
                    actionType
                );
            case AgentRole.PLAYER:
                return ["choose", "interact", "explore"].includes(actionType);
            default:
                return false;
        }
    }

    /**
     * Update agent statistics
     */
    static updateStats(
        agent: Agent,
        type: "action" | "message" | "error"
    ): void {
        agent.stats.lastActivity = Date.now();

        switch (type) {
            case "action":
                agent.stats.actionsExecuted++;
                break;
            case "message":
                agent.stats.messagesProcessed++;
                break;
            case "error":
                agent.stats.errorsEncountered++;
                break;
        }
    }

    /**
     * Calculate agent priority score based on role and configuration
     */
    static calculatePriorityScore(
        agent: Agent,
        context?: Record<string, any>
    ): number {
        let score = agent.priority;

        // Boost priority for active agents
        if (agent.status === AgentStatus.ACTIVE) {
            score += 10;
        }

        // Role-based adjustmsents
        switch (agent.role) {
            case AgentRole.SYSTEM:
                score += 50; // System agents always have high priority
                break;
            case AgentRole.NARRATOR:
                score += context?.inNarrative ? 30 : 0;
                break;
            case AgentRole.GUIDE:
                score += context?.needsHelp ? 40 : 0;
                break;
        }

        return score;
    }

    /**
     * Validate agent configuration
     */
    static validateConfig(config: AgentConfig): string[] {
        const errors: string[] = [];

        if (!config.id) errors.push("Agent ID is required");
        if (!config.name) errors.push("Agent name is required");
        if (!Object.values(AgentRole).includes(config.role)) {
            errors.push("Invalid agent role");
        }

        return errors;
    }
}
