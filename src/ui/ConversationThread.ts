import { ConversationMessage } from "./ConversationMessage";
import { GameThread } from "./GamificationUI";

/**
 * Current conversation thread state
 */

export interface ConversationThread extends GameThread {
	/** Thread ID */
	id: string;
	/** Messages in thread */
	messages: ConversationMessage[];
	/** Current message count */
	messageCount: number;
	/** Thread start time */
	startTime: number;
	/** Thread status */
	status: "active" | "completed" | "aborted";
}
