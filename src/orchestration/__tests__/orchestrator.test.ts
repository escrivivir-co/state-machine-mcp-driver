/**
 * Comprehensive test suite for the RxJS Orchestrator
 */

import { Orchestrator } from "../orchestrator";
import { SysAgent, AppAgent, UIAgent, LogAgent } from "./test-agents";
import { Logger } from "../../utils/logger";

describe("Orchestrator Integration Tests", () => {
    let orchestrator: Orchestrator;
    let sysAgent: SysAgent;
    let appAgent: AppAgent;
    let uiAgent: UIAgent;
    let logAgent: LogAgent;

    beforeEach(async () => {
        // Create orchestrator with test configuration
        orchestrator = new Orchestrator({
            enableLogging: true,
            enableReplay: true,
            replayBufferSize: 50,
            enableCrossChannelRouting: true,
            messageTimeout: 1000,
        });

        // Create test agents
        sysAgent = new SysAgent();
        appAgent = new AppAgent();
        uiAgent = new UIAgent();
        logAgent = new LogAgent();

        // Start orchestrator
        await orchestrator.start();

        // Register all agents
        await orchestrator.registerComponent(sysAgent);
        await orchestrator.registerComponent(appAgent);
        await orchestrator.registerComponent(uiAgent);
        await orchestrator.registerComponent(logAgent);

        // Clear any initialization events
        sysAgent.clearEvents();
        appAgent.clearEvents();
        uiAgent.clearEvents();
        logAgent.clearLogs();
    });

    afterEach(async () => {
        if (orchestrator) {
            await orchestrator.stop();
            orchestrator.destroy();
        }
    });

    describe("Basic Channel Communication", () => {
        it("should allow components to send and receive messages on their channels", async () => {
            // Send a test message on each channel
            orchestrator.app.sendActionRequest("test", "test_action", [
                "param1",
            ]);
            orchestrator.sys.sendInfo("test", "Test system message");
            orchestrator.ui.sendNotification(
                "test",
                "Test UI",
                "Test notification",
                "info"
            );

            // Wait for message processing
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Verify LogAgent captured all messages
            const allEvents = logAgent.getAllEvents();
            expect(allEvents.length).toBeGreaterThanOrEqual(3);

            const appEvents = logAgent.getEventsByChannel("APP");
            const sysEvents = logAgent.getEventsByChannel("SYS");
            const uiEvents = logAgent.getEventsByChannel("UI");

            expect(appEvents.length).toBeGreaterThanOrEqual(1);
            expect(sysEvents.length).toBeGreaterThanOrEqual(1);
            expect(uiEvents.length).toBeGreaterThanOrEqual(1);
        });

        it("should support cross-channel message routing", async () => {
            // Send state transition from app channel
            orchestrator.app.sendStateTransition("test", "idle", "running", {
                reason: "test",
            });

            // Wait for cross-channel routing
            await new Promise((resolve) => setTimeout(resolve, 200));

            // Verify UI received the state update through cross-channel routing
            const uiEvents = logAgent.getEventsByChannel("UI");
            const stateUpdateEvents = uiEvents.filter(
                (event) =>
                    event.messageType === "display_update" &&
                    event.payload?.message?.includes(
                        "State changed to: running"
                    )
            );

            expect(stateUpdateEvents.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe("Standard Event Sequence Tests", () => {
        it("should execute the READY -> INIT -> CLOSE sequence correctly", async () => {
            const startTime = Date.now();

            // 1. SysAgent launches "READY" event
            sysAgent.sendReady();

            // Wait for app and ui agents to respond with INIT
            await new Promise((resolve) => setTimeout(resolve, 200));

            // 2. Verify APP_INIT and UI_INIT were sent
            expect(appAgent.getSentEvents()).toContain("APP:INIT");
            expect(uiAgent.getSentEvents()).toContain("UI:INIT");

            // 3. SysAgent launches "CLOSE" event
            sysAgent.sendClose();

            // Wait for all agents to respond with CLOSE
            await new Promise((resolve) => setTimeout(resolve, 300));

            // 4. Verify all agents sent CLOSE events
            expect(appAgent.getSentEvents()).toContain("APP:CLOSE");
            expect(uiAgent.getSentEvents()).toContain("UI:CLOSE");

            // 5. Verify LogAgent captured the complete sequence
            const endTime = Date.now();
            const sequenceEvents = logAgent.getEventsInTimeRange(
                startTime,
                endTime
            );

            expect(sequenceEvents.length).toBeGreaterThan(5);

            // Verify sequence order
            const eventSequence = logAgent.getEventSequence();
            const readyIndex = eventSequence.findIndex((event) =>
                event.includes("READY")
            );
            const appInitIndex = eventSequence.findIndex(
                (event) =>
                    event.includes("APP") && event.includes("action_request")
            );
            const uiInitIndex = eventSequence.findIndex(
                (event) => event.includes("UI") && event.includes("user_input")
            );
            const closeIndex = eventSequence.findIndex(
                (event) => event.includes("CLOSE") && !event.includes("ACK")
            );

            expect(readyIndex).toBeGreaterThanOrEqual(0);
            expect(appInitIndex).toBeGreaterThan(readyIndex);
            expect(uiInitIndex).toBeGreaterThan(readyIndex);
            expect(closeIndex).toBeGreaterThan(
                Math.max(appInitIndex, uiInitIndex)
            );
        });

        it("should handle feature ready broadcasts", async () => {
            // SysAgent broadcasts feature ready events
            sysAgent.broadcastFeatureReady("authentication");
            sysAgent.broadcastFeatureReady("database");
            sysAgent.broadcastFeatureReady("ui-components");

            // Wait for processing
            await new Promise((resolve) => setTimeout(resolve, 200));

            // Verify LogAgent captured all feature ready events
            const featureEvents = logAgent
                .getAllEvents()
                .filter((event) => event.metadata?.event === "FEATURE_READY");

            expect(featureEvents.length).toBe(3);

            const features = featureEvents.map(
                (event) => event.metadata.feature
            );
            expect(features).toContain("authentication");
            expect(features).toContain("database");
            expect(features).toContain("ui-components");

            // Verify UIAgent updated its feature status
            const uiFeatureUpdates = uiAgent
                .getSentEvents()
                .filter((event) => event.startsWith("UI:FEATURE_UPDATE:"));
            expect(uiFeatureUpdates.length).toBe(3);
        });
    });

    describe("Agent Interaction Patterns", () => {
        it("should handle system acknowledgment patterns", async () => {
            // Send READY and wait for responses
            sysAgent.sendReady();
            await new Promise((resolve) => setTimeout(resolve, 150));

            // Verify system sent acknowledgments for app and ui init
            const sysAckEvents = sysAgent
                .getSentEvents()
                .filter((event) => event.includes("ACK"));

            expect(sysAckEvents.length).toBeGreaterThanOrEqual(2);
            expect(sysAckEvents).toContain("SYS:APP_INIT_ACK");
            expect(sysAckEvents).toContain("SYS:UI_INIT_ACK");
        });

        it("should propagate close events through all agents", async () => {
            // First establish ready state
            sysAgent.sendReady();
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Clear events to focus on close sequence
            sysAgent.clearEvents();
            appAgent.clearEvents();
            uiAgent.clearEvents();

            // Send close event
            sysAgent.sendClose();
            await new Promise((resolve) => setTimeout(resolve, 300));

            // Verify all agents received and responded to close
            expect(sysAgent.getReceivedEvents()).toContain("SYS:info");
            expect(appAgent.getReceivedEvents()).toContain("SYS:info");
            expect(uiAgent.getReceivedEvents()).toContain("SYS:info");

            // Verify all agents sent their own close events
            expect(appAgent.getSentEvents()).toContain("APP:CLOSE");
            expect(uiAgent.getSentEvents()).toContain("UI:CLOSE");
            expect(sysAgent.getSentEvents()).toContain("SYS:CLOSE_ACK");
        });
    });

    describe("LogAgent Comprehensive Monitoring", () => {
        it("should capture and report all channel activity", async () => {
            // Execute a complete cycle
            sysAgent.sendReady();
            await new Promise((resolve) => setTimeout(resolve, 100));

            sysAgent.broadcastFeatureReady("test-feature");
            await new Promise((resolve) => setTimeout(resolve, 100));

            sysAgent.sendClose();
            await new Promise((resolve) => setTimeout(resolve, 200));

            // Generate comprehensive report
            const report = logAgent.generateReport();

            expect(report.totalEvents).toBeGreaterThan(5);
            expect(report.eventsByChannel).toHaveProperty("APP");
            expect(report.eventsByChannel).toHaveProperty("SYS");
            expect(report.eventsByChannel).toHaveProperty("UI");

            expect(report.eventsBySource).toHaveProperty("sys-agent");
            expect(report.eventsBySource).toHaveProperty("app-agent");
            expect(report.eventsBySource).toHaveProperty("ui-agent");

            expect(report.timespan.duration).toBeGreaterThan(0);
            expect(report.eventSequence.length).toBe(report.totalEvents);
        });

        it("should filter events by various criteria", async () => {
            // Generate some test events
            orchestrator.app.sendActionRequest("test", "action1", ["param"]);
            orchestrator.sys.sendInfo("test", "info message");
            orchestrator.ui.sendNotification(
                "test",
                "title",
                "notification",
                "warning"
            );

            await new Promise((resolve) => setTimeout(resolve, 100));

            // Test filtering
            const appEvents = logAgent.getEventsByChannel("APP");
            const sysEvents = logAgent.getEventsByChannel("SYS");
            const uiEvents = logAgent.getEventsByChannel("UI");

            expect(appEvents.length).toBeGreaterThan(0);
            expect(sysEvents.length).toBeGreaterThan(0);
            expect(uiEvents.length).toBeGreaterThan(0);

            const testSourceEvents = logAgent.getEventsBySource("test");
            expect(testSourceEvents.length).toBe(3);

            const actionEvents = logAgent.getEventsByType("action_request");
            expect(actionEvents.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe("Error Handling and Recovery", () => {
        it("should handle agent errors gracefully", async () => {
            // Simulate an error by sending malformed message
            try {
                orchestrator.sys.sendError(
                    "test",
                    new Error("Test error"),
                    "Simulated error"
                );
                await new Promise((resolve) => setTimeout(resolve, 100));

                // Verify error was logged
                const errorEvents = logAgent.getEventsByType("error");
                expect(errorEvents.length).toBeGreaterThanOrEqual(1);

                // Orchestrator should still be functional
                expect(orchestrator.getStatistics().isRunning).toBe(true);
            } catch (error) {
                fail("Error handling should not throw");
            }
        });

        it("should maintain statistics during operations", async () => {
            // Execute various operations
            sysAgent.sendReady();
            await new Promise((resolve) => setTimeout(resolve, 50));

            sysAgent.broadcastFeatureReady("feature1");
            sysAgent.broadcastFeatureReady("feature2");
            await new Promise((resolve) => setTimeout(resolve, 50));

            sysAgent.sendClose();
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Check orchestrator statistics
            const stats = orchestrator.getStatistics();

            expect(stats.isRunning).toBe(true);
            expect(stats.totalMessages).toBeGreaterThan(0);
            expect(stats.components.count).toBe(4); // 4 agents
            expect(stats.components.list).toHaveLength(4);

            // Verify component registration
            const componentIds = stats.components.list.map((c) => c.id);
            expect(componentIds).toContain("sys-agent");
            expect(componentIds).toContain("app-agent");
            expect(componentIds).toContain("ui-agent");
            expect(componentIds).toContain("log-agent");
        });
    });

    describe("Performance and Timing", () => {
        it("should handle rapid message sequences", async () => {
            const messageCount = 50;
            const startTime = Date.now();

            // Send rapid sequence of messages
            for (let i = 0; i < messageCount; i++) {
                orchestrator.app.sendActionRequest(`test-${i}`, `action-${i}`, [
                    `param-${i}`,
                ]);
                orchestrator.sys.sendInfo(`test-${i}`, `Info message ${i}`);
                orchestrator.ui.sendNotification(
                    `test-${i}`,
                    `Title ${i}`,
                    `Message ${i}`,
                    "info"
                );
            }

            // Wait for all messages to be processed
            await new Promise((resolve) => setTimeout(resolve, 500));

            const endTime = Date.now();
            const processingTime = endTime - startTime;

            // Verify all messages were captured
            const totalEvents = logAgent.getAllEvents().length;
            expect(totalEvents).toBeGreaterThanOrEqual(messageCount * 3);

            // Verify reasonable processing time (should be under 2 seconds for 150 messages)
            expect(processingTime).toBeLessThan(2000);

            Logger.info(
                `Processed ${totalEvents} events in ${processingTime}ms`
            );
        });

        it("should maintain message order within channels", async () => {
            const messageSequence = ["msg1", "msg2", "msg3", "msg4", "msg5"];

            // Send sequential messages on app channel
            for (const msg of messageSequence) {
                orchestrator.app.sendActionRequest("test", msg, []);
            }

            await new Promise((resolve) => setTimeout(resolve, 200));

            // Verify order preservation
            const appEvents = logAgent.getEventsByChannel("APP");
            const actionEvents = appEvents.filter(
                (event) => event.messageType === "action_request"
            );

            expect(actionEvents.length).toBeGreaterThanOrEqual(
                messageSequence.length
            );

            // Check that messages appear in the correct order
            for (let i = 0; i < messageSequence.length - 1; i++) {
                const currentIndex = actionEvents.findIndex(
                    (event) => event.payload?.actionType === messageSequence[i]
                );
                const nextIndex = actionEvents.findIndex(
                    (event) => event.payload?.actionType === messageSequence[i + 1]
                );

                expect(nextIndex).toBeGreaterThan(currentIndex);
            }
        });
    });

    describe("Integration Scenarios", () => {
        it("should handle complete application lifecycle", async () => {
            const scenario = async () => {
                // 1. System startup
                Logger.info("=== Starting Application Lifecycle Test ===");
                sysAgent.sendReady();
                await new Promise((resolve) => setTimeout(resolve, 100));

                // 2. Feature initialization
                sysAgent.broadcastFeatureReady("auth");
                sysAgent.broadcastFeatureReady("database");
                sysAgent.broadcastFeatureReady("ui");
                await new Promise((resolve) => setTimeout(resolve, 150));

                // 3. Simulate user interaction
                orchestrator.ui.sendUserInput("user", "login", "admin");
                await new Promise((resolve) => setTimeout(resolve, 50));

                // 4. Application state changes
                orchestrator.app.sendStateTransition(
                    "app",
                    "initializing",
                    "running",
                    {}
                );
                await new Promise((resolve) => setTimeout(resolve, 50));

                // 5. System shutdown
                sysAgent.sendClose();
                await new Promise((resolve) => setTimeout(resolve, 200));

                Logger.info("=== Application Lifecycle Test Complete ===");
            };

            await scenario();

            // Verify complete lifecycle was captured
            const report = logAgent.generateReport();

            expect(report.totalEvents).toBeGreaterThan(10);
            expect(report.eventsByChannel.APP).toBeGreaterThan(0);
            expect(report.eventsByChannel.SYS).toBeGreaterThan(0);
            expect(report.eventsByChannel.UI).toBeGreaterThan(0);

            // Verify all agents participated
            expect(report.eventsBySource["sys-agent"]).toBeGreaterThan(0);
            expect(report.eventsBySource["app-agent"]).toBeGreaterThan(0);
            expect(report.eventsBySource["ui-agent"]).toBeGreaterThan(0);

            Logger.info("Lifecycle test results:", report);
        });
    });
});
