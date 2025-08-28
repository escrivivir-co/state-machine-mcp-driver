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
  async launch(target: 'x-plus-1' | 'custom', customScript?: string): Promise<void> {
    try {
      console.log('🚀 State Machine MCP Driver - Application Launcher');
      console.log('===================================================');
      
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
      
      // Phase 4: Launch target application
      await this.launchApplication(target, customScript);
      
    } catch (error) {
      logger.error('Launch sequence failed', error as Error);
      console.error('❌ Launch failed:', error);
      await this.shutdown();
      process.exit(1);
    }
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
        MCP_SERVER_PORT: this.config.mcpServiceLauncherPort.toString()
      },
      shell: process.platform === 'win32',
      detached: true // Run in separate process group
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

    // Wait for launcher to start
    await this.sleep(3000);
    console.log(`✅ MCP Service Launcher started (PID: ${launcherProcess.pid})`);

    // Initialize MCP Driver to communicate with the launcher
    this.mcpDriver = new MCPDriverAdapter({
      useNativeProtocol: process.env.MCP_USE_NATIVE_PROTOCOL === 'true',
      enableFallback: true
    });
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

      console.log('📊 Launch Results:', JSON.stringify(result, null, 2));

      // Check if launch was successful
      if (result.success) {
        console.log('✅ All MCP servers launched successfully via service launcher');
      } else {
        console.warn('⚠️ Some servers may have failed to launch');
        console.log('Results:', result);
      }

    } catch (error) {
      console.error('❌ Failed to launch MCP servers via service launcher:', error);
      throw error;
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

      // Wait a bit for server to start
      await this.sleep(2000);
      console.log(`✅ ${server.name} started (PID: ${serverProcess.pid})`);
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

      console.log('📊 Health Check Results:', JSON.stringify(healthResults, null, 2));

      // Check individual server health
      if (healthResults.success && healthResults.healthCheck) {
        const results = healthResults.healthCheck;
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
          
          // Generate VS Code MCP configuration
          await this.generateVSCodeMCPConfiguration();
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

      if (configResult.success) {
        console.log('✅ VS Code MCP configuration generated successfully!');
        console.log(`📁 Configuration saved to: ${configResult.outputPath}`);
        
        // Show user instructions
        this.showVSCodeInstructions(configResult.instructions);
      } else {
        console.warn('⚠️ Failed to generate VS Code MCP configuration:', configResult.error);
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
   * Utility: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
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
