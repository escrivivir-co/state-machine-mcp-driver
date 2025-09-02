# Iteración 06 - Animaciones y Trayectorias
**Fase:** 3 - Escena Three.js y Renderizado  
**Duración estimada:** 3.5 horas  
**Prioridad:** Alta

## Objetivos
- [ ] Implementar trayectorias animadas de mensajes usando THREE.Curve
- [ ] Desarrollar sistema de diferenciación por color de canal
- [ ] Crear animaciones fluidas de partículas/mensajes
- [ ] Optimizar rendering para múltiples animaciones simultáneas

## Entregables
1. **Trajectory System**: Trayectorias curvas entre centro y bots
2. **Animation Pipeline**: Sistema de animación de partículas
3. **Color Coding**: Diferenciación visual por canal (Sys/App/UI)
4. **Performance Optimization**: Instanced rendering y object pooling
5. **Visual Effects**: Trails, glow effects, particle systems

## Fase 1: Análisis y Planificación (35 min)
- [ ] Diseñar matemáticas de trayectorias curvas
- [ ] Planificar sistema de colores por canal
- [ ] Especificar performance requirements
- [ ] Definir efectos visuales y estilo

## Fase 2: Implementación Core (140 min)
- [ ] Desarrollar `TrajectoryManager`:
  - THREE.CubicBezierCurve3 para trayectorias suaves
  - Cálculo de puntos de control automático
  - Cache de geometrías de curvas
- [ ] Implementar `MessageParticle` system:
  - Geometría eficiente para partículas
  - Material con color diferenciado
  - Position interpolation along curves
- [ ] Crear `AnimationController`:
  - requestAnimationFrame loop optimizado
  - Timeline management para múltiples animaciones
  - Easing functions (ease-in-out, bezier)
- [ ] Desarrollar color system:
  - Sys channel: Red (#ff4444)
  - App channel: Blue (#4444ff)
  - UI channel: Green (#44ff44)
  - Intensity variation por importancia
- [ ] Optimizar performance:
  - InstancedBufferGeometry para partículas
  - Object pooling para reutilización
  - LOD (Level of Detail) management

## Fase 3: Testing y Validación (50 min)
- [ ] Tests de matemáticas de curvas
- [ ] Benchmarks de performance (100+ partículas simultáneas)
- [ ] Validación visual de colores y efectos
- [ ] Tests de memory leaks

## Fase 4: Integración y Refinamiento (35 min)
- [ ] Integrar con pipeline de mensajes
- [ ] Añadir configuración de velocidad de animación
- [ ] Implementar pausa/resume de animaciones
- [ ] Refinar efectos visuales

## Fase 5: Documentación y Cierre (20 min)
- [ ] Documentar sistema de animaciones
- [ ] Crear configuración de efectos
- [ ] Actualizar MASTER_CHECKLIST.md
- [ ] Preparar integración con datos reales

## Dependencias
**Requiere completadas:** Iteración 05  
**Bloquea a:** Iteración 08

## Notas Técnicas
- Use THREE.Vector3.lerp() para interpolación
- BufferGeometry con custom attributes
- Shader materials para efectos avanzados
- 60 FPS target con 100+ partículas

## Estado Actual (JSON)
```json
{
  "iteration": "06",
  "status": "pending",
  "progress": 0,
  "blockers": [],
  "next_steps": ["implement_trajectory_curves", "create_particle_system", "optimize_rendering"],
  "estimated_completion": null
}
```
