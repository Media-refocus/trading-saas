/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events to sync subscription status.
 * Uses raw body parsing for signature verification.
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { PlanType, SubscriptionStatus } from "@prisma/client";

// Map Stripe Price IDs to plan types
const PRICE_TO_PLAN: Record<string, PlanType> = {
  [process.env.STRIPE_PRICE_BASIC ?? ""]: "BASIC",
  [process.env.STRIPE_PRICE_PRO ?? ""]: "PRO",
  [process.env.STRIPE_PRICE_ENTERPRISE ?? ""]: "ENTERPRISE",
};

// Map Stripe subscription status to our SubscriptionStatus
const STRIPE_STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: "ACTIVE",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  unpaid: "PAST_DUE",
  paused: "PAUSED",
  trialing: "TRIAL",
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    // Get raw body for signature verification
    const body = await request.text();
    const signature = (await headers()).get("stripe-signature");

    if (!signature) {
      console.error("Missing stripe-signature header");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    // Get Stripe client and verify webhook signature
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Webhook signature verification failed:", errorMessage);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed
 * Creates or updates subscription after successful checkout
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const tenantId = session.metadata?.tenantId;
  const planId = session.metadata?.planId;
  const subscriptionId = session.subscription as string | undefined;
  const customerId = session.customer as string | undefined;

  if (!tenantId) {
    console.error("No tenantId in checkout session metadata");
    return;
  }

  console.log(`Checkout completed for tenant ${tenantId}, plan: ${planId}`);

  // Determine plan from metadata or price
  let plan: PlanType = "PRO"; // default
  if (planId) {
    const planMap: Record<string, PlanType> = {
      basic: "BASIC",
      pro: "PRO",
      enterprise: "ENTERPRISE",
    };
    plan = planMap[planId] ?? "PRO";
  }

  // Update tenant with Stripe customer ID if not already set
  if (customerId) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { stripeCustomerId: customerId },
    });
  }

  // Create or update subscription
  if (subscriptionId) {
    // Get full subscription details from Stripe
    const stripe = getStripe();
    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

    const priceId = stripeSubscription.items.data[0]?.price.id;
    if (priceId && PRICE_TO_PLAN[priceId]) {
      plan = PRICE_TO_PLAN[priceId];
    }

    await prisma.subscription.upsert({
      where: { stripeSubId: subscriptionId },
      create: {
        tenantId,
        plan,
        stripeSubId: subscriptionId,
        stripePriceId: priceId,
        status: "ACTIVE",
        trialEnd: null,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      },
      update: {
        plan,
        stripePriceId: priceId,
        status: "ACTIVE",
        trialEnd: null,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      },
    });

    // Update tenant plan
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { plan },
    });

    console.log(`Subscription created/updated: ${subscriptionId} for tenant ${tenantId}`);
  }
}

/**
 * Handle customer.subscription.updated
 * Syncs subscription status changes from Stripe
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;
  const customerId = subscription.customer as string;
  const status = subscription.status;
  const priceId = subscription.items.data[0]?.price.id;

  // Find tenant by Stripe customer ID
  const tenant = await prisma.tenant.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!tenant) {
    console.error(`No tenant found for Stripe customer ${customerId}`);
    return;
  }

  // Map status
  const mappedStatus = STRIPE_STATUS_MAP[status] ?? "ACTIVE";

  // Determine plan from price
  let plan: PlanType = "PRO";
  if (priceId && PRICE_TO_PLAN[priceId]) {
    plan = PRICE_TO_PLAN[priceId];
  }

  await prisma.subscription.updateMany({
    where: { stripeSubId: subscriptionId },
    data: {
      plan,
      stripePriceId: priceId,
      status: mappedStatus,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  // Update tenant plan if active
  if (mappedStatus === "ACTIVE") {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan },
    });
  }

  console.log(`Subscription updated: ${subscriptionId}, status: ${mappedStatus}`);
}

/**
 * Handle customer.subscription.deleted
 * Marks subscription as canceled
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;
  const customerId = subscription.customer as string;

  // Find tenant by Stripe customer ID
  const tenant = await prisma.tenant.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!tenant) {
    console.error(`No tenant found for Stripe customer ${customerId}`);
    return;
  }

  await prisma.subscription.updateMany({
    where: { stripeSubId: subscriptionId },
    data: {
      status: "CANCELED",
    },
  });

  // Downgrade tenant to TRIAL
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { plan: "TRIAL" },
  });

  console.log(`Subscription canceled: ${subscriptionId}`);
}

/**
 * Handle invoice.payment_failed
 * Marks subscription as past_due
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string | undefined;
  const customerId = invoice.customer as string;

  if (!subscriptionId) {
    console.log("Payment failed but no subscription ID in invoice");
    return;
  }

  // Find tenant by Stripe customer ID
  const tenant = await prisma.tenant.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!tenant) {
    console.error(`No tenant found for Stripe customer ${customerId}`);
    return;
  }

  await prisma.subscription.updateMany({
    where: { stripeSubId: subscriptionId },
    data: {
      status: "PAST_DUE",
    },
  });

  console.log(`Payment failed for subscription: ${subscriptionId}`);
}
