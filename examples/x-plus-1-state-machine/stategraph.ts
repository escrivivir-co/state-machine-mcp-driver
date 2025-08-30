/**
 * X+1 State Machine Example
 *
 * Implementation of the X+1 inductive pattern described in README.md
 * This demonstrates a complete state machine with 3 specialized agents
 * and conversation-based gameplay mechanics.
 */

import {
    StateGraph,
    StateType,
    TransitionType,
} from "../../src/models/StateGraph";

/**
 * X+1 State Graph Definition
 *
 * States:
 * - start: Initial state where x=0
 * - playing: Active gameplay state where x>0
 * - reset: Transition state for resetting x to 0
 *
 * The core logic:
 * - If Avance(x) is positive: x++ and continue
 * - If Avance(x) is negative: x=0 and go to start
 */
export const xPlus1StateGraph: StateGraph = {
    id: "x-plus-1-game",
    name: "X+1 Inductive Pattern Game",
    description:
        "A conversation-based game where players maintain a positive count or reset to zero",
    version: "1.0.0",
    initialState: "start",
    createdAt: new Date(),
    updatedAt: new Date(),

    states: {
        start: {
            id: "start",
            name: "Game Start",
            type: StateType.INITIAL,

            // State content/data
            content: {
                x: 0,
                message_count: 0,
                phase: "initialization",
                available_agents: ["JusticeBot", "DionisioBot", "ApoloBot"],
            },

            // Actions to execute when entering this state
            onEnter: [
                "initialize_game_session",
                "reset_message_counter",
                "activate_all_agents",
                "load_agent_prompts",
            ],

            // Available transitions from this state
            routes: [
                {
                    id: "start_playing",
                    target: "playing",
                    type: TransitionType.USER_ACTION,
                    condition: "user_confirmed_start && x === 0",
                    action: "user_ready",
                },
                {
                    id: "continue_game",
                    target: "playing",
                    type: TransitionType.AGENT_ACTION,
                    condition: "advance_x > 0",
                    action: "positive_advance",
                },
            ],

            metadata: {
                description:
                    "Initial state where the counter x=0. Players begin their journey here.",
            },
        },

        playing: {
            id: "playing",
            name: "Active Gameplay",
            type: StateType.NORMAL,

            // State content/data
            content: {
                phase: "conversation",
                max_messages_per_turn: 10,
                agents_active: true,
                turn_timeout: 300000, // 5 minutes per turn
            },

            // Actions when entering playing state
            onEnter: [
                "start_conversation_turn",
                "increment_x_counter",
                "reset_message_counter",
                "notify_agents_turn_start",
            ],

            // Actions when exiting playing state
            onExit: [
                "save_conversation_history",
                "update_game_statistics",
                "notify_agents_turn_end",
            ],

            // Available transitions
            routes: [
                {
                    id: "continue_positive",
                    target: "playing",
                    type: TransitionType.USER_ACTION,
                    condition:
                        'justice_bot_confirmed && user_answer === "no_reset" && x < 999',
                    action: "positive_advance",
                },
                {
                    id: "reset_negative",
                    target: "reset",
                    type: TransitionType.USER_ACTION,
                    condition:
                        'justice_bot_confirmed && user_answer === "reset"',
                    action: "negative_advance",
                },
                {
                    id: "timeout_reset",
                    target: "reset",
                    type: TransitionType.AUTOMATIC,
                    condition:
                        "turn_timeout_exceeded || message_limit_exceeded",
                    action: "timeout",
                },
                {
                    id: "game_complete",
                    target: "end",
                    type: TransitionType.AUTOMATIC,
                    condition: "x >= 999",
                    action: "max_reached",
                },
            ],

            metadata: {
                description:
                    "Main gameplay state where conversation happens and x can increase",
            },
        },

        reset: {
            id: "reset",
            name: "Reset State",
            type: StateType.NORMAL,

            content: {
                phase: "resetting",
                reset_reason: "negative_advance",
            },

            onEnter: [
                "reset_x_to_zero",
                "log_reset_event",
                "notify_agents_reset",
                "save_reset_statistics",
            ],

            routes: [
                {
                    id: "back_to_start",
                    target: "start",
                    action: "reset_complete",
                    type: TransitionType.AUTOMATIC,
                    condition: "x === 0",
                },
            ],
        },

        end: {
            id: "end",
            name: "Game Complete",
            type: StateType.FINAL,

            content: {
                phase: "completed",
                achievement: "max_count_reached",
            },

            onEnter: [
                "celebrate_achievement",
                "save_final_statistics",
                "thank_user",
                "deactivate_agents",
            ],

            routes: [
                {
                    id: "restart_game",
                    target: "start",
                    action: "user_restart",
                    type: TransitionType.USER_ACTION,
                    condition: "user_confirmed_restart",
                },
            ],
        },
    },

    // Global state machine metadata
    metadata: {
        game_type: "x_plus_1_inductive",
        conversation_based: true,
        agent_count: 3,
        mcp_servers: ["XPlus1MCPMachine", "WikiMCPBrowser"],
        max_x_value: 999,

        // Game rules
        rules: {
            max_messages_per_thread: 10,
            turn_timeout_seconds: 300,
            required_question: "Did you consume today, do I reset?",
            positive_answer_patterns: [
                "no",
                "no reset",
                "continue",
                "keep going",
            ],
            negative_answer_patterns: ["yes", "reset", "start over", "zero"],
        },

        // Agent roles and responsibilities
        agents: {
            JusticeBot: {
                role: "neutral_moderator",
                responsibility:
                    "Ask the critical question and manage user responses",
                mcp_servers: ["XPlus1MCPMachine"],
                personality: "zero-neutral-basal",
                required_messages: 2, // Question + response handling
            },
            DionisioBot: {
                role: "negative_influence",
                responsibility:
                    "Encourage doom-scrolling about universe/cosmos/big things",
                mcp_servers: ["XPlus1MCPMachine", "WikiMCPBrowser"],
                personality: "negative-bad-low",
                greedy_for_messages: true,
                topics: ["universe", "cosmos", "existential", "big_picture"],
            },
            ApoloBot: {
                role: "positive_influence",
                responsibility:
                    "Encourage doom-scrolling about human history/civilization",
                mcp_servers: ["XPlus1MCPMachine", "WikiMCPBrowser"],
                personality: "positive-good-high",
                greedy_for_messages: true,
                topics: [
                    "human_history",
                    "civilization",
                    "achievements",
                    "progress",
                ],
            },
        },
    },
};
