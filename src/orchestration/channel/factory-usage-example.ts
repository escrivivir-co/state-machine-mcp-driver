import {
    ChannelAgentFactory,
    createChannelAgent,
} from "./channel-agent-factory";
import { UIChannelAgent } from "./ui-channel-agent";
import { AppChannelAgent } from "./app-channel-agent";
import { SysChannelAgent } from "./sys-channel-agent";

/**
 * Example usage of Channel Agent Factory
 */

// Example 1: Using the factory class method
console.log("=== Channel Agent Factory Examples ===");

// Create instances using factory
const uiAgent = ChannelAgentFactory.create("UIChannelAgent");
const appAgent = ChannelAgentFactory.create("AppChannelAgent");
const sysAgent = ChannelAgentFactory.create("SysChannelAgent");

console.log("Created UI Agent:", uiAgent.id, "-", uiAgent.name);
console.log("Created App Agent:", appAgent.id, "-", appAgent.name);
console.log("Created Sys Agent:", sysAgent.id, "-", sysAgent.name);

// Example 2: Using the convenience function
const uiAgent2 = createChannelAgent("UIChannelAgent");
console.log("Created UI Agent (convenience):", uiAgent2.id, "-", uiAgent2.name);

// Example 3: Create multiple agents at once
const agents = ChannelAgentFactory.createMultiple([
    "AppChannelAgent",
    "SysChannelAgent",
    "UIChannelAgent",
]);

console.log(
    "Created multiple agents:",
    agents.map((agent) => `${agent.id} (${agent.name})`)
);

// Example 4: Check available agents
const availableAgents = ChannelAgentFactory.getAvailableAgents();
console.log("Available agent types:", availableAgents);

// Example 5: Check if agent type is available
console.log(
    "Is UIChannelAgent available?",
    ChannelAgentFactory.isAvailable("UIChannelAgent")
);
console.log(
    "Is NonExistentAgent available?",
    ChannelAgentFactory.isAvailable("NonExistentAgent")
);

// Example 6: Error handling
try {
    const invalidAgent = ChannelAgentFactory.createChannelAgent(
        "InvalidAgent" as any
    );
} catch (error) {
    console.log("Expected error for invalid agent:", (error as Error).message);
}

// Example 7: Type checking demonstration
const typedUIAgent: UIChannelAgent =
    ChannelAgentFactory.create("UIChannelAgent");
const typedAppAgent: AppChannelAgent =
    ChannelAgentFactory.create("AppChannelAgent");
const typedSysAgent: SysChannelAgent =
    ChannelAgentFactory.create("SysChannelAgent");

console.log("Type-safe creation successful!");
console.log(
    "UI Agent has activeUsers property:",
    "activeUsers" in typedUIAgent
);
