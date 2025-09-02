import express from "express";
import path from "path";
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
  /** Auto-build Angular app before serving */
  autoBuild?: boolean;
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
  private buildProcess?: ChildProcess;

  constructor(runtime: Runtime, mcp: MCPDriverAdapter, config: ThreeJSGameUIConfig) {
    super(runtime, mcp, config);
    this.cfg = {
      autoBuild: true,
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

    // Step 1: Build Angular app if needed
    if (this.cfg.autoBuild) {
      await this.buildAngularApp();
    }

    // Step 2: Setup Express server with enhanced routes (similar to HTML5UI)
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

    // Step 3: Initialize AlephScript client for Socket.IO communication
    this.proserpinaBot = new AlephScriptClient(
      `ThreeJSUI_${this.config.gameTitle}`,
      "http://localhost:3000", // AlephScript server
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
    
    // Stop build process if running
    if (this.buildProcess && !this.buildProcess.killed) {
      this.buildProcess.kill();
      this.buildProcess = undefined;
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

  // === Angular Build Management ===
  
  private async buildAngularApp(): Promise<void> {
    return new Promise((resolve, reject) => {
      Logger.info("🔨 Building Angular ThreeJS app...");
      
      const angularPath = this.cfg.angularProjectPath!;
      const isWindows = process.platform === "win32";
      const npmCmd = isWindows ? "npm.cmd" : "npm";
      
      this.buildProcess = spawn(npmCmd, ["run", "build"], {
        cwd: angularPath,
        stdio: ["pipe", "pipe", "pipe"],
        shell: isWindows
      });

      let buildOutput = "";
      let buildError = "";

      this.buildProcess.stdout?.on("data", (data) => {
        const output = data.toString();
        buildOutput += output;
        if (this.config.debugMode) {
          Logger.info(`[Angular Build] ${output.trim()}`);
        }
      });

      this.buildProcess.stderr?.on("data", (data) => {
        const error = data.toString();
        buildError += error;
        Logger.warn(`[Angular Build Error] ${error.trim()}`);
      });

      this.buildProcess.on("close", (code) => {
        this.buildProcess = undefined;
        
        if (code === 0) {
          Logger.info("✅ Angular ThreeJS app built successfully");
          
          // Update static directory to built app
          const builtAppPath = path.join(angularPath, "dist", "threegamification-ui");
          this.cfg.staticDir = builtAppPath;
          
          resolve();
        } else {
          Logger.error(`❌ Angular build failed with code ${code}`);
          Logger.error(`Build output: ${buildOutput}`);
          Logger.error(`Build error: ${buildError}`);
          reject(new Error(`Angular build failed with code ${code}`));
        }
      });

      this.buildProcess.on("error", (error) => {
        this.buildProcess = undefined;
        Logger.error("❌ Failed to start Angular build process", error);
        reject(error);
      });
    });
  }

  // === Express Routes Setup ===
  
  private setupExpressRoutes(): void {
    // CORS headers
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", this.cfg.corsOrigin || "*");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      next();
    });

    // Serve static files from built Angular app
    this.app.use(express.static(this.cfg.staticDir));

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
      const indexPath = path.join(this.cfg.staticDir, "index.html");
      res.sendFile(indexPath, (err) => {
        if (err) {
          Logger.error("Failed to serve index.html", err);
          res.status(404).send("ThreeJS UI not found. Make sure the Angular app is built.");
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
}

export default ThreeJSGamificationUI;