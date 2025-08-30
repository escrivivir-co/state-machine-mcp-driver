/**
 * RxJS-based Orchestrator
 * Central communication hub using three RxJS channels: AppChannel, SysChannel, UIChannel
 */

import { EventEmitter } from "events";
import { Subject, Observable, merge, timer, EMPTY } from "rxjs";
import { takeUntil, tap, filter, map, catchError, share } from "rxjs/operators";

import {
    OrchestratorConfig,
    ChannelAgent,
    IOrchestratorChannels,
} from "./types";

import { Logger } from "../utils/logger";
import { AppChannelImpl } from "./channel/app-channel";
import { SysChannelImpl } from "./channel/sys-channel";
import { UIChannelImpl } from "./channel/ui-channel";
import { createChannelAgent } from "./channel/channel-agent-factory";

/**
 * Main Orchestrator class that manages all communication channels
 */
export class Orchestrator extends EventEmitter {
    // ===== Core Channels =====
    public readonly app: AppChannelImpl;
    public readonly sys: SysChannelImpl;
    public readonly ui: UIChannelImpl;

    // ===== Management =====
    private readonly components = new Map<string, ChannelAgent>();
    private readonly destroy$ = new Subject<void>();
    private isRunning = false;
    private startTime?: number;

    // ===== Statistics =====
    private totalMessages = 0;
    private totalErrors = 0;
    private crossChannelRoutes = new Map<string, number>();

    // ===== Configuration =====
    private readonly config: Required<OrchestratorConfig>;

    constructor(config: OrchestratorConfig = {}) {
        super();

        // Set default configuration
        this.config = {
            enableReplay: config.enableReplay ?? true,
            replayBufferSize: config.replayBufferSize ?? 100,
            enableLogging: config.enableLogging ?? true,
            messageTimeout: config.messageTimeout ?? 5000,
            enableCrossChannelRouting: config.enableCrossChannelRouting ?? true,
            autoRegisterComponentsKeys: config.autoRegisterComponentsKeys ?? [],
            autoRegisterComponents: [],
            syncInterval: config.syncInterval ?? 1000, // default sync interval in ms
            enableEventBroadcasting: config.enableEventBroadcasting ?? false, // default event broadcasting disabled
            primaryUIId: config.primaryUIId ?? "primary", // default primary UI identifier
        };

        // Initialize channels
        this.app = new AppChannelImpl(
            this.config.enableReplay,
            this.config.replayBufferSize,
            this.config.enableLogging
        );

        this.sys = new SysChannelImpl(
            this.config.enableReplay,
            this.config.replayBufferSize,
            this.config.enableLogging
        );

        this.ui = new UIChannelImpl(
            false, // UI typically doesn't need replay
            30, // Smaller buffer for UI
            this.config.enableLogging
        );

        this.setupChannelIntegration();
        this.setupErrorHandling();
        this.setupStatistics();

        if (this.config.enableLogging) {
            Logger.info("🎼 Orchestrator initialized with 3 channels");
        }
    }

    // ===== Lifecycle Management =====

    /**
     * Start the orchestrator and all channels
     */
    public async start(): Promise<void> {
        if (this.isRunning) {
            Logger.warn("Orchestrator is already running");
            return;
        }

        try {
            this.startTime = Date.now();
            this.isRunning = true;

            // Start all channels
            this.app.start();
            this.sys.start();
            this.ui.start();

            // Auto-register components
            for (const component of this.config.autoRegisterComponentsKeys) {
                await this.registerComponent(createChannelAgent(component));
            }

            // Send startup notification
            this.sys.sendInfo(
                "orchestrator",
                "Orchestrator started successfully"
            );

            this.emit("orchestrator:started", { timestamp: this.startTime });

            if (this.config.enableLogging) {
                Logger.info("🚀 Orchestrator started successfully");
            }
        } catch (error) {
            this.isRunning = false;
            this.sys.sendError(
                "orchestrator",
                error as Error,
                "Failed to start orchestrator"
            );
            throw error;
        }
    }

    /**
     * Stop the orchestrator and all channels
     */
    public async stop(): Promise<void> {
        if (!this.isRunning) {
            Logger.warn("Orchestrator is not running");
            return;
        }

        try {
            this.isRunning = false;

            // Unregister all components
            const componentIds = Array.from(this.components.keys());
            for (const componentId of componentIds) {
                await this.unregisterComponent(componentId);
            }

            // Stop all channels
            this.app.stop();
            this.sys.stop();
            this.ui.stop();

            // Complete destruction
            this.destroy$.next();
            this.destroy$.complete();

            const stopTime = Date.now();
            this.emit("orchestrator:stopped", { timestamp: stopTime });

            if (this.config.enableLogging) {
                const uptime = this.startTime ? stopTime - this.startTime : 0;
                Logger.info(`🛑 Orchestrator stopped (uptime: ${uptime}ms)`);
            }
        } catch (error) {
            this.sys.sendError(
                "orchestrator",
                error as Error,
                "Error during orchestrator shutdown"
            );
            throw error;
        }
    }

    /**
     * Destroy the orchestrator and clean up all resources
     */
    public destroy(): void {
        if (this.isRunning) {
            this.stop().catch((error) =>
                console.error(
                    "Error during orchestrator stop in destroy:",
                    error
                )
            );
        }

        this.app.destroy();
        this.sys.destroy();
        this.ui.destroy();

        this.removeAllListeners();
        this.components.clear();
        this.crossChannelRoutes.clear();

        if (this.config.enableLogging) {
            Logger.info("🗑️ Orchestrator destroyed");
        }
    }

    // ===== Component Management =====

    /**
     * Register a component with the orchestrator
     */
    public async registerComponent(component: ChannelAgent): Promise<void> {
        if (this.components.has(component.id)) {
            throw new Error(`Component ${component.id} is already registered`);
        }

        try {
            // Initialize the component with channel access
            await component.initialize(this.getChannels());

            this.components.set(component.id, component);
            this.emit("component:registered", {
                componentId: component.id,
                componentName: component.name,
            });

            this.sys.sendInfo(
                "orchestrator",
                `Component ${component.name} (${component.id}) registered successfully`
            );

            if (this.config.enableLogging) {
                Logger.info(
                    `📦 Component registered: ${component.name} (${component.id})`
                );
            }
        } catch (error) {
            this.sys.sendError(
                "orchestrator",
                error as Error,
                `Failed to register component ${component.id}`
            );
            throw error;
        }
    }

    /**
     * Unregister a component from the orchestrator
     */
    public async unregisterComponent(componentId: string): Promise<void> {
        const component = this.components.get(componentId);
        if (!component) {
            Logger.warn(`Component ${componentId} is not registered`);
            return;
        }

        try {
            await component.shutdown();
            this.components.delete(componentId);

            this.emit("component:unregistered", { componentId });

            this.sys.sendInfo(
                "orchestrator",
                `Component ${component.name} (${componentId}) unregistered`
            );

            if (this.config.enableLogging) {
                Logger.info(
                    `📦 Component unregistered: ${component.name} (${componentId})`
                );
            }
        } catch (error) {
            this.sys.sendError(
                "orchestrator",
                error as Error,
                `Failed to unregister component ${componentId}`
            );
            throw error;
        }
    }

    /**
     * Get channel access interface for components
     */
    public getChannels(): IOrchestratorChannels {
        return {
            app: this.app,
            sys: this.sys,
            ui: this.ui,
        };
    }

    // ===== Channel Integration =====

    /**
     * Setup cross-channel integration and routing
     */
    private setupChannelIntegration(): void {
        if (!this.config.enableCrossChannelRouting) return;

        // Merge all channel messages for cross-channel routing
        const allMessages$ = merge(
            this.app.messages$.pipe(
                map((msg) => ({ channel: "app", message: msg }))
            ),
            this.sys.messages$.pipe(
                map((msg) => ({ channel: "sys", message: msg }))
            ),
            this.ui.messages$.pipe(
                map((msg) => ({ channel: "ui", message: msg }))
            )
        );

        // Setup cross-channel routing
        allMessages$
            .pipe(
                takeUntil(this.destroy$),
                tap(({ channel, message }) => {
                    this.totalMessages++;
                    this.emit("message:sent", {
                        channel,
                        messageType: message.type,
                        messageId: message.id,
                    });
                }),
                catchError((error) => {
                    this.totalErrors++;
                    this.sys.sendError(
                        "orchestrator",
                        error as Error,
                        "Cross-channel routing error"
                    );
                    return EMPTY;
                })
            )
            .subscribe(({ channel, message }) => {
                this.routeCrossChannelMessage(channel, message);
            });
    }

    /**
     * Route messages between channels based on content
     */
    private routeCrossChannelMessage(
        sourceChannel: string,
        message: any
    ): void {
        const routeKey = `${sourceChannel}->${message.type}`;
        this.crossChannelRoutes.set(
            routeKey,
            (this.crossChannelRoutes.get(routeKey) || 0) + 1
        );

        // Example routing rules (customize as needed)
        switch (message.type) {
            case "state_transition":
                // App state changes should update UI
                if (sourceChannel === "app") {
                    this.ui.sendDisplayUpdate(
                        "orchestrator",
                        "state-display",
                        "info",
                        `State changed to: ${message.payload.targetState}`
                    );
                }
                break;

            case "error":
                // System errors should be displayed in UI
                if (sourceChannel === "sys") {
                    this.ui.sendNotification(
                        "orchestrator",
                        "System Error",
                        message.payload.message,
                        "error"
                    );
                }
                break;

            case "user_input":
                // UI commands should trigger app actions
                if (sourceChannel === "ui" && message.payload.command) {
                    this.app.sendActionRequest(
                        "orchestrator",
                        message.payload.command,
                        message.payload.args || []
                    );
                }
                break;
        }
    }

    // ===== Error Handling =====

    /**
     * Setup comprehensive error handling
     */
    private setupErrorHandling(): void {
        // Handle app channel errors
        this.app.messages$
            .pipe(
                takeUntil(this.destroy$),
                filter((message) => message.type.includes("error")),
                catchError((error) => {
                    this.totalErrors++;
                    console.error("App channel error:", error);
                    return EMPTY;
                })
            )
            .subscribe((errorMessage) => {
                this.emit("message:error", {
                    channel: "app",
                    messageId: errorMessage.id,
                    error: new Error(
                        JSON.stringify(errorMessage.payload) ||
                            "Unknown app error"
                    ),
                });
            });

        // Handle sys channel errors
        this.sys.messages$
            .pipe(
                takeUntil(this.destroy$),
                filter((message) => message.type.includes("error")),
                catchError((error) => {
                    this.totalErrors++;
                    console.error("Sys channel error:", error);
                    return EMPTY;
                })
            )
            .subscribe((errorMessage) => {
                this.emit("message:error", {
                    channel: "sys",
                    messageId: errorMessage.id,
                    error: new Error(
                        errorMessage.payload?.message || "Unknown sys error"
                    ),
                });
            });

        // Handle ui channel errors
        this.ui.messages$
            .pipe(
                takeUntil(this.destroy$),
                filter((message) => message.type.includes("error")),
                catchError((error) => {
                    this.totalErrors++;
                    console.error("UI channel error:", error);
                    return EMPTY;
                })
            )
            .subscribe((errorMessage) => {
                this.emit("message:error", {
                    channel: "ui",
                    messageId: errorMessage.id,
                    error: new Error(
                        errorMessage.payload?.message || "Unknown ui error"
                    ),
                });
            });

        // Global error handler
        this.on("error", (error) => {
            this.totalErrors++;
            this.sys.sendError("orchestrator", error, "Orchestrator error");
        });
    }

    // ===== Statistics and Monitoring =====

    /**
     * Setup statistics collection
     */
    private setupStatistics(): void {
        // Periodic statistics reporting
        timer(0, 30000) // Every 30 seconds
            .pipe(
                takeUntil(this.destroy$),
                filter(() => this.isRunning)
            )
            .subscribe(() => {
                const stats = this.getStatistics();
                this.sys.sendInfo(
                    "orchestrator",
                    "Periodic statistics update",
                    { stats }
                );
            });
    }

    /**
     * Get comprehensive orchestrator statistics
     */
    public getStatistics(): OrchestratorStatistics {
        const uptime = this.startTime ? Date.now() - this.startTime : 0;

        return {
            isRunning: this.isRunning,
            uptime,
            startTime: this.startTime,

            // Message statistics
            totalMessages: this.totalMessages,
            totalErrors: this.totalErrors,
            errorRate:
                this.totalMessages > 0
                    ? this.totalErrors / this.totalMessages
                    : 0,

            // Channel statistics
            channels: {
                app: this.app.getStats(),
                sys: this.sys.getStats(),
                ui: this.ui.getStats(),
            },

            // Component statistics
            components: {
                count: this.components.size,
                list: Array.from(this.components.values()).map((c) => ({
                    id: c.id,
                    name: c.name,
                })),
            },

            // Cross-channel routing
            crossChannelRoutes: Object.fromEntries(this.crossChannelRoutes),

            // Configuration
            config: this.config,
        };
    }

    // ===== Utility Methods =====

    /**
     * Get a combined observable of all messages from all channels
     */
    public getAllMessages$(): Observable<{ channel: string; message: any }> {
        return merge(
            this.app.messages$.pipe(
                map((msg) => ({ channel: "app", message: msg }))
            ),
            this.sys.messages$.pipe(
                map((msg) => ({ channel: "sys", message: msg }))
            ),
            this.ui.messages$.pipe(
                map((msg) => ({ channel: "ui", message: msg }))
            )
        ).pipe(share());
    }

    /**
     * Get messages by type across all channels
     */
    public getMessagesByType$(
        type: string
    ): Observable<{ channel: string; message: any }> {
        return this.getAllMessages$().pipe(
            filter(({ message }) => message.type === type)
        );
    }

    /**
     * Get messages by source across all channels
     */
    public getMessagesBySource$(
        source: string
    ): Observable<{ channel: string; message: any }> {
        return this.getAllMessages$().pipe(
            filter(({ message }) => message.source === source)
        );
    }

	logRequestsAndHandlers() {
		console.log("\n🔍 Event Loop Status:");
        const activeHandles = (process as any)._getActiveHandles();
        const activeRequests = (process as any)._getActiveRequests();

        console.log(`📊 Active Handles: ${activeHandles.length}`);
        activeHandles.forEach((handle: any, index: number) => {
            const handleType = handle.constructor.name;
            const handleInfo = handle._idleTimeout
                ? `(timeout: ${handle._idleTimeout}ms)`
                : "";
            console.log(`   ${index + 1}. ${handleType} ${handleInfo}`);
        });

        console.log(`📊 Active Requests: ${activeRequests.length}`);
        activeRequests.forEach((request: any, index: number) => {
            const requestType = request.constructor.name;
            console.log(`   ${index + 1}. ${requestType}`);
        });

        console.log("\nPress Ctrl+C to stop all interfaces.");

        // 5. Monitor handles periodically (every 15 seconds)
        const monitorInterval = setInterval(() => {
            const activeHandles = (process as any)._getActiveHandles();
            const activeRequests = (process as any)._getActiveRequests();

            console.log(
                `\n⏰ [${new Date().toLocaleTimeString()}] Event Loop Monitor:`
            );
            console.log(`   Active Handles: ${activeHandles.length}`);
            console.log(`   Active Requests: ${activeRequests.length}`);

            // Show handle types summary
            const handleTypes = activeHandles.reduce(
                (acc: any, handle: any) => {
                    const type = handle.constructor.name;
                    acc[type] = (acc[type] || 0) + 1;
                    return acc;
                },
                {}
            );

            if (Object.keys(handleTypes).length > 0) {
                console.log(
                    "   Handle types:",
                    Object.entries(handleTypes)
                        .map(([type, count]) => `${type}(${count})`)
                        .join(", ")
                );
            }
        }, 15000);

        // Cleanup monitor on process exit
        process.on("SIGINT", () => {
            console.log("\n🛑 Received SIGINT, cleaning up...");
            clearInterval(monitorInterval);
            if (this) {
                this.stop().then(() => {
                    console.log("✅ Orchestrator stopped");
                    process.exit(0);
                });
            } else {
                process.exit(0);
            }
        });
	}
}

/**
 * Orchestrator statistics interface
 */
export interface OrchestratorStatistics {
    isRunning: boolean;
    uptime: number;
    startTime?: number;
    totalMessages: number;
    totalErrors: number;
    errorRate: number;
    channels: {
        app: any;
        sys: any;
        ui: any;
    };
    components: {
        count: number;
        list: Array<{ id: string; name: string }>;
    };
    crossChannelRoutes: Record<string, number>;
    config: Required<OrchestratorConfig>;
}
