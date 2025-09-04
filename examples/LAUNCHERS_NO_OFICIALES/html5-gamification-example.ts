/**
 * HTML5 Gamification UI Test Example
 * 
 * This example shows how to integrate the enhanced HTML5GamificationUI 
 * with AgentPostulation system and orchestrator communication.
 */

import { MCPDriverAdapter } from "@/drivers";
import { AgentPostulationManager, AgentRole, AgentStatus, AgentGreediness, Agent } from "@/models";
import { Orchestrator } from "@/orchestration";
import { Runtime } from "@/runtime";
import { HTML5GameUIConfig, HTML5GamificationUI } from "@/ui";


async function createHTML5GameExample() {
    console.log('🚀 Starting HTML5 Gamification UI with Agent Postulation System...');

    // Create runtime and MCP driver
    const runtime = new Runtime();
    const mcpDriver = new MCPDriverAdapter();

    // Configure HTML5 UI
    const config: HTML5GameUIConfig = {
        gameTitle: 'X+1 Game - Enhanced Web Interface',
        welcomeMessage: 'Welcome to the enhanced X+1 game with agent postulation system!',
        port: 8080,
        debugMode: true,
        enablePostulations: true,
        autoSelectSingleAgent: false,
        maxMessagesPerThread: 10,
        maxConnections: 25,
        enableVoice: false,
        enableMobile: true,
        staticDir: './public'
    };

    // Create HTML5UI instance
    const htmlUI = new HTML5GamificationUI(runtime, mcpDriver, config);

    // Create orchestrator for coordinated communication
    const orchestrator = new Orchestrator({
        enableLogging: true,
        enableCrossChannelRouting: true,
        enableEventBroadcasting: true,
        primaryUIId: 'html5_ui'
    });

    // Create and configure AgentPostulationManager
    const postulationManager = new AgentPostulationManager();

    // Register sample agents with different greediness levels
    const agents: Agent[] = [
        {
            id: 'guide_bot',
            name: 'GuidanceBot',
            role: AgentRole.GUIDE,
            status: AgentStatus.ACTIVE,
            config: { greediness: 'very_greedy' },
            priority: 3,
            stats: {
                actionsExecuted: 0,
                messagesProcessed: 0,
                errorsEncountered: 0,
                lastActivity: Date.now()
            },
            metadata: { description: 'Provides helpful guidance and explanations' }
        },
        {
            id: 'support_bot',
            name: 'SupportBot', 
            role: AgentRole.SYSTEM,
            status: AgentStatus.ACTIVE,
            config: { greediness: 'satisfied' },
            priority: 2,
            stats: {
                actionsExecuted: 0,
                messagesProcessed: 0,
                errorsEncountered: 0,
                lastActivity: Date.now()
            },
            metadata: { description: 'Offers assistance and troubleshooting' }
        },
        {
            id: 'facilitator',
            name: 'FacilitatorBot',
            role: AgentRole.NARRATOR,
            status: AgentStatus.ACTIVE,
            config: { greediness: 'neutral' },
            priority: 2,
            stats: {
                actionsExecuted: 0,
                messagesProcessed: 0,
                errorsEncountered: 0,
                lastActivity: Date.now()
            },
            metadata: { description: 'Manages conversation flow and decisions' }
        },
        {
            id: 'observer',
            name: 'ObserverBot',
            role: AgentRole.CUSTOM,
            status: AgentStatus.ACTIVE,
            config: { greediness: 'passive' },
            priority: 1,
            stats: {
                actionsExecuted: 0,
                messagesProcessed: 0,
                errorsEncountered: 0,
                lastActivity: Date.now()
            },
            metadata: { description: 'Monitors and provides feedback' }
        }
    ];

    // Configure agent postulation behaviors
    postulationManager.registerAgent({
        agentId: 'guide_bot',
        greediness: AgentGreediness.VERY_GREEDY,
        baseReason: 'Ready to provide guidance and explanations',
        priorityMultiplier: 3,
        baseWeight: 1.0,
        customLogic: (context) => {
            // Guide bot is more eager when users seem confused
            if (context.lastMessage?.includes('?') || context.flags?.needsExplanation) {
                return { priority: 8, weight: 1.5 };
            }
            return null;
        }
    });

    postulationManager.registerAgent({
        agentId: 'support_bot',
        greediness: AgentGreediness.SATISFIED,
        baseReason: 'Available for support and assistance',
        priorityMultiplier: 2,
        baseWeight: 0.8,
        customLogic: (context) => {
            // Support bot activates when help is needed
            if (context.flags?.needsSupport || context.lastMessage?.includes('help')) {
                return { priority: 7, weight: 1.3 };
            }
            return null;
        }
    });

    postulationManager.registerAgent({
        agentId: 'facilitator',
        greediness: AgentGreediness.NEUTRAL,
        baseReason: 'Managing conversation flow',
        priorityMultiplier: 2,
        baseWeight: 0.9,
        customLogic: (context) => {
            // Facilitator is more active when thread is getting full
            const remaining = context.maxMessages - context.messageCount;
            if (remaining <= 3) {
                return { priority: 6, weight: 1.2 };
            }
            return null;
        }
    });

    postulationManager.registerAgent({
        agentId: 'observer',
        greediness: AgentGreediness.PASSIVE,
        baseReason: 'Observing and ready to provide feedback',
        priorityMultiplier: 1,
        baseWeight: 0.6,
        customLogic: (context) => {
            // Observer rarely participates unless urgent
            if (context.flags?.isUrgent) {
                return { priority: 4, weight: 0.8 };
            }
            return null;
        }
    });

    // Set the postulation manager on the UI
    htmlUI.setPostulationManager(postulationManager);

    // Start orchestrator
    await orchestrator.start();

    // Connect UI to orchestrator channels
    htmlUI.connectOrchestrator(orchestrator.getChannels());

    // Mock getActiveAgents for testing
    htmlUI['getActiveAgents'] = async () => agents;

    // Set up event handlers for demonstration
    htmlUI.on('userInput', (input: string) => {
        console.log(`📝 User input received: ${input}`);
        
        // Auto-generate postulations on user input
        htmlUI.generateAgentPostulations().then(postulations => {
            if (postulations.length > 0) {
                console.log(`🤖 Generated ${postulations.length} agent postulations`);
                htmlUI.displayAgentPostulations(postulations);
            }
        });
    });

    htmlUI.on('agentSelected', (postulation: any) => {
        console.log(`✅ Agent selected: ${postulation.agent.name} - ${postulation.reason}`);
        
        // Simulate agent response
        setTimeout(() => {
            htmlUI.sendAgentMessage(
                postulation.agent.id,
                `Hello! I'm ${postulation.agent.name}. ${postulation.reason}`,
                { postulation, selectedAt: Date.now() }
            );
        }, 1000);
    });

    // Start the HTML5 UI
    await htmlUI.start();

    console.log('✨ HTML5 Gamification UI with Agent Postulation System is running!');
    console.log('📡 Orchestrator channels connected for synchronized communication');
    console.log('🌐 Open http://localhost:8080 to test the enhanced interface');
    console.log('🧪 Test features:');
    console.log('   - Type messages to trigger agent postulations');
    console.log('   - Click "Generate Agents" to manually create postulations');
    console.log('   - Select agents from the postulation list');
    console.log('   - Use thread management controls');
    console.log('   - Monitor the Server-Sent Events for real-time updates');

    // Auto-demo sequence (optional)
    setTimeout(async () => {
        console.log('\n🎬 Starting auto-demo sequence...');
        
        // Start a new thread
        await htmlUI['handleStartNewThread']({ body: {} } as any, {
            json: (data: any) => console.log('Demo: Thread started', data)
        } as any);

        // Generate some postulations
        setTimeout(async () => {
            const postulations = await htmlUI.generateAgentPostulations({
                flags: { needsExplanation: true }
            });
            console.log('Demo: Generated postulations', postulations.map(p => p.agent.name));
        }, 2000);

    }, 5000);

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down HTML5 Gamification UI...');
        await htmlUI.stop();
        await orchestrator.stop();
        process.exit(0);
    });

    return htmlUI;
}

// Export for use in other examples
export { createHTML5GameExample };

// Run if this file is executed directly
if (require.main === module) {
    createHTML5GameExample().catch(error => {
        console.error('❌ Failed to start HTML5 Game UI:', error);
        process.exit(1);
    });
}
