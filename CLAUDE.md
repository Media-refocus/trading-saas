# Trading Bot SaaS — CLAUDE.md

## Project Overview
SaaS multi-tenant que automatiza señales de trading XAUUSD desde Telegram → MetaTrader 5.
Incluye backtester web, bot de operativa, provisioning de VPS, y dashboard.

## Stack
- **Frontend:** Next.js 15 + TypeScript + Tailwind + shadcn/ui + lightweight-charts
- **Backend:** tRPC v11 + Next.js API Routes + Prisma ORM
- **DB:** SQLite (multi-tenant con tenantId)
- **Auth:** NextAuth.js v5 beta
- **Payments:** Stripe
- **Bot:** Python (VPS Windows cliente, conecta via API REST)

## Agent Team

| Agent | Role | When to invoke |
|-------|------|----------------|
| `trading-architect` | Arquitectura, schema DB, decisiones de diseño | Antes de cambios estructurales |
| `trading-backend` | tRPC routers, Prisma, API, bot integration | Features de backend |
| `trading-frontend` | Dashboard, UI, charts, componentes | Features de frontend |
| `trading-devops` | Provisioning, scripts, deploy, monitoring | Infra y deploy |
| `trading-qa` | Tests, security audit, code review, trading logic | Después de cada feature |

### Team workflow
1. **Architect** diseña el approach y schema
2. **Backend** implementa API + DB
3. **Frontend** implementa UI
4. **DevOps** si toca infra/provisioning
5. **QA** revisa SIEMPRE al final — security + correctness + edge cases

### Critical rule for QA
QA agent MUST run after every significant feature. This is a **financial application** — bugs = real money lost.

## Project Structure
```
app/(auth)/           — Login, Register
app/(dashboard)/      — Dashboard, Backtester, Settings, Setup
app/api/bot/          — Bot REST endpoints (heartbeat, config, signals, status)
app/api/signals/      — Signal ingestion from Telegram
components/           — UI components (backtester/, ui/)
lib/                  — Core logic (backtest-engine, ticks-cache, parsers)
server/api/trpc/      — tRPC server (routers: backtester, auth, tenant, strategies)
prisma/               — Schema + migrations
operative/            — Trading strategies configs + analysis
provisioning/         — VPS setup scripts (Windows + Linux)
docs/                 — Analysis, historical data, guides
```

## Key branches
- `master` — stable
- `feature/bot-operativa` — bot Python + provisioning + dashboard updates

## Multi-tenant rules
- EVERY DB query MUST filter by `tenantId`
- EVERY API endpoint MUST verify tenant ownership
- Bot API endpoints validate per-tenant API key
- Data NEVER leaks between tenants

## Workflow Orchestration (Injected by launch-cc.sh)

### 1. Plan First
- Tarea >3 pasos → escribe plan en `tasks/todo.md` con checkboxes ANTES de codear
- Si algo va mal → STOP y re-plan. No seguir empujando
- Incluye pasos de verificación en el plan, no solo implementación
- Specs detalladas upfront → menos ambigüedad

### 2. Self-Improvement Loop
- Después de CUALQUIER corrección → actualiza `tasks/lessons.md` con el patrón
- Escribe reglas que prevengan el mismo error
- Revisa lessons.md al inicio de cada sesión
- Itera hasta que la tasa de errores baje

### 3. Verification Before Done
- NUNCA marcar tarea como completada sin demostrar que funciona
- Diff entre comportamiento esperado vs actual
- Pregúntate: "¿Un staff engineer aprobaría esto?"
- Ejecuta tests, revisa logs, demuestra que es correcto

### 4. Demand Elegance (Balanced)
- Para cambios no triviales: "¿hay una forma más elegante?"
- Si el fix es hacky y sabes la solución limpia → implementa la limpia
- Para fixes simples/obvios → no sobre-ingeniear

### 5. Autonomous Bug Fixing
- Si ves un bug → arréglalo directamente. No pidas permiso
- Apunta a logs, errores, tests que fallan → resuélvelos
- Zero context switching para el usuario

### 6. Task Management
1. **Plan First**: Escribe plan en `tasks/todo.md` con items checkeables
2. **Verify Plan**: Revísalo antes de empezar
3. **Track Progress**: Marca items como completados según avanzas
4. **Explain Changes**: Resumen de alto nivel en cada paso
5. **Document Results**: Añade sección de review en `tasks/todo.md`
6. **Capture Lessons**: Actualiza `tasks/lessons.md` después de correcciones

## Agent Coordination
- Cada agente tiene file ownership definido en su .md
- Shared dirs (lib/): el que llega primero documenta en MEMORY.md qué está tocando
- Conflictos: architect decide prioridad
- Pre-flight: OBLIGATORIO — leer SESSION_CONTEXT.md + MEMORY.md antes de actuar

### Core Principles
- **Simplicity First**: Cada cambio lo más simple posible. Impacto mínimo
- **No Laziness**: Busca root causes. No fixes temporales. Estándares de senior dev
- **Minimal Impact**: Solo toca lo necesario. Evita introducir bugs
