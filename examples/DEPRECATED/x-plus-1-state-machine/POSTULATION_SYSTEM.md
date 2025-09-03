# Sistema de Postulación de Agentes - X+1 Game

## 🎯 **Implementación Modular Completada**

La dinámica de turnos del juego X+1 ahora funciona con un **sistema de postulación de agentes modular** que permite al usuario seleccionar qué agente toma cada turno basándose en sus "postulaciones".

## 📋 **Componentes Implementados**

### 🏗️ **1. Sistema Base Reutilizable** (en `src/`)

#### `src/models/AgentPostulation.ts`
- **`AgentPostulationManager`**: Clase principal para manejar postulaciones
- **`AgentGreediness`**: Enum con niveles de avidez (very_greedy, satisfied, neutral, passive)
- **`AgentPostulation`**: Interface para postulaciones individuales
- **`PostulationContext`**: Contexto del juego para generar postulaciones

#### `src/ui/ConsoleGamificationUI.ts` (extendido)
- **Soporte para postulaciones**: Configuración `enablePostulations`
- **Visualización de postulaciones**: Muestra agentes disponibles con prioridades
- **Selección interactiva**: Usuario elige agente por número
- **Eventos especializados**: `AGENT_SELECTION_REQUESTED`, `AGENT_SELECTED`, etc.

### 🎮 **2. Implementación Específica X+1** (en `examples/`)

#### `examples/x-plus-1-state-machine/XPlus1PostulationSystem.ts`
- **Configuraciones específicas**: DionisioBot, ApoloBot, JusticeBot, UserSimulator
- **Lógica personalizada**: Cada agente tiene comportamiento específico según contexto
- **Contexto X+1**: Considera valor X, mensajes restantes, streaks, etc.

#### `examples/x-plus-1-state-machine/ConsoleGamificationUI.ts` (refactorizado)
- **Usa sistema modular**: Extiende ConsoleGamificationUI base
- **Integra postulaciones X+1**: Usa XPlus1PostulationSystem
- **Manejo de eventos**: Responde a selecciones de agentes automáticamente

## 🎭 **Cómo Funciona la Dinámica de Turnos**

### **1. Generación de Postulaciones**
```
📊 Agents postulating for next message:
  1. DionisioBot (⭐⭐⭐) - wants to tempt with cosmic doom-scrolling (7 messages left)
  2. ApoloBot (⭐⭐) - wants to inspire with historical wisdom (7 messages left)
  3. JusticeBot (⭐) - ready to ask the critical question

Choose agent (1, 2, 3) or type your own message:
```

### **2. Algoritmo de Postulación**

**DionisioBot** (`very_greedy`):
- Siempre quiere participar si quedan >2 mensajes
- Prioridad alta (3), se vuelve urgente al final
- Boost especial si el usuario tiene streak alto

**ApoloBot** (`very_greedy`):
- Quiere participar, pero más estratégico
- Prioridad media (2), aumenta si se necesita "explicación"
- Menos agresivo si Dionisio acaba de hablar

**JusticeBot** (`satisfied`):
- Solo participa cuando es necesario
- Prioridad baja (1) normalmente, ALTÍSIMA (10) si quedan ≤2 mensajes
- Lógica especial para preguntar "¿Consumiste hoy?"

### **3. Selección del Usuario**

**Modo Manual** (`sim off`):
- Usuario ve postulaciones y elige número
- Puede escribir mensaje propio en lugar de elegir agente

**Modo Automático** (`sim on`):
- UserSimulator elige automáticamente basándose en pesos
- Considera contexto emocional y necesidades

## 🔧 **Comandos Disponibles**

```bash
help                    # Mostrar comandos
status                  # Estado actual del juego  
sim on/off/toggle/status # Control del simulador
quit                    # Salir del juego

# Durante postulaciones:
1, 2, 3...             # Seleccionar agente por número
<mensaje>              # Enviar mensaje propio
```

## 🎮 **Flujo de Juego Completo**

1. **Inicio**: Sistema genera postulaciones iniciales
2. **Selección**: Usuario elige agente o escribe mensaje
3. **Respuesta**: Agente seleccionado envía mensaje temático
4. **Repetición**: Nuevas postulaciones hasta que JusticeBot pregunta
5. **Decisión**: "¿Consumiste hoy?" → Yes = X=0, No = X+1
6. **Nuevo Turno**: Reinicia el ciclo

## 📁 **Estructura Modular**

```
src/models/
├── AgentPostulation.ts     # Sistema base reutilizable
└── index.ts                # Exports

src/ui/
├── ConsoleGamificationUI.ts # UI base con soporte postulaciones
└── index.ts

examples/x-plus-1-state-machine/
├── XPlus1PostulationSystem.ts    # Configuración específica X+1
├── ConsoleGamificationUI.ts      # UI especializada
└── index.ts                      # Entry point
```

## 🚀 **Uso en Otros Proyectos**

Para usar este sistema en otros juegos:

1. **Crear configuración específica** (como `XPlus1PostulationSystem`)
2. **Extender ConsoleGamificationUI** con `enablePostulations: true`
3. **Configurar agentes** con sus niveles de greediness
4. **Implementar lógica personalizada** en `customLogic`

## ✨ **Características Avanzadas**

- **Prioridades dinámicas**: Cambian según contexto del juego
- **Pesos de selección**: Algoritmo de selección weighted random
- **Lógica personalizada**: Cada agente puede tener comportamiento único
- **Auto-selección**: Opción para seleccionar automáticamente si solo hay un agente
- **Debug mode**: Información detallada sobre postulaciones y pesos
- **Eventos extensibles**: Sistema de eventos para integración personalizada

¡El sistema está completamente implementado y listo para usar! 🎉
