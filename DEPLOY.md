# Guía de Deploy - Trading Bot SaaS

## Resumen rápido

```bash
# 1. Crear DB en Vercel Postgres (o Neon/PlanetScale)
# 2. Configurar variables de entorno en Vercel
# 3. Deployar
vercel --prod
# 4. Ejecutar migraciones
vercel env pull .env.production
npx prisma migrate deploy
```

---

## Paso 1: Base de Datos (PostgreSQL)

### Opción A: Vercel Postgres (Recomendado)

1. Ve a [vercel.com/dashboard](https://vercel.com/dashboard)
2. Entra en tu proyecto → Storage → Create Database
3. Selecciona **Postgres**
4. Vercel añadirá automáticamente `POSTGRES_URL` y `POSTGRES_PRISMA_URL`

### Opción B: Neon (Gratis, bueno para empezar)

1. Ve a [neon.tech](https://neon.tech) y crea cuenta
2. Crea un proyecto → te dará la connection string
3. Usa `DATABASE_URL="postgresql://..."`

### Opción C: Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Crea proyecto → Settings → Database → Connection string
3. Usa `DATABASE_URL="postgresql://..."`

---

## Paso 2: Variables de Entorno en Vercel

En Vercel Dashboard → Settings → Environment Variables:

### Obligatorias (sin la app no funciona)

| Variable | Cómo generarla |
|----------|----------------|
| `DATABASE_URL` | La connection string de tu DB |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://tu-dominio.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | `https://tu-dominio.vercel.app` |
| `CREDENTIALS_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` ⚠️ |

> ⚠️ **IMPORTANTE:** `CREDENTIALS_ENCRYPTION_KEY` debe ser **exactamente 64 caracteres** (32 bytes en hex). Si no, `instrumentation.ts` crasheará el servidor al arrancar y TODAS las APIs retornarán 500. Ver [post-mortem](../../.openclaw/workspace/memory/post-mortems/2026-03-02-vercel-500-error.md).

### Stripe (cuando tengas cuenta)

| Variable | Descripción |
|----------|-------------|
| `STRIPE_SECRET_KEY` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Desde Stripe Dashboard → Webhooks |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` |
| `STRIPE_PRICE_BASIC` | Price ID del plan TRADER €57 |
| `STRIPE_PRICE_PRO` | Price ID del plan PRO €97 |
| `STRIPE_PRICE_ENTERPRISE` | Price ID del plan ENTERPRISE €197 |

---

## Paso 3: Configurar Schema PostgreSQL

Antes del primer deploy, cambia al schema de PostgreSQL:

```bash
# En local
cd C:\Users\guill\Projects\trading-bot-saas

# Backup del schema SQLite (por si acaso)
cp prisma/schema.prisma prisma/schema.sqlite.prisma.bak

# Usar schema PostgreSQL
cp prisma/schema.postgresql.prisma prisma/schema.prisma

# Commit el cambio
git add prisma/schema.prisma
git commit -m "chore: switch to postgresql schema for production"
git push
```

---

## Paso 4: Primer Deploy

```bash
# Si no tienes Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy a producción
vercel --prod
```

El primer deploy fallará porque no hay migraciones. Eso está bien, continúa al paso 5.

---

## Paso 5: Migraciones de Base de Datos

### Opción A: Desde tu PC (recomendado)

```bash
# Descarga las variables de entorno de Vercel
vercel env pull .env.production.local

# Ejecuta las migraciones
npx prisma migrate deploy

# Genera el cliente Prisma
npx prisma generate
```

### Opción B: Desde Vercel Dashboard

1. Ve a Storage → Tu DB → Query
2. Ejecuta las migraciones SQL manualmente desde `prisma/migrations/`

---

## Paso 6: Verificar que funciona

1. Abre `https://tu-dominio.vercel.app`
2. Registra un usuario
3. Verifica que puedes hacer login
4. Prueba el backtester

---

## Dominio Personalizado

1. Vercel Dashboard → Settings → Domains
2. Añade `tudominio.com`
3. Configura los DNS en tu proveedor:
   - A record → 76.76.21.21
   - CNAME www → cname.vercel-dns.com

---

## Comandos útiles

```bash
# Ver logs en tiempo real
vercel logs --follow

# Ver variables de entorno
vercel env ls

# Añadir variable
vercel env add AUTH_SECRET production

# Abrir PR con preview
vercel

# Re-deploy
vercel --prod --force
```

---

## Checklist pre-producción

- [ ] Base de datos PostgreSQL creada
- [ ] `DATABASE_URL` configurada en Vercel
- [ ] `AUTH_SECRET` generado (32+ caracteres)
- [ ] `NEXTAUTH_URL` = URL de producción
- [ ] `NEXT_PUBLIC_APP_URL` = URL de producción
- [ ] `CREDENTIALS_ENCRYPTION_KEY` generado (64 caracteres hex)
- [ ] Schema cambiado a PostgreSQL
- [ ] Migraciones ejecutadas
- [ ] Usuario de prueba creado
- [ ] Login funciona
- [ ] Backtester funciona

---

## Checklist Stripe (cuando tengas cuenta)

- [ ] Cuenta Stripe activa
- [ ] Productos creados (TRADER €57, PRO €97, ENTERPRISE €197)
- [ ] Price IDs copiados a Vercel
- [ ] Webhook configurado en Stripe (`/api/stripe/webhook`)
- [ ] Test de checkout con tarjeta 4242 4242 4242 4242

---

## Troubleshooting

### Error: "Prisma Client could not be generated"

```bash
npx prisma generate
```

### Error: "Can't reach database server"

Verifica que `DATABASE_URL` está bien configurada y la DB está accesible.

### Error: "Authentication failed"

Verifica que `AUTH_SECRET` y `NEXTAUTH_URL` están configurados correctamente.

### El deploy funciona pero la app no carga

1. Revisa los logs: `vercel logs`
2. Verifica que las migraciones se ejecutaron
3. Comprueba las variables de entorno

---

## Precios estimados

| Servicio | Plan | Costo/mes |
|----------|------|-----------|
| Vercel | Pro | $20 |
| Vercel Postgres | 512MB | $0 (incluido en Pro) |
| Neon | Free tier | $0 |
| Stripe | - | Solo comisiones |

**Total mínimo:** $0-20/mes dependiendo de si usas Vercel Pro o free tier.
