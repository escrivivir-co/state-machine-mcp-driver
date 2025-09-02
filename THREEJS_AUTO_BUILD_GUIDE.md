# ThreeJS & Unity Integration Guide

Guía completa de integración de **ThreeJS** y **Unity** con el sistema **GamificationUI**.

## 🎯 Resumen de lo Implementado

### ✅ ThreeJSGamificationUI Mejorado

El **ThreeJSGamificationUI** ahora gestiona automáticamente:

1. **🔨 Compilación Automática**: Compila el proyecto Angular `threejs-gamify-ui` automáticamente
2. **🌐 Apertura de Navegador**: Abre el navegador automáticamente como lo hace `HTML5GamificationUI`
3. **📡 API REST Completa**: Endpoints compatibles con el frontend Angular
4. **🔗 Integración AlephScript**: Comunicación a través de AlephScript en lugar de Socket.IO nativo

### 🆕 Nuevas Funcionalidades

#### Auto-Build del Proyecto Angular
```typescript
// Configuración automática
{
  autoBuild: true,                    // Compila automáticamente antes de servir
  autoOpenBrowser: true,              // Abre navegador automáticamente  
  angularProjectPath: "../threejs-gamify-ui"  // Ruta al proyecto Angular
}
```

#### Gestión de Navegador
- Detección automática de plataforma (Windows/Mac/Linux)
- Apertura inteligente del navegador
- Logs informativos con URLs de acceso

#### API REST Mejorada
- `/api/status` - Estado del juego y clientes conectados
- `/api/config` - Configuración del juego  
- `/api/input` - Entrada de usuario
- `/api/select-agent` - Selección de agentes
- `/api/agents` - Lista de agentes activos

## 🚀 Uso Rápido

### 1. Test Standalone de ThreeJS

Para probar solo el ThreeJS UI con auto-build:

```bash
cd state-machine-mcp-driver
npm run threejs:test
```

Este comando:
1. ✅ Compila automáticamente `threejs-gamify-ui`
2. ✅ Inicia servidor en puerto 9090
3. ✅ Abre navegador automáticamente
4. ✅ Proporciona endpoints API completos

### 2. Demo Multi-UI Completo

Para probar el sistema multi-UI completo:

```bash
npm run threejs:demo
```

Esto inicia:
- **HTML5 UI**: `http://localhost:8080`
- **ThreeJS UI**: `http://localhost:9090` (auto-compilado)
- **Unity UI**: `http://localhost:9080`
- **Console UI**: Terminal interactiva

## 🔧 Configuración Detallada

### ThreeJS UI Configuration

```typescript
{
  id: "threejs-visual",
  name: "ThreeJS Visual Interface", 
  type: "threejs",
  enabled: true,
  config: {
    gameTitle: "ThreeJS Visual Demo",
    port: 9090,
    
    // Directorios
    staticDir: "../threejs-gamify-ui/dist/threegamification-ui",
    angularProjectPath: "../threejs-gamify-ui",
    
    // Opciones de auto-gestión
    autoBuild: true,           // Compila Angular automáticamente
    autoOpenBrowser: true,     // Abre navegador automáticamente
    
    // Configuración del juego  
    corsOrigin: "*",
    enablePostulations: true,
    debugMode: true,
    maxMessagesPerThread: 100
  }
}
```

## 🏗️ Arquitectura del Sistema

### Flujo de Auto-Build

```mermaid
graph TD
    A[ThreeJSGamificationUI.start()] --> B{autoBuild enabled?}
    B -->|Yes| C[buildAngularApp()]
    C --> D[npm run build en threejs-gamify-ui]
    D --> E[Actualizar staticDir a dist/]
    E --> F[Configurar Express Server]
    B -->|No| F
    F --> G[Inicializar AlephScript]
    G --> H{autoOpenBrowser?}
    H -->|Yes| I[openBrowser()]
    H -->|No| J[Servidor Listo]
    I --> J
```

### Gestión de Procesos

```typescript
class ThreeJSGamificationUI {
  // Procesos gestionados automáticamente
  private buildProcess?: ChildProcess;    // Proceso de build Angular
  private browserProcess?: ChildProcess;  // Proceso del navegador
  
  // Auto-cleanup en stop()
  async stop() {
    if (this.buildProcess) this.buildProcess.kill();
    if (this.browserProcess) this.browserProcess.kill();
  }
}
```

## 📁 Estructura de Archivos

```
state-machine-mcp-driver/
├── src/ui/
│   ├── ThreeJSGamificationUI.ts     ✅ Actualizado con auto-build
│   └── MultiUIGameConfig.ts         ✅ Nuevas opciones de configuración
├── examples/
│   ├── threejs-standalone-test.ts   🆕 Test standalone
│   └── threejs-integration-example.ts ✅ Demo multi-UI actualizado
└── package.json                     ✅ Nuevos scripts npm

../threejs-gamify-ui/                🎯 Proyecto Angular target
├── angular.json                     ⚙️ Configuración Angular  
├── package.json                     📦 Dependencias
└── dist/threegamification-ui/       📂 Build output (auto-generado)
```

## 🔄 Comparación: Antes vs Ahora

### ❌ Antes (Manual)
1. Compilar manualmente `threejs-gamify-ui`
2. Copiar archivos dist/ al directorio correcto  
3. Configurar rutas estáticas manualmente
4. Abrir navegador manualmente
5. Gestionar errores de build manualmente

### ✅ Ahora (Automático)
1. **Auto-build**: `npm run build` automático en `threejs-gamify-ui`
2. **Auto-serve**: Directorio `dist/` detectado automáticamente
3. **Auto-browser**: Navegador se abre automáticamente  
4. **Auto-API**: Endpoints REST completos como `HTML5GamificationUI`
5. **Auto-cleanup**: Procesos gestionados automáticamente

## 🛠️ Comandos Disponibles

```bash
# Test standalone de ThreeJS (recomendado para desarrollo)
npm run threejs:test

# Demo completo multi-UI (HTML5 + ThreeJS + Unity + Console)  
npm run threejs:demo

# Solo compilar (sin ejecutar)
npm run build

# Otros tests
npm run multi:demo     # Demo multi-UI original
npm run multi:web-only # Solo UIs web (HTML5 + ThreeJS)
```

## 🐛 Troubleshooting

### Error: "Angular build failed"
```bash
# Verificar que threejs-gamify-ui tiene dependencias instaladas
cd ../threejs-gamify-ui
npm install
```

### Error: "Browser did not open"
- El servidor sigue funcionando en `http://localhost:9090`
- Abrir navegador manualmente
- Verificar permisos del sistema

### Error: "Port 9090 in use"
```typescript
// Cambiar puerto en configuración
config: {
  port: 9091,  // Puerto alternativo
  // ...
}
```

## 🎮 Testing y Validación

### 1. Verificar Auto-Build
```bash
npm run threejs:test
# Buscar logs: "🔨 Building Angular ThreeJS app..."
# Debe mostrar: "✅ Angular ThreeJS app built successfully"
```

### 2. Verificar API Endpoints
```bash
# Estado del servidor
curl http://localhost:9090/api/status

# Configuración
curl http://localhost:9090/api/config  

# Agentes activos
curl http://localhost:9090/api/agents
```

### 3. Verificar Apertura de Navegador
- Se debe abrir automáticamente
- URL: `http://localhost:9090`
- Debe cargar la aplicación Angular compilada

## 🎯 Próximos Pasos

1. **✅ Completado**: Auto-build y gestión de navegador
2. **🔄 En progreso**: Optimización de tiempos de build
3. **📋 Pendiente**: Hot-reload durante desarrollo
4. **📋 Pendiente**: Build caching para mayor velocidad

---

**🎉 El ThreeJSGamificationUI ahora gestiona automáticamente la aplicación Angular igual que el HTML5GamificationUI gestiona su interfaz web!**
