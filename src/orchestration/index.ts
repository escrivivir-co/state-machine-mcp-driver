/**
 * RxJS Orchestrator - Main Exports
 * Comprehensive RxJS-based communication orchestrator with three channels
 */

// Core orchestrator
export { Orchestrator } from './orchestrator';
export type { OrchestratorStatistics } from './orchestrator';

// Channel implementations
export { AppChannelImpl, SysChannelImpl, UIChannelImpl } from './channels';
export { BaseChannel } from './BaseChannel';
export type { ChannelStats } from './BaseChannel';

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
  OrchestratorComponent,
  IOrchestratorChannels,
  
  // Configuration
  OrchestratorConfig,
  
  // Events
  OrchestratorEvents
} from './types';

// Example components
export { 
  StateManagerComponent,
  UIControllerComponent,
  SystemMonitorComponent
} from './components';

// Usage examples
export {
  basicUsageExample,
  componentIntegrationExample,
  advancedFilteringExample,
  customComponentExample,
  errorHandlingExample,
  performanceExample,
  runAllExamples
} from './examples';

/**
 * Quick Start Factory Functions
 */

import { Orchestrator } from './orchestrator';
import { 
  StateManagerComponent,
  UIControllerComponent,
  SystemMonitorComponent
} from './components';

/**
 * Create a basic orchestrator with minimal configuration
 */
export function createBasicOrchestrator(): Orchestrator {
  return new Orchestrator({
    enableReplay: true,
    replayBufferSize: 50,
    enableLogging: true,
    enableCrossChannelRouting: true
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
    autoRegisterComponents: [
      new StateManagerComponent(),
      new UIControllerComponent(),
      new SystemMonitorComponent()
    ]
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
    messageTimeout: 1000
  });
}

/**
 * Create a development orchestrator with verbose logging
 */
export function createDevelopmentOrchestrator(): Orchestrator {
  return new Orchestrator({
    enableReplay: true,
    replayBufferSize: 200, // Larger buffer for debugging
    enableLogging: true,
    enableCrossChannelRouting: true,
    messageTimeout: 10000, // Longer timeout for debugging
    autoRegisterComponents: [
      new StateManagerComponent(),
      new UIControllerComponent(),
      new SystemMonitorComponent()
    ]
  });
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
 * import { OrchestratorComponent, IOrchestratorChannels } from './orchestration';
 * 
 * class MyComponent implements OrchestratorComponent {
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
