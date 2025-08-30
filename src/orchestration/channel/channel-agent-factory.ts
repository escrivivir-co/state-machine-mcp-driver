import { ChannelAgent } from "../types";
import { AppChannelAgent } from "./app-channel-agent";
import { SysChannelAgent } from "./sys-channel-agent";
import { UIChannelAgent } from "./ui-channel-agent";

/**
 * Channel Agent Factory
 * Creates channel agent instances based on class name strings
 */

// Type map for available channel agents with proper mapping
type ChannelAgentClassMap = {
    AppChannelAgent: AppChannelAgent;
    SysChannelAgent: SysChannelAgent;
    UIChannelAgent: UIChannelAgent;
};

type ChannelAgentName = keyof ChannelAgentClassMap;

// Constructor type mapping
type ChannelAgentConstructorMap = {
    AppChannelAgent: typeof AppChannelAgent;
    SysChannelAgent: typeof SysChannelAgent;
    UIChannelAgent: typeof UIChannelAgent;
};

// Registry mapping class names to their constructors
const CHANNEL_AGENT_REGISTRY: ChannelAgentConstructorMap = {
    AppChannelAgent,
    SysChannelAgent,
    UIChannelAgent,
};

/**
 * Factory class for creating channel agent instances
 */
export class ChannelAgentFactory {
    /**
     * Creates a channel agent instance from a class name string
     * @param className - The name of the channel agent class
     * @returns A new instance of the specified channel agent
     * @throws Error if the class name is not found in the registry
     */
    static createChannelAgent(className: ChannelAgentName): ChannelAgent {
        const AgentClass = CHANNEL_AGENT_REGISTRY[className];

        if (!AgentClass) {
            throw new Error(
                `Channel agent class '${className}' not found in registry. Available classes: ${Object.keys(
                    CHANNEL_AGENT_REGISTRY
                ).join(", ")}`
            );
        }

        return new AgentClass();
    }

    /**
     * Generic method to create a channel agent with proper type inference
     * @param className - The name of the channel agent class
     * @returns A new instance of the specified channel agent with correct type
     */
    static create<K extends ChannelAgentName>(
        className: K
    ): ChannelAgentClassMap[K] {
        const AgentClass = CHANNEL_AGENT_REGISTRY[className];

        if (!AgentClass) {
            throw new Error(
                `Channel agent class '${className}' not found in registry. Available classes: ${Object.keys(
                    CHANNEL_AGENT_REGISTRY
                ).join(", ")}`
            );
        }

        return new AgentClass() as ChannelAgentClassMap[K];
    }

    /**
     * Returns the list of available channel agent class names
     * @returns Array of available class names
     */
    static getAvailableAgents(): ChannelAgentName[] {
        return Object.keys(CHANNEL_AGENT_REGISTRY) as ChannelAgentName[];
    }

    /**
     * Checks if a channel agent class name is available
     * @param className - The name to check
     * @returns true if the class is available, false otherwise
     */
    static isAvailable(className: string): className is ChannelAgentName {
        return className in CHANNEL_AGENT_REGISTRY;
    }

    /**
     * Creates multiple channel agents from an array of class names
     * @param classNames - Array of class names to create
     * @returns Array of channel agent instances
     */
    static createMultiple(classNames: ChannelAgentName[]): ChannelAgent[] {
        return classNames.map((className) =>
            this.createChannelAgent(className)
        );
    }
}

/**
 * Convenience function to create a channel agent with proper type inference
 * @param className - The name of the channel agent class
 * @returns A new instance of the specified channel agent
 */
export function createChannelAgent<K extends ChannelAgentName>(
    className: K
): ChannelAgentClassMap[K] {
    return ChannelAgentFactory.create(className);
}

// Export types for external use
export type {
    ChannelAgentName,
    ChannelAgentClassMap,
    ChannelAgentConstructorMap,
};
export { CHANNEL_AGENT_REGISTRY };
