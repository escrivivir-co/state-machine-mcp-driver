/**
 * Multi-UI Game Configuration
 * Configuration for launching multiple GamificationUI instances simultaneously
 */

import { OrchestratorConfig } from "@/orchestration";
import { BaseGamificationUIConfig } from "./GamificationUI";
import { MCPServerConfig } from "@/drivers";
import { AppConfigMcpServers } from "@/utils/config";

/**
 * UI Type identifiers
 */
export type UIType = "console" | "html5" | "threejs" | "unity" | "mobile" | "vr" | "custom";

/**
 * Configuration for a single UI instance
 */
export interface UIInstanceConfig {
    /** Unique identifier for this UI instance */
    id: string;
    /** Type of UI */
    type: UIType;
    /** Display name */
    name: string;
    /** UI-specific configuration */
    config: BaseGamificationUIConfig & {
        /** Port for web-based UIs */
        port?: number;
        /** Static directory for ThreeJS UI */
        staticDir?: string;
        /** Build directory for Unity WebGL */
        buildDir?: string;
        /** Unity build name (default: index.html) */
        unityBuildName?: string;
        /** CORS origin for web UIs */
        corsOrigin?: string;
        /** Custom implementation class path for custom UIs */
        customClass?: string;
        /** Whether to launch custom UI in independent console (default: true) */
        launchInIndependentConsole?: boolean;
        /** Priority for event processing (higher = first) */
        priority?: number;
        /** Whether this UI is the primary interface */
        isPrimary?: boolean;
        /** Auto-build Angular app before serving (ThreeJS) */
        autoBuild?: boolean;
        /** Provide pre-compiled Angular template instead of dynamic HTML (ThreeJS) */
        provideTemplate?: boolean;
        /** Auto-open browser for web UIs */
        autoOpenBrowser?: boolean;
        /** Path to Angular project for ThreeJS UI */
        angularProjectPath?: string;
        /** Path to Unity project for Unity UI */
        unityProjectPath?: string;
        /** Unity build target (default: WebGL) */
        unityBuildTarget?: string;
    };
    /** Whether this UI is enabled */
    enabled: boolean;
}

/**
 * Multi-UI game configuration
 */
export interface MultiUIGameConfig {
    /** Game metadata */
    game: {
        id: string;
        name: string;
        version: string;
        description?: string;
    };

    /** UI instances to launch */
    ui: UIInstanceConfig[];

    /** Shared game configuration */
    shared: {
        /** Game title shown across all UIs */
        gameTitle: string;
        /** Welcome message */
        welcomeMessage?: string;
        /** Debug mode for all UIs */
        debugMode?: boolean;
        /** Maximum messages per thread */
        maxMessagesPerThread?: number;
        /** Enable postulations system */
        enablePostulations?: boolean;
    };

    /** Orchestration settings */
    orchestration: OrchestratorConfig;

	mcp: {
		servers: AppConfigMcpServers;
	};
}

/**
 * Example Multi-UI Configurations
 */

/**
 * X+1 Game with Console + HTML5 UIs
 */
export const X_PLUS_1_MULTI_UI: MultiUIGameConfig = {
    game: {
        id: "x-plus-1-multi",
        name: "X+1 Game (Multi-UI)",
        version: "1.0.0",
        description:
            "The X+1 incremental decision game with multiple UI interfaces",
    },

    ui: [
        {
            id: "console-primary",
            type: "console",
            name: "Console Interface",
            enabled: true,
            config: {
                gameTitle: "X+1 Game - Console",
                welcomeMessage:
                    "Welcome to X+1 Game on Console! Type your decisions and watch the magic happen.",
                debugMode: false,
                maxMessagesPerThread: 50,
                enablePostulations: true,
                isPrimary: true,
                priority: 10,
            },
        },
        {
            id: "web-interface",
            type: "html5",
            name: "Web Interface",
            enabled: true,
            config: {
                gameTitle: "X+1 Game - Web UI",
                welcomeMessage:
                    "Welcome to X+1 Game in your browser! Click, tap, and interact.",
                debugMode: false,
                maxMessagesPerThread: 50,
                enablePostulations: true,
                port: 8080,
                isPrimary: false,
                priority: 5,
            },
        },
    ],

    shared: {
        gameTitle: "X+1 Incremental Decision Game",
        welcomeMessage: "Experience the X+1 game across multiple interfaces!",
        debugMode: false,
        maxMessagesPerThread: 50,
        enablePostulations: true,
    },

    orchestration: {
        syncInterval: 100,
        enableEventBroadcasting: true,
        primaryUIId: "console-primary",
    },

    mcp: {
        servers: {},
    },
};

/**
 * Development Multi-UI (Console + HTML5 + Mobile simulation)
 */
export const DEV_MULTI_UI: MultiUIGameConfig = {
    game: {
        id: "dev-multi",
        name: "Development Multi-UI Demo",
        version: "1.0.0",
        description: "Development demo with multiple UI types",
    },

    ui: [
        {
            id: "console",
            type: "console",
            name: "Console (Primary)",
            enabled: true,
            config: {
                gameTitle: "Dev Demo - Console",
                debugMode: true,
                isPrimary: true,
                priority: 10,
            },
        },
        {
            id: "web-main",
            type: "html5",
            name: "Web Main Interface",
            enabled: true,
            config: {
                gameTitle: "Dev Demo - Web",
                debugMode: true,
                port: 8080,
                priority: 5,
            },
        },
        {
            id: "web-admin",
            type: "html5",
            name: "Web Admin Interface",
            enabled: false, // Disabled by default
            config: {
                gameTitle: "Dev Demo - Admin",
                debugMode: true,
                port: 8081,
                priority: 1,
            },
        },
    ],

    shared: {
        gameTitle: "Multi-UI Development Demo",
        debugMode: true,
        maxMessagesPerThread: 100,
        enablePostulations: true,
    },

    orchestration: {
        syncInterval: 50, // Faster sync for development
        enableEventBroadcasting: true,
        primaryUIId: "console",
    },

    mcp: {
        servers: {},
    },
};

/**
 * Console-only configuration (for compatibility)
 */
export const CONSOLE_ONLY: MultiUIGameConfig = {
    game: {
        id: "console-only",
        name: "Console Only Game",
        version: "1.0.0",
    },

    ui: [
        {
            id: "console",
            type: "console",
            name: "Console Interface",
            enabled: true,
            config: {
                gameTitle: "Console Game",
                isPrimary: true,
                priority: 10,
            },
        },
    ],

    shared: {
        gameTitle: "Console Game",
        enablePostulations: true,
    },

    orchestration: {
        enableEventBroadcasting: false,
        primaryUIId: "console",
    },

    mcp: {
        servers: {},
    },
};

/**
 * Get predefined multi-UI configuration
 */
export function getMultiUIConfig(configName: string): MultiUIGameConfig | null {
    switch (configName) {
        case "x-plus-1":
            // Auto-detect if multi-UI should be used for x-plus-1
            // Check for environment variable or configuration file
            const useMultiUI =
                process.env.ENABLE_MULTI_UI === "true" ||
                process.env.UI_MODE === "multi";
            if (useMultiUI) {
                // Try to load from JSON config file first
                try {
                    const configPath =
                        "./examples/configs/x-plus-1-multi-ui.json";
                    const configFile = require(configPath);
                    return configFile;
                } catch (error) {
                    console.warn(
                        "⚠️ Could not load JSON config, using hardcoded fallback"
                    );
                    return X_PLUS_1_MULTI_UI;
                }
            }
            return null;
        case "x-plus-1-multi":
            // Deprecated: Configuration should be passed from launcher
            console.warn(
                "⚠️ getMultiUIConfig() is deprecated. Configuration should be passed from launcher."
            );
            return X_PLUS_1_MULTI_UI; // Hardcoded fallback only
        case "dev-multi":
            return DEV_MULTI_UI;
        case "console-only":
            return CONSOLE_ONLY;
        default:
            return null;
    }
}

/**
 * Validate multi-UI configuration
 */
export function validateMultiUIConfig(config: MultiUIGameConfig): string[] {
    const errors: string[] = [];

    // Check basic structure
    if (!config.game?.id) {
        errors.push("Game ID is required");
    }

    if (!config.ui || config.ui.length === 0) {
        errors.push("At least one UI instance is required");
    }

    // Check UI instances
    const enabledUIs = config.ui.filter((ui) => ui.enabled);
    if (enabledUIs.length === 0) {
        errors.push("At least one UI instance must be enabled");
    }

    // Check for duplicate IDs
    const uiIds = config.ui.map((ui) => ui.id);
    const duplicateIds = uiIds.filter(
        (id, index) => uiIds.indexOf(id) !== index
    );
    if (duplicateIds.length > 0) {
        errors.push(`Duplicate UI IDs found: ${duplicateIds.join(", ")}`);
    }

    // Check for duplicate ports
    const webUIs = config.ui.filter(
        (ui) => ui.type === "html5" && ui.enabled && ui.config.port
    );
    const ports = webUIs.map((ui) => ui.config.port);
    const duplicatePorts = ports.filter(
        (port, index) => ports.indexOf(port) !== index
    );
    if (duplicatePorts.length > 0) {
        errors.push(`Duplicate ports found: ${duplicatePorts.join(", ")}`);
    }

    // Check primary UI
    if (config.orchestration?.primaryUIId) {
        const primaryUI = config.ui.find(
            (ui) => ui.id === config.orchestration.primaryUIId
        );
        if (!primaryUI) {
            errors.push(
                `Primary UI '${config.orchestration.primaryUIId}' not found`
            );
        } else if (!primaryUI.enabled) {
            errors.push(
                `Primary UI '${config.orchestration.primaryUIId}' is not enabled`
            );
        }
    }

    return errors;
}

export default MultiUIGameConfig;
