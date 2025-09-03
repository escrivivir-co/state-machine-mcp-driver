# X+1 State Machine Example

This example demonstrates the complete usage of the **state-machine-mcp-driver** library by implementing the X+1 inductive pattern game as described in the main README.

## Overview

The X+1 pattern is a philosophical game that explores the tension between consumption and restraint through conversations with AI agents. The game tracks a value X that either:
- **Increments by 1** when you choose restraint 
- **Resets to 0** when you choose consumption

## Components

This example implements all the core components mentioned in the main README:

### 🎮 ConsoleGamificationUI
**File:** `ConsoleGamificationUI.ts`
- Text-based console interface using readline
- Handles user input and game flow
- Integrates with the Runtime Engine and chat providers
- Provides real-time feedback and game state visualization

### 🤖 XPlus1MCPMachine  
**File:** `../../src/mcp-servers/XPlus1MCPMachine.ts`
- Full MCP server implementation using `@modelcontextprotocol/sdk`
- **Tools:** `get_x_value`, `set_advance`, `get_game_state` 
- **Resources:** Current game state, rules, history
- **Prompts:** Agent-specific conversation templates

### 🌐 WikiMCPBrowser
**File:** `../../src/mcp-servers/WikiMCPBrowser.ts`  
- Simulates Wikipedia browsing for agents
- **Tools:** `browse_article`, `search_articles`, `get_timeline`
- EventEmitter-based session management
- Provides content for agent "doom-scrolling" behavior

## How It Works

### Game Flow
1. **Initialization:** Runtime starts with 3 AI agents (DionisioBot, ApoloBot, JusticeBot)
2. **Conversation:** Each turn allows up to 10 messages between you and the agents
3. **Decision:** JusticeBot asks: "Did you consume today, do I reset?"
4. **Advancement:** Your answer determines if X increments (+1) or resets (0)
5. **Repeat:** New conversation turn begins

### Agent Personalities
- **🍷 DionisioBot:** Encourages consumption and immediate gratification
- **🏛️ ApoloBot:** Promotes restraint, growth, and long-term thinking  
- **⚖️ JusticeBot:** Asks the crucial decision question neutrally

### Technical Architecture
```
ConsoleGamificationUI
├── Runtime Engine (orchestrates agents)
├── MCP Driver (manages protocol connections)
├── Chat Provider (LLM conversations via Ollama)
└── State Graph (game state transitions)
```

## Running the Example

### Prerequisites
```bash
# Install dependencies
npm install

# Start Ollama server (for chat provider)
ollama serve

# Ensure you have llama3.2:3b model
ollama pull llama3.2:3b
```

### Start the Game
```bash
# From the root directory
npm run example:x-plus-1

# Or directly:
npx tsx examples/x-plus-1-state-machine/index.ts
```

### Game Commands
- `help` - Show available commands
- `status` - Display current game state  
- `quit` / `exit` - End the game

## Example Session

```
🎮 Starting X+1 Inductive Pattern Game...
=====================================

🌱 Welcome to the X+1 Inductive Pattern Game!
Current X: 0 | Turn: 1 | Messages: 0/10

🤖 DionisioBot: Life is short! Why deny yourself pleasures? 
That coffee, that snack, that moment of indulgence - they bring joy!

🤖 ApoloBot: Consider the path of growth. Each "no" to immediate 
pleasure is a "yes" to your future self. Build your discipline.

> I had a good day today, feeling strong

🤖 DionisioBot: Strength? True strength is enjoying life! 
You've earned a reward for your good day.

🤖 ApoloBot: Your strength comes from making conscious choices. 
Keep building that inner resilience.

⚖️ JusticeBot: The moment of truth arrives. Did you consume today, do I reset?

> no

⚖️ JusticeBot: You chose restraint. X will advance by 1.

🎯 X advanced from 0 to 1 (advance: +1)
```

## Configuration

The game behavior can be customized in `game-config.ts`:

```typescript
export const GAME_CONFIG = {
  MAX_MESSAGES_THREAD: 10,     // Messages per turn
  OLLAMA_MODEL: 'llama3.2:3b', // LLM model
  TEMPERATURE: 0.7,            // Response creativity
  MAX_TOKENS: 150              // Response length
};
```

## Files Structure

```
examples/x-plus-1-state-machine/
├── index.ts                 # Main entry point
├── ConsoleGamificationUI.ts # Console interface
├── stategraph.ts           # State machine definition  
├── game-config.ts          # Runtime configuration
├── README.md               # This file
└── mcp-servers/            # Mock wrappers
    ├── wiki-mock.ts        # Wikipedia simulation
    └── xplus1-mock.ts      # X+1 game logic
```

## Learning Objectives

This example demonstrates:

1. **Runtime Engine Integration:** How to configure and orchestrate multiple AI agents
2. **MCP Protocol Usage:** Proper implementation of tools, resources, and prompts
3. **Chat Provider Integration:** LLM conversations through existing providers
4. **State Machine Patterns:** Game logic with state transitions
5. **Console UI Development:** Interactive command-line interfaces
6. **Agent Orchestration:** Managing multiple AI personalities in conversation

## Next Steps

After running this example, you can:

1. **Customize Agent Behavior:** Modify prompts in `game-config.ts`
2. **Add New Tools:** Extend MCP servers with additional capabilities
3. **Change Game Rules:** Modify state transitions in `stategraph.ts`
4. **Try Different Models:** Configure different LLM models in Ollama
5. **Build Your Own:** Use this as a template for your own state machine applications

This example showcases the full power of the state-machine-mcp-driver library for building sophisticated multi-agent conversational experiences! 🚀
