/**
 * State Machine MCP Driver - Runtime Engine
 * Core runtime for executing state machines with MCP integration
 */

import { EventEmitter } from "events";
import { IMCPDriver } from "../drivers/IMCPDriver";
import {
  StateGraph,
  State,
  Agent,
  AgentConfig,
  AgentFactory,
  AgentUtils,
  AgentStatus,
  AgentAction,
  AgentActionResult,
  StateNode,
  StateConfig,
} from "../models";
import { logger, Logger } from "../utils/logger";
import { StateManager } from "@/state/StateManager";
import { DEFAULT_RUNTIME_CONFIG } from "@/mcp-servers/DEFAULT_RUNTIME_CONFIG";
import { MCPDriverAdapter } from "@/drivers";
import { DEFAULT_AGENT_CONFIG } from "@/ui/DEFAULT_AGENT_CONFIG";
import { OllamaChatProvider } from "@/chat-provider";

// Chat provider types (supporting both strict typing and flexibility)
export interface DEPRECATEDChatProviderLike {
  send?: (
    conversationId: string,
    userContent: string,
    options?: any
  ) => Promise<any>;
  sendMessage?: (message: string, options?: any) => Promise<string>;
  generateResponse?: (context: any) => Promise<string>;
  // Support for common OllamaChatProvider methods
  startConversation?: (
    userId?: string,
    tools?: any[],
    metadata?: Record<string, any>
  ) => { id: string; [key: string]: any };
  endConversation?: (conversationId: string) => boolean;
  getConversation?: (conversationId: string) => any;
  getStats?: () => any;
  // Add more common methods as needed
}

/**
 * Runtime configuration interface
 */
export interface RuntimeConfig {
  /** MCP server ID for state operations */
  mcpServerId: string;
  /** StateGraph ID to load */
  graphId: string;
  /** User ID for state management */
  userId: string;
  /** Optional session ID */
  sessionId?: string;
  /** Maximum number of messages per thread */
  maxMessagesPerThread?: number;
  /** Session timeout in milliseconds */
  sessionTimeout?: number;
  /** Enable automatic state saving */
  autoSave?: boolean;
  /** Auto-save interval in milliseconds */
  autoSaveInterval?: number;
  /** Agent configurations */
  agentConfigs?: AgentConfig[];
}

/**
 * Runtime statistics
 */
export interface RuntimeStats {
  /** Session start time */
  sessionStartTime: number;
  /** Current session duration */
  sessionDuration: number;
  /** Total transitions made */
  transitionsCount: number;
  /** Total actions executed */
  actionsExecuted: number;
  /** Number of active agents */
  activeAgents: number;
  /** Current state information */
  currentState: {
    id: string;
    name: string;
    timeInState: number;
  };
  /** Performance metrics */
  performance: {
    averageTransitionTime: number;
    averageActionTime: number;
    errorRate: number;
  };
}

/**
 * Runtime events
 */
export enum RuntimeEvent {
  INITIALIZED = "initialized",
  STATE_LOADED = "stateLoaded",
  STATE_TRANSITION = "stateTransition",
  STATE_SAVED = "stateSaved",
  AGENT_ADDED = "agentAdded",
  AGENT_REMOVED = "agentRemoved",
  AGENT_STATUS_CHANGED = "agentStatusChanged",
  ACTION_EXECUTED = "actionExecuted",
  ERROR_OCCURRED = "errorOccurred",
  SESSION_STARTED = "sessionStarted",
  SESSION_ENDED = "sessionEnded",
}

/**
 * Main Runtime Engine class
 */
export class Runtime extends EventEmitter {
  private mcpDriver!: IMCPDriver;
  private chatProvider?: DEPRECATEDChatProviderLike;
  public config!: RuntimeConfig;
  private stateGraph?: StateGraph;
  private currentState?: State;
  private agents: Map<string, Agent> = new Map();
  private isInitialized = false;
  private sessionStartTime: number = 0;
  private stats: RuntimeStats;
  private autoSaveTimer?: NodeJS.Timeout;
  private actionQueue: AgentAction[] = [];
  private isProcessingActions = false;

  constructor(
    mcpDriver?: IMCPDriver,
    config?: RuntimeConfig,
    chatProvider?: DEPRECATEDChatProviderLike
  ) {
    super();

    if (mcpDriver) {
      this.mcpDriver = mcpDriver;
    }
    this.chatProvider = chatProvider;
    if (config) {
      this.config = {
        maxMessagesPerThread: 50,
        sessionTimeout: 3600000, // 1 hour
        autoSave: true,
        autoSaveInterval: 30000, // 30 seconds
        agentConfigs: DEFAULT_AGENT_CONFIG,
        ...config,
      };
    }

    this.stats = this.initializeStats();
    this.setupEventHandlers();
  }

  /**
   * Initialize the runtime
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (!this.config) {
      this.config = DEFAULT_RUNTIME_CONFIG;
    }

    if (!this.mcpDriver) {
      this.mcpDriver = new MCPDriverAdapter();
    }

    try {
      Logger.runtime("Initializing runtime", {
        graphId: this.config.graphId,
        userId: this.config.userId,
      });

      /** backmark */
      // Load the state graph
      this.stateGraph = await this.mcpDriver.loadStateGraph(
        this.config.mcpServerId,
        this.config.graphId
      );

      if (!this.stateGraph) {
        throw new Error(`Failed to load StateGraph: ${this.config.graphId}`);
      }

      Logger.runtime("StateGraph loaded", {
        graphId: this.stateGraph.id,
        statesCount: Object.keys(this.stateGraph?.states || {}).length,
      });

      try {
        // Load or create state
        await this.loadOrCreateState();
      } catch (error) {
        console.log("Error at loadOrCreate", error);
      }

      this.initializeAgents();

      // Setup auto-save if enabled
      if (this.config.autoSave && this.config.autoSaveInterval) {
        this.setupAutoSave();
      }

      this.isInitialized = true;
      this.sessionStartTime = Date.now();

      try {
        this.updateStats();
      } catch (error) {
        console.log("Error at updateStats", error);
      }

      this.emit(RuntimeEvent.INITIALIZED, {
        graphId: this.config.graphId,
        userId: this.config.userId,
        agentCount: this.agents.size,
      });

      Logger.runtime("Runtime initialized successfully");
    } catch (error) {
      const errorMessage = `Failed to initialize runtime: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
      Logger.error(errorMessage, error as Error);
      this.emit(RuntimeEvent.ERROR_OCCURRED, { error: errorMessage });
      throw error;
    }
  }
  async initializeAgents() {
    try {
      // Initialize agents
      console.log("   rt initialize loading for", this.config.agentConfigs);
      this.config.agentConfigs =
        this.config.agentConfigs || DEFAULT_AGENT_CONFIG;

      console.log("   rt initialize loading for", this.config.agentConfigs);
      if (this.config.agentConfigs) {
        for (const agentConfig of this.config.agentConfigs) {
          await this.addAgent(agentConfig);
        }
      }
    } catch (error) {
      console.log("Error at addAgent", error);
    }
  }

  /**
   * Add an agent to the runtime
   */
  async addAgent(config: AgentConfig): Promise<void> {
    try {
      // Validate agent configuration
      const errors = AgentUtils.validateConfig(config);
      if (errors.length > 0) {
        throw new Error(`Invalid agent config: ${errors.join(", ")}`);
      }

      // Create agent
      const agent = AgentFactory.createAgent(config);

      // Load agent prompt if available
      if (agent.mcpServerId) {
        try {
          agent.prompt = await this.mcpDriver.getPrompt(
            agent.mcpServerId,
            `agent_${agent.role}`,
            {
              state: JSON.stringify(this.currentState),
              stateNode: JSON.stringify(this.getCurrentStateNode()),
              agent: JSON.stringify(agent),
            }
          );
          logger.info(`Agent ${agent.name} now has a prompt!`);
        } catch (error: any) {
          Logger.warn(
            `Could not load prompt for agent ${agent.id} at ${agent.mcpServerId}`,
            {
              error: error.message || error,
            }
          );
        }
      }

      this.agents.set(agent.id, agent);

      this.emit(RuntimeEvent.AGENT_ADDED, { agent });
      Logger.runtime(`Agent added: ${agent.name}`, {
        agentId: agent.id,
        role: agent.role,
      });
    } catch (error) {
      const errorMessage = `Failed to add agent: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
      Logger.error(errorMessage, error as Error);
      throw error;
    }
  }

  /**
   * Remove an agent from the runtime
   */
  removeAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    this.agents.delete(agentId);
    this.emit(RuntimeEvent.AGENT_REMOVED, { agentId, agent });
    Logger.runtime(`Agent removed: ${agent.name}`, { agentId });

    return true;
  }

  /**
   * Get current state node
   */
  getCurrentStateNode(): StateNode {
    if (!this.stateGraph || !this.currentState) {
      throw new Error("Runtime not initialized");
    }

    if (!this.currentState.currentStateId) {
      return this.currentState as unknown as StateNode;
    }
    const stateNode = this.stateGraph.states[this.currentState.currentStateId];
    if (!stateNode) {
      throw new Error(
        `State node '${this.currentState.currentStateId}' not found`
      );
    }

    return stateNode || this.currentState;
  }

  /**
   * Get current state
   */
  getCurrentState(): State {
    if (!this.currentState) {
      const stateConfig: StateConfig = {
        graphId: "not-init",
        userId: "not-set",
        initialStateId: "not-set",
      };
      this.currentState = StateManager.createNew(stateConfig);
    }

    return this.currentState;
  }

  /**
   * Get available routes from current state
   */
  getAvailableRoutes(): any[] {
    const currentStateNode = this.getCurrentStateNode();
    return currentStateNode.routes || [];
  }

  /**
   * Execute a state transition
   */
  async transitionTo(
    stateId: string,
    trigger = "manual",
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Runtime not initialized");
    }

    const startTime = Date.now();
    const fromState = this.currentState!.currentStateId;

    try {
      Logger.runtime(`Attempting transition: ${fromState} → ${stateId}`, {
        trigger,
        metadata,
      });

      // Validate transition
      const isValid = await this.validateTransition(fromState, stateId);
      if (!isValid) {
        throw new Error(`Invalid transition from ${fromState} to ${stateId}`);
      }

      // Execute state transition logic
      await this.executeStateTransition(fromState, stateId, trigger, metadata);

      const executionTime = Date.now() - startTime;
      this.updateTransitionStats(executionTime);

      this.emit(RuntimeEvent.STATE_TRANSITION, {
        from: fromState,
        to: stateId,
        trigger,
        executionTime,
        metadata,
      });

      Logger.stateTransition(
        this.config.userId,
        this.config.graphId,
        fromState,
        stateId,
        trigger
      );
    } catch (error) {
      const errorMessage = `Transition failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
      Logger.error(errorMessage, error as Error, {
        from: fromState,
        to: stateId,
        trigger,
      });
      this.emit(RuntimeEvent.ERROR_OCCURRED, { error: errorMessage });
      throw error;
    }
  }

  /**
   * Execute an action through an agent
   */
  async executeAction(action: AgentAction): Promise<AgentActionResult> {
    const startTime = Date.now();

    try {
      const agent = this.agents.get(action.agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${action.agentId}`);
      }

      if (!AgentUtils.canExecuteAction(agent, action.type)) {
        throw new Error(
          `Agent ${action.agentId} cannot execute action ${action.type}`
        );
      }

      // Execute action via MCP if agent has server
      let result: any;
      if (agent.mcpServerId) {
        result = await this.mcpDriver.executeTool(
          agent.mcpServerId,
          action.type,
          {
            ...action.params,
            state: this.currentState,
            context: this.getActionContext(),
          }
        );
      } else {
        // Execute local action
        result = await this.executeLocalAction(action);
      }

      const executionTime = Date.now() - startTime;
      AgentUtils.updateStats(agent, "action");
      this.updateActionStats(executionTime);

      const actionResult: AgentActionResult = {
        actionId: action.id,
        success: true,
        result,
        executionTime,
      };

      this.emit(RuntimeEvent.ACTION_EXECUTED, {
        action,
        result: actionResult,
        agent,
      });

      Logger.runtime(`Action executed: ${action.type}`, {
        agentId: action.agentId,
        executionTime,
        success: true,
      });

      return actionResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      const actionResult: AgentActionResult = {
        actionId: action.id,
        success: false,
        error: errorMessage,
        executionTime,
      };

      Logger.error(`Action failed: ${action.type}`, error as Error, {
        agentId: action.agentId,
        executionTime,
      });

      return actionResult;
    }
  }

  /**
   * Get runtime statistics
   */
  getStatistics(): RuntimeStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get all agents
   */
  async getAgents(): Promise<Agent[]> {
    if (this.agents.size == 0 && (this.config.agentConfigs || []).length > 0) {
      await this.initializeAgents();
    }
    return Array.from(this.agents.values());
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get MCP driver instance
   */
  getMCPDriver(): IMCPDriver {
    return this.mcpDriver;
  }

  /**
   * Get chat provider instance (if available)
   */
  getChatProvider(): DEPRECATEDChatProviderLike | undefined {

    if (!this.chatProvider) {
      this.chatProvider = OllamaChatProvider.createChatProvider();
    }
    return this.chatProvider;
  }

  /**
   * Get chat provider instance (if available)
   */
  setChatProvider(provider: OllamaChatProvider): void {
    this.chatProvider = provider;
  }

  /**
   * Save current state
   */
  async saveCurrentState(): Promise<void> {
    if (!this.currentState) {
      throw new Error("No current state to save");
    }

    try {
      await this.mcpDriver.saveState(
        this.config.mcpServerId,
        this.currentState
      );
      this.stateGraph = this.stateGraph || ({} as StateGraph);
      this.stateGraph.states = this.stateGraph?.states || {};
      const key: string = this.currentState.currentStateId || "test";
      this.stateGraph.states[key] = this.currentState as unknown as StateNode;

      this.emit(RuntimeEvent.STATE_SAVED, { state: this.currentState });
      Logger.runtime("State saved successfully");
    } catch (error) {
      Logger.error("Failed to save state", error as Error);
      throw error;
    }
  }

  /**
   * Cleanup and shutdown runtime
   */
  async shutdown(): Promise<void> {
    try {
      Logger.runtime("Shutting down runtime");

      // Clear auto-save timer
      if (this.autoSaveTimer) {
        clearInterval(this.autoSaveTimer);
      }

      // Save current state
      if (this.config.autoSave && this.currentState) {
        await this.saveCurrentState();
      }

      // Deactivate all agents
      for (const agent of this.agents.values()) {
        agent.status = AgentStatus.INACTIVE;
      }

      this.emit(RuntimeEvent.SESSION_ENDED, {
        duration: this.getSessionDuration(),
        stats: this.getStatistics(),
      });

      Logger.runtime("Runtime shutdown complete");
    } catch (error) {
      Logger.error("Error during runtime shutdown", error as Error);
      throw error;
    }
  }

  // Private helper methods

  private async loadOrCreateState(): Promise<void> {
    let existingState;
    try {
      // Try to load existing state
      existingState = await this.mcpDriver.loadState(
        this.config.mcpServerId,
        this.config.graphId,
        this.config.userId
      );
    } catch (error: any) {
      console.log("Error on loadOrCreateState", error.message);
    }

    if (!existingState) {
      // Create new state
      this.currentState = StateManager.createNew({
        graphId: this.config.graphId,
        userId: this.config.userId,
        initialStateId: this.stateGraph!.initialState,
        sessionId: this.config.sessionId,
      });

      await this.saveCurrentState();

      Logger.runtime("Created new state", {
        stateId: this.currentState.id,
        initialState: this.currentState.currentStateId,
      });
    } else {
      this.currentState = { ...this.currentState, ...existingState };
      Logger.runtime("Loaded existing state", {
        stateId: this.currentState?.id,
        currentState: this.currentState?.currentStateId,
        transitionsCount: this.currentState?.history?.length || 0,
      });
    }

    this.emit(RuntimeEvent.STATE_LOADED, {
      state: JSON.parse(JSON.stringify(this.currentState)),
    });
  }

  private async validateTransition(
    fromState: string,
    toState: string
  ): Promise<boolean> {
    const currentStateNode = this.getCurrentStateNode();
    const validRoute = currentStateNode.routes?.find(
      (route: any) => route.target === toState
    );

    if (!validRoute) {
      return false;
    }

    // Check conditional logic if present
    if (validRoute.condition) {
      try {
        const conditionResult = await this.mcpDriver.executeTool(
          this.config.mcpServerId,
          "evaluate_condition",
          {
            condition: validRoute.condition,
            state: this.currentState,
            context: this.getTransitionContext(),
          }
        );
        return conditionResult.result === true;
      } catch (error) {
        Logger.warn("Error evaluating transition condition", { error });
        return false;
      }
    }

    return true;
  }

  private async executeStateTransition(
    fromState: string,
    toState: string,
    trigger: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Execute onExit actions
    const currentNode = this.getCurrentStateNode();
    if (currentNode.onExit) {
      await this.executeStateActions(currentNode.onExit, "exit");
    }

    // Record transition
    StateManager.recordTransition(
      this.currentState!,
      fromState,
      toState,
      trigger,
      undefined,
      metadata
    );

    // Execute onEnter actions
    const newNode = this.stateGraph!.states[toState];
    if (newNode?.onEnter) {
      await this.executeStateActions(newNode.onEnter, "enter");
    }

    // Auto-save if enabled
    if (this.config.autoSave) {
      await this.saveCurrentState();
    }
  }

  private async executeStateActions(
    actions: string[],
    phase: "enter" | "exit"
  ): Promise<void> {
    for (const action of actions) {
      try {
        await this.mcpDriver.executeTool(
          this.config.mcpServerId,
          "execute_action",
          {
            action,
            phase,
            state: this.currentState,
            context: this.getTransitionContext(),
          }
        );
      } catch (error) {
        Logger.warn(`Error executing ${phase} action: ${action}`, {
          error,
        });
      }
    }
  }

  private async executeLocalAction(action: AgentAction): Promise<any> {
    // Implement local action execution logic here
    // For now, return a simple acknowledgment
    return {
      message: `Local action ${action.type} executed`,
      params: action.params,
    };
  }

  private getTransitionContext(): Record<string, any> {
    return {
      currentState: this.currentState,
      stateGraph: this.stateGraph,
      agents: Array.from(this.agents.values()),
      timestamp: Date.now(),
      sessionDuration: this.getSessionDuration(),
    };
  }

  private getActionContext(): Record<string, any> {
    return {
      ...this.getTransitionContext(),
      availableRoutes: this.getAvailableRoutes(),
    };
  }

  private getSessionDuration(): number {
    return this.sessionStartTime > 0 ? Date.now() - this.sessionStartTime : 0;
  }

  private setupAutoSave(): void {
    this.autoSaveTimer = setInterval(async () => {
      try {
        await this.saveCurrentState();
      } catch (error) {
        Logger.error("Auto-save failed", error as Error);
      }
    }, this.config.autoSaveInterval);
  }

  private setupEventHandlers(): void {
    this.on("error", (error) => {
      Logger.error("Runtime error", error);
    });
  }

  private initializeStats(): RuntimeStats {
    return {
      sessionStartTime: 0,
      sessionDuration: 0,
      transitionsCount: 0,
      actionsExecuted: 0,
      activeAgents: 0,
      currentState: {
        id: "",
        name: "",
        timeInState: 0,
      },
      performance: {
        averageTransitionTime: 0,
        averageActionTime: 0,
        errorRate: 0,
      },
    };
  }

  private updateStats(): void {
    this.stats.sessionDuration = this.getSessionDuration();
    this.stats.activeAgents = Array.from(this.agents.values()).filter(
      (agent) => agent.status === AgentStatus.ACTIVE
    ).length;

    if (this.currentState) {
      const currentNode = this.getCurrentStateNode();
      this.stats.currentState = {
        id: this.currentState.currentStateId,
        name: currentNode.name,
        timeInState: Date.now() - this.currentState.timestamp,
      };
    }
  }

  private updateTransitionStats(executionTime: number): void {
    this.stats.transitionsCount++;
    this.stats.performance.averageTransitionTime =
      (this.stats.performance.averageTransitionTime *
        (this.stats.transitionsCount - 1) +
        executionTime) /
      this.stats.transitionsCount;
  }

  private updateActionStats(executionTime: number): void {
    this.stats.actionsExecuted++;
    this.stats.performance.averageActionTime =
      (this.stats.performance.averageActionTime *
        (this.stats.actionsExecuted - 1) +
        executionTime) /
      this.stats.actionsExecuted;
  }
}
