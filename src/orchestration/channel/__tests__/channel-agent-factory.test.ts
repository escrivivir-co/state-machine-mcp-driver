import { describe, test, expect } from "@jest/globals";
import {
    ChannelAgentFactory,
    createChannelAgent,
} from "../channel-agent-factory";
import { UIChannelAgent } from "../ui-channel-agent";
import { AppChannelAgent } from "../app-channel-agent";
import { SysChannelAgent } from "../sys-channel-agent";

describe("ChannelAgentFactory", () => {
    test("should create UIChannelAgent from string name", () => {
        const agent = ChannelAgentFactory.create("UIChannelAgent");

        expect(agent).toBeInstanceOf(UIChannelAgent);
        expect(agent.id).toBe("ui-controller");
        expect(agent.name).toBe("UI Controller");
    });

    test("should create AppChannelAgent from string name", () => {
        const agent = ChannelAgentFactory.create("AppChannelAgent");

        expect(agent).toBeInstanceOf(AppChannelAgent);
        expect(agent.id).toBe("state-manager");
        expect(agent.name).toBe("State Manager");
    });

    test("should create SysChannelAgent from string name", () => {
        const agent = ChannelAgentFactory.create("SysChannelAgent");

        expect(agent).toBeInstanceOf(SysChannelAgent);
        expect(agent.id).toBe("system-monitor");
        expect(agent.name).toBe("System Monitor");
    });

    test("should provide proper type inference", () => {
        // These should compile without type errors
        const uiAgent: UIChannelAgent =
            ChannelAgentFactory.create("UIChannelAgent");
        const appAgent: AppChannelAgent =
            ChannelAgentFactory.create("AppChannelAgent");
        const sysAgent: SysChannelAgent =
            ChannelAgentFactory.create("SysChannelAgent");

        expect(uiAgent).toBeInstanceOf(UIChannelAgent);
        expect(appAgent).toBeInstanceOf(AppChannelAgent);
        expect(sysAgent).toBeInstanceOf(SysChannelAgent);
    });

    test("should work with convenience function", () => {
        const agent = createChannelAgent("UIChannelAgent");

        expect(agent).toBeInstanceOf(UIChannelAgent);
        expect(agent.id).toBe("ui-controller");
    });

    test("should create multiple agents", () => {
        const agents = ChannelAgentFactory.createMultiple([
            "AppChannelAgent",
            "SysChannelAgent",
            "UIChannelAgent",
        ]);

        expect(agents).toHaveLength(3);
        expect(agents[0]).toBeInstanceOf(AppChannelAgent);
        expect(agents[1]).toBeInstanceOf(SysChannelAgent);
        expect(agents[2]).toBeInstanceOf(UIChannelAgent);
    });

    test("should return available agent names", () => {
        const availableAgents = ChannelAgentFactory.getAvailableAgents();

        expect(availableAgents).toContain("AppChannelAgent");
        expect(availableAgents).toContain("SysChannelAgent");
        expect(availableAgents).toContain("UIChannelAgent");
        expect(availableAgents).toHaveLength(3);
    });

    test("should check agent availability", () => {
        expect(ChannelAgentFactory.isAvailable("UIChannelAgent")).toBe(true);
        expect(ChannelAgentFactory.isAvailable("AppChannelAgent")).toBe(true);
        expect(ChannelAgentFactory.isAvailable("SysChannelAgent")).toBe(true);
        expect(ChannelAgentFactory.isAvailable("NonExistentAgent")).toBe(false);
    });

    test("should throw error for invalid agent name", () => {
        expect(() => {
            ChannelAgentFactory.createChannelAgent("InvalidAgent" as any);
        }).toThrow("Channel agent class 'InvalidAgent' not found in registry");
    });

    test("should throw error with available classes list", () => {
        try {
            ChannelAgentFactory.createChannelAgent("InvalidAgent" as any);
        } catch (error) {
            expect((error as Error).message).toContain(
                "Available classes: AppChannelAgent, SysChannelAgent, UIChannelAgent"
            );
        }
    });
});
