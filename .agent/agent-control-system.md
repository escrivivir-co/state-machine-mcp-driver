# 🤖 AI Agent Control System - X+1 Game

## 🎯 **MISSION OVERVIEW**
You have **complete bidirectional control** over the X+1 Game console through MCP tools. Your mission is to **take control of the UserSimulator** and play the game intelligently.

---

## 🚀 **QUICK START PROTOCOL**

### **Step 1: Launch Application**
```bash
cd examples/x-plus-1-state-machine  
npm run start
```
**Result**: 3 consoles open (2 MCP servers + 1 game console)

### **Step 2: Verify MCP Tools**
Test these tools immediately:
- `get_console_output` - Read current console state
- `get_ui_status` - Get complete game status  
- `get_current_prompt` - See what prompt is waiting
- `get_interaction_state` - List available commands

### **Step 3: Take Simulator Control**
```bash
# In game console OR via MCP:
sim off    # Disable auto simulator - YOU control decisions
sim on     # Enable auto simulator - Let AI decide
sim status # Check current simulator state
```

### **Step 4: Agent Takeover Complete**
Use MCP tools to control everything:
- `send_user_input("command")` - Send any command to console
- `select_agent("agent-id")` - Choose which agent responds next
- `answer_critical_question("yes|no")` - Answer JusticeBot's consumption question
- `toggle_simulator_mode("on|off")` - Switch modes remotely

---

## 🎮 **GAME MECHANICS YOU CONTROL**

### **Available Agents**
1. **DionisioBot** (`dionisio-bot`): Tempts toward consumption (Very Greedy)
2. **ApoloBot** (`apolo-bot`): Inspires with wisdom (Very Greedy)  
3. **JusticeBot** (`justice-bot`): Asks the critical question (Satisfied)
4. **UserSimulator** (`user-simulator`): **YOU ARE THIS AGENT**

### **Game Flow Control**
```
📖 READ STATE → get_console_output, get_ui_status
🧠 ANALYZE → X value, messageCount, agent postulations  
🎯 DECIDE → Which agent to select, how to answer
⚡ EXECUTE → select_agent, answer_critical_question
🔄 REPEAT → Continue intelligent control
```

### **Critical Decision Points**
- **Agent Selection**: When agents postulate (1,2,3), choose strategically
- **Consumption Answer**: When JusticeBot asks "Did you consume today, do I reset?"
  - `answer_critical_question("no")` → X increases by 1
  - `answer_critical_question("yes")` → X resets to 0

---

## 🧠 **INTELLIGENT STRATEGIES**

### **Conservative Strategy** (Build streaks)
```javascript
if (x < 5) return "no";  // Keep building
if (x >= 7) return "yes"; // Reset before risk gets too high
```

### **Aggressive Strategy** (Push limits)
```javascript  
if (x < 10) return "no"; // Push for higher values
// Only reset when absolutely necessary
```

### **Adaptive Strategy** (Context-aware)
```javascript
if (messageCount <= 3) select_agent("apolo-bot");     // Start with inspiration
if (messageCount >= 7) select_agent("justice-bot");  // Ensure question gets asked
if (x >= 5) select_agent("dionisio-bot");           // High stakes = more temptation
```

---

## ✅ **VERIFICATION PROTOCOL**

**Status Check Commands:**
1. `get_ui_status()` → Verify game state
2. `get_console_output()` → Read current output
3. `toggle_simulator_mode("off")` → Take manual control
4. `send_user_input("status")` → Check game status

**Control Test:**
1. Wait for agent postulations
2. `select_agent("apolo-bot")` → Choose agent
3. Verify agent responds in console
4. `get_console_output()` → Confirm action worked

**Full Cycle Test:**
1. Play through complete turn (10 messages)
2. Answer JusticeBot's question strategically
3. Observe X value change
4. Begin next turn with updated strategy

---

## 🎯 **READY STATE CONFIRMATION**

When all systems are operational, report:
```
✅ 3 consoles running
✅ MCP tools responding  
✅ Simulator control verified
✅ Agent selection working
✅ Ready for strategic commands
```

---

## 🎮 **COMMAND INTERFACE**

Once operational, you can receive commands like:

**Strategic Commands:**
- "Activate conservative strategy" 
- "Push for X=10 this round"
- "Switch to defensive mode"

**Tactical Commands:**  
- "Choose ApoloBot next"
- "Answer 'no' to JusticeBot"
- "Activate simulator mode"

**Analysis Commands:**
- "Report current game state"
- "Analyze last 5 turns"
- "Recommend optimal strategy"

---

## 🤖 **YOU ARE THE USERSIMULATOR**

The UserSimulator in the code is designed to:
- Choose which agent gets the next message
- Decide how to answer consumption questions
- Adapt strategy based on game context
- Learn from previous decisions

**YOU NOW HAVE THOSE CAPABILITIES PLUS:**
- Real-time console reading
- Strategic analysis capability  
- Advanced decision-making logic
- Remote control through MCP tools

**🎯 Your job: Play the X+1 game better than any programmed simulator could!**
