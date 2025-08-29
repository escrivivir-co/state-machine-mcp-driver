/**
 * Multi-UI Launcher Script
 * Launches multiple GamificationUI instances based on configuration
 */

import { readFile } from 'fs/promises';
import { Runtime, RuntimeConfig } from '../src/runtime/Runtime';
import { MCPDriverAdapter, MCPDriverAdapterConfig } from '../src/drivers/MCPDriverAdapter';
import { InterfaceOrchestrator } from '../src/orchestration/InterfaceOrchestrator';
import { MultiUIGameManager } from '../src/ui/MultiUIGameManager';
import { MultiUIGameConfig } from '../src/config/MultiUIGameConfig';
import { Logger } from '../src/utils/logger';
import { MCPServerConfig } from '../src/drivers/IMCPDriver';

// Import game-specific configurations
import { createXPlus1RuntimeConfig } from './x-plus-1-state-machine/game-config';

/**
 * Main multi-UI launcher function
 */
async function main(): Promise<void> {
  const configPath = process.argv[2];
  
  if (!configPath) {
    console.error('❌ Usage: npx tsx multi-ui-launcher.ts <config-file>');
    process.exit(1);
  }

  let config: MultiUIGameConfig;
  let runtime: Runtime | undefined;
  let mcpAdapter: MCPDriverAdapter | undefined;
  let orchestrator: InterfaceOrchestrator | undefined;
  let multiUIManager: MultiUIGameManager | undefined;

  try {
    // Load configuration
    console.log(`📋 Loading multi-UI configuration from: ${configPath}`);
    const configContent = await readFile(configPath, 'utf-8');
    config = JSON.parse(configContent);
    
    console.log(`🎮 Starting Multi-UI Game: ${config.game.name}`);
    console.log(`📱 UI Instances: ${config.ui.filter(ui => ui.enabled).length}`);
    
    // Initialize components
    console.log('\n🔧 Initializing components...');
    
    // 1. Initialize MCP Driver Adapter first
    console.log('🔄 Initializing MCP Driver...');
    const adapterConfig: MCPDriverAdapterConfig = {
      useNativeProtocol: config.mcp.useNativeProtocol || false
    };
    mcpAdapter = new MCPDriverAdapter(adapterConfig);
    
    // Configure MCP servers
    for (const serverId of config.mcp.servers) {
      const serverConfig: MCPServerConfig = {
        id: serverId,
        name: serverId === 'xplus1-mcp-machine' ? 'X+1 MCP Machine' : 'Wiki MCP Browser',
        url: serverId === 'xplus1-mcp-machine' ? 'http://localhost:3001' : 'http://localhost:3002'
      };
      
      mcpAdapter.addServer(serverConfig);
    }
    
    console.log('✅ MCP Driver initialized');
    
    // 2. Initialize Runtime with MCP adapter
    console.log('🔄 Initializing Runtime...');
    let runtimeConfig: RuntimeConfig;
    
    switch (config.game.id) {
      case 'x-plus-1-multi':
        const gameConfig = await createXPlus1RuntimeConfig();
        runtimeConfig = {
          mcpServerId: 'xplus1-mcp-machine',
          graphId: gameConfig.graphId,
          userId: gameConfig.userId,
          agentConfigs: gameConfig.agentConfigs
        };
        break;
      default:
        throw new Error(`Unknown game ID: ${config.game.id}`);
    }
    
    runtime = new Runtime(mcpAdapter, runtimeConfig);
    await runtime.initialize();
    console.log('✅ Runtime initialized');
    
    // 3. Initialize Interface Orchestrator
    console.log('🔄 Initializing Interface Orchestrator...');
    orchestrator = new InterfaceOrchestrator(runtime, mcpAdapter, {
      syncInterval: config.orchestration?.syncInterval || 100,
      enableChatProvider: false, // Disable for now
      enableUI: true,
      enableAgentControl: true
    });
    console.log('✅ Interface Orchestrator initialized');
    
    // 4. Initialize Multi-UI Manager
    console.log('🔄 Initializing Multi-UI Manager...');
    multiUIManager = new MultiUIGameManager(runtime, mcpAdapter, orchestrator, config);
    
    // Setup event handlers
    multiUIManager.on('allUIsReady', (data) => {
      console.log(`🎉 All ${data.uiCount} UI instances are ready!`);
      displayGameInfo(config, multiUIManager!);
    });
    
    multiUIManager.on('uiStarted', (data) => {
      console.log(`✅ UI started: ${data.config.name} (${data.uiId})`);
    });
    
    multiUIManager.on('uiError', (data) => {
      console.error(`❌ UI error in ${data.uiId}:`, data.error.message);
    });
    
    // 5. Start Multi-UI Manager
    console.log('🚀 Starting Multi-UI Manager...');
    await multiUIManager.start();
    
    // Setup graceful shutdown
    setupGracefulShutdown(multiUIManager, runtime, mcpAdapter);
    
    console.log('\n🎮 Multi-UI Game is running!');
    console.log('Press Ctrl+C to stop all interfaces.');
    
  } catch (error) {
    Logger.error('Multi-UI Launcher failed', error as Error);
    console.error('❌ Multi-UI Launcher failed:', error);
    
    // Cleanup
    if (multiUIManager) await multiUIManager.destroy();
    if (runtime) await runtime.shutdown();
    if (mcpAdapter) await mcpAdapter.close();
    
    process.exit(1);
  }
}

/**
 * Display game information and available interfaces
 */
function displayGameInfo(config: MultiUIGameConfig, manager: MultiUIGameManager): void {
  console.log('\n' + '='.repeat(60));
  console.log(`🎮 ${config.game.name} - Multi-UI Active`);
  console.log('='.repeat(60));
  
  const activeUIs = manager.getActiveUIInstances();
  console.log('\n📱 Active Interfaces:');
  
  for (const [uiId, ui] of activeUIs) {
    const uiConfig = config.ui.find(u => u.id === uiId);
    if (uiConfig) {
      console.log(`  • ${uiConfig.name} (${uiConfig.type})`);
      
      if (uiConfig.type === 'html5' && uiConfig.config.port) {
        console.log(`    🌐 Web URL: http://localhost:${uiConfig.config.port}`);
      }
      
      if (uiConfig.config.isPrimary) {
        console.log('    👑 Primary Interface');
      }
    }
  }
  
  const stats = manager.getStats();
  console.log(`\n📊 Status: ${stats.activeUIs}/${stats.totalUIs} UIs active`);
  
  if (stats.primaryUIId) {
    console.log(`🎯 Primary UI: ${stats.primaryUIId}`);
  }
  
  console.log('\n🎮 Game Commands:');
  console.log('  • Type in any active interface to interact');
  console.log('  • Console UI: Full command support');
  console.log('  • Web UI: Click and interact through browser');
  console.log('  • Ctrl+C: Stop all interfaces');
  
  console.log('\n' + '='.repeat(60));
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(
  manager: MultiUIGameManager,
  runtime: Runtime,
  mcpAdapter: MCPDriverAdapter
): void {
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    
    try {
      console.log('🔄 Stopping Multi-UI Manager...');
      await manager.destroy();
      console.log('✅ Multi-UI Manager stopped');
      
      console.log('🔄 Shutting down Runtime...');
      await runtime.shutdown();
      console.log('✅ Runtime stopped');
      
      console.log('🔄 Shutting down MCP Driver...');
      await mcpAdapter.close();
      console.log('✅ MCP Driver stopped');
      
      console.log('👋 Multi-UI Game shutdown complete');
      process.exit(0);
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };
  
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('💥 Uncaught exception:', error);
    await shutdown('UNCAUGHT_EXCEPTION');
  });
  
  process.on('unhandledRejection', async (reason) => {
    console.error('💥 Unhandled rejection:', reason);
    await shutdown('UNHANDLED_REJECTION');
  });
}

// Start the launcher
main().catch((error) => {
  console.error('❌ Multi-UI Launcher startup failed:', error);
  process.exit(1);
});
