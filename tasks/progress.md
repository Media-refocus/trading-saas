# TBS - Progress Tracker

_Última actualización: 2026-03-10_

## Sprint Actual: Auditoría Backtester

- **Estado:** `in-progress`
- **Inicio:** 2026-03-08
- **Fuente:** Auditoría completa por Vegeta, propuestas de mejora UI/UX

---

## Tareas

### Completadas ✅

- [x] **Dashboard de riesgo** → commit `0e4d1fb`
  - Cálculo de exposición máxima, pérdida potencial, margen requerido
  - Badges de riesgo (verde/amarillo/naranja/rojo)
  - Alertas: exposición >€5000, margin call risk, pérdidas ilimitadas
  - Validaciones ANTES de ejecutar backtest

- [x] **Bridge Supabase → Backtest** → commit `eaf0a27`
  - Toggle UI para cambiar fuente: CSV vs Supabase
  - Cargar señales de tabla Signal en Supabase con rango de fechas
  - Validación: si no hay señales → mensaje claro
  - CSV sigue como fallback para tests locales
  - Mantiene filtros por tenant (seguridad multi-tenant)

- [x] **Exportar CSV** → commit `5c96572`
  - Botón "Export CSV" en deals table toolbar
  - Excel-compatible CSV export

- [x] **Heatmap rendimiento** → commit `pending`
  - Componente `PerformanceHeatmap` con 3 vistas: Day/Session/Month
  - Colores por intensidad de win rate (rojo→amarillo→verde)
  - Tooltips con detalles: win rate, trades, wins/losses, profit
  - Integrado en panel de resultados del backtester
  - Sesiones UTC: Asia (00-08), Europe (08-16), USA (16-24)

---

### Pendientes 🔴

- [ ] **Auto-tuning sugerencias** → **NEXT**

- [ ] **Auto-tuning sugerencias**
  - Analizar histórico de backtests del usuario
  - Sugerir configs basadas en métricas pasadas
  - Mostrar recomendaciones en panel de configuración
  - Botón "Aplicar configuración recomendada"

---

## Próximos pasos

1. **Auto-tuning sugerencias** (prioridad media - UX mejorada)

---

## Referencias

- ROADMAP.md → visión general del proyecto
- docs/ROADMAP-UI-UX.md → auditoría UI/UX completa
- components/backtester/ → componentes del backtester
