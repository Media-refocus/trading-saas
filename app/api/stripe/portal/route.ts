/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe billing portal session for managing subscription.
 * Protected: requires authenticated user with stripeCustomerId.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST() {
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

    // Get tenant with stripeCustomerId
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    // Check if tenant has a Stripe customer ID
    if (!tenant.stripeCustomerId) {
      return NextResponse.json(
        { error: "No tienes una cuenta de Stripe asociada. Suscríbete primero." },
        { status: 400 }
      );
    }

    // Create billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard`,
    });

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error) {
    console.error("Error creating billing portal session:", error);
    return NextResponse.json(
      { error: "Error al crear sesión del portal de facturación" },
      { status: 500 }
    );
  }
}
