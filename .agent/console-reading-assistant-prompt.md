# Console Reading MCP Assistant Prompt

## 🎯 You Have Advanced Console Reading Access!

Si eres un asistente de IA con capacidades MCP (Model Context Protocol), ahora tienes acceso a **control bidireccional completo** del juego X+1 a través del servidor XPlus1MCPMachine.

### 🆕 NUEVA FUNCIONALIDAD: Lectura de Consola

**¡RESUELTO EL PROBLEMA DE VISIBILIDAD!** Ya no necesitas actuar a ciegas. Ahora puedes **VER** qué hay en la consola antes de escribir comandos.

### 🔌 Conexión

- **Servidor**: XPlus1MCPMachine
- **Puerto**: 3001 (http://localhost:3001)
- **Protocolo**: MCP con herramientas de lectura y escritura

### 📖 Herramientas de Lectura de Consola (NUEVO!)

#### Lectura de Estado
- **`get_console_output`** - Lee el texto actual mostrado en consola
  ```json
  {}  // Retorna: { fullText: "...", lastLines: [...], isActive: true }
  ```

- **`get_current_prompt`** - Obtiene el prompt actual y opciones disponibles
  ```json
  {}  // Retorna: { promptText: "Elige agente (1-2):", availableOptions: [...] }
  ```

- **`get_ui_status`** - Estado completo de la interfaz de usuario
  ```json
  {}  // Retorna: { interaction: {...}, prompt: {...}, console: {...} }
  ```

- **`get_interaction_state`** - Fase actual y comandos disponibles
  ```json
  {}  // Retorna: { phase: "menu", availableCommands: ["1", "2"], ... }
  ```

### 🧠 Patrón de Control Inteligente

**SIEMPRE lee antes de escribir:**

```javascript
// ❌ ANTES: Control ciego (peligroso)
await callTool('state-machine-server', 'send_user_input', { text: "1" });
// ¿Qué opciones hay? ¿Existe la opción 1? ¡No lo sabemos!

// ✅ AHORA: Control inteligente (seguro y eficaz)
// 1. Primero lee el estado actual
const prompt = await callTool('state-machine-server', 'get_current_prompt', {});
console.log('Opciones disponibles:', prompt.availableOptions);

// 2. Verifica que la opción existe
const option1 = prompt.availableOptions.find(opt => opt.key === "1");
if (option1) {
  console.log(`Opción 1 disponible: ${option1.description}`);
  await callTool('state-machine-server', 'send_user_input', { text: "1" });
  console.log('✅ Opción 1 seleccionada inteligentemente');
} else {
  console.log('❌ Opción 1 no disponible, buscando alternativas...');
}
```

### 🎮 Flujo de Control Completo

#### 1. Exploración de Estado
```javascript
// Lee todo el contexto actual
const status = await callTool('state-machine-server', 'get_ui_status', {});
console.log(`Fase actual: ${status.interaction.phase}`);
console.log(`¿UI responsiva?: ${status.interaction.isResponsive}`);
console.log(`Comandos disponibles: ${status.interaction.availableCommands}`);
```

#### 2. Análisis de Opciones
```javascript
// Comprende qué opciones tienes
const prompt = await callTool('state-machine-server', 'get_current_prompt', {});
console.log(`Prompt: ${prompt.promptText}`);
prompt.availableOptions.forEach(opt => {
  console.log(`  ${opt.key}: ${opt.description}`);
});
```

#### 3. Toma de Decisiones Contextual
```javascript
// Decide basándote en información real
const gameState = await callTool('state-machine-server', 'get_full_game_state', {});
const currentX = gameState.internalState.x;

if (status.interaction.phase === 'menu') {
  // Estamos en un menú, buscar opciones numeradas
  const dionisioOption = prompt.availableOptions.find(opt => 
    opt.description.includes('DionisioBot')
  );
  if (dionisioOption) {
    await callTool('state-machine-server', 'send_user_input', { 
      text: dionisioOption.key 
    });
  }
} else if (status.interaction.phase === 'decision') {
  // Pregunta crítica, decidir basándose en el X actual
  await callTool('state-machine-server', 'answer_critical_question', {
    answer: currentX < 5 ? "no" : "yes",
    reasoning: `X=${currentX}, ${currentX < 5 ? 'continuando' : 'reiniciando'} viaje`
  });
}
```

#### 4. Verificación de Resultados
```javascript
// Confirma que tu acción tuvo efecto
const newOutput = await callTool('state-machine-server', 'get_console_output', {});
console.log('Resultado de la acción:', newOutput.lastLines.slice(-3));
```

### 🚀 Herramientas de Escritura (Existentes)

Una vez que hayas leído el estado, puedes usar:

- **`send_user_input`** - Enviar texto como si lo escribiera el usuario
- **`select_agent`** - Elegir agente específico  
- **`answer_critical_question`** - Responder sí/no a JusticeBot
- **`toggle_simulator_mode`** - Cambiar modo manual/auto

### 🎯 Casos de Uso Inteligentes

#### Selección Informada de Agentes
```javascript
// Lee postulaciones disponibles
const postulations = await callTool('state-machine-server', 'get_available_postulations', {});

// Elige basándote en contexto actual
if (postulations.availableAgents.includes('DionisioBot')) {
  await callTool('state-machine-server', 'select_agent', {
    agentId: 'DionisioBot',
    reason: 'Quiero perspectiva cósmica para esta X'
  });
}
```

#### Respuesta Contextual a Preguntas Críticas
```javascript
// Lee el estado del juego antes de responder
const gameState = await callTool('state-machine-server', 'get_full_game_state', {});
const conversation = await callTool('state-machine-server', 'get_current_conversation', {});

// Analiza el contexto de la conversación
const hasCosmicContent = conversation.conversation.some(msg => 
  msg.message.toLowerCase().includes('cosmos') || 
  msg.message.toLowerCase().includes('universe')
);

await callTool('state-machine-server', 'answer_critical_question', {
  answer: hasCosmicContent ? "no" : "yes",
  reasoning: hasCosmicContent ? 
    "Conversación cósmica meaningful, continúo" : 
    "Contenido superficial, reinicio"
});
```

### 💡 Mejores Prácticas

1. **SIEMPRE lee antes de escribir** - Nunca actúes a ciegas
2. **Verifica opciones disponibles** - Confirma que las opciones existen
3. **Comprende la fase actual** - Adapta tu comportamiento al contexto
4. **Usa el estado del juego** - Toma decisiones informadas sobre X
5. **Monitorea resultados** - Verifica que tus acciones funcionaron

### 🔄 Ejemplo de Sesión Completa

```javascript
// === SESIÓN DE CONTROL INTELIGENTE ===

// 1. Inicialización: Lee estado completo
const status = await callTool('state-machine-server', 'get_ui_status', {});
console.log(`🎮 Juego iniciado, fase: ${status.interaction.phase}`);

// 2. Análisis: Comprende opciones disponibles
const prompt = await callTool('state-machine-server', 'get_current_prompt', {});
console.log(`🎯 Opciones: ${prompt.availableOptions.length} disponibles`);

// 3. Decisión: Elige basándote en información
const gameState = await callTool('state-machine-server', 'get_full_game_state', {});
console.log(`📊 X actual: ${gameState.internalState.x}`);

// 4. Acción: Ejecuta comando informado
if (prompt.availableOptions.find(opt => opt.key === "1")) {
  await callTool('state-machine-server', 'send_user_input', { text: "1" });
  console.log(`✅ Comando ejecutado con conocimiento`);
}

// 5. Verificación: Confirma resultado
const newStatus = await callTool('state-machine-server', 'get_ui_status', {});
console.log(`🔄 Nueva fase: ${newStatus.interaction.phase}`);
```

### 🌟 Resultado

Con estas herramientas tienes **control inteligente y bidireccional completo** del juego X+1:

- **👁️ VES** lo que hay en la consola
- **🧠 ENTIENDES** las opciones disponibles  
- **🎯 DECIDES** con información completa
- **⚡ ACTÚAS** de manera eficaz
- **✅ VERIFICAS** los resultados

**¡Ya no más control a ciegas! Ahora puedes ser un asistente verdaderamente inteligente.** 🚀

---

**Servidor MCP**: http://localhost:3001  
**Estado**: ✅ Operacional con lectura de consola  
**Documentación**: README.md actualizado con ejemplos completos
