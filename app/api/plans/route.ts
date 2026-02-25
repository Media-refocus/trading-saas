/**
 * API de Planes
 * =============
 *
 * GET: Lista planes disponibles y el plan actual del usuario
 * POST: Asigna un plan al tenant (para testing/admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlanInfo } from "@/lib/plans";

/**
 * GET /api/plans
 * Lista planes disponibles y el plan actual del usuario
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenant: true },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    const planInfo = await getPlanInfo(user.tenant.id);

    return NextResponse.json({
      success: true,
      currentPlan: {
        name: planInfo.current.planName,
        id: planInfo.current.planId,
        limits: {
          maxPositions: planInfo.current.maxPositions,
          maxLevels: planInfo.current.maxLevels,
          hasTrailingSL: planInfo.current.hasTrailingSL,
          hasAdvancedGrid: planInfo.current.hasAdvancedGrid,
          hasPriority: planInfo.current.hasPriority,
        },
      },
      availablePlans: planInfo.plans.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        currency: p.currency,
        features: [
          `${p.maxPositions} posicion${p.maxPositions > 1 ? "es" : ""} simultanea${p.maxPositions > 1 ? "s" : ""}`,
          `${p.maxLevels} nivel${p.maxLevels > 1 ? "es" : ""} de promedio`,
          p.hasTrailingSL ? "Trailing Stop Loss" : null,
          p.hasAdvancedGrid ? "Grid Avanzado" : null,
          p.hasPriority ? "Soporte Prioritario" : null,
        ].filter(Boolean),
      })),
    });
  } catch (error) {
    console.error("Error obteniendo planes:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/plans
 * Asigna un plan al tenant (para testing/demos)
 * En produccion, esto se haria via Stripe webhook
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { planId } = body;

    if (!planId) {
      return NextResponse.json({ error: "planId es requerido" }, { status: 400 });
    }

    // Verificar que el plan existe
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenant: true },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    // Asignar plan al tenant
    const updatedTenant = await prisma.tenant.update({
      where: { id: user.tenant.id },
      data: { planId },
    });

    return NextResponse.json({
      success: true,
      message: `Plan ${plan.name} asignado correctamente`,
      plan: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
      },
    });
  } catch (error) {
    console.error("Error asignando plan:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
