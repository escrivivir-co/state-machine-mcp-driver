import express from "express";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import { Subject } from "rxjs";
import { spawn, ChildProcess } from "child_process";
import { fileURLToPath } from "url";

import { GamificationUI, BaseGamificationUIConfig, GameMessage, UIPhase, GamificationUIEvent } from "./GamificationUI";
import { MCPDriverAdapter } from "@/drivers/MCPDriverAdapter";
import { Runtime } from "@/runtime/Runtime";
import { Agent, AgentRole } from "@/models/Agent";
import { AgentPostulation } from "@/models/AgentPostulation";
import { Logger } from "@/utils/logger";
import { IOrchestratorChannels } from "@/orchestration/types";
import { AlephScriptClient } from "@/clients/alephscript-client";

export interface ThreeJSGameUIConfig extends BaseGamificationUIConfig {
  port: number;
  staticDir: string;
  corsOrigin?: string;
  /** Provide pre-compiled Angular template instead of dynamic HTML */
  provideTemplate?: boolean;
  /** Auto-open browser */
  autoOpenBrowser?: boolean;
  /** Path to threejs-gamify-ui project */
  angularProjectPath?: string;
}

export class ThreeJSGamificationUI extends GamificationUI {
  private cfg: ThreeJSGameUIConfig;
  private app!: express.Application;
  private server!: ReturnType<typeof createServer>;
  private isServerRunning = false;

  // AlephScript integration (replaces direct Socket.IO)
  private orchestratorChannels?: IOrchestratorChannels;
  private proserpinaBot!: AlephScriptClient;
  private connectedClients: Set<string> = new Set();
  
  // Browser management
  private browserProcess?: ChildProcess;

  constructor(runtime: Runtime, mcp: MCPDriverAdapter, config: ThreeJSGameUIConfig) {
    super(runtime, mcp, config);
    this.cfg = {
      provideTemplate: false, // Default: use dynamic HTML generation
      autoOpenBrowser: true,
      angularProjectPath: path.resolve(process.cwd(), "../threejs-gamify-ui"),
      ...config
    };
  }

  // Orchestrator channels connection
  public connectOrchestrator(channels: IOrchestratorChannels): void {
    this.orchestratorChannels = channels;

    // Forward UI bus -> ThreeJS clients via AlephScript
    channels.ui.subscribe((msg) => {
      try {
        switch (msg.type) {
          case "display_update":
            this.broadcastToClients("state_display", { 
              level: msg.payload?.displayType || "info", 
              message: msg.payload?.message || msg.payload, 
              ts: Date.now() 
            });
            break;
          case "notification":
            this.broadcastToClients("notification", { 
              title: msg.payload?.title || "Info", 
              message: msg.payload?.message || "", 
              type: msg.payload?.displayType || "info" 
            });
            break;
          case "phase_change":
            this.broadcastToClients("phase_change", { 
              phase: msg.payload?.phase || msg.payload, 
              timestamp: Date.now() 
            });
            break;
          default:
            this.broadcastToClients("ui_event", msg);
        }
      } catch (e) {
        Logger.warn("ThreeJS UI broadcast failed for ui message", e as Error);
      }
    });

    // Forward SYS messages selectively
    channels.sys.filter("info").subscribe((msg) => {
      this.broadcastToClients("sys_info", msg);
    });
  }

  async start(): Promise<void> {
    Logger.info("🎮 Starting ThreeJS Gamification UI...");

    // Step 1: Setup Express server with dynamic HTML generation
    this.app = express();
    this.app.use(express.json());
    this.setupExpressRoutes();

    this.server = createServer(this.app);

    await new Promise<void>((resolve, reject) => {
      this.server.listen(this.cfg.port, () => {
        this.isServerRunning = true;
        Logger.info(`🎮 ThreeJSGamificationUI HTTP server listening on :${this.cfg.port}`);
        Logger.info(`🌐 Access at: http://localhost:${this.cfg.port}`);
        this.emit(GamificationUIEvent.GAME_STARTED, { port: this.cfg.port });
        this.changePhase("menu");
        resolve();
      });
      this.server.on("error", reject);
    });

    // Step 2: Initialize AlephScript client for Socket.IO communication
    this.proserpinaBot = new AlephScriptClient(
      `ThreeJSUI_${this.config.gameTitle}`,
      "http://localhost:3000", // AlephScript orchestrator server
      "/runtime", // namespace for UI communication
      true
    );

    // Setup AlephScript event handlers
    this.setupAlephScriptHandlers();
    
    // Connect to orchestrator if available
    if (this.orchestratorChannels) {
      this.proserpinaBot.initializeSysChannelIntegration(this.orchestratorChannels);
    }

    // Initialize base UI AlephScript integration
    this.initAlephScriptBot(this.proserpinaBot);

    // Step 4: Auto-open browser if enabled
    if (this.cfg.autoOpenBrowser) {
      await this.openBrowser();
    }
  }

  async stop(): Promise<void> {
    if (!this.isServerRunning) return;
    
    // Close browser process
    if (this.browserProcess && !this.browserProcess.killed) {
      this.browserProcess.kill();
      this.browserProcess = undefined;
    }
    
    // Disconnect AlephScript client
    if (this.proserpinaBot) {
      this.proserpinaBot.disconnect();
    }
    
    await new Promise<void>((resolve) => {
      this.server.close(() => {
        this.isServerRunning = false;
        this.emit(GamificationUIEvent.GAME_STOPPED, {});
        Logger.info("🛑 ThreeJS Gamification UI stopped");
        resolve();
      });
    });
  }

  // === Template Path Resolution ===
  
  private getTemplatePath(): string {
    const fs = require('fs');
    
    // Priority 1: Package installed in public/threejs-ui (recommended for production)
    const packagePath = path.resolve(process.cwd(), "public/threejs-ui/index.html");
    
    // Priority 2: Development path from staticDir config
    const devPath = path.resolve(this.cfg.staticDir, "index.html");
    
    // Priority 3: Legacy path for backward compatibility
    const legacyPath = path.resolve(this.cfg.angularProjectPath || "../threejs-gamify-ui", "dist/public/index.html");
    
    const paths = [
      { path: packagePath, type: "package" },
      { path: devPath, type: "development" },
      { path: legacyPath, type: "legacy" }
    ];
    
    for (const { path: templatePath, type } of paths) {
      if (fs.existsSync(templatePath)) {
        Logger.info(`✅ Using ${type} template: ${templatePath}`);
        return templatePath;
      }
    }
    
    Logger.warn(`⚠️  No template found. Checked paths: ${paths.map(p => p.path).join(', ')}`);
    return devPath; // Return devPath as fallback
  }

  // === Express Routes Setup ===
  
  private setupExpressRoutes(): void {
    // DEBUG: Log all incoming requests
    this.app.use((req, res, next) => {
      Logger.info(`🌐 Port ${this.cfg.port}: ${req.method} ${req.url} - User-Agent: ${req.headers['user-agent']?.substring(0, 50) || 'unknown'}`);
      next();
    });

    // CORS headers
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", this.cfg.corsOrigin || "*");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      next();
    });

    // Serve AlephScript client assets from both public and src/assets
    this.app.use("/assets", express.static(path.join(__dirname, "../../public")));
    this.app.use("/assets", express.static(path.join(__dirname, "../assets")));
    
    // Configure static serving based on provideTemplate setting
    const packageAssetsPath = path.join(__dirname, "../../public/threejs-ui");
    const devAssetsPath = path.join(__dirname, "../../../threejs-gamify-ui/dist/public");
    
    if (this.cfg.provideTemplate) {
      // For template mode: serve Angular app static files directly (EXCEPT index.html)
      if (fs.existsSync(packageAssetsPath)) {
        // Serve Angular compiled files with correct MIME types, but exclude index.html
        this.app.use(express.static(packageAssetsPath, {
          setHeaders: (res, path) => {
            if (path.endsWith('.js')) {
              res.setHeader('Content-Type', 'application/javascript');
            } else if (path.endsWith('.css')) {
              res.setHeader('Content-Type', 'text/css');
            }
          },
          // Exclude index.html so it goes through our custom route handler
          index: false
        }));
        Logger.info(`📦 Serving Angular template assets from: ${packageAssetsPath}`);
        
        // Also serve individual asset folders for Angular app
        this.app.use("/fonts", express.static(path.join(packageAssetsPath, "fonts")));
        this.app.use("/geometries", express.static(path.join(packageAssetsPath, "geometries")));
        this.app.use("/sounds", express.static(path.join(packageAssetsPath, "sounds")));
        this.app.use("/textures", express.static(path.join(packageAssetsPath, "textures")));
      }
    } else {
      // For dynamic mode: serve ThreeJS assets
      const assetsPath = fs.existsSync(packageAssetsPath) ? packageAssetsPath : devAssetsPath;
      
      this.app.use("/threejs-assets", express.static(assetsPath));
      this.app.use("/fonts", express.static(path.join(assetsPath, "fonts")));
      this.app.use("/geometries", express.static(path.join(assetsPath, "geometries")));
      this.app.use("/sounds", express.static(path.join(assetsPath, "sounds")));
      this.app.use("/textures", express.static(path.join(assetsPath, "textures")));
      Logger.info(`🎮 Serving ThreeJS dynamic assets from: ${assetsPath}`);
    }

    // Main application route - serve HTML based on provideTemplate setting
    this.app.get("/", (req, res) => {
      try {
        // DEBUG: Log configuration and request details
        Logger.info(`🔍 DEBUG Port ${this.cfg.port}: Route handler called - provideTemplate=${this.cfg.provideTemplate}, staticDir=${this.cfg.staticDir}`);
        Logger.info(`🔍 DEBUG Port ${this.cfg.port}: Request from ${req.ip}, User-Agent: ${req.headers['user-agent']?.substring(0, 80) || 'unknown'}`);
        
        // Check provideTemplate setting to decide which version to serve
        if (this.cfg.provideTemplate) {
          Logger.info(`🔍 DEBUG Port ${this.cfg.port}: TEMPLATE MODE - Getting template path...`);
          
          // Get template path using priority resolution
          const templatePath = this.getTemplatePath();
          
          // DEBUG: Log template resolution
          Logger.info(`🔍 DEBUG Port ${this.cfg.port}: Using template from ${templatePath}`);
          
          // Check if the template file exists
          if (!require('fs').existsSync(templatePath)) {
            Logger.warn(`Template not found at: ${templatePath}, using fallback dynamic HTML`);
            res.send(this.generateHTML());
            return;
          }
          
          Logger.info(`🔍 DEBUG Port ${this.cfg.port}: Reading template file...`);
          
          // Read the template HTML
          const templateHtml = require('fs').readFileSync(templatePath, 'utf8');
          
          Logger.info(`🔍 DEBUG Port ${this.cfg.port}: Template size: ${templateHtml.length} chars`);
          
          // Check if AlephScript is already included in the template
          const hasAlephScript = templateHtml.includes('alephscript-client.js') || 
                                templateHtml.includes('createAlephScriptClient') ||
                                templateHtml.includes('AlephScriptFrontendClient');
          
          Logger.info(`🔍 DEBUG Port ${this.cfg.port}: AlephScript detected in template: ${hasAlephScript}`);
          
          if (hasAlephScript) {
            // Template already has AlephScript integration, serve as-is
            Logger.info(`📦 Template already includes AlephScript, serving without injection`);
            
            // For Angular templates, remove external AlephScript reference to avoid conflicts
            let cleanTemplate = templateHtml;
            
            // More flexible regex to catch different quote patterns and whitespace variations
            const alephScriptRegex = /<script[^>]*src\s*=\s*['"]\/assets\/alephscript-client\.js['"][^>]*>\s*<\/script>/g;
            
            if (alephScriptRegex.test(templateHtml)) {
              cleanTemplate = templateHtml.replace(
                alephScriptRegex, 
                '<!-- AlephScript already included in compiled bundle -->'
              );
              Logger.info(`🧹 Removed external AlephScript reference to prevent conflicts`);
              Logger.info(`🔍 DEBUG Port ${this.cfg.port}: Original had AlephScript, cleaned version has ${cleanTemplate.length} chars`);
            } else {
              Logger.info(`🔍 DEBUG Port ${this.cfg.port}: No external AlephScript reference found to remove`);
            }
            
            Logger.info(`🎯 DEBUG Port ${this.cfg.port}: Sending cleaned template (${cleanTemplate.length} chars)`);
            res.send(cleanTemplate);
          } else {
            // Inject AlephScript integration for templates that don't have it
            const alephScriptInjection = `
            <!-- AlephScript Integration for Template -->
            <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
            <script src="/assets/alephscript-client.js"></script>
            <script>
              let alephClient = null;
              
              // Initialize AlephScript connection for Angular ThreeJS UI
              function initializeAlephScript() {
                console.log('🔌 Initializing AlephScript for Angular ThreeJS UI...');
                
                alephClient = createAlephScriptClient(
                  'threejs-angular',
                  'threejs-angular-integration',
                  'http://localhost:3000',
                  true
                );
              );
              
              alephClient.on('connected', () => {
                console.log('✅ AlephScript connected to Angular ThreeJS UI!');
                // Send initialization message
                alephClient.sendMessage({
                  type: 'ui_ready',
                  message: 'Angular ThreeJS UI with AlephScript integration ready',
                  timestamp: Date.now()
                });
              });
              
              alephClient.on('disconnected', () => {
                console.log('❌ AlephScript disconnected from Angular ThreeJS UI');
              });
              
              alephClient.on('message', (data) => {
                console.log('📨 Received AlephScript message:', data);
                // Forward to Angular app if needed
                if (window.handleAlephScriptMessage) {
                  window.handleAlephScriptMessage(data);
                }
              });
              
              alephClient.connect();
            }
            
            // Initialize when DOM is ready
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', initializeAlephScript);
            } else {
              initializeAlephScript();
            }
            
            // Export for Angular app usage
            window.alephClient = alephClient;
          </script>
          </body>`;
            
            // Replace closing body tag with our injection
            const modifiedHtml = templateHtml.replace('</body>', alephScriptInjection);
            
            res.send(modifiedHtml);
            Logger.info("✅ Served template with AlephScript integration");
          }
        } else {
          // DEBUG: Log dynamic HTML generation
          Logger.info(`🔍 DEBUG Port ${this.cfg.port}: Using dynamic HTML generation`);
          
          // Use dynamic HTML generation (default behavior)
          res.send(this.generateHTML());
          Logger.info("✅ Served dynamic HTML with AlephScript integration");
        }
        
      } catch (error) {
        Logger.error("Failed to serve HTML", error as Error);
        res.status(500).send("Internal Server Error");
      }
    });

    // API Routes (similar to HTML5UI)
    this.app.get("/api/status", (req, res) => {
      res.json({
        gameTitle: this.config.gameTitle,
        isActive: this.isActive,
        connectedClients: this.connectedClients.size,
        currentPhase: this.currentPhase,
        uiType: "threejs",
        port: this.cfg.port,
      });
    });

    this.app.get("/api/config", (req, res) => {
      res.json({
        gameTitle: this.config.gameTitle,
        welcomeMessage: this.config.welcomeMessage,
        debugMode: this.config.debugMode,
        enablePostulations: this.config.enablePostulations,
        uiType: "threejs",
        alephScriptEndpoint: "http://localhost:3000/runtime",
      });
    });

    // User input endpoint (compatibility with Angular frontend)
    this.app.post("/api/input", (req, res) => {
      const { input, message, clientId } = req.body;
      const userInput = input || message;

      if (!userInput) {
        res.status(400).json({ error: "Missing input or message" });
        return;
      }

      Logger.info(`User input from ThreeJS client: ${userInput}`);
      this.sendUserInput(userInput);
      
      // Forward to orchestrator if available
      this.orchestratorChannels?.app.sendActionRequest("threejs-ui", "user_input", [userInput]);

      res.json({ success: true });
    });

    // Agent selection endpoint
    this.app.post("/api/select-agent", (req, res) => {
      const { agentIndex, index } = req.body;
      const selectedIndex = agentIndex ?? index;

      if (typeof selectedIndex !== "number") {
        res.status(400).json({ error: "Missing agentIndex or index" });
        return;
      }

      Logger.info(`Agent selection from ThreeJS client: ${selectedIndex}`);
      this.selectAgent(selectedIndex);

      res.json({ success: true });
    });

    // Get active agents
    this.app.get("/api/agents", async (req, res) => {
      try {
        const agents = await this.getActiveAgents();
        res.json({
          agents: agents.map((agent, idx) => ({
            id: agent.id,
            name: agent.name,
            role: agent.role,
            status: "active",
            position: { x: (idx % 5) * 2, y: 0, z: Math.floor(idx / 5) * 2 },
          })),
          timestamp: Date.now(),
        });
      } catch (error) {
        Logger.error("Failed to get active agents", error as Error);
        res.status(500).json({ error: "Failed to get active agents" });
      }
    });

    // Favicon endpoint
    this.app.get("/favicon.ico", (req, res) => {
      res.status(204).send();
    });

    // Main route - serve Angular app
    this.app.get("*", (req, res) => {
      const indexPath = path.resolve(this.cfg.staticDir, "index.html");
      res.sendFile(indexPath, (err) => {
        if (err) {
          Logger.error("Failed to serve index.html", err);
          // Don't send another response - sendFile already handles errors
          if (!res.headersSent) {
            res.status(404).send("ThreeJS UI not found. Make sure the Angular app is built.");
          }
        }
      });
    });
  }

  // === Browser Management ===
  
  private async openBrowser(): Promise<void> {
    const url = `http://localhost:${this.cfg.port}`;
    Logger.info(`🌐 Opening browser at ${url}`);

    const platform = process.platform;
    let command: string;
    let args: string[];

    switch (platform) {
      case "darwin": // macOS
        command = "open";
        args = [url];
        break;
      case "win32": // Windows
        command = "start";
        args = ["", url]; // Empty string is needed for start command
        break;
      default: // Linux and others
        command = "xdg-open";
        args = [url];
        break;
    }

    try {
      this.browserProcess = spawn(command, args, {
        detached: true,
        stdio: "ignore",
        shell: platform === "win32"
      });

      // Don't wait for browser process
      this.browserProcess.unref();
      
      Logger.info("✅ Browser opened successfully");
    } catch (error) {
      Logger.warn("⚠️ Could not auto-open browser", error as Error);
      Logger.info(`Please manually navigate to: ${url}`);
    }
  }

  // GamificationUI abstract implementations
  async displayMessage(message: GameMessage): Promise<void> {
    if (!this.isServerRunning || !this.proserpinaBot) return;
    
    const messageData = {
      botId: message.agent?.id || "system",
      message: message.content,
      type: message.type,
      agent: message.agent,
      metadata: message.metadata,
      timestamp: message.timestamp || Date.now(),
    };
    
    // Broadcast via AlephScript to all connected Three.js clients
    this.proserpinaBot.io.emit("threejs_message", messageData);
  }

  async displayAgentPostulations(postulations: AgentPostulation[]): Promise<void> {
    if (!this.isServerRunning || !this.proserpinaBot) return;
    
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
    
    this.proserpinaBot.io.emit("threejs_agent_postulations", postulationData);
  }

  async displayNotification(title: string, message: string, type: "info" | "success" | "warning" | "error" = "info"): Promise<void> {
    if (!this.isServerRunning || !this.proserpinaBot) return;
    
    this.proserpinaBot.io.emit("threejs_notification", { 
      title, 
      message, 
      type, 
      timestamp: Date.now() 
    });
  }

  async updatePhaseDisplay(phase: UIPhase): Promise<void> {
    if (!this.isServerRunning || !this.proserpinaBot) return;
    
    this.proserpinaBot.io.emit("threejs_phase_change", { 
      phase, 
      timestamp: Date.now() 
    });
  }

  // AlephScript event handlers setup
  private setupAlephScriptHandlers(): void {
    if (!this.proserpinaBot) return;

    // Handle Three.js client requests for bot configuration
    this.proserpinaBot.io.on("threejs_request_bot_configuration", async (data: any) => {
      Logger.info("ThreeJS client requested bot configuration");
      await this.sendBotConfiguration(data?.clientId);
    });

    // Handle user input from Three.js clients
    this.proserpinaBot.io.on("threejs_user_input", (data: { input: string; clientId?: string }) => {
      if (data?.input) {
        Logger.info(`User input from ThreeJS client: ${data.input}`);
        this.sendUserInput(data.input);
        
        // Forward to orchestrator if available
        this.orchestratorChannels?.app.sendActionRequest("threejs-ui", "user_input", [data.input]);
      }
    });

    // Handle agent selection from Three.js clients
    this.proserpinaBot.io.on("threejs_agent_selection", (data: { index: number; clientId?: string }) => {
      if (typeof data?.index === "number") {
        Logger.info(`Agent selection from ThreeJS client: ${data.index}`);
        this.selectAgent(data.index);
      }
    });

    // Handle client connection/disconnection tracking
    this.proserpinaBot.io.on("threejs_client_connect", (data: { clientId: string }) => {
      this.connectedClients.add(data.clientId);
      Logger.info(`ThreeJS client connected: ${data.clientId} (total: ${this.connectedClients.size})`);
    });

    this.proserpinaBot.io.on("threejs_client_disconnect", (data: { clientId: string }) => {
      this.connectedClients.delete(data.clientId);
      Logger.info(`ThreeJS client disconnected: ${data.clientId} (total: ${this.connectedClients.size})`);
    });

    // Handle heartbeat
    this.proserpinaBot.io.on("threejs_heartbeat", (data: { clientId?: string }) => {
      this.proserpinaBot.io.emit("threejs_heartbeat_response", { 
        timestamp: Date.now(),
        clientId: data?.clientId 
      });
    });
  }

  // Broadcast helper using AlephScript
  private broadcastToClients(event: string, data: any): void {
    if (!this.proserpinaBot || !this.isServerRunning) return;
    
    this.proserpinaBot.io.emit(`threejs_${event}`, {
      ...data,
      timestamp: Date.now(),
      source: "ThreeJSGamificationUI"
    });
  }

  private async sendBotConfiguration(clientId?: string): Promise<void> {
    try {
      const agents = await this.getActiveAgents();
      const bots = agents.map((a, idx) => ({
        id: a.id,
        name: a.name,
        status: "active",
        role: a.role as AgentRole,
        room: "default-room",
        position: { x: (idx % 5) * 2, y: 0, z: Math.floor(idx / 5) * 2 },
        spiralIndex: idx,
        messageActivity: 0,
        lastSeen: Date.now(),
      }));
      
      const configData = { 
        bots, 
        timestamp: Date.now(),
        clientId 
      };
      
      this.proserpinaBot.io.emit("threejs_bot_configuration", configData);
      Logger.info(`Sent bot configuration to ThreeJS clients: ${bots.length} bots`);
    } catch (e) {
      Logger.error("Failed to build bot configuration", e as Error);
      this.proserpinaBot.io.emit("threejs_bot_configuration", { 
        bots: [], 
        timestamp: Date.now(),
        error: "Failed to load bot configuration",
        clientId 
      });
    }
  }

  // === HTML Generation (Dynamic ThreeJS UI) ===
  
  private generateHTML(): string {
    return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${this.config.gameTitle}</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
  <style>
    body { 
      margin: 0; 
      padding: 0; 
      overflow: hidden; 
      background: #1a1a1a; 
      color: white; 
      font-family: Arial, sans-serif; 
    }
    .container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      flex-direction: column;
    }
    .status {
      padding: 20px;
      text-align: center;
    }
    .btn {
      padding: 10px 20px;
      background: #3498db;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin: 5px;
    }
    .btn:hover {
      background: #2980b9;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="status">
      <h1>🎮 ${this.config.gameTitle}</h1>
      <p>ThreeJS Gamification UI (AlephScript Integrated)</p>
      <p id="connection-status">Connecting to AlephScript...</p>
      <button class="btn" onclick="testConnection()">Test Connection</button>
      <button class="btn" onclick="initializeThreeJS()">Initialize ThreeJS</button>
    </div>
  </div>
  
  <!-- Socket.IO for AlephScript client integration -->
  <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
  <script src="/assets/alephscript-client.js"></script>
  
  <script type="module">
    // Modern ES6 module import for Three.js
    let THREE;
    try {
      THREE = await import('https://cdn.jsdelivr.net/npm/three@0.175.0/build/three.module.js');
      console.log('✅ Three.js ES6 module loaded successfully:', THREE.REVISION);
      window.THREE = THREE; // Make it globally accessible for legacy code
      window.threeJSLoaded = true;
      
      // Trigger custom event when Three.js is ready
      document.dispatchEvent(new CustomEvent('threejs-loaded', { detail: { THREE } }));
    } catch (error) {
      console.error('❌ Failed to load Three.js ES6 module:', error);
      // Fallback to UMD version
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/three@0.175.0/build/three.min.js';
      script.onload = () => {
        console.log('✅ Three.js UMD fallback loaded successfully');
        window.threeJSLoaded = true;
        document.dispatchEvent(new CustomEvent('threejs-loaded', { detail: { THREE: window.THREE } }));
      };
      script.onerror = () => {
        console.error('❌ Three.js UMD fallback also failed');
        window.threeJSLoaded = false;
      };
      document.head.appendChild(script);
    }
  </script>
  <script>
    let alephClient = null;
    
    // Initialize AlephScript connection with native client
    function initializeAlephScript() {
      console.log('🔌 Initializing native AlephScript connection...');
      
      alephClient = createAlephScriptClient(
        'threejs-gamification',
        'threejs-ui-integration',
        'http://localhost:3000', // AlephScript server
        true // debug mode
      );
      
      alephClient.on('connected', () => {
        console.log('✅ Native AlephScript connected!');
        document.getElementById('connection-status').innerHTML = 
          '<span style="color: #00ff00;">✅ Connected to AlephScript</span>';
      });
      
      alephClient.on('disconnected', () => {
        console.log('❌ Native AlephScript disconnected');
        document.getElementById('connection-status').innerHTML = 
          '<span style="color: #ff0000;">❌ Disconnected from AlephScript</span>';
      });
      
      alephClient.on('message', (data) => {
        console.log('📨 Received AlephScript message:', data);
      });
      
      alephClient.connect();
    }
    
    function testConnection() {
      if (alephClient && alephClient.isConnected) {
        alephClient.sendMessage({
          type: 'test',
          message: 'Hello from ThreeJS Gamification UI!',
          timestamp: Date.now()
        });
        console.log('📤 Test message sent via AlephScript');
        alert('📤 Test message sent successfully!\\nCheck console for details.');
      } else {
        alert('❌ AlephScript not connected. Please wait for connection.');
      }
    }
    
    function initializeThreeJS() {
      console.log('🎮 Initializing ThreeJS scene...');
      
      // Check if Three.js is loaded
      if (!window.threeJSLoaded) {
        console.log('⏳ Waiting for Three.js to load...');
        // Poll for Three.js to be loaded
        const checkInterval = setInterval(() => {
          if (window.threeJSLoaded && typeof THREE !== 'undefined') {
            clearInterval(checkInterval);
            startThreeJSScene();
          }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          if (!window.threeJSLoaded) {
            console.error('❌ Three.js loading timeout');
            alert('Three.js failed to load. Please refresh the page.');
          }
        }, 10000);
        return;
      }
      
      startThreeJSScene();
    }
    
    function startThreeJSScene() {
      console.log('✅ Three.js loaded successfully, starting scene...');
      
      // Hide the status container and show ThreeJS
      document.querySelector('.container').style.display = 'none';
      
      // Create ThreeJS scene
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ antialias: true });
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x1a1a1a);
        document.body.appendChild(renderer.domElement);
      
      // Create a simple demo scene with bots
      const botGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const bots = [];
      
      // Create 8 bots in cardinal positions
      const botPositions = [
        { x: 0, z: 3, name: 'bot_north_1' },
        { x: 0, z: -3, name: 'bot_south_1' },
        { x: 3, z: 0, name: 'bot_east_1' },
        { x: -3, z: 0, name: 'bot_west_1' },
        { x: 2, z: 2, name: 'bot_northeast_1' },
        { x: -2, z: 2, name: 'bot_northwest_1' },
        { x: 2, z: -2, name: 'bot_southeast_1' },
        { x: -2, z: -2, name: 'bot_southwest_1' }
      ];
      
      botPositions.forEach((pos, index) => {
        const material = new THREE.MeshPhongMaterial({ 
          color: [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff, 0xffffff, 0x888888][index] 
        });
        const bot = new THREE.Mesh(botGeometry, material);
        bot.position.set(pos.x, 0.5, pos.z);
        bot.userData = { name: pos.name, originalY: 0.5 };
        scene.add(bot);
        bots.push(bot);
      });
      
      // Add ground plane
      const planeGeometry = new THREE.PlaneGeometry(10, 10);
      const planeMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
      const plane = new THREE.Mesh(planeGeometry, planeMaterial);
      plane.rotation.x = -Math.PI / 2;
      scene.add(plane);
      
      // Add lighting
      const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 10, 5);
      scene.add(directionalLight);
      
      // Position camera
      camera.position.set(5, 5, 5);
      camera.lookAt(0, 0, 0);
      
      // Animation loop
      const clock = new THREE.Clock();
      function animate() {
        requestAnimationFrame(animate);
        
        const elapsedTime = clock.getElapsedTime();
        
        // Animate bots with gentle bobbing
        bots.forEach((bot, index) => {
          const bobOffset = Math.sin(elapsedTime * 1.5 + index * 0.3) * 0.1;
          bot.position.y = bot.userData.originalY + bobOffset;
          bot.rotation.y += 0.01;
        });
        
        renderer.render(scene, camera);
      }
      
      animate();
      
      // Handle window resize
      window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });
      
      console.log('✅ ThreeJS scene initialized with 8 bots!');
      
      // Send message to AlephScript about scene initialization
      if (alephClient) {
        alephClient.sendMessage({
          type: 'scene_initialized',
          message: 'ThreeJS Gamification UI scene loaded with 8 bots',
          timestamp: Date.now(),
          bots: botPositions.length
        });
      }
    }
    
    // Auto-initialize on page load
    document.addEventListener('DOMContentLoaded', function() {
      console.log('🎮 ThreeJS Gamification UI loaded');
      
      // Check what scripts are loaded
      console.log('Available scripts:', Array.from(document.scripts).map(s => s.src));
      console.log('AlephScript client available:', typeof createAlephScriptClient !== 'undefined');
      console.log('Socket.IO available (for AlephScript):', typeof io !== 'undefined');
      
      // Wait for Three.js ES6 module to be fully loaded
      if (window.threeJSLoaded) {
        console.log('✅ Three.js already loaded, version:', THREE.REVISION);
        initializeAlephScript();
      } else {
        console.log('⏳ Waiting for Three.js ES6 module...');
        // Poll for Three.js to be loaded
        const checkThreeJS = setInterval(() => {
          if (window.threeJSLoaded && window.THREE) {
            clearInterval(checkThreeJS);
            console.log('✅ Three.js loaded after polling, version:', window.THREE.REVISION);
            initializeAlephScript();
          }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkThreeJS);
          if (!window.threeJSLoaded) {
            console.warn('⚠️ Three.js loading timeout, proceeding with AlephScript only');
            initializeAlephScript();
          }
        }, 10000);
      }
    });
  </script>
</body>
</html>
    `;
  }
}

export default ThreeJSGamificationUI;