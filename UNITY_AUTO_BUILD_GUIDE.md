# Unity WebGL Auto-Build Setup Guide

Esta guía explica cómo configurar Unity para que funcione con el auto-build de **UnityGamificationUI**.

## 🎯 Configuración Rápida

### 1. Estructura de Proyecto Requerida

```
unity-project/                    # Tu proyecto Unity
├── Assets/
│   ├── Scripts/
│   │   ├── AlephScriptClient.cs  # Cliente para AlephScript
│   │   └── GameManager.cs        # Gestión del juego
│   └── Scenes/
│       └── MainScene.unity       # Escena principal
├── ProjectSettings/
└── Builds/                       # Directorio de builds (auto-creado)
    └── WebGL/                    # Build WebGL (auto-generado)
        └── index.html            # Archivo principal
```

### 2. Scripts Requeridos

Copia estos archivos a tu proyecto Unity:

1. **`BuildScript.cs`** → `Assets/Editor/BuildScript.cs`
2. **`UnityAlephScriptClient.cs`** → `Assets/Scripts/UnityAlephScriptClient.cs`
3. **`UnityGameManager.cs`** → `Assets/Scripts/UnityGameManager.cs`

### 3. Configuración del Auto-Build

```typescript
// En tu configuración de UnityGamificationUI
{
  autoBuild: true,
  autoOpenBrowser: true,
  unityProjectPath: "e:/LAB_AGOSTO/unity-project",  // Ruta a tu proyecto
  unityBuildTarget: "WebGL",
  buildDir: "e:/LAB_AGOSTO/unity-project/Builds/WebGL"
}
```

## 🔧 Configuración Manual de Unity

### 1. Configurar Build Settings

1. Abrir Unity → **File** → **Build Settings**
2. Seleccionar **WebGL** como plataforma
3. Hacer clic en **Switch Platform**
4. Agregar escenas necesarias a **Scenes In Build**

### 2. Configurar Player Settings

1. **Edit** → **Project Settings** → **Player**
2. **WebGL Settings**:
   - **Compression Format**: Gzip
   - **Memory Size**: 512 MB
   - **Data caching**: ✅ Enabled
   - **Template**: Minimal

### 3. Configurar Assets

Copiar los scripts proporcionados:

```bash
# Desde state-machine-mcp-driver/examples/unity-integration/
cp Scripts/BuildScript.cs [UnityProject]/Assets/Editor/
cp UnityAlephScriptClient.cs [UnityProject]/Assets/Scripts/
cp UnityGameManager.cs [UnityProject]/Assets/Scripts/
```

## 🚀 Testing del Auto-Build

### 1. Test Standalone

```bash
cd state-machine-mcp-driver
npm run unity:test
```

**Lo que debería suceder:**
1. ✅ Ejecuta `Unity -batchmode -executeMethod BuildScript.BuildWebGL`
2. ✅ Compila el proyecto WebGL automáticamente
3. ✅ Inicia servidor en puerto 9080
4. ✅ Abre navegador automáticamente

### 2. Verificar Build

```bash
# Verificar que el build se generó
ls [UnityProject]/Builds/WebGL/
# Debe contener: index.html, Build/, TemplateData/
```

### 3. Logs a Buscar

```
🔨 Building Unity WebGL...
[Unity Build] Unity 2023.x.x [version]
[Unity Build] Building WebGL...
✅ Unity WebGL built successfully
🌐 Opening browser at http://localhost:9080
```

## 🛠️ Comandos Disponibles

```bash
# Test standalone de Unity (recomendado para desarrollo)
npm run unity:test

# Demo completo multi-UI (HTML5 + ThreeJS + Unity + Console)
npm run unity:demo

# Solo compilar Unity (sin ejecutar)
cd [UnityProject]
Unity -batchmode -quit -projectPath . -executeMethod BuildScript.BuildWebGL
```

## 📂 Estructura de Build Generada

```
unity-project/Builds/WebGL/
├── index.html              # Punto de entrada principal
├── Build/
│   ├── webgl.data          # Assets del juego
│   ├── webgl.framework.js  # Framework Unity
│   ├── webgl.loader.js     # Loader Unity
│   └── webgl.wasm          # WebAssembly binario
└── TemplateData/
    ├── style.css
    └── UnityProgress.js
```

## 🐛 Troubleshooting

### Error: "Unity command not found"

**Solución 1: Agregar Unity al PATH**
```bash
# Windows
set PATH=%PATH%;C:\Program Files\Unity\Hub\Editor\[version]\Editor

# Mac
export PATH=$PATH:/Applications/Unity/Hub/Editor/[version]/Unity.app/Contents/MacOS

# Linux
export PATH=$PATH:/opt/Unity/Editor
```

**Solución 2: Usar ruta completa**
```typescript
// En UnityGamificationUI, modificar buildUnityWebGL()
const unityCmd = "C:/Program Files/Unity/Hub/Editor/2023.1.0f1/Editor/Unity.exe";
```

### Error: "Build failed with code 1"

1. **Verificar logs de Unity**:
   ```bash
   tail -f [UnityProject]/Builds/build.log
   ```

2. **Build manual primero**:
   ```bash
   cd [UnityProject]
   Unity -batchmode -quit -projectPath . -executeMethod BuildScript.BuildWebGL -logFile build.log
   ```

3. **Verificar dependencias**:
   - ✅ Todas las escenas en Build Settings
   - ✅ Scripts sin errores de compilación
   - ✅ Platform target configurado como WebGL

### Error: "Browser did not open"

- El servidor sigue funcionando en `http://localhost:9080`
- Abrir navegador manualmente
- Verificar que el build tiene `index.html`

### Error: "WebGL not loading"

1. **Verificar headers COOP/COEP**:
   ```bash
   curl -I http://localhost:9080
   # Debe mostrar:
   # Cross-Origin-Embedder-Policy: require-corp
   # Cross-Origin-Opener-Policy: same-origin
   ```

2. **Verificar archivos WebGL**:
   ```bash
   ls [UnityProject]/Builds/WebGL/Build/
   # Debe contener: .data, .framework.js, .loader.js, .wasm
   ```

## 🎯 Opciones Avanzadas

### Build de Desarrollo

Para builds con debugging habilitado:

```typescript
{
  unityBuildTarget: "WebGL-Development",
  debugMode: true
}
```

### Build Personalizado

```csharp
// En BuildScript.cs, modificar BuildWebGL()
buildPlayerOptions.options = BuildOptions.Development | BuildOptions.AllowDebugging;
```

### Configuración de Memoria

```csharp
// En BuildScript.cs, ConfigureWebGLSettings()
PlayerSettings.WebGL.memorySize = 1024; // 1GB para proyectos grandes
```

---

**🎉 Una vez configurado, Unity se compilará automáticamente igual que la app Angular de ThreeJS!**
