# AlephScript Client - Sys Channel Integration

This document explains how the `AlephScriptClient` has been enhanced to integrate with the orchestrator's sys channel for broadcasting system events to socket.io clients.

## Overview

The `AlephScriptClient` now includes functionality to:

1. **Subscribe to sys channel events** (health checks, errors, warnings)
2. **Broadcast these events** to socket.io clients connected to the `/runtime` namespace
3. **Maintain clean lifecycle management** of subscriptions

## Key Features

### 1. Sys Channel Integration

The client can now connect to the orchestrator's sys channel and listen for system events:

```typescript
// Initialize sys channel integration
alephClient.initializeSysChannelIntegration(orchestrator.getChannels());
```

### 2. Event Broadcasting

System events are automatically broadcast to socket.io clients:

- **Health Checks** → `SYS_HEALTH_CHECK` event
- **Errors** → `SYS_ERROR` event  
- **Warnings** → `SYS_WARNING` event

### 3. Clean Disconnection

Proper cleanup of subscriptions when disconnecting:

```typescript
// Disconnect and cleanup
alephClient.disconnect();
```

## Implementation Details

### Class Structure

The `AlephScriptClient` maintains its original inheritance from `SocketClient` and adds:

```typescript
export class AlephScriptClient extends SocketClient {
  // Original properties
  sus: string[];
  threads: any[] = [];
  
  // New sys channel integration
  private channels?: IOrchestratorChannels;
  private sysChannelSubscriptions: any[] = [];
}
```

### Event Handlers

#### Health Check Handler
```typescript
private handleSysHealthCheck(message: SysMessage & { type: "health_check" }): void {
  const { serviceId, health, message: healthMessage } = message.payload;
  
  // Broadcast to /runtime namespace
  this.io.emit("SYS_HEALTH_CHECK", {
    serviceId,
    health,
    message: healthMessage,
    timestamp: message.timestamp,
    source: message.source
  });
}
```

#### Error Handler
```typescript
private handleSysError(message: SysMessage & { type: "error" }): void {
  const { error, message: errorMessage } = message.payload;
  
  // Broadcast to /runtime namespace
  this.io.emit("SYS_ERROR", {
    error,
    message: errorMessage,
    timestamp: message.timestamp,
    source: message.source
  });
}
```

#### Warning Handler
```typescript
private handleSysWarning(message: SysMessage & { type: "warning" }): void {
  const { message: warningMessage } = message.payload;
  
  // Broadcast to /runtime namespace
  this.io.emit("SYS_WARNING", {
    message: warningMessage,
    timestamp: message.timestamp,
    source: message.source,
    payload: message.payload
  });
}
```

## Usage Example

```typescript
import { AlephScriptClient } from "../src/clients/alephscript-client";
import { Orchestrator } from "../src/orchestration";
import { SysChannelAgent } from "../src/orchestration/channel/sys-channel-agent";

async function main() {
  // Initialize orchestrator with sys channel agent
  const orchestrator = new Orchestrator();
  const sysAgent = new SysChannelAgent();
  await orchestrator.registerComponent(sysAgent);
  await orchestrator.start();

  // Create and setup AlephScript client
  const alephClient = new AlephScriptClient(
    "AlephScript-Runtime-Client",
    "http://localhost:3000",
    "/runtime",
    true
  );

  // Connect to sys channel
  alephClient.initializeSysChannelIntegration(orchestrator.getChannels());
  alephClient.run();

  // Now sys events will be automatically broadcast to socket.io clients
}
```

## Socket.io Client Side

On the client side, you can listen for these events:

```javascript
// Connect to /runtime namespace
const socket = io('/runtime');

// Listen for system events
socket.on('SYS_HEALTH_CHECK', (data) => {
  console.log('Health check:', data);
  // { serviceId, health, message, timestamp, source }
});

socket.on('SYS_ERROR', (data) => {
  console.error('System error:', data);
  // { error, message, timestamp, source }
});

socket.on('SYS_WARNING', (data) => {
  console.warn('System warning:', data);
  // { message, timestamp, source, payload }
});
```

## Benefits

1. **Real-time System Monitoring**: Socket.io clients get immediate notifications of system events
2. **Centralized Event Distribution**: All system events flow through the orchestrator and are distributed consistently
3. **Clean Architecture**: Maintains separation of concerns while enabling cross-system communication
4. **Backward Compatibility**: All existing AlephScript functionality remains unchanged

## Architecture Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Orchestrator  │    │ AlephScriptClient │    │ Socket.io Clients│
│                 │    │                  │    │   (/runtime)    │
│  ┌───────────┐  │    │                  │    │                 │
│  │SysChannel │──┼────┼─► Health Checks  │    │                 │
│  │           │  │    │   Errors         │    │                 │
│  │           │  │    │   Warnings       │────┼─► SYS_HEALTH_CHECK│
│  └───────────┘  │    │                  │    │   SYS_ERROR     │
│                 │    │                  │    │   SYS_WARNING   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Testing

Run the integration example:

```bash
npm run build
node dist/examples/alephscript-sys-integration.js
```

This will demonstrate the integration working with simulated system events.
