/**
 * Test agents for orchestrator testing
 */

import { Subject, takeUntil } from "rxjs";
import { IOrchestratorChannels, OrchestratorComponent } from "../types";
import { Logger } from "../../utils/logger";

/**
 * System Agent - Manages system lifecycle events
 */
export class SysAgent implements OrchestratorComponent {
    public readonly id = "sys-agent";
    public readonly name = "System Agent";

    private channels?: IOrchestratorChannels;
    private destroy$ = new Subject<void>();
    private isInitialized = false;

    // Event tracking for tests
    public eventsReceived: string[] = [];
    public eventsSent: string[] = [];

    async initialize(channels: IOrchestratorChannels): Promise<void> {
        this.channels = channels;
        this.isInitialized = true;

        // Listen to all system events
        this.channels.sys.messages$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message) => {
                this.eventsReceived.push(`SYS:${message.type}`);
                this.handleSystemMessage(message);
            });

        // Listen to app events that might trigger system responses
        this.channels.app.messages$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message) => {
                this.eventsReceived.push(`APP:${message.type}`);
                this.handleAppMessage(message);
            });

        // Listen to UI events
        this.channels.ui.messages$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message) => {
                this.eventsReceived.push(`UI:${message.type}`);
                this.handleUIMessage(message);
            });

        Logger.info(`${this.name} initialized`);
    }

    async shutdown(): Promise<void> {
        this.destroy$.next();
        this.destroy$.complete();
        this.isInitialized = false;
        Logger.info(`${this.name} shutdown`);
    }

    // Public methods for test control
    public sendReady(): void {
        if (!this.channels) throw new Error("Not initialized");

        this.channels.sys.sendInfo(this.id, "System is ready", {
            event: "READY",
        });
        this.eventsSent.push("SYS:READY");
        Logger.info("SysAgent: Sent READY event");
    }

    public sendClose(): void {
        if (!this.channels) throw new Error("Not initialized");

        this.channels.sys.sendInfo(this.id, "System is closing", {
            event: "CLOSE",
        });
        this.eventsSent.push("SYS:CLOSE");
        Logger.info("SysAgent: Sent CLOSE event");
    }

    public broadcastFeatureReady(featureName: string): void {
        if (!this.channels) throw new Error("Not initialized");

        this.channels.sys.sendInfo(this.id, `Feature ${featureName} is ready`, {
            event: "FEATURE_READY",
            feature: featureName,
        });
        this.eventsSent.push(`SYS:FEATURE_READY:${featureName}`);
        Logger.info(`SysAgent: Broadcasted feature ready - ${featureName}`);
    }

    private handleSystemMessage(message: any): void {
        // Handle system-specific messages
        const event = message.payload?.event || message.metadata?.event;

        if (event === "CLOSE") {
            // Echo close event to confirm receipt
            setTimeout(() => {
                this.channels?.sys.sendInfo(this.id, "Close acknowledged", {
                    event: "CLOSE_ACK",
                });
                this.eventsSent.push("SYS:CLOSE_ACK");
            }, 100);
        }
    }

    private handleAppMessage(message: any): void {
        // Handle app messages that might need system response
        if (
            message.type === "action_request" &&
            message.payload?.actionType === "init"
        ) {
            this.channels?.sys.sendInfo(this.id, "App init acknowledged", {
                event: "APP_INIT_ACK",
            });
            this.eventsSent.push("SYS:APP_INIT_ACK");
        }
    }

    private handleUIMessage(message: any): void {
        // Handle UI messages that might need system response
        if (
            message.type === "user_input" &&
            message.payload?.input === "init"
        ) {
            this.channels?.sys.sendInfo(this.id, "UI init acknowledged", {
                event: "UI_INIT_ACK",
            });
            this.eventsSent.push("SYS:UI_INIT_ACK");
        }
    }

    // Test utilities
    public getReceivedEvents(): string[] {
        return [...this.eventsReceived];
    }

    public getSentEvents(): string[] {
        return [...this.eventsSent];
    }

    public clearEvents(): void {
        this.eventsReceived = [];
        this.eventsSent = [];
    }
}

/**
 * Application Agent - Manages app lifecycle and state
 */
export class AppAgent implements OrchestratorComponent {
    public readonly id = "app-agent";
    public readonly name = "Application Agent";

    private channels?: IOrchestratorChannels;
    private destroy$ = new Subject<void>();
    private isReady = false;

    // Event tracking for tests
    public eventsReceived: string[] = [];
    public eventsSent: string[] = [];

    async initialize(channels: IOrchestratorChannels): Promise<void> {
        this.channels = channels;

        // Listen to system events
        this.channels.sys.messages$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message) => {
                this.eventsReceived.push(`SYS:${message.type}`);
                this.handleSystemMessage(message);
            });

        // Listen to app events
        this.channels.app.messages$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message) => {
                this.eventsReceived.push(`APP:${message.type}`);
                this.handleAppMessage(message);
            });

        // Listen to UI events
        this.channels.ui.messages$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message) => {
                this.eventsReceived.push(`UI:${message.type}`);
                this.handleUIMessage(message);
            });

        Logger.info(`${this.name} initialized`);
    }

    async shutdown(): Promise<void> {
        this.destroy$.next();
        this.destroy$.complete();
        this.isReady = false;
        Logger.info(`${this.name} shutdown`);
    }

    private handleSystemMessage(message: any): void {
        // Check both payload and metadata for event information
        const event = message.payload?.event || message.metadata?.event;

        if (event === "READY") {
            this.isReady = true;
            // Send APP_INIT when system is ready
            setTimeout(() => {
                this.sendAppInit();
            }, 50);
        } else if (event === "CLOSE") {
            // Respond to close event
            setTimeout(() => {
                this.sendClose();
            }, 100);
        }
    }

    private handleAppMessage(message: any): void {
        // Handle app-specific messages
        if (
            message.type === "action_request" &&
            message.payload?.action === "close"
        ) {
            this.sendClose();
        }
    }

    private handleUIMessage(message: any): void {
        // Handle UI messages that might affect app state
        if (
            message.type === "user_input" &&
            message.payload?.command === "shutdown"
        ) {
            this.sendClose();
        }
    }

    public sendAppInit(): void {
        if (!this.channels || !this.isReady) return;

        this.channels.app.sendActionRequest(this.id, "init", ["app_init"]);
        this.eventsSent.push("APP:INIT");
        Logger.info("AppAgent: Sent APP_INIT");
    }

    public sendClose(): void {
        if (!this.channels) return;

        this.channels.app.sendActionRequest(this.id, "close", []);
        this.eventsSent.push("APP:CLOSE");
        Logger.info("AppAgent: Sent CLOSE event");
    }

    // Test utilities
    public getReceivedEvents(): string[] {
        return [...this.eventsReceived];
    }

    public getSentEvents(): string[] {
        return [...this.eventsSent];
    }

    public clearEvents(): void {
        this.eventsReceived = [];
        this.eventsSent = [];
    }
}

/**
 * UI Agent - Manages UI interactions and state
 */
export class UIAgent implements OrchestratorComponent {
    public readonly id = "ui-agent";
    public readonly name = "UI Agent";

    private channels?: IOrchestratorChannels;
    private destroy$ = new Subject<void>();
    private isReady = false;

    // Event tracking for tests
    public eventsReceived: string[] = [];
    public eventsSent: string[] = [];

    async initialize(channels: IOrchestratorChannels): Promise<void> {
        this.channels = channels;

        // Listen to system events
        this.channels.sys.messages$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message) => {
                this.eventsReceived.push(`SYS:${message.type}`);
                this.handleSystemMessage(message);
            });

        // Listen to app events
        this.channels.app.messages$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message) => {
                this.eventsReceived.push(`APP:${message.type}`);
                this.handleAppMessage(message);
            });

        // Listen to UI events
        this.channels.ui.messages$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message) => {
                this.eventsReceived.push(`UI:${message.type}`);
                this.handleUIMessage(message);
            });

        Logger.info(`${this.name} initialized`);
    }

    async shutdown(): Promise<void> {
        this.destroy$.next();
        this.destroy$.complete();
        this.isReady = false;
        Logger.info(`${this.name} shutdown`);
    }

    private handleSystemMessage(message: any): void {
        // Check both payload and metadata for event information
        const event = message.payload?.event || message.metadata?.event;

        if (event === "READY") {
            this.isReady = true;
            // Send UI_INIT when system is ready
            setTimeout(() => {
                this.sendUIInit();
            }, 75);
        } else if (event === "CLOSE") {
            // Respond to close event
            setTimeout(() => {
                this.sendClose();
            }, 150);
        } else if (event === "FEATURE_READY") {
            // Update UI when features become ready
            const featureName = message.metadata?.feature || "unknown";
            this.updateFeatureStatus(featureName);
        }
    }

    private handleAppMessage(message: any): void {
        // Handle app messages that affect UI
        if (message.type === "state_transition") {
            this.updateDisplayForState(message.payload?.targetState);
        }
    }

    private handleUIMessage(message: any): void {
        // Handle UI-specific messages
        if (message.type === "display_update") {
            // Process display updates
        }
    }

    public sendUIInit(): void {
        if (!this.channels || !this.isReady) return;

        this.channels.ui.sendUserInput(this.id, "init", "ui_init");
        this.eventsSent.push("UI:INIT");
        Logger.info("UIAgent: Sent UI_INIT");
    }

    public sendClose(): void {
        if (!this.channels) return;

        this.channels.ui.sendUserInput(this.id, "close", "close");
        this.eventsSent.push("UI:CLOSE");
        Logger.info("UIAgent: Sent CLOSE event");
    }

    private updateFeatureStatus(featureName: string): void {
        if (!this.channels) return;

        this.channels.ui.sendDisplayUpdate(
            this.id,
            "feature-status",
            "info",
            `Feature ${featureName} is now ready`
        );
        this.eventsSent.push(`UI:FEATURE_UPDATE:${featureName}`);
    }

    private updateDisplayForState(state: string): void {
        if (!this.channels) return;

        this.channels.ui.sendDisplayUpdate(
            this.id,
            "state-display",
            "info",
            `State changed to: ${state}`
        );
        this.eventsSent.push(`UI:STATE_UPDATE:${state}`);
    }

    // Test utilities
    public getReceivedEvents(): string[] {
        return [...this.eventsReceived];
    }

    public getSentEvents(): string[] {
        return [...this.eventsSent];
    }

    public clearEvents(): void {
        this.eventsReceived = [];
        this.eventsSent = [];
    }
}

/**
 * Log Agent - Monitors and logs all channel activity
 */
export class LogAgent implements OrchestratorComponent {
    public readonly id = "log-agent";
    public readonly name = "Log Agent";

    private channels?: IOrchestratorChannels;
    private destroy$ = new Subject<void>();

    // Comprehensive logging
    public allEvents: Array<{
        timestamp: number;
        channel: string;
        messageType: string;
        source: string;
        payload?: any;
        metadata?: any;
    }> = [];

    async initialize(channels: IOrchestratorChannels): Promise<void> {
        this.channels = channels;

        // Listen to ALL channels and log everything
        this.channels.app.messages$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message) => {
                this.logEvent("APP", message);
            });

        this.channels.sys.messages$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message) => {
                this.logEvent("SYS", message);
            });

        this.channels.ui.messages$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message) => {
                this.logEvent("UI", message);
            });

        Logger.info(`${this.name} initialized - monitoring all channels`);
    }

    async shutdown(): Promise<void> {
        this.destroy$.next();
        this.destroy$.complete();
        Logger.info(
            `${this.name} shutdown - logged ${this.allEvents.length} events`
        );
    }

    private logEvent(channel: string, message: any): void {
        const event = {
            timestamp: Date.now(),
            channel,
            messageType: message.type,
            source: message.source,
            payload: message.payload,
            metadata: message.metadata, // Store metadata for event detection
        };

        this.allEvents.push(event);

        // Enhanced logging for specific events
        const eventType = message.payload?.event || message.metadata?.event;
        if (eventType) {
            Logger.info(
                `LogAgent: [${channel}] ${message.source} -> ${eventType}`
            );
        } else {
            Logger.info(
                `LogAgent: [${channel}] ${message.source} -> ${message.type}`
            );
        }
    }

    // Test utilities
    public getEventsByChannel(channel: string): typeof this.allEvents {
        return this.allEvents.filter((event) => event.channel === channel);
    }

    public getEventsBySource(source: string): typeof this.allEvents {
        return this.allEvents.filter((event) => event.source === source);
    }

    public getEventsByType(messageType: string): typeof this.allEvents {
        return this.allEvents.filter(
            (event) => event.messageType === messageType
        );
    }

    public getEventsInTimeRange(
        start: number,
        end: number
    ): typeof this.allEvents {
        return this.allEvents.filter(
            (event) => event.timestamp >= start && event.timestamp <= end
        );
    }

    public getAllEvents(): typeof this.allEvents {
        return [...this.allEvents];
    }

    public clearLogs(): void {
        this.allEvents = [];
    }

    public getEventSequence(): string[] {
        return this.allEvents.map((event) => {
            const eventType =
                event.payload?.event || (event as any).metadata?.event;
            return `${event.channel}:${event.messageType}:${event.source}${
                eventType ? `:${eventType}` : ""
            }`;
        });
    }

    public generateReport(): {
        totalEvents: number;
        eventsByChannel: Record<string, number>;
        eventsBySource: Record<string, number>;
        eventSequence: string[];
        timespan: { start: number; end: number; duration: number };
    } {
        const eventsByChannel: Record<string, number> = {};
        const eventsBySource: Record<string, number> = {};

        for (const event of this.allEvents) {
            eventsByChannel[event.channel] =
                (eventsByChannel[event.channel] || 0) + 1;
            eventsBySource[event.source] =
                (eventsBySource[event.source] || 0) + 1;
        }

        const timestamps = this.allEvents.map((e) => e.timestamp);
        const start = Math.min(...timestamps);
        const end = Math.max(...timestamps);

        return {
            totalEvents: this.allEvents.length,
            eventsByChannel,
            eventsBySource,
            eventSequence: this.getEventSequence(),
            timespan: {
                start,
                end,
                duration: end - start,
            },
        };
    }
}

// Simple test to prevent "no tests" error
describe("Test Agents", () => {
    it("should export agent classes", () => {
        expect(SysAgent).toBeDefined();
        expect(AppAgent).toBeDefined();
        expect(UIAgent).toBeDefined();
        expect(LogAgent).toBeDefined();
    });
});
