# Manual Test Plan: Payments Flow (Stripe)

> **Scope:** End-to-end testing of the complete payment lifecycle
> **Owner:** Trading Bot SaaS Team
> **Last Updated:** 2026-03-08

## Prerequisites

### Environment Setup
- [ ] Use Stripe **Test Mode** (toggle in Stripe Dashboard)
- [ ] Verify `.env.local` contains test Stripe keys:
  - `STRIPE_SECRET_KEY` (sk_test_...)
  - `STRIPE_WEBHOOK_SECRET` (whsec_...)
  - `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE`
- [ ] Stripe CLI running for local webhook testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- [ ] Dev server running: `npm run dev`
- [ ] Test user account created (not admin)

### Stripe Test Cards

| Card Number | Scenario | Result |
|------------|----------|--------|
| `4242 4242 4242 4242` | Success | Payment succeeds |
| `4000 0000 0000 0002` | Decline | Payment declined |
| `4000 0000 0000 9995` | Insufficient funds | Payment fails |
| `4000 0027 6000 3184` | 3D Secure | Requires auth |

**Common fields for all test cards:**
- Expiry: Any future date (e.g., 12/34)
- CVC: Any 3 digits (e.g., 123)
- Postal code: Any (e.g., 12345)

---

## Test Case 1: New Subscription (Success)

### Steps

1. **Navigate to Pricing Page**
   - [ ] Go to `/pricing`
   - [ ] Verify 3 plans displayed: Trader (57€), Pro (147€), VIP (347€)
   - [ ] Verify "Prueba Gratis" banner visible

2. **Start Checkout**
   - [ ] Click "Comenzar Prueba Gratis" or "Suscribirse"
   - [ ] If not logged in, complete registration first
   - [ ] From Settings page (`/settings`), click "Mejorar Plan"
   - [ ] Select a plan and proceed to Stripe Checkout

3. **Complete Payment**
   - [ ] Enter test card: `4242 4242 4242 4242`
   - [ ] Enter any future expiry date
   - [ ] Enter any CVC
   - [ ] Click "Pay" / "Subscribe"

4. **Verify Success Redirect**
   - [ ] Redirected to `/dashboard?checkout=success`
   - [ ] Success message displayed (if implemented)

5. **Verify Webhook Processed**
   - [ ] Check Stripe CLI logs: `checkout.session.completed` event received
   - [ ] Check server logs: "Checkout completed for tenant..."
   - [ ] Check server logs: "Subscription created/updated..."

6. **Verify Database Updated**
   ```sql
   SELECT * FROM Subscription WHERE tenantId = '<your-tenant-id>' ORDER BY createdAt DESC LIMIT 1;
   ```
   - [ ] Record exists with `status = 'ACTIVE'`
   - [ ] `stripeSubId` populated
   - [ ] `plan` matches selected plan

7. **Verify Settings Page**
   - [ ] Navigate to `/settings`
   - [ ] Verify plan name displayed correctly (Plan Pro, Plan VIP, etc.)
   - [ ] Verify status badge shows "Activo" (green)
   - [ ] Verify "Gestionar Facturación" button visible
   - [ ] Verify "Próxima facturación en X días" displayed

---

## Test Case 2: Payment Declined

### Steps

1. **Start Checkout** (as in Test Case 1)
   - [ ] Navigate to pricing or settings
   - [ ] Initiate checkout for any plan

2. **Enter Declining Card**
   - [ ] Use card: `4000 0000 0000 0002`
   - [ ] Complete checkout form
   - [ ] Submit payment

3. **Verify Error Handling**
   - [ ] Stripe shows error message: "Your card was declined"
   - [ ] User can retry with different card
   - [ ] No subscription created in database

4. **Verify Database Unchanged**
   ```sql
   SELECT * FROM Subscription WHERE tenantId = '<your-tenant-id>';
   ```
   - [ ] No new ACTIVE subscription
   - [ ] Tenant plan unchanged

---

## Test Case 3: Subscription Cancellation (via Stripe Portal)

### Steps

1. **Access Billing Portal**
   - [ ] Login as user with active subscription
   - [ ] Navigate to `/settings`
   - [ ] Click "Gestionar Facturación"

2. **Cancel Subscription**
   - [ ] Stripe Portal opens
   - [ ] Click "Cancel subscription" or similar option
   - [ ] Confirm cancellation

3. **Verify Webhook Processed**
   - [ ] Check Stripe CLI logs: `customer.subscription.deleted` event
   - [ ] Check server logs: "Subscription canceled..."

4. **Verify Database Updated**
   ```sql
   SELECT * FROM Subscription WHERE tenantId = '<your-tenant-id>';
   SELECT plan FROM Tenant WHERE id = '<your-tenant-id>';
   ```
   - [ ] Subscription status = 'CANCELED'
   - [ ] Tenant plan downgraded to 'BASIC'

5. **Verify Settings Page**
   - [ ] Refresh `/settings`
   - [ ] Status badge shows "Cancelado" (red)
   - [ ] "Reactivar Plan" button visible

---

## Test Case 4: Payment Failure (Subscription Renewal)

### Steps

1. **Simulate Payment Failure**
   - Use Stripe CLI to trigger event:
     ```bash
     stripe trigger invoice.payment_failed
     ```
   - Or use Stripe Dashboard → Developers → Webhooks → Send test event

2. **Verify Webhook Processed**
   - [ ] Check server logs: "Payment failed for subscription..."

3. **Verify Database Updated**
   ```sql
   SELECT status FROM Subscription WHERE tenantId = '<your-tenant-id>';
   ```
   - [ ] Status = 'PAST_DUE'

4. **Verify Settings Page**
   - [ ] Refresh `/settings`
   - [ ] Status badge shows "Pago Pendiente" (yellow)
   - [ ] Warning message about payment issue
   - [ ] "Reactivar Plan" button visible

---

## Test Case 5: Plan Limits Enforcement

### Steps

1. **Verify Plan Gates**
   - As BASIC user:
     - [ ] Can access dashboard
     - [ ] Can use backtester (if allowed)
     - [ ] Cannot access Pro-only features

   - As PRO user:
     - [ ] Can access all BASIC features
     - [ ] Can access Telegram notifications
     - [ ] Can use multi-account (up to 3)

   - As ENTERPRISE/VIP user:
     - [ ] All features unlocked
     - [ ] Unlimited MT5 accounts

2. **Verify MT5 Account Limits**
   ```sql
   -- Check MT5 accounts count vs plan limit
   SELECT plan FROM Tenant WHERE id = '<tenant-id>';
   SELECT COUNT(*) FROM Mt5Account WHERE tenantId = '<tenant-id>';
   ```

---

## Test Case 6: Stripe Billing Portal Access

### Steps

1. **Access Portal (Active Subscriber)**
   - [ ] Login as user with active subscription
   - [ ] Navigate to `/settings`
   - [ ] Click "Gestionar Facturación"
   - [ ] Verify portal opens showing:
     - [ ] Current plan
     - [ ] Payment method
     - [ ] Invoice history
     - [ ] Cancel option

2. **Access Portal (No Stripe Customer)**
   - [ ] Login as user without Stripe customer ID
   - [ ] Navigate to `/settings`
   - [ ] Verify "Gestionar Facturación" button NOT visible
   - [ ] If clicked directly, verify error message

---

## Test Case 7: Webhook Signature Verification

### Steps

1. **Valid Signature**
   - [ ] Use Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
   - [ ] Trigger test event: `stripe trigger checkout.session.completed`
   - [ ] Verify event processed (check logs)

2. **Invalid Signature**
   ```bash
   curl -X POST http://localhost:3000/api/stripe/webhook \
     -H "Content-Type: application/json" \
     -H "stripe-signature: invalid_signature" \
     -d '{"test": true}'
   ```
   - [ ] Response: 400 Bad Request
   - [ ] Error: "Invalid signature"

---

## Test Case 8: Edge Cases

### Multiple Subscription Attempts
1. [ ] Start checkout for Plan A
2. [ ] Complete payment
3. [ ] Start checkout for Plan B (upgrade)
4. [ ] Complete payment
5. [ ] Verify only ONE active subscription in DB
6. [ ] Verify plan updated to Plan B

### Session Expiry During Checkout
1. [ ] Start checkout
2. [ ] Wait 30+ minutes (or simulate session expiry)
3. [ ] Complete payment in Stripe
4. [ ] Verify webhook still processes correctly (uses metadata, not session)

### Concurrent Webhooks
1. [ ] Trigger multiple webhooks rapidly:
   ```bash
   stripe trigger checkout.session.completed &
   stripe trigger customer.subscription.updated &
   ```
2. [ ] Verify no race conditions
3. [ ] Verify final state is correct

---

## Checklist: Pre-Launch Verification

Before going to production:

- [ ] All test cases pass
- [ ] Stripe webhook endpoint configured in Stripe Dashboard (production)
- [ ] Production webhook secret in `STRIPE_WEBHOOK_SECRET`
- [ ] Production price IDs in env vars
- [ ] Email receipts configured in Stripe (optional)
- [ ] Tax settings configured in Stripe (if applicable)
- [ ] Test with real card (small amount, then refund)

---

## Rollback Procedure

If payment flow fails in production:

1. **Immediate Actions**
   - Check Stripe Dashboard for failed webhooks
   - Check Vercel/Server logs for errors
   - Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard

2. **Manual Subscription Fix**
   ```sql
   -- Grant temporary access while investigating
   UPDATE Subscription SET status = 'ACTIVE' WHERE tenantId = '<affected-tenant>';
   UPDATE Tenant SET plan = 'PRO' WHERE id = '<affected-tenant>';
   ```

3. **Reprocess Webhook**
   - Stripe Dashboard → Developers → Webhooks
   - Find failed event
   - Click "Resend"

---

## Test Execution Log

| Date | Tester | Test Case | Result | Notes |
|------|--------|-----------|--------|-------|
| | | TC1 - Success | | |
| | | TC2 - Decline | | |
| | | TC3 - Cancel | | |
| | | TC4 - Payment Failed | | |
| | | TC5 - Limits | | |
| | | TC6 - Portal | | |
| | | TC7 - Webhook Sig | | |
| | | TC8 - Edge Cases | | |

---

## Related Files

- `app/api/stripe/checkout/route.ts` - Checkout session creation
- `app/api/stripe/webhook/route.ts` - Webhook handler
- `app/api/stripe/portal/route.ts` - Billing portal
- `server/api/trpc/routers/tenant.ts` - Subscription query
- `lib/plan-gates.ts` - Plan limit enforcement
- `lib/stripe.ts` - Stripe client
