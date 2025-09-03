/**
 * Simple example demonstrating the RxJS Orchestrator usage
 */

import { Orchestrator } from '../src/orchestration/orchestrator';
import { SysAgent, AppAgent, UIAgent, LogAgent } from '../src/orchestration/__tests__/test-agents';
import { Logger } from '../src/utils/logger';

async function runOrchestratorExample() {
  console.log('🎼 Starting Orchestrator Example\n');

  // Create orchestrator with configuration
  const orchestrator = new Orchestrator({
    enableLogging: true,
    enableReplay: true,
    replayBufferSize: 50,
    enableCrossChannelRouting: true,
    messageTimeout: 5000
  });

  // Create agents
  const sysAgent = new SysAgent();
  const appAgent = new AppAgent();
  const uiAgent = new UIAgent();
  const logAgent = new LogAgent();

  try {
    // Start orchestrator
    console.log('Starting orchestrator...');
    await orchestrator.start();

    // Register all agents
    console.log('Registering agents...');
    await orchestrator.registerComponent(sysAgent);
    await orchestrator.registerComponent(appAgent);
    await orchestrator.registerComponent(uiAgent);
    await orchestrator.registerComponent(logAgent);

    console.log('All agents registered successfully!\n');

    // Clear initial events
    logAgent.clearLogs();

    // Demonstrate the standard event sequence
    console.log('=== Executing Standard Event Sequence ===');
    
    // 1. System announces readiness
    console.log('1. System sending READY event...');
    sysAgent.sendReady();
    await new Promise(resolve => setTimeout(resolve, 200));

    // 2. Broadcast feature readiness
    console.log('2. Broadcasting feature availability...');
    sysAgent.broadcastFeatureReady('authentication');
    sysAgent.broadcastFeatureReady('database');
    sysAgent.broadcastFeatureReady('ui-framework');
    await new Promise(resolve => setTimeout(resolve, 200));

    // 3. Simulate some app activity
    console.log('3. Simulating application activity...');
    orchestrator.app.sendStateTransition('demo', 'initializing', 'running', { reason: 'startup complete' });
    orchestrator.ui.sendUserInput('user', 'login', 'authenticate', ['admin']);
    await new Promise(resolve => setTimeout(resolve, 200));

    // 4. System shutdown
    console.log('4. System initiating shutdown...');
    sysAgent.sendClose();
    await new Promise(resolve => setTimeout(resolve, 300));

    console.log('\n=== Event Sequence Complete ===\n');

    // Generate comprehensive report
    const report = logAgent.generateReport();
    console.log('📊 Event Report:');
    console.log(`  Total Events: ${report.totalEvents}`);
    console.log(`  Duration: ${report.timespan.duration}ms`);
    console.log(`  Events by Channel:`, report.eventsByChannel);
    console.log(`  Events by Source:`, report.eventsBySource);

    console.log('\n📋 Event Sequence:');
    report.eventSequence.forEach((event, index) => {
      console.log(`  ${index + 1}. ${event}`);
    });

    // Show orchestrator statistics
    const stats = orchestrator.getStatistics();
    console.log('\n📈 Orchestrator Statistics:');
    console.log(`  Uptime: ${stats.uptime}ms`);
    console.log(`  Total Messages: ${stats.totalMessages}`);
    console.log(`  Error Rate: ${(stats.errorRate * 100).toFixed(2)}%`);
    console.log(`  Registered Components: ${stats.components.count}`);

    // Demonstrate direct channel access
    console.log('\n=== Direct Channel Communication ===');
    
    // Listen to specific message types
    const subscription = orchestrator.getMessagesByType$('state_transition').subscribe(
      ({ channel, message }) => {
        console.log(`🔄 State transition on ${channel}: ${message.payload.stateId} → ${message.payload.targetState}`);
      }
    );

    // Send some test messages
    orchestrator.app.sendStateTransition('example', 'idle', 'processing', {});
    orchestrator.app.sendStateTransition('example', 'processing', 'complete', {});
    
    await new Promise(resolve => setTimeout(resolve, 100));
    subscription.unsubscribe();

    console.log('\n✅ Example completed successfully!');

  } catch (error) {
    console.error('❌ Error in orchestrator example:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await orchestrator.stop();
    orchestrator.destroy();
    console.log('Orchestrator stopped and destroyed.');
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runOrchestratorExample().catch(console.error);
}

export { runOrchestratorExample };
