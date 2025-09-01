# Especificación Técnica de Componentes

## 1. StateGraph Models (src/models/)

### StateGraph.ts
```typescript
// Enums para mejor type safety
export enum TransitionType {
  AUTOMATIC = 'automatic',
  USER_ACTION = 'user_action',
  AGENT_ACTION = 'agent_action',
  CONDITIONAL = 'conditional'
}

export enum StateType {
  NORMAL = 'normal',
  INITIAL = 'initial',
  FINAL = 'final',
  CHECKPOINT = 'checkpoint'
}

// Interfaces principales
export interface Route {
  id: string;
  target: string;
  condition?: string;
  action?: string;
  type: TransitionType;
  metadata?: Record<string, any>;
}

export interface StateNode {
  id: string;
  name: string;
  type: StateType;
  content: any;
  routes: Route[];
  onEnter?: string[];  // Array de acciones al entrar
  onExit?: string[];   // Array de acciones al salir
  metadata?: Record<string, any>;
}

export interface StateGraph {
  id: string;
  name: string;
  description?: string;
  initialState: string;
  states: Record<string, StateNode>;
  version: string;
  author?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### State.ts
```typescript
export interface UserData {
  id: string;
  profile?: Record<string, any>;
  preferences?: Record<string, any>;
  achievements?: string[];
  statistics?: Record<string, number>;
}

export interface GameData {
  score?: number;
  level?: number;
  inventory?: any[];
  flags?: Record<string, boolean>;
  variables?: Record<string, any>;
}

export interface State {
  id: string;
  graphId: string;
  userId: string;
  currentStateId: string;
  userData: UserData;
  gameData: GameData;
  history: StateTransition[];
  timestamp: number;
  sessionId?: string;
  version: string;
}

export interface StateTransition {
  fromState: string;
  toState: string;
  timestamp: number;
  trigger: string;
  metadata?: Record<string, any>;
}
```

## 2. MCP Driver (src/drivers/)

### MCPDriver.ts - Funciones Avanzadas
```typescript
export class MCPDriver {
  private servers: Map<string, MCPServerConfig> = new Map();
  private clients: Map<string, AxiosInstance> = new Map();
  private healthStatus: Map<string, boolean> = new Map();

  /**
   * Health check for all registered servers
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    const healthPromises = Array.from(this.clients.entries()).map(
      async ([serverId, client]) => {
        try {
          await client.get('/health');
          this.healthStatus.set(serverId, true);
          return [serverId, true] as [string, boolean];
        } catch (error) {
          this.healthStatus.set(serverId, false);
          return [serverId, false] as [string, boolean];
        }
      }
    );

    const results = await Promise.all(healthPromises);
    return new Map(results);
  }

  /**
   * Batch execute multiple tools
   */
  async batchExecuteTools(
    requests: { serverId: string; toolName: string; params: any }[]
  ): Promise<any[]> {
    const promises = requests.map(req => 
      this.executeTool(req.serverId, req.toolName, req.params)
    );
    return Promise.all(promises);
  }

  /**
   * Subscribe to server events (if supported)
   */
  async subscribeToEvents(
    serverId: string, 
    eventTypes: string[], 
    callback: (event: any) => void
  ): Promise<void> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server with ID ${serverId} not found`);
    }

    // Implementation would depend on the specific MCP server's event system
    // This is a placeholder for WebSocket or SSE implementation
  }

  /**
   * Get server capabilities
   */
  async getServerCapabilities(serverId: string): Promise<any> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server with ID ${serverId} not found`);
    }

    try {
      const response = await client.get('/capabilities');
      return response.data;
    } catch (error) {
      console.error(`Error getting capabilities for ${serverId}:`, error);
      throw error;
    }
  }
}
```

## 3. Runtime Engine (src/runtime/)

### Runtime.ts - Funcionalidades Extendidas
```typescript
export class Runtime {
  private eventEmitter: EventEmitter = new EventEmitter();
  private stateValidators: Map<string, (state: State) => boolean> = new Map();
  private transitionHooks: Map<string, (from: string, to: string) => Promise<void>> = new Map();

  /**
   * Register a state validator
   */
  registerStateValidator(stateId: string, validator: (state: State) => boolean): void {
    this.stateValidators.set(stateId, validator);
  }

  /**
   * Register transition hooks
   */
  registerTransitionHook(
    fromState: string, 
    hook: (from: string, to: string) => Promise<void>
  ): void {
    this.transitionHooks.set(fromState, hook);
  }

  /**
   * Validate state transition with custom logic
   */
  private async validateTransition(fromState: string, toState: string): Promise<boolean> {
    // Check if route exists
    const currentStateNode = this.getCurrentStateNode();
    const validRoute = currentStateNode.routes.find(route => route.target === toState);
    
    if (!validRoute) {
      return false;
    }

    // Check conditional logic if present
    if (validRoute.condition) {
      try {
        const conditionResult = await this.mcpDriver.executeTool(
          this.config.mcpServerId,
          'evaluate_condition',
          {
            condition: validRoute.condition,
            state: this.currentState,
            context: this.getTransitionContext()
          }
        );
        return conditionResult.result;
      } catch (error) {
        console.error('Error evaluating transition condition:', error);
        return false;
      }
    }

    return true;
  }

  /**
   * Execute transition with hooks and validation
   */
  async transitionTo(stateId: string, trigger?: string): Promise<void> {
    if (!this.stateGraph || !this.currentState) {
      throw new Error('Runtime not initialized');
    }

    const fromState = this.currentState.currentStateId;

    // Validate transition
    const isValid = await this.validateTransition(fromState, stateId);
    if (!isValid) {
      throw new Error(`Invalid transition from ${fromState} to ${stateId}`);
    }

    // Execute pre-transition hook
    const hook = this.transitionHooks.get(fromState);
    if (hook) {
      await hook(fromState, stateId);
    }

    // Execute onExit actions
    const currentNode = this.getCurrentStateNode();
    if (currentNode.onExit) {
      await this.executeActions(currentNode.onExit, 'exit');
    }

    // Update state
    const transition: StateTransition = {
      fromState,
      toState: stateId,
      timestamp: Date.now(),
      trigger: trigger || 'manual',
      metadata: {}
    };

    this.currentState.currentStateId = stateId;
    this.currentState.history.push(transition);
    this.currentState.timestamp = Date.now();

    // Execute onEnter actions
    const newNode = this.getCurrentStateNode();
    if (newNode.onEnter) {
      await this.executeActions(newNode.onEnter, 'enter');
    }

    // Emit transition event
    this.eventEmitter.emit('stateTransition', {
      from: fromState,
      to: stateId,
      state: this.currentState
    });

    // Save updated state
    await this.mcpDriver.saveState(this.config.mcpServerId, this.currentState);
  }

  /**
   * Execute state actions
   */
  private async executeActions(actions: string[], phase: 'enter' | 'exit'): Promise<void> {
    for (const action of actions) {
      try {
        await this.mcpDriver.executeTool(
          this.config.mcpServerId,
          'execute_action',
          {
            action,
            phase,
            state: this.currentState,
            context: this.getTransitionContext()
          }
        );
      } catch (error) {
        console.error(`Error executing ${phase} action ${action}:`, error);
        // Decide whether to continue or halt based on action criticality
      }
    }
  }

  /**
   * Get context for transitions and actions
   */
  private getTransitionContext(): Record<string, any> {
    return {
      currentState: this.currentState,
      stateGraph: this.stateGraph,
      agents: this.agents,
      timestamp: Date.now()
    };
  }

  /**
   * Subscribe to runtime events
   */
  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Get runtime statistics
   */
  getStatistics(): any {
    if (!this.currentState) {
      return null;
    }

    return {
      sessionDuration: Date.now() - this.currentState.timestamp,
      statesVisited: this.currentState.history.length,
      currentState: this.currentState.currentStateId,
      agentCount: this.agents.length
    };
  }
}
```

## 4. API Routes (src/api/routes/)

### states.ts
```typescript
import { Router } from 'express';
import { Runtime } from '../../runtime/Runtime';
import { MCPDriver } from '../../drivers/MCPDriver';

const router = Router();

// GET /api/states/:graphId/:userId - Get current state
router.get('/:graphId/:userId', async (req, res) => {
  try {
    const { graphId, userId } = req.params;
    const mcpDriver = req.app.get('mcpDriver') as MCPDriver;
    
    const state = await mcpDriver.loadState('main-server', graphId, userId);
    if (!state) {
      return res.status(404).json({ error: 'State not found' });
    }
    
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/states - Create or update state
router.post('/', async (req, res) => {
  try {
    const state = req.body;
    const mcpDriver = req.app.get('mcpDriver') as MCPDriver;
    
    await mcpDriver.saveState('main-server', state);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/states/:graphId/:userId/transition - Execute state transition
router.post('/:graphId/:userId/transition', async (req, res) => {
  try {
    const { graphId, userId } = req.params;
    const { targetState, trigger } = req.body;
    
    const runtime = req.app.get('runtime') as Runtime;
    await runtime.transitionTo(targetState, trigger);
    
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
```

## 5. Configuración y Utilidades (src/utils/)

### config.ts
```typescript
export interface AppConfig {
  port: number;
  nodeEnv: string;
  mcpServers: MCPServerConfig[];
  logging: {
    level: string;
    format: string;
  };
  session: {
    timeout: number;
    cleanup: boolean;
  };
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3050'),
  nodeEnv: process.env.NODE_ENV || 'development',
  mcpServers: JSON.parse(process.env.MCP_SERVERS || '[]'),
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined'
  },
  session: {
    timeout: parseInt(process.env.SESSION_TIMEOUT || '3600000'), // 1 hour
    cleanup: process.env.SESSION_CLEANUP === 'true'
  }
};
```

### logger.ts
```typescript
import winston from 'winston';
import { config } from './config';

export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});
```
