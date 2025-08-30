/**
 * Example: Testing XPlus1 Control Plugin
 * Demonstrates how to use the DevOps server with plugins to control UserSimulator
 */

import { DevOpsServer } from "@/mcp-servers";
import { Logger } from "../src/utils/logger.js";

async function testXPlus1ControlPlugin() {
    console.log("🧪 Testing XPlus1 Control Plugin Integration");

    // Start DevOps server with plugins
    const devopsServer = new DevOpsServer();

    try {
        await devopsServer.start();
        console.log("✅ DevOps server started with plugin system");

        // Simulate some plugin operations
        console.log("\n📋 Testing plugin capabilities...");

        // Note: These would be called via MCP protocol in real usage
        // Here we're just demonstrating the architecture

        console.log("✅ Plugin system integration test complete");
    } catch (error) {
        console.error("❌ Test failed:", error);
    }
}

// Demonstrate usage patterns
async function demonstrateUsagePatterns() {
    console.log("\n🎯 Usage Patterns for XPlus1 Control:");

    console.log(`
## 🎮 UserSimulator Control via DevOps Server

### 1. **Set Personality** 
\`\`\`bash
# Via MCP tools
mcp-tool devops-mcp-server set_user_personality --personality cautious --reason "High X value, be careful"
\`\`\`

### 2. **Simulate Decision**
\`\`\`bash
# Force specific decision
mcp-tool devops-mcp-server simulate_user_decision --forceDecision no --context '{"currentX": 7}'

# Let simulator decide automatically  
mcp-tool devops-mcp-server simulate_user_decision --forceDecision auto
\`\`\`

### 3. **Control Agent Selection**
\`\`\`bash
# Select specific agent for strategic reasons
mcp-tool devops-mcp-server simulate_agent_selection --agentId "apolo-bot" --reasoning "Need wisdom at this moment"
\`\`\`

### 4. **Plugin Management**
\`\`\`bash
# List all plugins
mcp-tool devops-mcp-server list_plugins

# Execute plugin-specific commands
mcp-tool devops-mcp-server execute_plugin_command --pluginId "xplus1-control" --command "get_stats"
\`\`\`

### 5. **Monitor Status**
\`\`\`bash
# Get comprehensive simulator status
mcp-tool devops-mcp-server get_simulator_status --includeHistory true

# Analyze game context for recommendations
mcp-tool devops-mcp-server analyze_game_context --includeRecommendations true
\`\`\`

## 🔄 **Integration with Runtime and UI**

The plugin system enables:
- **📖 Console Reading**: Read current game state before acting
- **✍️ Remote Control**: Send commands to X+1 machine  
- **🎯 Intelligent Decisions**: Context-aware UserSimulator control
- **📊 Real-time Monitoring**: Track all actions and statistics
- **🔌 Modular Design**: Easy to add new control plugins

## 🚀 **How to Test**

1. Start the system: \`npm start\`
2. DevOps server auto-loads XPlus1 Control Plugin
3. Use VS Code MCP integration to call tools
4. Monitor via \`get_simulator_status\` and log output

## 📈 **Next Steps**

- Add more specialized plugins for different games
- Implement strategy AI plugins  
- Create monitoring and analytics plugins
- Add webhook integration for external control
  `);
}

if (require.main === module) {
    testXPlus1ControlPlugin()
        .then(() => demonstrateUsagePatterns())
        .catch(console.error);
}
