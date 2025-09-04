import express from "express";
import path from "path";
import { createServer } from "http";
import { Subject } from "rxjs";
import { spawn, ChildProcess } from "child_process";

import { GamificationUI, BaseGamificationUIConfig, GameMessage, UIPhase, GamificationUIEvent } from "./GamificationUI";
import { MCPDriverAdapter } from "@/drivers/MCPDriverAdapter";
import { Runtime } from "@/runtime/Runtime";
import { Agent, AgentRole } from "@/models/Agent";
import { AgentPostulation } from "@/models/AgentPostulation";
import { Logger } from "@/utils/logger";
import { IOrchestratorChannels } from "@/orchestration/types";
import { AlephScriptClient } from "@/clients/alephscript-client";

export interface UnityGameUIConfig extends BaseGamificationUIConfig {
  port: number;
  buildDir: string;  // Directorio con build WebGL de Unity
  corsOrigin?: string;
  unityBuildName?: string; // Nombre del build (por defecto: index.html)
  /** Auto-build Unity WebGL before serving */
  autoBuild?: boolean;
  /** Auto-open browser */
  autoOpenBrowser?: boolean;
  /** Path to Unity project */
  unityProjectPath?: string;
  /** Unity build target (default: WebGL) */
  unityBuildTarget?: string;
}

export class UnityGamificationUI extends GamificationUI {
  private cfg: UnityGameUIConfig;
  private app!: express.Application;
  private server!: ReturnType<typeof createServer>;
  private isServerRunning = false;

  // AlephScript integration
  private orchestratorChannels?: IOrchestratorChannels;
  private proserpinaBot!: AlephScriptClient;
  private connectedUnityInstances: Set<string> = new Set();
  
  // Browser and build management
  private browserProcess?: ChildProcess;
  private buildProcess?: ChildProcess;
  isActive: boolean = false;

  constructor(runtime: Runtime, mcp: MCPDriverAdapter, config: UnityGameUIConfig) {
    super(runtime, mcp, config);
    this.cfg = {
      autoBuild: true,
      autoOpenBrowser: true,
      unityProjectPath: path.resolve(process.cwd(), "../unity-project"),
      unityBuildTarget: "WebGL",
      unityBuildName: "index.html",
      ...config
    };
  }

  // Orchestrator channels connection
  public connectOrchestrator(channels: IOrchestratorChannels): void {
    this.orchestratorChannels = channels;

    // Forward UI bus -> Unity WebGL clients via AlephScript
    channels.ui.subscribe((msg) => {
      try {
        switch (msg.type) {
          case "display_update":
            this.broadcastToUnity("state_display", { 
              level: msg.payload?.displayType || "info", 
              message: msg.payload?.message || msg.payload, 
              ts: Date.now() 
            });
            break;
          case "notification":
            this.broadcastToUnity("notification", { 
              title: msg.payload?.title || "Info", 
              message: msg.payload?.message || "", 
              type: msg.payload?.displayType || "info" 
            });
            break;
          case "phase_change":
            this.broadcastToUnity("phase_change", { 
              phase: msg.payload?.phase || msg.payload, 
              timestamp: Date.now() 
            });
            break;
          default:
            this.broadcastToUnity("ui_event", msg);
        }
      } catch (e) {
        Logger.warn("Unity UI broadcast failed for ui message", e as Error);
      }
    });

    // Forward SYS messages selectively
    channels.sys.filter("info").subscribe((msg) => {
      // this.broadcastToUnity("sys_info", msg);
    });
  }

  async start(): Promise<void> {
    Logger.info("🎮 Starting Unity Gamification UI...");

    // Step 1: Build Unity WebGL if needed
    if (this.cfg.autoBuild) {
      await this.buildUnityWebGL();
    }

    // Step 2: Setup Express server with enhanced routes (similar to HTML5UI)
    this.app = express();
    this.app.use(express.json());
    this.setupExpressRoutes();

    this.server = createServer(this.app);

    await new Promise<void>((resolve, reject) => {
      this.server.listen(this.cfg.port, () => {
        this.isServerRunning = true;
        Logger.info(`🎮 UnityGamificationUI HTTP server listening on :${this.cfg.port}`);
        Logger.info(`🌐 Access at: http://localhost:${this.cfg.port}`);
        this.emit(GamificationUIEvent.GAME_STARTED, { port: this.cfg.port });
        this.changePhase("menu");
        resolve();
      });
      this.server.on("error", reject);
    });

    // Step 3: Initialize AlephScript client for Socket.IO communication
    this.proserpinaBot = new AlephScriptClient(
      `UnityUI_${this.config.gameTitle}`,
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
        Logger.info("🛑 Unity Gamification UI stopped");
        resolve();
      });
    });
  }

  // === Unity Build Management ===
  
  private async buildUnityWebGL(): Promise<void> {
    return new Promise((resolve, reject) => {
      Logger.info("🔨 Building Unity WebGL...");
      
      const unityPath = this.cfg.unityProjectPath!;
      const isWindows = process.platform === "win32";
      
      // Unity command line build
      // Note: This requires Unity to be installed and accessible via command line
      const unityCmd = isWindows ? "Unity.exe" : "Unity";
      const buildArgs = [
        "-batchmode",
        "-quit",
        "-projectPath", unityPath,
        "-buildTarget", this.cfg.unityBuildTarget || "WebGL",
        "-executeMethod", "BuildScript.BuildWebGL", // Custom build script
        "-logFile", "-"
      ];
      
      this.buildProcess = spawn(unityCmd, buildArgs, {
        cwd: unityPath,
        stdio: ["pipe", "pipe", "pipe"],
        shell: isWindows
      });

      let buildOutput = "";
      let buildError = "";

      this.buildProcess.stdout?.on("data", (data) => {
        const output = data.toString();
        buildOutput += output;
        if (this.config.debugMode) {
          Logger.info(`[Unity Build] ${output.trim()}`);
        }
      });

      this.buildProcess.stderr?.on("data", (data) => {
        const error = data.toString();
        buildError += error;
        Logger.warn(`[Unity Build Error] ${error.trim()}`);
      });

      this.buildProcess.on("close", (code) => {
        this.buildProcess = undefined;
        
        if (code === 0) {
          Logger.info("✅ Unity WebGL built successfully");
          
          // Update build directory to generated WebGL build
          const builtPath = path.join(unityPath, "Builds", "WebGL");
          this.cfg.buildDir = builtPath;
          
          resolve();
        } else {
          Logger.warn(`⚠️ Unity build completed with code ${code} (may have warnings)`);
          Logger.info("Proceeding with existing build if available...");
          
          // Check if build directory exists, proceed if it does
          const builtPath = path.join(unityPath, "Builds", "WebGL");
          try {
            require('fs').statSync(builtPath);
            this.cfg.buildDir = builtPath;
            Logger.info("📁 Using existing Unity build");
            resolve();
          } catch {
            Logger.error(`❌ Unity build failed and no existing build found`);
            Logger.error(`Build output: ${buildOutput}`);
            Logger.error(`Build error: ${buildError}`);
            reject(new Error(`Unity build failed with code ${code}`));
          }
        }
      });

      this.buildProcess.on("error", (error) => {
        this.buildProcess = undefined;
        Logger.warn("⚠️ Unity build process failed, trying to use existing build...");
        
        // Fallback: try to use existing build
        const builtPath = path.join(unityPath, "Builds", "WebGL");
        try {
          require('fs').statSync(builtPath);
          this.cfg.buildDir = builtPath;
          Logger.info("📁 Using existing Unity build");
          resolve();
        } catch {
          Logger.error("❌ Failed to start Unity build process and no existing build found", error);
          reject(error);
        }
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

    // Serve Unity WebGL build with proper headers
    this.app.use(express.static(this.cfg.buildDir, {
      setHeaders: (res, filePath) => {
        // Unity WebGL requires specific headers
        if (filePath.endsWith('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm');
        }
        if (filePath.endsWith('.data')) {
          res.setHeader('Content-Type', 'application/octet-stream');
        }
        if (filePath.endsWith('.symbols.json')) {
          res.setHeader('Content-Type', 'application/json');
        }
        if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        }
        // Enable SharedArrayBuffer for Unity threads (if needed)
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      }
    }));

    // API Routes (similar to HTML5UI)
    this.app.get("/api/status", (req, res) => {
      res.json({
        gameTitle: this.config.gameTitle,
        isActive: this.isActive,
        connectedInstances: this.connectedUnityInstances.size,
        currentPhase: this.currentPhase,
        uiType: "unity",
        port: this.cfg.port,
        buildDir: this.cfg.buildDir,
      });
    });

    this.app.get("/api/config", (req, res) => {
      res.json({
        gameTitle: this.config.gameTitle,
        welcomeMessage: this.config.welcomeMessage,
        debugMode: this.config.debugMode,
        enablePostulations: this.config.enablePostulations,
        uiType: "unity",
        alephScriptEndpoint: "http://localhost:3000/runtime",
        unityBuildName: this.cfg.unityBuildName,
      });
    });

    // Unity WebGL runtime info (legacy compatibility)
    this.app.get("/api/runtime-info", (req, res) => {
      res.json({
        gameTitle: this.cfg.gameTitle,
        alephScriptUrl: "http://localhost:3000/runtime",
        connectedInstances: this.connectedUnityInstances.size,
        timestamp: Date.now()
      });
    });

    // User input endpoint (compatibility with Unity C# frontend)
    this.app.post("/api/input", (req, res) => {
      const { input, message, clientId } = req.body;
      const userInput = input || message;

      if (!userInput) {
        res.status(400).json({ error: "Missing input or message" });
        return;
      }

      Logger.info(`User input from Unity client: ${userInput}`);
      this.sendUserInput(userInput);
      
      // Forward to orchestrator if available
      this.orchestratorChannels?.app.sendActionRequest("unity-ui", "user_input", [userInput]);

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

      Logger.info(`Agent selection from Unity client: ${selectedIndex}`);
      this.selectAgent(selectedIndex);

      res.json({ success: true });
    });

    // Get active agents with 3D positioning
    this.app.get("/api/agents", async (req, res) => {
      try {
        const agents = await this.getActiveAgents();
        res.json({
          agents: agents.map((agent, idx) => ({
            id: agent.id,
            name: agent.name,
            role: agent.role,
            status: "active",
            // Unity-specific 3D positioning
            position: { 
              x: (idx % 4) * 3.0, 
              y: 0.0, 
              z: Math.floor(idx / 4) * 3.0 
            },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
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

    // Unity WebGL entry point - serve main HTML file
    this.app.get("*", (req, res) => {
      const buildFile = this.cfg.unityBuildName || "index.html";
      const indexPath = path.join(this.cfg.buildDir, buildFile);
      res.sendFile(indexPath, (err) => {
        if (err) {
          Logger.error("Failed to serve Unity WebGL build", err);
          res.status(404).send("Unity WebGL build not found. Make sure the Unity project is built for WebGL.");
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
    
    // Broadcast via AlephScript to all connected Unity WebGL instances
    this.proserpinaBot.io.emit("unity_message", messageData);
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
    
    this.proserpinaBot.io.emit("unity_agent_postulations", postulationData);
  }

  async displayNotification(title: string, message: string, type: "info" | "success" | "warning" | "error" = "info"): Promise<void> {
    if (!this.isServerRunning || !this.proserpinaBot) return;
    
    this.proserpinaBot.io.emit("unity_notification", { 
      title, 
      message, 
      type, 
      timestamp: Date.now() 
    });
  }

  async updatePhaseDisplay(phase: UIPhase): Promise<void> {
    if (!this.isServerRunning || !this.proserpinaBot) return;
    
    this.proserpinaBot.io.emit("unity_phase_change", { 
      phase, 
      timestamp: Date.now() 
    });
  }

  // AlephScript event handlers setup
  private setupAlephScriptHandlers(): void {
    if (!this.proserpinaBot) return;

    // Handle Unity WebGL requests for bot configuration
    this.proserpinaBot.io.on("unity_request_bot_configuration", async (data: any) => {
      Logger.info("Unity WebGL client requested bot configuration");
      await this.sendBotConfiguration(data?.instanceId);
    });

    // Handle user input from Unity WebGL
    this.proserpinaBot.io.on("unity_user_input", (data: { input: string; instanceId?: string }) => {
      if (data?.input) {
        Logger.info(`User input from Unity WebGL: ${data.input}`);
        this.sendUserInput(data.input);
        
        // Forward to orchestrator if available
        this.orchestratorChannels?.app.sendActionRequest("unity-ui", "user_input", [data.input]);
      }
    });

    // Handle agent selection from Unity WebGL
    this.proserpinaBot.io.on("unity_agent_selection", (data: { index: number; instanceId?: string }) => {
      if (typeof data?.index === "number") {
        Logger.info(`Agent selection from Unity WebGL: ${data.index}`);
        this.selectAgent(data.index);
      }
    });

    // Handle Unity game events (Unity-specific)
    this.proserpinaBot.io.on("unity_game_event", (data: { 
      eventType: string; 
      payload: any; 
      instanceId?: string 
    }) => {
      Logger.info(`Unity game event: ${data.eventType}`);
      
      // Forward Unity-specific events to orchestrator
      this.orchestratorChannels?.app.sendActionRequest("unity-ui", data.eventType, [data.payload]);
      
      // Emit to other UIs for cross-UI sync
      this.emit(GamificationUIEvent.SYSTEM_MESSAGE, {
        source: "unity",
        eventType: data.eventType,
        payload: data.payload,
        instanceId: data.instanceId
      });
    });

    // Handle Unity object interactions (3D world interactions)
    this.proserpinaBot.io.on("unity_object_interaction", (data: {
      objectId: string;
      interactionType: string;
      position?: { x: number; y: number; z: number };
      instanceId?: string;
    }) => {
      Logger.info(`Unity object interaction: ${data.objectId} (${data.interactionType})`);
      
      // This could trigger agent responses based on 3D world interactions
      this.orchestratorChannels?.app.sendActionRequest("unity-ui", "object_interaction", [data]);
    });

    // Handle Unity instance lifecycle
    this.proserpinaBot.io.on("unity_instance_ready", (data: { instanceId: string; unityVersion?: string }) => {
      this.connectedUnityInstances.add(data.instanceId);
      Logger.info(`Unity WebGL instance ready: ${data.instanceId} (total: ${this.connectedUnityInstances.size})`);
      
      // Send initial configuration to new instance
      this.sendBotConfiguration(data.instanceId);
    });

    this.proserpinaBot.io.on("unity_instance_disconnect", (data: { instanceId: string }) => {
      this.connectedUnityInstances.delete(data.instanceId);
      Logger.info(`Unity WebGL instance disconnected: ${data.instanceId} (total: ${this.connectedUnityInstances.size})`);
    });

    // Handle Unity performance/health reporting
    this.proserpinaBot.io.on("unity_performance_report", (data: {
      fps: number;
      memoryUsage: number;
      instanceId?: string;
    }) => {
      // Optional: Forward to system channel for monitoring
      this.orchestratorChannels?.sys.sendInfo("unity-ui", `Performance: ${data.fps}fps, Memory: ${data.memoryUsage}MB`);
    });
  }

  // Broadcast helper using AlephScript
  private broadcastToUnity(event: string, data: any): void {
    if (!this.proserpinaBot || !this.isServerRunning) return;
    
    this.proserpinaBot.io.emit(`unity_${event}`, {
      ...data,
      timestamp: Date.now(),
      source: "UnityGamificationUI"
    });
  }

  private async sendBotConfiguration(instanceId?: string): Promise<void> {
    try {
      const agents = await this.getActiveAgents();
      const bots = agents.map((a, idx) => ({
        id: a.id,
        name: a.name,
        status: "active",
        role: a.role as AgentRole,
        room: "default-room",
        // Unity-specific positioning (could be 3D coordinates)
        position: { 
          x: (idx % 5) * 5.0, 
          y: 0, 
          z: Math.floor(idx / 5) * 5.0 
        },
        // Unity-specific appearance/config
        unityConfig: {
          prefabName: a.role === AgentRole.GUIDE ? "AssistantBot" : "UserBot",
          scale: { x: 1, y: 1, z: 1 },
          color: this.getAgentColor(a.role),
          animation: "idle"
        },
        spiralIndex: idx,
        messageActivity: 0,
        lastSeen: Date.now(),
      }));
      
      const configData = { 
        bots, 
        timestamp: Date.now(),
        instanceId,
        // Unity-specific world configuration
        worldConfig: {
          environment: "default",
          lighting: "auto",
          cameraPosition: { x: 0, y: 10, z: -10 }
        }
      };
      
      this.proserpinaBot.io.emit("unity_bot_configuration", configData);
      Logger.info(`Sent bot configuration to Unity WebGL instances: ${bots.length} bots`);
    } catch (e) {
      Logger.error("Failed to build Unity bot configuration", e as Error);
      this.proserpinaBot.io.emit("unity_bot_configuration", { 
        bots: [], 
        timestamp: Date.now(),
        error: "Failed to load bot configuration",
        instanceId 
      });
    }
  }

  private getAgentColor(role: AgentRole): string {
    const colorMap: Record<AgentRole, string> = {
      [AgentRole.NARRATOR]: "#4CAF50",    // Green
      [AgentRole.GUIDE]: "#2196F3",       // Blue  
      [AgentRole.PLAYER]: "#FF9800",      // Orange
      [AgentRole.SYSTEM]: "#9C27B0",      // Purple
      [AgentRole.CUSTOM]: "#607D8B"       // Blue Grey
    };
    return colorMap[role] || "#666666";
  }

  // === Public Methods for Monitoring ===

  /**
   * Get connected Unity instances count
   */
  public getConnectedInstancesCount(): number {
    return this.connectedUnityInstances.size;
  }

  /**
   * Get connected Unity instances info
   */
  public getConnectedInstances(): string[] {
    return Array.from(this.connectedUnityInstances);
  }

  /**
   * Check if a specific Unity instance is connected
   */
  public isInstanceConnected(instanceId: string): boolean {
    return this.connectedUnityInstances.has(instanceId);
  }
}

export default UnityGamificationUI;
