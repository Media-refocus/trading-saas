/**
 * API Stripe - Crear Checkout Session
 * ====================================
 *
 * POST: Crea una sesión de checkout de Stripe para suscribirse a un plan
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { planId } = body;

    if (!planId) {
      return NextResponse.json({ error: "planId requerido" }, { status: 400 });
    }

    // Obtener usuario y tenant
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenant: true },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    // Verificar que el plan existe
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });
    }

    // Crear sesión de checkout
    const checkout = await createCheckoutSession({
      tenantId: user.tenant.id,
      email: user.email,
      name: user.name || user.tenant.name,
      planId,
    });

    return NextResponse.json({
      success: true,
      url: checkout.url,
      sessionId: checkout.sessionId,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Error al crear sesión de pago" },
      { status: 500 }
    );
  }
}
