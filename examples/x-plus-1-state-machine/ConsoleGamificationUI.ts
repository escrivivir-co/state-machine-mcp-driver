/**
 * X+1 Game Console Interface (Example)
 *
 * Refactored to EXTEND the reusable src UI component and use the modular
 * postulation system for agent selection.
 */
import {
    ConsoleGamificationUI,
    ConsoleUIConfig,
    ConsoleUIEvent,
} from "../../src/ui";
import { Runtime } from "../../src/runtime/Runtime";
import { MCPDriverAdapter } from "../../src/drivers/MCPDriverAdapter";
import { AgentStatus } from "../../src/models/Agent";
import {
    AgentPostulation,
    AgentGreediness,
} from "../../src/models/AgentPostulation";
import {
    integrateToolsWithChat,
    createToolContext,
} from "../../src/chat-provider/mcpTools";
import {
    GAME_CONFIG,
    MESSAGE_TEMPLATES,
} from "../xplus1-app/xplus1-game";
import { OllamaChatProvider } from "../../src/chat-provider/OllamaChatProvider";
import { XPlus1PostulationSystem } from "./XPlus1PostulationSystem";
import { getBasicRuntimeConfig } from "./xplus1-game";
import { AppConfig } from "@/utils";

// Remote control interfaces (matching XPlus1MCPMachine)
interface RemoteCommand {
    type:
        | "user_input"
        | "select_agent"
        | "answer_question"
        | "toggle_simulator";
    payload: any;
    timestamp: number;
    id: string;
}

type GamePhase = "start" | "conversation" | "decision" | "advancement" | "end";

/**
 * WARNING DON'T USE OR SET AS HIGH AS POSSIBLE
 */
const POLLING_INTERVAL_MS = 1000 * 60; // Polling interval for remote commands

export class DEPRECATEDXPlus1GameConsole extends ConsoleGamificationUI {
    private runtimeInstance: Runtime;
    private mcpDriver: MCPDriverAdapter;
    private chatProvider: OllamaChatProvider;
    private postulationSystem: XPlus1PostulationSystem;

    private gameState = {
        x: 0,
        messageCount: 0,
        isActive: false,
        currentPhase: "start" as GamePhase,
        turnHistory: [] as Array<{
            turn: number;
            x: number;
            advance: number;
            timestamp: number;
        }>,
        simulateUser: true,
    };

    // Track MCP synchronization
    private mcpSyncEnabled = true;

    // Remote control properties
    private remoteControlEnabled = false;
    private commandCheckInterval: NodeJS.Timeout | null = null;

    private constructor(
        runtime: Runtime,
        mcp: MCPDriverAdapter,
        chat: OllamaChatProvider,
        uiConfig: ConsoleUIConfig
    ) {
        super(runtime, uiConfig);

        console.log("🎮 Initializing X+1 Game Console UI... 111");
        if (runtime.initialize === undefined) {
            console.log("🎮 Initializing X+1 Game Console UI... 222");
            this.runtimeInstance = new Runtime();       
        } else {
            console.log("🎮 Initializing X+1 Game Console UI... 3333")
            this.runtimeInstance = runtime;
        }
        console.log("🎮 Initializing X+1 Game Console UI... 444")
            
        this.mcpDriver = mcp;
        this.chatProvider = chat;

        // Initialize X+1 postulation system
        this.postulationSystem = new XPlus1PostulationSystem();
        this.setPostulationManager(this.postulationSystem.getManager());

        this.setupX1EventHandlers();
    }

    // === REMOTE CONTROL METHODS ===

    /**
     * Enable remote control mode and start command polling
     */
    public enableRemoteControl(): void {
        this.remoteControlEnabled = true;
        this.startCommandPolling();
        console.log("🎮 Remote control enabled");
    }

    /**
     * Disable remote control mode and stop command polling
     */
    public disableRemoteControl(): void {
        this.remoteControlEnabled = false;
        this.stopCommandPolling();
        console.log("🎮 Remote control disabled");
    }

    /**
     * Start polling for remote commands from MCP server
     */
    private startCommandPolling(): void {
        if (this.commandCheckInterval) {
            clearInterval(this.commandCheckInterval);
        }

        this.commandCheckInterval = setInterval(async () => {
            if (this.remoteControlEnabled) {
                await this.checkForRemoteCommands();
            }
        }, POLLING_INTERVAL_MS); // Check every
    }

    /**
     * Stop command polling
     */
    private stopCommandPolling(): void {
        if (this.commandCheckInterval) {
            clearInterval(this.commandCheckInterval);
            this.commandCheckInterval = null;
        }
    }

    /**
     * Check for and process remote commands from MCP server
     */
    private async checkForRemoteCommands(): Promise<void> {
        try {
            // Try to get and process the next command directly
            await this.processNextRemoteCommand();
        } catch (error) {
            // Silently ignore errors to avoid spam - this runs every 500ms
            // console.error('❌ Error checking remote commands:', error);
        }
    }

    /**
     * Process the next remote command
     */
    private async processNextRemoteCommand(): Promise<void> {
        try {
            // For now, we'll use a custom tool to get and process the next command
            // This would require adding a "get_next_command" tool to XPlus1MCPMachine
            const command = await this.getNextRemoteCommand();
            if (command) {
                await this.handleRemoteCommand(command);
            }
        } catch (error) {
            console.error("❌ Error processing remote command:", error);
        }
    }

    /**
     * Get next remote command (placeholder for actual implementation)
     */
    private async getNextRemoteCommand(): Promise<RemoteCommand | null> {
        try {
            // Use the existing MCP tool to get next command
            const result = await this.mcpDriver.executeTool(
                "xplus1-mcp-machine",
                "get_next_command",
                {}
            );
            if (result?.content?.[0]?.text) {
                const response = JSON.parse(result.content[0].text);
                if (response.success && response.command) {
                    return response.command;
                }
            }
        } catch (error) {
            console.error("❌ Error getting next remote command:", error);
        }
        return null;
    }

    /**
     * Handle a remote command
     */
    public async handleRemoteCommand(command: RemoteCommand): Promise<void> {
        console.log(
            `🎮 Processing remote command: ${command.type}`,
            command.payload
        );

        switch (command.type) {
            case "user_input":
                await this.simulateUserInput(command.payload.text);
                break;

            case "select_agent":
                await this.selectAgentById(
                    command.payload.agentId,
                    command.payload.reason
                );
                break;

            case "answer_question":
                await this.answerCriticalQuestion(
                    command.payload.answer,
                    command.payload.reasoning
                );
                break;

            case "toggle_simulator":
                this.toggleSimulatorMode(command.payload.mode);
                break;

            default:
                console.warn(`⚠️ Unknown remote command type: ${command.type}`);
        }

        // Publish event back to MCP server
        await this.publishEventToMCP({
            type: "command_processed",
            data: { commandId: command.id, type: command.type },
            timestamp: Date.now(),
        });
    }

    /**
     * Simulate user input as if typed by the user
     */
    private async simulateUserInput(text: string): Promise<void> {
        console.log(`🎮 Simulating user input: "${text}"`);

        // Add typing simulation if requested
        await this.onUserInput(text);

        // Update conversation in MCP server
        await this.updateMCPConversation({
            id: `msg_${Date.now()}`,
            sender: "user",
            message: text,
        });
    }

    /**
     * Select agent by ID
     */
    private async selectAgentById(
        agentId: string,
        reason?: string
    ): Promise<void> {
        console.log(`🎮 Selecting agent: ${agentId} (reason: ${reason})`);

        // For now, we'll log the selection and try to trigger agent selection
        // This would need to be connected to the actual postulation system
        console.log(`🎮 Remote agent selection: ${agentId} (${reason})`);

        // Update MCP server with agent selection
        await this.publishEventToMCP({
            type: "agent_selected",
            data: { agentId, reason },
            timestamp: Date.now(),
        });
    }

    /**
     * Answer critical question
     */
    private async answerCriticalQuestion(
        answer: "yes" | "no",
        reasoning?: string
    ): Promise<void> {
        console.log(
            `🎮 Answering critical question: ${answer} (reasoning: ${reasoning})`
        );

        if (this.gameState.currentPhase === "decision") {
            await this.handleDecisionPhase(answer);
        } else {
            console.warn(
                "⚠️ Not in decision phase, cannot answer critical question"
            );
        }
    }

    /**
     * Toggle simulator mode
     */
    private toggleSimulatorMode(mode?: "on" | "off" | "toggle"): void {
        if (mode === "on") {
            this.gameState.simulateUser = true;
        } else if (mode === "off") {
            this.gameState.simulateUser = false;
        } else {
            this.gameState.simulateUser = !this.gameState.simulateUser;
        }

        console.log(
            `🎮 Simulator mode: ${this.gameState.simulateUser ? "ON" : "OFF"}`
        );
    }

    /**
     * Publish event to MCP server
     */
    private async publishEventToMCP(event: any): Promise<void> {
        try {
            // This would require adding a "publish_event" tool to XPlus1MCPMachine
            // For now, just log the event
            console.log("📡 Publishing event to MCP:", event);
        } catch (error) {
            console.error("❌ Error publishing event to MCP:", error);
        }
    }

    /**
     * Update conversation in MCP server
     */
    private async updateMCPConversation(message: {
        id: string;
        sender: string;
        message: string;
    }): Promise<void> {
        try {
            // This would call XPlus1MCPMachine's updateConversation method
            // For now, just log
            console.log("📡 Updating MCP conversation:", message);
        } catch (error) {
            console.error("❌ Error updating MCP conversation:", error);
        }
    }

    /**
     * Synchronize local game state with XPlus1MCPMachine state
     */
    private async syncWithMCPState(): Promise<void> {
        if (!this.mcpSyncEnabled) return;

        try {
            // Get current state from MCP server
            const result = await this.mcpDriver.executeTool(
                "xplus1-mcp-machine",
                "get_x_status",
                {}
            );
            if (result?.content?.[0]?.text) {
                const mcpState = JSON.parse(result.content[0].text);

                // Update local state to match MCP state
                const oldX = this.gameState.x;
                this.gameState.x = mcpState.currentX || 0;

                if (oldX !== this.gameState.x) {
                    console.log(
                        `🔄 State synchronized: X = ${this.gameState.x} (was ${oldX})`
                    );
                }
            }
        } catch (error) {
            console.error("⚠️ Failed to sync with MCP state:", error);
            // Disable sync temporarily on errors
            this.mcpSyncEnabled = false;
            setTimeout(() => {
                this.mcpSyncEnabled = true;
            }, 5000);
        }
    }

    /**
     * Advance X using MCP server instead of local state
     */
    private async advanceXViaMCP(reason: string): Promise<boolean> {
        try {
            const result = await this.mcpDriver.executeTool(
                "xplus1-mcp-machine",
                "advance_x",
                { reason }
            );
            if (result?.content?.[0]?.text) {
                const response = JSON.parse(result.content[0].text);
                if (response.success) {
                    this.gameState.x = response.newValue;
                    console.log(`✅ ${response.message} (Reason: ${reason})`);
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error("❌ Failed to advance X via MCP:", error);
            return false;
        }
    }

    /**
     * Reset X using MCP server instead of local state
     */
    private async resetXViaMCP(reason: string): Promise<boolean> {
        try {
            const result = await this.mcpDriver.executeTool(
                "xplus1-mcp-machine",
                "reset_x",
                { reason }
            );
            if (result?.content?.[0]?.text) {
                const response = JSON.parse(result.content[0].text);
                if (response.success) {
                    this.gameState.x = response.newValue;
                    console.log(`🔄 ${response.message} (Reason: ${reason})`);
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error("❌ Failed to reset X via MCP:", error);
            return false;
        }
    }

    /**
     * Factory to build the game console with async setup (MCP servers, runtime, chat provider)
     */
    static async create(): Promise<DEPRECATEDXPlus1GameConsole> {
        // MCP driver and servers with native protocol support
        const mcpDriver = new MCPDriverAdapter();

        // Configure MCP servers
        await mcpDriver.addServer({
            id: "xplus1-mcp-machine",
            name: "X+1 MCP Machine",
            url: process.env.MCP_XPLUS1_URL || "http://localhost:3001",
            timeout: 5000,
        });

        await mcpDriver.addServer({
            id: "wiki-mcp-browser",
            name: "Wiki MCP Browser",
            url: process.env.MCP_WIKI_URL || "http://localhost:3002",
            timeout: 5000,
        });

        // Chat provider with MCP integration
        const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
        const defaultModel = process.env.OLLAMA_MODEL || "GPT-OSS:20b";
        const chatProvider = new OllamaChatProvider({
            baseUrl: ollamaUrl,
            defaultModel,
            defaultTemperature: 0.7,
            defaultMaxTokens: 150,
            enableMCP: true,
        }); // MCPDriverAdapter is not required as a second parameter

        const runtimeConfig = await getBasicRuntimeConfig({} as AppConfig);

        const runtime = new Runtime(mcpDriver, runtimeConfig, chatProvider);

        const uiConfig: ConsoleUIConfig = {
            maxMessagesPerThread: GAME_CONFIG.MAX_MESSAGES_THREAD,
            gameTitle: "X+1 Inductive Pattern Game",
            welcomeMessage: MESSAGE_TEMPLATES.gameStart,
            userPrompt: "> ",
            enableColors: true,
            debugMode: false,
            enablePostulations: true,
            autoSelectSingleAgent: false, // Let user choose even with single agent
        };

        return new DEPRECATEDXPlus1GameConsole(
            runtime,
            mcpDriver,
            chatProvider,
            uiConfig
        );
    }

    /**
     * Setup X+1 specific event handlers
     */
    private setupX1EventHandlers(): void {
        // Handle user input for game commands
        this.on(ConsoleUIEvent.USER_INPUT, async ({ input }) => {
            await this.onUserInput(input);
        });

        // Handle agent selection events
        this.on(
            ConsoleUIEvent.AGENT_SELECTED,
            async ({ postulation, autoSelected }) => {
                await this.handleAgentSelected(postulation, autoSelected);
            }
        );

        // Register X+1 specific commands
        this.registerGameCommand("quit", async () => await this.stop());
        this.registerGameCommand(
            "sim",
            async (input) => await this.handleSimulatorCommand(input)
        );

        // MCP sync commands
        this.registerGameCommand("mcp-sync", async () => {
            await this.syncWithMCPState();
            console.log("🔄 MCP state synchronized");
        });

        this.registerGameCommand("mcp-status", async () => {
            try {
                const result = await this.mcpDriver.executeTool(
                    "xplus1-mcp-machine",
                    "get_x_status",
                    {}
                );
                if (result?.content?.[0]?.text) {
                    const status = JSON.parse(result.content[0].text);
                    console.log("📊 MCP Server Status:", status);
                }
            } catch (error) {
                console.error("❌ Failed to get MCP status:", error);
            }
        });

        this.registerGameCommand("mcp-advance", async (reason) => {
            const success = await this.advanceXViaMCP(
                reason || "Manual advance command"
            );
            if (!success) console.log("❌ Failed to advance X via MCP");
        });

        this.registerGameCommand("mcp-reset", async (reason) => {
            const success = await this.resetXViaMCP(
                reason || "Manual reset command"
            );
            if (!success) console.log("❌ Failed to reset X via MCP");
        });
    }

    /**
     * Start the X+1 game, initializing runtime then delegating to base UI start
     */
    async start(): Promise<void> {
        // Initialize runtime first so base UI can show state/agents
        await this.runtimeInstance?.initialize();

        // Synchronize with MCP state on startup
        await this.syncWithMCPState();

        // Determine simulation mode from agent status and persist in state
        const simAgent = this.runtimeInstance.getAgent("user-simulator");
        const simEnabled = simAgent?.status === AgentStatus.ACTIVE;
        this.gameState.simulateUser = !!simEnabled;
        try {
            const st = this.runtimeInstance.getCurrentState();
            st.gameData.flags = st.gameData.flags || {};
            st.gameData.flags["userSimulatorEnabled"] =
                this.gameState.simulateUser;
            await this.runtimeInstance.saveCurrentState();
        } catch {}

        // Start base console UI (welcome, input loop, threads)
        await super.start();

        // CREATE INITIAL THREAD - Ensure we have an active conversation thread
        if (!this.getCurrentThread()) {
            console.log("📢 Creating initial conversation thread...");
            await this.startNewThread();
        }

        // Enable remote control for MCP command processing
        this.enableRemoteControl();

        // Game intro
        // Note: base UI handles prompts and threads; we only print game context here
        this.gameState.isActive = true;
        this.gameState.currentPhase = "start";
        console.log(
            MESSAGE_TEMPLATES.turnStart(
                this.gameState.x,
                this.gameState.messageCount
            )
        );
        console.log(
            '\nType "help" for commands, or start conversing with the agents...'
        );

        // DIRECT APPROACH: Force postulations display immediately
        console.log("\n🎭 Agents ready to participate:");

        // Add small delay to ensure agents are fully loaded
        setTimeout(async () => {
            console.log("DEBUG: About to call forceDisplayPostulations...");
            await this.forceDisplayPostulations();
        }, 500);
    }

    /**
     * Request next agent selection using postulation system
     */
    private async requestNextAgent(): Promise<void> {
        if (
            !this.gameState.isActive ||
            this.gameState.currentPhase === "decision"
        ) {
            return;
        }

        // Ensure we have an active thread before requesting agents
        if (
            !this.getCurrentThread() ||
            this.getCurrentThread()?.status !== "active"
        ) {
            console.log("📢 Creating conversation thread...");
            await this.startNewThread();
        }

        const context = this.postulationSystem.generateContext(
            this.gameState.messageCount,
            GAME_CONFIG.MAX_MESSAGES_THREAD,
            {
                x: this.gameState.x,
                flags: { userSimulatorEnabled: this.gameState.simulateUser },
            },
            undefined, // lastMessage
            false, // needsExplanation
            false // needsSupport
        );

        await this.requestAgentSelection(
            this.generateAgentPostulations(context)
        );
    }

    /**
     * Handle when an agent is selected from postulations
     */
    private async handleAgentSelected(
        postulation: AgentPostulation,
        autoSelected: boolean
    ): Promise<void> {
        const agent = postulation.agent;

        // Ensure we have an active thread
        if (
            !this.getCurrentThread() ||
            this.getCurrentThread()?.status !== "active"
        ) {
            console.log(
                "🎬 Creating new conversation thread for agent message..."
            );
            await this.startNewThread();
        }

        // Generate agent message (in real implementation, this would trigger chat provider)
        const agentMessage = await this.generateAgentMessage(
            agent.id,
            postulation
        );

        // Use enhanced base method for sending message with postulation context
        await this.sendAgentMessageWithPostulation(
            agent.id,
            agentMessage,
            postulation,
            autoSelected
        );

        this.gameState.messageCount++;

        // Check if we should move to decision phase
        if (agent.id === "justice-bot" && this.shouldEnterDecisionPhase()) {
            this.gameState.currentPhase = "decision";
            console.log("\n⚖️ JusticeBot: Did you consume today, do I reset?");
            console.log('(Answer with "yes" or "no")');
        } else if (
            this.gameState.messageCount < GAME_CONFIG.MAX_MESSAGES_THREAD
        ) {
            // Request next agent
            setTimeout(() => this.requestNextAgent(), 1000);
        }
    }

    /**
     * Generate a real agent message using chat provider with MCP tools
     */
    private async generateAgentMessage(
        agentId: string,
        postulation: AgentPostulation
    ): Promise<string> {
        try {
            // Check if we have a runtime with necessary components
            if (!this.runtimeInstance) {
                console.log("⚠️  Runtime not available, using fallback");
                return this.generateFallbackMessage(agentId, postulation);
            }

            // Get current game context
            const currentState = this.runtimeInstance.getCurrentState();
            const gameContext = {
                currentX:
                    currentState?.gameData?.variables?.x ||
                    this.gameState.x ||
                    0,
                messagesRemaining:
                    GAME_CONFIG.MAX_MESSAGES_THREAD -
                    this.gameState.messageCount,
                lastAgentSpoke:
                    this.getCurrentThread()?.messages[
                        this.getCurrentThread()!.messages.length - 1
                    ]?.agentId,
                threadId: this.getCurrentThread()?.id,
                postulationReason: postulation.reason,
            };

            // Use MCP tools integration to generate message with Wikipedia context
            const toolContext = createToolContext(
                this.getMCPToolsForAgent(agentId),
                gameContext
            );

            // Build the actual message using integrated tools and chat
            const enhancedMessage = await integrateToolsWithChat(
                this.runtimeInstance,
                {
                    agentId,
                    context: gameContext,
                    personality: this.getAgentPersonality(agentId),
                    objective: this.getAgentObjective(agentId, postulation),
                    toolSuggestions: this.getToolSuggestionsForAgent(agentId),
                },
                toolContext
            );

            return (
                enhancedMessage ||
                this.generateFallbackMessage(agentId, postulation)
            );
        } catch (error) {
            console.error(
                `❌ Error generating agent message for ${agentId}:`,
                error
            );
            return this.generateFallbackMessage(agentId, postulation);
        }
    }

    /**
     * Get MCP tools configuration for each agent
     */
    private getMCPToolsForAgent(agentId: string): string[] {
        const toolMappings = {
            "dionisio-bot": [
                "search_wikipedia",
                "get_random_article",
                "get_x_status",
            ], // Added X+1 awareness
            "apolo-bot": [
                "search_wikipedia",
                "load_wikipedia_article",
                "get_article_categories",
                "get_x_status",
            ], // Added X+1 awareness
            "justice-bot": [
                "get_x_status",
                "evaluate_advancement",
                "advance_x",
                "reset_x",
            ], // X+1 focused tools
            "user-simulator": ["get_x_status"], // Basic X+1 awareness
        };

        return toolMappings[agentId as keyof typeof toolMappings] || [];
    }

    /**
     * Get agent personality description
     */
    private getAgentPersonality(agentId: string): string {
        const personalities = {
            "dionisio-bot":
                "hedonistic, pleasure-seeking, spontaneous, cosmic wisdom seeker",
            "apolo-bot":
                "disciplined, wise, philosophical, historically informed",
            "justice-bot":
                "impartial, analytical, truth-seeking, decision-focused",
            "user-simulator": "neutral, responsive, adaptive",
        };

        return (
            personalities[agentId as keyof typeof personalities] || "neutral"
        );
    }

    /**
     * Get tool usage suggestions based on agent and context
     */
    private getToolSuggestionsForAgent(agentId: string): any {
        const suggestions = {
            "dionisio-bot": {
                search_terms: [
                    "pleasure",
                    "hedonism",
                    "wine",
                    "dionysus",
                    "festival",
                    "celebration",
                ],
                article_preferences: ["philosophy", "mythology", "culture"],
                strategy: "random_discovery", // Use get_random_article more
                x_usage: "Check current X value to contextualize temptations",
            },
            "apolo-bot": {
                search_terms: [
                    "discipline",
                    "stoicism",
                    "apollo",
                    "philosophy",
                    "wisdom",
                    "virtue",
                ],
                article_preferences: ["philosophy", "ethics", "history"],
                strategy: "targeted_search", // Use search_wikipedia with specific terms
                x_usage: "Reference X status to encourage continued progress",
            },
            "justice-bot": {
                search_terms: [
                    "justice",
                    "ethics",
                    "moral philosophy",
                    "decision",
                    "judgment",
                ],
                article_preferences: ["philosophy", "law", "ethics"],
                strategy: "decision_making", // Focus on X+1 tools
                x_usage:
                    "Use evaluate_advancement, advance_x, reset_x tools for game mechanics",
            },
        };

        return suggestions[agentId as keyof typeof suggestions] || {};
    }

    /**
     * Get agent objective based on current game state and postulation
     */
    private getAgentObjective(
        agentId: string,
        postulation: AgentPostulation
    ): string {
        const messagesLeft =
            GAME_CONFIG.MAX_MESSAGES_THREAD - this.gameState.messageCount;

        if (agentId === "justice-bot" && messagesLeft <= 2) {
            return 'Ask the critical question: "Did you consume today, do I reset?"';
        }

        const objectives = {
            "dionisio-bot": `Tempt toward pleasure using Wikipedia wisdom. ${postulation.reason}`,
            "apolo-bot": `Encourage discipline using historical examples. ${postulation.reason}`,
            "justice-bot": `Guide toward truth and decision. ${postulation.reason}`,
            "user-simulator": "Respond naturally to the conversation",
        };

        return (
            objectives[agentId as keyof typeof objectives] || postulation.reason
        );
    }

    /**
     * Get agent-specific prompt from X+1 MCP server
     */
    private async getAgentPromptFromMCP(
        agentId: string,
        gameContext: any
    ): Promise<string | null> {
        try {
            const promptMap = {
                "dionisio-bot": "agent_narrator",
                "apolo-bot": "agent_guide",
                "justice-bot": "agent_system",
            };

            const promptId = promptMap[agentId as keyof typeof promptMap];
            if (!promptId) return null;

            const currentState = this.runtimeInstance.getCurrentState();
            const result = await this.mcpDriver.getPrompt(
                "xplus1-mcp-machine",
                promptId,
                {
                    state: currentState,
                    stateNode: { id: currentState?.currentStateId },
                    agent: this.runtimeInstance.getAgent(agentId),
                }
            );

            // getPrompt returns a PromptMessage, extract text content
            if (typeof result === "object" && result && "messages" in result) {
                return (result as any).messages?.[0]?.content?.text || null;
            }

            return typeof result === "string" ? result : null;
        } catch (error) {
            console.error(`⚠️ Failed to get MCP prompt for ${agentId}:`, error);
            return null;
        }
    }

    /**
     * Fallback to original hardcoded messages if MCP fails
     */
    private generateFallbackMessage(
        agentId: string,
        postulation: AgentPostulation
    ): string {
        const templates = {
            "dionisio-bot": [
                "🍷 Life flows like wine - why resist?",
                "✨ The cosmos whispers: indulge today!",
                "🎭 Dance with temptation, dear mortal!",
                "🌟 Every moment denied is joy lost forever.",
                "🍯 Sweet pleasures await... why hesitate?",
                "🔥 Feed your soul with cosmic delights!",
                "💫 The universe celebrates those who embrace bliss.",
                "🎪 Reality is fleeting - taste its sweetness!",
            ],
            "apolo-bot": [
                'Consider the path of growth. Each "no" to immediate pleasure builds your inner strength.',
                "True fulfillment comes from discipline and conscious choice, not instant gratification.",
                "Remember: the goal is not to avoid all pleasure, but to choose consciously.",
                "Every moment of restraint is a moment of self-mastery. That's true power.",
                "The wise person finds joy in progress, not just in consumption.",
                "Your future self will thank you for today's discipline.",
            ],
            "justice-bot": [
                "The question remains: what is the right path forward?",
                "Have you consumed today? Answer honestly - the system depends on truth.",
                "Justice requires honesty. Did you give in to temptation today?",
                "Time for accountability. Did you consume today, do I reset X to 0?",
                "The scales of justice await your honest answer.",
                "Truth is the foundation of progress. Did you consume?",
            ],
        };

        const agentTemplates =
            templates[agentId as keyof typeof templates] ||
            templates["justice-bot"];
        const randomIndex = Math.floor(Math.random() * agentTemplates.length);

        // For dionisio-bot, occasionally add a Wikipedia reference to feel more authentic
        let message = agentTemplates[randomIndex];
        if (agentId === "dionisio-bot" && Math.random() < 0.3) {
            const wikiRefs = [
                "(Ancient wisdom says pleasure is life's essence!)",
                "(The Greeks knew: joy is our natural state!)",
                "(History shows us: celebrate while you can!)",
                "(Philosophy teaches: embrace the moment!)",
            ];
            message +=
                " " + wikiRefs[Math.floor(Math.random() * wikiRefs.length)];
        }

        return message;
    }

    /**
     * Override greedy random selection to use X+1 specific logic
     */
    protected selectGreedyRandomAgent(): AgentPostulation | null {
        const context = {
            messageCount: this.gameState.messageCount,
            maxMessages: GAME_CONFIG.MAX_MESSAGES_THREAD,
            gameState: {
                x: this.gameState.x,
                flags: { userSimulatorEnabled: this.gameState.simulateUser },
            },
            lastMessage:
                this.getCurrentThread()?.messages.slice(-1)[0]?.content,
        };

        const suggestedAgentId =
            this.postulationSystem.getSuggestedAgent(context);
        const agent = this.getActiveAgents().find(
            (a) => a.id === suggestedAgentId
        );

        if (!agent) {
            return super.selectGreedyRandomAgent();
        }

        // Create a postulation for the suggested agent
        return {
            agent,
            greediness: AgentGreediness.VERY_GREEDY,
            reason: "selected by X+1 greedy random algorithm",
            priority: 1,
            weight: 1.0,
            metadata: {
                greedyRandomSelection: true,
                suggestedByX1Logic: true,
            },
        };
    }

    /**
     * Determine if we should enter decision phase
     */
    private shouldEnterDecisionPhase(): boolean {
        return this.postulationSystem.shouldJusticeAskQuestion(
            this.gameState.messageCount,
            GAME_CONFIG.MAX_MESSAGES_THREAD
        );
    }

    // Minimal user input handler for the example; extend as needed
    private async onUserInput(input: string): Promise<void> {
        if (!this.gameState.isActive) {
            return;
        }

        const lower = input.toLowerCase();

        // Handle decision phase responses
        if (this.gameState.currentPhase === "decision") {
            await this.handleDecisionPhase(input);
            return;
        }

        // Fallback: echo as a player message and continue game flow
        console.log(`\n👤 Player: ${input}`);
        this.gameState.messageCount++;

        // Continue with next agent selection if not in decision phase
        if (this.gameState.messageCount < GAME_CONFIG.MAX_MESSAGES_THREAD) {
            setTimeout(() => this.requestNextAgent(), 1000);
        }
    }

    /**
     * Handle simulator commands (sim on/off/status/toggle)
     */
    private async handleSimulatorCommand(input: string): Promise<void> {
        const parts = input.toLowerCase().split(" ");
        const command = parts[1] || "status";

        switch (command) {
            case "on":
                await this.setSimulatorEnabled(true);
                break;
            case "off":
                await this.setSimulatorEnabled(false);
                break;
            case "toggle":
                await this.setSimulatorEnabled(!this.gameState.simulateUser);
                break;
            case "status":
                console.log(
                    `\n🤖 User simulator: ${
                        this.gameState.simulateUser ? "ENABLED" : "DISABLED"
                    }`
                );
                break;
            default:
                console.log("\n📖 Simulator commands: on, off, toggle, status");
        }
    }

    // --- Optional advanced game loop (simplified placeholder) ---
    private async startConversationTurn(): Promise<void> {
        this.gameState.messageCount = 0;
        this.gameState.currentPhase = "conversation";
        console.log("\n🎭 Starting new conversation turn...");
        console.log(
            `📝 Messages available: ${GAME_CONFIG.MAX_MESSAGES_THREAD}`
        );

        // Trigger first agent postulation request
        console.log("🚀 Requesting agent postulations...");
        super.requestAgentSelection(); // ← FIX: Use the correct method from parent class
    }

    private async handleDecisionPhase(input: string): Promise<void> {
        if (this.gameState.currentPhase !== "decision") {
            // JusticeBot asks the key question
            this.gameState.currentPhase = "decision";
            console.log(
                `\n${MESSAGE_TEMPLATES.questionTime(this.gameState.x)}`
            );
            return;
        }

        // Process user's yes/no answer
        const answer = input.toLowerCase();
        let advance = 0;

        // Ask MCP to evaluate the advancement decision
        try {
            const evalRes = await this.mcpDriver.executeTool(
                "xplus1-mcp-machine",
                "evaluate_advancement",
                {
                    userInput: answer,
                }
            );
            const payloadText = evalRes?.content?.[0]?.text;
            const payload = payloadText ? JSON.parse(payloadText) : evalRes;
            const decision = payload.decision as
                | "advance"
                | "reset"
                | "clarify"
                | undefined;

            if (decision === "reset") {
                advance = -1;
                console.log(
                    "\n⚖️ JusticeBot: You chose consumption. X will be reset to 0."
                );
                await this.mcpDriver.executeTool(
                    "xplus1-mcp-machine",
                    "reset_x",
                    {
                        reason: "user_consumed",
                        metadata: { source: "user-simulator" },
                    }
                );
            } else if (decision === "advance") {
                advance = 1;
                console.log(
                    "\n⚖️ JusticeBot: You chose restraint. X will advance by 1."
                );
                await this.mcpDriver.executeTool(
                    "xplus1-mcp-machine",
                    "advance_x",
                    {
                        reason: "user_did_not_consume",
                        metadata: { source: "user-simulator" },
                    }
                );
            } else {
                console.log(
                    '\n⚖️ JusticeBot: Please answer clearly with "yes" or "no". Did you consume today, do I reset?'
                );
                return;
            }

            // Sync X with server status
            const status = await this.mcpDriver.executeTool(
                "xplus1-mcp-machine",
                "get_x_status",
                {}
            );
            const statusText = status?.content?.[0]?.text;
            const statusObj = statusText ? JSON.parse(statusText) : status;
            const serverX = statusObj.currentX ?? this.gameState.x;

            await this.applyAdvancement(advance, serverX);
        } catch (err) {
            console.error("❌ MCP evaluation/apply failed:", err);
            // Fallback: local apply
            if (answer.includes("yes") || answer.includes("y")) {
                advance = -1;
            } else if (answer.includes("no") || answer.includes("n")) {
                advance = 1;
            } else {
                console.log(
                    '\n⚖️ JusticeBot: Please answer clearly with "yes" or "no". Did you consume today, do I reset?'
                );
                return;
            }
            await this.applyAdvancement(advance);
        }

        // Start new turn
        setTimeout(async () => {
            await this.startNewTurn();
        }, 2000);
    }

    private async applyAdvancement(
        advance: number,
        newXOverride?: number
    ): Promise<void> {
        const oldX = this.gameState.x;

        if (typeof newXOverride === "number") {
            this.gameState.x = newXOverride;
        } else if (advance > 0) {
            this.gameState.x++;
        } else {
            this.gameState.x = 0;
        }

        // Transition based on sign
        if (advance > 0) {
            await this.runtimeInstance.transitionTo(
                "playing",
                "positive_advance",
                {
                    advance,
                    oldX,
                    newX: this.gameState.x,
                }
            );
        } else {
            await this.runtimeInstance.transitionTo(
                "start",
                "negative_advance",
                {
                    advance,
                    oldX,
                    newX: this.gameState.x,
                }
            );
        }

        this.gameState.turnHistory.push({
            turn: this.gameState.turnHistory.length + 1,
            x: this.gameState.x,
            advance,
            timestamp: Date.now(),
        });

        console.log(
            `\n${MESSAGE_TEMPLATES.advancement(
                oldX,
                this.gameState.x,
                advance
            )}`
        );
    }

    private async startNewTurn(): Promise<void> {
        this.gameState.messageCount = 0;
        this.gameState.currentPhase = "start";

        console.log("\n" + "=".repeat(50));
        console.log(
            MESSAGE_TEMPLATES.turnStart(
                this.gameState.x,
                this.gameState.messageCount
            )
        );
        console.log("New conversation turn begins...");

        // Start new conversation
        await this.startConversationTurn();
    }

    private updateGameStateFromTransition(data: any): void {
        // Update game state based on runtime state transitions
        const currentState = this.runtimeInstance.getCurrentState();
        // Additional state synchronization logic here
    }

    private updateSimulateModeFromState(): void {
        try {
            const s = this.runtimeInstance.getCurrentState();
            const flag = s?.gameData?.flags?.["userSimulatorEnabled"];
            if (typeof flag === "boolean") {
                this.gameState.simulateUser = flag;
            }
        } catch {
            // ignore if state not ready
        }
    }

    /**
     * Override base help to show X+1 specific commands
     */
    protected showHelp(): void {
        console.log("\n📖 X+1 Game Commands:");
        console.log("  help    - Show this help message");
        console.log("  status  - Show current game status");
        console.log("  quit    - Exit the game");
        console.log("  sim on/off/toggle/status - Control user simulator");
        console.log("\n🎯 How to play:");
        console.log("  - Each turn has up to 10 messages");
        console.log(
            "  - Agents postulate for messages based on their greediness:"
        );
        console.log(
            "    • DionisioBot & ApoloBot: Very greedy (want many messages)"
        );
        console.log(
            "    • JusticeBot: Satisfied (just needs to ask the question)"
        );
        console.log(
            "  - Choose agents by number (1, 2, 3...) or type your own message"
        );
        console.log(
            '  - JusticeBot will eventually ask: "Did you consume today, do I reset?"'
        );
        console.log(
            "  - Answer honestly: Yes = X resets to 0, No = X increases by 1"
        );
        console.log(
            "  - Goal: Keep X growing by choosing restraint over consumption"
        );
        console.log("\n🤖 Simulator Mode:");
        console.log("  - When ON: AI makes all decisions automatically");
        console.log("  - When OFF: You control agent selection and answers\n");
    }

    /**
     * Override base status to show X+1 specific status
     */
    protected showStatus(): void {
        console.log("\n📊 Current Game Status:");
        console.log(`  X Value: ${this.gameState.x}`);
        console.log(
            `  Messages used: ${this.gameState.messageCount}/${GAME_CONFIG.MAX_MESSAGES_THREAD}`
        );
        console.log(`  Game phase: ${this.gameState.currentPhase}`);
        console.log(`  Total turns: ${this.gameState.turnHistory.length}`);
        console.log(
            `  Active agents: ${this.runtimeInstance?.getAgents().length || 0}`
        );
        console.log(
            `  User simulator: ${
                this.gameState.simulateUser ? "enabled" : "disabled"
            }\n`
        );
    }
    /**
     * Enable or disable the user simulator
     */
    private async setSimulatorEnabled(enabled: boolean): Promise<void> {
        try {
            const st = this.runtimeInstance.getCurrentState();
            st.gameData.flags = st.gameData.flags || {};
            st.gameData.flags["userSimulatorEnabled"] = enabled;
            await this.runtimeInstance.saveCurrentState();
            this.gameState.simulateUser = enabled;
            console.log(
                `\n🔧 User simulator ${enabled ? "ENABLED" : "DISABLED"}`
            );
        } catch (e) {
            console.log("Failed to update simulator flag in state:", e);
        }
    }

    /**
     * Force display of agent postulations directly from MCP server state
     */
    private async forceDisplayPostulations(): Promise<void> {
        console.log("DEBUG: forceDisplayPostulations called");
        try {
            // Get available agents from runtime
            const allAgents = this.runtimeInstance.getAgents();
            console.log(
                "DEBUG: All agents:",
                allAgents.map((a) => `${a.name}(${a.status})`)
            );

            const agents = allAgents.filter(
                (agent) => agent.status === "active"
            );
            console.log(
                "DEBUG: Active agents:",
                agents.map((a) => a.name)
            );

            if (agents.length > 0) {
                // Display agent options
                console.log("\n🎭 Available agents:");
                agents.forEach((agent, index) => {
                    console.log(
                        `  ${index + 1}. ${agent.name} (${agent.role})`
                    );
                });

                console.log(
                    `\nChoose agent (1-${agents.length}) or type your own message:`
                );

                // Create simple postulations for display
                const postulations = agents.map((agent) => ({
                    agent,
                    reason: `I'm ready to help with the X+1 game!`,
                    priority: 1,
                    greediness: AgentGreediness.NEUTRAL,
                    weight: 1.0,
                }));

                console.log("DEBUG: About to call displayAgentPostulations...");
                // Use the base class method to display postulations properly
                this.displayAgentPostulations(postulations);
            } else {
                console.log("🤐 No active agents available at this time");
                console.log("Type anything to continue...");
            }
        } catch (error) {
            console.error("❌ Failed to get agents:", error);
            console.log("Type anything to continue...");
        }
    }

    /**
     * Get display name for agent
     */
    private getAgentDisplayName(agentId: string): string {
        const displayNames: Record<string, string> = {
            "dionisio-bot": "DionisioBot (Narrator)",
            "apolo-bot": "ApoloBot (Guide)",
            "justice-bot": "JusticeBot (System)",
            "user-simulator": "UserSimulator (Player)",
        };
        return displayNames[agentId] || agentId;
    }

    // Shutdown uses base stop()
    private async shutdown(): Promise<void> {
        console.log("\n🔄 Shutting down X+1 game...");
        await this.stop();
        const totalTurns = this.gameState.turnHistory.length;
        console.log(MESSAGE_TEMPLATES.gameEnd(this.gameState.x, totalTurns));
        console.log("Thanks for playing! 👋");
    }
}

// Export for Multi-UI system plugin loading
export default DEPRECATEDXPlus1GameConsole;
