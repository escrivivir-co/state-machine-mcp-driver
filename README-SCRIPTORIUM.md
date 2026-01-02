# StateMachine — Scriptorium Integration

> **Submódulo**: state-machine-mcp-driver  
> **Versión integrada**: 1.0.0  
> **Rama de integración**: `integration/beta/scriptorium`  
> **Fecha de integración**: 2026-01-02

---

## 1. Propósito en el Scriptorium

El submódulo **StateMachine** proporciona un sistema de **gamificación multi-UI** que permite:

1. **UIs intercambiables**: Console, HTML5, ThreeJS, Blockly, Unity, WebRTC
2. **Comunicación reactiva**: RxJS streams para eventos entre componentes
3. **Integración MCP**: `MCPDriverAdapter` para conectar con servidores MCP

### Uso Principal

Servir interfaces web para herramientas del Scriptorium como:
- **PrologEditor**: Consultas Prolog vía `prolog-mcp-server`
- **BlocklyEditor**: Edición visual con `BlocklyGamificationUI`
- **Teatro Interactivo**: Escenas con `HTML5GamificationUI`

---

## 2. Arquitectura Relevante

```
StateMachine/
├── src/
│   ├── ui/                          ← 🎯 NÚCLEO: Sistema de UIs
│   │   ├── GamificationUI.ts        # Clase base abstracta
│   │   ├── HTML5GamificationUI.ts   # UI web con Express + SSE
│   │   ├── ConsoleGamificationUI.ts # UI de terminal
│   │   ├── BlocklyGamificationUI.ts # UI con Blockly visual
│   │   ├── MultiUIGameManager.ts    # Gestor de múltiples UIs
│   │   └── launcher/                # Lanzadores de UI
│   │
│   ├── drivers/                     ← MCPDriverAdapter
│   │   └── MCPDriverAdapter.ts      # Conecta UIs con MCP servers
│   │
│   ├── orchestration/               ← Sistema de canales RxJS
│   │   ├── Orchestrator.ts          # Coordinador central
│   │   └── channel/                 # App, Sys, UI channels
│   │
│   ├── runtime/                     ← Runtime de estado
│   │   └── Runtime.ts               # Gestión de estado global
│   │
│   └── mcp-servers/                 ← ⚠️ DEPRECATED (usar MCPGallery)
│
├── public/                          ← Assets web estáticos
│   ├── game.html                    # UI de juego X+1
│   └── alephscript-client.js        # Cliente SSE
│
└── examples/                        ← Ejemplos de uso
    └── multi-ui-launcher.ts         # Lanzador multi-UI
```

### Qué Usamos vs Qué Ignoramos

| Componente | Estado | Motivo |
|------------|--------|--------|
| `src/ui/` | ✅ Usar | Sistema de UIs de gamificación |
| `src/drivers/` | ✅ Usar | Integración con MCP |
| `src/orchestration/` | ✅ Usar | Comunicación RxJS |
| `src/runtime/` | ✅ Usar | Estado global |
| `src/mcp-servers/` | ⚠️ Ignorar | Duplica MCPGallery/mcp-mesh-sdk |
| `public/` | ✅ Usar | Assets web |

---

## 3. Dependencias

```json
{
  "express": "^4.18.2",
  "rxjs": "^7.8.1",
  "socket.io-client": "^4.6.0",
  "typescript": "^5.0.4"
}
```

### Dependencias Compartidas con Scriptorium

- **RxJS**: Ya usado en MCPGallery
- **Express**: Ya usado en mcp-mesh-sdk
- **TypeScript**: Estándar del proyecto

---

## 4. Clases Clave

### 4.1 GamificationUI (Base)

```typescript
abstract class GamificationUI {
    protected runtime: Runtime;
    protected mcpDriver: MCPDriverAdapter;
    
    abstract start(): Promise<void>;
    abstract stop(): Promise<void>;
    abstract displayMessage(message: GameMessage): Promise<void>;
}
```

### 4.2 HTML5GamificationUI

```typescript
class HTML5GamificationUI extends GamificationUI {
    // Express server integrado
    private app: express.Application;
    
    // Server-Sent Events para streaming
    private sseClients: Set<Response>;
    
    // Métodos principales
    async start(): Promise<void>;
    broadcastSSE(event: string, data: any): void;
}
```

### 4.3 MultiUIGameManager

```typescript
class MultiUIGameManager {
    private uis: Map<string, GamificationUI>;
    
    // Lanzar múltiples UIs simultáneamente
    async launchUI(type: UIType, config: UIConfig): Promise<void>;
    
    // Broadcast a todas las UIs
    broadcastToAll(event: string, data: any): void;
}
```

---

## 5. Uso en el Scriptorium

### 5.1 PrologGamificationUI (Propuesto)

```typescript
// StateMachine/src/ui/PrologGamificationUI.ts
class PrologGamificationUI extends HTML5GamificationUI {
    async executeQuery(query: string): Promise<any> {
        return this.mcpDriver.callTool(
            'prolog-mcp-server', 
            'prolog_query', 
            { query }
        );
    }
}
```

### 5.2 Iniciar UI de Prolog

```bash
# Opción 1: Script directo
cd StateMachine
npm run multi:web-only

# Opción 2: Integrado en MCPLauncherServer
# (Ver spike_opcion_c_gamification_ui.md)
```

---

## 6. Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run multi:demo` | Demo con Console + HTML5 |
| `npm run multi:web-only` | Solo UI web (puerto 3000) |
| `npm run example:multi` | Ejemplo de MultiUIGameManager |
| `npm run build` | Compilar TypeScript |

---

## 7. Integración con MCPGallery

### Conexión con prolog-mcp-server

```typescript
const mcpAdapter = new MCPDriverAdapter({
    servers: [
        { 
            id: 'prolog-mcp-server', 
            port: 3006,
            tools: ['prolog_query', 'prolog_assert', 'prolog_kb_list']
        }
    ]
});
```

### Conexión con launcher-server

```typescript
// El launcher-server (3050) puede iniciar las UIs
const launcherClient = new MCPClient('http://localhost:3050');
await launcherClient.callTool('launch_gamification_ui', {
    type: 'prolog',
    port: 5006
});
```

---

## 8. Documentación Relacionada

- [ARCH.md](ARCH.md) — Arquitectura completa del sistema
- [spike_opcion_c_gamification_ui.md](../ARCHIVO/DISCO/BACKLOG_BORRADORES/Enero_02_PrologAgentPack/spike_opcion_c_gamification_ui.md) — Spike de integración con PrologEditor
- [MCPGallery/README-SCRIPTORIUM.md](../MCPGallery/README-SCRIPTORIUM.md) — Servidores MCP del Scriptorium

---

## 9. Mantenimiento

### Actualizar desde upstream

```bash
cd StateMachine
git fetch origin
git merge origin/main --no-edit
git push origin integration/beta/scriptorium
```

### Sincronizar con Scriptorium

```bash
cd ..  # Raíz de ALEPH
git add StateMachine
git commit -m "chore(submodule): update StateMachine to latest"
```

---

## 10. Contacto

- **Submódulo original**: https://github.com/escrivivir-co/state-machine-mcp-driver
- **Issues**: Reportar en el repo principal
- **Agente responsable**: `@ox` (integración) + `@plugin_ox_prologeditor` (uso)

---

*Documento generado como parte de la épica SCRIPT-2.3.1 (PrologAgent Pack)*
