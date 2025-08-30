/**
 * State Machine MCP Driver - Example Usage
 */

import {
    Runtime,
    RuntimeConfig,
    MCPDriver,
    AgentRole,
    logger
} from "../src";

/**
 * Example: Basic Runtime usage
 */
async function basicRuntimeExample(): Promise<void> {
    try {
        logger.info("Starting basic runtime example");

        // Create MCP driver
        const mcpDriver = new MCPDriver();

        // Add MCP server for story operations
        mcpDriver.addServer({
            id: "story-server",
            name: "Story MCP Server",
            url: "http://localhost:3001",
            apiKey: "test-key",
        });

        // Runtime configuration
        const config: RuntimeConfig = {
            mcpServerId: "story-server",
            graphId: "adventure-game",
            userId: "player-123",
            sessionId: "session-456",
            maxMessagesPerThread: 50,
            autoSave: true,
            autoSaveInterval: 30000,
            agentConfigs: [
                {
                    id: "narrator",
                    name: "Game Narrator",
                    role: AgentRole.NARRATOR,
                    mcpServerId: "story-server",
                    config: {
                        maxActionsPerMinute: 10,
                        allowedActions: ["narrate", "describe", "set_scene"],
                    },
                },
                {
                    id: "guide",
                    name: "Player Guide",
                    role: AgentRole.GUIDE,
                    mcpServerId: "story-server",
                    config: {
                        maxActionsPerMinute: 5,
                        allowedActions: ["suggest", "help", "clarify"],
                    },
                },
            ],
        };

        // Create and initialize runtime
        const runtime = new Runtime(mcpDriver, config);

        // Set up event listeners
        runtime.on("initialized", (data) => {
            logger.info("Runtime initialized", data);
        });

        runtime.on("stateTransition", (data) => {
            logger.info("State transition occurred", {
                from: data.from,
                to: data.to,
                trigger: data.trigger,
            });
        });

        runtime.on("agentAdded", (data) => {
            logger.info("Agent added", {
                agentId: data.agent.id,
                role: data.agent.role,
            });
        });

        runtime.on("actionExecuted", (data) => {
            logger.info("Action executed", {
                action: data.action.type,
                agent: data.agent.name,
                success: data.result.success,
            });
        });

        // Initialize the runtime
        await runtime.initialize();

        // Example: Execute state transition
        await runtime.transitionTo("forest_entrance", "player_choice", {
            choice: "explore_forest",
            playerInput: "I want to explore the mysterious forest",
        });

        // Example: Execute agent action
        const narratorAgent = runtime.getAgent("narrator");
        if (narratorAgent) {
            const actionResult = await runtime.executeAction({
                id: "action-001",
                agentId: "narrator",
                type: "narrate",
                params: {
                    scene: "forest_entrance",
                    tone: "mysterious",
                    elements: [
                        "ancient trees",
                        "glowing mushrooms",
                        "distant sounds",
                    ],
                },
                timestamp: Date.now(),
            });

            logger.info("Narration result", {
                success: actionResult.success,
                result: actionResult.result,
            });
        }

        // Get runtime statistics
        const stats = runtime.getStatistics();
        logger.info("Runtime statistics", {
            sessionDuration: stats.sessionDuration,
            transitionsCount: stats.transitionsCount,
            activeAgents: stats.activeAgents,
            currentState: stats.currentState.name,
        });

        // Example: Get available routes from current state
        const availableRoutes = runtime.getAvailableRoutes();
        logger.info("Available routes", {
            routeCount: availableRoutes.length,
            routes: availableRoutes.map((route) => ({
                target: route.target,
                trigger: route.trigger,
                hasCondition: !!route.condition,
            })),
        });

        // Save current state manually
        await runtime.saveCurrentState();
        logger.info("State saved successfully");

        // Cleanup
        await runtime.shutdown();
        logger.info("Runtime shut down gracefully");
    } catch (error) {
        logger.error("Error in basic runtime example", error as Error);
        throw error;
    }
}

/**
 * Example: Advanced Runtime with multiple agents
 */
async function advancedRuntimeExample(): Promise<void> {
    try {
        logger.info("Starting advanced runtime example");

        // Create MCP driver
        const mcpDriver = new MCPDriver();

        // Add multiple MCP servers
        mcpDriver.addServer({
            id: "story-server",
            name: "Story MCP Server",
            url: "http://localhost:3001",
            apiKey: "story-key",
        });

        mcpDriver.addServer({
            id: "game-mechanics",
            name: "Game Mechanics Server",
            url: "http://localhost:3002",
            apiKey: "game-key",
        });

        // Advanced runtime configuration
        const config: RuntimeConfig = {
            mcpServerId: "story-server",
            graphId: "rpg-campaign",
            userId: "player-456",
            sessionId: "campaign-789",
            maxMessagesPerThread: 100,
            sessionTimeout: 7200000, // 2 hours
            autoSave: true,
            autoSaveInterval: 15000, // 15 seconds
            agentConfigs: [
                {
                    id: "dm",
                    name: "Dungeon Master",
                    role: AgentRole.NARRATOR,
                    mcpServerId: "story-server",
                    config: {
                        maxActionsPerMinute: 20,
                        allowedActions: [
                            "narrate",
                            "describe",
                            "set_scene",
                            "control_npc",
                            "trigger_event",
                        ],
                    },
                },
                {
                    id: "combat-manager",
                    name: "Combat Manager",
                    role: AgentRole.SYSTEM,
                    mcpServerId: "game-mechanics",
                    config: {
                        maxActionsPerMinute: 30,
                        allowedActions: [
                            "roll_dice",
                            "calculate_damage",
                            "apply_effects",
                            "check_conditions",
                        ],
                    },
                },
                {
                    id: "player-assistant",
                    name: "Player Assistant",
                    role: AgentRole.GUIDE,
                    mcpServerId: "story-server",
                    config: {
                        maxActionsPerMinute: 15,
                        allowedActions: [
                            "suggest_action",
                            "explain_rule",
                            "provide_hint",
                            "show_inventory",
                        ],
                    },
                },
            ],
        };

        // Create runtime
        const runtime = new Runtime(mcpDriver, config);

        // Enhanced event handling
        runtime.on("initialized", async (data) => {
            logger.info("Advanced runtime initialized", data);

            // Perform initial setup actions
            const dmAgent = runtime.getAgent("dm");
            if (dmAgent) {
                await runtime.executeAction({
                    id: "init-001",
                    agentId: "dm",
                    type: "set_scene",
                    params: {
                        location: "tavern",
                        atmosphere: "bustling evening",
                        npcs: [
                            "bartender",
                            "mysterious_stranger",
                            "local_merchant",
                        ],
                    },
                    timestamp: Date.now(),
                });
            }
        });

        runtime.on("stateTransition", async (data) => {
            logger.info("State transition in advanced runtime", data);

            // Trigger automatic narration on state changes
            const dmAgent = runtime.getAgent("dm");
            if (dmAgent && data.trigger !== "auto_narration") {
                setTimeout(async () => {
                    await runtime.executeAction({
                        id: `auto-narration-${Date.now()}`,
                        agentId: "dm",
                        type: "narrate",
                        params: {
                            context: "state_transition",
                            newState: data.to,
                            previousState: data.from,
                        },
                        timestamp: Date.now(),
                    });
                }, 1000);
            }
        });

        runtime.on("errorOccurred", (data) => {
            logger.error("Runtime error occurred", { error: data.error });

            // Could implement recovery logic here
            // For example, attempt to reload last known good state
        });

        // Initialize the runtime
        await runtime.initialize();

        // Simulate a complex scenario with multiple agent interactions
        logger.info("Simulating complex agent interactions");

        // DM sets up an encounter
        await runtime.executeAction({
            id: "encounter-setup",
            agentId: "dm",
            type: "trigger_event",
            params: {
                eventType: "combat_encounter",
                enemies: ["goblin", "goblin", "hobgoblin"],
                location: "forest_clearing",
            },
            timestamp: Date.now(),
        });

        // Transition to combat state
        await runtime.transitionTo("combat", "event_triggered", {
            eventType: "combat_encounter",
            participants: ["player", "goblin_1", "goblin_2", "hobgoblin"],
        });

        // Combat manager handles dice rolls
        await runtime.executeAction({
            id: "initiative-roll",
            agentId: "combat-manager",
            type: "roll_dice",
            params: {
                diceType: "d20",
                modifier: 2,
                purpose: "initiative",
            },
            timestamp: Date.now(),
        });

        // Player assistant provides guidance
        await runtime.executeAction({
            id: "combat-advice",
            agentId: "player-assistant",
            type: "suggest_action",
            params: {
                context: "combat_start",
                suggestions: ["attack", "cast_spell", "use_item", "take_cover"],
            },
            timestamp: Date.now(),
        });

        // Simulate player action and resolution
        await runtime.transitionTo("combat_resolution", "player_action", {
            action: "attack",
            target: "goblin_1",
            weapon: "sword",
        });

        // Get comprehensive runtime statistics
        const finalStats = runtime.getStatistics();
        logger.info("Final runtime statistics", {
            sessionDuration: finalStats.sessionDuration,
            transitionsCount: finalStats.transitionsCount,
            actionsExecuted: finalStats.actionsExecuted,
            activeAgents: finalStats.activeAgents,
            currentState: finalStats.currentState,
            performance: finalStats.performance,
        });

        // List all agents and their status
        const agents = runtime.getAgents();
        logger.info("Agent status summary", {
            agents: agents.map((agent) => ({
                id: agent.id,
                name: agent.name,
                role: agent.role,
                status: agent.status,
                actionsExecuted: agent.stats.actionsExecuted,
                lastActivity: agent.stats.lastActivity,
            })),
        });

        // Graceful shutdown
        await runtime.shutdown();
        logger.info("Advanced runtime example completed successfully");
    } catch (error) {
        logger.error("Error in advanced runtime example", error as Error);
        throw error;
    }
}

/**
 * Run examples
 */
async function runExamples(): Promise<void> {
    try {
        logger.info("Starting Runtime Engine examples");

        // Run basic example
        await basicRuntimeExample();

        // Wait a moment between examples
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Run advanced example
        await advancedRuntimeExample();

        logger.info("All runtime examples completed successfully");
    } catch (error) {
        logger.error("Error running runtime examples", error as Error);
        process.exit(1);
    }
}

// Export for use in other files
export { basicRuntimeExample, advancedRuntimeExample, runExamples };

// Run examples if this file is executed directly
if (require.main === module) {
    runExamples();
}
