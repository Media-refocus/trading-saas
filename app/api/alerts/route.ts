/**
 * API de Alertas para Usuarios
 * ============================
 *
 * GET: Lista alertas del usuario autenticado
 * POST: Crea una nueva alerta (uso interno)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ALERT_TYPES, type AlertType, type CreateAlertInput } from "@/lib/alerts";

/**
 * GET /api/alerts
 * Lista alertas del usuario autenticado
 *
 * Query params:
 * - unreadOnly: si es "true", solo devuelve alertas no leidas
 * - limit: numero maximo de alertas (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const alerts = await prisma.alert.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(unreadOnly && { read: false }),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    // Contar alertas no leidas
    const unreadCount = await prisma.alert.count({
      where: {
        tenantId: session.user.tenantId,
        read: false,
      },
    });

    return NextResponse.json({
      success: true,
      alerts: alerts.map((alert) => ({
        id: alert.id,
        type: alert.type,
        message: alert.message,
        read: alert.read,
        metadata: alert.metadata,
        createdAt: alert.createdAt.toISOString(),
        readAt: alert.readAt?.toISOString(),
      })),
      unreadCount,
    });
  } catch (error) {
    console.error("Error obteniendo alertas:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alerts
 * Crea una nueva alerta (uso interno desde otros endpoints)
 *
 * Body: CreateAlertInput
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateAlertInput = await request.json();

    // Validar datos requeridos
    if (!body.tenantId || !body.type || !body.message) {
      return NextResponse.json(
        { success: false, error: "tenantId, type y message son requeridos" },
        { status: 400 }
      );
    }

    // Validar tipo de alerta
    if (!Object.values(ALERT_TYPES).includes(body.type)) {
      return NextResponse.json(
        { success: false, error: `Tipo de alerta invalido. Tipos validos: ${Object.values(ALERT_TYPES).join(", ")}` },
        { status: 400 }
      );
    }

    // Verificar que el tenant existe
    const tenant = await prisma.tenant.findUnique({
      where: { id: body.tenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    // Crear la alerta
    const alert = await prisma.alert.create({
      data: {
        tenantId: body.tenantId,
        type: body.type,
        message: body.message,
        metadata: body.metadata ? JSON.parse(JSON.stringify(body.metadata)) : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      alert: {
        id: alert.id,
        type: alert.type,
        message: alert.message,
        read: alert.read,
        metadata: alert.metadata,
        createdAt: alert.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error creando alerta:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
