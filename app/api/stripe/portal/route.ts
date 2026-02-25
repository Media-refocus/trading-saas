/**
 * API Stripe - Customer Portal
 * =============================
 *
 * POST: Crea una sesión del portal de cliente para gestionar suscripción
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCustomerPortal } from "@/lib/stripe";

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Obtener usuario y tenant
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenant: true },
    });

    if (!user?.tenant?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No tienes una suscripción activa" },
        { status: 400 }
      );
    }

    // Crear sesión del portal
    const portalUrl = await createCustomerPortal(user.tenant.stripeCustomerId);

    return NextResponse.json({
      success: true,
      url: portalUrl,
    });
  } catch (error) {
    console.error("Error creating portal session:", error);
    return NextResponse.json(
      { error: "Error al crear sesión del portal" },
      { status: 500 }
    );
  }
}
