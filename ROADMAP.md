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

### 1.5.1 Capital Inicial y Gestión de Dinero ✅
**Prioridad**: CRÍTICA
**Estado**: COMPLETADO

**Tareas completadas**:
- [x] Campo "Capital inicial" en configuración (ej: 10,000€)
- [x] Calcular profit en dinero real (€) además de pips
- [x] Mostrar % de retorno sobre capital inicial
- [x] Trailing SL Virtual configurable
- [x] Toggle para activar/desactivar Trailing SL

---

### 1.5.2 Detalle de Trades Individuales ✅
**Prioridad**: CRÍTICA
**Estado**: COMPLETADO

**Tareas completadas**:
- [x] Tabla de trades individuales con:
  - [x] Señal original (fecha, precio entrada, dirección)
  - [x] Precio real de entrada (del tick más cercano)
  - [x] Precio de cierre
  - [x] Pips ganados/perdidos
  - [x] Profit en €
  - [x] Razón de cierre (TP, SL, Trailing)
- [x] TradeDetail con info completa por señal

**Pendiente**:
- [ ] Expandir/contraer cada trade para ver niveles
- [ ] Exportar detalle a CSV

---

### 1.5.3 Visualización Gráfica (Tipo MT5) ✅
**Prioridad**: ALTA
**Estado**: COMPLETADO

**Objetivo**: Ver el movimiento del precio y las operaciones como en MT5

**Tareas completadas**:
- [x] Gráfico de velas (candlestick) con datos de ticks
- [x] Marcadores en el gráfico:
  - [x] Flecha de entrada (verde BUY / rojo SELL)
  - [x] Líneas de niveles de promedio (horizontal punteada)
  - [x] Línea de Take Profit (verde)
  - [x] Línea de Stop Loss (rojo) si aplica
  - [x] Marcador de cierre (círculo con X, color según razón)
- [x] Tooltip al pasar por velas/operaciones (OHLC, tiempo, pips)
- [x] Selector de trade para resaltar en gráfico
- [x] Línea conectora de entrada a salida con pips ganados
- [x] Panel de cuenta estilo MT5 (Balance, Equity, Floating P/L, Margin)
- [x] Playback controls con velocidad variable
- [x] Timeframes (M1, M5, M15, H1)

**Pendiente**:
- [ ] Zoom y paneo del gráfico (nice to have)

**Librería utilizada**: Canvas 2D nativo (sin dependencias adicionales)

**UI afectada**:
- Panel "Gráfico" integrado en backtester

---

### 1.5.4 Curva de Equity ✅
**Prioridad**: ALTA
**Estado**: COMPLETADO

**Tareas completadas**:
- [x] Gráfico de línea con equity vs tiempo
- [x] Línea de capital inicial de referencia
- [x] EquityPoint con timestamp para datos históricos

---

### 1.5.5 Métricas Avanzadas ✅
**Prioridad**: MEDIA
**Estado**: COMPLETADO

**Objetivo**: Métricas profesionales de trading

**Tareas completadas**:
- [x] Sharpe Ratio (retorno ajustado al riesgo)
- [x] Sortino Ratio (solo downside risk)
- [x] Calmar Ratio (retorno vs max drawdown)
- [x] Expectancy (ganancia esperada por trade)
- [x] Average win / Average loss
- [x] Max consecutive wins/losses
- [x] Profit factor por mes

---

### 1.5.6 Filtros y Segmentación ✅
**Prioridad**: MEDIA
**Estado**: COMPLETADO

**Objetivo**: Poder analizar por segmentos

**Tareas completadas**:
- [x] Filtro por sesión de trading (Asia, Europa, USA)
- [x] Filtro por día de la semana
- [x] Filtro por dirección (solo BUY / solo SELL)
- [x] Estadísticas de segmentación por sesión, día, dirección
- [x] UI para filtros y visualización de segmentos

---

### 1.5.7 Optimizador de Parámetros ✅
**Prioridad**: ALTA
**Estado**: COMPLETADO

**Objetivo**: Encontrar la mejor configuración automáticamente

**Tareas completadas**:
- [x] Definir rangos de parámetros a optimizar
- [x] Ejecutar múltiples combinaciones
- [x] Ranking de resultados por profit, win rate, sharpe
- [x] Presets: Conservador, Balanceado, Agresivo
- [x] Botón "Usar" para aplicar mejor configuración

---

### 1.5.8 Comparador de Estrategias ✅
**Prioridad**: MEDIA
**Estado**: COMPLETADO

**Objetivo**: Comparar side-by-side diferentes configuraciones

**Tareas completadas**:
- [x] Guardar resultados de backtest en localStorage
- [x] Selector para comparar 2-3 configuraciones
- [x] Tabla comparativa de métricas
- [x] Botones para borrar y gestionar guardados

**Pendiente**:
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

| Feature | Prioridad | Estado |
|---------|-----------|--------|
| Capital inicial | CRÍTICA | ✅ Completado |
| Trailing SL Virtual | CRÍTICA | ✅ Completado |
| Detalle de trades | CRÍTICA | ✅ Completado |
| Curva de equity | ALTA | ✅ Completado |
| Optimizador | ALTA | ✅ Completado |
| Gráfico tipo MT5 | ALTA | ✅ Completado |
| Métricas avanzadas | MEDIA | ✅ Completado |
| Filtros | MEDIA | ✅ Completado |
| Comparador | MEDIA | Pendiente |
| Guardar/Compartir | BAJA | Pendiente |

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

## Fase 6: Bot Cliente y VPS (ACTUAL - Q1 2026)

### 6.1 Paquete de Instalacion ✅
**Prioridad**: CRITICA
**Estado**: COMPLETADO

**Tareas completadas**:
- [x] Script de instalacion automatica (install.ps1)
- [x] Verificacion de requisitos (MT5, Python, RAM, disco)
- [x] Descarga automatica del bot
- [x] Creacion de servicio Windows (auto-arranque)
- [x] Scripts auxiliares (start, stop, status)
- [x] Documentacion para el cliente (README.md)

### 6.2 Landing Page Mejorada ✅
**Prioridad**: ALTA
**Estado**: COMPLETADO

**Tareas completadas**:
- [x] Hero con propuesta de valor clara
- [x] Seccion de seguridad (credenciales nunca salen del VPS)
- [x] Como funciona (4 pasos)
- [x] Requisitos del VPS y proveedores recomendados
- [x] FAQs completas
- [x] CTAs mejorados

---

## Fase 7: Notificaciones Telegram (Q2 2026)

### 7.1 Bot de Notificaciones
**Prioridad**: ALTA
**Dependencias**: Fase 6
**Tiempo estimado**: 5-7 dias

**Objetivo**: Bot de Telegram que envia alertas en tiempo real al cliente.

**Features**:
- [ ] Alertas de operativa:
  - Operacion abierta (con detalles)
  - Operacion cerrada (con P&L)
  - Error del bot
  - Daily Loss Limit alcanzado
  - Kill Switch activado
- [ ] Comandos basicos:
  - `/status` - Estado del bot (online/offline)
  - `/positions` - Posiciones abiertas
  - `/balance` - Balance y equity actual
  - `/stop` - Detener bot (requiere confirmacion)
- [ ] Configuracion por usuario:
  - Activar/desactivar notificaciones
  - Frecuencia de actualizaciones

**Disponible en planes**: Pro (97 EUR) y VIP (197 EUR)

---

## Fase 8: Agente IA de Operativa (Q3-Q4 2026) - FEATURE ESTRELLA

### 8.1 Concepto
**Objetivo**: Agente de IA conversacional en Telegram que actua como asistente personal de trading.

El cliente puede:
- Enviar mensajes de voz o texto
- Recibir asesoramiento personalizado
- Gestionar su operativa conversando

### 8.2 Capacidades del Agente

**Analisis de Operativa**
- [ ] "Como voy esta semana?" - Resumen de rendimiento
- [ ] "Que estrategia me recomiendas?" - Sugerencias basadas en perfil
- [ ] "Analiza mis ultimas operaciones" - Identificar patrones

**Gestion de Riesgo**
- [ ] "Tengo 5000 EUR, que lote me recomiendas?" - Position sizing
- [ ] "Cuanto riesgo estoy asumiendo ahora?" - Analisis de exposicion
- [ ] "Deberia reducir mi exposicion?" - Consejos personalizados

**Soporte y Educativo**
- [ ] Explicar conceptos de trading
- [ ] Responder dudas sobre el bot
- [ ] Guiar en configuracion de parametros
- [ ] Alertas educativas cuando detecta errores comunes

**Configuracion del Bot**
- [ ] "Cambia mi lote a 0.05" - Modificar parametros via chat
- [ ] "Activa el Daily Loss Limit al 3%" - Ajustar protecciones
- [ ] "Pon 4 niveles maximos" - Cambiar grid

### 8.3 Stack Tecnico Sugerido
- OpenAI GPT-4o para conversacion
- Whisper para speech-to-text
- LangChain para orquestacion
- Vector DB para contexto del cliente

### 8.4 Seguridad
- [ ] No exponer datos sensibles en prompts
- [ ] Anonimizar datos para el modelo
- [ ] Auditoria de conversaciones
- [ ] Rate limiting por plan

**Disponible en plan**: VIP (197 EUR) - Diferencial competitivo

---

## Features por Plan (Actualizado 2026-02-27)

| Feature | Trader (57 EUR) | Pro (97 EUR) | VIP (197 EUR) |
|---------|-----------------|--------------|---------------|
| Dashboard completo | Si | Si | Si |
| Bot MT5 | 1 cuenta | 3 cuentas | Ilimitadas |
| Backtester avanzado | Si | Si | Si |
| Daily Loss Limit | Si | Si | Si |
| Kill Switch | Si | Si | Si |
| Instalacion VPS guiada | Si | Si | Si |
| Soporte email | Si | Si | Si |
| Telegram notificaciones | No | Si | Si |
| Analytics Pro | No | Si | Si |
| **Agente IA de Operativa** | No | No | **Si** |
| Soporte prioritario | No | No | Si |
| Canal VIP con Xisco | No | No | Si |
| Onboarding asistido | No | No | Si |

---

## Timeline Visual Actualizado

```
2026 Q1  [======Fase 1-6======] MVP + Bot Cliente + Landing
2026 Q2            [======Fase 7======] Telegram Notificaciones
2026 Q3-Q4                   [========Fase 8========] Agente IA
2027+                                    [====Fase 4-5====] Expansion
```

---

## Metricas de Exito

### Fase 6 (Actual)
- [ ] 10 clientes activos
- [ ] <1% downtime del bot
- [ ] Tiempo de instalacion <30 min

### Fase 7
- [ ] 50 clientes activos
- [ ] 80% adoption Telegram bot
- [ ] NPS >50

### Fase 8
- [ ] 100 clientes activos
- [ ] 30% clientes en plan VIP
- [ ] 5+ interacciones/semana con agente IA

---

*Documento creado: 2026-02-19*
*Ultima actualizacion: 2026-02-27*
