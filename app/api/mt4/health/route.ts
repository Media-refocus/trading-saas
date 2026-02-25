/**
 * API MT4 - Health Check
 * =======================
 *
 * GET: Verifica que el EA puede conectar con el SaaS
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = searchParams;
  const apiKey = request.nextUrl.searchParams.get("apiKey");

  if (!apiKey) {
    return NextResponse.json({ error: "API Key requerida" }, { status: 401 });
  }

  // Verificar que el API key existe
  const botConfig = await prisma.botConfig.findFirst({
    where: { apiKeyPlain: apiKey },
  });

  if (!botConfig) {
    return NextResponse.json({ error: "API Key inválida" }, { status: 401 });
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    serverTime: Date.now(),
  });
}
