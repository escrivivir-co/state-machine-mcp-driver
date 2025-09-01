secre@ALEPH MINGW64 /e/LAB_AGOSTO/state-machine-mcp-driver (dev/003)
$ npm run start2

> state-machine-mcp-driver@0.0.1 start2
> npm run example2


> state-machine-mcp-driver@0.0.1 example2
> npm run example2:app


> state-machine-mcp-driver@0.0.1 example2:app
> cross-env OLLAMA_MODEL=gpt-oss:20b MCP_QUIET=false npx tsx examples/xplus1-app/xplus1-app.ts examples/xplus1-app/xplus1-config.json

📋 Loading XPlus1 configuration from: examples/xplus1-app/xplus1-config.json
🎮 Starting XPlus1 Game: X+1 Multi-UI Demo
🚀 State Machine MCP Driver - Application Launcher
===================================================
📱 Orchestrator Config Agents requested: 3
🔄 Initializing Interface Orchestrator...
]: 🎼 Orchestrator initialized with 3 channels
🚀 Application Channel: Ready for business logic events
📡 Channel APP started
🔧 System Channel: Monitoring system health and logs
📡 Channel SYS started
🎨 UI Channel: Ready for user interactions and display updates
📡 Channel UI started
[SYS] 📨 info from state-manager { level: 'info', message: 'State Manager component initialized' }
]: 📊 State Manager component initialized
✅ Interface Orchestrator initialized

🔍 Phase 1: Environment Checks
--------------------------------
📡 Checking Ollama server...
[SYS] 📨 info from orchestrator {
  level: 'info',
  message: 'Component State Manager (state-manager) registered successfully'
}
]: 📦 Component registered: State Manager (state-manager)
[SYS] 📨 info from ui-controller { level: 'info', message: 'UI Controller component initialized' }
]: 🎨 UI Controller component initialized
[SYS] 📨 info from orchestrator {
  level: 'info',
  message: 'Component UI Controller (ui-controller) registered successfully'
}
]: 📦 Component registered: UI Controller (ui-controller)
[SYS] 📨 info from system-monitor { level: 'info', message: 'System Monitor component initialized' }
]: 🔍 System Monitor component initialized
[SYS] 📨 info from orchestrator {
  level: 'info',
  message: 'Component System Monitor (system-monitor) registered successfully'
}
]: 📦 Component registered: System Monitor (system-monitor)
[SYS] 📨 info from orchestrator { level: 'info', message: 'Orchestrator started successfully' }
]: 🚀 Orchestrator started successfully
[SYS] 📨 info from orchestrator { level: 'info', message: 'Periodic statistics update' }
✅ Ollama server running (version: 0.11.8)
🤖 Checking model: GPT-OSS:20b...
⚠️  Model GPT-OSS:20b not found. Attempting to pull...
📥 Pulling model GPT-OSS:20b...

✅ Model GPT-OSS:20b pulled successfully
📁 Checking project structure...
✅ src/runtime/Runtime.ts

⚡ Phase 2: Starting MCP Service Launcher
------------------------------------------
✅ MCP Service Launcher ready on port 3050
📡 Listening for MCP protocol connections...
]: ]: MCPClientDriver: Successfully connected to MCP Service Launcher at http://localhost:3050

🎯 Phase 3: Launching MCP Servers via Service Launcher
--------------------------------------------------------
🚀 Launching all MCP servers...
]: MCP Launcher: Process devops-mcp-server spawned successfully npx.cmd tsx src/mcp-servers/DevOpsServer.ts Pid: 4864
]: MCP Launcher: Process state-machine-server spawned successfully npx.cmd tsx src/mcp-servers/MCPStateMachineServer.ts Pid: 8444
]: MCP Launcher: Process wiki-mcp-browser spawned successfully npx.cmd tsx src/mcp-servers/MCPWikiBrowserServer.ts Pid: 17432
[SYS] 📨 health_check from system-monitor {
  serviceId: 'orchestrator',
  health: true,
  message: 'System healthy - Memory: 26MB',
  status: 'online'
}
]: 🔍 Health check for orchestrator: healthy
[UI] 📨 render_request from system-monitor {
  component: 'system-stats',
  renderData: {
    memory: 26,
    uptime: 11,
    healthChecks: { orchestrator: true },
    timestamp: 1756665175695
  }
}
📊 Launch Results: 1
✅ All MCP servers launched successfully via service launcher
]: ]: MCPClientDriver: Successfully connected to DevOps MCP Server at http://localhost:3003
]: ]: MCPClientDriver: Successfully connected to Simple MCP Server for State Machines at http://localhost:3004
]: ]: MCPClientDriver: Successfully connected to Wiki MCP Browser at http://localhost:3002
]: Initial launch Done!

🏥 Phase 4: Health Checks
---------------------------
🔍 Performing health checks via service launcher...
📊 Health Check Results: 1
✅ DevOps MCP Server: Healthy
✅ Simple MCP Server for State Machines: Healthy
✅ Wiki MCP Browser: Healthy
🎉 All MCP servers are healthy!

🔧 VS Code MCP Configuration Generator
]: =====================================
]: 📡 Connecting to MCP Service Launcher...
]:
🛠️  Generating VS Code MCP configuration...
]: ✅ Configuration generated successfully!
]: 📁 Saved to: .vscode/mcp.json

🎮 Phase 5: Launching Application
-----------------------------------
]: [RUNTIME] Initializing runtime {"graphId":"x-plus-1-game","userId":"player-1"}
]: [RUNTIME] StateGraph loaded {"graphId":"x-plus-1-game","statesCount":0}
]: [RUNTIME] Loaded existing state {"transitionsCount":0}
]: Agent DionisioBot now has a prompt!
]: [RUNTIME] Agent added: DionisioBot {"agentId":"dionisio-bot","role":"narrator"}
]: Agent ApoloBot now has a prompt!
]: [RUNTIME] Agent added: ApoloBot {"agentId":"apolo-bot","role":"guide"}
]: Agent JusticeBot now has a prompt!
]: [RUNTIME] Agent added: JusticeBot {"agentId":"justice-bot","role":"system"}
]: [RUNTIME] Agent added: UserSimulator {"agentId":"user-simulator","role":"player"}
]: [RUNTIME] Runtime initialized successfully
✅ Runtime initialized
🔄 Initializing Multi-UI Manager...
🚀 Starting Multi-UI Manager...
]: Starting Multi-UI Game Manager for 'X+1 Multi-UI Demo'
]: Creating UI instance: Console Interface (custom)
]: Loading custom UI: @ui/templates/state-machine-ui
]: Creating custom UI in independent console: @ui/templates/state-machine-ui
]: 🔍 Resolving custom class path: @ui/templates/state-machine-ui
]: 📁 Working directory: E:\LAB_AGOSTO\state-machine-mcp-driver
]: 🔍 Checking 11 possible paths:
]:    Checking: E:\LAB_AGOSTO\state-machine-mcp-driver\src\ui\templates\state-machine-ui
]:    Checking: E:\LAB_AGOSTO\state-machine-mcp-driver\src\ui\templates\state-machine-ui.js
]:    Checking: E:\LAB_AGOSTO\state-machine-mcp-driver\src\ui\templates\state-machine-ui.ts
]: ✅ Found file: E:\LAB_AGOSTO\state-machine-mcp-driver\src\ui\templates\state-machine-ui.ts
]: Resolving custom class path: @ui/templates/state-machine-ui -> E:\LAB_AGOSTO\state-machine-mcp-driver\src\ui\templates\state-machine-ui.ts
]: Is TypeScript file: true
]: Using tsx for TypeScript execution
]: Created custom UI launcher script: C:\Users\secre\AppData\Local\Temp\custom-ui-launcher-1756665176002.js
]: Launching Node.js script in independent console: C:\Users\secre\AppData\Local\Temp\custom-ui-launcher-1756665176002.js
]: Platform: win32, Node: C:\Users\secre\.nvm\versions\node\v20.16.0\bin\node.exe
]: Script args: C:\Users\secre\AppData\Local\Temp\custom-ui-launcher-1756665176002.js
]: Successfully launched console process (PID: 17912)
]: Custom UI launched in independent console (PID: 17912)
]: Created independent console UI wrapper for Console Interface (PID: 17912)
]: Creating UI instance: Web Game Interface (html5)
]: Starting UI instance: Console Interface
]: Independent console UI already started (PID: 17912)
✅ UI started: Console Interface (console-primary)
]: UI instance started: Console Interface
]: Starting UI instance: Web Game Interface
]: HTML5 Game UI started on port 8080
🌐 Game UI available at: http://localhost:8080
✅ UI started: Web Game Interface (web-interface)
]: UI instance started: Web Game Interface
🎉 All 2 UI instances are ready!

============================================================
🎮 X+1 Multi-UI Demo - Multi-UI Active
============================================================

📱 Active Interfaces:
  • Console Interface (custom)
    👑 Primary Interface
  • Web Game Interface (html5)
    🌐 Web URL: http://localhost:8080

📊 Status: 2/2 UIs active
🎯 Primary UI: console-primary

🎮 Game Commands:
  • Type in any active interface to interact
  • Console UI: Full command support
  • Web UI: Click and interact through browser
  • Ctrl+C: Stop all interfaces

============================================================
]: Multi-UI Game Manager started with 2 UI instances

🎮 Multi-UI Game is running!
Press Ctrl+C to stop all interfaces.
📋 FINISHED: Loading XPlus1 configuration from: examples/xplus1-app/xplus1-config.json
[SYS] 📨 health_check from system-monitor {
  serviceId: 'orchestrator',
  health: true,
  message: 'System healthy - Memory: 29MB',
  status: 'online'
}
]: 🔍 Health check for orchestrator: healthy
[UI] 📨 render_request from system-monitor {
  component: 'system-stats',
  renderData: {
    memory: 29,
    uptime: 21,
    healthChecks: { orchestrator: true },
    timestamp: 1756665185706
  }
}
[SYS] 📨 info from orchestrator { level: 'info', message: 'Periodic statistics update' }
[SYS] 📨 health_check from system-monitor {
  serviceId: 'orchestrator',
  health: true,
  message: 'System healthy - Memory: 30MB',
  status: 'online'
}
]: 🔍 Health check for orchestrator: healthy
[UI] 📨 render_request from system-monitor {
  component: 'system-stats',
  renderData: {
    memory: 30,
    uptime: 31,
    healthChecks: { orchestrator: true },
    timestamp: 1756665195706
  }
}
[SYS] 📨 health_check from system-monitor {
  serviceId: 'orchestrator',
  health: true,
  message: 'System healthy - Memory: 30MB',
  status: 'online'
}
]: 🔍 Health check for orchestrator: healthy
[UI] 📨 render_request from system-monitor {
  component: 'system-stats',
  renderData: {
    memory: 30,
    uptime: 41,
    healthChecks: { orchestrator: true },
    timestamp: 1756665205721
  }
}
]: [RUNTIME] State saved successfully
[SYS] 📨 health_check from system-monitor {
  serviceId: 'orchestrator',
  health: true,
  message: 'System healthy - Memory: 29MB',
  status: 'online'
}
]: 🔍 Health check for orchestrator: healthy
[UI] 📨 render_request from system-monitor {
  component: 'system-stats',
  renderData: {
    memory: 29,
    uptime: 51,
    healthChecks: { orchestrator: true },
    timestamp: 1756665215724
  }
}
[SYS] 📨 info from orchestrator { level: 'info', message: 'Periodic statistics update' }
[SYS] 📨 health_check from system-monitor {
  serviceId: 'orchestrator',
  health: true,
  message: 'System healthy - Memory: 29MB',
  status: 'online'
}
]: 🔍 Health check for orchestrator: healthy
[UI] 📨 render_request from system-monitor {
  component: 'system-stats',
  renderData: {
    memory: 29,
    uptime: 61,
    healthChecks: { orchestrator: true },
    timestamp: 1756665225732
  }
}
[SYS] 📨 health_check from system-monitor {
  serviceId: 'orchestrator',
  health: true,
  message: 'System healthy - Memory: 30MB',
  status: 'online'
}
]: 🔍 Health check for orchestrator: healthy
[UI] 📨 render_request from system-monitor {
  component: 'system-stats',
  renderData: {
    memory: 30,
    uptime: 71,
    healthChecks: { orchestrator: true },
    timestamp: 1756665235742
  }
}
]: [RUNTIME] State saved successfully
[SYS] 📨 health_check from system-monitor {
  serviceId: 'orchestrator',
  health: true,
  message: 'System healthy - Memory: 30MB',
  status: 'online'
}
]: 🔍 Health check for orchestrator: healthy
[UI] 📨 render_request from system-monitor {
  component: 'system-stats',
  renderData: {
    memory: 30,
    uptime: 81,
    healthChecks: { orchestrator: true },
    timestamp: 1756665245754
  }
}
[SYS] 📨 info from orchestrator { level: 'info', message: 'Periodic statistics update' }
[SYS] 📨 health_check from system-monitor {
  serviceId: 'orchestrator',
  health: true,
  message: 'System healthy - Memory: 30MB',
  status: 'online'
}
]: 🔍 Health check for orchestrator: healthy
[UI] 📨 render_request from system-monitor {
  component: 'system-stats',
  renderData: {
    memory: 30,
    uptime: 91,
    healthChecks: { orchestrator: true },
    timestamp: 1756665255767
  }
}
[SYS] 📨 health_check from system-monitor {
  serviceId: 'orchestrator',
  health: true,
  message: 'System healthy - Memory: 29MB',
  status: 'online'
}
]: 🔍 Health check for orchestrator: healthy
[UI] 📨 render_request from system-monitor {
  component: 'system-stats',
  renderData: {
    memory: 29,
    uptime: 101,
    healthChecks: { orchestrator: true },
    timestamp: 1756665265772
  }
}
]: 