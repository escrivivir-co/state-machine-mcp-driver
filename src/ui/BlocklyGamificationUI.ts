/**
 * Blockly Gamification UI
 * Visual programming interface using Blockly for AlephScript
 */

import { GamificationUI, BaseGamificationUIConfig, GameMessage, UIPhase } from './GamificationUI';
import { Runtime } from "@/runtime/Runtime";
import { MCPDriverAdapter } from "@/drivers/MCPDriverAdapter";
import { Logger } from "@/utils/logger";
import { AgentPostulation } from "@/models/AgentPostulation";
import { AlephScriptClient } from "@/clients/alephscript-client";
import express from 'express';
import * as path from 'path';
import * as fs from 'fs';

export interface BlocklyGamificationUIConfig extends BaseGamificationUIConfig {
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
 * Blockly Gamification UI
 * Provides visual programming interface using Blockly blocks
 */
export class BlocklyGamificationUI extends GamificationUI {
  protected config: BlocklyGamificationUIConfig;
  private expressApp: express.Application;
  private server: any;
  private proserpinaBot!: AlephScriptClient;
  private isServerStarted = false;

  constructor(
    runtime: Runtime,
    mcpDriver: MCPDriverAdapter,
    config: BlocklyGamificationUIConfig
  ) {
    super(runtime, mcpDriver, {
      gameTitle: config.gameTitle,
      welcomeMessage: config.welcomeMessage || 'Welcome to Blockly Visual Programming',
      debugMode: config.debugMode,
      maxMessagesPerThread: config.maxMessagesPerThread,
      enablePostulations: config.enablePostulations,
      autoSelectSingleAgent: config.autoSelectSingleAgent
    });

    this.config = config;
    this.expressApp = express();
    this.setupExpressApp();
  }

  // ===== Express Server Setup =====

  private setupExpressApp(): void {
    // Request logging middleware
    this.expressApp.use((req, res, next) => {
      console.log(`🌐 ${req.method} ${req.path} - User-Agent: ${req.headers['user-agent']?.substring(0, 50) || 'unknown'}`);
      next();
    });
    
    // CORS configuration
    this.expressApp.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', this.config.corsOrigin || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });

    // JSON body parser
    this.expressApp.use(express.json({ limit: '10mb' }));
    this.expressApp.use(express.urlencoded({ extended: true }));

    // Setup static file serving
    this.setupStaticFiles();
    
    // Setup API routes
    this.setupAPIRoutes();
  }

  private setupStaticFiles(): void {
    const provideTemplate = this.config.provideTemplate !== false;
    
    console.log(`🔧 Setting up static files with provideTemplate: ${provideTemplate}`);
    
    if (provideTemplate) {
      // Serve Angular app from public_templates (installed by postinstall)
      const staticDir = this.config.staticDir || 
        path.join(process.cwd(), 'public_templates', 'blockly-gamify-ui');
      
      console.log(`🔍 Checking static directory: ${staticDir}`);
      console.log(`🔍 Directory exists: ${fs.existsSync(staticDir)}`);
      
      if (fs.existsSync(staticDir)) {
        console.log(`📁 Serving Blockly UI from: ${staticDir}`);
        
        // List files in the directory for debugging
        const files = fs.readdirSync(staticDir);
        console.log(`📄 Files in static directory:`, files);
        
        this.expressApp.use(express.static(staticDir));
        
        // Angular routes fallback
        this.expressApp.get('*', (req, res) => {
          if (!req.path.startsWith('/api/')) {
            const indexPath = path.resolve(staticDir, 'index.html');
            console.log(`🌐 Serving index.html for route: ${req.path}`);
            console.log(`📄 Index path: ${indexPath}`);
            console.log(`📄 Index exists: ${fs.existsSync(indexPath)}`);
            
            if (fs.existsSync(indexPath)) {
              res.sendFile(indexPath);
            } else {
              res.status(404).send('Blockly UI not found - run build first');
            }
          }
        });
      } else {
        console.warn(`⚠️ Blockly UI static files not found at: ${staticDir}`);
        console.warn('Run: npm install blockly-alephscript-sdk');
        
        // Fallback response
        this.expressApp.get('*', (req, res) => {
          res.status(503).send(`
            <html>
              <head><title>Blockly UI Setup Required</title></head>
              <body>
                <h1>🧩 Blockly AlephScript UI</h1>
                <p>UI not installed. Run: <code>npm install blockly-alephscript-sdk</code></p>
                <p>Expected location: <code>${staticDir}</code></p>
              </body>
            </html>
          `);
        });
      }
    }
  }

  private setupAPIRoutes(): void {
    const apiRouter = express.Router();

    // Blockly workspace management
    apiRouter.get('/workspace/blocks', (req, res) => {
      // Return available AlephScript blocks
      res.json({
        blocks: [
          { type: 'alephscript_bot', category: 'Bot' },
          { type: 'alephscript_message', category: 'Messaging' },
          { type: 'alephscript_channel', category: 'Channels' },
          { type: 'alephscript_orchestrator', category: 'Orchestration' },
          { type: 'alephscript_room', category: 'Rooms' },
          { type: 'alephscript_format', category: 'Formatting' }
        ]
      });
    });

    // Compile Blockly workspace to JavaScript
    apiRouter.post('/workspace/compile', (req, res) => {
      try {
        const { workspace } = req.body;
        
        // Here we would integrate with Blockly's JavaScript generator
        // For now, return a placeholder
        const compiledCode = this.compileBlocklyWorkspace(workspace);
        
        res.json({
          success: true,
          code: compiledCode,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: (error as Error).message
        });
      }
    });

    // Execute compiled AlephScript code
    apiRouter.post('/workspace/execute', async (req, res) => {
      try {
        const { code } = req.body;
        
        // Execute the compiled AlephScript code
        await this.executeAlephScriptCode(code);
        
        res.json({
          success: true,
          message: 'Code executed successfully'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: (error as Error).message
        });
      }
    });

    // Game state and UI integration
    apiRouter.get('/game/state', (req, res) => {
      res.json(this.getCurrentState());
    });

    apiRouter.post('/game/message', async (req, res) => {
      try {
        const { message, channel } = req.body;
        await this.sendUserMessage(message, channel);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: (error as Error).message
        });
      }
    });

    this.expressApp.use('/api', apiRouter);
  }

  // ===== Blockly Integration Methods =====

  private compileBlocklyWorkspace(workspace: any): string {
    // This would integrate with blockly-alephscript-blocks generators
    // For now, return a basic AlephScript template
    
    return `
// Generated AlephScript code from Blockly
import { AlephScriptClient } from 'alephscript';

const bot = new AlephScriptClient('BlocklyBot', {
  serverUrl: 'ws://localhost:3000',
  namespace: '/alephscript'
});

bot.connect();

// Generated blocks code would go here
console.log('Blockly workspace compiled and ready!');
    `;
  }

  private async executeAlephScriptCode(code: string): Promise<void> {
    // Execute the compiled AlephScript code
    // This could involve creating a new bot instance or sending commands
    
    if (this.proserpinaBot) {
      // TODO: Use correct method to execute code
      console.log('Executing AlephScript code:', code);
      
      // Emit to connected Blockly clients for execution
      this.proserpinaBot.io.emit("blockly_execute_code", {
        code,
        timestamp: Date.now()
      });
    } else {
      console.log('Executing AlephScript code:', code);
      // Fallback execution or queue for later
    }
  }

  // ===== GamificationUI Implementation =====

  async start(): Promise<void> {
    if (this.isServerStarted) {
      console.log('📡 Blockly UI server already running');
      return;
    }

    try {
      // Start Express server
      this.server = this.expressApp.listen(this.config.port, () => {
        console.log(`🧩 Blockly UI server started on port ${this.config.port}`);
        console.log(`🌐 Access at: http://localhost:${this.config.port}`);
        
        if (this.config.autoOpenBrowser) {
          this.openBrowser(`http://localhost:${this.config.port}`);
        }
      });

      this.isServerStarted = true;

      // Initialize AlephScript client for Socket.IO communication
      this.proserpinaBot = new AlephScriptClient(
        `${this.config.gameTitle}`,
        "http://localhost:3000", // AlephScript orchestrator server
        "/runtime", // namespace for UI communication
        true
      );

      // Initialize base UI AlephScript integration
      this.initAlephScriptBot(this.proserpinaBot);

      this.changePhase('menu');
      this.emit('gameStarted', { uiType: 'blockly', port: this.config.port });

    } catch (error) {
      console.error('❌ Failed to start Blockly UI server:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
      this.isServerStarted = false;
      console.log('🛑 Blockly UI server stopped');
    }

    if (this.proserpinaBot) {
      this.proserpinaBot.disconnect();
    }

    this.changePhase('complete');
    this.emit('gameStopped', { uiType: 'blockly' });
  }

  async displayMessage(message: GameMessage): Promise<void> {
    // Send message to connected Blockly editor via WebSocket or SSE
    // For now, log to console
    console.log(`💬 [${message.type}] ${message.content}`);
    
    if (this.proserpinaBot) {
      const messageData = {
        botId: message.agent?.id || "system",
        message: message.content,
        type: message.type,
        agent: message.agent,
        metadata: message.metadata,
        timestamp: message.timestamp || Date.now(),
      };
      
      this.proserpinaBot.io.emit("blockly_message", messageData);
    }
  }

  async displayAgentPostulations(postulations: AgentPostulation[]): Promise<void> {
    console.log(`🤖 Agent Postulations (${postulations.length}):`);
    postulations.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.agent.name}: ${p.reason}`);
    });

    if (this.proserpinaBot) {
      const postulationData = {
        postulations: postulations.map((p, i) => ({
          index: i,
          agentId: p.agent.id,
          name: p.agent.name,
          role: p.agent.role,
          reason: p.reason,
          priority: p.priority,
          greediness: p.greediness,
          weight: p.weight,
        })),
        timestamp: Date.now(),
      };
      
      this.proserpinaBot.io.emit("blockly_agent_postulations", postulationData);
    }
  }

  async displayNotification(
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info'
  ): Promise<void> {
    const icon = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' }[type];
    console.log(`${icon} ${title}: ${message}`);

    if (this.proserpinaBot) {
      this.proserpinaBot.io.emit("blockly_notification", { 
        title, 
        message, 
        type, 
        timestamp: Date.now() 
      });
    }
  }

  async updatePhaseDisplay(phase: UIPhase): Promise<void> {
    console.log(`🎯 Phase: ${phase}`);

    if (this.proserpinaBot) {
      this.proserpinaBot.io.emit("blockly_phase_change", { 
        phase, 
        timestamp: Date.now() 
      });
    }
  }

  // ===== Private Helper Methods =====

  private async sendUserMessage(message: string, channel: string = 'app'): Promise<void> {
    if (this.proserpinaBot) {
      this.proserpinaBot.io.emit("blockly_user_message", {
        message,
        channel,
        timestamp: Date.now()
      });
    }

    this.sendUserInput(message);
  }

  private openBrowser(url: string): void {
    const start = process.platform === 'darwin' ? 'open' :
                  process.platform === 'win32' ? 'start' : 'xdg-open';
    
    require('child_process').exec(`${start} ${url}`);
  }
}

export default BlocklyGamificationUI;
