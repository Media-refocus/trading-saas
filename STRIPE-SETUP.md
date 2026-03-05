# Stripe Setup — Checklist para activar pagos

> El código está 100% listo. Solo hace falta crear la cuenta y copiar las keys.

---

## Paso 1 — Crear cuenta Stripe
1. Ir a https://stripe.com → "Start now"
2. Verificar email + datos de empresa (Refocus Agency o nombre del SaaS)

---

## Paso 2 — API Keys
1. Dashboard Stripe → **Developers → API keys**
2. Copiar las dos keys en `.env` y en Vercel (Settings → Environment Variables):

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
```

> ⚠️ Para testing usar `pk_test_xxx` / `sk_test_xxx` primero

---

## Paso 3 — Crear Productos/Precios
1. Dashboard → **Products → Add product**
2. Crear 3 productos con precio recurrente mensual:

| Producto | Precio sugerido | Variable |
|----------|----------------|----------|
| Basic    | 29€/mes        | `STRIPE_PRICE_BASIC` |
| Pro      | 79€/mes        | `STRIPE_PRICE_PRO` |
| Enterprise | 199€/mes    | `STRIPE_PRICE_ENTERPRISE` |

3. Copiar los **Price IDs** (formato `price_xxx`) al `.env` y Vercel

---

## Paso 4 — Webhook
1. Dashboard → **Developers → Webhooks → Add endpoint**
2. URL: `https://trading-saas.vercel.app/api/stripe/webhook`
3. Eventos a escuchar:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copiar el **Signing secret** (`whsec_xxx`) a:
   - `.env` → `STRIPE_WEBHOOK_SECRET`
   - Vercel → `STRIPE_WEBHOOK_SECRET`

---

## Paso 5 — Verificar en producción
```bash
# Test webhook local (si quieres probar antes)
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test event
stripe trigger checkout.session.completed
```

---

## Qué hace el código automáticamente
- ✅ Al hacer checkout: crea `Subscription` en Supabase + actualiza plan del tenant
- ✅ Si cancela: baja a plan BASIC automáticamente
- ✅ Si falla pago: marca como `PAST_DUE`
- ✅ Portal de cliente (gestionar/cancelar suscripción): `/api/stripe/portal`
- ✅ Página de pricing: `/pricing` (pública, sin auth)

---

## Estado actual
- [x] lib/stripe.ts — cliente Stripe con lazy init
- [x] /api/stripe/checkout — crea sesión de pago
- [x] /api/stripe/webhook — sincroniza eventos con Supabase
- [x] /api/stripe/portal — portal de gestión para clientes
- [x] /pricing — página pública con planes
- [x] Schema Prisma — modelos Subscription, stripeCustomerId, stripeSubId
- [ ] Keys reales en .env y Vercel (pendiente cuenta Stripe)
