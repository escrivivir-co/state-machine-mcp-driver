/**
 * Application Launcher for State Machine MCP Driver
 * 
 * Coordinates startup of all required components:
 * - MCP Servers (XPlus1, WikiBrowser) 
 * - Dependency checks (Ollama, models)
 * - Runtime initialization
 * - Example application launch
 */

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import axios from 'axios';
import { logger } from '../src/utils/logger';

interface LaunchConfig {
  ollamaUrl: string;
  requiredModel: string;
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
  requiredModel: process.env.OLLAMA_MODEL || 'GPT-OSS:20b', // Changed default to GPT-OSS:20b
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
      
      // Phase 2: Start MCP servers
      await this.startMCPServers();
      
      // Phase 3: Health checks
      await this.performHealthChecks();
      
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
   * Start all MCP servers
   */
  private async startMCPServers(): Promise<void> {
    console.log('\n⚡ Phase 2: Starting MCP Servers');
    console.log('----------------------------------');

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
    console.log('\n🏥 Phase 3: Health Checks');
    console.log('---------------------------');

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
    console.log('\n🎮 Phase 4: Launching Application');
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
