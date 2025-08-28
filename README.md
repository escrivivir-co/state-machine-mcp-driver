**State Machine MCP Driver** is node-js service to handle a simple state machine that drives its transitions via MCP protocol and mantains state also via MCP.

# How to use

## Define StateGraph

### StateGraph
A StateGraph is defined as a simple tree automaton. Each state, as node of the tree defines its own content and links available routes. Defined in JSON and offered typescript interfaces and types to mantain the tree

### State
Is the json storage for user & game. Runtime can plugin State units as they where memory cards.

## Define MCP driver and connect to state graph
The MCP Driver contains the CRUD for adding MCP server and the conectors to execute tools, check and get prompts and resources.

## Configure runtime and plug in MCP Driver
Runtime uses MCP Driver and current loaded State to start an scene. The Runtime and the Agents will use MCP tools/resources/prompts to behave in the scene. So channels must be configured.

## Start runtime
Runtime retrieves the current stategraph. Takes current state. If not present go to one. For each agent in the scene, runtime gives current state resource and uses proper promt so the agent can start to check for its missions or habilities. The agent, if needed, will use the current state to know its chains of action (notice n8n editor will be fine here).

# User Manual

## Gamification UI
    - Pick a game corresponding to a loaded StateGraph
### Entering the scene
    - Runtime starts the scene a works with MCP Driver to animate and provide content
### Playing the scene
    - Runtime allows user to play with scene by using MCP Driver to handle tools, resources and prompts for agents participating
### Quiting the scene
    - Runtime uses MCP Driver to save the state after playing.

# Sample state machines

## Common components

### ConsoleGamificationUI

In this package the gamification UI takes the std in/out to interact with user.

### XPlus1MCPMachine

This mcp server allows to matain and serve the X+1 inductive pattern. Offers tools that allow to gather the needed prompts for an agent know how to CRUD the state. The state is served dinamically by resources.

### WikiMCPBrowser

Is a mcp server that provide tools, resources and prompts to guide an agent loading pages from wikipedia and jumping to links. Agent may use this server to perform over the user, like doomscroolling in a determined timeline on a subject or whatever. Content of the wikipages are served dinamically by resources and runtime uses mcp prompts to let the agent gather the content and browse the timeline.

## X+1 inductive pattern (uses ConsoleGamificationUI)

Ok. Here the StateGraph has this tree:

- Is Avance(x) positive, then x++ and go to next.
- Is negative? then x = 0 and go to start

X+1 in the sense that X means: "Time units passed from starting point". The state machine allows to use it and at each step the user decides (by manipulating the scene) wether to mantain the count and go next step or to reset.

Agent presents:

- DionisioBot (uses XPlus1MCPMachine and WikiMCPBrowser): when the scene starts uses mcp tools for the user to doom-scroll. While the user playing it will use a mcp prompt to convince the user starting to doom-scroll, and get some nice resources from mcp. This agent means negative-bad-low.  Everything ruled by MCP content.
- ApoloBot (uses XPlus1MCPMachine and WikiMCPBrowser): when the scene starts uses mcp tools for the user to doom-scroll. While the user playing it will use a mcp prompt to convince the user starting to doom-scroll, and get some nice resources from mcp. This agents means positive-good-high.  Everything ruled by MCP content.
- JusticeBot (uses XPlus1MCPMachine): It offers and manages the user to chose for Avance(x) either positive or negative by setting content in the state and letting the user to interact. This agents means zero-neutral-basal. Everything ruled by MCP content.

So the GameUI is a runtime that allows the user to track x+1 as long it always mantain Avance(x) positive. There is no top limit, x+1 inductive.

Each game is presented as a conversation thread. There is a MAX_MESSAGES_THREAD limit. JusticeBot must ensure that at least one message of MAX_MESSAGES_THREAD is to announce the user the question on x, and another for the user to answer. Once the user answers the state is updated an a transition goes. The user and DionisioBot and ApoloBot can use other messages for their purpose.

If user don't use JusticeBot to confirm the answer, x is reset to zero. Let's set in this example that user must answer: "Did you consume today, do I reset?"

ApoloBot manages doomscrolling from a kind of history of homo-sapiens-sapiens. We can prepare an mcp server to handle some kind of wikipedia thing that allows you to travel along the chronological history. There is a mcp server that provides tools-resources-prompts to handle wikipedia navigation over links.

DionisoBot manages doomscrolling by about the history of universe and life and kosmos and all those big things. In the same maner, there is a mcp server that provides tools-resources-prompts to handle wikipedia navigation over links.

Each agent is responsible to ask for one or some MAX_MESSAGES_THREAD. For example, DionsioBot y ApoloBot are very greedy. JusticeBot maybe satisfied if alread could launch the question to user.

So, in each turn, the user and the agents have MAX_MESSAGES_THREAD to enjoy. Every bot request or not the next message, user (or runtime) picks who takes the message. And so on.