# 🔊 Sistema de Logging Configurable

## Descripción

El sistema de logging se ha actualizado para reducir la verbosidad por defecto, mejorando la legibilidad de la consola durante el uso normal, pero manteniendo la capacidad de activar logs detallados cuando sea necesario para debugging.

## Modos de Logging

### 🔇 Modo Quiet (Silencioso)
- Solo muestra mensajes críticos y errores
- Ideal para producción o demos
- Activa con: `MCP_QUIET=true`

### 📊 Modo Normal (Por defecto)
- Muestra información esencial sin excesos
- Balance entre información útil y limpieza
- Sin variables especiales de entorno

### 🔊 Modo Verbose (Detallado)
- Muestra todos los logs de debugging de MCP
- Útil para desarrollo y troubleshooting
- Activa con: `MCP_VERBOSE=true`

## Uso por Variables de Entorno

### Activar Modo Quiet
```bash
# Opción 1: Variable de entorno directa
export MCP_QUIET=true
npm run example_app

# Opción 2: Script predefinido
npm run app:quiet
```

### Activar Modo Verbose
```bash
# Opción 1: Variables de entorno directas
export MCP_VERBOSE=true
export LOG_LEVEL=debug
npm run example_app

# Opción 2: Script predefinido
npm run app:verbose
```

### Activar Modo Normal
```bash
# Opción 1: Sin variables especiales
npm run example_app

# Opción 2: Script predefinido
npm run app:normal
```

## Uso por Archivos .env

### Para desarrollo verbose:
```bash
cp .env.verbose .env
npm run example_app
```

### Para uso silencioso:
```bash
cp .env.quiet .env
npm run example_app
```

## Comandos en Tiempo de Ejecución

Durante la ejecución del juego, puedes cambiar el modo de logging usando comandos debug:

```
/debug verbose    # Activa modo verbose
/debug quiet      # Activa modo quiet  
/debug normal     # Activa modo normal
/debug logmode    # Muestra el modo actual
```

## Scripts de Package.json

```json
{
  "app:quiet": "Ejecuta la aplicación en modo silencioso",
  "app:verbose": "Ejecuta la aplicación en modo verbose", 
  "app:normal": "Ejecuta la aplicación en modo normal"
}
```

## Comparación de Salidas

### Antes (Verbose por defecto):
```
]: MCPClientDriver: Initializing native MCP client driver
]: MCPDriverAdapter: Initialized with native protocol  
]: MCPClientDriver: Successfully connected to X+1 MCP Machine at http://localhost:3001
]: MCPClientDriver: Resource retrieval failed: {"serverId":"state-machine-server","resourceId":"states/x-plus-1-game/player-1","error":{"code":-32603,"name":"McpError"}}
]: MCPDriverAdapter: loadState failed with native driver, falling back to legacy
...
```

### Después (Normal por defecto):
```
🚀 State Machine MCP Driver - Application Launcher
===================================================
✅ MCP Service Launcher started (PID: 1880)
🎮 Initializing X+1 Inductive Pattern Game...
📢 🤖 DionisioBot joined the game
...
```

### Con Verbose Activado:
```
]: MCPClientDriver: Initializing native MCP client driver
]: MCPDriverAdapter: Initialized with native protocol
🚀 State Machine MCP Driver - Application Launcher
===================================================
✅ MCP Service Launcher started (PID: 1880)
]: MCPClientDriver: Successfully connected to X+1 MCP Machine at http://localhost:3001
...
```

## Beneficios

1. **Mejor UX**: La consola es más limpia y fácil de seguir por defecto
2. **Flexibilidad**: Puede activarse el modo verbose cuando se necesite debugging
3. **Compatibilidad**: Los logs detallados siguen disponibles para troubleshooting
4. **Control Granular**: Se puede cambiar el modo en tiempo de ejecución
5. **Configuración Fácil**: Scripts predefinidos y archivos .env para configuración rápida

## Variables de Entorno Disponibles

- `MCP_VERBOSE`: Activa logs detallados de MCP
- `MCP_QUIET`: Activa modo silencioso  
- `LOG_LEVEL`: Nivel de logging (error, warn, info, debug)
- `DEBUG`: Activa debugging general (modo verbose si es "*")
