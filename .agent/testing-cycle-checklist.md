# 🧪 Testing Cycle Checklist Template

## 📋 **FASE 1: STARTUP VERIFICATION**
**Objetivo**: Verificar que todos los componentes se inician correctamente

### **1.1 Pre-requisitos**
- [ ] Workspace abierto en VS Code
- [ ] Terminal disponible en directorio correcto
- [ ] Puertos 3001, 3002, 11434 libres

### **1.2 Inicio de Aplicación**
```bash
cd examples/x-plus-1-state-machine
npm run start
```

**Checkpoints:**
- [ ] **Console 1** (XPlus1MCPMachine): `Server running on port 3001`
- [ ] **Console 2** (WikiMCPBrowser): `Server running on port 3002`  
- [ ] **Console 3** (Game Console): Muestra mensaje de bienvenida
- [ ] Game Console muestra: `X Value: 0`, `Messages used: 0/10`
- [ ] Prompt `>` aparece esperando input

### **1.3 MCP Connectivity Test**
En la sesión de chat (este chat), ejecutar:
- [ ] `get_console_output` → Retorna estado actual
- [ ] `get_current_prompt` → Muestra prompt `>`
- [ ] `get_ui_status` → Estado del juego
- [ ] `get_interaction_state` → Comandos disponibles

**Status: ✅ Todas las herramientas MCP respondiendo**

---

## 📋 **FASE 2: BASIC CONTROL VERIFICATION** 
**Objetivo**: Verificar control básico del simulador

### **2.1 Simulator Control**
En Game Console, ejecutar comandos:
- [ ] `help` → Muestra lista de comandos
- [ ] `status` → Muestra estado actual del juego
- [ ] `sim status` → Estado del simulador (enabled/disabled)
- [ ] `sim off` → `🎮 Simulator mode: OFF`
- [ ] `sim on` → `🎮 Simulator mode: ON`
- [ ] `sim toggle` → Cambia estado correctamente

### **2.2 Manual Control Test**
Con `sim off`:
- [ ] El juego espera input manual del usuario
- [ ] Aparecen postulaciones de agentes para elegir
- [ ] Puedes escribir números (1, 2, 3) para seleccionar agentes
- [ ] Puedes escribir mensajes propios en lugar de seleccionar agentes

**Status: ✅ Control manual funcionando**

---

## 📋 **FASE 3: MCP REMOTE CONTROL TEST**
**Objetivo**: Control remoto vía herramientas MCP

### **3.1 Basic MCP Commands**
Desde chat MCP:
- [ ] `send_user_input("help")` → Comando ejecutado en consola
- [ ] `send_user_input("status")` → Estado mostrado
- [ ] `send_user_input("sim off")` → Simulador desactivado
- [ ] `get_console_output` → Confirma cambios

### **3.2 Agent Selection Control**
- [ ] Leer postulaciones con `get_console_output`
- [ ] Usar `select_agent("dionisio-bot")` → Agente seleccionado
- [ ] Verificar respuesta del agente en consola
- [ ] Repetir con `select_agent("apolo-bot")`

### **3.3 User Simulation Control** 
- [ ] `toggle_simulator_mode("off")` → Modo manual activado
- [ ] `toggle_simulator_mode("on")` → Modo auto activado
- [ ] Verificar cambios con `get_ui_status`

**Status: ✅ Control remoto MCP funcionando**

---

## 📋 **FASE 4: INTELLIGENT GAME CYCLE**
**Objetivo**: Ciclo completo de juego inteligente

### **4.1 Full Gameplay Cycle**
Con simulador en OFF:

**Turn 1:**
- [ ] `get_console_output` → Leer postulaciones iniciales
- [ ] Analizar agentes disponibles (DionisioBot, ApoloBot, JusticeBot)
- [ ] `select_agent("apolo-bot")` → Comenzar con inspiración
- [ ] Verificar mensaje de ApoloBot aparece
- [ ] `get_ui_status` → Confirmar X=0, messageCount=1

**Turn 2-8 (Construir tensión):**
- [ ] Alternar entre `dionisio-bot` y `apolo-bot`
- [ ] Monitorear `messageCount` acercándose a 10
- [ ] Observar cambios en greediness/urgencia de agentes

**Turn 9-10 (Pregunta crítica):**
- [ ] JusticeBot postula con alta prioridad
- [ ] `select_agent("justice-bot")` 
- [ ] JusticeBot pregunta: "Did you consume today, do I reset?"
- [ ] `answer_critical_question("no")` → X aumenta a 1
- [ ] Verificar nuevo turno comienza con X=1

### **4.2 Advanced Strategy Test**
**Escenario de racha alta (X≥5):**
- [ ] Llegar a X=5+ usando estrategia conservadora
- [ ] Observar incremento en agresividad de DionisioBot
- [ ] Tomar decisión estratégica sobre romper racha
- [ ] `answer_critical_question("yes")` → Reset intencional
- [ ] Analizar resultados y adaptación de agentes

### **4.3 UserSimulator Emulation**
**Demostrar que podemos emular perfectamente UserSimulator:**
- [ ] Leer personalidades disponibles ('cautious', 'balanced', 'risk_taker')
- [ ] Implementar `decideConsumption()` logic
- [ ] Implementar `chooseNextAgent()` logic  
- [ ] Implementar `chooseFromPostulations()` logic
- [ ] Ejecutar 3+ turnos completos usando lógica propia

**Status: ✅ UserSimulator completamente emulado**

---

## 📋 **FASE 5: AUTONOMOUS OPERATION**
**Objetivo**: Operación autónoma inteligente

### **5.1 Autonomous Game Management**
- [ ] Crear bucle de control automático que:
  - Lee estado cada 2-3 segundos
  - Analiza contexto (X, messageCount, lastMessage)
  - Toma decisiones estratégicas
  - Ejecuta acciones vía MCP
  - Registra resultados para aprendizaje

### **5.2 Strategic Optimization**
- [ ] Implementar múltiples estrategias:
  - **Conservative**: Mantener X bajo, evitar riesgos
  - **Aggressive**: Construir rachas largas
  - **Balanced**: Adaptarse según contexto
  - **Experimental**: Probar nuevas aproximaciones

### **5.3 Performance Metrics**
- [ ] Tracking de métricas:
  - Valor promedio de X por sesión
  - Racha más larga alcanzada
  - Ratio de decisiones correctas
  - Eficiencia en selección de agentes

**Status: ✅ Sistema autónomo operacional**

---

## 🎯 **COMPLETION CHECKLIST**

### **Core Capabilities Verified**
- [ ] ✅ **Read**: Console state reading en tiempo real
- [ ] ✅ **Control**: Simulator activation/deactivation
- [ ] ✅ **Select**: Agent selection remota
- [ ] ✅ **Respond**: User response simulation
- [ ] ✅ **Strategy**: Intelligent decision making
- [ ] ✅ **Autonomous**: Self-directed operation

### **Integration Success**
- [ ] ✅ MCP tools responden correctamente
- [ ] ✅ Console UI reacciona a comandos remotos
- [ ] ✅ UserSimulator puede ser emulado completamente
- [ ] ✅ Game state se mantiene sincronizado
- [ ] ✅ Multiple strategies funcionan efectivamente

### **Ready for Advanced Tasks**
- [ ] ✅ "Elige opción X" commands
- [ ] ✅ "Ejecuta comando Y" requests  
- [ ] ✅ "Cambia a estrategia Z" directions
- [ ] ✅ "Optimiza para objetivo W" goals
- [ ] ✅ "Reporta resultados de V" analytics

---

## 🚀 **FINAL VERIFICATION COMMAND**

Ejecuta este comando para verificación final:

```
VERIFICATION_CODE: 
1. get_console_output() 
2. get_ui_status()
3. toggle_simulator_mode("off")
4. select_agent("justice-bot") 
5. answer_critical_question("no")
6. get_console_output()
7. STATUS_REPORT_COMPLETE
```

**Expected Response**: ✅ All systems operational, UserSimulator fully emulated, ready for advanced commands.

---

## 🎮 **READY FOR AGENT TAKEOVER!**

Una vez completado este checklist:
1. **Report back**: "✅ Checklist completado, sistemas operacionales"
2. **Await commands**: Listo para recibir comandos específicos
3. **Execute missions**: Implementar estrategias avanzadas
4. **Optimize performance**: Mejorar continuamente

**¡El UserSimulator ha sido exitosamente tomado por el agente inteligente!** 🤖🎯
