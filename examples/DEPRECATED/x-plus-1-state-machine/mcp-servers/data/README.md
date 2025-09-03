# Configuración de Datos - MCP Servers

Este directorio contiene archivos JSON de configuración que permiten modificar el comportamiento de los servidores MCP sin editar el código fuente.

## Archivos de Configuración

### 1. `wiki-topics.json`
Contiene los temas que pueden explorar los diferentes tipos de agentes:

```json
{
  "dionisio": [...],  // Temas cósmicos/existenciales
  "apolo": [...]      // Temas históricos/humanos
}
```

**Cómo editar:**
- Añade nuevos temas a los arrays
- Los temas deben ser nombres de artículos de Wikipedia válidos
- Usa guiones bajos en lugar de espacios (ej: "Big_Bang")

### 2. `wiki-content.json`
Define el contenido que se muestra para cada tema:

```json
{
  "cosmic": {
    "nombre_tema": "contenido específico..."
  },
  "historical": {
    "nombre_tema": "contenido específico..."
  },
  "fallbackTemplates": {
    "cosmic": "plantilla con {topic}",
    "historical": "plantilla con {topic}"
  }
}
```

**Cómo editar:**
- Añade nuevos temas con su contenido específico
- Las plantillas de fallback se usan cuando no hay contenido específico
- Usa `{topic}` en las plantillas para insertar el nombre del tema

### 3. `wiki-messages.json`
Mensajes del sistema y plantillas de texto para el servidor Wiki:

```json
{
  "messages": {
    "server": {
      "starting": "🌐 Starting Wiki MCP Server...",
      "started": "✅ Wiki MCP Server started successfully",
      "error": "❌ Failed to start Wiki MCP Server:"
    },
    "browsing": {
      "template": "📖 {agentType}Bot browsing: {topic}"
    }
  }
}
```

**Variables disponibles:**
- `{agentType}`: tipo de agente (DIONISIO/APOLO)
- `{topic}`: nombre del tema

### 4. `xplus1-messages.json`
Mensajes del sistema para el servidor X+1:

```json
{
  "messages": {
    "server": {
      "starting": "🔢 Starting X+1 MCP Server...",
      "started": "✅ X+1 MCP Server started successfully",
      "error": "❌ Failed to start X+1 MCP Server:"
    },
    "client": {
      "setAdvance": "🎯 Setting advance: {advance} ({reason})",
      "noReason": "No reason"
    }
  }
}
```

**Variables disponibles:**
- `{advance}`: valor numérico del avance
- `{reason}`: razón del avance

## Consejos de Edición

1. **Validez JSON**: Asegúrate de que los archivos mantengan un JSON válido
2. **Codificación**: Usa UTF-8 para caracteres especiales y emojis
3. **Backup**: Haz copias de seguridad antes de modificar
4. **Reinicio**: Reinicia el servidor después de modificar los archivos para que los cambios surtan efecto

## Personalización Avanzada

Puedes añadir nuevos campos a los archivos JSON y modificar el código TypeScript correspondiente para usar esos nuevos datos. Los archivos están diseñados para ser extensibles.
