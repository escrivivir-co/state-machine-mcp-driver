# Angular NG0908 Dependency Injection Error - Specialist Analysis Required

## Contexto General del Sistema

### Arquitectura del Proyecto
Tenemos un sistema multi-UI para juegos que incluye:

1. **state-machine-mcp-driver** - Servidor principal con múltiples interfaces UI
2. **threejs-gamify-ui** - Paquete Angular independiente que se distribuye via npm
3. Configuración en `xplus1-config.json` que define múltiples UIs simultáneas en puertos diferentes

### Problema Actual: Error NG0908 en Puerto 9091

```javascript
main.9eaed00941129f6b.js:1 Error starting app: V: NG0908
    at new Tt (http://localhost:9091/main.9eaed00941129f6b.js:1:87046)
    at Object.n [as useFactory] (http://localhost:9091/main.9eaed00941129f6b.js:1:107713)
    at Object.i [as factory] (http://localhost:9091/main.9eaed00941129f6b.js:1:19184)
    at Wo.hydrate (http://localhost:9091/main.9eaed00941129f6b.js:1:19751)
    at Wo.get (http://localhost:9091/main.9eaed00941129f6b.js:1:18456)
    at fN (http://localhost:9091/main.9eaed00941129f6b.js:1:120683)
    at U6 (http://localhost:9091/main.9eaed00941129f6b.js:1:121800)
    at FX (http://localhost:9091/main.9eaed00941129f6b.js:1:860414)
    at 749 (http://localhost:9091/main.9eaed00941129f6b.js:1:860446)
    at n (http://localhost:9091/runtime.512ba4cae4c4ee5b.js:1:127)
```

## Configuración de UIs Múltiples (xplus1-config.json)

El archivo de configuración define 4 UIs diferentes:

```json
"ui": [
  {
    "id": "threejs-visual",
    "name": "ThreeJS Visual Interface (Dynamic HTML)",
    "type": "threejs",
    "enabled": true,
    "config": {
      "port": 9090,
      "provideTemplate": false,  // ← Genera HTML dinámico
      "angularProjectPath": "../threejs-gamify-ui"
    }
  },
  {
    "id": "threejs-angular",
    "name": "ThreeJS Angular Interface (Package)",
    "type": "threejs", 
    "enabled": true,
    "config": {
      "port": 9091,
      "staticDir": "./public/threejs-ui",
      "provideTemplate": true,   // ← Sirve aplicación Angular compilada
      "angularProjectPath": "../threejs-gamify-ui"
    }
  }
]
```

### Flag `provideTemplate` - Comportamiento Diferenciado

- **Puerto 9090**: `provideTemplate: false` → Genera HTML dinámico con JavaScript vanilla
- **Puerto 9091**: `provideTemplate: true` → Sirve aplicación Angular pre-compilada desde `./public/threejs-ui`

## Flujo npm pack/install implementado

1. **threejs-gamify-ui** se construye y empaqueta (`npm run build:package`)
2. Se instala en **state-machine-mcp-driver** (`npm install --save threejs-gamification-ui-1.0.0.tgz`)
3. El script `postinstall` copia automáticamente la app Angular a `./public/threejs-ui/`
4. El puerto 9091 sirve esta copia como aplicación Angular estática

## Conflictos AlephScript Resueltos (Parcialmente)

### ✅ Conflictos Externos Resueltos
El sistema detecta y elimina referencias externas a AlephScript:

```typescript
// En ThreeJSGamificationUI.ts
const alephScriptRegex = /(<script[^>]*src=['""][^'"]*alephscript[^'"]*['"][^>]*><\/script>)/gi;

if (templateContent.includes('alephscript')) {
  const cleanedContent = templateContent.replace(alephScriptRegex, 
    '<!-- AlephScript reference removed to prevent conflicts -->');
}
```

### ❌ Conflictos Internos Persistentes
El bundle compilado de Angular (`main.9eaed00941129f6b.js`) contiene código AlephScript integrado que causa el error NG0908.

```bash
# Verificación con curl muestra que referencias externas fueron removidas exitosamente
$ curl -s http://localhost:9091/ | grep -i alephscript
<!-- AlephScript reference removed to prevent conflicts -->
```

## Servicios Angular Relacionados

### AlephScriptService en el bundle Angular
```typescript
// threejs-gamify-ui/projects/threejs-ui-lib/src/lib/core/services/alephscript.service.ts
@Injectable({
  providedIn: 'root'
})
export class AlephScriptService {
  private alephClient: any = null;
  private connectionStatus$ = new BehaviorSubject<string>('disconnected');
  
  constructor() {
    console.log('🔗 AlephScriptService initialized');
  }
  
  async connect(): Promise<void> {
    // Load AlephScript dynamically
    await this.loadAlephScript();
  }
}
```

## Análisis Técnico Requerido

### 1. NG0908 Error Específico
- **¿Qué causa exactamente el error NG0908 en este contexto?**
- ¿Es un problema de inyección de dependencias circular?
- ¿El AlephScriptService está causando conflictos con el sistema de DI de Angular?

### 2. Estrategias de Resolución
- **Opción A**: Rebuilding sin AlephScript - ¿Cómo excluir AlephScriptService del bundle de producción?
- **Opción B**: Lazy Loading - ¿Cargar AlephScriptService condicionalmente?
- **Opción C**: Dependency Injection Fix - ¿Reconfigurar el DI para evitar conflictos?

### 3. Bundle Analysis
- ¿Qué dependencias específicas están causando el conflicto en `main.9eaed00941129f6b.js`?
- ¿Se puede usar source maps para identificar la línea exacta del problema?

### 4. Angular Build Configuration
- ¿Necesitamos modificar `angular.json` para excluir ciertos servicios?
- ¿Hay providers o imports problemáticos en algún módulo?

## Archivos Clave para Investigación

1. **Angular App Bundle**: `http://localhost:9091/main.9eaed00941129f6b.js` (contiene 1 referencia AlephScript)
2. **Servicio Problemático**: `threejs-gamify-ui/projects/threejs-ui-lib/src/lib/core/services/alephscript.service.ts`
3. **Configuración Express**: `state-machine-mcp-driver/src/ui/ThreeJSGamificationUI.ts` (líneas 100-150)
4. **Build Config**: `threejs-gamify-ui/angular.json`

## Directrices para el Especialista

### Objetivos Inmediatos
1. **Identificar la causa raíz** del error NG0908 en el contexto de AlephScript
2. **Proponer solución específica** que permita:
   - Puerto 9090: HTML dinámico sin Angular (✅ funciona)
   - Puerto 9091: Aplicación Angular limpia sin conflictos AlephScript (❌ falla NG0908)

### Requisitos de la Solución
- **Mantener** la funcionalidad del flujo npm pack/install
- **Preservar** la diferenciación entre puertos (provideTemplate flag)
- **Resolver** el error NG0908 sin afectar otras UIs
- **Documentar** cambios necesarios en build process si aplica

### Información Adicional Disponible
- Logs detallados de ThreeJSGamificationUI con debug habilitado
- Configuración completa en `xplus1-config.json`
- Acceso a todo el código fuente de ambos proyectos
- Tests con curl confirmando eliminación exitosa de referencias externas

---

**¿Puedes analizar este error NG0908 y proporcionar una solución que permita que la aplicación Angular funcione correctamente en el puerto 9091 mientras mantiene el sistema multi-UI diferenciado?**
