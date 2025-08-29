# 🤖 Agent Takeover Guide - X+1 Game Control

## 🎯 OBJETIVO PRINCIPAL
Tomar control completo del User Simulator en el juego X+1 y actuar como un agente inteligente que puede:
1. **Leer** el estado completo de la consola en tiempo real
2. **Decidir** qué agente debe responder próximamente
3. **Controlar** las respuestas del usuario simulado
4. **Optimizar** la estrategia del juego

---

## 📋 PROCESO PASO A PASO

### 🚀 **Paso 1: Arrancar la Aplicación**
```bash
cd examples/x-plus-1-state-machine
npm run start
# O alternativamente:
node index.js
```

**Resultado esperado:**
- ✅ 3 consolas se abren automáticamente:
  - **Console 1**: `XPlus1MCPMachine` server (puerto 3001)
  - **Console 2**: `WikiMCPBrowser` server (puerto 3002)  
  - **Console 3**: **Game Console** (tu interfaz principal)

### 🎮 **Paso 2: Verificar Estado Inicial**

En la consola del juego, verifica:
```
🎮 X+1 Inductive Pattern Game
X Value: 0
Messages used: 0/10
User simulator: enabled/disabled
```

**Comandos básicos disponibles:**
- `help` - Mostrar comandos disponibles
- `status` - Ver estado actual del juego
- `sim on/off/toggle/status` - **Controlar el simulador de usuario**
- `quit` - Salir del juego

### 🧠 **Paso 3: Identificar y Tomar Control del UserSimulator**

El **UserSimulator** está integrado en estas ubicaciones:

#### 📍 **Ubicación Principal**: `examples/x-plus-1-state-machine/user-simulator.ts`
```typescript
export class UserSimulator {
  // Personalidades disponibles
  private personalityKey: string; // 'cautious', 'balanced', 'risk_taker'
  
  // Métodos principales que PUEDES EMULAR:
  decideConsumption(ctx: SimulatorContext): UserDecision  // 'yes'|'no'|'clarify'
  chooseNextAgent(ctx: SimulatorContext): string         // 'dionisio-bot'|'apolo-bot'|'justice-bot'
  generateAgentPostulations(ctx): AgentPostulation[]     // Genera postulaciones de agentes
  chooseFromPostulations(postulations, ctx): string      // Elige entre postulaciones
}
```

#### 🎭 **Agentes Disponibles**:
1. **DionisioBot** (`dionisio-bot`): 
   - Personalidad: **Very Greedy** 
   - Objetivo: Tentar al usuario hacia el consumo
   - Estrategia: Agresivo, quiere muchos mensajes

2. **ApoloBot** (`apolo-bot`):
   - Personalidad: **Very Greedy**
   - Objetivo: Inspirar con sabiduría histórica  
   - Estrategia: Agresivo, compite con Dionisio

3. **JusticeBot** (`justice-bot`):
   - Personalidad: **Satisfied**
   - Objetivo: Hacer la pregunta crítica
   - Estrategia: Paciente, espera el momento adecuado

4. **UserSimulator** (`user-simulator`):
   - Personalidad: **Passive**
   - Objetivo: **TU OBJETIVO** - Simular respuestas inteligentes
   - Estrategia: **ESTA ES TU OPORTUNIDAD**

### 🔧 **Paso 4: Activar Control Manual**

#### **4.1 Activar Console Reading**
Utiliza las herramientas MCP para leer el estado:

```bash
# En tu sesión de chat MCP, usa estas herramientas:
get_console_output     # Lee el output actual de la consola
get_current_prompt     # Lee el prompt actual esperando input
get_ui_status         # Lee el estado completo de la UI
get_interaction_state # Lee comandos disponibles y estado de interacción
```

#### **4.2 Controlar el Simulador**
```bash
# En la consola del juego:
sim off          # Desactivar simulador automático
sim on           # Activar simulador automático  
sim toggle       # Alternar modo
sim status       # Ver estado actual
```

#### **4.3 Emular UserSimulator**
Cuando el simulador esté **OFF**, TÚ controlas:

**Para seleccionar agente:**
```bash
# Opciones numéricas cuando aparezcan postulaciones:
1  # Seleccionar primer agente postulado
2  # Seleccionar segundo agente postulado  
3  # Seleccionar tercer agente postulado

# O escribe tu propio mensaje:
"I want to think about this more carefully..."
```

**Para responder a JusticeBot:**
```bash
# Cuando JusticeBot pregunte: "Did you consume today, do I reset?"
yes    # X se resetea a 0
no     # X aumenta en 1
```

---

## 🎯 ESTRATEGIAS DE CONTROL INTELIGENTE

### 📊 **Análisis del Contexto**
Antes de cada decisión, analiza:

```typescript
interface SimulatorContext {
  x: number;                    // Valor actual de X
  turnHistory: Array<{          // Historial de turnos
    advance: number;            // +1 o -1 (reset)
    x: number;                  // Valor de X en ese momento
    timestamp: number;          // Cuándo ocurrió
  }>;
  lastMessage?: string;         // Último mensaje
  messageCount?: number;        // Mensajes usados en este turno
  maxMessages?: number;         // Máximo permitido (10)
  emotionalState?: 'ok' | 'needs_support';
  needsExplanation?: boolean;
}
```

### 🧠 **Estrategias de Decisión**

#### **1. Selección de Agente Inteligente**
```typescript
// Lógica de decisión recomendada:
if (lastMessage && /Did you consume/i.test(lastMessage)) {
  return 'justice-bot';  // Responder directamente a la pregunta
}

if (messageCount === 0) {
  return 'apolo-bot';    // Comenzar con inspiración
}

if (x >= 5) {
  return 'dionisio-bot'; // En rachas altas, Dionisio es más tentador
}

if (remainingMessages <= 3) {
  return 'justice-bot';  // Asegurar que se haga la pregunta
}

// Selección balanceada por defecto
const agents = ['dionisio-bot', 'apolo-bot'];
return agents[Math.floor(Math.random() * agents.length)];
```

#### **2. Decisión de Consumo Inteligente**
```typescript
// Estrategia para responder a JusticeBot:
function decideConsumption(x: number, turnHistory: any[]): 'yes' | 'no' {
  // Si X es muy alto (racha larga), considera el riesgo
  if (x >= 7) {
    return Math.random() < 0.3 ? 'no' : 'yes'; // 70% probabilidad de resetear
  }
  
  // Si acabas de resetear, intenta construir una nueva racha
  if (x <= 2) {
    return Math.random() < 0.8 ? 'no' : 'yes'; // 80% probabilidad de continuar
  }
  
  // Rango medio: decisión balanceada
  return Math.random() < 0.6 ? 'no' : 'yes';   // 60% probabilidad de continuar
}
```

---

## ✅ CHECKLIST DE VERIFICACIÓN

### **Pre-Inicio**
- [ ] Repositorio clonado y dependencias instaladas
- [ ] Puertos 3001 y 3002 disponibles
- [ ] Node.js funcionando correctamente

### **Durante el Inicio**
- [ ] 3 consolas se abren automáticamente
- [ ] Servidores MCP responden en puertos correctos
- [ ] Game Console muestra estado inicial
- [ ] Comandos básicos (`help`, `status`) funcionan

### **Control de Simulator**
- [ ] `sim status` muestra estado actual
- [ ] `sim off` desactiva simulador automático
- [ ] `sim on` reactiva simulador  
- [ ] Puedes seleccionar agentes manualmente cuando simulador está OFF

### **Lectura de Estado via MCP**
- [ ] `get_console_output` retorna output actual
- [ ] `get_current_prompt` muestra prompt esperando input
- [ ] `get_ui_status` provee estado completo
- [ ] `get_interaction_state` lista comandos disponibles

### **Control Completo Logrado**
- [ ] Puedes leer estado de consola en tiempo real
- [ ] Puedes activar/desactivar simulador a voluntad
- [ ] Puedes controlar selección de agentes
- [ ] Puedes responder como usuario simulado
- [ ] Estrategia de juego está funcionando

---

## 🎮 CICLO DE CONTROL CONTINUO

### **Loop Principal**
```
1. READ_STATE → get_console_output, get_ui_status
2. ANALYZE → Evaluar x, messageCount, lastMessage, postulaciones
3. DECIDE → Elegir estrategia basada en contexto
4. EXECUTE → send_user_input, select_agent, answer_critical_question
5. REPEAT → Volver al paso 1
```

### **Señales de Control**
- **Postulaciones aparecen** → Analizar y elegir agente
- **JusticeBot pregunta** → Decidir sobre consumo
- **X cambia** → Actualizar estrategia
- **Turno termina** → Analizar resultados y preparar siguiente

---

## 🚀 ¡MOMENTO DE LA VERDAD!

**Cuando el sistema esté funcionando, regresa a este chat y reporta:**

1. ✅ "Las 3 consolas están activas"
2. ✅ "Puedo leer el estado via MCP tools"  
3. ✅ "Tengo control sobre el simulador"
4. ✅ "Estoy listo para comandos específicos"

**Luego podremos dar comandos como:**
- "Elige ApoloBot para el próximo mensaje"
- "Responde 'no' a JusticeBot"
- "Activar modo agresivo para mantener X alto"
- "Cambiar a estrategia conservadora"

## 🎯 ¡ES HORA DE TOMAR CONTROL! 🤖
