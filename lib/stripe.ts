/**
 * Stripe Integration Helper
 * ==========================
 *
 * Funciones para manejar pagos con Stripe
 */

import Stripe from "stripe";
import { prisma } from "./prisma";

// Inicializar Stripe de forma lazy
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY no está configurada");
    }
    _stripe = new Stripe(secretKey, {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return _stripe;
}

// URLs de la app
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Crea o recupera un customer en Stripe
 */
export async function getOrCreateStripeCustomer(
  tenantId: string,
  email: string,
  name: string
): Promise<string> {
  // Buscar tenant existente
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Error("Tenant no encontrado");
  }

  // Si ya tiene stripeCustomerId, retornarlo
  if (tenant.stripeCustomerId) {
    return tenant.stripeCustomerId;
  }

  // Crear nuevo customer en Stripe
  const customer = await getStripe().customers.create({
    email,
    name,
    metadata: {
      tenantId,
    },
  });

  // Guardar en la base de datos
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/**
 * Crea una sesión de checkout para suscripción mensual
 */
export async function createCheckoutSession(params: {
  tenantId: string;
  email: string;
  name: string;
  planId: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ url: string; sessionId: string }> {
  const { tenantId, email, name, planId, successUrl, cancelUrl } = params;

  // Obtener el plan
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error("Plan no encontrado");
  }

  // Si el plan no tiene stripePriceId, crear el precio en Stripe
  let stripePriceId = plan.stripePriceId;

  if (!stripePriceId) {
    // Crear producto si no existe
    const product = await getStripe().products.create({
      name: `Plan ${plan.name}`,
      description: `Suscripción mensual al plan ${plan.name} - Trading Bot`,
      metadata: {
        planId: plan.id,
        maxPositions: plan.maxPositions.toString(),
        maxLevels: plan.maxLevels.toString(),
      },
    });

    // Crear precio mensual en EUR
    const price = await getStripe().prices.create({
      product: product.id,
      unit_amount: Math.round(plan.price * 100), // Convertir a centimos
      currency: plan.currency.toLowerCase(),
      recurring: {
        interval: "month",
      },
      metadata: {
        planId: plan.id,
      },
    });

    // Guardar el priceId en la base de datos
    await prisma.plan.update({
      where: { id: planId },
      data: { stripePriceId: price.id },
    });

    stripePriceId = price.id;
  }

  // Obtener o crear customer
  const customerId = await getOrCreateStripeCustomer(tenantId, email, name);

  // Crear sesión de checkout
  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ],
    // Si el plan tiene fee de implementación, añadirlo como cargo único
    ...(plan.implementationFee && {
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
        {
          price_data: {
            currency: plan.currency.toLowerCase(),
            unit_amount: Math.round(plan.implementationFee * 100),
            product_data: {
              name: "Fee de Implementación",
              description: "Configuración inicial del bot",
            },
          },
          quantity: 1,
        },
      ],
    }),
    success_url: successUrl || `${APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${APP_URL}/pricing?canceled=true`,
    metadata: {
      tenantId,
      planId,
    },
    subscription_data: {
      metadata: {
        tenantId,
        planId,
      },
    },
  });

  return {
    url: session.url || "",
    sessionId: session.id,
  };
}

/**
 * Crea un portal de cliente para gestionar suscripción
 */
export async function createCustomerPortal(
  stripeCustomerId: string
): Promise<string> {
  const session = await getStripe().billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${APP_URL}/settings`,
  });

  return session.url;
}

/**
 * Maneja el evento checkout.session.completed
 */
export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const tenantId = session.metadata?.tenantId;
  const planId = session.metadata?.planId;

  if (!tenantId || !planId) {
    console.error("Missing metadata in checkout session", session.id);
    return;
  }

  // Actualizar el tenant con el nuevo plan
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      planId,
      implementationFeePaid: true, // El fee se paga con el checkout
      onboardingCompletedAt: new Date(),
    },
  });

  // Crear o actualizar la suscripción
  const subscriptionId = session.subscription as string;

  if (subscriptionId) {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);

    await prisma.subscription.upsert({
      where: { stripeSubId: subscriptionId },
      create: {
        tenantId,
        stripeSubId: subscriptionId,
        stripePriceId: subscription.items.data[0]?.price.id,
        status: subscription.status.toUpperCase(),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
      update: {
        status: subscription.status.toUpperCase(),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });
  }

  console.log(`Checkout completed: tenant ${tenantId} -> plan ${planId}`);
}

/**
 * Maneja cambios en la suscripción
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const tenantId = subscription.metadata?.tenantId;
  const planId = subscription.metadata?.planId;

  if (!tenantId) {
    console.error("Missing tenantId in subscription", subscription.id);
    return;
  }

  // Actualizar estado de la suscripción
  await prisma.subscription.update({
    where: { stripeSubId: subscription.id },
    data: {
      status: subscription.status.toUpperCase(),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  // Si la suscripción fue cancelada, quitar el plan del tenant
  if (subscription.status === "canceled") {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { planId: null },
    });
  }

  console.log(`Subscription updated: ${subscription.id} -> ${subscription.status}`);
}

/**
 * Maneja eliminación de suscripción
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const tenantId = subscription.metadata?.tenantId;

  if (!tenantId) {
    console.error("Missing tenantId in subscription", subscription.id);
    return;
  }

  // Marcar suscripción como cancelada
  await prisma.subscription.update({
    where: { stripeSubId: subscription.id },
    data: {
      status: "CANCELED",
    },
  });

  // Quitar plan del tenant
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { planId: null },
  });

  // Revocar API keys del bot
  await prisma.botConfig.updateMany({
    where: { tenantId },
    data: { apiKeyStatus: "REVOKED" },
  });

  console.log(`Subscription deleted: ${subscription.id}`);
}

/**
 * Maneja pagos fallidos
 */
export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    return;
  }

  // Buscar la suscripción
  const sub = await prisma.subscription.findUnique({
    where: { stripeSubId: subscriptionId },
  });

  if (!sub) {
    return;
  }

  // Actualizar estado a PAST_DUE
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: "PAST_DUE" },
  });

  // Crear alerta para el usuario
  await prisma.alert.create({
    data: {
      tenantId: sub.tenantId,
      type: "SUBSCRIPTION_EXPIRING",
      message: "El último pago ha fallado. Por favor, actualiza tu método de pago.",
      metadata: {
        invoiceId: invoice.id,
        attemptCount: invoice.attempt_count,
      },
    },
  });

  console.log(`Payment failed for subscription: ${subscriptionId}`);
}
