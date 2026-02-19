# Roadmap de Escalado - Trading Bot SaaS

> Este documento guía el desarrollo autónomo de features de escalado. Cada sección tiene prioridad, dependencias y criterios de completitud.

---

## Estado Actual (MVP)

- **Arquitectura**: Next.js + tRPC + Prisma + SQLite
- **Backtesting**: En desarrollo - migrando a SQLite como cache de disco
- **Usuarios**: Preparado para primeros clientes beta

---

## Fase 1: Optimización de Backtesting (COMPLETADA)

### 1.1 Cache de Ticks en SQLite ✅
**Estado**: COMPLETADO
- 116M de ticks migrados a SQLite
- Memoria: ~50MB (vs ~2GB+ antes)
- Arranque instantáneo

---

## Fase 1.5: Backtester "La Herramienta Definitiva" (ACTUAL)

### 1.5.1 Capital Inicial y Gestión de Dinero
**Prioridad**: CRÍTICA
**Tiempo estimado**: 1 día

**Problema actual**: El backtest no muestra con qué capital trabaja ni el profit real en €/$

**Tareas**:
- [ ] Campo "Capital inicial" en configuración (ej: 10,000€)
- [ ] Calcular profit en dinero real (€) además de pips
- [ ] Mostrar % de retorno sobre capital inicial
- [ ] Risk per trade (ej: 1% del capital por operación)
- [ ] Posición sizing automático basado en riesgo

**UI afectada**:
- Formulario de configuración
- Panel de resultados

---

### 1.5.2 Detalle de Trades Individuales
**Prioridad**: CRÍTICA
**Tiempo estimado**: 1-2 días

**Problema actual**: No se puede ver CÓMO se calculan los resultados, el usuario está "a ciegas"

**Tareas**:
- [ ] Tabla de trades individuales con:
  - [ ] Señal original (fecha, precio entrada, dirección)
  - [ ] Precio real de entrada (del tick más cercano)
  - [ ] Niveles de promedio abiertos (precio, lote, nivel)
  - [ ] Precio promedio ponderado
  - [ ] Precio de cierre
  - [ ] Pips ganados/perdidos
  - [ ] Profit en €
  - [ ] Duración de la operación
- [ ] Expandir/contraer cada trade para ver detalle
- [ ] Exportar detalle a CSV

**UI afectada**:
- Nuevo panel "Detalle de trades" debajo del resumen

---

### 1.5.3 Visualización Gráfica (Tipo MT5)
**Prioridad**: ALTA
**Tiempo estimado**: 3-4 días

**Objetivo**: Ver el movimiento del precio y las operaciones como en MT5

**Tareas**:
- [ ] Gráfico de velas (candlestick) con datos de ticks
- [ ] Marcadores en el gráfico:
  - [ ] Flecha de entrada (verde BUY / rojo SELL)
  - [ ] Líneas de niveles de promedio (horizontal punteada)
  - [ ] Línea de Take Profit (verde)
  - [ ] Línea de Stop Loss (rojo) si aplica
  - [ ] Marcador de cierre
- [ ] Zoom y paneo del gráfico
- [ ] Tooltip al pasar por velas/operaciones
- [ ] Selector de trade para resaltar en gráfico

**Librerías candidatas**:
- Lightweight Charts (TradingView) - recomendado
- Recharts
- Plotly

**UI afectada**:
- Nuevo panel "Gráfico" con tabs por cada trade

---

### 1.5.4 Curva de Equity
**Prioridad**: ALTA
**Tiempo estimado**: 1 día

**Objetivo**: Ver la evolución del balance durante el backtest

**Tareas**:
- [ ] Gráfico de línea con equity vs tiempo
- [ ] Marcar drawdowns máximos
- [ ] Línea de capital inicial de referencia
- [ ] Hover para ver valor en cada punto

---

### 1.5.5 Métricas Avanzadas
**Prioridad**: MEDIA
**Tiempo estimado**: 1 día

**Objetivo**: Métricas profesionales de trading

**Tareas**:
- [ ] Sharpe Ratio (retorno ajustado al riesgo)
- [ ] Sortino Ratio (solo downside risk)
- [ ] Calmar Ratio (retorno vs max drawdown)
- [ ] Expectancy (ganancia esperada por trade)
- [ ] Average win / Average loss
- [ ] Max consecutive wins/losses
- [ ] Profit factor por mes/trimestre

---

### 1.5.6 Filtros y Segmentación
**Prioridad**: MEDIA
**Tiempo estimado**: 1-2 días

**Objetivo**: Poder analizar por segmentos

**Tareas**:
- [ ] Filtro por rango de fechas (from/to)
- [ ] Filtro por día de la semana (lunes vs viernes)
- [ ] Filtro por hora del día (sesión asiática, europea, USA)
- [ ] Filtro por dirección (solo BUY / solo SELL)
- [ ] Comparar rendimiento por segmentos

---

### 1.5.7 Optimizador de Parámetros
**Prioridad**: ALTA
**Tiempo estimado**: 2-3 días

**Objetivo**: Encontrar la mejor configuración automáticamente

**Tareas**:
- [ ] Definir rangos de parámetros a optimizar:
  - [ ] Pips distancia: 5-20
  - [ ] Max niveles: 1-8
  - [ ] Take profit: 10-40
- [ ] Ejecutar múltiples combinaciones
- [ ] Ranking de resultados por:
  - [ ] Mayor profit total
  - [ ] Mayor win rate
  - [ ] Mejor profit factor
  - [ ] Menor drawdown
- [ ] Guardar mejores configuraciones
- [ ] "Usar esta configuración" con un click

---

### 1.5.8 Comparador de Estrategias
**Prioridad**: MEDIA
**Tiempo estimado**: 1-2 días

**Objetivo**: Comparar side-by-side diferentes configuraciones

**Tareas**:
- [ ] Guardar resultados de backtest
- [ ] Selector para comparar 2-3 configuraciones
- [ ] Tabla comparativa de métricas
- [ ] Gráfico superpuesto de equity curves
- [ ] Exportar comparación a PDF

---

### 1.5.9 Guardar y Compartir
**Prioridad**: BAJA
**Tiempo estimado**: 1 día

**Tareas**:
- [ ] Guardar configuraciones de estrategia (mis estrategias)
- [ ] Guardar resultados de backtests históricos
- [ ] Generar link compartible de resultado
- [ ] Exportar a PDF/Excel con branding

---

## Resumen de Prioridades

| Feature | Prioridad | Impacto |
|---------|-----------|---------|
| Capital inicial | CRÍTICA | Saber cuánto dinero real |
| Detalle de trades | CRÍTICA | Transparencia total |
| Gráfico tipo MT5 | ALTA | Visualización profesional |
| Curva de equity | ALTA | Ver evolución del balance |
| Optimizador | ALTA | Encontrar mejor config |
| Métricas avanzadas | MEDIA | Análisis profesional |
| Filtros | MEDIA | Segmentar análisis |
| Comparador | MEDIA | A/B testing de configs |
| Guardar/Compartir | BAJA | UX y colaboración |

---

## Fase 2: Preparación para Producción

### 2.1 Autenticación Robusta
**Prioridad**: ALTA
**Dependencias**: Ninguna
**Tiempo estimado**: 2-3 días

**Tareas**:
- [ ] Implementar Clerk o Auth.js
- [ ] Middleware de rutas protegidas
- [ ] Gestión de roles (admin, user)
- [ ] Página de perfil y configuración

### 2.2 Base de Datos Producción (PostgreSQL)
**Prioridad**: ALTA
**Dependencias**: 2.1
**Tiempo estimado**: 1 día

**Tareas**:
- [ ] Migrar Prisma a PostgreSQL (Supabase/Railway)
- [ ] Configurar connection pooling
- [ ] Backups automáticos
- [ ] Variables de entorno por ambiente

### 2.3 Pagos con Stripe
**Prioridad**: ALTA
**Dependencias**: 2.1
**Tiempo estimado**: 3-4 días

**Tareas**:
- [ ] Integrar Stripe Checkout
- [ ] Webhooks para eventos de pago
- [ ] Gestión de suscripciones
- [ ] Página de pricing
- [ ] Límites por plan (señales, backtests/mes)

---

## Fase 3: Escalado de Backtesting

### 3.1 TimescaleDB para Datos Temporales
**Prioridad**: MEDIA
**Dependencias**: Fase 2 completa
**Tiempo estimado**: 4-5 días

**Objetivo**: Migrar ticks a TimescaleDB (PostgreSQL + extensión temporal) para consultas ultra rápidas.

**Por qué TimescaleDB**:
- Optimizado para datos temporales (time-series)
- Consultas de rangos de fechas 10-100x más rápidas
- Compresión automática de datos antiguos
- Usado por empresas de trading e IoT

**Tareas**:
- [ ] Configurar TimescaleDB en Supabase/Railway
- [ ] Crear hypertable para ticks
- [ ] Políticas de compresión (ticks >6 meses comprimidos)
- [ ] Migrar datos existentes
- [ ] Queries optimizadas con `time_bucket`

**Archivos afectados**:
- `prisma/schema.prisma` (modificar para TimescaleDB)
- `lib/ticks-db.ts` (queries con time_bucket)
- `scripts/setup-timescaledb.ts` (nuevo)

**Comandos SQL clave**:
```sql
-- Crear hypertable
SELECT create_hypertable('ticks', by_range('timestamp', INTERVAL '1 day'));

-- Query optimizada
SELECT time_bucket('1 minute', timestamp) AS bucket,
       first(price, timestamp) AS open,
       max(price) AS high,
       min(price) AS low,
       last(price, timestamp) AS close
FROM ticks
WHERE timestamp BETWEEN '2024-01-01' AND '2024-01-31'
GROUP BY bucket;
```

### 3.2 Microservicio de Backtesting
**Prioridad**: BAJA (solo si hay muchos usuarios)
**Dependencias**: 3.1
**Tiempo estimado**: 5-7 días

**Objetivo**: Separar el backtesting a un servicio dedicado para no afectar el servidor web.

**Arquitectura**:
```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   SaaS Web  │────▶│  Cola de Jobs    │────▶│  Worker de  │
│  (Next.js)  │     │  (Redis/BullMQ)  │     │ Backtesting │
└─────────────┘     └──────────────────┘     └─────────────┘
                            │                        │
                            ▼                        ▼
                    ┌─────────────┐          ┌─────────────┐
                    │  PostgreSQL │          │ TimescaleDB │
                    │  (usuarios) │          │   (ticks)   │
                    └─────────────┘          └─────────────┘
```

**Tareas**:
- [ ] Configurar Redis (Upstash)
- [ ] Implementar BullMQ para cola de jobs
- [ ] Crear worker independiente (Node.js/Python)
- [ ] WebSockets para progreso en tiempo real
- [ ] Escalar workers horizontalmente

**Archivos nuevos**:
- `workers/backtester/` - Servicio de backtesting
- `lib/queue.ts` - Gestión de colas
- `lib/websocket.ts` - Notificaciones en tiempo real

### 3.3 ClickHouse para Big Data
**Prioridad**: MUY BAJA (solo si hay millones de usuarios)
**Dependencias**: 3.2
**Tiempo estimado**: 7-10 días

**Objetivo**: ClickHouse para análisis de datos masivos (>100M ticks).

**Por qué ClickHouse**:
- Consultas OLAP extremadamente rápidas
- Compresión 10:1 de datos
- Usado por Cloudflare, Uber, Spotify
- Ideal para analytics y reporting

**Tareas**:
- [ ] Configurar ClickHouse (ClickHouse Cloud)
- [ ] Pipeline de ingesta de ticks
- [ ] Queries analíticas para dashboards
- [ ] Materialized views para métricas precalculadas

---

## Fase 4: Features Avanzadas

### 4.1 Backtesting en la Nube
**Prioridad**: MEDIA
**Dependencias**: Fase 2 completa
**Tiempo estimado**: 3-4 días

**Tareas**:
- [ ] Almacenar señales en la nube (no solo CSV local)
- [ ] Historial de backtests por usuario
- [ ] Comparar múltiples estrategias
- [ ] Exportar resultados (PDF, Excel)

### 4.2 Paper Trading
**Prioridad**: MEDIA
**Dependencias**: 4.1
**Tiempo estimado**: 5-7 días

**Objetivo**: Simular operaciones en tiempo real sin dinero real.

**Tareas**:
- [ ] Conexión a APIs de brokers (OANDA, MT5)
- [ ] Ejecución simulada de señales
- [ ] Tracking de P&L en tiempo real
- [ ] Alertas y notificaciones

### 4.3 Trading Real
**Prioridad**: ALTA (pero requiere regulación)
**Dependencias**: 4.2 validado exhaustivamente
**Tiempo estimado**: 10-15 días

**⚠️ IMPORTANTE**: Requiere cumplimiento regulatorio según jurisdicción.

**Tareas**:
- [ ] Integración con brokers (OANDA, Interactive Brokers)
- [ ] Gestión de riesgo (stop loss, position sizing)
- [ ] Logs auditables
- [ ] Kills switches de emergencia

---

## Fase 5: Crecimiento

### 5.1 Multi-idioma
**Prioridad**: BAJA
**Tiempo estimado**: 2-3 días

- [ ] i18n con next-intl
- [ ] Español, Inglés, Portugués

### 5.2 API Pública
**Prioridad**: MEDIA
**Tiempo estimado**: 3-4 días

- [ ] REST API documentada (OpenAPI)
- [ ] API Keys para usuarios
- [ ] Rate limiting
- [ ] Webhooks para eventos

### 5.3 Programa de Afiliados
**Prioridad**: BAJA
**Tiempo estimado**: 2-3 días

- [ ] Sistema de referidos
- [ ] Comisiones automáticas
- [ ] Dashboard de afiliados

---

## Notas para Agentes de IA

### Cómo usar este documento:

1. **Leer antes de empezar**: Verifica las dependencias de la feature
2. **Seguir el orden**: Las fases están ordenadas por prioridad
3. **Actualizar checkboxes**: Marca tareas completadas
4. **Documentar decisiones**: Si cambias algo, actualiza este archivo

### Convenciones:
- Las prioridades son: CRÍTICA > ALTA > MEDIA > BAJA
- Los tiempos son estimaciones para un agente trabajando solo
- Siempre hacer commit después de cada tarea completada
- Tests obligatorios antes de marcar como completado

### Comandos útiles:
```bash
# Ejecutar tests
npm run test

# Verificar tipos
npx tsc --noEmit

# Migraciones de BD
npx prisma migrate dev

# Build de producción
npm run build
```

---

*Documento creado: 2026-02-19*
*Última actualización: 2026-02-19*
