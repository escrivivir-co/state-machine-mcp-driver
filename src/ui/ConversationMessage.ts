import { GameMessage } from "./GamificationUI";

/**
 * Message in the conversation thread
 */

export interface ConversationMessage extends GameMessage {
	/** Message ID */
	id: string;
	/** Who sent the message */
	sender: "user" | "agent" | "system";
	/** Agent ID if sender is agent */
	agentId?: string;
	/** Agent name for display */
	agentName?: string;
	/** Message content */
	content: string;
	/** Message timestamp */
	timestamp: number;
	/** Message metadata */
	metadata?: Record<string, any>;
}
