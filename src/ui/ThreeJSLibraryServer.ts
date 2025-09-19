/**
 * Example: ThreeJS UI Library Integration
 * Shows how to use the @escrivivir/threejs-ui-lib package
 */

import express from "express";
import path from "path";
import { createServer } from "http";
import { Logger } from "@/utils/logger";
import { AlephScriptClient } from "@/clients/alephscript-client";

export interface ThreeJSLibraryServerConfig {
  port: number;
  gameTitle: string;
  corsOrigin?: string;
  autoOpenBrowser?: boolean;
}

export class ThreeJSLibraryServer {
  private app!: express.Application;
  private server!: ReturnType<typeof createServer>;
  private isServerRunning = false;
  private alephClient?: AlephScriptClient;

  constructor(private config: ThreeJSLibraryServerConfig) {}

  async start(): Promise<void> {
    Logger.info("🎮 Starting ThreeJS Library Server...");

    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();

    this.server = createServer(this.app);

    await new Promise<void>((resolve, reject) => {
      this.server.listen(this.config.port, () => {
        this.isServerRunning = true;
        Logger.info(`🎮 ThreeJS Library Server listening on :${this.config.port}`);
        Logger.info(`🌐 Access at: http://localhost:${this.config.port}`);
        resolve();
      });
      this.server.on("error", reject);
    });

    if (this.config.autoOpenBrowser) {
      await this.openBrowser();
    }

    // Initialize AlephScript client (using the real implementation)
    this.alephClient = new AlephScriptClient(
      `${this.config.gameTitle}`,
      this.appConfig?.launcher?.socketUrl || "http://localhost:3010", // Default AlephScript server port
      "/runtime",
      true
    );

    Logger.info("🔌 AlephScript client initialized and connecting...");
  }

  async stop(): Promise<void> {
    if (!this.isServerRunning) return;
    
    await new Promise<void>((resolve) => {
      this.server.close(() => {
        this.isServerRunning = false;
        Logger.info("🛑 ThreeJS Library Server stopped");
        resolve();
      });
    });
  }

  private setupRoutes(): void {
    // CORS headers
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", this.config.corsOrigin || "*");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      next();
    });

    // Serve static assets from both public and src/assets
    this.app.use("/assets", express.static(path.join(__dirname, "../../public")));
    this.app.use("/assets", express.static(path.join(__dirname, "../assets")));

    // Main application route
    this.app.get("/", (req, res) => {
      res.send(this.generateHTML());
    });

    // API routes
    this.app.get("/api/config", (req, res) => {
      res.json({
        gameTitle: this.config.gameTitle,
        alephScriptUrl: "ws://localhost:8090",
        debugMode: true
      });
    });
  }

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
      <p>ThreeJS UI Library Integration</p>
      <p id="connection-status">Connecting to AlephScript (Socket.IO)...</p>
      <button class="btn" onclick="testConnection()">Test Connection</button>
      <button class="btn" onclick="initializeThreeJS()">Initialize ThreeJS</button>
    </div>
  </div>
  
  <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
  <script src="/assets/alephscript-client.js"></script>
  
  <!-- Three.js using modern ES6 modules -->
  <script type="module">
    import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.175.0/build/three.module.js';
    
    // Make THREE globally available
    window.THREE = THREE;
    window.threeLoaded = true;
    
    console.log('✅ Three.js loaded via ES6 modules:', THREE.REVISION);
    
    // Dispatch custom event when Three.js is ready
    window.dispatchEvent(new CustomEvent('threeReady', { detail: THREE }));
  </script>
  
  <script>
    let alephClient = null;
    
    // Initialize AlephScript connection with native client
    function initializeAlephScript() {
      console.log('🔌 Initializing native AlephScript connection...');
      
      alephClient = createAlephScriptClient(
        'threejs-library',
        'threejs-integration-test',
        'http://localhost:3000', // Socket.IO AlephScript server
        true // debug mode
      );
      
      alephClient.on('connected', () => {
        console.log('✅ Native AlephScript connected!');
        document.getElementById('connection-status').innerHTML = 
          '<span style="color: #00ff00;">✅ Connected to AlephScript (Socket.IO)</span>';
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
          message: 'Hello from ThreeJS Library Native Client!',
          timestamp: Date.now()
        });
        console.log('📤 Test message sent via Socket.IO AlephScript');
        alert('📤 Test message sent successfully!\\nCheck console for details.');
      } else {
        alert('❌ AlephScript not connected. Please wait for connection.');
      }
    }
    
    function initializeThreeJS() {
      console.log('🎮 Initializing ThreeJS scene...');
      
      // Wait for Three.js ES6 module to load
      if (!window.threeLoaded || typeof THREE === 'undefined') {
        console.log('⏳ Waiting for Three.js to load...');
        
        // Listen for the threeReady event
        window.addEventListener('threeReady', function(event) {
          console.log('✅ Three.js ready, initializing scene...');
          createThreeJSScene(event.detail);
        }, { once: true });
        
        // If it's already loaded but event missed
        setTimeout(() => {
          if (window.threeLoaded && typeof THREE !== 'undefined') {
            createThreeJSScene(THREE);
          }
        }, 100);
        
        return;
      }
      
      // Three.js already loaded
      createThreeJSScene(THREE);
    }
    
    function createThreeJSScene(THREE) {
      console.log('✅ Three.js loaded successfully:', THREE.REVISION);
      
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
          message: 'ThreeJS scene loaded with 8 bots in cardinal positions',
          timestamp: Date.now(),
          bots: botPositions.length
        });
      }
    }
    
    function sendBotCommand() {
      if (alephClient) {
        alephClient.sendMessage({
          type: 'bot_command',
          command: 'move_to_position',
          botId: 'bot_north_1',
          position: { x: 0, y: 0, z: 5 },
          timestamp: Date.now()
        });
        console.log('🤖 Bot command sent');
        
        const messageStream = document.getElementById('message-stream');
        if (messageStream) {
          messageStream.innerHTML += '<br>📤 Bot command: move_to_position';
        }
      }
    }
    
    function updateScene() {
      if (alephClient) {
        alephClient.broadcast('scene_update', {
          type: 'lighting_change',
          intensity: Math.random(),
          timestamp: Date.now()
        });
        console.log('🎨 Scene update broadcasted');
        
        const messageStream = document.getElementById('message-stream');
        if (messageStream) {
          messageStream.innerHTML += '<br>🎨 Scene lighting updated';
        }
      }
    }
    
    function testUIEvents() {
      if (alephClient) {
        alephClient.sendMessage({
          type: 'ui_event',
          event: 'phase_change',
          phase: 'gameplay',
          timestamp: Date.now()
        });
        console.log('🎮 UI event sent');
        
        const messageStream = document.getElementById('message-stream');
        if (messageStream) {
          messageStream.innerHTML += '<br>🎮 Phase changed to gameplay';
        }
      }
    }
    
    // Auto-initialize on page load
    document.addEventListener('DOMContentLoaded', function() {
      console.log('🎮 ThreeJS Library Server loaded');
      
      // Check what scripts are loaded
      console.log('Available scripts:', Array.from(document.scripts).map(s => s.src));
      console.log('Socket.IO available:', typeof io !== 'undefined');
      console.log('Three.js available:', typeof THREE !== 'undefined');
      
      if (typeof THREE !== 'undefined') {
        console.log('✅ Three.js loaded successfully, version:', THREE.REVISION);
      } else {
        console.warn('⚠️ Three.js not detected on DOMContentLoaded');
      }
      
      initializeAlephScript();
    });
  </script>
</body>
</html>
    `;
  }

  private async openBrowser(): Promise<void> {
    const url = `http://localhost:${this.config.port}`;
    const isWindows = process.platform === "win32";
    const isMac = process.platform === "darwin";
    
    const { spawn } = await import("child_process");
    const command = isWindows ? "start" : (isMac ? "open" : "xdg-open");
    
    const browserProcess = spawn(command, [url], {
      stdio: "ignore",
      detached: true,
      shell: true
    });
    
    browserProcess.unref();
    Logger.info(`🌐 Browser opened at ${url}`);
  }
}
