/**
 * State Machine MCP Driver - Logger Configuration
 * Centralized logging system using Winston
 */

import winston from 'winston';

// Log levels
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn', 
  INFO = 'info',
  DEBUG = 'debug'
}

// Logger configuration interface
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  logDir: string;
  format: 'json' | 'simple' | 'combined';
  verboseMode?: boolean;
  quietMode?: boolean;
}

// Default logger configuration
const defaultConfig: LoggerConfig = {
  level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
  enableConsole: true,
  enableFile: process.env.NODE_ENV === 'production',
  logDir: process.env.LOG_DIR || 'logs',
  format: (process.env.LOG_FORMAT as 'json' | 'simple' | 'combined') || 'simple',
  verboseMode: process.env.MCP_VERBOSE === 'true' || process.env.DEBUG === '*',
  quietMode: process.env.MCP_QUIET === 'true'
};

// Create custom formats
const customFormats = {
  simple: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`;
    })
  ),
  json: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  combined: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [${level.toUpperCase()}]: ${message}${stack ? `\n${stack}` : ''}${metaStr}`;
    })
  )
};

// Create transports based on configuration
function createTransports(config: LoggerConfig): winston.transport[] {
  const transports: winston.transport[] = [];

  // Console transport
  if (config.enableConsole) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          customFormats[config.format]
        )
      })
    );
  }

  // File transports
  if (config.enableFile) {
    // Error log file
    transports.push(
      new winston.transports.File({
        filename: `${config.logDir}/error.log`,
        level: LogLevel.ERROR,
        format: customFormats.json
      })
    );

    // Combined log file
    transports.push(
      new winston.transports.File({
        filename: `${config.logDir}/combined.log`,
        format: customFormats.json
      })
    );

    // Debug log file (only in development)
    if (process.env.NODE_ENV === 'development') {
      transports.push(
        new winston.transports.File({
          filename: `${config.logDir}/debug.log`,
          level: LogLevel.DEBUG,
          format: customFormats.json
        })
      );
    }
  }

  return transports;
}

// Create the main logger instance
export const logger = winston.createLogger({
  level: defaultConfig.level,
  format: customFormats[defaultConfig.format],
  transports: createTransports(defaultConfig),
  // Handle uncaught exceptions and unhandled rejections
  exceptionHandlers: defaultConfig.enableFile ? [
    new winston.transports.File({ filename: `${defaultConfig.logDir}/exceptions.log` })
  ] : [],
  rejectionHandlers: defaultConfig.enableFile ? [
    new winston.transports.File({ filename: `${defaultConfig.logDir}/rejections.log` })
  ] : []
});

// Logger utility functions
export class Logger {
  /**
   * Create a child logger with additional context
   */
  static child(context: Record<string, any>): winston.Logger {
    return logger.child(context);
  }

  /**
   * Log an error with context
   */
  static error(message: string, error?: Error, context?: Record<string, any>): void {
    logger.error(message, { error: error?.message, stack: error?.stack, ...context });
  }

  /**
   * Log a warning with context
   */
  static warn(message: string, context?: Record<string, any>): void {
    logger.warn(message, context);
  }

  /**
   * Log an info message with context
   */
  static info(message: string, context?: Record<string, any>): void {
    logger.info(message, context);
  }

  /**
   * Log a debug message with context
   */
  static debug(message: string, context?: Record<string, any>): void {
    logger.debug(message, context);
  }

  /**
   * Log MCP operation
   */
  static mcpOperation(
    operation: string,
    serverId: string,
    success: boolean,
    duration?: number,
    error?: Error
  ): void {
    const context = {
      operation,
      serverId,
      success,
      duration,
      error: error?.message
    };

    if (success) {
      logger.info(`MCP operation completed: ${operation}`, context);
    } else {
      logger.error(`MCP operation failed: ${operation}`, context);
    }
  }

  /**
   * Log state transition
   */
  static stateTransition(
    userId: string,
    graphId: string,
    fromState: string,
    toState: string,
    trigger: string
  ): void {
    logger.info('State transition', {
      userId,
      graphId,
      fromState,
      toState,
      trigger,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log runtime operation
   */
  static runtime(message: string, context?: Record<string, any>): void {
    if (!defaultConfig.quietMode) {
      logger.info(`[RUNTIME] ${message}`, context);
    }
  }

  /**
   * Log MCP operation with verbose control
   */
  static mcpVerbose(message: string, context?: Record<string, any>): void {
    if (defaultConfig.verboseMode && !defaultConfig.quietMode) {
      logger.debug(`]: ${message}`, context);
    }
  }

  /**
   * Log MCP operation - always shown unless quiet mode
   */
  static mcpInfo(message: string, context?: Record<string, any>): void {
    if (!defaultConfig.quietMode) {
      logger.info(`]: ${message}`, context);
    }
  }

  /**
   * Log MCP errors - always shown
   */
  static mcpError(message: string, context?: Record<string, any>): void {
    logger.error(`]: ${message}`, context);
  }

  /**
   * Enable verbose mode
   */
  static enableVerbose(): void {
    defaultConfig.verboseMode = true;
    defaultConfig.quietMode = false;
    logger.info('MCP: Verbose mode enabled');
  }

  /**
   * Enable quiet mode
   */
  static enableQuiet(): void {
    defaultConfig.verboseMode = false;
    defaultConfig.quietMode = true;
    logger.info('MCP: Quiet mode enabled');
  }

  /**
   * Disable verbose and quiet modes (normal mode)
   */
  static normalMode(): void {
    defaultConfig.verboseMode = false;
    defaultConfig.quietMode = false;
    logger.info('MCP: Normal logging mode enabled');
  }

  /**
   * Get current logging mode
   */
  static getMode(): 'verbose' | 'quiet' | 'normal' {
    if (defaultConfig.verboseMode) return 'verbose';
    if (defaultConfig.quietMode) return 'quiet';
    return 'normal';
  }

  /**
   * Reconfigure logger with new settings
   */
  static configure(config: Partial<LoggerConfig>): void {
    const newConfig = { ...defaultConfig, ...config };
    
    // Update the current config
    Object.assign(defaultConfig, newConfig);
    
    // Clear existing transports
    logger.clear();
    
    // Add new transports
    createTransports(newConfig).forEach(transport => {
      logger.add(transport);
    });
    
    // Update log level
    logger.level = newConfig.level;
  }
}

// Export the default logger instance
export default logger;
