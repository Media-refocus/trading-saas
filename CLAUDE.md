# Trading Bot SaaS - Convenciones del Proyecto

## Stack Técnico

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **UI**: Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes + tRPC
- **Database**: PostgreSQL (Prisma ORM) - Esquema multi-tenant
- **Auth**: NextAuth.js (Auth.js v5)
- **Payments**: Stripe
- **Bot**: Python (FastAPI) o Node.js - aún por decidir
- **Deployment**: Vercel (frontend) + Railway/DigitalOcean (bot)

## Comandos Esenciales

```bash
# Desarrollo
npm run dev          # Arrancar Next.js
npm run bot:dev      # Arrancar bot en modo dev

# Database
npx prisma migrate dev
npx prisma studio

# Testing
npm run test
npm run e2e

# Build
npm run build
```

## Convenciones de Código

- **Idioma**: Español para commits, comentarios y docs
- **Formato**: Prettier + ESLint (configurado)
- **Branches**: `feature/`, `fix/`, `hotfix/`
- **Commits**: Conventional commits en español

## Estructura de Carpetas

```
trading-bot-saas/
├── app/                 # Next.js App Router
├── components/          # Componentes React
├── lib/                 # Utilidades compartidas
├── prisma/              # Schema y migrations
├── bot/                 # Código del bot de trading
├── docs/                # Documentación del proyecto
└── codigo-existente/    # Código base original (referencia)
```

## Multi-tenancy

Cada cliente (tenant) tiene:
- `tenant_id` en todas las tablas
- Configuración independiente de exchanges
- Suscripción propia (Stripe)
- Datos aislados (señales, trades, configuraciones)

## Prioridades

1. **Seguridad**: API keys encriptadas, aislamiento de datos
2. **Fiabilidad**: Bot nunca para, logs completos
3. **UX**: Onboarding sencillo, dashboard claro

