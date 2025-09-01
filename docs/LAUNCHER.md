# 🚀 MCP Service Launcher - Sistema de Gestión de Servidores MCP

## Descripción

El `MCPServiceLauncher` es un servidor MCP especializado que gestiona el lanzamiento y monitoreo de otros servidores MCP en procesos separados. Esto permite:

1. **Consolas separadas** para cada servidor MCP
2. **Gestión centralizada** de todos los servidores
3. **Monitoreo y auto-restart** automático
4. **Health checks** coordinados
5. **Consola principal libre** para la interacción del usuario

## Arquitectura

```
ApplicationLauncher (scripts/launcher.ts)
    ↓
MCPServiceLauncher (puerto 3050)
    ↓ gestiona
    ├── XPlus1MCPMachine (puerto 3001) [consola separada]
    ├── WikiMCPBrowser (puerto 3002) [consola separada]
    └── Otros servidores MCP [consolas separadas]
    ↓
ConsoleGamificationUI (consola principal libre)
```

## Flujo de Arranque

### Fase 1: Verificación de Entorno
- ✅ Verificar Ollama corriendo
- ✅ Verificar modelo disponible
- ✅ Pull del modelo si es necesario

### Fase 2: MCP Service Launcher
- 🚀 Arrancar MCPServiceLauncher en puerto 3050
- 📡 Inicializar MCPDriver para comunicación
- ⚡ Registrar el launcher como servidor MCP

### Fase 3: Lanzamiento de Servidores MCP
- 🎯 Usar el launcher para arrancar todos los servidores
- 🏠 Cada servidor en su propia consola/proceso
- 📊 Recibir confirmación de arranque exitoso

### Fase 4: Health Checks
- 🏥 Verificar salud de todos los servidores
- 📈 Estado global del sistema
- ⚠️ Detectar fallos y auto-reintentos

### Fase 5: Aplicación Principal
- 🎮 Lanzar aplicación objetivo (ej: X+1 Game)
- 💬 ConsoleGamificationUI lista para interacción
- 🔄 Sistema completo operacional

## Quick Start

### Ejecutar el Sistema Completo
```bash
npm run launcher:x-plus-1
```

Este comando único ejecutará:
1. ✅ Verificación de entorno (Ollama, modelos, archivos)
2. 🚀 Arranque del MCP Service Launcher
3. ⚡ Lanzamiento de servidores MCP en consolas separadas
4. 🏥 Health checks de todos los servicios
5. 🎮 Lanzamiento de la aplicación X+1

## Herramientas del MCP Service Launcher

### Tools (Herramientas)

1. **`launch_mcp_server`**
   - Lanza un servidor MCP específico
   - Configuración personalizable
   - Proceso en consola separada

2. **`stop_mcp_server`**
   - Detiene un servidor específico
   - Parada graceful o forzada

3. **`restart_mcp_server`**
   - Reinicia un servidor
   - Combina stop + start

4. **`get_server_status`**
   - Estado de servidor específico o todos
   - Información de uptime, PID, etc.

5. **`launch_all_servers`**
   - Lanza todos los servidores por defecto
   - Health check opcional incluido

6. **`health_check_servers`**
   - Verificación de salud coordinada
   - Individual o global

7. **`generate_vscode_mcp_config`**
   - Genera configuración automática para VS Code
   - Crea archivo .vscode/mcp.json
   - Incluye instrucciones de uso

### Resources (Recursos)

1. **`launch-session`**
   - Información de la sesión actual
   - Servidores gestionados
   - Estadísticas de uptime

2. **`available-servers`**
   - Configuraciones disponibles
   - XPlus1, Wiki, etc.

3. **`launcher-status`**
   - Estado global del launcher
   - Contadores y métricas

4. **`vscode-mcp-config`**
   - Configuración generada para VS Code
   - Servidores en ejecución
   - Instrucciones de conexión

### Prompts (Indicaciones)

1. **`launch-status`**
   - Estado actual formateado
   - Servidores corriendo y fallados
   - Recomendaciones

2. **`launch-recommendations`**
   - Sugerencias basadas en estado
   - Acciones recomendadas
   - Quick actions

3. **`vscode-setup-guide`**
   - Guía paso a paso para VS Code
   - Instrucciones de configuración MCP
   - Comandos útiles de VS Code

## 🔧 Integración con VS Code

### Generación Automática de Configuración

El sistema incluye funcionalidad para generar automáticamente el archivo `.vscode/mcp.json` requerido por VS Code para conectarse a servidores MCP:

```bash
# El launcher genera automáticamente la configuración después del health check
npm run launcher:x-plus-1

# O generar manualmente usando MCP tools
# Usar la herramienta 'generate_vscode_mcp_config' del service launcher
```

### Estructura del Archivo .vscode/mcp.json

```json
{
  "mcpServers": {
    "mcp-service-launcher": {
      "command": "npx",
      "args": ["tsx", "src/mcp-servers/MCPServiceLauncher.ts"],
      "env": {
        "MCP_SERVER_PORT": "3050"
      },
      "description": "MCP Service Launcher - manages and monitors other MCP servers"
    },
    "xplus1-mcp-machine": {
      "command": "npx", 
      "args": ["tsx", "src/mcp-servers/XPlus1MCPMachine.ts"],
      "env": {
        "MCP_SERVER_PORT": "3001"
      },
      "description": "X+1 inductive pattern management server"
    },
    "wiki-mcp-browser": {
      "command": "npx",
      "args": ["tsx", "src/mcp-servers/WikiMCPBrowser.ts"],
      "env": {
        "MCP_SERVER_PORT": "3002"
      },
      "description": "Real Wikipedia browsing server with doom-scrolling prevention"
    }
  }
}
```

### Instrucciones para el Usuario

Después de ejecutar el launcher, verás estas instrucciones en consola:

```
🎯 VS Code MCP Setup Instructions
========================================

📋 Setup Steps:

1. Open VS Code
   Open Visual Studio Code in your workspace folder

2. Install MCP Extension
   Install the official Model Context Protocol extension from the VS Code marketplace

3. Open MCP Configuration
   Navigate to the generated file: .vscode/mcp.json

4. Use VS Code Intellisense
   Use VS Code's IntelliSense to connect to MCP servers. Press Ctrl+Shift+P and search for 'MCP: Connect to Server'

5. Select Server
   Choose from the available MCP servers listed in the configuration file

6. Start Using Tools
   Once connected, you can use MCP tools, resources, and prompts directly in VS Code

💡 Next Steps:
   1. Open VS Code in this workspace folder
   2. Install the Model Context Protocol extension
   3. Use Ctrl+Shift+P → "MCP: Connect to Server"
   4. Select from available MCP servers
   5. Start using MCP tools and resources in VS Code!
```

### Comandos VS Code MCP

Una vez conectado a los servidores MCP en VS Code, puedes usar estos comandos:

#### Comandos Generales
- **`Ctrl+Shift+P → "MCP: Connect to Server"`** - Conectar a servidor MCP
- **`Ctrl+Shift+P → "MCP: List Available Tools"`** - Listar herramientas disponibles
- **`Ctrl+Shift+P → "MCP: Browse Resources"`** - Explorar recursos
- **`Ctrl+Shift+P → "MCP: Use Prompt"`** - Usar prompts predefinidos

#### Herramientas Específicas del Service Launcher
- **`launch_mcp_server`** - Lanzar servidor específico
- **`stop_mcp_server`** - Detener servidor
- **`restart_mcp_server`** - Reiniciar servidor
- **`get_server_status`** - Ver estado de servidores
- **`launch_all_servers`** - Lanzar todos los servidores
- **`health_check_servers`** - Verificar salud
- **`generate_vscode_mcp_config`** - Regenerar configuración

#### Herramientas del X+1 MCP Machine
- **`advance_x`** - Avanzar X (+1)
- **`reset_x`** - Reset X a 0
- **`get_x_status`** - Estado actual de X
- **`evaluate_advancement`** - Evaluar si avanzar o resetear

#### Herramientas del Wiki MCP Browser
- **`search_wikipedia`** - Buscar en Wikipedia
- **`get_article`** - Obtener artículo específico
- **`get_article_summary`** - Resumen de artículo
- **`browse_categories`** - Explorar categorías

### Flujo de Trabajo Recomendado

1. **Lanzar Sistema Completo**
   ```bash
   npm run launcher:x-plus-1
   ```

2. **Verificar Configuración Generada**
   - Archivo `.vscode/mcp.json` creado automáticamente
   - Contiene todos los servidores activos

3. **Abrir VS Code**
   ```bash
   code .  # Abre VS Code en el workspace actual
   ```

4. **Instalar Extensión MCP**
   - Buscar "Model Context Protocol" en Extensions
   - Instalar extensión oficial

5. **Conectar a Servidores**
   - `Ctrl+Shift+P` → "MCP: Connect to Server"
   - Seleccionar servidores deseados

6. **Usar Herramientas MCP**
   - Acceso directo a herramientas desde VS Code
   - IntelliSense para parámetros
   - Resultados integrados en el editor

## Ventajas del Sistema

### ✅ Consolas Separadas
- Cada servidor MCP corre en su propia consola
- Logs separados y claros
- Fácil debug individual
- No bloqueo de la consola principal

### ✅ Gestión Centralizada
- Un punto de control para todos los servidores
- Comandos MCP estándar para gestión
- Estado global coordinado

### ✅ Auto-Recovery
- Auto-restart en caso de fallo
- Límites de reintentos
- Health checks continuos

### ✅ Interacción del Usuario
- ConsoleGamificationUI libre para el usuario
- No interrupciones por logs de servidores
- Experiencia limpia

## Environment Setup

### Prerequisites
1. **Ollama Server**
   ```bash
   # Install Ollama
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Start Ollama service
   ollama serve
   ```

2. **Required Model**
   ```bash
   # The launcher will auto-pull if missing
   ollama pull llama3.2:3b
   ```

3. **Node.js Dependencies**
   ```bash
   npm install
   ```

## Environment Variables

The launcher supports these environment variables:

```bash
# Ollama Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=GPT-OSS:20b                 # Default model (can override to llama3.2:3b)

# MCP Server Ports
MCP_SERVICE_LAUNCHER_URL=http://localhost:3050
MCP_XPLUS1_URL=http://localhost:3001
MCP_WIKI_URL=http://localhost:3002
```

### Model Configuration Examples

```bash
# Use GPT-OSS:20b (default)
npm run launcher:x-plus-1

# Use llama3.2:3b 
OLLAMA_MODEL=llama3.2:3b npm run launcher:x-plus-1

# Use custom model
OLLAMA_MODEL=mistral:7b npm run launcher:x-plus-1
```

## Configuración del Sistema

```typescript
const config = {
  mcpServiceLauncherPort: 3050,
  mcpServers: [
    {
      id: 'xplus1-mcp-machine',
      port: 3001,
      script: 'src/mcp-servers/XPlus1MCPMachine.ts'
    },
    {
      id: 'wiki-mcp-browser',
      port: 3002, 
      script: 'src/mcp-servers/WikiMCPBrowser.ts'
    }
  ]
};
```

## Estados de Servidor

- **`stopped`**: Servidor detenido
- **`starting`**: Iniciando
- **`running`**: Funcionando correctamente
- **`failed`**: Falló y no se puede reiniciar
- **`restarting`**: En proceso de reinicio

## Comandos de Gestión

```bash
# Arrancar todo el sistema
npm run launcher:x-plus-1

# Los servidores se gestionan vía MCP tools:
# - launch_mcp_server
# - stop_mcp_server  
# - restart_mcp_server
# - health_check_servers
```

## Scripts Individuales

### Servidores MCP Individuales
```bash
# Start X+1 MCP Machine only
npm run mcp:xplus1

# Start Wiki MCP Browser only  
npm run mcp:wiki

# Start MCP Service Launcher only
npm run mcp:launcher
```

### Aplicaciones Personalizadas
```bash
# Launch custom application with launcher
npm run launcher custom path/to/your/script.ts
```

### ⚠️ Gestión de Procesos del Sistema

```bash
# Kill all Node.js processes system-wide (with confirmation)
npm run launcher:kill-all-node

# Or with direct launcher call
npx tsx scripts/launcher.ts --kill-all-node

# Show help
npx tsx scripts/launcher.ts --help
```

**ADVERTENCIA**: El comando `kill-all-node` termina TODOS los procesos Node.js del sistema, incluyendo:
- ✋ Todas las aplicaciones Node.js en ejecución
- ✋ Procesos npm/yarn
- ✋ Servidores de desarrollo
- ✋ Extensiones de VS Code que usan Node.js  
- ✋ Otras herramientas y servicios basados en Node.js

El comando requiere confirmación explícita antes de proceder y funciona tanto en Windows como en sistemas Unix.

## Launcher Configuration

You can customize the launcher behavior:

```typescript
import { ApplicationLauncher } from './scripts/launcher';

const launcher = new ApplicationLauncher({
  ollamaUrl: 'http://your-ollama:11434',
  requiredModel: 'llama3.2:3b',
  mcpServers: [
    {
      id: 'custom-server',
      name: 'Custom MCP Server',
      port: 3003,
      script: 'path/to/your/mcp-server.ts'
    }
  ],
  healthCheckTimeout: 60000,    // 60 seconds
  shutdownGracePeriod: 10000    // 10 seconds
});

await launcher.launch('custom', 'path/to/your/app.ts');
```

## Startup Phases

### Phase 1: Environment Checks ✅
- **Ollama Server**: Verifies connection and version
- **Model Availability**: Checks if required model exists, auto-pulls if missing
- **Project Structure**: Validates all required files exist

### Phase 2: MCP Server Startup ⚡
- **X+1 MCP Machine**: Starts on port 3001
- **Wiki MCP Browser**: Starts on port 3002
- **Process Management**: Tracks PIDs and handles output

### Phase 3: Health Checks 🏥
- **MCP Server Health**: Tests HTTP endpoints
- **Ollama Generation**: Validates model can generate responses
- **Timeout Handling**: 30-second timeout with retry logic

### Phase 4: Application Launch 🎮
- **Environment Setup**: Injects MCP and Ollama URLs
- **Process Coordination**: Manages main application lifecycle
- **Graceful Shutdown**: Handles SIGINT/SIGTERM properly

## Troubleshooting

### Common Issues

1. **Ollama Not Running**
   ```
   ❌ Ollama server not available at http://localhost:11434
   ```
   **Solution**: Start Ollama with `ollama serve`

2. **Model Missing**
   ```
   ⚠️ Model llama3.2:3b not found. Attempting to pull...
   ```
   **Solution**: Wait for auto-pull or run `ollama pull llama3.2:3b`

3. **Port Conflicts**
   ```
   ❌ Health check failed for X+1 MCP Machine
   ```
   **Solution**: Check ports 3001/3002 are available

4. **File Missing**
   ```
   ❌ Required file missing: src/mcp-servers/XPlus1MCPMachine.ts
   ```
   **Solution**: Verify project structure is complete

### Debug Mode

Add debugging to see more details:
```bash
DEBUG=* npm run launcher:x-plus-1
```

### Manual Health Checks

Test components individually:
```bash
# Test Ollama
curl http://localhost:11434/api/version

# Test MCP Servers (after startup)
curl http://localhost:3001/health
curl http://localhost:3002/health
```

## Advanced Usage

### Custom MCP Servers

Add your own MCP servers to the launcher:

```typescript
const config = {
  mcpServers: [
    // Default servers
    ...DEFAULT_CONFIG.mcpServers,
    // Your custom server
    {
      id: 'my-custom-server',
      name: 'My Custom MCP Server', 
      port: 3003,
      script: 'src/my-servers/CustomServer.ts'
    }
  ]
};
```

### Integration Testing

Use the launcher in your tests:

```typescript
## Integración con ConsoleGamificationUI

El sistema asegura que cuando la aplicación principal (como el juego X+1) se ejecuta:

1. **Todos los servidores MCP están corriendo** en segundo plano
2. **La consola principal está libre** para la interacción del usuario
3. **Los logs están separados** y no interfieren
4. **El sistema es resiliente** con auto-recovery

Esto permite una experiencia de usuario fluida donde pueden interactuar con el juego sin verse interrumpidos por logs técnicos o fallos de servidores.

## Ejemplo de Uso Completo

```typescript
// El launcher arranca automáticamente todo
const launcher = new ApplicationLauncher();
await launcher.launch('x-plus-1');

// El usuario ve:
// 1. Fase de arranque coordinado
// 2. Servidores en consolas separadas
// 3. Consola principal lista para juego

// Secuencia típica:
// 🚀 State Machine MCP Driver - Application Launcher
// ===================================================
// 
// ✅ Phase 1: Environment checks
// 🚀 Phase 2: Starting MCP Service Launcher
// 🎯 Phase 3: Launching MCP Servers via Service Launcher
// 🏥 Phase 4: Health Checks
// 🎮 Phase 5: Launching Application
//
// 🎯 APPLICATION READY - All systems operational!
```

## Testing

### Integration Tests
```typescript
import { ApplicationLauncher } from '../scripts/launcher';

describe('Integration Tests', () => {
  let launcher: ApplicationLauncher;

  beforeAll(async () => {
    launcher = new ApplicationLauncher();
    await launcher.launch('test-mode');
  });

  afterAll(async () => {
    await launcher.shutdown();
  });

  it('should process X+1 pattern', async () => {
    // Your tests here
  });
});
```

## Troubleshooting

### Problemas Comunes

1. **Puerto ocupado**
   ```bash
   # Verificar puertos en uso
   netstat -tulpn | grep :3050
   netstat -tulpn | grep :3001
   netstat -tulpn | grep :3002
   
   # Matar procesos si es necesario
   pkill -f "tsx.*MCPServiceLauncher"
   pkill -f "tsx.*XPlus1MCPMachine"
   ```

2. **Ollama no responde**
   ```bash
   # Verificar estado de Ollama
   curl http://localhost:11434/api/tags
   
   # Reiniciar Ollama si es necesario
   pkill ollama
   ollama serve
   ```

3. **Modelos faltantes**
   ```bash
   # Verificar modelos disponibles
   ollama list
   
   # Pull del modelo requerido
   ollama pull llama3.2:3b
   ollama pull GPT-OSS:20b
   ```

### Logs y Debugging

```bash
# Logs del launcher principal
tail -f logs/launcher.log

# Logs de servidores específicos
tail -f logs/xplus1-mcp.log
tail -f logs/wiki-mcp.log
tail -f logs/service-launcher.log
```

## Production Deployment

For production use:

```bash
# Use PM2 or similar process manager
pm2 start scripts/launcher.ts --name "x-plus-1-game" -- x-plus-1

# Or Docker
docker run -p 3001:3001 -p 3002:3002 your-app npm run launcher:x-plus-1
```

## Architecture

```
Application Launcher
├── Environment Checks
│   ├── Ollama Connectivity
│   ├── Model Availability  
│   └── Project Structure
├── MCP Server Management
│   ├── X+1 MCP Machine (port 3001)
│   ├── Wiki MCP Browser (port 3002)
│   └── Process Lifecycle
├── Health Monitoring
│   ├── HTTP Endpoint Tests
│   ├── Model Generation Tests
│   └── Retry Logic
└── Application Orchestration
    ├── Environment Injection
    ├── Process Coordination
    └── Graceful Shutdown
```

The launcher ensures all components start in the correct order, with proper health validation, and provides a unified interface for managing the complex multi-process application stack.

## Scripts Summary

| Script | Purpose | Components Started |
|--------|---------|-------------------|
| `npm run launcher:x-plus-1` | Full X+1 game launch | Ollama check + MCP servers + Game |
| `npm run mcp:xplus1` | X+1 server only | XPlus1MCPMachine on port 3001 |
| `npm run mcp:wiki` | Wiki server only | WikiMCPBrowser on port 3002 |
| `npm run example:x-plus-1` | Game only (no setup) | X+1 game (assumes servers running) |

Use the launcher scripts for the complete experience! 🚀
