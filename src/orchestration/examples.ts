/**
 * RxJS Orchestrator Usage Examples
 * Comprehensive examples showing how to use the orchestrator
 */

import { Orchestrator } from './orchestrator';
import { 
  StateManagerComponent, 
  UIControllerComponent, 
  SystemMonitorComponent 
} from './components';
import { OrchestratorComponent, IOrchestratorChannels } from './types';

/**
 * Basic Usage Example
 */
export async function basicUsageExample(): Promise<void> {
  console.log('🎼 Starting Basic Usage Example');
  
  // Create orchestrator
  const orchestrator = new Orchestrator({
    enableReplay: true,
    replayBufferSize: 50,
    enableLogging: true,
    enableCrossChannelRouting: true
  });
  
  // Start orchestrator
  await orchestrator.start();
  
  // Send some messages to demonstrate the channels
  orchestrator.app.sendStateTransition('demo', 'initial', 'loading');
  orchestrator.sys.sendInfo('demo', 'System is starting up');
  orchestrator.ui.sendNotification('demo', 'Welcome', 'System is ready!', 'success');
  
  // Listen to all messages
  const subscription = orchestrator.getAllMessages$().subscribe(({ channel, message }) => {
    console.log(`📨 [${channel.toUpperCase()}] ${message.type} from ${message.source}`);
  });
  
  // Clean up after 5 seconds
  setTimeout(async () => {
    subscription.unsubscribe();
    await orchestrator.stop();
    orchestrator.destroy();
    console.log('✅ Basic example completed');
  }, 5000);
}

/**
 * Component Integration Example
 */
export async function componentIntegrationExample(): Promise<void> {
  console.log('🎼 Starting Component Integration Example');
  
  // Create orchestrator with auto-registered components
  const orchestrator = new Orchestrator({
    enableReplay: true,
    enableLogging: true,
    enableCrossChannelRouting: true,
    autoRegisterComponents: [
      new StateManagerComponent(),
      new UIControllerComponent(),
      new SystemMonitorComponent()
    ]
  });
  
  // Start orchestrator (components will be auto-registered)
  await orchestrator.start();
  
  // Simulate user interactions
  setTimeout(() => {
    orchestrator.ui.sendUserInput('user-1', '', 'get_state');
  }, 1000);
  
  setTimeout(() => {
    orchestrator.ui.sendUserInput('user-1', '', 'reset_state');
  }, 2000);
  
  setTimeout(() => {
    orchestrator.app.sendStateTransition('demo', 'initial', 'running');
  }, 3000);
  
  setTimeout(() => {
    orchestrator.sys.sendError('demo-service', new Error('Simulated error'), 'Test error');
  }, 4000);
  
  // Clean up after 10 seconds
  setTimeout(async () => {
    await orchestrator.stop();
    orchestrator.destroy();
    console.log('✅ Component integration example completed');
  }, 10000);
}

/**
 * Advanced Filtering and Routing Example
 */
export async function advancedFilteringExample(): Promise<void> {
  console.log('🎼 Starting Advanced Filtering Example');
  
  const orchestrator = new Orchestrator({
    enableReplay: true,
    enableLogging: true
  });
  
  await orchestrator.start();
  
  // Filter specific message types
  orchestrator.app.stateTransitions$().subscribe(message => {
    console.log(`🔄 State transition: ${message.payload.stateId} → ${message.payload.targetState}`);
  });
  
  orchestrator.sys.errors$().subscribe(message => {
    console.log(`❌ System error: ${message.payload.message}`);
  });
  
  orchestrator.ui.userInputs$().subscribe(message => {
    console.log(`👤 User input from ${message.source}: ${message.payload.input || message.payload.command}`);
  });
  
  // Filter by source
  orchestrator.getMessagesBySource$('critical-service').subscribe(({ channel, message }) => {
    console.log(`🚨 Critical service message on ${channel}: ${message.type}`);
  });
  
  // Filter by message type across all channels
  orchestrator.getMessagesByType$('error').subscribe(({ channel, message }) => {
    console.log(`⚠️ Error on ${channel} channel: ${JSON.stringify(message.payload)}`);
  });
  
  // Send test messages
  setTimeout(() => {
    orchestrator.app.sendStateTransition('test', 'idle', 'active');
    orchestrator.sys.sendError('critical-service', new Error('Critical failure'), 'System down');
    orchestrator.ui.sendUserInput('admin', 'shutdown system', 'shutdown');
  }, 1000);
  
  // Clean up
  setTimeout(async () => {
    await orchestrator.stop();
    orchestrator.destroy();
    console.log('✅ Advanced filtering example completed');
  }, 5000);
}

/**
 * Custom Component Example
 */
class LoggerComponent implements OrchestratorComponent {
  public readonly id = 'custom-logger';
  public readonly name = 'Custom Logger';
  
  private channels?: IOrchestratorChannels;
  private logCount = 0;
  
  async initialize(orchestrator: IOrchestratorChannels): Promise<void> {
    this.channels = orchestrator;
    
    // Log all messages from all channels
    orchestrator.app.messages$.subscribe(message => this.logMessage('APP', message));
    orchestrator.sys.messages$.subscribe(message => this.logMessage('SYS', message));
    orchestrator.ui.messages$.subscribe(message => this.logMessage('UI', message));
    
    orchestrator.sys.sendInfo(this.id, 'Custom Logger initialized');
  }
  
  async shutdown(): Promise<void> {
    if (this.channels) {
      this.channels.sys.sendInfo(this.id, `Custom Logger shutting down (logged ${this.logCount} messages)`);
    }
  }
  
  private logMessage(channel: string, message: any): void {
    this.logCount++;
    console.log(`📝 [${channel}] ${message.type}: ${JSON.stringify(message.payload)}`);
    
    // Send periodic stats
    if (this.logCount % 10 === 0) {
      this.channels?.sys.sendInfo(this.id, `Logged ${this.logCount} messages so far`);
    }
  }
}

export async function customComponentExample(): Promise<void> {
  console.log('🎼 Starting Custom Component Example');
  
  const orchestrator = new Orchestrator({
    enableLogging: false // Disable orchestrator logging to see our custom logger
  });
  
  await orchestrator.start();
  
  // Register custom component
  const logger = new LoggerComponent();
  await orchestrator.registerComponent(logger);
  
  // Generate some traffic
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      orchestrator.app.sendActionRequest('demo', `action_${i}`, { index: i });
      orchestrator.sys.sendInfo('demo', `Info message ${i}`);
      orchestrator.ui.sendDisplayUpdate('demo', 'display', 'info', `Update ${i}`);
    }, i * 500);
  }
  
  // Clean up
  setTimeout(async () => {
    await orchestrator.unregisterComponent(logger.id);
    await orchestrator.stop();
    orchestrator.destroy();
    console.log('✅ Custom component example completed');
  }, 5000);
}

/**
 * Error Handling and Recovery Example
 */
export async function errorHandlingExample(): Promise<void> {
  console.log('🎼 Starting Error Handling Example');
  
  const orchestrator = new Orchestrator({
    enableLogging: true,
    messageTimeout: 3000
  });
  
  // Listen for orchestrator events
  orchestrator.on('orchestrator:started', (data) => {
    console.log(`🚀 Orchestrator started at ${new Date(data.timestamp).toISOString()}`);
  });
  
  orchestrator.on('component:registered', (data) => {
    console.log(`📦 Component registered: ${data.componentName} (${data.componentId})`);
  });
  
  orchestrator.on('message:error', (data) => {
    console.log(`❌ Message error on ${data.channel}: ${data.error.message}`);
  });
  
  await orchestrator.start();
  
  // Simulate various error scenarios
  setTimeout(() => {
    // System error
    orchestrator.sys.sendError('failing-service', new Error('Database connection failed'), 'Critical error');
  }, 1000);
  
  setTimeout(() => {
    // Multiple errors to trigger system alerts
    for (let i = 0; i < 5; i++) {
      orchestrator.sys.sendError(`service-${i}`, new Error(`Service ${i} failed`), `Error in service ${i}`);
    }
  }, 2000);
  
  setTimeout(() => {
    // Recovery
    orchestrator.sys.sendInfo('recovery-service', 'All services restored');
    orchestrator.ui.sendNotification('system', 'Recovery Complete', 'All systems are operational', 'success');
  }, 3000);
  
  // Clean up
  setTimeout(async () => {
    const stats = orchestrator.getStatistics();
    console.log('📊 Final Statistics:', {
      totalMessages: stats.totalMessages,
      totalErrors: stats.totalErrors,
      errorRate: `${(stats.errorRate * 100).toFixed(2)}%`,
      uptime: `${Math.round(stats.uptime / 1000)}s`
    });
    
    await orchestrator.stop();
    orchestrator.destroy();
    console.log('✅ Error handling example completed');
  }, 5000);
}

/**
 * Performance and Statistics Example
 */
export async function performanceExample(): Promise<void> {
  console.log('🎼 Starting Performance Example');
  
  const orchestrator = new Orchestrator({
    enableReplay: true,
    replayBufferSize: 1000,
    enableLogging: false // Disable to focus on performance
  });
  
  await orchestrator.start();
  
  // Generate high message volume
  const messageCount = 1000;
  const startTime = Date.now();
  
  console.log(`📈 Sending ${messageCount} messages...`);
  
  for (let i = 0; i < messageCount; i++) {
    const channel = i % 3;
    
    if (channel === 0) {
      orchestrator.app.sendActionRequest(`source-${i % 10}`, `action-${i}`, { data: i });
    } else if (channel === 1) {
      orchestrator.sys.sendInfo(`service-${i % 5}`, `Message ${i}`);
    } else {
      orchestrator.ui.sendUserInput(`user-${i % 3}`, `input-${i}`);
    }
  }
  
  const sendTime = Date.now() - startTime;
  console.log(`📤 Sent ${messageCount} messages in ${sendTime}ms (${Math.round(messageCount / sendTime * 1000)} msg/s)`);
  
  // Wait a bit for processing, then get stats
  setTimeout(() => {
    const stats = orchestrator.getStatistics();
    console.log('📊 Performance Statistics:', {
      totalMessages: stats.totalMessages,
      messagesPerSecond: Math.round(stats.totalMessages / (stats.uptime / 1000)),
      channels: {
        app: stats.channels.app.messageCount,
        sys: stats.channels.sys.messageCount,
        ui: stats.channels.ui.messageCount
      },
      uptime: `${Math.round(stats.uptime / 1000)}s`
    });
    
    orchestrator.stop().then(() => {
      orchestrator.destroy();
      console.log('✅ Performance example completed');
    });
  }, 2000);
}

/**
 * Run all examples
 */
export async function runAllExamples(): Promise<void> {
  console.log('🎼🎼🎼 Running All RxJS Orchestrator Examples 🎼🎼🎼\n');
  
  try {
    await basicUsageExample();
    console.log('\n');
    
    await componentIntegrationExample();
    console.log('\n');
    
    await advancedFilteringExample();
    console.log('\n');
    
    await customComponentExample();
    console.log('\n');
    
    await errorHandlingExample();
    console.log('\n');
    
    await performanceExample();
    console.log('\n');
    
    console.log('🎉 All examples completed successfully!');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
