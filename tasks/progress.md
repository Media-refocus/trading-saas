# TBS - Progress Tracker

_Última actualización: 2026-03-10 (heatmap integrado)_

## Sprint Actual: Auditoría Backtester

- **Estado:** `completed`
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

- [x] **Heatmap rendimiento** → commits `a5dfeec`, `b385181`
  - Componente `PerformanceHeatmap` + `SegmentationHeatmap` con 3 vistas: Day/Session/Month
  - Colores por intensidad de win rate (rojo=pérdida → amarillo=neutral → verde=profit)
  - Tooltips con detalles: win rate, trades, wins/losses, profit
  - Integrado en backtester page usando datos de segmentación pre-calculados
  - Sesiones UTC: Asia (00-08), Europe (08-16), USA (16-24)
  - Exportado en `components/backtester/index.ts`

- [x] **Auto-tuning sugerencias** → commit `a5dfeec`
  - Componente `AutoTuningSuggestions` con Top 3 configs
  - Score compuesto: Win Rate (35%) + Profit Factor (35%) + Sharpe Ratio (30%)
  - Análisis de backtests históricos agrupados por config
  - Botón "Apply" con one-click para aplicar configuración
  - Badge de consistencia (número de backtests con misma config)
  - Métricas visuales: Win Rate, Profit Factor, Sharpe Ratio
  - Integrado en panel de configuración del backtester
  - **Verified:** 2026-03-10 - Feature fully functional (frontend + backend + integration)

---

### Pendientes 🔴

- [ ] **Performance optimization** (opcional)
  - Cachear resultados de auto-tuning
  - Lazy loading del componente

---

## Próximos pasos

1. **Sprint complete** - Auditoría backtester finalizada

---

## Referencias

- ROADMAP.md → visión general del proyecto
- docs/ROADMAP-UI-UX.md → auditoría UI/UX completa
- components/backtester/ → componentes del backtester
