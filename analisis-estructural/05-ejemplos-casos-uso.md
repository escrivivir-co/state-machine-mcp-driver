# Ejemplos de Uso y Casos de Prueba

## Ejemplo 1: StateGraph Simple - Contador X+1

### Definición del StateGraph
```json
{
  "id": "counter-x-plus-1",
  "name": "Contador Inductivo X+1",
  "description": "Ejemplo simple de patrón inductivo donde X se incrementa en 1",
  "initialState": "start",
  "version": "1.0.0",
  "author": "Sistema",
  "states": {
    "start": {
      "id": "start",
      "name": "Estado Inicial",
      "type": "initial",
      "content": {
        "message": "Bienvenido al contador. X = 0",
        "value": 0,
        "display": "Contador inicializado"
      },
      "routes": [
        {
          "id": "route-1",
          "target": "increment",
          "type": "user_action",
          "action": "increment_x",
          "metadata": {
            "button_text": "Incrementar X",
            "description": "Suma 1 a X"
          }
        }
      ],
      "onEnter": ["initialize_counter"],
      "metadata": {
        "ui_layout": "centered",
        "background": "blue"
      }
    },
    "increment": {
      "id": "increment",
      "name": "Estado de Incremento",
      "type": "normal",
      "content": {
        "message": "X = {current_value}",
        "display": "Valor incrementado"
      },
      "routes": [
        {
          "id": "route-2",
          "target": "increment",
          "type": "user_action",
          "action": "increment_x",
          "metadata": {
            "button_text": "Incrementar X (+1)",
            "description": "Suma 1 a X"
          }
        },
        {
          "id": "route-3",
          "target": "check_limit",
          "type": "conditional",
          "condition": "x_greater_than_10",
          "metadata": {
            "auto_trigger": true
          }
        },
        {
          "id": "route-4",
          "target": "start",
          "type": "user_action",
          "action": "reset_counter",
          "metadata": {
            "button_text": "Reiniciar",
            "description": "Volver al inicio"
          }
        }
      ],
      "onEnter": ["update_display"],
      "metadata": {
        "ui_layout": "centered",
        "background": "green"
      }
    },
    "check_limit": {
      "id": "check_limit",
      "name": "Verificación de Límite",
      "type": "checkpoint",
      "content": {
        "message": "¡Has alcanzado el límite! X = {current_value}",
        "display": "Límite alcanzado"
      },
      "routes": [
        {
          "id": "route-5",
          "target": "celebration",
          "type": "automatic",
          "metadata": {
            "delay": 1000
          }
        }
      ],
      "onEnter": ["check_achievement"],
      "metadata": {
        "ui_layout": "centered",
        "background": "yellow"
      }
    },
    "celebration": {
      "id": "celebration",
      "name": "Celebración",
      "type": "final",
      "content": {
        "message": "¡Felicidades! Completaste el patrón inductivo X+1",
        "display": "¡Logro desbloqueado!",
        "achievement": "contador_maestro"
      },
      "routes": [
        {
          "id": "route-6",
          "target": "start",
          "type": "user_action",
          "action": "play_again",
          "metadata": {
            "button_text": "Jugar de Nuevo",
            "description": "Comenzar otra partida"
          }
        }
      ],
      "onEnter": ["award_achievement", "update_statistics"],
      "metadata": {
        "ui_layout": "celebration",
        "background": "rainbow"
      }
    }
  },
  "metadata": {
    "difficulty": "beginner",
    "category": "mathematics",
    "tags": ["induction", "counter", "basic"],
    "estimated_duration": 300
  }
}
```

### Estado Inicial del Usuario
```json
{
  "id": "state-user-123-counter",
  "graphId": "counter-x-plus-1",
  "userId": "user-123",
  "currentStateId": "start",
  "userData": {
    "id": "user-123",
    "profile": {
      "name": "Juan Pérez",
      "level": 1
    },
    "preferences": {
      "language": "es",
      "sound": true
    },
    "achievements": [],
    "statistics": {
      "games_played": 0,
      "total_time": 0
    }
  },
  "gameData": {
    "score": 0,
    "level": 1,
    "variables": {
      "x": 0,
      "increment_count": 0
    },
    "flags": {
      "first_increment": false,
      "limit_reached": false
    }
  },
  "history": [],
  "timestamp": 1693123200000,
  "sessionId": "session-abc-123",
  "version": "1.0.0"
}
```

## Ejemplo 2: StateGraph Complejo - Aventura de Exploración

### Definición del StateGraph
```json
{
  "id": "exploration-adventure",
  "name": "Aventura de Exploración",
  "description": "Juego de aventura con múltiples caminos y decisiones",
  "initialState": "village_entrance",
  "version": "2.1.0",
  "author": "Game Designer",
  "states": {
    "village_entrance": {
      "id": "village_entrance",
      "name": "Entrada del Pueblo",
      "type": "initial",
      "content": {
        "title": "Pueblo de Aventureros",
        "description": "Te encuentras ante las puertas de un pintoresco pueblo. Los aventureros van y vienen con historias de tierras lejanas.",
        "image": "village_entrance.jpg",
        "options": [
          "Explorar el pueblo",
          "Ir directamente al bosque",
          "Visitar la taberna"
        ]
      },
      "routes": [
        {
          "id": "route-explore-village",
          "target": "village_center",
          "type": "user_action",
          "action": "explore_village",
          "metadata": {
            "choice_index": 0,
            "requirement": null
          }
        },
        {
          "id": "route-to-forest",
          "target": "forest_edge",
          "type": "user_action", 
          "action": "go_to_forest",
          "metadata": {
            "choice_index": 1,
            "requirement": null
          }
        },
        {
          "id": "route-to-tavern",
          "target": "tavern",
          "type": "user_action",
          "action": "visit_tavern",
          "metadata": {
            "choice_index": 2,
            "requirement": null
          }
        }
      ],
      "onEnter": ["set_entrance_music", "initialize_inventory"]
    },
    "village_center": {
      "id": "village_center", 
      "name": "Centro del Pueblo",
      "type": "normal",
      "content": {
        "title": "Plaza Central",
        "description": "El bullicioso centro del pueblo. Hay comerciantes, un pozo central y varios caminos que se ramifican.",
        "image": "village_center.jpg",
        "npcs": ["merchant", "guard", "child"],
        "options": [
          "Hablar con el comerciante",
          "Examinar el pozo",
          "Ir al bosque",
          "Regresar a la entrada"
        ]
      },
      "routes": [
        {
          "id": "route-talk-merchant",
          "target": "merchant_shop",
          "type": "user_action",
          "action": "talk_to_merchant"
        },
        {
          "id": "route-examine-well",
          "target": "mysterious_well",
          "type": "user_action",
          "action": "examine_well"
        },
        {
          "id": "route-village-to-forest",
          "target": "forest_edge",
          "type": "user_action",
          "action": "go_to_forest"
        },
        {
          "id": "route-back-entrance",
          "target": "village_entrance",
          "type": "user_action",
          "action": "go_back"
        }
      ],
      "onEnter": ["update_npc_dialogue", "check_time_of_day"]
    },
    "forest_edge": {
      "id": "forest_edge",
      "name": "Borde del Bosque",
      "type": "normal",
      "content": {
        "title": "Linde del Bosque Misterioso",
        "description": "Los árboles se alzan ante ti, susurrando secretos. Un sendero serpenteante se adentra en la penumbra.",
        "image": "forest_edge.jpg",
        "atmosphere": "mysterious",
        "options": [
          "Adentrarse en el bosque",
          "Buscar un sendero alternativo", 
          "Volver al pueblo"
        ]
      },
      "routes": [
        {
          "id": "route-enter-forest",
          "target": "deep_forest",
          "type": "user_action",
          "action": "enter_forest",
          "condition": "has_torch_or_daylight"
        },
        {
          "id": "route-alternative-path",
          "target": "hidden_path",
          "type": "user_action",
          "action": "search_alternative",
          "condition": "has_exploration_skill"
        },
        {
          "id": "route-back-to-village",
          "target": "village_center",
          "type": "user_action",
          "action": "return_to_village"
        },
        {
          "id": "route-forced-return",
          "target": "village_center",
          "type": "conditional",
          "condition": "is_night_and_no_torch",
          "metadata": {
            "auto_trigger": true,
            "message": "Es demasiado oscuro para adentrarse sin una antorcha"
          }
        }
      ],
      "onEnter": ["check_equipment", "set_forest_ambience"]
    }
  }
}
```

## Casos de Prueba

### Caso de Prueba 1: Flujo Básico del Contador
```typescript
describe('Counter StateGraph Basic Flow', () => {
  let runtime: Runtime;
  let mcpDriver: MCPDriver;

  beforeEach(async () => {
    mcpDriver = new MCPDriver();
    mcpDriver.addServer({
      id: 'test-server',
      name: 'Test Server',
      url: 'http://localhost:3001/api'
    });

    const config = {
      mcpServerId: 'test-server',
      graphId: 'counter-x-plus-1',
      userId: 'test-user'
    };

    runtime = new Runtime(mcpDriver, config);
    await runtime.initialize();
  });

  test('should start at initial state', () => {
    const currentState = runtime.getCurrentStateNode();
    expect(currentState.id).toBe('start');
    expect(currentState.content.value).toBe(0);
  });

  test('should increment X when transitioning to increment state', async () => {
    await runtime.transitionTo('increment', 'user_increment');
    
    const currentState = runtime.getCurrentStateNode();
    expect(currentState.id).toBe('increment');
    
    const gameData = runtime.getCurrentState().gameData;
    expect(gameData.variables.x).toBe(1);
  });

  test('should trigger limit check when X > 10', async () => {
    // Set X to 10
    runtime.getCurrentState().gameData.variables.x = 10;
    
    await runtime.transitionTo('increment', 'user_increment');
    
    // Should automatically transition to check_limit
    const currentState = runtime.getCurrentStateNode();
    expect(currentState.id).toBe('check_limit');
  });
});
```

### Caso de Prueba 2: Transiciones Condicionales
```typescript
describe('Conditional Transitions', () => {
  test('should block forest entry without torch at night', async () => {
    // Setup night conditions without torch
    runtime.getCurrentState().gameData.flags.is_night = true;
    runtime.getCurrentState().gameData.inventory = [];

    // Try to enter forest
    const canTransition = await runtime.validateTransition('forest_edge', 'deep_forest');
    expect(canTransition).toBe(false);

    // Should auto-return to village
    expect(runtime.getCurrentStateNode().id).toBe('village_center');
  });

  test('should allow forest entry with torch', async () => {
    // Setup with torch
    runtime.getCurrentState().gameData.flags.is_night = true;
    runtime.getCurrentState().gameData.inventory = ['torch'];

    const canTransition = await runtime.validateTransition('forest_edge', 'deep_forest');
    expect(canTransition).toBe(true);
  });
});
```

### Caso de Prueba 3: Persistencia de Estado
```typescript
describe('State Persistence', () => {
  test('should save and restore state correctly', async () => {
    // Make some progress
    await runtime.transitionTo('increment');
    await runtime.transitionTo('increment');
    
    const originalState = runtime.getCurrentState();
    
    // Save state
    await runtime.saveCurrentState();
    
    // Create new runtime instance
    const newRuntime = new Runtime(mcpDriver, config);
    await newRuntime.initialize();
    
    // Should restore to same state
    const restoredState = newRuntime.getCurrentState();
    expect(restoredState.currentStateId).toBe(originalState.currentStateId);
    expect(restoredState.gameData.variables.x).toBe(originalState.gameData.variables.x);
  });
});
```

## Ejemplos de Configuración MCP

### Servidor MCP Mock para Testing
```typescript
// test-mcp-server.ts
import express from 'express';

const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get StateGraph
app.get('/resources/stategraphs/:id', (req, res) => {
  const graphId = req.params.id;
  
  if (graphId === 'counter-x-plus-1') {
    res.json(counterStateGraph);
  } else {
    res.status(404).json({ error: 'StateGraph not found' });
  }
});

// Execute tools
app.post('/tools/:tool', (req, res) => {
  const tool = req.params.tool;
  const params = req.body;
  
  switch (tool) {
    case 'increment_x':
      res.json({ 
        result: params.current_value + 1,
        success: true 
      });
      break;
      
    case 'evaluate_condition':
      if (params.condition === 'x_greater_than_10') {
        res.json({ 
          result: params.state.gameData.variables.x > 10 
        });
      }
      break;
      
    default:
      res.status(404).json({ error: 'Tool not found' });
  }
});

// Save/Load states
const states = new Map();

app.post('/states', (req, res) => {
  const state = req.body;
  const key = `${state.graphId}-${state.userId}`;
  states.set(key, state);
  res.json({ success: true });
});

app.get('/states/:graphId/:userId', (req, res) => {
  const key = `${req.params.graphId}-${req.params.userId}`;
  const state = states.get(key);
  
  if (state) {
    res.json(state);
  } else {
    res.status(404).json({ error: 'State not found' });
  }
});

app.listen(3001, () => {
  console.log('Test MCP Server running on port 3001');
});
```

## Ejemplo de Integración Completa
```typescript
// integration-example.ts
import { MCPDriver, Runtime, StateGraph } from './src';

async function runCompleteExample() {
  // 1. Setup MCP Driver
  const mcpDriver = new MCPDriver();
  mcpDriver.addServer({
    id: 'production-server',
    name: 'Production MCP Server',
    url: 'https://api.example.com/mcp',
    apiKey: process.env.MCP_API_KEY
  });

  // 2. Configure Runtime
  const config = {
    mcpServerId: 'production-server',
    graphId: 'exploration-adventure',
    userId: 'player-456'
  };

  // 3. Initialize Runtime
  const runtime = new Runtime(mcpDriver, config);
  await runtime.initialize();

  // 4. Add agents
  runtime.addAgent({
    id: 'narrator',
    name: 'Narrador del Juego',
    role: 'narrator'
  });

  runtime.addAgent({
    id: 'guide',
    name: 'Guía del Aventurero',
    role: 'guide'
  });

  // 5. Setup event listeners
  runtime.on('stateTransition', (event) => {
    console.log(`Transición: ${event.from} → ${event.to}`);
  });

  // 6. Start the scene
  await runtime.startScene();
  console.log('¡Aventura iniciada!');

  // 7. Simulate user interaction
  console.log('Estado actual:', runtime.getCurrentStateNode().name);
  console.log('Opciones disponibles:', runtime.getAvailableRoutes());

  // 8. Execute transition
  await runtime.transitionTo('village_center', 'user_choice');
  console.log('Nueva ubicación:', runtime.getCurrentStateNode().name);

  // 9. Get statistics
  console.log('Estadísticas:', runtime.getStatistics());
}

runCompleteExample().catch(console.error);
```

Estos ejemplos proporcionan una base sólida para entender cómo funciona el sistema y cómo implementar casos de uso reales.
