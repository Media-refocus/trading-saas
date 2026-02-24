import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

interface HeartbeatData {
  status: string;
  mt5Connected: boolean;
  openPositions: number;
  currentLevel: number;
  currentSide: string | null;
  totalTrades: number;
  totalProfit: number;
  version?: string;
  platform?: string;
  error?: string;
}

/**
 * POST /api/bot/heartbeat
 * Recibe telemetry del bot
 *
 * Headers: Authorization: Bearer <apiKey>
 * Body: HeartbeatData
 */
export async function POST(request: Request) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Authorization header requerido" },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);
    const hashedKey = crypto.createHash("sha256").update(apiKey).digest("hex");

    const botConfig = await prisma.botConfig.findUnique({
      where: { apiKey: hashedKey },
    });

    if (!botConfig) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const data: HeartbeatData = await request.json();

    // Validar datos requeridos
    if (!data.status) {
      return NextResponse.json(
        { success: false, error: "status es requerido" },
        { status: 400 }
      );
    }

    // Crear registro de heartbeat
    await prisma.botHeartbeat.create({
      data: {
        tenantId: botConfig.tenantId,
        status: data.status,
        mt5Connected: data.mt5Connected ?? false,
        openPositions: data.openPositions ?? 0,
        currentLevel: data.currentLevel ?? 0,
        currentSide: data.currentSide,
        totalTrades: data.totalTrades ?? 0,
        totalProfit: data.totalProfit ?? 0,
        version: data.version,
        platform: data.platform,
        error: data.error,
      },
    });

    // Actualizar último heartbeat en BotConfig
    await prisma.botConfig.update({
      where: { id: botConfig.id },
      data: { lastHeartbeat: new Date() },
    });

    // Verificar si hay comandos pendientes para el bot
    // (por ejemplo: STOP, RESTART, UPDATE_CONFIG)
    // Por ahora devolvemos siempre OK
    return NextResponse.json({
      success: true,
      command: null, // Futuro: "STOP", "RESTART", "UPDATE_CONFIG"
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error procesando heartbeat:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bot/heartbeat
 * Obtiene el último estado del bot (para dashboard)
 *
 * Headers: Authorization: Bearer <apiKey>
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Authorization header requerido" },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);
    const hashedKey = crypto.createHash("sha256").update(apiKey).digest("hex");

    const botConfig = await prisma.botConfig.findUnique({
      where: { apiKey: hashedKey },
    });

    if (!botConfig) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    // Obtener último heartbeat
    const lastHeartbeat = await prisma.botHeartbeat.findFirst({
      where: { tenantId: botConfig.tenantId },
      orderBy: { receivedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      lastHeartbeat: lastHeartbeat
        ? {
            status: lastHeartbeat.status,
            mt5Connected: lastHeartbeat.mt5Connected,
            openPositions: lastHeartbeat.openPositions,
            currentLevel: lastHeartbeat.currentLevel,
            currentSide: lastHeartbeat.currentSide,
            totalTrades: lastHeartbeat.totalTrades,
            totalProfit: lastHeartbeat.totalProfit,
            version: lastHeartbeat.version,
            platform: lastHeartbeat.platform,
            error: lastHeartbeat.error,
            receivedAt: lastHeartbeat.receivedAt.toISOString(),
          }
        : null,
      configLastHeartbeat: botConfig.lastHeartbeat?.toISOString(),
    });
  } catch (error) {
    console.error("Error obteniendo heartbeat:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
