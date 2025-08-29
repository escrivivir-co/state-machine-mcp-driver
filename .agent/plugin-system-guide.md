# 🔌 DevOps Plugin System - AI Agent Guide

## 🎯 **OVERVIEW**
The DevOpsServer now features a **modular plugin architecture** that enables clean, extensible functionality. Plugins provide specialized tools and capabilities without polluting the core DevOps server codebase.

---

## 🚀 **PLUGIN ARCHITECTURE**

### **Core Components**
- **`IDevOpsPlugin`** - Base interface defining plugin contract
- **`DevOpsPluginManager`** - Centralized plugin lifecycle management
- **`BaseDevOpsPlugin`** - Abstract base class with common functionality

### **Plugin Structure**
```typescript
interface IDevOpsPlugin {
  metadata: PluginMetadata;
  tools: Record<string, McpTool>;
  resources: Record<string, McpResource>;
  prompts: Record<string, McpPrompt>;
  
  initialize(context: PluginContext): Promise<void>;
  execute(command: string, args: any): Promise<any>;
  shutdown(): Promise<void>;
}
```

### **Available Plugins**

## 🎮 **XPlus1 Control Plugin**

### **Purpose**
Advanced control system for UserSimulator and X+1 game management via MCP protocol.

### **Key Capabilities**
- **UserSimulator Control**: Change personality and behavior patterns
- **Decision Forcing**: Override auto-mode with specific decisions
- **Agent Selection**: Choose which conversation agents participate
- **Real-time Monitoring**: Access game state and performance metrics
- **Strategic Analysis**: AI-powered recommendations

---

## 🛠 **PLUGIN MANAGEMENT TOOLS**

### **Core Plugin Commands**
```typescript
// List all registered plugins
await callTool('devops-mcp-server', 'list_plugins', {});

// Execute plugin-specific command
await callTool('devops-mcp-server', 'execute_plugin_command', {
  pluginId: 'xplus1-control',
  command: 'set_user_personality',
  args: { personality: 'cautious' }
});

// Enable/disable specific plugins
await callTool('devops-mcp-server', 'set_plugin_enabled', {
  pluginId: 'xplus1-control',
  enabled: false
});
```

---

## 🎯 **XPLUS1 PLUGIN DETAILED GUIDE**

### **UserSimulator Control**

#### **1. Personality Control**
```typescript
// Switch to cautious mode for high X values
await callTool('devops-mcp-server', 'set_user_personality', {
  personality: 'cautious',      // cautious | balanced | risk_taker | passive
  reason: 'X=7, need conservative approach'
});
```

**Personality Types:**
- **`cautious`** - Conservative decisions, prefers resets, low risk tolerance
- **`balanced`** - Context-aware decisions, considers multiple factors
- **`risk_taker`** - Aggressive advancement, high X tolerance
- **`passive`** - Minimal interaction, lets agents lead

#### **2. Decision Forcing**
```typescript
// Force specific consumption decision
await callTool('devops-mcp-server', 'simulate_user_decision', {
  forceDecision: 'no',         // 'yes' (reset X) | 'no' (advance X) | 'auto'
  context: { 
    currentX: 7, 
    messageCount: 8,
    reasoning: 'Strategic advancement at critical point'
  }
});
```

#### **3. Agent Selection**
```typescript
// Choose specific agent for conversation
await callTool('devops-mcp-server', 'simulate_agent_selection', {
  agentId: 'apolo-bot',        // apolo-bot | dionisio-bot | justice-bot
  reasoning: 'Need historical wisdom for high X situation'
});
```

#### **4. Simulator Mode Control**
```typescript
// Toggle automatic mode
await callTool('devops-mcp-server', 'control_simulator_mode', {
  mode: 'manual',              // manual | automatic | toggle
  reason: 'Taking direct control for critical decisions'
});
```

### **Monitoring and Analysis**

#### **5. Status Monitoring**
```typescript
// Get comprehensive simulator status
await callTool('devops-mcp-server', 'get_simulator_status', {
  includeHistory: true,
  includeStats: true
});
```

**Returns:**
- Current personality and mode settings
- Decision history and patterns
- Performance metrics
- Recent activity log

#### **6. Game Context Analysis**
```typescript
// Get strategic analysis and recommendations
await callTool('devops-mcp-server', 'analyze_game_context', {
  includeRecommendations: true,
  includeRiskAssessment: true
});
```

**Returns:**
- Current game state analysis
- Strategic recommendations
- Risk assessment for different actions
- Suggested agent selections

---

## 🎯 **STRATEGIC USAGE PATTERNS**

### **High X Value Strategy**
```typescript
// When X >= 7, switch to cautious mode
if (gameState.currentX >= 7) {
  await callTool('devops-mcp-server', 'set_user_personality', {
    personality: 'cautious',
    reason: `X=${gameState.currentX}, high risk situation`
  });
}
```

### **Agent Orchestration**
```typescript
// Strategic agent selection based on context
const agentStrategy = {
  highX: 'apolo-bot',      // Wisdom for dangerous situations
  midX: 'dionisio-bot',    // Celebration for progress
  lowX: 'justice-bot'      // Analysis for early game
};

await callTool('devops-mcp-server', 'simulate_agent_selection', {
  agentId: agentStrategy[getXLevel(currentX)],
  reasoning: 'Context-based agent selection'
});
```

### **Decision Override Protocol**
```typescript
// Override auto-mode for critical decisions
if (isHighRiskSituation(gameState)) {
  await callTool('devops-mcp-server', 'control_simulator_mode', {
    mode: 'manual'
  });
  
  // Make strategic decision
  await callTool('devops-mcp-server', 'simulate_user_decision', {
    forceDecision: 'no',  // Advance despite risk
    context: { strategic: true }
  });
}
```

---

## 📊 **RESOURCES AND PROMPTS**

### **Available Resources**
- **`simulator-status`** - Live configuration and statistics
- **`game-context-analysis`** - Strategic analysis with recommendations
- **`simulator-history`** - Activity history and decision patterns

### **Available Prompts**
- **`simulator-control`** - Complete control guide with current context
- **`decision-strategy`** - Strategic guidance for consumption decisions

### **Resource Access**
```typescript
// Get resource content
const resource = await callTool('devops-mcp-server', 'get_resource', {
  uri: 'devops://simulator-status'
});
```

---

## 🔧 **DEBUGGING AND TROUBLESHOOTING**

### **Plugin Health Check**
```typescript
// Verify plugin system health
const plugins = await callTool('devops-mcp-server', 'list_plugins', {});
console.log('Registered plugins:', plugins.map(p => p.id));
```

### **Common Issues**
1. **Plugin Not Found**: Check plugin registration in DevOpsServer initialization
2. **Tool Errors**: Verify XPlus1 MCP server is running and healthy
3. **Connection Issues**: Ensure MCPDriverAdapter is properly configured

### **Error Recovery**
```typescript
// Reset plugin system if needed
await callTool('devops-mcp-server', 'set_plugin_enabled', {
  pluginId: 'xplus1-control',
  enabled: false
});

await callTool('devops-mcp-server', 'set_plugin_enabled', {
  pluginId: 'xplus1-control', 
  enabled: true
});
```

---

## 🎯 **AI AGENT USAGE SUMMARY**

**For UserSimulator Control:**
1. Use `set_user_personality` to change behavior patterns
2. Use `simulate_user_decision` to force specific choices
3. Use `control_simulator_mode` to switch between auto/manual
4. Use `get_simulator_status` for monitoring

**For Strategic Play:**
1. Use `analyze_game_context` for AI recommendations
2. Use `simulate_agent_selection` for conversation control
3. Monitor with resources and prompts for context
4. Combine multiple tools for complex strategies

**Benefits:**
- **🧠 Intelligent Control**: AI-driven UserSimulator management
- **📊 Data-driven Decisions**: Access to comprehensive analytics
- **🎯 Precision Targeting**: Control specific aspects independently
- **🔄 Bidirectional Integration**: Read state, make decisions, monitor results
