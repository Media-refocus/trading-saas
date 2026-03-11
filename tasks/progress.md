# TBS - Progress Tracker

_Última actualización: 2026-03-11 (Dashboard Commands - FASE 4)_

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
