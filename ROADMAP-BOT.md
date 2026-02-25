# Roadmap - Bot de Operativa SaaS

> Estado: 2026-02-25
> Objetivo: Sistema completo para que clientes operen automáticamente siguiendo señales de Telegram

---

## FASE 1: Fundamentos ✅ COMPLETADA

| Feature | Estado | Commit |
|---------|--------|--------|
| Bot Python MT5 | ✅ | f0cf583 |
| Ingestor Telegram | ✅ | 25011fb |
| API del SaaS (auth, signals, heartbeat) | ✅ | b679392 |
| Provisioning VPS | ✅ | f8b5c58 |
| Página Setup con descarga scripts | ✅ | 4c48efa |
| Dashboard con estado del bot | ✅ | 78c3bd6 |

---

## FASE 2: Configuración desde el SaaS ✅ COMPLETADA

### 2.1 Página de Configuración del Bot ✅ COMPLETADO
**Prioridad:** ALTA
**Commit:** 28b9e5b, a3ad7ec

**Tasks:**
- [x] Página `/settings` con formulario de configuración
- [x] API `GET/PUT /api/bot/settings` para usuarios autenticados
- [x] Bot lee config del SaaS al iniciar y cada 60 segundos
- [x] Validación de límites según plan

**Campos configurables:**
- lotSize: 0.01 - 1.0
- maxLevels: 1 - 5 (limitado por plan)
- gridDistance: 5 - 100 pips
- takeProfit: 5 - 200 pips
- trailingActivate/Step/Back (solo si plan lo permite)
- defaultRestriction: null, RIESGO, SIN_PROMEDIOS, SOLO_1_PROMEDIO

### 2.2 Estado Detallado del Bot ✅ COMPLETADO
**Prioridad:** MEDIA
**Commit:** 4679c25

**Tasks completadas:**
- [x] API `/api/bot/status` con info completa
- [x] Mostrar posiciones abiertas en dashboard
- [x] Métricas en tiempo real
- [x] Auto-refresh cada 10 segundos
- [x] Link a config y backtester

---

## FASE 2.5: Sistema de Seguridad ✅ COMPLETADO
**Prioridad:** CRÍTICA
**Commits:** c10f0fd, 11bb213, 33c2d22

### 2.5.1 Diseño y Documentación ✅
- [x] Documento de diseño (docs/SECURITY_DESIGN.md)
- [x] Definición de estados de API key (ACTIVE, PAUSED, REVOKED, EXPIRED)
- [x] Rate limits por endpoint
- [x] Flujo de validación

### 2.5.2 Implementación Backend ✅
- [x] Schema Prisma con campos de seguridad
- [x] Modelos: ApiKeyAudit, SecurityEvent
- [x] lib/security/api-key.ts - Generación, hash, validación
- [x] lib/security/auth-middleware.ts - Middleware de autenticación
- [x] Rate limiting por endpoint
- [x] Logs de auditoría

### 2.5.3 Endpoints Protegidos ✅
- [x] /api/bot/auth - Autenticación inicial
- [x] /api/bot/signals - Con middleware
- [x] /api/bot/heartbeat - Con middleware
- [x] /api/bot/config - Con middleware
- [x] /api/bot/apikey - Gestión de keys (rotación, revocación)

### 2.5.4 Bot Python Robusto ✅
- [x] Manejo de errores HTTP (401, 403, 429)
- [x] Backoff automático en rate limit
- [x] Detención graceful en errores críticos
- [x] Comandos remotos (STOP, RESTART)

---

## FASE 3: Monitoreo y Alertas ⏳ SIGUIENTE

### 3.1 Logs del Bot en Tiempo Real
**Prioridad:** MEDIA

**Tasks:**
- [ ] Bot envía logs al SaaS
- [ ] WebSocket para streaming de logs
- [ ] Página `/logs` para ver en tiempo real
- [ ] Filtros por nivel (info, warning, error)

### 3.2 Alertas
**Prioridad:** MEDIA

**Tasks:**
- [ ] Notificaciones cuando bot se desconecta
- [ ] Alertas de drawdown alto
- [ ] Email cuando hay errores críticos
- [ ] Integración con Telegram del usuario

---

## FASE 4: Multi-Tenant y Pagos

### 4.1 Planes y Límites ✅ COMPLETADO
**Prioridad:** ALTA (para monetizar)
**Commit:** e189f32+

**Tasks completadas:**
- [x] Model Plan en Prisma con límites
- [x] Seed de planes (Basic, Pro, Enterprise)
- [x] lib/plans.ts - funciones de verificación de límites
- [x] Middleware para verificar límites en settings
- [x] Bloquear features según plan
- [x] Página /pricing para upgrade/downgrade
- [x] API /api/plans para listar y cambiar planes

**Planes implementados:**
| Plan | Precio | Max niveles | Max posiciones | Soporte |
|------|--------|-------------|----------------|---------|
| Basic | $49/mes | 2 | 1 | Email |
| Pro | $99/mes | 4 | 3 | Priority |
| Enterprise | $249/mes | 10 | 10 | Dedicado |

### 4.2 Integración Stripe
**Prioridad:** ALTA

**Tasks:**
- [ ] Productos y precios en Stripe
- [ ] Checkout para suscripción
- [ ] Webhooks para eventos de pago
- [ ] Gestión de suscripciones

---

## FASE 5: Mejoras del Bot

### 5.1 Soporte MT4
**Prioridad:** MEDIA

**Tasks:**
- [ ] Adaptar bot para MT4
- [ ] Detectar versión instalada automáticamente
- [ ] Documentación específica MT4

### 5.2 Modo Paper Trading
**Prioridad:** BAJA

**Tasks:**
- [ ] Flag para modo simulación
- [ ] No ejecutar órdenes reales
- [ ] Tracking de P&L virtual
- [ ] Útil para testing antes de operar real

### 5.3 Multi-Símbolo
**Prioridad:** BAJA

**Tasks:**
- [ ] Soportar otros pares además de XAUUSD
- [ ] Configuración por símbolo
- [ ] Distribución de capital

---

## FASE 6: Testing y Producción

### 6.1 Tests
**Prioridad:** MEDIA

**Tasks:**
- [ ] Tests unitarios del bot
- [ ] Tests de integración API
- [ ] Tests E2E del flujo completo
- [ ] CI/CD con GitHub Actions

### 6.2 Deploy
**Prioridad:** ALTA

**Tasks:**
- [ ] Configurar VPS de producción
- [ ] Dominio y SSL
- [ ] Monitoreo con Uptime Robot
- [ ] Backups automáticos

---

## Orden de Implementación (Próximas Sessions)

1. **Settings Page** - Configuración del bot desde web
2. **API Config** - Endpoints para leer/guardar config
3. **Bot lee config del SaaS** - Sincronización
4. **Estado detallado** - Posiciones y métricas
5. **Planes y límites** - Modelos y middleware
6. **Stripe** - Pagos
7. **Deploy** - Producción

---

## Notas para Claude

- **Siempre hacer commit** después de cada feature
- **Push a GitHub** al terminar cada sesión
- **Actualizar este archivo** cuando se complete algo
- **Un feature = un commit** (o varios si es grande)
- **Mensajes en español** en commits
