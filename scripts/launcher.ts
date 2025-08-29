/**
 * Application Launcher for State Machine MCP Driver
 * 
 * Coordinates startup of all required components:
 * - MCP Service Launcher (manages MCP servers in separate consoles)
 * - Dependency checks (Ollama, models)
 * - Runtime initialization
 * - Example application launch
 */

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import axios from 'axios';
import { logger } from '../src/utils/logger';
import { MCPDriverAdapter } from '../src/drivers/MCPDriverAdapter';
import { MultiUIGameConfig, getMultiUIConfig, validateMultiUIConfig } from '../src/config/MultiUIGameConfig';

interface LaunchConfig {
  ollamaUrl: string;
  requiredModel: string;
  mcpServiceLauncherPort: number;
  mcpServers: Array<{
    id: string;
    name: string;
    port: number;
    script: string;
  }>;
  healthCheckTimeout: number;
  shutdownGracePeriod: number;
}

const DEFAULT_CONFIG: LaunchConfig = {
  ollamaUrl: 'http://localhost:11434',
  requiredModel: process.env.OLLAMA_MODEL || 'GPT-OSS:20b',
  mcpServiceLauncherPort: 3000,
  mcpServers: [
    {
      id: 'xplus1-mcp-machine',
      name: 'X+1 MCP Machine',
      port: 3001,
      script: 'src/mcp-servers/XPlus1MCPMachine.ts'
    },
    {
      id: 'wiki-mcp-browser', 
      name: 'Wiki MCP Browser',
      port: 3002,
      script: 'src/mcp-servers/WikiMCPBrowser.ts'
    }
  ],
  healthCheckTimeout: 30000,
  shutdownGracePeriod: 5000
};

export class ApplicationLauncher {
  private config: LaunchConfig;
  private processes: Map<string, ChildProcess> = new Map();
  private mcpDriver?: MCPDriverAdapter;
  private isShuttingDown = false;

  constructor(config: Partial<LaunchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupSignalHandlers();
  }

  /**
   * Main launch sequence
   */
  async launch(target: 'x-plus-1' | 'x-plus-1-multi' | 'dev-multi' | 'console-only' | 'custom', customScript?: string): Promise<void> {
    try {
      console.log('🚀 State Machine MCP Driver - Application Launcher');
      console.log('===================================================');
      
      // Load Multi-UI configuration for the specific target
      const multiUIConfig = this.loadMultiUIConfig(target);
      if (multiUIConfig) {
        await this.launchMultiUI(multiUIConfig);
        return;
      }
      
      // Legacy single-UI launch
      if (target === 'x-plus-1' || target === 'custom') {
        await this.launchSingleUI(target, customScript);
      } else {
        throw new Error(`Unknown target: ${target}`);
      }
      
    } catch (error) {
      logger.error('Launch sequence failed', error as Error);
      console.error('❌ Launch failed:', error);
      await this.shutdown();
      process.exit(1);
    }
  }

  /**
   * Launch Multi-UI application
   */
  private async launchMultiUI(config: MultiUIGameConfig): Promise<void> {
    console.log(`\n🎮 Launching Multi-UI Game: ${config.game.name}`);
    console.log(`📱 UI Instances: ${config.ui.filter(ui => ui.enabled).length}`);
    
    // Validate configuration
    const errors = validateMultiUIConfig(config);
    if (errors.length > 0) {
      throw new Error(`Invalid Multi-UI configuration:\n${errors.join('\n')}`);
    }
    
    // Phase 1: Environment checks
    await this.checkEnvironment();
    
    // Phase 2: Start MCP Service Launcher
    await this.startMCPServiceLauncher();
    
    // Phase 3: Launch MCP servers
    await this.launchMCPServers();
    
    // Phase 4: Health checks
    await this.performHealthChecks();
    
    // Phase 5: Launch Multi-UI Manager
    await this.startMultiUIManager(config);
  }

  /**
   * Launch single UI application (legacy)
   */
  private async launchSingleUI(target: 'x-plus-1' | 'custom', customScript?: string): Promise<void> {
    // Phase 1: Environment checks
    await this.checkEnvironment();
    
    // Phase 2: Start MCP Service Launcher
    await this.startMCPServiceLauncher();
    
    // Phase 3: Launch MCP servers via service launcher
await this.launchMCPServers();
    
    // Phase 4: Health checks
    await this.performHealthChecks();
    
    // Phase 5: Launch target application
    await this.launchApplication(target, customScript);
  }

  /**
   * Check environment prerequisites
   */
  private async checkEnvironment(): Promise<void> {
    console.log('\n🔍 Phase 1: Environment Checks');
    console.log('--------------------------------');
    
    // Check Ollama availability
    console.log('📡 Checking Ollama server...');
    try {
      const response = await axios.get(`${this.config.ollamaUrl}/api/version`, {
        timeout: 5000
      });
      console.log(`✅ Ollama server running (version: ${response.data?.version || 'unknown'})`);
    } catch (error) {
      throw new Error(`❌ Ollama server not available at ${this.config.ollamaUrl}. Please start Ollama first.`);
    }

    // Check required model
    console.log(`🤖 Checking model: ${this.config.requiredModel}...`);
    try {
      const response = await axios.get(`${this.config.ollamaUrl}/api/tags`);
      const models = response.data?.models || [];
      const hasModel = models.some((model: any) => 
        model.name === this.config.requiredModel || 
        model.name.startsWith(this.config.requiredModel)
      );
      
      if (!hasModel) {
        console.log(`⚠️  Model ${this.config.requiredModel} not found. Attempting to pull...`);
        await this.pullModel(this.config.requiredModel);
      } else {
        console.log(`✅ Model ${this.config.requiredModel} available`);
      }
    } catch (error) {
      throw new Error(`❌ Failed to verify model availability: ${error}`);
    }

    // Check project structure
    console.log('📁 Checking project structure...');
    const requiredPaths = [
      'src/mcp-servers/XPlus1MCPMachine.ts',
      'src/mcp-servers/WikiMCPBrowser.ts', 
      'examples/x-plus-1-state-machine/index.ts',
      'src/runtime/Runtime.ts'
    ];

    for (const filePath of requiredPaths) {
      try {
        await fs.access(path.join(process.cwd(), filePath));
        console.log(`✅ ${filePath}`);
      } catch {
        throw new Error(`❌ Required file missing: ${filePath}`);
      }
    }
  }

  /**
   * Pull Ollama model if needed
   */
  private async pullModel(modelName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`📥 Pulling model ${modelName}...`);
      
      const pullProcess = spawn('ollama', ['pull', modelName], {
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: process.platform === 'win32' // Enable shell on Windows
      });

      let output = '';
      pullProcess.stdout?.on('data', (data) => {
        output += data.toString();
        process.stdout.write('.');
      });

      pullProcess.stderr?.on('data', (data) => {
        output += data.toString();
      });

      pullProcess.on('close', (code) => {
        console.log(''); // New line after dots
        if (code === 0) {
          console.log(`✅ Model ${modelName} pulled successfully`);
          resolve();
        } else {
          reject(new Error(`Failed to pull model ${modelName}. Exit code: ${code}`));
        }
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        pullProcess.kill();
        reject(new Error(`Model pull timeout for ${modelName}`));
      }, 300000);
    });
  }

  /**
   * Get the correct tsx command for the current platform
   */
  private getTsxCommand(): { cmd: string; args: string[] } {
    // Use npx tsx for all platforms - tsx is now installed
    return {
      cmd: 'npx',
      args: ['tsx']
    };
  }

  /**
   * Start MCP Service Launcher
   */
  private async startMCPServiceLauncher(): Promise<void> {
    console.log('\n⚡ Phase 2: Starting MCP Service Launcher');
    console.log('------------------------------------------');

    const { cmd, args: baseArgs } = this.getTsxCommand();
    
    console.log('🔄 Starting MCP Service Launcher on port 3000...');
    
      const launcherProcess = spawn(cmd, [...baseArgs, 'src/mcp-servers/MCPServiceLauncher.ts'], {
        stdio: ['inherit', 'pipe', 'pipe'],
        env: { 
          ...process.env, 
          MCP_SERVER_PORT: this.config.mcpServiceLauncherPort.toString(),
          MCP_USE_NATIVE_PROTOCOL: 'true'
        },
        shell: process.platform === 'win32',
        detached: false,
        windowsHide: true
      });

    // Store process reference
    this.processes.set('mcp-service-launcher', launcherProcess);

    // Handle process output
    launcherProcess.stdout?.on('data', (data) => {
      console.log(`[MCP Service Launcher] ${data.toString().trim()}`);
    });

    launcherProcess.stderr?.on('data', (data) => {
      console.error(`[MCP Service Launcher] ${data.toString().trim()}`);
    });

    launcherProcess.on('close', (code) => {
      if (!this.isShuttingDown) {
        console.error(`❌ MCP Service Launcher exited with code ${code}`);
      }
      this.processes.delete('mcp-service-launcher');
    });

    // Wait for launcher to be ready by polling /health
    const start = Date.now();
    const timeoutMs = 10000;
    let ready = false;
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await axios.get(`http://localhost:${this.config.mcpServiceLauncherPort}/health`, { timeout: 1000 });
        if (res.status === 200) { ready = true; break; }
      } catch { /* wait and retry */ }
      await this.sleep(500);
    }
    if (!ready) {
      throw new Error('MCP Service Launcher did not become ready in time');
    }
    console.log(`✅ MCP Service Launcher started (PID: ${launcherProcess.pid})`);

    // Initialize MCP Driver to communicate with the launcher
    this.mcpDriver = new MCPDriverAdapter();
    await this.mcpDriver.addServer({
      id: 'mcp-service-launcher',
      name: 'MCP Service Launcher',
      url: `http://localhost:${this.config.mcpServiceLauncherPort}`,
      timeout: 10000,
      maxRetries: 3
    });
  }

  /**
   * Launch MCP servers via the service launcher
   */
  private async launchMCPServers(): Promise<void> {
    console.log('\n🎯 Phase 3: Launching MCP Servers via Service Launcher');
    console.log('--------------------------------------------------------');

    if (!this.mcpDriver) {
      throw new Error('MCP Driver not initialized. Service launcher must be started first.');
    }

    try {
      // Use the service launcher to start all servers
      console.log('🚀 Launching all MCP servers...');
      
      const result = await this.mcpDriver.executeTool(
        'mcp-service-launcher',
        'launch_all_servers',
        { healthCheck: true }
      );

      // Only show detailed results in verbose mode, not in quiet mode
      if (process.env.MCP_QUIET !== 'true') {
        console.log('📊 Launch Results:', JSON.stringify(result, null, 2));
      }

      // Parse the nested result structure
      let parsedResult: any = result;
      
      // Handle wrapped text response format
      if (Array.isArray(result) && result[0]?.type === 'text') {
        try {
          parsedResult = JSON.parse(result[0].text);
        } catch (error) {
          if (process.env.MCP_QUIET !== 'true') {
            console.warn('⚠️ Failed to parse launch results:', error);
          }
          parsedResult = { success: false };
        }
      }

      // Check if launch was successful
      if (parsedResult.success) {
        console.log('✅ All MCP servers launched successfully via service launcher');
      } else {
        console.warn('⚠️ Some servers may have failed to launch');
        console.log('Results:', parsedResult);
      }

    } catch (error) {
  console.error('❌ Failed to launch MCP servers via service launcher:', error);
  console.log('➡️  Falling back to legacy direct server startup...');
  // Fallback: start servers directly without the service launcher tools
  await this.startMCPServersLegacy();
  console.log('✅ Legacy MCP server startup completed');
    }
  }

  /**
   * Legacy method: Start all MCP servers directly (now deprecated in favor of service launcher)
   */
  private async startMCPServersLegacy(): Promise<void> {
    console.log('\n⚡ Phase 2: Starting MCP Servers (Legacy Mode)');
    console.log('------------------------------------------------');

    const { cmd, args: baseArgs } = this.getTsxCommand();

    for (const server of this.config.mcpServers) {
      console.log(`🔄 Starting ${server.name} on port ${server.port}...`);
      
      const serverProcess = spawn(cmd, [...baseArgs, server.script, '--port', server.port.toString()], {
        stdio: ['inherit', 'pipe', 'pipe'],
        env: { 
          ...process.env, 
          MCP_SERVER_PORT: server.port.toString(),
          MCP_SERVER_ID: server.id
        },
        shell: process.platform === 'win32' // Enable shell on Windows
      });

      // Store process reference
      this.processes.set(server.id, serverProcess);

      // Handle process output
      serverProcess.stdout?.on('data', (data) => {
        console.log(`[${server.name}] ${data.toString().trim()}`);
      });

      serverProcess.stderr?.on('data', (data) => {
        console.error(`[${server.name}] ${data.toString().trim()}`);
      });

      serverProcess.on('close', (code) => {
        if (!this.isShuttingDown) {
          console.error(`❌ ${server.name} exited with code ${code}`);
        }
        this.processes.delete(server.id);
      });

      // Poll for readiness on /health
      const start = Date.now();
      const timeoutMs = 15000;
      let reachable = false;
      while (Date.now() - start < timeoutMs) {
        try {
          const res = await axios.get(`http://localhost:${server.port}/health`, { timeout: 1000 });
          if (res.status === 200) { reachable = true; break; }
        } catch {/* retry */}
        await this.sleep(500);
      }
      if (reachable) {
        console.log(`✅ ${server.name} exposed on port ${server.port} (PID: ${serverProcess.pid})`);
      } else {
        console.warn(`⚠️ ${server.name} did not become reachable on port ${server.port} within ${timeoutMs}ms`);
      }
    }
  }

  /**
   * Perform health checks on all services
   */
  private async performHealthChecks(): Promise<void> {
    console.log('\n🏥 Phase 4: Health Checks');
    console.log('---------------------------');

    if (!this.mcpDriver) {
      console.warn('⚠️ MCP Driver not available, performing basic health checks');
      await this.performBasicHealthChecks();
      return;
    }

    try {
      // Use service launcher to perform health checks
      console.log('🔍 Performing health checks via service launcher...');
      
      const healthResults = await this.mcpDriver.executeTool(
        'mcp-service-launcher',
        'health_check_servers',
        {}
      );

      // Only show detailed results in verbose mode, not in quiet mode
      if (process.env.MCP_QUIET !== 'true') {
        console.log('📊 Health Check Results:', JSON.stringify(healthResults, null, 2));
      }

      // Parse the nested result structure
      let parsedResults: any = healthResults;
      
      // Handle wrapped text response format
      if (Array.isArray(healthResults) && healthResults[0]?.type === 'text') {
        try {
          parsedResults = JSON.parse(healthResults[0].text);
        } catch (error) {
          if (process.env.MCP_QUIET !== 'true') {
            console.warn('⚠️ Failed to parse health check results:', error);
          }
          parsedResults = { success: false };
        }
      }

      // Check individual server health
      if (parsedResults.success && parsedResults.healthCheck) {
        const results = parsedResults.healthCheck;
        let allHealthy = true;

        for (const [serverId, result] of Object.entries(results)) {
          const healthResult = result as any; // Type assertion for health check result
          if (healthResult.status === 'healthy') {
            console.log(`✅ ${healthResult.name || serverId}: Healthy`);
          } else {
            console.log(`❌ ${healthResult.name || serverId}: ${healthResult.status} - ${healthResult.error || 'Unknown issue'}`);
            allHealthy = false;
          }
        }

        if (allHealthy) {
          console.log('🎉 All MCP servers are healthy!');
          
          // Generate VS Code MCP configuration (unless disabled)
          if (process.env.MCP_SKIP_VSCODE_CONFIG !== 'true') {
            await this.generateVSCodeMCPConfiguration();
          } else {
            console.log('⏭️ VS Code MCP configuration generation skipped (MCP_SKIP_VSCODE_CONFIG=true)');
          }
        } else {
          console.warn('⚠️ Some MCP servers are not healthy');
        }
      } else {
        console.warn('⚠️ Health check failed or returned unexpected results');
        console.log('Falling back to basic health checks...');
        await this.performBasicHealthChecks();
      }

    } catch (error) {
      console.error('❌ Failed to perform health checks via service launcher:', error);
      console.log('Falling back to basic health checks...');
      await this.performBasicHealthChecks();
    }
  }

  /**
   * Generate VS Code MCP configuration automatically
   */
  private async generateVSCodeMCPConfiguration(): Promise<void> {
    if (!this.mcpDriver) {
      console.warn('⚠️ MCP Driver not available, skipping VS Code configuration generation');
      return;
    }

    try {
      console.log('\n🔧 Generating VS Code MCP Configuration...');
      
      const configResult = await this.mcpDriver.executeTool(
        'mcp-service-launcher',
        'generate_vscode_mcp_config',
        {
          includeDescription: true,
          outputPath: '.vscode/mcp.json'
        }
      );

      // Parse the nested result structure (similar to other MCP tool responses)
      let parsedResult: any = configResult;
      
      // Handle wrapped text response format
      if (Array.isArray(configResult) && configResult[0]?.type === 'text') {
        try {
          parsedResult = JSON.parse(configResult[0].text);
        } catch (error) {
          if (process.env.MCP_QUIET !== 'true') {
            console.warn('⚠️ Failed to parse VS Code config result:', error);
          }
          parsedResult = { success: false, error: 'Failed to parse response' };
        }
      } else if (configResult?.content?.[0]?.type === 'text') {
        try {
          parsedResult = JSON.parse(configResult.content[0].text);
        } catch (error) {
          if (process.env.MCP_QUIET !== 'true') {
            console.warn('⚠️ Failed to parse VS Code config result:', error);
          }
          parsedResult = { success: false, error: 'Failed to parse response' };
        }
      }

      if (parsedResult.success) {
        console.log('✅ VS Code MCP configuration generated successfully!');
        console.log(`📁 Configuration saved to: ${parsedResult.outputPath}`);
        
        // Show user instructions
        if (parsedResult.instructions) {
          this.showVSCodeInstructions(parsedResult.instructions);
        }
      } else {
        console.warn('⚠️ Failed to generate VS Code MCP configuration:', parsedResult.error || 'Unknown error');
      }

    } catch (error) {
      console.warn('⚠️ Error generating VS Code MCP configuration:', error);
    }
  }

  /**
   * Display VS Code setup instructions to the user
   */
  private showVSCodeInstructions(instructions: any): void {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 VS Code MCP Setup Instructions');
    console.log('='.repeat(60));
    
    if (instructions && instructions.steps) {
      console.log('\n📋 Setup Steps:');
      instructions.steps.forEach((step: any) => {
        console.log(`\n${step.step}. ${step.action}`);
        console.log(`   ${step.description}`);
      });
    }

    if (instructions && instructions.quickCommands) {
      console.log('\n⚡ Quick Commands in VS Code:');
      instructions.quickCommands.forEach((cmd: string) => {
        console.log(`   • ${cmd}`);
      });
    }

    console.log('\n💡 Next Steps:');
    console.log('   1. Open VS Code in this workspace folder');
    console.log('   2. Install the Model Context Protocol extension');
    console.log('   3. Use Ctrl+Shift+P → "MCP: Connect to Server"');
    console.log('   4. Select from available MCP servers');
    console.log('   5. Start using MCP tools and resources in VS Code!');
    
    console.log('\n' + '='.repeat(60));
  }

  /**
   * Perform basic health checks (fallback method)
   */
  private async performBasicHealthChecks(): Promise<void> {

    // Check MCP servers
    for (const server of this.config.mcpServers) {
      console.log(`🔍 Health check: ${server.name}...`);
      
      const startTime = Date.now();
      let isHealthy = false;
      
      while (Date.now() - startTime < this.config.healthCheckTimeout) {
        try {
          // Try to connect to MCP server (basic TCP check)
          const response = await axios.get(`http://localhost:${server.port}/health`, {
            timeout: 1000
          }).catch(() => {
            // If /health endpoint doesn't exist, just check if port is open
            return axios.get(`http://localhost:${server.port}`, { timeout: 1000 });
          });
          
          isHealthy = true;
          break;
        } catch {
          await this.sleep(1000);
        }
      }

      if (!isHealthy) {
        throw new Error(`❌ Health check failed for ${server.name}`);
      }
      
      console.log(`✅ ${server.name} healthy`);
    }

    // Final Ollama check with model generation
    console.log('🔍 Testing Ollama model generation...');
    try {
      const testResponse = await axios.post(`${this.config.ollamaUrl}/api/generate`, {
        model: this.config.requiredModel,
        prompt: 'Test',
        stream: false
      }, { timeout: 10000 });
      
      if (testResponse.data?.response) {
        console.log('✅ Ollama model generation working');
      } else {
        throw new Error('No response from model');
      }
    } catch (error) {
      throw new Error(`❌ Ollama model test failed: ${error}`);
    }
  }

  /**
   * Launch the target application
   */
  private async launchApplication(target: string, customScript?: string): Promise<void> {
    console.log('\n🎮 Phase 5: Launching Application');
    console.log('-----------------------------------');

    let scriptPath: string;
    let appName: string;

    switch (target) {
      case 'x-plus-1':
        scriptPath = 'examples/x-plus-1-state-machine/index.ts';
        appName = 'X+1 State Machine Game';
        break;
      case 'custom':
        if (!customScript) {
          throw new Error('Custom script path required for custom target');
        }
        scriptPath = customScript;
        appName = 'Custom Application';
        break;
      default:
        throw new Error(`Unknown target: ${target}`);
    }

    console.log(`🚀 Launching ${appName}...`);
    console.log(`📄 Script: ${scriptPath}`);
    console.log('');
    console.log('='.repeat(60));
    console.log('🎯 APPLICATION READY - All systems operational!');
    console.log('='.repeat(60));
    console.log('');

    // Launch the main application
    const { cmd, args: baseArgs } = this.getTsxCommand();
    const appProcess = spawn(cmd, [...baseArgs, scriptPath], {
      stdio: 'inherit',
      env: {
        ...process.env,
        MCP_XPLUS1_URL: 'http://localhost:3001',
        MCP_WIKI_URL: 'http://localhost:3002',
        MCP_SERVICE_LAUNCHER_URL: `http://localhost:${this.config.mcpServiceLauncherPort}`,
        OLLAMA_URL: this.config.ollamaUrl,
        OLLAMA_MODEL: this.config.requiredModel
      },
      shell: process.platform === 'win32' // Enable shell on Windows
    });

    this.processes.set('main-app', appProcess);

    appProcess.on('close', (code) => {
      if (!this.isShuttingDown) {
        console.log(`\n🏁 Application exited with code ${code}`);
        this.shutdown();
      }
    });

    // Wait for application to finish
    return new Promise((resolve) => {
      appProcess.on('close', () => resolve());
    });
  }

  /**
   * Graceful shutdown of all processes
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    console.log('\n🔄 Shutting down all processes...');

    // Send SIGTERM to all processes
    for (const [id, process] of this.processes) {
      console.log(`🛑 Stopping ${id}...`);
      process.kill('SIGTERM');
    }

    // Wait for graceful shutdown
    await this.sleep(this.config.shutdownGracePeriod);

    // Force kill remaining processes
    for (const [id, process] of this.processes) {
      if (!process.killed) {
        console.log(`💀 Force killing ${id}...`);
        process.kill('SIGKILL');
      }
    }

    this.processes.clear();
    console.log('✅ Shutdown complete');
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    process.on('SIGINT', () => {
      console.log('\n📡 Received SIGINT');
      this.shutdown().then(() => process.exit(0));
    });

    process.on('SIGTERM', () => {
      console.log('\n📡 Received SIGTERM');
      this.shutdown().then(() => process.exit(0));
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception in launcher', error);
      console.error('💥 Uncaught exception:', error);
      this.shutdown().then(() => process.exit(1));
    });
  }

  /**
   * Load Multi-UI configuration for specific target
   */
  private loadMultiUIConfig(target: string): MultiUIGameConfig | null {
    const configMappings: Record<string, string | null> = {
      'x-plus-1-multi': 'examples/configs/x-plus-1-multi-ui.json',
      'dev-multi': 'examples/configs/x-plus-1-multi-ui.json', // Fallback for dev
      'console-only': null, // No multi-UI for console-only
    };

    const configPath = configMappings[target];
    if (!configPath) {
      return null; // Not a multi-UI target
    }

    try {
      // Use absolute path from project root
      const fullPath = path.join(process.cwd(), configPath);
      const configData = require(fullPath);
      
      // Validate the configuration
      const errors = validateMultiUIConfig(configData);
      if (errors.length > 0) {
        console.warn(`⚠️ Invalid Multi-UI configuration: ${errors.join(', ')}`);
        return null;
      }
      
      console.log(`✅ Loaded Multi-UI configuration from: ${configPath}`);
      return configData;
    } catch (error) {
      console.warn(`⚠️ Could not load Multi-UI config from ${configPath}:`, (error as Error).message);
      return null; // Let the system use single-UI mode
    }
  }

  /**
   * Utility: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wait for MCP connections to be healthy using MCPDriverAdapter
   */
  private async waitForMCPHealthy(mcpAdapter: MCPDriverAdapter, serverIds: string[]): Promise<void> {
    const maxAttempts = 10;
    const delayMs = 500;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let allHealthy = true;
      
      for (const serverId of serverIds) {
        try {
          const isHealthy = await mcpAdapter.healthCheck(serverId);
          if (!isHealthy) {
            allHealthy = false;
            break;
          }
        } catch (error) {
          allHealthy = false;
          if (process.env.MCP_QUIET !== 'true') {
            console.log(`Health check attempt ${attempt}/${maxAttempts} failed for ${serverId}:`, error);
          }
          break;
        }
      }
      
      if (allHealthy) {
        console.log(`✅ All MCP servers healthy (attempt ${attempt}/${maxAttempts})`);
        return;
      }
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    console.warn('⚠️ MCP servers not fully responsive, continuing with limited connectivity');
  }

  /**
   * Start Multi-UI Manager for managing multiple GamificationUI instances
   */
  /**
   * Start Multi-UI Manager directly (integrated approach)
   */
  private async startMultiUIManager(config: MultiUIGameConfig): Promise<void> {
    console.log('\n🎮 Phase 5: Starting Multi-UI Manager');
    
    try {
      // Import required components directly
      const { Runtime } = await import('../src/runtime/Runtime');
      const { MCPDriverAdapter } = await import('../src/drivers/MCPDriverAdapter');
      const { InterfaceOrchestrator } = await import('../src/orchestration/InterfaceOrchestrator');
      const { MultiUIGameManager } = await import('../src/ui/MultiUIGameManager');
      const { createXPlus1RuntimeConfig } = await import('../examples/x-plus-1-state-machine/game-config');
      
      console.log('🔧 Initializing components...');
      
      // 1. Initialize MCP Driver Adapter (reuse existing connections)
      console.log('🔄 Initializing MCP Driver...');
      const mcpAdapter = new MCPDriverAdapter();
      
      // Configure MCP servers (they're already running)
      const serverConfigs = [
        { id: 'xplus1-mcp-machine', name: 'X+1 MCP Machine', url: 'http://localhost:3001' },
        { id: 'wiki-mcp-browser', name: 'Wiki MCP Browser', url: 'http://localhost:3002' }
      ];
      
      for (const serverConfig of serverConfigs) {
        if (config.mcp.servers.includes(serverConfig.id)) {
          try {
            await mcpAdapter.addServer(serverConfig);
            console.log(`✅ Connected to ${serverConfig.name}`);
          } catch (error) {
            console.warn(`⚠️ Could not connect to ${serverConfig.name}, will retry during runtime`);
            if (process.env.MCP_QUIET !== 'true') {
              console.log(`Connection error for ${serverConfig.id}:`, error);
            }
          }
        }
      }
      
      // Wait for MCP connections to be established with health checks
      console.log('⏳ Waiting for MCP connections...');
      await this.waitForMCPHealthy(mcpAdapter, config.mcp.servers);
      console.log('✅ MCP Driver initialized');
      
      // 2. Initialize Runtime with graceful error handling
      console.log('🧠 Initializing Runtime...');
      let runtimeConfig;
      
      switch (config.game.id) {
        case 'x-plus-1-multi':
          try {
            const gameConfig = await createXPlus1RuntimeConfig();
            runtimeConfig = {
              mcpServerId: 'xplus1-mcp-machine',
              graphId: gameConfig.graphId,
              userId: gameConfig.userId,
              agentConfigs: gameConfig.agentConfigs
            };
          } catch (configError) {
            console.warn('⚠️ Game config loading failed, using minimal runtime config');
            if (process.env.MCP_QUIET !== 'true') {
              console.log('Config error details:', configError);
            }
            // Fallback to minimal runtime configuration
            runtimeConfig = {
              mcpServerId: 'xplus1-mcp-machine',
              graphId: 'x-plus-1-game',
              userId: 'player-1',
              agentConfigs: [] // Will be populated during runtime
            };
          }
          break;
        default:
          throw new Error(`Unknown game ID: ${config.game.id}`);
      }
      
      const runtime = new Runtime(mcpAdapter, runtimeConfig);
      
      // Initialize with graceful error handling for missing resources
      try {
        await runtime.initialize();
        console.log('✅ Runtime initialized successfully');
      } catch (initError) {
        console.warn('⚠️ Runtime initialization had issues, continuing with limited functionality');
        if (process.env.MCP_QUIET !== 'true') {
          console.log('Runtime init details:', initError);
        }
        // Runtime will work in degraded mode
      }
      
      // 3. Initialize Interface Orchestrator
      console.log('🔄 Initializing Interface Orchestrator...');
      const orchestrator = new InterfaceOrchestrator(runtime, mcpAdapter, {
        syncInterval: config.orchestration?.syncInterval || 100,
        enableChatProvider: false,
        enableUI: true,
        enableAgentControl: true
      });
      console.log('✅ Interface Orchestrator initialized');
      
      // 4. Initialize Multi-UI Manager
      console.log('🔄 Initializing Multi-UI Manager...');
      const multiUIManager = new MultiUIGameManager(runtime, mcpAdapter, orchestrator, config);
      console.log('✅ Multi-UI Manager initialized');
      
      // 5. Start the game
      console.log('🎮 Starting Multi-UI Game...');
      await multiUIManager.start();
      console.log('✅ Multi-UI Game started');
      
      // Keep the process running
      console.log('🔄 Multi-UI Game running... Press Ctrl+C to stop');
      
    } catch (error) {
      logger.error('Failed to start Multi-UI Manager', error as Error);
      throw new Error(`Multi-UI Manager startup failed: ${error}`);
    }
  }
}

/**
 * Kill all Node.js processes on the system (Windows and Unix)
 */
async function killAllNodeProcesses(): Promise<void> {
  console.log('\n⚠️  WARNING: About to terminate ALL Node.js processes on the system!');
  console.log('🔥 This will kill:');
  console.log('   • All running Node.js applications');
  console.log('   • All npm/yarn processes');
  console.log('   • Any development servers');
  console.log('   • VS Code extensions using Node.js');
  console.log('   • Other Node.js-based tools and services');
  
  // Ask for confirmation
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve, reject) => {
    rl.question('\n❓ Are you sure you want to proceed? (yes/no): ', (answer) => {
      rl.close();
      
      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Operation cancelled by user');
        resolve();
        return;
      }

      console.log('\n💀 Terminating all Node.js processes...');
      
      const { spawn } = require('child_process');
      let killCommand: string;
      let killArgs: string[];

      if (process.platform === 'win32') {
        // Windows: Use taskkill to kill all node.exe processes
        killCommand = 'taskkill';
        killArgs = ['/F', '/IM', 'node.exe'];
      } else {
        // Unix/Linux/macOS: Use pkill to kill all node processes
        killCommand = 'pkill';
        killArgs = ['-f', 'node'];
      }

      const killProcess = spawn(killCommand, killArgs, {
        stdio: 'inherit',
        shell: process.platform === 'win32'
      });

      killProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ All Node.js processes terminated successfully');
        } else if (code === 1 && process.platform !== 'win32') {
          console.log('ℹ️  No Node.js processes were found to terminate');
        } else {
          console.log(`⚠️  Process termination completed with exit code: ${code}`);
        }
        resolve();
      });

      killProcess.on('error', (error) => {
        console.error('❌ Error terminating Node.js processes:', error);
        reject(error);
      });
    });
  });
}

/**
 * Display help information
 */
function showHelp(): void {
  console.log('🚀 State Machine MCP Driver - Application Launcher');
  console.log('===================================================');
  console.log('');
  console.log('Usage:');
  console.log('  npm run launcher [target] [customScript]');
  console.log('  npx tsx scripts/launcher.ts [target] [customScript]');
  console.log('');
  console.log('Targets:');
  console.log('  x-plus-1    Launch the X+1 State Machine game example (default)');
  console.log('  custom      Launch a custom script (requires customScript path)');
  console.log('');
  console.log('Options:');
  console.log('  --kill-all-node    Terminate all Node.js processes on the system');
  console.log('  --help, -h         Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  npm run launcher');
  console.log('  npm run launcher x-plus-1');
  console.log('  npm run launcher custom examples/my-app/index.ts');
  console.log('  npm run launcher --kill-all-node');
  console.log('');
  console.log('Environment Variables:');
  console.log('  OLLAMA_MODEL       Ollama model to use (default: GPT-OSS:20b)');
  console.log('');
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  
  // Check for kill all node processes flag
  if (args.includes('--kill-all-node')) {
    try {
      await killAllNodeProcesses();
    } catch (error) {
      console.error('💥 Failed to kill Node.js processes:', error);
      process.exit(1);
    }
    return;
  }

  const target = args[0] || 'x-plus-1';
  const customScript = args[1];

  const launcher = new ApplicationLauncher();
  
  try {
    await launcher.launch(target as any, customScript);
  } catch (error) {
    console.error('💥 Launch failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}
