# TBS - Progress Tracker

_Última actualización: 2026-03-12 (Merge ralph/pre-launch-polish + QoL)_

---

## Sprint Completado: Backtester QoL Improvements ✅

- **Estado:** `completed`
- **Inicio:** 2026-03-12
- **Fin:** 2026-03-12
- **Branch:** `ralph/pre-launch-polish`

### Tareas completadas:
- [x] **Persistencia de preferencias en localStorage**
  - Hook `useBacktesterPreferences` creado en `lib/hooks/use-backtester-preferences.ts`
  - Guarda automáticamente: lotajeBase, pipsDistance, maxLevels, takeProfitPips, useTrailingSL, trailingSLPercent, signalsSource, initialCapital, useRealPrices, filters, dataSource, dateFrom, dateTo
  - Signal limit guardado por separado

- [x] **Atajos de teclado**
  - Hook `useKeyboardShortcuts` creado en `lib/hooks/use-keyboard-shortcuts.ts`
  - Ctrl+Enter (o Cmd+Enter en Mac): Ejecutar backtest
  - Teclas 1-6: Cambiar timeframe en EnhancedCandleViewer (1m, 5m, 15m, 1h, 4h, 1D, Auto)
  - Solo funcionan cuando no estás en un input

- [x] **Progreso visual mejorado**
  - Estado de progreso con simulación en frontend (sin cambios en API)
  - Barra de progreso que avanza con curva de desaceleración
  - Mensajes dinámicos según fase: "Cargando datos...", "Procesando señales...", "Ejecutando simulación...", "Calculando resultados..."
  - ExecutionOverlay con barra de progreso real

### Archivos modificados:
```
lib/hooks/use-backtester-preferences.ts (nuevo)
lib/hooks/use-keyboard-shortcuts.ts (nuevo)
app/(dashboard)/backtester/page.tsx
components/backtester/enhanced-candle-viewer.tsx
```

### Build:
✅ npm run build pasa sin errores

---

## Sprint Completado: Dashboard Commands EA MT5 ✅

- **Estado:** `completed`
- **Inicio:** 2026-03-11
- **Fin:** 2026-03-11
- **Archivos:** `mt5/TBSSignalEA.mq5` (v1.3)

### Tareas completadas FASE 4:
- [x] Enum BotState (STATE_RUNNING, STATE_PAUSED)
- [x] Struct HeartbeatResponse (serverTime, command, commandReason, success)
- [x] Variables globales g_botState + g_heartbeatResponse
- [x] ParseHeartbeatResponse() - parsea respuesta del heartbeat
- [x] ExecuteCommand() - ejecuta PAUSE/RESUME/CLOSE_ALL
- [x] ParseBoolField() - helper para parsear booleanos JSON
- [x] SendHeartbeat() modificado para parsear respuesta
- [x] CheckGridLevels() respeta g_botState
- [x] OpenGridLevel() respeta g_botState
- [x] ProcessSingleSignal() respeta g_botState para ENTRY
- [x] CLOSE signal siempre se ejecuta (incluso si pausado)
- [x] CHANGELOG actualizado v1.3

### Validación pendiente:
- [ ] Compilar en MetaEditor (MT5 Windows VPS)
- [ ] Test manual con comando PAUSE
- [ ] Test manual con comando RESUME
- [ ] Test manual con comando CLOSE_ALL

---

## Sprint Completado: Trailing SL Virtual EA MT5 ✅

- **Estado:** `completed`
- **Inicio:** 2026-03-11
- **Fin:** 2026-03-11
- **Archivos:** `mt5/TBSSignalEA.mq5` (v1.2)

### Tareas completadas FASE 1-2:
- [x] LoadRemoteConfig() desde /api/bot/config
- [x] Struct BotConfig con todos los params
- [x] Refresh cada 5 minutos en OnTick()
- [x] Struct GridLevel para trackear niveles
- [x] InitializeGrid() calcula precios de niveles
- [x] OpenGridLevel() abre órdenes con "TBS Grid L0", "TBS Grid L1"...
- [x] CheckGridLevels() detecta cuando toca abrir nuevo nivel
- [x] CloseAllGridLevels() cierra todo el grid
- [x] ProcessSingleSignal() modificado para grid
- [x] SendTradeEvent() actualizado con campo "level"
- [x] ExtractObject() para parsear JSON anidado

### Tareas completadas FASE 3:
- [x] Struct VirtualSL con ticket, entryPrice, virtualSL, highestPrice, lowestPrice
- [x] Variables globales g_virtualSLs[100] + g_virtualSLCount
- [x] FindOrCreateVirtualSL() - busca o crea VirtualSL por ticket
- [x] RemoveVirtualSL() - elimina VirtualSL del array
- [x] UpdateVirtualStops() - lógica principal de trailing:
  - Calcula profitPips por posición
  - Actualiza highestPrice (BUY) / lowestPrice (SELL)
  - Activa trailing cuando profit >= entryTrailingActivate
  - Mueve SL virtual según entryTrailingBack
  - Cierra posición cuando precio toca SL virtual
- [x] Llamada UpdateVirtualStops() en OnTick() después de CheckGridLevels()
- [x] Limpieza de VirtualSLs en CloseAllGridLevels()
- [x] CHANGELOG actualizado v1.2

---

## Sprint Completado: Auditoría Backtester ✅

- **Estado:** `completed`
- **Inicio:** 2026-03-08
- **Fin:** 2026-03-10

### Tareas completadas:
- [x] Dashboard de riesgo → commit `0e4d1fb`
- [x] Bridge Supabase → Backtest → commit `eaf0a27`
- [x] Exportar CSV → commit `5c96572`
- [x] Heatmap rendimiento → commits `a5dfeec`, `b385181`
- [x] Auto-tuning sugerencias → commit `a5dfeec`

---

## Sprint Completado: Auditoría UX/UI Pre-Producción ✅

- **Estado:** `completed`
- **Inicio:** 2026-03-10 11:25
- **Fin:** 2026-03-10 11:30
- **Informe:** `docs/BACKTESTER-AUDIT-2026-03-10.md`

### Tareas completadas:
- [x] Auditoría de código (manual - CC falló por modelo)
- [x] Generar informe con veredicto
- [x] Veredicto: ✅ LISTO PARA PRODUCCIÓN (con reservas P0)

### P0 pendientes (antes de clientes externos):
- [ ] Tooltips y ayuda en settings panel (2-3h)
- [ ] Estados de carga mejorados (2-3h)
- [x] Empty state con CTA (2h) → commit PENDIENTE

**Score final:** 7.6/10 → Aprobado para beta

---

## Archivado

- **MT4 Support** → `docs/MT4-SUPPORT-ARCHIVED.md` (enfoque exclusivo MT5)
