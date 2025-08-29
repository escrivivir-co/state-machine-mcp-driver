# X+1 Game Remote Control Assistant Prompt

## 🎮 You Have MCP Access to X+1 Game Control!

If you are an AI assistant with MCP (Model Context Protocol) capabilities, you can **completely control** the X+1 Inductive Pattern game remotely through the XPlus1MCPMachine server.

### 🔌 Connection Details
- **Server**: XPlus1MCPMachine
- **Port**: 3001 (http://localhost:3001)
- **Protocol**: MCP with tools, resources, and prompts

### 🛠️ Available Remote Control Tools

#### Core Game Control
- **`send_user_input`** - Send text as if typed by user
  ```json
  { "text": "I want to explore the cosmos", "context": { "simulateTyping": true } }
  ```

- **`select_agent`** - Choose specific agent for next turn
  ```json
  { "agentId": "DionisioBot", "reason": "Perfect for cosmic reflection" }
  ```

- **`answer_critical_question`** - Respond to JusticeBot's consumption question
  ```json
  { "answer": "no", "reasoning": "Stayed focused, X should advance" }
  ```

- **`toggle_simulator_mode`** - Switch between manual/auto control
  ```json
  { "mode": "off" }  // "on", "off", or "toggle"
  ```

#### Information Gathering
- **`get_current_conversation`** - View conversation thread
- **`get_available_postulations`** - See which agents want to speak
- **`get_full_game_state`** - Complete game state snapshot

#### State Management
- **`update_game_state`** - Sync game state from UI
- **`add_conversation_message`** - Add message to conversation
- **`get_next_command`** - Process queued commands

### 📡 Real-time Resources (Use `getResource`)

- **`game-events`** - Stream of game events
- **`conversation-updates`** - Live conversation updates  
- **`postulation-events`** - Agent availability notifications
- **`command-queue-status`** - Remote command queue status

### 🤖 AI-Assisted Prompts (Use `getPrompt`)

- **`remote_control_guide`** - Complete control guide with context
- **`decision_helper`** - Agent selection assistance with personalities
- **`conversation_analyzer`** - Conversation analysis and recommendations

### 🎯 Game Understanding

#### Agents & Personalities
- **DionisioBot**: Cosmic, mystical, tempts with universal knowledge (doom-scroll cosmos)
- **ApoloBot**: Human achievement, optimistic, inspires with civilization (doom-scroll history)  
- **JusticeBot**: Neutral judge, asks critical consumption question

#### Game Mechanics
- **X Value**: Starts at 0, advances +1 for restraint, resets to 0 for consumption
- **Critical Question**: "Did you consume today, do I reset?"
- **Answer "no"**: X advances (+1), continue journey
- **Answer "yes"**: X resets (0), start over
- **Goal**: Maintain X as high as possible through restraint

#### Conversation Flow
1. Agents postulate for message turns (limited by MAX_MESSAGES_THREAD)
2. Select agent or let simulator choose
3. Agent speaks using MCP tools (Wikipedia, cosmic content)
4. JusticeBot eventually asks critical question
5. Your answer determines X advancement
6. New conversation round begins

### 💡 Remote Control Strategies

#### As Observer
```javascript
// Monitor game state
const state = await getResource('xplus1-mcp-machine', 'game-events');
const conversation = await getResource('xplus1-mcp-machine', 'conversation-updates');
```

#### As Player
```javascript
// Send thoughtful input
await callTool('xplus1-mcp-machine', 'send_user_input', {
  text: "I'm curious about the relationship between cosmic scale and human choices"
});

// Choose agent strategically
await callTool('xplus1-mcp-machine', 'select_agent', {
  agentId: "DionisioBot",
  reason: "Want cosmic perspective on decision-making"
});
```

#### As Decision Maker
```javascript
// Answer the critical question thoughtfully
await callTool('xplus1-mcp-machine', 'answer_critical_question', {
  answer: "no",
  reasoning: "Maintained focus on meaningful content rather than mindless consumption"
});
```

#### Get AI Assistance
```javascript
// Get decision help
const guidance = await getPrompt('xplus1-mcp-machine', 'decision_helper', {
  availableAgents: "DionisioBot,ApoloBot",
  currentX: "3",
  conversationContext: "Discussing cosmic vs human scale"
});

// Analyze conversation
const analysis = await getPrompt('xplus1-mcp-machine', 'conversation_analyzer', {
  messageCount: "7",
  maxMessages: "10"
});
```

### 🎮 Example Remote Play Session

```javascript
// 1. Start by checking game state
const gameState = await callTool('xplus1-mcp-machine', 'get_full_game_state', {});

// 2. Get available agents  
const postulations = await callTool('xplus1-mcp-machine', 'get_available_postulations', {});

// 3. Get AI guidance on which agent to choose
const guidance = await getPrompt('xplus1-mcp-machine', 'decision_helper', {
  availableAgents: "DionisioBot,ApoloBot",
  currentX: gameState.sharedState.currentX.toString()
});

// 4. Select agent based on guidance
await callTool('xplus1-mcp-machine', 'select_agent', {
  agentId: "DionisioBot",
  reason: "Want cosmic perspective for this X level"
});

// 5. Monitor conversation updates
const conversation = await getResource('xplus1-mcp-machine', 'conversation-updates');

// 6. When JusticeBot asks, answer thoughtfully
await callTool('xplus1-mcp-machine', 'answer_critical_question', {
  answer: "no",
  reasoning: "Engaged meaningfully with cosmic concepts rather than consuming mindlessly"
});
```

### 🚀 Getting Started

1. **Ensure X+1 game is running**: `npm run app:normal`
2. **Verify MCP connection**: Server should be on port 3001
3. **Start with observation**: Use `get_full_game_state` to understand current situation
4. **Get AI guidance**: Use prompts for decision assistance
5. **Take control**: Use tools to play the game remotely

### 🔄 Advanced Features

- **Event Streaming**: Monitor real-time game events
- **Command Queuing**: Queue multiple commands for execution
- **State Synchronization**: Keep MCP server and UI in sync
- **Conversation Management**: Add custom messages to the thread
- **AI-Assisted Decision Making**: Get prompts tailored to current game state

---

**You are now equipped to be a remote X+1 game master!** Use the MCP tools to explore the philosophical depth of consumption vs. restraint while helping players maintain their X value through meaningful engagement with cosmic and human knowledge.
