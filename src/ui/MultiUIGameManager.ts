/**
 * Multi-UI Game Manager
 * Manages multiple GamificationUI instances simultaneously with RxJS coordination
 */

import { EventEmitter } from "events";
import { Subject, BehaviorSubject, merge, combineLatest, EMPTY } from "rxjs";
import { takeUntil, tap, filter, map, catchError, share } from "rxjs/operators";

import { Runtime } from "../runtime/Runtime";
import { MCPDriverAdapter } from "../drivers/MCPDriverAdapter";
import { StateMachineUI } from "@ui/templates/state-machine-ui";
import {
    GamificationUI,
    GamificationUIEvent,
    GameMessage,
    GameThread,
    BaseGamificationUIConfig,
} from "../ui/GamificationUI";
import {
    ConsoleGamificationUI,
} from "../ui/ConsoleGamificationUI";
import { ConsoleUIConfig } from "./ConsoleUIConfig";
import {
    HTML5GamificationUI,
    HTML5GameUIConfig,
} from "../ui/HTML5GamificationUI";
import {
    ThreeJSGamificationUI,
    ThreeJSGameUIConfig,
} from "../ui/ThreeJSGamificationUI";
import {
    UnityGamificationUI,
    UnityGameUIConfig,
} from "../ui/UnityGamificationUI";
import { Logger } from "../utils/logger";
import {
    IndependentConsoleLauncher,
    LaunchedConsole,
} from "./launcher/ui-console-launcher";
import {
    MultiUIGameConfig,
    UIInstanceConfig,
    UIType,
} from "./MultiUIGameConfig";
import { ChannelConsumer } from "@/orchestration/channel/deprecated-channel-consumer";
import { Orchestrator } from "@/orchestration";

/**
 * Temporary wrapper to make ConsoleGamificationUI compatible with GamificationUI
 * TODO: Refactor ConsoleGamificationUI to extend GamificationUI
 */
class ConsoleGamificationUIWrapper extends GamificationUI {
    private consoleUI: ConsoleGamificationUI;

    constructor(
        runtime: Runtime,
        mcpAdapter: MCPDriverAdapter,
        config: ConsoleUIConfig
    ) {
        const baseConfig: BaseGamificationUIConfig = {
            gameTitle: config.gameTitle,
            maxMessagesPerThread: config.maxMessagesPerThread,
        };

        super(runtime, mcpAdapter, baseConfig);
        this.consoleUI = new ConsoleGamificationUI(runtime, this.mcpDriver, config);

        // Forward relevant events
        this.consoleUI.on("gameStateChange", (data) => {
            this.emit(GamificationUIEvent.STATE_CHANGED, data);
        });

        this.consoleUI.on("userInput", (data) => {
            this.emit(GamificationUIEvent.USER_INPUT, data);
        });
    }

    async start(): Promise<void> {
        return this.consoleUI.start();
    }

    async stop(): Promise<void> {
        return this.consoleUI.stop();
    }

    protected async handleGameStateUpdate(state: any): Promise<void> {
        // Delegate to console UI if it has this method
        if (typeof (this.consoleUI as any).updateGameState === "function") {
            await (this.consoleUI as any).updateGameState(state);
        }
    }

    protected async handleThreadUpdate(thread: GameThread): Promise<void> {
        // Delegate to console UI if it has this method
        if (typeof (this.consoleUI as any).updateCurrentThread === "function") {
            await (this.consoleUI as any).updateCurrentThread(thread);
        }
    }

    // Implement abstract methods
    async displayMessage(message: GameMessage): Promise<void> {
        // Delegate to console UI
        if (typeof (this.consoleUI as any).displayMessage === "function") {
            await (this.consoleUI as any).displayMessage(message);
        }
    }

    async displayAgentPostulations(postulations: any[]): Promise<void> {
        // Delegate to console UI
        if (
            typeof (this.consoleUI as any).displayAgentPostulations ===
            "function"
        ) {
            await (this.consoleUI as any).displayAgentPostulations(
                postulations
            );
        }
    }

    async displayNotification(
        title: string,
        message: string,
        type?: "info" | "success" | "warning" | "error"
    ): Promise<void> {
        // Delegate to console UI with safety check
        if (
            this.consoleUI &&
            typeof (this.consoleUI as any).displayNotification === "function"
        ) {
            await (this.consoleUI as any).displayNotification(
                title,
                message,
                type
            );
        } else {
            console.log(`📢 ${title}: ${message}`);
        }
    }

    async updatePhaseDisplay(phase: string): Promise<void> {
        // Delegate to console UI with safety check
        if (
            this.consoleUI &&
            typeof (this.consoleUI as any).updatePhaseDisplay === "function"
        ) {
            await (this.consoleUI as any).updatePhaseDisplay(phase);
        } else {
            console.log(`📍 Phase: ${phase}`);
        }
    }
}

/**
 * Wrapper for Custom UI running in independent console
 */
class IndependentConsoleUIWrapper extends GamificationUI {
    private launchedConsole: LaunchedConsole;
    private uiConfig: UIInstanceConfig;

    constructor(
        runtime: Runtime,
        mcpAdapter: MCPDriverAdapter,
        config: UIInstanceConfig,
        launchedConsole: LaunchedConsole
    ) {
        const baseConfig: BaseGamificationUIConfig = {
            gameTitle: config.name,
            maxMessagesPerThread: config.config.maxMessagesPerThread || 50,
        };

        super(runtime, mcpAdapter, baseConfig);
        this.uiConfig = config;
        this.launchedConsole = launchedConsole;

        Logger.info(
            `Created independent console UI wrapper for ${config.name} (PID: ${launchedConsole.pid})`
        );
    }

    async start(): Promise<void> {
        Logger.info(
            `Independent console UI already started (PID: ${this.launchedConsole.pid})`
        );
        // Console is already started, just emit the event
        this.emit(GamificationUIEvent.STATE_CHANGED, {
            state: "running",
            processId: this.launchedConsole.pid,
        });
    }

    async stop(): Promise<void> {
        Logger.info(
            `Stopping independent console UI (PID: ${this.launchedConsole.pid})`
        );
        this.launchedConsole.close();
        this.emit(GamificationUIEvent.STATE_CHANGED, {
            state: "stopped",
            processId: this.launchedConsole.pid,
        });
    }

    protected async handleGameStateUpdate(state: any): Promise<void> {
        // Independent console manages its own state
        Logger.mcpVerbose("State update sent to independent console", {
            processId: this.launchedConsole.pid,
            state,
        });
    }

    protected async handleThreadUpdate(thread: GameThread): Promise<void> {
        // Independent console manages its own threads
        Logger.mcpVerbose("Thread update sent to independent console", {
            processId: this.launchedConsole.pid,
            thread,
        });
    }

    async displayMessage(message: GameMessage): Promise<void> {
        // Messages are handled by the independent console
        Logger.mcpVerbose("Message sent to independent console", {
            processId: this.launchedConsole.pid,
            message,
        });
    }

    async displayAgentPostulations(postulations: any[]): Promise<void> {
        // Postulations are handled by the independent console
        Logger.mcpVerbose("Postulations sent to independent console", {
            processId: this.launchedConsole.pid,
            postulations,
        });
    }

    async displayNotification(
        title: string,
        message: string,
        type?: "info" | "success" | "warning" | "error"
    ): Promise<void> {
        Logger.info(
            `📢 [Independent Console ${this.launchedConsole.pid}] ${title}: ${message}`
        );
    }

    async updatePhaseDisplay(phase: string): Promise<void> {
        Logger.info(
            `📍 [Independent Console ${this.launchedConsole.pid}] Phase: ${phase}`
        );
    }

    /**
     * Get information about the launched console
     */
    getConsoleInfo(): LaunchedConsole {
        return this.launchedConsole;
    }
}

/**
 * UI Factory for creating different types of GamificationUI instances
 */
class UIFactory {
    static create(
        type: UIType,
        config: UIInstanceConfig,
        runtime: Runtime,
        mcpAdapter: MCPDriverAdapter
    ): GamificationUI | Promise<GamificationUI> {
        switch (type) {
            case "console":
                // Create a valid ConsoleUIConfig
                const consoleConfig: ConsoleUIConfig = {
                    maxMessagesPerThread:
                        config.config.maxMessagesPerThread || 50,
                    gameTitle: config.name,
                    welcomeMessage: `Welcome to ${config.name}`,
                    debugMode: false,
                    userPrompt: "> ",
                    enableColors: true,
                    enablePostulations: true,
                    autoSelectSingleAgent: false,
                };
                return new ConsoleGamificationUIWrapper(
                    runtime,
                    mcpAdapter,
                    consoleConfig
                );

            case "html5":
                // Create a valid HTML5GameUIConfig
                const html5Config: HTML5GameUIConfig = {
                    gameTitle: config.name,
                    port: config.config.port || 8080,
                };
                return new HTML5GamificationUI(
                    runtime,
                    mcpAdapter,
                    html5Config
                );

            case "threejs":
                // Create a valid ThreeJSGameUIConfig
                const threejsConfig: ThreeJSGameUIConfig = {
                    gameTitle: config.name,
                    welcomeMessage: `Welcome to ${config.name}`,
                    port: config.config.port || 9090,
                    staticDir: config.config.staticDir || "e:/LAB_AGOSTO/threejs-gamify-ui/client",
                    corsOrigin: config.config.corsOrigin || "*",
                    debugMode: !!config.config.debugMode,
                    enablePostulations: config.config.enablePostulations ?? true,
                    autoSelectSingleAgent: config.config.autoSelectSingleAgent ?? true,
                    maxMessagesPerThread: config.config.maxMessagesPerThread ?? 50,
                    provideTemplate: config.config.provideTemplate ?? false,
                    autoOpenBrowser: config.config.autoOpenBrowser ?? true,
                    angularProjectPath: config.config.angularProjectPath || "../threejs-gamify-ui",
                };
                return new ThreeJSGamificationUI(
                    runtime,
                    mcpAdapter,
                    threejsConfig
                );

            case "unity":
                // Create a valid UnityGameUIConfig
                const unityConfig: UnityGameUIConfig = {
                    gameTitle: config.name,
                    welcomeMessage: `Welcome to ${config.name}`,
                    port: config.config.port || 9080,
                    buildDir: config.config.buildDir || "e:/LAB_AGOSTO/unity-builds/webgl",
                    unityBuildName: config.config.unityBuildName || "index.html",
                    corsOrigin: config.config.corsOrigin || "*",
                    debugMode: !!config.config.debugMode,
                    enablePostulations: config.config.enablePostulations ?? true,
                    autoSelectSingleAgent: config.config.autoSelectSingleAgent ?? true,
                    maxMessagesPerThread: config.config.maxMessagesPerThread ?? 50,
                };
                return new UnityGamificationUI(
                    runtime,
                    mcpAdapter,
                    unityConfig
                );

            case "custom":
                if (config.config.customClass) {
                    try {
                        Logger.info(
                            `Loading custom UI: ${config.config.customClass}`
                        );

                        // Check if we should launch in independent console
                        const launchInIndependentConsole =
                            config.config.launchInIndependentConsole !== false; // Default to true

                        if (launchInIndependentConsole) {
                            // Launch custom UI in independent console
                            return UIFactory.createCustomUIInIndependentConsole(
                                config,
                                runtime,
                                mcpAdapter
                            );
                        } else {
                            // Launch custom UI in current process (original behavior)
                            const customModule = require(config.config
                                .customClass);
                            // Support both default export and named export
                            const CustomUIClass =
                                customModule.default ||
                                customModule[Object.keys(customModule)[0]] ||
                                customModule;

                            if (typeof CustomUIClass !== "function") {
                                const availableExports =
                                    Object.keys(customModule).join(", ");
                                Logger.error(
                                    `Custom class ${config.config.customClass} is not a constructor function. Available exports: ${availableExports}`,
                                    new Error("Invalid custom class")
                                );
                                throw new Error(
                                    `Custom class ${config.config.customClass} is not a constructor function`
                                );
                            }

                            Logger.info(
                                `Successfully loaded custom UI class: ${
                                    CustomUIClass.name || "Unknown"
                                }`
                            );
                            return new CustomUIClass(
                                runtime,
                                mcpAdapter,
                                config.config
                            );
                        }
                    } catch (error) {
                        Logger.error(
                            `Failed to load custom UI class: ${config.config.customClass}`,
                            error as Error
                        );
                        Logger.info(
                            `Falling back to generic console UI for ${config.name}`
                        );

                        // Fallback to generic console UI
                        const consoleConfig: ConsoleUIConfig = {
                            maxMessagesPerThread:
                                config.config.maxMessagesPerThread || 50,
                            gameTitle: config.name,
                            welcomeMessage: `Welcome to ${config.name}`,
                            debugMode: false,
                            userPrompt: "> ",
                            enableColors: true,
                            enablePostulations: true,
                            autoSelectSingleAgent: false,
                        };
                        return new ConsoleGamificationUIWrapper(
                            runtime,
                            mcpAdapter,
                            consoleConfig
                        );
                    }
                }
                throw new Error(
                    "Custom UI type requires customClass configuration"
                );

            default:
                throw new Error(`Unsupported UI type: ${type}`);
        }
    }

    /**
     * Create a custom UI instance that runs in an independent console
     */
    static async createCustomUIInIndependentConsole(
        config: UIInstanceConfig,
        runtime: Runtime,
        mcpAdapter: MCPDriverAdapter
    ): Promise<GamificationUI> {
        if (!config.config.customClass) {
            throw new Error(
                "Custom UI type requires customClass configuration"
            );
        }

        try {
            Logger.info(
                `Creating custom UI in independent console: ${config.config.customClass}`
            );

            // Get runtime and adapter data for serialization
            const runtimeData = {
                currentState: runtime.getCurrentState(),
                // Add other runtime data as needed
            };

            const mcpAdapterData = {
                // Add serializable MCP adapter data
                serverConfigs: {}, // You may need to serialize relevant configs
            };

            // Create the launcher script
            const launcherPath =
                await IndependentConsoleLauncher.createCustomUILauncher(
                    config.name,
                    config.config.customClass,
                    runtimeData,
                    mcpAdapterData,
                    config.config
                );

            // Launch in independent console
            const launchedConsole =
                await IndependentConsoleLauncher.launchNodeScript(
                    launcherPath,
                    [],
                    {
                        title: `${config.name} - Custom UI`,
                        workingDirectory: process.cwd(),
                        keepOpen: true,
                    }
                );

            Logger.info(
                `Custom UI launched in independent console (PID: ${launchedConsole.pid})`
            );

            // Return wrapper that manages the independent console
            return new IndependentConsoleUIWrapper(
                runtime,
                mcpAdapter,
                config,
                launchedConsole
            );
        } catch (error) {
            Logger.error(
                `Failed to create custom UI in independent console: ${config.config.customClass}`,
                error as Error
            );

            // Fallback to console UI
            Logger.info(
                `Falling back to generic console UI for ${config.name}`
            );
            const consoleConfig: ConsoleUIConfig = {
                maxMessagesPerThread: config.config.maxMessagesPerThread || 50,
                gameTitle: config.name,
                welcomeMessage: `Welcome to ${config.name} (Custom UI failed, using console fallback)`,
                debugMode: false,
                userPrompt: "> ",
                enableColors: true,
                enablePostulations: true,
                autoSelectSingleAgent: false,
            };
            return new ConsoleGamificationUIWrapper(
                runtime,
                mcpAdapter,
                consoleConfig
            );
        }
    }
}

/**
 * Multi-UI Game Manager Events
 */
export enum MultiUIManagerEvent {
    UI_STARTED = "uiStarted",
    UI_STOPPED = "uiStopped",
    UI_ERROR = "uiError",
    ALL_UIS_READY = "allUIsReady",
    MESSAGE_BROADCAST = "messageBroadcast",
    SYNC_COMPLETED = "syncCompleted",
}

/**
 * UI Instance wrapper with metadata
 */
interface UIInstance {
    config: UIInstanceConfig;
    ui: GamificationUI;
    isStarted: boolean;
    startTime?: number;
    errorCount: number;
    lastSync?: number;
}

/**
 * Multi-UI Game Manager
 * Coordinates multiple GamificationUI instances with shared state and event synchronization
 */
export class MultiUIGameManager extends EventEmitter {
    private runtime: Runtime;
    private mcpAdapter: MCPDriverAdapter;
    private orchestrator: Orchestrator;
    private config: MultiUIGameConfig;

    // UI Management
    private uiInstances: Map<string, UIInstance> = new Map();
    private primaryUI?: UIInstance;
    private isRunning = false;

    // RxJS Coordination
    private destroy$ = new Subject<void>();
    private globalGameState$ = new BehaviorSubject<any>(null);
    private globalThread$ = new BehaviorSubject<GameThread | null>(null);
    private allUIEvents$ = new Subject<{
        uiId: string;
        event: string;
        data: any;
    }>();
    private syncTimer$ = new Subject<void>();

    constructor(
        runtime: Runtime,
        mcpAdapter: MCPDriverAdapter,
        orchestrator: Orchestrator,
        config: MultiUIGameConfig
    ) {
        super();
        this.runtime = runtime;
        this.mcpAdapter = mcpAdapter;
        this.orchestrator = orchestrator;
        this.config = config;

        this.setupGlobalStreams();
    }

    /**
     * Initialize and start all configured UI instances
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            throw new Error("MultiUIGameManager is already running");
        }

        Logger.info(
            `Starting Multi-UI Game Manager for '${this.config.game.name}'`
        );

        try {
            // Create UI instances
            await this.createUIInstances();

            // Setup cross-UI synchronization
            this.setupCrossUISync();

            // Start UI instances in priority order
            await this.startUIInstances();

            // Start sync timer if configured
            if (this.config.orchestration?.syncInterval) {
                this.startSyncTimer();
            }

            this.isRunning = true;
            this.emit(MultiUIManagerEvent.ALL_UIS_READY, {
                uiCount: this.uiInstances.size,
                config: this.config,
            });

            Logger.info(
                `Multi-UI Game Manager started with ${this.uiInstances.size} UI instances`
            );
        } catch (error) {
            Logger.error(
                "Failed to start Multi-UI Game Manager",
                error as Error
            );
            await this.stop();
            throw error;
        }
    }

    /**
     * Stop all UI instances and cleanup
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        Logger.info("Stopping Multi-UI Game Manager");

        this.isRunning = false;
        this.destroy$.next();

        // Stop all UI instances
        const stopPromises = Array.from(this.uiInstances.values()).map(
            async (instance) => {
                try {
                    if (instance.isStarted) {
                        await instance.ui.stop();
                        instance.isStarted = false;
                        this.emit(MultiUIManagerEvent.UI_STOPPED, {
                            uiId: instance.config.id,
                            config: instance.config,
                        });
                    }
                } catch (error) {
                    Logger.error(
                        `Error stopping UI ${instance.config.id}`,
                        error as Error
                    );
                }
            }
        );

        await Promise.all(stopPromises);

        // Cleanup
        this.uiInstances.clear();
        this.primaryUI = undefined;

        Logger.info("Multi-UI Game Manager stopped");
    }

    /**
     * Broadcast message to all UI instances
     */
    async broadcastMessage(
        message: GameMessage,
        excludeUIId?: string
    ): Promise<void> {
        const broadcastPromises = Array.from(this.uiInstances.values())
            .filter(
                (instance) =>
                    instance.config.id !== excludeUIId && instance.isStarted
            )
            .map(async (instance) => {
                try {
                    await instance.ui.displayMessage(message);
                } catch (error) {
                    Logger.error(
                        `Error broadcasting to UI ${instance.config.id}`,
                        error as Error
                    );
                    instance.errorCount++;
                }
            });

        await Promise.all(broadcastPromises);

        this.emit(MultiUIManagerEvent.MESSAGE_BROADCAST, {
            message,
            excludeUIId,
            targetCount: broadcastPromises.length,
        });
    }

    /**
     * Send message to specific UI instance
     */
    async sendToUI(uiId: string, message: GameMessage): Promise<void> {
        const instance = this.uiInstances.get(uiId);
        if (!instance || !instance.isStarted) {
            throw new Error(`UI instance '${uiId}' not found or not started`);
        }

        await instance.ui.displayMessage(message);
    }

    /**
     * Get UI instance by ID
     */
    getUIInstance(uiId: string): GamificationUI | undefined {
        return this.uiInstances.get(uiId)?.ui;
    }

    /**
     * Get primary UI instance
     */
    getPrimaryUI(): GamificationUI | undefined {
        return this.primaryUI?.ui;
    }

    /**
     * Get all active UI instances
     */
    getActiveUIInstances(): Map<string, GamificationUI> {
        const activeUIs = new Map<string, GamificationUI>();

        for (const [id, instance] of this.uiInstances) {
            if (instance.isStarted) {
                activeUIs.set(id, instance.ui);
            }
        }

        return activeUIs;
    }

    /**
     * Get manager statistics
     */
    getStats(): {
        isRunning: boolean;
        totalUIs: number;
        activeUIs: number;
        primaryUIId?: string;
        uptime?: number;
        errorCounts: Record<string, number>;
    } {
        const activeUIs = Array.from(this.uiInstances.values()).filter(
            (i) => i.isStarted
        );
        const uptime = this.primaryUI?.startTime
            ? Date.now() - this.primaryUI.startTime
            : undefined;

        const errorCounts: Record<string, number> = {};
        for (const [id, instance] of this.uiInstances) {
            errorCounts[id] = instance.errorCount;
        }

        return {
            isRunning: this.isRunning,
            totalUIs: this.uiInstances.size,
            activeUIs: activeUIs.length,
            primaryUIId: this.primaryUI?.config.id,
            uptime,
            errorCounts,
        };
    }

    // ===== Private Methods =====

    private async createUIInstances(): Promise<void> {
        const enabledUIs = this.config.ui.filter(
            (uiConfig) => uiConfig.enabled
        );

        for (const uiConfig of enabledUIs) {
            try {
                Logger.info(
                    `Creating UI instance: ${uiConfig.name} (${uiConfig.type})`
                );

                const uiResult = UIFactory.create(
                    uiConfig.type,
                    uiConfig,
                    this.runtime,
                    this.mcpAdapter
                );

                // Handle both sync and async UI creation
                const ui = await Promise.resolve(uiResult);

                // Connect Orchestrator channels if UI supports it
                const channels = this.orchestrator.getChannels();
                if (typeof (ui as any).connectOrchestrator === "function") {
                    try {
                        (ui as any).connectOrchestrator(channels);
                        Logger.info(`Connected Orchestrator channels to UI: ${uiConfig.name}`);
                    } catch (e) {
                        Logger.warn(`Failed to connect Orchestrator to UI ${uiConfig.name}`, e as Error);
                    }
                }

                const instance: UIInstance = {
                    config: uiConfig,
                    ui,
                    isStarted: false,
                    errorCount: 0,
                };

                this.uiInstances.set(uiConfig.id, instance);

                // Set primary UI
                if (
                    uiConfig.config.isPrimary ||
                    uiConfig.id === this.config.orchestration?.primaryUIId
                ) {
                    this.primaryUI = instance;
                }

                // Setup UI event handling
                this.setupUIEventHandling(instance);
            } catch (error) {
                Logger.error(
                    `Failed to create UI instance ${uiConfig.id}`,
                    error as Error
                );
                throw error;
            }
        }

        // Ensure we have a primary UI
        if (!this.primaryUI && this.uiInstances.size > 0) {
            // Use first UI as primary if none specified
            this.primaryUI = Array.from(this.uiInstances.values())[0];
            Logger.info(
                `Using ${this.primaryUI.config.id} as primary UI (auto-selected)`
            );
        }
    }

    private async startUIInstances(): Promise<void> {
        // Sort by priority (higher priority first)
        const sortedInstances = Array.from(this.uiInstances.values()).sort(
            (a, b) =>
                (b.config.config.priority || 0) -
                (a.config.config.priority || 0)
        );

        for (const instance of sortedInstances) {
            try {
                Logger.info(`Starting UI instance: ${instance.config.name}`);

                await instance.ui.start();
                instance.isStarted = true;
                instance.startTime = Date.now();

                this.emit(MultiUIManagerEvent.UI_STARTED, {
                    uiId: instance.config.id,
                    config: instance.config,
                });

                Logger.info(`UI instance started: ${instance.config.name}`);
            } catch (error) {
                Logger.error(
                    `Failed to start UI instance ${instance.config.id}`,
                    error as Error
                );
                instance.errorCount++;
                this.emit(MultiUIManagerEvent.UI_ERROR, {
                    uiId: instance.config.id,
                    error: error as Error,
                });
            }
        }
    }

    private setupUIEventHandling(instance: UIInstance): void {
        const uiId = instance.config.id;
        const channels = this.orchestrator.getChannels();

        // Forward all UI events to global stream
        Object.values(GamificationUIEvent).forEach((eventType) => {
            instance.ui.on(eventType, (data: any) => {
                this.allUIEvents$.next({ uiId, event: eventType, data });
            });
        });

        // Handle specific events
        instance.ui.on(GamificationUIEvent.USER_INPUT, (data: any) => {
            // Forward to orchestrator app channel
            try {
                channels.app.sendActionRequest(uiId, "user_input", [data]);
            } catch (e) {
                Logger.warn(`Failed to forward user input to orchestrator from UI ${uiId}`, e as Error);
            }
            this.handleUserInput(uiId, data);
        });

        instance.ui.on(GamificationUIEvent.AGENT_MESSAGE, (data: any) => {
            // Forward to orchestrator UI channel
            try {
                channels.ui.sendDisplayUpdate(uiId, "agent-message", "info", data?.message?.content || "");
            } catch (e) {
                Logger.warn(`Failed to forward agent message to orchestrator from UI ${uiId}`, e as Error);
            }
            this.handleAgentMessage(uiId, data);
        });

        instance.ui.on(GamificationUIEvent.PHASE_CHANGED, (data: any) => {
            // Forward to orchestrator UI channel
            try {
                channels.ui.sendDisplayUpdate(uiId, "phase-change", "info", data?.phase || data);
            } catch (e) {
                Logger.warn(`Failed to forward phase change to orchestrator from UI ${uiId}`, e as Error);
            }
        });

        instance.ui.on(GamificationUIEvent.ERROR_OCCURRED, (error: any) => {
            // Forward to orchestrator system channel
            try {
                channels.sys.sendError(uiId, error instanceof Error ? error : new Error(String(error)), "UI error");
            } catch (e) {
                Logger.warn(`Failed to forward error to orchestrator from UI ${uiId}`, e as Error);
            }
        });

        instance.ui.on(GamificationUIEvent.STATE_CHANGED, (data: any) => {
            // Forward to orchestrator UI channel
            try {
                channels.ui.sendDisplayUpdate(uiId, "state-display", "info", JSON.stringify(data?.state ?? data));
            } catch (e) {
                Logger.warn(`Failed to forward state change to orchestrator from UI ${uiId}`, e as Error);
            }
            this.globalGameState$.next(data?.state ?? data);
        });

        instance.ui.on(GamificationUIEvent.THREAD_STARTED, (data: any) => {
            this.globalThread$.next(data.thread);
        });
    }

    private setupGlobalStreams(): void {
        // Global game state changes
        this.globalGameState$
            .pipe(
                takeUntil(this.destroy$),
                filter((state) => state !== null)
            )
            .subscribe((state) => {
                this.syncGameStateToAllUIs(state);
            });

        // Global thread changes
        this.globalThread$
            .pipe(
                takeUntil(this.destroy$),
                filter((thread) => thread !== null)
            )
            .subscribe((thread) => {
                this.syncThreadToAllUIs(thread);
            });

        // All UI events processing
        this.allUIEvents$
            .pipe(
                takeUntil(this.destroy$),
                tap((event) => this.logUIEvent(event)),
                catchError((error) => {
                    Logger.error("Error in UI event stream", error);
                    return EMPTY;
                })
            )
            .subscribe();
    }

    private setupCrossUISync(): void {
        if (!this.config.orchestration?.enableEventBroadcasting) {
            return;
        }

        // Sync timer events
        this.syncTimer$.pipe(takeUntil(this.destroy$)).subscribe(() => {
            this.performSync();
        });
    }

    private startSyncTimer(): void {
        const interval = this.config.orchestration?.syncInterval || 1000;

        const syncInterval = setInterval(() => {
            this.syncTimer$.next();
        }, interval);

        // Cleanup on destroy
        this.destroy$.subscribe(() => {
            clearInterval(syncInterval);
        });
    }

    private async handleUserInput(uiId: string, data: any): Promise<void> {
        if (this.config.orchestration?.enableEventBroadcasting) {
            // Broadcast user input to other UIs as system message
            const systemMessage: GameMessage = {
                id: `sync_${Date.now()}`,
                type: "system",
                content: `[${uiId}] User: ${data.input}`,
                timestamp: Date.now(),
                metadata: { sourceUI: uiId, originalData: data },
            };

            await this.broadcastMessage(systemMessage, uiId);
        }
    }

    private async handleAgentMessage(uiId: string, data: any): Promise<void> {
        if (this.config.orchestration?.enableEventBroadcasting) {
            // Broadcast agent message to other UIs
            await this.broadcastMessage(data.message, uiId);
        }
    }

    private async syncGameStateToAllUIs(state: any): Promise<void> {
        for (const instance of this.uiInstances.values()) {
            if (instance.isStarted) {
                try {
                    // Update UI internal state using protected method
                    if (
                        typeof (instance.ui as any).handleGameStateUpdate ===
                        "function"
                    ) {
                        await (instance.ui as any).handleGameStateUpdate(state);
                    }
                    instance.lastSync = Date.now();
                } catch (error) {
                    Logger.error(
                        `Error syncing state to UI ${instance.config.id}`,
                        error as Error
                    );
                    instance.errorCount++;
                }
            }
        }
    }

    private async syncThreadToAllUIs(thread: GameThread | null): Promise<void> {
        for (const instance of this.uiInstances.values()) {
            if (instance.isStarted) {
                try {
                    // Update UI thread using protected method
                    if (
                        typeof (instance.ui as any).handleThreadUpdate ===
                        "function"
                    ) {
                        await (instance.ui as any).handleThreadUpdate(thread);
                    }
                } catch (error) {
                    Logger.error(
                        `Error syncing thread to UI ${instance.config.id}`,
                        error as Error
                    );
                    instance.errorCount++;
                }
            }
        }
    }

    private async performSync(): Promise<void> {
        const syncData = {
            timestamp: Date.now(),
            gameState: this.runtime.getCurrentState(),
            primaryUIThread: this.primaryUI?.ui.getCurrentThread(),
        };

        // Sync all UIs
        await Promise.all([
            this.syncGameStateToAllUIs(syncData.gameState),
            this.syncThreadToAllUIs(syncData.primaryUIThread || null),
        ]);

        this.emit(MultiUIManagerEvent.SYNC_COMPLETED, syncData);
    }

    private logUIEvent(event: {
        uiId: string;
        event: string;
        data: any;
    }): void {
        if (this.config.shared?.debugMode) {
            Logger.mcpVerbose("Multi-UI Event", {
                uiId: event.uiId,
                event: event.event,
                data: event.data,
            });
        }
    }

    /**
     * Cleanup resources
     */
    async destroy(): Promise<void> {
        await this.stop();
        this.destroy$.complete();
        this.removeAllListeners();
    }
}

export default MultiUIGameManager;
