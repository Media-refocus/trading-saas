# Trading Architect Memory

## Project Overview
**Trading Bot SaaS** - Multi-tenant SaaS platform for automated trading from Telegram signals to MT4/5.

---

## Technology Stack (Fixed)

### Frontend
- **Next.js 14** with App Router (not Pages Router)
- **TypeScript** (strict mode)
- **Tailwind CSS**
- **shadcn/ui** component library
- **Deployment**: Vercel

### Backend
- **Next.js API Routes** + **tRPC** for type-safe APIs
- **PostgreSQL** database
- **Prisma ORM** for multi-tenant schema
- **Deployment**: Vercel (frontend) + Railway/DigitalOcean (bot)

### Bot (separate service)
- **Python (FastAPI) or Node.js** - STILL UNDECIDED
- Telethon for Telegram listener
- MetaTrader5 integration

### Auth & Payments
- **NextAuth.js** for authentication
- **Stripe** for payments

### Existing Code
- **Python Bot**: Telethon (Telegram listener) + MetaTrader5 integration
- **Backtester**: MQL5 Expert Advisors for MT5
- **Historical Data**: 25,647 signals (June-Sept 2024)

---

## Architecture Decisions

### Multi-tenancy Pattern
**Status**: Not yet implemented
**Decision Needed**: Row-level vs schema-level tenancy
**Recommendation**: Row-level with `tenantId` foreign keys (simpler for starting)

### Database Schema Design
**Key Tables** (from PRD):
- `Tenant` (SaaS customers)
- `User` (tenant users)
- `TradingAccount` (MT4/5 accounts)
- `Signal` (historical signals)
- `Position` (active/closed positions)
- `Subscription` (Stripe integration)

### Real-time Communication
**Required**: WebSocket for live position updates
**Options**:
- Server-Sent Events (SSE) - simpler, one-way
- WebSocket - bidirectional, more complex
- Pusher/Ably - external service (easier)
**Decision**: Pending evaluation

---

## Ralph Loop Structure

**Location**: `.ralph/PROMPT.md`
**Total Features**: 32
**Phases**: 8
1. Foundation (1-4): Setup, DB, Auth
2. Core Bot (5-8): Migration, exchange, Telegram
3. Dashboard Cliente (9-13)
4. Dashboard Admin (14-16)
5. Pagos (17-20)
6. Onboarding (21-24)
7. Testing (25-28)
8. Polish (29-32)

**Model**: `claude-opus-4-5-20251101` (Opus 4.5 with thinking)
**Philosophy**: Una feature = un commit

---

## Integration Points

### Python Bot → SaaS
**Challenge**: Existing bot is standalone Python script
**Decision in CLAUDE.md**: Backend = Next.js API Routes + tRPC
**Remaining Decision**: Bot implementation

**Options**:
1. **Python bot as microservice** + Next.js API Routes
   - Leverage existing Telethon code
   - FastAPI wrapper for bot API
   - Next.js calls bot via HTTP/queue

2. **Rewrite bot in Node.js**
   - Single language (JavaScript/TypeScript)
   - Native integration with Next.js
   - Need to port Telethon logic

3. **Hybrid**: Keep Python for Telegram, Node.js for execution
   - Complex architecture
   - Not recommended

### Telegram Integration
**Existing**: Telethon-based listener
**SaaS Need**: Multi-tenant (each tenant has own Telegram channel)
**Challenge**: Rate limiting and multiple channels
**Solution**: Queue system (Redis/RabbitMQ) for signal distribution

---

## Key Constraints

### Performance
- Must handle multiple concurrent tenants
- Real-time signal execution (< 1s latency)
- Backtester with 25K+ historical signals

### Security
- MT4/5 credentials must be encrypted at rest
- API keys (Telegram, Stripe) in vault
- Tenant isolation is critical

### Compliance
- Financial trading regulations (vary by jurisdiction)
- Data retention policies (GDPR, etc.)

---

## Open Questions

1. ✅ **RESUELTO: Backend Framework** = Next.js API Routes + tRPC (from CLAUDE.md)

2. **Bot Implementation**: Python (FastAPI) vs Node.js?
   - Pro Python: Existing Telethon code works
   - Pro Node.js: Single language with Next.js

3. **Multi-tenancy**: Row-level vs schema-level vs database-per-tenant?
   - CLAUDE.md says: Row-level with `tenant_id` in all tables

4. **Real-time Updates**: SSE vs WebSocket vs Pusher?

5. **Deployment Architecture**:
   - Monolith (Next.js only) vs microservices (Next.js + separate bot)?
   - How to coordinate Next.js frontend with bot service?

---

## Patterns to Follow

### API Design
- RESTful with consistent response format
- Versioning: `/api/v1/...`
- Error codes: `TENANT_NOT_FOUND`, `INVALID_SIGNAL`, etc.

### Database
- UUIDs for primary keys
- Soft deletes with `deletedAt` timestamp
- Audit trails: `createdBy`, `updatedBy`

### Frontend
- Server Components by default
- Client Components only when interactivity needed
- shadcn/ui for all UI components

---

## Anti-Patterns to Avoid

- ❌ Mixing tenant data (always filter by `tenantId`)
- ❌ N+1 queries (use Prisma includes)
- ❌ Hardcoded credentials (use environment variables)
- ❌ Blocking operations in async functions
- ❌ Client-side secrets (use Server Actions)

---

## From PRD (Key Requirements)

### Bot Core Logic
- **Grid System**: 1 base operation + 3 averages (max 4 operations)
- **Grid Levels**: -30, -60, -90 pips from entry (1 pip = 0.10 XAUUSD)
- **Dynamic Restrictions** (from Telegram channel):
  - "RIESGO" → only 1 average allowed
  - "SIN PROMEDIOS" → 0 averages
  - "SOLO 1 PROMEDIO" → 1 average
- **Stop Loss Management**:
  - +60 pips → SL to BE+20
  - +90 pips → SL to BE+50
  - No BE at +40 (removed)

### Account Types Supported
- **VT Markets**: Cent accounts (XAUUSD standard)
- **Infinox**: Microlot accounts (simulates cent)

### Signal Format (from Telegram)
- Entries: "BUY XAUUSD 3015", "SELL 3029"
- Modifications: "SL +10", "Movemos SL a BE"
- Closes: "CERRAMOS TODO", "CERRAMOS PROMEDIO"

---

## Last Updated: 2026-02-11 12:50

**Next**: Decide bot implementation (Python vs Node.js) to finalize architecture.
