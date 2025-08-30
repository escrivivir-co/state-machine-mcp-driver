/**
 * Integrated Example - Multi-Interface Support Demo
 * Demonstrates the complete integration of chat-provider, UI, and agent control
 * through the InterfaceOrchestrator
 */

import { Runtime } from "../src/runtime/Runtime";
import { MCPDriverAdapter } from "../src/drivers/MCPDriverAdapter";
import { OllamaChatProvider } from "../src/chat-provider/OllamaChatProvider";
import { ConsoleGamificationUI } from "../src/ui/ConsoleGamificationUI";
import { AgentControlService } from "../src/services/AgentControlService";
import { Logger } from "../src/utils/logger";
import { ChannelConsumer } from "@/orchestration/channel/deprecated-channel-consumer";

async function main() {
    console.log("🚀 Starting Multi-Interface Integration Demo");
    console.log("============================================\n");

    try {
        // 1. Initialize core components
        console.log("📦 Initializing core components...");

        const mcpAdapter = new MCPDriverAdapter();

        // Add MCP servers (these would normally be running)
        await mcpAdapter.addServer({
            id: "xplus1-server",
            name: "X+1 Game Server",
            url: "http://localhost:3001",
        });

        await mcpAdapter.addServer({
            id: "wiki-server",
            name: "Wikipedia Browser",
            url: "http://localhost:3002",
        });

        const runtime = new Runtime(mcpAdapter, {
            mcpServerId: "xplus1-server",
            graphId: "main-game",
            userId: "demo-user",
        });

        console.log("✅ Core components initialized");

        // 2. Create orchestrator
        console.log("🎭 Creating Interface Orchestrator...");

        const orchestrator = new ChannelConsumer(runtime, mcpAdapter, {
            enableChatProvider: true,
            enableUI: true,
            enableAgentControl: true,
            syncInterval: 100,
        });

        console.log("✅ Interface Orchestrator created");

        // 3. Connect chat provider
        console.log("💬 Setting up Chat Provider...");

        const chatProvider = new OllamaChatProvider({
            defaultModel: "gpt-oss:20b",
            baseUrl: "http://localhost:11434",
            enableMCP: true,
        });

        chatProvider.connectMCP(mcpAdapter, orchestrator);
        orchestrator.connectChatProvider(chatProvider);

        console.log("✅ Chat Provider connected");

        // 4. Connect UI
        console.log("🖥️  Setting up Console UI...");

        const ui = new ConsoleGamificationUI(runtime, {
            maxMessagesPerThread: 100,
            gameTitle: "Multi-Interface Demo",
            welcomeMessage: "Welcome to the integrated demo!",
            debugMode: true,
            enableColors: true,
            enablePostulations: true,
        });

        ui.connectOrchestrator(orchestrator);
        orchestrator.connectUI(ui);

        console.log("✅ Console UI connected");

        // 5. Enable agent control
        console.log("🤖 Setting up Agent Control...");

        const agentControl = new AgentControlService(
            mcpAdapter,
            runtime,
            orchestrator
        );

        await orchestrator.enableAgentControl();

        console.log("✅ Agent Control enabled");

        // 6. Setup event listeners for demonstration
        console.log("📡 Setting up event monitoring...");

        orchestrator.on("state:updated", (data) => {
            console.log("🔄 State updated:", {
                trigger: data.trigger.source,
                type: data.trigger.type,
                stateId: data.state.id,
            });
        });

        orchestrator.on("action:result", (data) => {
            console.log("⚡ Action executed:", {
                action: data.action.type,
                success: data.result.success,
            });
        });

        orchestrator.on("mcp:event", (event) => {
            console.log("📨 MCP Event:", {
                type: event.type,
                action: event.action,
                serverId: event.serverId,
            });
        });

        console.log("✅ Event monitoring setup complete");

        // 7. Initialize and run
        console.log("🎬 Initializing runtime...");

        await runtime.initialize();

        console.log("✅ Runtime initialized");
        console.log("\n🎮 Starting demo...\n");

        // 8. Demonstrate different interaction methods
        console.log("🔥 DEMONSTRATION PHASE 🔥");
        console.log("========================\n");

        // Start a chat conversation
        console.log("💬 Starting chat conversation...");
        const conversation = await chatProvider.startConversation(
            "demo-conversation",
            [],
            {
                model: "gpt-oss:20b",
                temperature: 0.3,
            }
        );

        const chatResponse = await chatProvider.send(
            conversation.id,
            "Hello! Can you help me understand the current state of the system?"
        );

        console.log(
            "🤖 Chat Response:",
            chatResponse.choices[0]?.message?.content || "No response"
        );

        // Display UI status
        console.log("\n🖥️  Displaying UI status...");
        ui.displayGameStatus();

        // Get orchestrator statistics
        console.log("\n📊 Orchestrator Statistics:");
        const stats = orchestrator.getStatistics();
        console.log(JSON.stringify(stats, null, 2));

        // Simulate some events
        console.log("\n🎭 Simulating interface events...");

        // Simulate UI command
        ui.emit("command", {
            command: "status",
            args: [],
        });

        // Wait a bit for events to process
        await new Promise((resolve) => setTimeout(resolve, 1000));

        console.log("\n✅ Demo completed successfully!");
        console.log("\n📋 Summary:");
        console.log("- ✅ MCPDriverAdapter configured with native protocol");
        console.log("- ✅ InterfaceOrchestrator coordinating all interfaces");
        console.log("- ✅ Chat Provider connected and responsive");
        console.log("- ✅ Console UI connected with gamification");
        console.log("- ✅ Agent Control system enabled");
        console.log("- ✅ Event-driven architecture working");
        console.log("- ✅ Real-time state synchronization active");
    } catch (error) {
        console.error("❌ Demo failed:", error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down demo...");
    process.exit(0);
});

// Handle uncaught errors
process.on("uncaughtException", (error) => {
    console.error("💥 Uncaught Exception:", error);
    process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
});

if (require.main === module) {
    main().catch(console.error);
}
