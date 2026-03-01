# Trading Bot SaaS - TODO

## Sprint Actual: Visor de Velas Mejorado

### En Progreso
- [ ] Fase 7: Integración Final en backtester/page.tsx

### Pendiente
- [ ] Testear con 10k+ velas
- [ ] Conectar con SimpleCandleChart para renderizado real

### Completado
- [x] Análisis del código existente
- [x] Plan de implementación
- [x] Fase 1: Virtual Scrolling - hooks/use-virtual-candles.ts
- [x] Fase 2: Compresión de Velas - lib/candle-compression.ts
- [x] Fase 3: Selector de Período - period-selector.tsx
- [x] Fase 4: Modos de Visualización (detail, operative, overview)
- [x] Fase 5: Playback con x50 - playback-controls.tsx
- [x] Fase 6: Componente EnhancedCandleViewer

---

## Detalle de Fases

### Fase 1: Virtual Scrolling ✅
- [x] 1.1 Crear `hooks/use-virtual-candles.ts`
- [x] 1.2 Implementar cálculo de rango visible
- [x] 1.3 Buffer de 50 velas antes/después

### Fase 2: Compresión de Velas ✅
- [x] 2.1 Crear `lib/candle-compression.ts`
- [x] 2.2 Niveles: 1min, 5min, 15min, 1h, 4h, 1d
- [x] 2.3 Compresión adaptativa según count

### Fase 3: Selector de Período ✅
- [x] 3.1 Crear `components/backtester/period-selector.tsx`
- [x] 3.2 Opciones: Hoy, semana, mes, 3 meses, año, todo
- [x] 3.3 Versión desktop y mobile

### Fase 4: Modos de Visualización ✅
- [x] 4.1 Tipo `VisualizationMode`
- [x] 4.2 Modo Detalle (trade individual)
- [x] 4.3 Modo Operativa (todos los trades)
- [x] 4.4 Modo Overview (equity + marcadores)

### Fase 5: Playback Mejorado ✅
- [x] 5.1 Añadir velocidad x50 a playback-controls.tsx
- [x] 5.2 Integrar con virtual scrolling en EnhancedCandleViewer
- [x] 5.3 Intervalos de velocidad optimizados

### Fase 6: Optimizaciones ✅
- [x] 6.1 Máx 300 velas renderizadas en virtual scroll
- [x] 6.2 Memoización de cálculos
- [x] 6.3 Componente EnhancedCandleViewer creado

### Fase 7: Integración
- [ ] 7.1 Actualizar backtester/page.tsx
- [ ] 7.2 Tests rendimiento 10k+ velas
- [ ] 7.3 Verificar mobile-first

---

## Archivos Creados/Modificados
```
NUEVOS:
- hooks/use-virtual-candles.ts ✅
- lib/candle-compression.ts ✅
- components/backtester/period-selector.tsx ✅
- components/backtester/enhanced-candle-viewer.tsx ✅

MODIFICADOS:
- components/backtester/playback-controls.tsx ✅ (x50 speed)
- components/backtester/index.ts ✅ (exports)
```

## Criterios de Aceptación
- [ ] Renderizar 10,000 velas sin lag
- [ ] Cambio de período < 500ms
- [ ] Playback fluido a x50
- [ ] Mobile-first (375px)

---

## Notas
- EnhancedCandleViewer está listo pero necesita conectarse con SimpleCandleChart para el renderizado real de velas
- Por ahora muestra placeholder con info del virtual scrolling
- Siguiente paso: integrar en backtester/page.tsx como opción de vista
