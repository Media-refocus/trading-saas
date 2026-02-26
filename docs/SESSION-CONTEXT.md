# Trading Bot SaaS - Contexto de Sesión

## Fecha: 2026-02-26

---

## Estado del Proyecto

### Completado Hoy
- [x] Autenticación completa en router bot.ts (13 procedimientos con protectedProcedure)
- [x] Brainstorming de 60 premium features (4 subagentes)
- [x] Planes actualizados: €57/147/347 con features detalladas
- [x] Documentación completa subida a GitHub

### Archivos Modificados/Creados
- `server/api/trpc/routers/bot.ts` - Autenticación completa
- `docs/STRIPE-FLOW.md` - Flujo de suscripciones
- `docs/PLANS.md` - Planes y precios actualizados
- `docs/PROGRESS.md` - Estado del proyecto
- `docs/PREMIUM-FEATURES-BRAINSTORM.md` - 60 features propuestas

---

## Decisiones Tomadas

### 1. Precios Confirmados
| Plan | Precio |
|------|--------|
| Básico | €57/mes |
| Pro | €147/mes |
| Enterprise | €347/mes |

### 2. Plan PRO incluye (20+ features)
- **Protección:** Circuit Breaker, Account Guardian, Kill Switch, Position Sizing Kelly, Límites D/S/M
- **Analytics:** Sharpe/Sortino, Equity curve, Heatmap, Reportes PDF
- **Automatización:** News Filter, Session Trading, TradingView Bridge, Discord/Slack, Webhooks
- **Trading:** Smart Entry, Signal Confidence, Breakeven+Lock, Smart Trailing

### 3. Trial = Plan PRO (14 días)
- Hook emocional para conversión
- Usuario ve todas las features premium

### 4. Pago Fallido
- 8 días de gracia
- 3 intentos de cobro
- Luego pausa

---

## Decisiones Pendientes

### 1. Demo sin VPS
| Opción | Descripción |
|--------|-------------|
| A | Demo hosted en nuestra infra (todos ven mismos trades) |
| B | Ejecutable .exe que corre en PC del usuario |
| C | Canal Telegram público con señales y trades en tiempo real (RECOMENDADA) |

### 2. Usuarios Existentes (Xisco)
| Opción | Descripción |
|--------|-------------|
| A | Pagan como todos |
| B | Gratis para siempre |
| C | Gratis pero solo plan Básico |
| D | 3-6 meses de gracia |

---

## Próximos Pasos (Mañana)

### Opción 1: Implementar Quick Wins PRO (~17 días)
| Feature | Días | Prioridad |
|---------|------|-----------|
| Emergency Kill Switch | 1 | Alta |
| Límites de Pérdida | 2 | Alta |
| Session Trading | 2 | Media |
| Métricas de Riesgo | 3 | Alta |
| Heatmap Horario | 2 | Media |
| Breakeven + Lock Profit | 2 | Alta |
| News Filter | 5 | Alta |

### Opción 2: Otras tareas
- Stripe (cuando todo funcione)
- Más tests
- Deploy
- Mejorar dashboard

---

## Arquitectura Recordatorio

```
┌─────────────────┐     ┌─────────────────┐
│  CLIENTE (VPS)  │     │   SAAS (Vercel) │
│                 │     │                 │
│  ┌───────────┐  │ API │  ┌───────────┐  │
│  │    MT5    │◄─┼────►│  │  Next.js  │  │
│  └───────────┘  │     │  └───────────┘  │
│  ┌───────────┐  │     │  ┌───────────┐  │
│  │Python Bot │◄─┼────►│  │   tRPC    │  │
│  └───────────┘  │     │  └───────────┘  │
│  ┌───────────┐  │     │  ┌───────────┐  │
│  │Telegram   │◄─┼─────┼─►│  Prisma   │  │
│  └───────────┘  │     │  │  SQLite   │  │
└─────────────────┘     └─────────────────┘
```

---

## GitHub

**Repo:** https://github.com/Media-refocus/trading-saas

**Último commit:** 150c392
```
docs: brainstorming premium features + planes actualizados
```

---

## Stack

- Frontend: Next.js 15, TypeScript, Tailwind, shadcn/ui
- Backend: tRPC v11, Prisma
- DB: SQLite (dev) → Postgres (prod)
- Auth: NextAuth.js v5
- Bot: Python 3.11, MT5, python-telegram-bot

---

## Contacto/Referencias

- Precio base €57 = contrato con Xisco
- Señales de Telegram → Bot → MT5
- Multi-tenant con tenantId

---

*Contexto guardado: 2026-02-26*
*Para retomar: Leer este archivo + git pull*
