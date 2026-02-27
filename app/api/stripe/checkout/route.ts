/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for plan subscription.
 * Protected: requires authenticated user.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// Map plan IDs to Stripe Price IDs from environment
const PRICE_IDS: Record<string, string> = {
  basic: process.env.STRIPE_PRICE_BASIC ?? "",
  pro: process.env.STRIPE_PRICE_PRO ?? "",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? "",
};

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const tenantId = session.user.tenantId;

    // Parse request body
    const body = await request.json();
    const { planId } = body;

    // Validate planId
    if (!planId || !["basic", "pro", "enterprise"].includes(planId)) {
      return NextResponse.json(
        { error: "Plan inválido. Debe ser: basic, pro, o enterprise" },
        { status: 400 }
      );
    }

    // Get the Stripe Price ID
    const priceId = PRICE_IDS[planId];
    if (!priceId) {
      console.error(`Missing Stripe Price ID for plan: ${planId}`);
      return NextResponse.json(
        { error: "Configuración de precio no encontrada" },
        { status: 500 }
      );
    }

    // Get tenant and their current subscription
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    // Create or retrieve Stripe Customer
    let stripeCustomerId = tenant.stripeCustomerId;

    if (!stripeCustomerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: tenant.email,
        metadata: {
          tenantId: tenant.id,
        },
      });

      stripeCustomerId = customer.id;

      // Save customer ID to tenant
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { stripeCustomerId },
      });
    }

    // Create Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/pricing`,
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

    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Error al crear sesión de pago" },
      { status: 500 }
    );
  }
}
