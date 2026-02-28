/**
 * Test endpoint for AI Agent
 *
 * GET /api/test/ai-agent?tenantId=xxx&message=Hola
 * POST /api/test/ai-agent { tenantId: "xxx", message: "Hola" }
 *
 * Only for development/testing
 */

import { NextRequest, NextResponse } from "next/server";
import { processAIMessage, canUseAIAgent, getTradingContext } from "@/lib/ai-agent";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");
  const message = searchParams.get("message");

  if (!tenantId) {
    return NextResponse.json({
      error: "tenantId required",
      usage: "/api/test/ai-agent?tenantId=xxx&message=Hola"
    });
  }

  // Check access
  const canUse = await canUseAIAgent(tenantId);
  if (!canUse) {
    return NextResponse.json({
      error: "AI Agent requires ENTERPRISE plan",
      tenantId,
      upgrade: "Update subscription to ENTERPRISE plan"
    });
  }

  // Get context for debugging
  if (!message) {
    const context = await getTradingContext(tenantId);
    return NextResponse.json({
      message: "AI Agent Test Endpoint",
      tenantId,
      hasAccess: canUse,
      context: context ? {
        tenantName: context.tenantName,
        plan: context.plan,
        botStatus: context.botStatus,
        balance: context.balance,
        equity: context.equity,
        dailyPnL: context.dailyPnL,
        totalTrades: context.totalTrades,
        winRate: context.winRate,
      } : null,
      usage: "Add &message=Your question to test"
    });
  }

  // Process message
  const result = await processAIMessage(tenantId, message);

  return NextResponse.json({
    tenantId,
    message,
    response: result.message,
    action: result.action,
    success: result.success,
    error: result.error,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenantId, message } = body;

  if (!tenantId || !message) {
    return NextResponse.json({
      error: "tenantId and message required"
    }, { status: 400 });
  }

  const result = await processAIMessage(tenantId, message);

  return NextResponse.json({
    success: result.success,
    response: result.message,
    action: result.action,
    error: result.error,
  });
}
