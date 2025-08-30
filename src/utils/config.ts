/**
 * State Machine MCP Driver - Configuration
 * Centralized application configuration management
 */

import { MultiUIGameConfig } from "@/ui/MultiUIGameConfig";
import { MCPServerConfig } from "../drivers";
import { LogLevel } from "./logger";

/**
 * Application configuration interface
 */
export interface AppConfig extends MultiUIGameConfig {
    /** Server port */
    port: number;
    /** Node environment */
    nodeEnv: "development" | "production" | "test";
    /** MCP server configurations */
    mcpServers: MCPServerConfig[];
    /** Logging configuration */
    logging: {
        level: LogLevel;
        format: "json" | "simple" | "combined";
        enableFile: boolean;
        logDir: string;
    };
    /** Session configuration */
    session: {
        /** Session timeout in milliseconds */
        timeout: number;
        /** Enable automatic session cleanup */
        cleanup: boolean;
        /** Cleanup interval in milliseconds */
        cleanupInterval: number;
    };
    /** Security configuration */
    security: {
        /** Enable API key authentication */
        enableAuth: boolean;
        /** API keys for authentication */
        apiKeys: string[];
        /** CORS configuration */
        cors: {
            origin: string | string[];
            credentials: boolean;
        };
    };
    /** Performance configuration */
    performance: {
        /** Maximum concurrent MCP requests */
        maxConcurrentRequests: number;
        /** Request timeout in milliseconds */
        requestTimeout: number;
        /** Enable request caching */
        enableCaching: boolean;
        /** Cache TTL in milliseconds */
        cacheTtl: number;
    };
    /** Development configuration */
    development: {
        /** Enable hot reload */
        hotReload: boolean;
        /** Enable debug mode */
        debug: boolean;
        /** Mock MCP servers in development */
        mockServers: boolean;
    };
}

/**
 * Parse environment variable as JSON or return default
 */
function parseEnvJson<T>(envVar: string | undefined, defaultValue: T): T {
    if (!envVar) return defaultValue;

    try {
        return JSON.parse(envVar) as T;
    } catch (error) {
        console.warn(`Failed to parse ${envVar} as JSON, using default value`);
        return defaultValue;
    }
}

/**
 * Parse environment variable as number or return default
 */
function parseEnvNumber(
    envVar: string | undefined,
    defaultValue: number
): number {
    if (!envVar) return defaultValue;

    const parsed = parseInt(envVar, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse environment variable as boolean or return default
 */
function parseEnvBoolean(
    envVar: string | undefined,
    defaultValue: boolean
): boolean {
    if (!envVar) return defaultValue;
    return envVar.toLowerCase() === "true";
}

/**
 * Default MCP server configurations
 */
const defaultMCPServers: MCPServerConfig[] = parseEnvJson(
    process.env.MCP_SERVERS,
    [
        {
            id: "default-server",
            name: "Default MCP Server",
            url: process.env.DEFAULT_MCP_URL || "http://localhost:3001/api",
            timeout: 30000,
            maxRetries: 3,
        },
    ]
);

/**
 * Main application configuration
 */
export const config: AppConfig = {
	port: parseEnvNumber(process.env.PORT, 3000),
	nodeEnv: (process.env.NODE_ENV as AppConfig["nodeEnv"]) || "development",

	mcpServers: defaultMCPServers,

	logging: {
		level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
		format: (process.env.LOG_FORMAT as "json" | "simple" | "combined") ||
			"simple",
		enableFile: parseEnvBoolean(
			process.env.LOG_ENABLE_FILE,
			process.env.NODE_ENV === "production"
		),
		logDir: process.env.LOG_DIR || "logs",
	},

	session: {
		timeout: parseEnvNumber(process.env.SESSION_TIMEOUT, 3600000), // 1 hour
		cleanup: parseEnvBoolean(process.env.SESSION_CLEANUP, true),
		cleanupInterval: parseEnvNumber(
			process.env.SESSION_CLEANUP_INTERVAL,
			300000
		), // 5 minutes
	},

	security: {
		enableAuth: parseEnvBoolean(process.env.ENABLE_AUTH, false),
		apiKeys: parseEnvJson(process.env.API_KEYS, []),
		cors: {
			origin: parseEnvJson(process.env.CORS_ORIGIN, "*"),
			credentials: parseEnvBoolean(process.env.CORS_CREDENTIALS, true),
		},
	},

	performance: {
		maxConcurrentRequests: parseEnvNumber(
			process.env.MAX_CONCURRENT_REQUESTS,
			100
		),
		requestTimeout: parseEnvNumber(process.env.REQUEST_TIMEOUT, 30000),
		enableCaching: parseEnvBoolean(process.env.ENABLE_CACHING, false),
		cacheTtl: parseEnvNumber(process.env.CACHE_TTL, 300000), // 5 minutes
	},

	development: {
		hotReload: parseEnvBoolean(
			process.env.HOT_RELOAD,
			process.env.NODE_ENV === "development"
		),
		debug: parseEnvBoolean(
			process.env.DEBUG,
			process.env.NODE_ENV === "development"
		),
		mockServers: parseEnvBoolean(
			process.env.MOCK_SERVERS,
			process.env.NODE_ENV === "development"
		),
	},
	game: {
		id: "",
		name: "",
		version: "",
		description: undefined
	},
	ui: [],
	shared: {
		gameTitle: "",
		welcomeMessage: undefined,
		debugMode: undefined,
		maxMessagesPerThread: undefined,
		enablePostulations: undefined
	},
	orchestration: {
		
	},
	mcp: {
		servers: []
	}
};

/**
 * Configuration utilities
 */
export class ConfigManager {
    /**
     * Validate configuration for required values
     */
    static validate(config: AppConfig): string[] {
        const errors: string[] = [];

        if (config.port <= 0 || config.port > 65535) {
            errors.push("Port must be between 1 and 65535");
        }

        if (config.mcpServers.length === 0) {
            errors.push("At least one MCP server must be configured");
        }

        config.mcpServers.forEach((server, index) => {
            if (!server.id) errors.push(`MCP server ${index}: ID is required`);
            if (!server.name)
                errors.push(`MCP server ${index}: Name is required`);
            if (!server.url)
                errors.push(`MCP server ${index}: URL is required`);

            try {
                new URL(server.url);
            } catch {
                errors.push(`MCP server ${index}: Invalid URL format`);
            }
        });

        if (config.session.timeout <= 0) {
            errors.push("Session timeout must be positive");
        }

        if (config.performance.maxConcurrentRequests <= 0) {
            errors.push("Max concurrent requests must be positive");
        }

        return errors;
    }

    /**
     * Get configuration for specific environment
     */
    static forEnvironment(
        env: "development" | "production" | "test"
    ): Partial<AppConfig> {
        switch (env) {
            case "development":
                return {
                    logging: {
                        level: LogLevel.DEBUG,
                        format: "simple",
                        enableFile: false,
                        logDir: "logs",
                    },
                    development: {
                        hotReload: true,
                        debug: true,
                        mockServers: true,
                    },
                };

            case "production":
                return {
                    logging: {
                        level: LogLevel.INFO,
                        format: "json",
                        enableFile: true,
                        logDir: "/var/log/state-machine-mcp",
                    },
                    development: {
                        hotReload: false,
                        debug: false,
                        mockServers: false,
                    },
                };

            case "test":
                return {
                    logging: {
                        level: LogLevel.ERROR,
                        format: "simple",
                        enableFile: false,
                        logDir: "logs",
                    },
                    development: {
                        hotReload: false,
                        debug: false,
                        mockServers: true,
                    },
                };

            default:
                return {};
        }
    }

    /**
     * Merge configuration with overrides
     */
    static merge(base: AppConfig, overrides: Partial<AppConfig>): AppConfig {
        return {
            ...base,
            ...overrides,
            logging: { ...base.logging, ...overrides.logging },
            session: { ...base.session, ...overrides.session },
            security: { ...base.security, ...overrides.security },
            performance: { ...base.performance, ...overrides.performance },
            development: { ...base.development, ...overrides.development },
        };
    }

    /**
     * Create configuration summary for logging
     */
    static createSummary(config: AppConfig): Record<string, any> {
        return {
            port: config.port,
            environment: config.nodeEnv,
            mcpServerCount: config.mcpServers.length,
            logLevel: config.logging.level,
            authEnabled: config.security.enableAuth,
            cachingEnabled: config.performance.enableCaching,
            debugMode: config.development.debug,
        };
    }
}

// Validate configuration on import
const validationErrors = ConfigManager.validate(config);
if (validationErrors.length > 0) {
    console.error("Configuration validation errors:");
    validationErrors.forEach((error) => console.error(`- ${error}`));

    if (config.nodeEnv === "production") {
        process.exit(1);
    }
}

export default config;
