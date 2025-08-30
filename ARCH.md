# Architecture Schema - State Machine MCP Driver

Este documento contiene el esquema arquitectónico completo del State Machine MCP Driver, documentando todos los componentes clave, sus responsabilidades, interfaces y relaciones.

## 🏗️ Visión General de la Arquitectura

El State Machine MCP Driver está diseñado como un sistema modular basado en comunicación por eventos usando RxJS, que permite la integración fluida entre diferentes componentes a través de canales de comunicación especializados.

### Principios Arquitectónicos

- **Comunicación Basada en Eventos**: Uso de RxJS para comunicación asíncrona y reactiva
- **Separación de Responsabilidades**: Cada componente tiene una responsabilidad específica y bien definida
- **Modularidad**: Componentes intercambiables y testeable de forma independiente
- **Type Safety**: Implementación completa en TypeScript con tipado estricto
- **Escalabilidad**: Arquitectura que permite agregar nuevos componentes fácilmente

---

## 🎭 Componentes Clave

### 1. Orchestrator - Sistema de Comunicación Central

**Ubicación**: `src/orchestration/`

**Responsabilidad**: Gestión centralizada de la comunicación entre todos los componentes del sistema a través de tres canales especializados de RxJS.

#### Arquitectura del Orchestrator

```
┌─────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR                            │
├─────────────────┬─────────────────┬─────────────────────────┤
│   AppChannel    │   SysChannel    │     UIChannel           │
│                 │                 │                         │
│ Business Logic  │ System Health   │ User Interactions       │
│ State Changes   │ Logging         │ Display Updates         │
│ Agent Commands  │ Configuration   │ Notifications           │
│                 │ Error Handling  │ Phase Changes           │
└─────────────────┴─────────────────┴─────────────────────────┘
          │                 │                       │
          ▼                 ▼                       ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   App Agents    │ │  System Agents  │ │   UI Agents     │
│                 │ │                 │ │                 │
│ • State Machine │ │ • Health Monitor│ │ • UI Controller │
│ • Business Logic│ │ • Logger        │ │ • Notification  │
│ • Workflows     │ │ • Config Mgr    │ │ • Display Mgr   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

#### Interfaces Principales

```typescript
// Canal de Aplicación - Lógica de negocio
interface AppChannel {
  messages$: Observable<AppMessage>;
  sendStateTransition(source: string, from: string, to: string, metadata?: any): void;
  sendActionRequest(source: string, actionType: string, params: any): void;
  sendActionResult(source: string, actionType: string, result: any, success: boolean): void;
  sendAgentCommand(source: string, agentId: string, command: any): void;
}

// Canal de Sistema - Salud y configuración
interface SysChannel {
  messages$: Observable<SysMessage>;
  sendHealthCheck(source: string, serviceId: string, status: 'online' | 'offline'): void;
  sendError(source: string, error: Error, context?: string): void;
  sendWarning(source: string, message: string): void;
  sendInfo(source: string, message: string, metadata?: any): void;
  sendConfigChange(source: string, key: string, value: any): void;
}

// Canal de UI - Interacciones de usuario
interface UIChannel {
  messages$: Observable<UIMessage>;
  sendUserInput(source: string, input: string, command?: string): void;
  sendDisplayUpdate(source: string, component: string, type: string, data: any): void;
  sendNotification(source: string, title: string, message: string, level: string): void;
  sendPhaseChange(source: string, phase: string, state?: any): void;
}
```

#### Capacidades Clave

- **🔄 Cross-Channel Routing**: Mensajes pueden enrutarse automáticamente entre canales
- **📈 Replay Buffer**: Configuración de buffer para nuevos suscriptores
- **📊 Estadísticas en Tiempo Real**: Monitoreo de mensajes, errores y rendimiento
- **🧩 Registro Dinámico**: Componentes pueden registrarse/desregistrarse en runtime
- **⚡ Alto Rendimiento**: Manejo eficiente de múltiples mensajes concurrentes
- **🔒 Type Safety**: Tipado completo de todos los mensajes y operaciones

#### Patrones de Uso

```typescript
// Inicialización del Orchestrator
const orchestrator = new Orchestrator({
  enableLogging: true,
  enableReplay: true,
  enableCrossChannelRouting: true
});

await orchestrator.start();

// Registro de componentes
await orchestrator.registerComponent(myAgent);

// Uso de canales
orchestrator.app.sendStateTransition('agent-1', 'idle', 'processing');
orchestrator.sys.sendInfo('system', 'Component initialized successfully');
orchestrator.ui.sendNotification('ui', 'Status', 'System ready', 'success');
```

#### Validación y Testing

- **✅ 31/31 Tests Pasando (100% Coverage)**
- **✅ Validación de Secuencias Completas**: READY → INIT → CLOSE
- **✅ Test de Rendimiento**: 150+ mensajes en <2 segundos
- **✅ Cross-Channel Communication**: Verificado funcionamiento
- **✅ Agent Lifecycle Management**: Completo
- **✅ Error Handling & Recovery**: Robusto

---

## 🔮 Componentes Futuros

Los siguientes componentes serán documentados a medida que se implementen:

### Próximos Componentes Planificados

- **State Machine Engine**: Motor de máquinas de estado
- **MCP Client Driver**: Interfaz con servidores MCP
- **Plugin System**: Sistema de plugins extensible
- **Configuration Manager**: Gestión de configuración dinámica
- **Logging System**: Sistema de logging avanzado
- **Health Monitor**: Monitor de salud del sistema
- **UI Framework**: Framework de interfaz de usuario
- **Data Persistence**: Capa de persistencia de datos

---

## 📚 Referencias

- **Código Fuente**: `src/orchestration/`
- **Tests**: `src/orchestration/__tests__/`
- **Documentación Técnica**: `src/orchestration/README.md`
- **Ejemplos de Uso**: `examples/orchestrator-example.ts`

---

*Este documento será actualizado continuamente a medida que se agreguen nuevos componentes al sistema.*
