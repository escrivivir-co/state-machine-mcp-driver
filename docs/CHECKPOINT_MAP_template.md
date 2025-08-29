# Checkpoint Map (Skeleton) — 2025-08-28

Estado rápido:
- [ ] Checkpoint 1 — Lanzamiento inicial
- [ ] Checkpoint 2 — Inicialización completa
- [ ] Checkpoint 3 — UI de gamificación cargada
- [ ] Checkpoint 4 — Acceso al juego
- [ ] Checkpoint 5 — Inicialización de gameplay
- [ ] Checkpoint 6 — Gameplay funcional
- [ ] Checkpoint 7 — Cierre limpio
- [ ] Checkpoint 8 — Recovery y persistencia

---

## ✅ Checkpoint 1: Puedo lanzar la aplicación

Puntos críticos:
- [ ] C1.1 — Dependencias npm instaladas
- [ ] C1.2 — Compilación TypeScript sin errores
- [ ] C1.3 — Script launcher ejecuta sin crash inmediato (npm run app:normal/quiet/verbose)
- [ ] C1.4 — Proceso principal inicia sin excepciones

---

## ✅ Checkpoint 2: La aplicación se inicializa correctamente

Puntos críticos:
- [ ] C2.1 — Phase 1: Environment checks pasan
- [ ] C2.2 — Ollama server responde
- [ ] C2.3 — Modelo disponible (o descarga OK)
- [ ] C2.4 — Estructura de archivos validada
- [ ] C2.5 — Phase 2: MCP servers inician

---

## ✅ Checkpoint 3: La UI de gamificación ha sido cargada

Puntos críticos:
- [ ] C3.1 — Phase 3: Health checks pasan
- [ ] C3.2 — MCP servers en 3001/3002 responden
- [ ] C3.3 — Test de generación Ollama funciona
- [ ] C3.4 — Phase 4: Application launch ejecuta
- [ ] C3.5 — ConsoleGamificationUI se inicializa
- [ ] C3.6 — Runtime se conecta a MCP servers
- [ ] C3.7 — Chat provider configurado

---

## ✅ Checkpoint 4: El usuario tiene acceso al juego

Puntos críticos:
- [ ] C4.1 — Runtime inicializa con X+1
- [ ] C4.2 — StateGraph cargado
- [ ] C4.3 — Agentes registrados
- [ ] C4.4 — Estado inicial X=0
- [ ] C4.5 — Consola activa
- [ ] C4.6 — Prompt "> " visible

---

## ✅ Checkpoint 5: El juego puede inicializarse

Puntos críticos:
- [ ] C5.1 — Agents hablan al iniciar
- [ ] C5.2 — DionisioBot produce mensaje
- [ ] C5.3 — ApoloBot produce mensaje
- [ ] C5.4 — Respuestas coherentes del chat provider
- [ ] C5.5 — Contador de mensajes sube
- [ ] C5.6 — Transición de fase OK

---

## ✅ Checkpoint 6: El juego puede jugarse según configuración

Puntos críticos:
- [ ] C6.1 — Usuario escribe mensajes
- [ ] C6.2 — Agentes responden al input
- [ ] C6.3 — Límite de 10 mensajes aplicando
- [ ] C6.4 — JusticeBot hace pregunta crítica
- [ ] C6.5 — yes/no evalúa correctamente
- [ ] C6.6 — X se actualiza según respuesta
- [ ] C6.7 — Transiciones de estado OK
- [ ] C6.8 — Nuevo turno inicia automático

---

## ✅ Checkpoint 7: El juego puede cerrarse

Puntos críticos:
- [ ] C7.1 — Comando `quit` funciona
- [ ] C7.2 — Shutdown graceful del Runtime
- [ ] C7.3 — Chat provider se desconecta
- [ ] C7.4 — MCP servers reciben SIGTERM
- [ ] C7.5 — Cleanup de procesos completo
- [ ] C7.6 — Stats finales mostrados
- [ ] C7.7 — Exit code 0

---

## ✅ Checkpoint 8: El juego puede recuperarse y continuarse

Puntos críticos:
- [ ] C8.1 — Estado persistido (si aplica)
- [ ] C8.2 — Relanzar mantiene configuración
- [ ] C8.3 — MCP servers reconectan
- [ ] C8.4 — Chat provider restablece contexto
- [ ] C8.5 — Recovery de game state
- [ ] C8.6 — Continuidad de sesión mantenida

---

Notas rápidas:
- Mantener este archivo como tracker conciso (solo checkboxes). Actualizar conforme avanzamos.
- Comando de arranque: npm run app:normal | app:quiet | app:verbose
- Comando de limpieza: npm run cleannode
- Limpieza de procesos: npm run cleannode
