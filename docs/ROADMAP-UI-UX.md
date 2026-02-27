# Roadmap UI/UX - Trading Bot SaaS

**Generado:** 27 Feb 2025
**Estado:** Análisis completado con Playwright + AI Vision

---

## Resumen Ejecutivo

El backtester NO está listo para clientes. Se requieren mejoras críticas antes de lanzamiento.

| Página | Estado | Prioridad |
|--------|--------|-----------|
| Backtester | 🔴 No listo | P0 |
| Marketplace/Operativas | 🔴 Bug crítico (loading infinito) | P0 |
| Dashboard | 🟡 Parcialmente listo | P1 |
| Bot Monitor | 🟡 Incompleto | P1 |
| Settings | 🟢 Funcional con mejoras | P2 |
| Login/Register | 🟢 Funcional | P2 |
| Pricing | 🟢 Funcional | P3 |
| Home | 🟢 Funcional | P3 |

---

## P0 - CRÍTICO (Antes de clientes)

### 1. Backtester - Tooltips y Ayuda

**Problema:** Los parámetros no tienen explicación. Traders nuevos no entienden qué hace cada campo.

**Solución:**
- [ ] Añadir tooltips con explicaciones para cada parámetro:
  - Grid Spacing: "Distancia en pips entre cada nivel del grid"
  - Max Levels: "Número máximo de niveles de compra/venta"
  - Take Profit: "Ganancia objetivo en pips"
  - Stop Loss: "Pérdida máxima aceptada en pips"
  - Trailing SL: "Stop loss que se mueve con el precio"
  - Capital: "Capital inicial para la simulación"
- [ ] Añadir sección "Ayuda" o icono (?) en cada grupo de parámetros
- [ ] Crear presets de configuraciones comunes (Conservative, Moderate, Aggressive)

**Archivos:** `app/(dashboard)/backtester/page.tsx`, `components/backtester/`

---

### 2. Backtester - Estados de Carga

**Problema:** No hay feedback visual cuando se ejecuta un backtest.

**Solución:**
- [ ] Añadir spinner/progress bar durante ejecución
- [ ] Mostrar progreso estimado (ej: "Procesando 2.4M de 70M ticks...")
- [ ] Botón "Ejecutar Backtest" cambiar a estado loading
- [ ] Deshabilitar controles durante ejecución

**Archivos:** `app/(dashboard)/backtester/page.tsx`

---

### 3. Backtester - Empty State Mejorado

**Problema:** "Sin resultados" es pasivo y no guía al usuario.

**Solución:**
- [ ] Cambiar mensaje a: "Configura los parámetros y ejecuta tu primer backtest"
- [ ] Añadir botón CTA "Ejecutar Backtest" más visible
- [ ] Mostrar ilustración o icono de chart
- [ ] Añadir "Quick Start" con valores por defecto

**Archivos:** `app/(dashboard)/backtester/page.tsx`

---

### 4. Marketplace - Fix Loading Infinito

**Problema:** La página /operativas queda en estado de carga infinito.

**Investigar:**
- [ ] Verificar endpoint de tRPC para operativas
- [ ] Comprobar si hay datos en la base de datos
- [ ] Añadir timeout y error handling
- [ ] Implementar skeleton loading

**Archivos:** `app/(dashboard)/operativas/page.tsx`, `server/api/trpc/routers/`

---

## P1 - IMPORTANTE (Mejora de experiencia)

### 5. Dashboard - Empty States

**Problema:** Los empty states son genéricos y no invitan a la acción.

**Solución:**
- [ ] "Top Operativos" vacío → añadir "Crear mi primera operativa"
- [ ] "Win Rate --" → añadir tooltip explicando qué datos se necesitan
- [ ] "Bot Status: Inactivo" → añadir botón "Activar Bot"
- [ ] "Tips para Empezar" → hacerlo más visual con iconos y numeración

**Archivos:** `app/(dashboard)/dashboard/page.tsx`

---

### 6. Bot Monitor - Controles Críticos

**Problema:** No hay controles para iniciar/detener el bot.

**Solución:**
- [ ] Añadir indicador global de estado (Running/Paused/Error)
- [ ] Añadir botones: Start, Stop, Pause
- [ ] Mostrar timestamp "Última actualización: hace 2 min"
- [ ] Añadir métricas en tiempo real (P&L, posiciones abiertas)
- [ ] Badge "Live" para confirmar datos en vivo

**Archivos:** `app/(dashboard)/bot/page.tsx`

---

### 7. Backtester - Visualización de Grid

**Problema:** No hay preview de cómo se verá la estrategia.

**Solución:**
- [ ] Añadir mini-preview del grid antes de ejecutar
- [ ] Mostrar niveles de compra/venta en mini-chart
- [ ] Calcular y mostrar riesgo estimado

**Archivos:** Nuevo componente `components/backtester/grid-preview.tsx`

---

## P2 - MEJORAS DE POLISH

### 8. Settings - Mejoras de Formulario

- [ ] Añadir validación en tiempo real
- [ ] Indicadores de campos requeridos (*)
- [ ] Mensajes de éxito/error al guardar
- [ ] Reordenar secciones: Suscripción → Cuentas → Perfil
- [ ] Consistencia en estilos de botones

### 9. Global - Accesibilidad

- [ ] Añadir focus states para navegación por teclado
- [ ] Mejorar contraste en textos secundarios
- [ ] Añadir alt text a imágenes decorativas
- [ ] Consistencia en colores de estados (success/error/warning)

### 10. Global - Consistencia Visual

- [ ] Unificar estilos de botones (rounded vs rectangular)
- [ ] Consistencia en padding/margins entre secciones
- [ ] Colores de botones primarios vs secundarios

---

## P3 - FUTURE ENHANCEMENTS

### 11. Backtester - Features Avanzadas

- [ ] Exportar resultados a PDF/CSV
- [ ] Comparar múltiples backtests
- [ ] Historial de backtests ejecutados
- [ ] Compartir configuración via URL

### 12. Dashboard - Widget System

- [ ] Widgets personalizables
- [ ] Drag & drop para reordenar
- [ ] Más métricas y KPIs

### 13. Dark Mode

- [ ] Implementar tema oscuro completo
- [ ] Toggle en navbar

---

## Métricas de Éxito

| Métrica | Target |
|---------|--------|
| Tiempo para primer backtest exitoso | < 2 min |
| Tasa de abandono en backtester | < 30% |
| Errores de usuario en configuración | < 5% |
| NPS score | > 40 |

---

## Próximos Pasos Inmediatos

1. **HOY:** Implementar tooltips en backtester
2. **HOY:** Implementar estados de carga en backtester
3. **HOY:** Fix loading infinito en marketplace
4. **MAÑANA:** Empty states mejorados en dashboard
5. **MAÑANA:** Controles Start/Stop en Bot Monitor

---

*Documento generado automáticamente por análisis UI/UX con Claude Code*
