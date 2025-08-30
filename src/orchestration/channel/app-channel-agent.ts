import { Logger } from "@/utils";
import { OrchestratorDomainConsumer as ChannelAgent } from "..";
import { IOrchestratorChannels, AppMessage } from "../types";

/**
 * Example State Manager Component
 * Manages application state and responds to state transition requests
 */

export class AppChannelAgent implements ChannelAgent {
	public readonly id = "state-manager";
	public readonly name = "State Manager";

	private channels?: IOrchestratorChannels;
	private currentState = "initial";
	private stateHistory: string[] = ["initial"];

	async initialize(orchestrator: IOrchestratorChannels): Promise<void> {
		this.channels = orchestrator;

		// Listen for state transition requests
		orchestrator.app.filter("state_transition").subscribe((message) => {
			this.handleStateTransition(message);
		});

		// Listen for action requests that might affect state
		orchestrator.app.filter("action_request").subscribe((message) => {
			this.handleActionRequest(message);
		});

		// Report component is ready
		orchestrator.sys.sendInfo(
			this.id,
			"State Manager component initialized"
		);

		Logger.info("📊 State Manager component initialized");
	}

	async shutdown(): Promise<void> {
		if (this.channels) {
			this.channels.sys.sendInfo(
				this.id,
				"State Manager component shutting down"
			);
		}
		Logger.info("📊 State Manager component shutdown");
	}

	private handleStateTransition(
		message: AppMessage & { type: "state_transition"; }
	): void {
		const { targetState } = message.payload;

		if (!targetState) {
			this.channels?.sys.sendWarning(
				this.id,
				"State transition requested without target state"
			);
			return;
		}

		const previousState = this.currentState;
		this.currentState = targetState;
		this.stateHistory.push(targetState);

		// Notify about successful transition
		this.channels?.app.sendActionResult(
			this.id,
			"state_transition",
			{
				from: previousState,
				to: targetState,
				history: this.stateHistory,
			},
			true
		);

		// Update UI
		this.channels?.ui.sendPhaseChange(this.id, targetState, {
			previousState,
			history: this.stateHistory,
		});

		Logger.info(`📊 State transition: ${previousState} → ${targetState}`);
	}

	private handleActionRequest(
		message: AppMessage & { type: "action_request"; }
	): void {
		const { actionType, actionParams } = message.payload;

		if (actionType === "get_state") {
			this.channels?.app.sendActionResult(
				this.id,
				"get_state",
				{
					currentState: this.currentState,
					history: this.stateHistory,
				},
				true
			);
		} else if (actionType === "reset_state") {
			this.currentState = "initial";
			this.stateHistory = ["initial"];

			this.channels?.app.sendActionResult(
				this.id,
				"reset_state",
				{ state: "initial" },
				true
			);
			this.channels?.ui.sendPhaseChange(this.id, "initial");
			this.channels?.sys.sendInfo(
				this.id,
				"State has been reset to initial"
			);
		}
	}
}
