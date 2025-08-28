# Application Launcher Documentation

The Application Launcher provides a comprehensive solution for starting all components of the State Machine MCP Driver in the correct order with proper health checks and dependency management.

## Quick Start

### Run X+1 State Machine Game
```bash
npm run launcher:x-plus-1
```

This single command will:
1. ✅ Check environment (Ollama, models, files)
2. ⚡ Start MCP servers (X+1 Machine, Wiki Browser)
3. 🏥 Perform health checks on all services
4. 🎮 Launch the X+1 game application

## Manual Scripts

### Individual MCP Servers
```bash
# Start X+1 MCP Machine only
npm run mcp:xplus1

# Start Wiki MCP Browser only  
npm run mcp:wiki
```

### Custom Applications
```bash
# Launch custom application with launcher
npm run launcher custom path/to/your/script.ts
```

## Environment Setup

### Prerequisites
1. **Ollama Server**
   ```bash
   # Install Ollama
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Start Ollama service
   ollama serve
   ```

2. **Required Model**
   ```bash
   # The launcher will auto-pull if missing
   ollama pull llama3.2:3b
   ```

3. **Node.js Dependencies**
   ```bash
   npm install
   ```

## Environment Variables

The launcher supports these environment variables:

```bash
# Ollama Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=GPT-OSS:20b                 # Default model (can override to llama3.2:3b)

# MCP Server Ports
MCP_SERVER_PORT=3001          # For individual server startup
MCP_XPLUS1_URL=http://localhost:3001
MCP_WIKI_URL=http://localhost:3002
```

### Model Configuration Examples

```bash
# Use GPT-OSS:20b (default)
npm run launcher:x-plus-1

# Use llama3.2:3b 
OLLAMA_MODEL=llama3.2:3b npm run launcher:x-plus-1

# Use custom model
OLLAMA_MODEL=mistral:7b npm run launcher:x-plus-1
```

## Launcher Configuration

You can customize the launcher behavior:

```typescript
import { ApplicationLauncher } from './scripts/launcher';

const launcher = new ApplicationLauncher({
  ollamaUrl: 'http://your-ollama:11434',
  requiredModel: 'llama3.2:3b',
  mcpServers: [
    {
      id: 'custom-server',
      name: 'Custom MCP Server',
      port: 3003,
      script: 'path/to/your/mcp-server.ts'
    }
  ],
  healthCheckTimeout: 60000,    // 60 seconds
  shutdownGracePeriod: 10000    // 10 seconds
});

await launcher.launch('custom', 'path/to/your/app.ts');
```

## Startup Phases

### Phase 1: Environment Checks ✅
- **Ollama Server**: Verifies connection and version
- **Model Availability**: Checks if required model exists, auto-pulls if missing
- **Project Structure**: Validates all required files exist

### Phase 2: MCP Server Startup ⚡
- **X+1 MCP Machine**: Starts on port 3001
- **Wiki MCP Browser**: Starts on port 3002
- **Process Management**: Tracks PIDs and handles output

### Phase 3: Health Checks 🏥
- **MCP Server Health**: Tests HTTP endpoints
- **Ollama Generation**: Validates model can generate responses
- **Timeout Handling**: 30-second timeout with retry logic

### Phase 4: Application Launch 🎮
- **Environment Setup**: Injects MCP and Ollama URLs
- **Process Coordination**: Manages main application lifecycle
- **Graceful Shutdown**: Handles SIGINT/SIGTERM properly

## Troubleshooting

### Common Issues

1. **Ollama Not Running**
   ```
   ❌ Ollama server not available at http://localhost:11434
   ```
   **Solution**: Start Ollama with `ollama serve`

2. **Model Missing**
   ```
   ⚠️ Model llama3.2:3b not found. Attempting to pull...
   ```
   **Solution**: Wait for auto-pull or run `ollama pull llama3.2:3b`

3. **Port Conflicts**
   ```
   ❌ Health check failed for X+1 MCP Machine
   ```
   **Solution**: Check ports 3001/3002 are available

4. **File Missing**
   ```
   ❌ Required file missing: src/mcp-servers/XPlus1MCPMachine.ts
   ```
   **Solution**: Verify project structure is complete

### Debug Mode

Add debugging to see more details:
```bash
DEBUG=* npm run launcher:x-plus-1
```

### Manual Health Checks

Test components individually:
```bash
# Test Ollama
curl http://localhost:11434/api/version

# Test MCP Servers (after startup)
curl http://localhost:3001/health
curl http://localhost:3002/health
```

## Advanced Usage

### Custom MCP Servers

Add your own MCP servers to the launcher:

```typescript
const config = {
  mcpServers: [
    // Default servers
    ...DEFAULT_CONFIG.mcpServers,
    // Your custom server
    {
      id: 'my-custom-server',
      name: 'My Custom MCP Server', 
      port: 3003,
      script: 'src/my-servers/CustomServer.ts'
    }
  ]
};
```

### Integration Testing

Use the launcher in your tests:

```typescript
import { ApplicationLauncher } from '../scripts/launcher';

describe('Integration Tests', () => {
  let launcher: ApplicationLauncher;

  beforeAll(async () => {
    launcher = new ApplicationLauncher();
    await launcher.launch('test-mode');
  });

  afterAll(async () => {
    await launcher.shutdown();
  });

  it('should process X+1 pattern', async () => {
    // Your tests here
  });
});
```

### Production Deployment

For production use:

```bash
# Use PM2 or similar process manager
pm2 start scripts/launcher.ts --name "x-plus-1-game" -- x-plus-1

# Or Docker
docker run -p 3001:3001 -p 3002:3002 your-app npm run launcher:x-plus-1
```

## Architecture

```
Application Launcher
├── Environment Checks
│   ├── Ollama Connectivity
│   ├── Model Availability  
│   └── Project Structure
├── MCP Server Management
│   ├── X+1 MCP Machine (port 3001)
│   ├── Wiki MCP Browser (port 3002)
│   └── Process Lifecycle
├── Health Monitoring
│   ├── HTTP Endpoint Tests
│   ├── Model Generation Tests
│   └── Retry Logic
└── Application Orchestration
    ├── Environment Injection
    ├── Process Coordination
    └── Graceful Shutdown
```

The launcher ensures all components start in the correct order, with proper health validation, and provides a unified interface for managing the complex multi-process application stack.

## Scripts Summary

| Script | Purpose | Components Started |
|--------|---------|-------------------|
| `npm run launcher:x-plus-1` | Full X+1 game launch | Ollama check + MCP servers + Game |
| `npm run mcp:xplus1` | X+1 server only | XPlus1MCPMachine on port 3001 |
| `npm run mcp:wiki` | Wiki server only | WikiMCPBrowser on port 3002 |
| `npm run example:x-plus-1` | Game only (no setup) | X+1 game (assumes servers running) |

Use the launcher scripts for the complete experience! 🚀
