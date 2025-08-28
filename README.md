# State Machine MCP Driver (vibe coding alert)

**State Machine MCP Driver** is a Node.js service to handle state machines via MCP protocol with integrated chat providers and multi-agent orchestration.

- I can launch the application
- The application initializes correctly
- The gamification UI is loaded
- The user has access to the game
- The game can be initialized
- The game can be played according to the configuration
- The game can be closed
- The game can be recovered and continued

## 🚀 Quick Start

### Run X+1 Game with Application Launcher
```bash
# One command to start everything with automatic cleanup!
npm run example
```

This will automatically:
- ⚠️ **Clean up existing Node.js processes** (with confirmation)
- ✅ Check Ollama server and models
- ⚡ Start MCP servers (X+1 Machine, Wiki Browser) 
- 🏥 Perform health checks
- 🎮 Launch the X+1 inductive pattern game

### Alternative: Manual Launcher
```bash
# Run without cleanup
npm run launcher:x-plus-1
```

### Manual Setup
```bash
# Install dependencies
npm install

# Start individual components
npm run mcp:xplus1        # X+1 MCP server on port 3001
npm run mcp:wiki          # Wiki MCP server on port 3002  
npm run example:x-plus-1  # Run game only (assumes servers running)
```

## 📖 How It Works

### Architecture Overview
```
Application Launcher
├── Environment Checks (Ollama, models, files)
├── MCP Server Management (X+1, Wiki browsers)
├── Health Monitoring (HTTP checks, model validation)
└── Application Orchestration (Runtime + Chat Provider)
```

### Core Components

#### 1. StateGraph
Define state machines as tree automata with JSON configuration and TypeScript interfaces.

#### 2. MCP Driver  
CRUD operations for MCP servers with tools, resources, and prompts integration.

#### 3. Runtime Engine
Orchestrates agents using MCP protocol with current state and chat providers.

#### 4. Chat Provider Integration
LLM conversations through Ollama with multi-agent support.

## 🎮 Sample Implementation: X+1 Inductive Pattern

A philosophical game exploring consumption vs. restraint through AI conversations.

### Game Components

#### ConsoleGamificationUI
- Text-based interface using stdin/stdout
- Real-time game state visualization  
- Command system (`help`, `status`, `quit`)

#### XPlus1MCPMachine (MCP Server)
- **Tools**: `advance_x`, `reset_x`, `get_x_status`, `evaluate_advancement`
- **Resources**: Current state, advancement history, session analytics
- **Prompts**: Agent-specific conversation templates

#### WikiMCPBrowser (MCP Server)  
- **Tools**: `browse_article`, `search_articles`, `get_timeline`
- **Resources**: Article content, browsing sessions
- **Prompts**: Content discovery and navigation guidance

### Game Flow
1. **Agents Converse**: DionisioBot (temptation), ApoloBot (restraint), JusticeBot (judgment)
2. **Decision Point**: "Did you consume today, do I reset?"
3. **State Transition**: Yes = X resets to 0, No = X advances by 1
4. **New Round**: Conversation continues with updated state

## 📋 Usage Patterns

### Define StateGraph
```typescript
import { StateGraph, State } from './src/models';

const myStateGraph: StateGraph = {
  id: 'my-game',
  states: {
    start: { content: 'Welcome!', transitions: [...] },
    playing: { content: 'Game active', transitions: [...] }
  }
};
```

### Configure MCP Driver
```typescript
import { MCPDriver } from './src/drivers/MCPDriver';

const mcpDriver = new MCPDriver();
mcpDriver.addServer({
  id: 'my-server',
  name: 'My MCP Server',
  url: 'http://localhost:3001',
  timeout: 5000
});
```

### Setup Runtime with Chat Provider
```typescript
import { Runtime } from './src/runtime/Runtime';
import { OllamaChatProvider } from './src/chat-provider/OllamaChatProvider';

const chatProvider = new OllamaChatProvider({
  baseUrl: 'http://localhost:11434',
  defaultModel: 'llama3.2:3b'
});

const runtime = new Runtime(mcpDriver, {
  stateGraph: myStateGraph,
  agents: [...],
  chatProvider
});

await runtime.initialize();
```

## 🛠️ Environment Setup

### Prerequisites
```bash
# Install and start Ollama
curl -fsSL https://ollama.ai/install.sh | sh
ollama serve

# Pull required model
ollama pull llama3.2:3b

# Install Node.js dependencies  
npm install
```

### Environment Variables
```bash
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
MCP_XPLUS1_URL=http://localhost:3001
MCP_WIKI_URL=http://localhost:3002
```

## 📚 Documentation

- **[Application Launcher](./docs/LAUNCHER.md)** - Complete launcher documentation
- **[X+1 Example](./examples/x-plus-1-state-machine/README.md)** - Game implementation guide
- **[API Reference](./src/)** - TypeScript interfaces and classes

## 🔧 Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run launcher:x-plus-1` | **Complete X+1 game startup** |
| `npm run launcher:kill-all-node` | **⚠️ Kill all Node.js processes** |
| `npm run mcp:xplus1` | X+1 MCP server only |
| `npm run mcp:wiki` | Wiki MCP server only |
| `npm run example:x-plus-1` | X+1 game only (no setup) |
| `npm run launcher` | Custom application launcher |

### ⚠️ Process Management

The launcher includes a powerful process management feature:

```bash
# Kill all Node.js processes system-wide (with confirmation)
npm run launcher:kill-all-node

# Or with direct launcher call
npx tsx scripts/launcher.ts --kill-all-node
```

**Warning**: This command terminates ALL Node.js processes on the system, including:
- All running Node.js applications
- npm/yarn processes
- Development servers
- VS Code extensions using Node.js
- Other Node.js-based tools and services

The command requires explicit confirmation before proceeding.

## 🎯 Key Features

- **🔄 State Machine Management**: JSON-defined automata with TypeScript support
- **🌐 MCP Protocol Integration**: Tools, resources, and prompts via Model Context Protocol
- **🤖 Multi-Agent Orchestration**: Coordinate multiple AI agents in conversations
- **💬 Chat Provider Support**: Ollama integration with extensible provider system
- **🎮 Gamification Framework**: Console UI for interactive experiences
- **🚀 Application Launcher**: Automated startup with health checks and dependency management
- **🏥 Health Monitoring**: Comprehensive system validation and error handling
- **📊 Analytics & Logging**: Session tracking and performance monitoring

## Example: X+1 Inductive Pattern Game

The X+1 pattern demonstrates the library's capabilities through a philosophical game about consumption and restraint, featuring three AI agents with distinct personalities engaging in meaningful conversations that influence game state transitions.

**Try it now:**
```bash
npm run launcher:x-plus-1
```

This showcases the complete state-machine-mcp-driver ecosystem in action! 🎮

Ok. Here the StateGraph has this tree:

- Is Avance(x) positive, then x++ and go to next.
- Is negative? then x = 0 and go to start

X+1 in the sense that X means: "Time units passed from starting point". The state machine allows to use it and at each step the user decides (by manipulating the scene) wether to mantain the count and go next step or to reset.

Agent presents:

- DionisioBot (uses XPlus1MCPMachine and WikiMCPBrowser): when the scene starts uses mcp tools for the user to doom-scroll. While the user playing it will use a mcp prompt to convince the user starting to doom-scroll, and get some nice resources from mcp. This agent means negative-bad-low.  Everything ruled by MCP content.
- ApoloBot (uses XPlus1MCPMachine and WikiMCPBrowser): when the scene starts uses mcp tools for the user to doom-scroll. While the user playing it will use a mcp prompt to convince the user starting to doom-scroll, and get some nice resources from mcp. This agents means positive-good-high.  Everything ruled by MCP content.
- JusticeBot (uses XPlus1MCPMachine): It offers and manages the user to chose for Avance(x) either positive or negative by setting content in the state and letting the user to interact. This agents means zero-neutral-basal. Everything ruled by MCP content.

So the GameUI is a runtime that allows the user to track x+1 as long it always mantain Avance(x) positive. There is no top limit, x+1 inductive.

Each game is presented as a conversation thread. There is a MAX_MESSAGES_THREAD limit. JusticeBot must ensure that at least one message of MAX_MESSAGES_THREAD is to announce the user the question on x, and another for the user to answer. Once the user answers the state is updated an a transition goes. The user and DionisioBot and ApoloBot can use other messages for their purpose.

If user don't use JusticeBot to confirm the answer, x is reset to zero. Let's set in this example that user must answer: "Did you consume today, do I reset?"

ApoloBot manages doomscrolling from a kind of history of homo-sapiens-sapiens. We can prepare an mcp server to handle some kind of wikipedia thing that allows you to travel along the chronological history. There is a mcp server that provides tools-resources-prompts to handle wikipedia navigation over links.

DionisoBot manages doomscrolling by about the history of universe and life and kosmos and all those big things. In the same maner, there is a mcp server that provides tools-resources-prompts to handle wikipedia navigation over links.

Each agent is responsible to ask for one or some MAX_MESSAGES_THREAD. For example, DionsioBot y ApoloBot are very greedy. JusticeBot maybe satisfied if alread could launch the question to user.

So, in each turn, the user and the agents have MAX_MESSAGES_THREAD to enjoy. Every bot request or not the next message, user (or runtime) picks who takes the message. And so on.