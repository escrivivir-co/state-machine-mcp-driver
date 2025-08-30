/**
 * RxJS Orchestrator - Main Exports
 * Comprehensive RxJS-based communication orchestrator with three channels
 */

// Core orchestrator
export { Orchestrator } from "./orchestrator";
export type { OrchestratorStatistics } from "./orchestrator";

// Channel implementations
export { BaseChannel } from "./base-channel";
export type { ChannelStats } from "./base-channel";

// Types and interfaces
export type {
    // Message types
    BaseMessage,
    AppMessage,
    SysMessage,
    UIMessage,

    // Channel interfaces
    AppChannel,
    SysChannel,
    UIChannel,

    // Component types
    ChannelAgent as OrchestratorDomainConsumer,
    IOrchestratorChannels,

    // Configuration
    OrchestratorConfig,

    // Events
    OrchestratorEvents,
} from "./types";

// Usage examples
export {
    basicUsageExample,
    componentIntegrationExample,
    advancedFilteringExample,
    customComponentExample,
    errorHandlingExample,
    performanceExample,
    runAllExamples,
} from "./examples";

import { AppConfig } from "@/utils";
import { AppChannelAgent } from "./channel/app-channel-agent";
import { SysChannelAgent } from "./channel/sys-channel-agent";
import { UIChannelAgent } from "./channel/ui-channel-agent";
/**
 * Quick Start Factory Functions
 */

import { Orchestrator } from "./orchestrator";

/**
 * Create a basic orchestrator with minimal configuration
 */
export function createBasicOrchestrator(): Orchestrator {
    return new Orchestrator({
        enableReplay: true,
        replayBufferSize: 50,
        enableLogging: true,
        enableCrossChannelRouting: true,
    });
}

/**
 * Create a production-ready orchestrator with all components
 */
export function createProductionOrchestrator(): Orchestrator {
    return new Orchestrator({
        enableReplay: true,
        replayBufferSize: 100,
        enableLogging: true,
        enableCrossChannelRouting: true,
        messageTimeout: 5000,
        autoRegisterComponentsKeys: [
            "AppChannelAgent",
            "UIChannelAgent",
            "SysChannelAgent",
        ],
    });
}

/**
 * Create a high-performance orchestrator for heavy workloads
 */
export function createHighPerformanceOrchestrator(): Orchestrator {
    return new Orchestrator({
        enableReplay: false, // Disable replay for better performance
        enableLogging: false, // Disable logging for better performance
        enableCrossChannelRouting: false, // Disable cross-channel routing
        messageTimeout: 1000,
    });
}

/**
 * Create a development orchestrator with verbose logging
 */
export function createDevelopmentOrchestrator(configContent: AppConfig): Orchestrator {
    return new Orchestrator(configContent.orchestration);
}

/**
 * Orchestrator Usage Guidelines
 *
 * ## Basic Usage
 *
 * ```typescript
 * import { createBasicOrchestrator } from './orchestration';
 *
 * const orchestrator = createBasicOrchestrator();
 * await orchestrator.start();
 *
 * // Send messages
 * orchestrator.app.sendStateTransition('myApp', 'idle', 'running');
 * orchestrator.sys.sendInfo('myApp', 'Application started');
 * orchestrator.ui.sendNotification('myApp', 'Welcome', 'App is ready!');
 *
 * // Listen to messages
 * orchestrator.app.stateTransitions$().subscribe(message => {
 *   console.log('State changed:', message.payload);
 * });
 *
 * await orchestrator.stop();
 * ```
 *
 * ## Component Development
 *
 * ```typescript
 * import { OrchestratorDomainConsumer, IOrchestratorChannels } from './orchestration';
 *
 * class MyComponent implements OrchestratorDomainConsumer {
 *   public readonly id = 'my-component';
 *   public readonly name = 'My Component';
 *
 *   async initialize(channels: IOrchestratorChannels): Promise<void> {
 *     // Listen to relevant messages
 *     channels.app.actionRequests$().subscribe(message => {
 *       // Handle action requests
 *     });
 *
 *     // Send initialization message
 *     channels.sys.sendInfo(this.id, 'Component initialized');
 *   }
 *
 *   async shutdown(): Promise<void> {
 *     // Cleanup logic
 *   }
 * }
 * ```
 *
 * ## Channel Types
 *
 * ### AppChannel
 * - Business logic and state management
 * - State transitions, action requests/results
 * - Agent commands and coordination
 *
 * ### SysChannel
 * - System health and monitoring
 * - Error reporting and logging
 * - Configuration changes
 * - Service status updates
 *
 * ### UIChannel
 * - User interactions and input
 * - Display updates and notifications
 * - UI phase changes and rendering
 * - User interface events
 *
 * ## Best Practices
 *
 * 1. **Use appropriate channels**: Route messages to the correct channel based on their purpose
 * 2. **Component isolation**: Components should communicate only through channels
 * 3. **Error handling**: Always handle errors in subscriptions
 * 4. **Resource cleanup**: Unsubscribe from observables and shutdown components properly
 * 5. **Message design**: Keep payloads simple and serializable
 * 6. **Performance**: Use replay buffers judiciously in production
 * 7. **Debugging**: Enable logging and larger buffers in development
 */
