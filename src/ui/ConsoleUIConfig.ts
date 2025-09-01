import { BaseGamificationUIConfig } from "./GamificationUI";

/**
 * Configuration for console UI
 */

export interface ConsoleUIConfig extends BaseGamificationUIConfig {
	/** Maximum messages per conversation thread */
	maxMessagesPerThread: number;
	/** Game title to display */
	gameTitle: string;
	/** Welcome message */
	welcomeMessage?: string;
	/** Enable debug mode */
	debugMode?: boolean;
	/** Prompt prefix for user input */
	userPrompt?: string;
	/** Colors enabled */
	enableColors?: boolean;
	/** Enable agent postulation system */
	enablePostulations?: boolean;
	/** Auto-select agents when only one postulates */
	autoSelectSingleAgent?: boolean;
	/** Auto-start the first conversation turn */
	autoStart?: boolean;
}
