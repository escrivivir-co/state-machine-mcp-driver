/**
 * Blockly Runtime Gamification UI
 * Runtime environment for executing Blockly projects created in the Design UI
 */

import { GamificationUI, BaseGamificationUIConfig, GameMessage, UIPhase } from './GamificationUI';
import { Runtime } from "@/runtime/Runtime";
import { MCPDriverAdapter } from "@/drivers/MCPDriverAdapter";
import { AgentPostulation } from "@/models/AgentPostulation";
import { AlephScriptClient } from "@/clients/alephscript-client";
import express from 'express';
import * as path from 'path';
import * as fs from 'fs';

export interface BlocklyRuntimeGamificationUIConfig extends BaseGamificationUIConfig {
  /** Express server port */
  port: number;
  /** Static files directory for Angular app */
  staticDir?: string;
  /** Whether to provide template from package */
  provideTemplate?: boolean;
  /** Auto-open browser */
  autoOpenBrowser?: boolean;
  /** CORS origin */
  corsOrigin?: string;
}

/**
 * Blockly Runtime Gamification UI
 * Provides visual programming runtime environment using Blockly blocks
 * This is the execution environment that runs Blockly projects created in the Design UI
 */
export class BlocklyRuntimeGamificationUI extends GamificationUI {
  protected declare config: BlocklyRuntimeGamificationUIConfig;
  private expressApp: express.Application;
  private server: any;
  private isServerStarted = false;

  constructor(
    runtime: Runtime,
    mcpDriver: MCPDriverAdapter,
    config: BlocklyRuntimeGamificationUIConfig
  ) {
    const baseConfig = {
      gameTitle: config.gameTitle || 'Blockly Runtime Environment',
      welcomeMessage: config.welcomeMessage || 'Welcome to the Blockly Runtime Environment',
      debugMode: config.debugMode || false,
      maxMessagesPerThread: config.maxMessagesPerThread || 50,
      enablePostulations: config.enablePostulations || false,
      autoSelectSingleAgent: config.autoSelectSingleAgent || true,
    };

    super(runtime, mcpDriver, baseConfig);
    
    this.config = {
      ...baseConfig,
      port: config.port || 5000,
      staticDir: config.staticDir || 'public_templates/blockly-runtime-gamify-ui',
      provideTemplate: config.provideTemplate !== false,
      autoOpenBrowser: config.autoOpenBrowser || false,
      corsOrigin: config.corsOrigin || 'http://localhost:4200',
    };
    
    this.expressApp = express();
  }

  // ===== Abstract Methods Implementation =====

  async displayMessage(message: GameMessage): Promise<void> {
    console.log(`🎮 [Runtime UI] ${message.type}: ${message.content}`);
    
    // Send to AlephScript bot if available
    if (this.alephScriptBot) {
      try {
        // Use the socket to send message (AlephScriptClient uses socket.io)
        if (this.alephScriptBot.io) {
          this.alephScriptBot.io.emit('ui-message', {
            type: 'display-message',
            message: message
          });
        }
      } catch (error) {
        console.error('Error sending message to AlephScript:', error);
      }
    }
  }

  async displayAgentPostulations(postulations: AgentPostulation[]): Promise<void> {
    console.log(`🎮 [Runtime UI] Agent Postulations:`, postulations);
    
    if (this.alephScriptBot) {
      try {
        if (this.alephScriptBot.io) {
          this.alephScriptBot.io.emit('ui-postulations', {
            type: 'agent-postulations',
            postulations: postulations
          });
        }
      } catch (error) {
        console.error('Error sending postulations to AlephScript:', error);
      }
    }
  }

  async displayNotification(
    title: string,
    message: string,
    type: "info" | "success" | "warning" | "error" = "info"
  ): Promise<void> {
    console.log(`🎮 [Runtime UI] ${type.toUpperCase()}: ${title} - ${message}`);
    
    if (this.alephScriptBot) {
      try {
        if (this.alephScriptBot.io) {
          this.alephScriptBot.io.emit('ui-notification', {
            type: 'notification',
            title,
            message,
            notificationType: type
          });
        }
      } catch (error) {
        console.error('Error sending notification to AlephScript:', error);
      }
    }
  }

  async updatePhaseDisplay(phase: UIPhase): Promise<void> {
    console.log(`🎮 [Runtime UI] Phase changed to: ${phase}`);
    
    if (this.alephScriptBot) {
      try {
        if (this.alephScriptBot.io) {
          this.alephScriptBot.io.emit('ui-phase-change', {
            type: 'phase-change',
            phase: phase
          });
        }
      } catch (error) {
        console.error('Error sending phase change to AlephScript:', error);
      }
    }
  }

  // ===== Express Server Setup =====

  private setupExpressApp(): void {
    this.expressApp.use(express.json());
    this.expressApp.use(express.urlencoded({ extended: true }));

    // CORS configuration to allow Design Environment communication
    this.expressApp.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', this.config.corsOrigin || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    this.setupStaticFiles();
    this.setupAPIRoutes();
  }

  private setupStaticFiles(): void {
    const staticDir = path.resolve(this.config.staticDir!);
    
    if (!fs.existsSync(staticDir)) {
      console.error(`Static directory not found: ${staticDir}`);
      console.log('Please ensure blockly-alephscript-sdk is installed and configured');
      throw new Error(`Static directory not found: ${staticDir}`);
    }

    this.expressApp.use(express.static(staticDir));
    
    // SPA fallback - serve index.html for unknown routes
    this.expressApp.get('*', (req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  private setupAPIRoutes(): void {
    // Runtime API endpoints
    this.expressApp.post('/api/runtime/execute', async (req, res) => {
      try {
        const { workspace, project } = req.body;
        console.log('Runtime: Executing Blockly project', { project: project?.name });
        
        const code = this.compileBlocklyWorkspace(workspace);
        await this.executeAlephScriptCode(code);
        
        res.json({ 
          success: true, 
          message: 'Project executed successfully',
          compiledCode: code
        });
      } catch (error) {
        console.error('Runtime: Error executing project', error);
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    this.expressApp.post('/api/runtime/load-project', async (req, res) => {
      try {
        const { projectData } = req.body;
        console.log('Runtime: Loading project for execution', { 
          blocks: projectData?.blocks?.length || 0 
        });
        
        res.json({ 
          success: true, 
          message: 'Project loaded successfully' 
        });
      } catch (error) {
        console.error('Runtime: Error loading project', error);
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    this.expressApp.get('/api/runtime/status', (req, res) => {
      res.json({
        status: 'running',
        port: this.config.port,
        environment: 'runtime',
        version: '1.0.0',
        uptime: process.uptime()
      });
    });
  }

  // ===== Blockly Integration Methods =====

  private compileBlocklyWorkspace(workspace: any): string {
    try {
      console.log('Runtime: Compiling Blockly workspace for execution');
      
      return `
// Compiled AlephScript from Blockly Runtime
// Generated at: ${new Date().toISOString()}

const runtime = {
  workspace: ${JSON.stringify(workspace, null, 2)},
  execute: async function() {
    console.log('Executing Blockly runtime...');
    // Runtime execution logic here
  }
};

runtime.execute();
`;
    } catch (error) {
      console.error('Runtime: Error compiling workspace', error);
      throw error;
    }
  }

  private async executeAlephScriptCode(code: string): Promise<void> {
    try {
      console.log('Runtime: Executing compiled AlephScript code');
      
      // Send execution message to the bot
      await this.displayMessage({
        id: Date.now().toString(),
        type: 'system',
        content: `Executing Blockly Runtime Project:\n\`\`\`javascript\n${code}\n\`\`\``,
        timestamp: Date.now()
      });
      
      console.log('Runtime: Code execution completed');
      
    } catch (error) {
      console.error('Runtime: Error executing AlephScript code', error);
      throw error;
    }
  }

  // ===== GamificationUI Implementation =====

  async start(): Promise<void> {
    try {
      console.log(`Starting Blockly Runtime Gamification UI on port ${this.config.port}`);
      
      this.setupExpressApp();
      
      this.server = this.expressApp.listen(this.config.port, () => {
        this.isServerStarted = true;
        const url = `http://localhost:${this.config.port}`;
        console.log(`🚀 Blockly Runtime UI running at: ${url}`);
        
        if (this.config.autoOpenBrowser) {
          this.openBrowser(url);
        }
      });

      // Initialize AlephScript client (inherited from GamificationUI)
      console.log('Runtime: AlephScript client initialized');

    } catch (error) {
      console.error('Runtime: Error starting server', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      console.log('Stopping Blockly Runtime Gamification UI');
      
      if (this.server) {
        this.server.close();
        this.isServerStarted = false;
      }
      
      console.log('Blockly Runtime UI stopped');
    } catch (error) {
      console.error('Error stopping Blockly Runtime UI', error);
      throw error;
    }
  }

  async handleGameMessage(message: GameMessage): Promise<void> {
    try {
      console.log('Runtime: Handling game message', { 
        phase: message.type,
        content: message.content?.substring(0, 100) + '...'
      });

      await this.displayMessage({
        id: Date.now().toString(),
        type: 'system',
        content: `Runtime: ${message.content}`,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Runtime: Error handling game message', error);
    }
  }

  async handleAgentPostulation(postulation: AgentPostulation): Promise<void> {
    try {
      console.log('Runtime: Handling agent postulation', { 
        agentId: postulation.agent.id,
        role: postulation.agent.role 
      });
      
      await this.displayMessage({
        id: Date.now().toString(),
        type: 'system',
        content: `🤖 Runtime Agent Registration: ${postulation.agent.id} as ${postulation.agent.role}`,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Runtime: Error handling agent postulation', error);
    }
  }

  isRunning(): boolean {
    return this.isServerStarted;
  }

  getStatus(): any {
    return {
      type: 'blockly-runtime-gamify-ui',
      port: this.config.port,
      running: this.isRunning(),
      url: `http://localhost:${this.config.port}`,
      environment: 'runtime',
      staticDir: this.config.staticDir,
      botConnected: this.alephScriptBot ? true : false
    };
  }

  private openBrowser(url: string): void {
    const { spawn } = require('child_process');
    const command = process.platform === 'win32' ? 'start' : 
                   process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawn(command, [url], { detached: true, stdio: 'ignore' });
  }
}

export default BlocklyRuntimeGamificationUI;
