/**
 * Game-specific data and variables
 */

export interface GameData {
	/** Current game score */
	score?: number;
	/** Current game level */
	level?: number;
	/** User's inventory items */
	inventory?: any[];
	/** Boolean flags for game state */
	flags?: Record<string, boolean>;
	/** Game variables and counters */
	variables?: Record<string, any>;
	/** Temporary session data */
	session?: Record<string, any>;
}


/**
 * User profile and preference data
 */

export interface UserData {
	/** Unique user identifier */
	id: string;
	/** User profile information */
	profile?: {
		name?: string;
		avatar?: string;
		level?: number;
		experience?: number;
		[key: string]: any;
	};
	/** User preferences and settings */
	preferences?: {
		language?: string;
		theme?: string;
		sound?: boolean;
		notifications?: boolean;
		[key: string]: any;
	};
	/** Achievements unlocked by this user */
	achievements?: string[];
	/** User statistics and metrics */
	statistics?: Record<string, number>;
}
