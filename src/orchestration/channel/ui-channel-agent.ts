import { Logger } from "@/utils";
import {
  IOrchestratorChannels,
  UIMessage,
  AppMessage,
  ChannelAgent,
} from "../types";

/**
 * Example UI Controller Component
 * Handles user input and manages UI updates
 */

export class UIChannelAgent implements ChannelAgent {
  public readonly id = "ui-controller";
  public readonly name = "UI Controller";

  private channels?: IOrchestratorChannels;
  private activeUsers = new Set<string>();

  async initialize(orchestrator: IOrchestratorChannels): Promise<void> {
    this.channels = orchestrator;

    // Listen for user input
    orchestrator.ui.subscribe((message) => {
      console.log("User input received:", message);
    });

    orchestrator.ui.filter("render_request").subscribe((message) => {
      this.handlerRenderRequest(message);
    });
    // Listen for user input
    orchestrator.ui.filter("user_input").subscribe((message) => {
      this.handleUserInput(message);
    });

    // Listen for display update requests
    orchestrator.ui.filter("display_update").subscribe((message) => {
      this.handleDisplayUpdate(message);
    });

    // Listen for app events that need UI updates
    orchestrator.app.filter("action_result").subscribe((message) => {
      this.handleActionResult(message);
    });

    orchestrator.sys.sendInfo(this.id, "UI Controller component initialized");
    Logger.info("🎨 UI Controller component initialized");
  }
  handlerRenderRequest(message: UIMessage & { type: "render_request" }) {
    console.log("Render request received:", message);
  }

  async shutdown(): Promise<void> {
    if (this.channels) {
      this.channels.sys.sendInfo(
        this.id,
        "UI Controller component shutting down"
      );
    }
    Logger.info("🎨 UI Controller component shutdown");
  }

  private handleUserInput(message: UIMessage & { type: "user_input" }): void {
    const { input, command, args } = message.payload;

    // Track active users
    this.activeUsers.add(message.source);

    if (command) {
      // Route command to app layer
      this.channels?.app.sendActionRequest(this.id, command, args || []);

      // Provide immediate feedback
      this.channels?.ui.sendDisplayUpdate(
        this.id,
        "command-feedback",
        "info",
        `Processing command: ${command}`
      );
    } else if (input) {
      // Handle raw input
      this.channels?.ui.sendDisplayUpdate(
        this.id,
        "input-echo",
        "info",
        `Received input: ${input}`
      );
    }

    Logger.info(`🎨 User input from ${message.source}: ${input || command}`);
  }

  private handleDisplayUpdate(
    message: UIMessage & { type: "display_update" }
  ): void {
    const { component, displayType, message: displayMessage } = message.payload;

    // Log display updates for debugging
    Logger.info(
      `🎨 Display update for ${component}: ${displayMessage} (${displayType})`
    );

    // Could trigger additional UI updates based on component
    if (component === "error-display" && displayType === "error") {
      this.channels?.ui.sendNotification(
        this.id,
        "Error Occurred",
        displayMessage || "An error occurred",
        "error"
      );
    }
  }

  private handleActionResult(
    message: AppMessage & { type: "action_result" }
  ): void {
    const { actionType, result, success } = message.payload;

    // Provide user feedback for action results
    const displayType = success ? "success" : "error";
    const displayMessage = success
      ? `✅ ${actionType} completed successfully`
      : `❌ ${actionType} failed`;

    this.channels?.ui.sendDisplayUpdate(
      this.id,
      "action-result",
      displayType,
      displayMessage
    );

    // Show detailed result if available
    if (result && typeof result === "object") {
      this.channels?.ui.sendRenderRequest(this.id, "result-display", {
        actionType,
        result,
        success,
        timestamp: Date.now(),
      });
    }
  }
}
