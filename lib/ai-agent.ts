/**
 * AI Agent Service - Asistente de Trading Inteligente
 *
 * Agente de IA conversacional que actúa como asistente personal de trading.
 * Solo disponible para plan VIP (197 EUR).
 *
 * Capacidades:
 * - Análisis de operativa y rendimiento
 * - Gestión de riesgo y position sizing
 * - Soporte educativo
 * - Configuración del bot via chat
 */

import { prisma } from "./prisma";

// Configuración de OpenAI/Anthropic
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Usar Claude si está disponible, sino GPT-4
const USE_CLAUDE = !!ANTHROPIC_API_KEY;

interface TradingContext {
  tenantId: string;
  tenantName: string;
  plan: string;
  botStatus: string;
  openPositions: number;
  balance: number;
  equity: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  totalTrades: number;
  winRate: number;
  avgProfit: number;
  avgLoss: number;
  maxDrawdown: number;
  lastTrades: Array<{
    symbol: string;
    side: string;
    openedAt: Date;
    closedAt: Date | null;
    profitMoney: number | null;
    profitPips: number | null;
    closeReason: string | null;
  }>;
  botConfig: {
    symbol: string;
    entryLot: number;
    gridStepPips: number;
    gridMaxLevels: number;
    dailyLossLimitPercent: number | null;
  } | null;
}

interface AIResponse {
  success: boolean;
  message: string;
  action?: AIAction;
  error?: string;
}

interface AIAction {
  type: "UPDATE_CONFIG" | "PAUSE_BOT" | "RESUME_BOT" | "CLOSE_ALL";
  params?: Record<string, unknown>;
}

/**
 * Verificar si el tenant tiene acceso al AI Agent (solo VIP)
 */
export async function canUseAIAgent(tenantId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId },
    select: { plan: true, status: true },
  });

  if (!subscription) return false;

  // Solo plan ENTERPRISE (VIP) tiene acceso
  return subscription.plan === "ENTERPRISE" && subscription.status === "ACTIVE";
}

/**
 * Obtener contexto completo del usuario para el AI Agent
 */
export async function getTradingContext(tenantId: string): Promise<TradingContext | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscriptions: {
        where: { status: "ACTIVE" },
        take: 1,
      },
      botConfigs: {
        include: {
          heartbeats: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!tenant) return null;

  // Obtener trades de los últimos 30 días
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const trades = await prisma.trade.findMany({
    where: {
      tenantId,
      openedAt: { gte: thirtyDaysAgo },
    },
    orderBy: { openedAt: "desc" },
    take: 50,
  });

  // Calcular métricas
  const closedTrades = trades.filter((t) => t.status === "CLOSED");
  const winningTrades = closedTrades.filter((t) => (t.profitMoney ?? 0) > 0);
  const losingTrades = closedTrades.filter((t) => (t.profitMoney ?? 0) < 0);

  const totalProfit = closedTrades.reduce((sum, t) => sum + (t.profitMoney ?? 0), 0);
  const totalPips = closedTrades.reduce((sum, t) => sum + (t.profitPips ?? 0), 0);

  const avgProfit =
    winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.profitMoney ?? 0), 0) / winningTrades.length
      : 0;

  const avgLoss =
    losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + (t.profitMoney ?? 0), 0) / losingTrades.length)
      : 0;

  // Calcular P&L por período
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const monthStart = new Date(today);
  monthStart.setDate(1);

  const dailyPnL = closedTrades
    .filter((t) => t.closedAt && t.closedAt >= today)
    .reduce((sum, t) => sum + (t.profitMoney ?? 0), 0);

  const weeklyPnL = closedTrades
    .filter((t) => t.closedAt && t.closedAt >= weekStart)
    .reduce((sum, t) => sum + (t.profitMoney ?? 0), 0);

  const monthlyPnL = closedTrades
    .filter((t) => t.closedAt && t.closedAt >= monthStart)
    .reduce((sum, t) => sum + (t.profitMoney ?? 0), 0);

  // Obtener balance de cuentas
  const accounts = await prisma.botAccount.findMany({
    where: {
      botConfig: { tenantId },
      isActive: true,
    },
  });

  const balance = accounts.reduce((sum, a) => sum + (a.lastBalance ?? 0), 0);
  const equity = accounts.reduce((sum, a) => sum + (a.lastEquity ?? 0), 0);

  // Calcular max drawdown
  let maxEquity = 0;
  let maxDrawdown = 0;
  let runningEquity = balance;

  for (const trade of [...closedTrades].reverse()) {
    runningEquity += trade.profitMoney ?? 0;
    if (runningEquity > maxEquity) maxEquity = runningEquity;
    const drawdown = maxEquity - runningEquity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    plan: tenant.subscriptions[0]?.plan ?? tenant.plan,
    botStatus: tenant.botConfigs?.[0]?.status ?? "OFFLINE",
    openPositions: tenant.botConfigs?.[0]?.heartbeats[0]?.openPositions ?? 0,
    balance,
    equity,
    dailyPnL,
    weeklyPnL,
    monthlyPnL,
    totalTrades: closedTrades.length,
    winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
    avgProfit,
    avgLoss,
    maxDrawdown,
    lastTrades: trades.slice(0, 10).map((t) => ({
      symbol: t.symbol,
      side: t.side,
      openedAt: t.openedAt,
      closedAt: t.closedAt,
      profitMoney: t.profitMoney,
      profitPips: t.profitPips,
      closeReason: t.closeReason,
    })),
    botConfig: tenant.botConfigs?.[0]
      ? {
          symbol: tenant.botConfigs[0].symbol,
          entryLot: tenant.botConfigs[0].entryLot,
          gridStepPips: tenant.botConfigs[0].gridStepPips,
          gridMaxLevels: tenant.botConfigs[0].gridMaxLevels,
          dailyLossLimitPercent: tenant.botConfigs[0].dailyLossLimitPercent,
        }
      : null,
  };
}

/**
 * Construir el prompt del sistema para el AI Agent
 */
function buildSystemPrompt(context: TradingContext): string {
  return `Eres Xisco, un asistente de trading experto y amigable. Ayudas a traders a gestionar su bot de trading automático y a tomar mejores decisiones.

## Contexto del Usuario

**Nombre:** ${context.tenantName}
**Plan:** ${context.plan}
**Estado del Bot:** ${context.botStatus}

### Métricas de Trading (últimos 30 días)
- Balance actual: ${context.balance.toFixed(2)} EUR
- Equity: ${context.equity.toFixed(2)} EUR
- P&L Hoy: ${context.dailyPnL >= 0 ? "+" : ""}${context.dailyPnL.toFixed(2)} EUR
- P&L Semana: ${context.weeklyPnL >= 0 ? "+" : ""}${context.weeklyPnL.toFixed(2)} EUR
- P&L Mes: ${context.monthlyPnL >= 0 ? "+" : ""}${context.monthlyPnL.toFixed(2)} EUR
- Total operaciones: ${context.totalTrades}
- Win Rate: ${context.winRate.toFixed(1)}%
- Ganancia media: +${context.avgProfit.toFixed(2)} EUR
- Pérdida media: -${context.avgLoss.toFixed(2)} EUR
- Max Drawdown: -${context.maxDrawdown.toFixed(2)} EUR
- Posiciones abiertas: ${context.openPositions}

### Configuración del Bot
${
  context.botConfig
    ? `- Símbolo: ${context.botConfig.symbol}
- Lote entrada: ${context.botConfig.entryLot}
- Grid Step: ${context.botConfig.gridStepPips} pips
- Niveles máximos: ${context.botConfig.gridMaxLevels}
- Daily Loss Limit: ${context.botConfig.dailyLossLimitPercent ?? "No configurado"}%`
    : "Bot no configurado"
}

### Últimas Operaciones
${context.lastTrades
  .map(
    (t) =>
      `- ${t.symbol} ${t.side}: ${t.profitMoney !== null ? (t.profitMoney >= 0 ? "+" : "") + t.profitMoney.toFixed(2) + " EUR" : "Abierta"}`
  )
  .join("\n")}

## Tu Personalidad

1. **Experto pero accesible** - Usas terminología técnica pero la explicas de forma simple
2. **Cauteloso con el riesgo** - Siempre priorizas la protección del capital
3. **Proactivo** - Sugieres mejoras cuando ves patrones problemáticos
4. **Honesto** - No prometes ganancias, hablas de probabilidades y gestión de riesgo

## Comandos que Puedes Ejecutar

Cuando el usuario te pida cambiar la configuración, responde con el mensaje explicativo y, si aplica, incluye un JSON con la acción:

- Para cambiar lote: {"action": "UPDATE_CONFIG", "params": {"entryLot": 0.05}}
- Para cambiar niveles: {"action": "UPDATE_CONFIG", "params": {"gridMaxLevels": 4}}
- Para pausar: {"action": "PAUSE_BOT"}
- Para reanudar: {"action": "RESUME_BOT"}
- Para cerrar todo: {"action": "CLOSE_ALL"}

## Reglas Importantes

1. NUNCA des consejos de inversión específicos sobre cuándo entrar/salir del mercado
2. SIEMPRE prioriza la gestión de riesgo sobre las ganancias
3. Si detectas comportamiento problemático (overtrading, falta de stops, etc.), advertícelo
4. Sé conciso pero completo en tus respuestas
5. Usa emojis con moderación para hacer las respuestas más amigables

## Ejemplos de Respuestas

Usuario: "Cómo voy esta semana?"
Respuesta: "📊 Esta semana vas +${context.weeklyPnL.toFixed(2)} EUR con ${context.totalTrades} operaciones. Tu win rate del ${context.winRate.toFixed(1)}% está ${context.winRate > 50 ? "bien" : "por debajo del 50%, quizás convenga revisar la estrategia"}. Recuerda mantener el Daily Loss Limit activo."

Usuario: "Qué lote me recomiendas?"
Respuesta: "Con tu balance de ${context.balance.toFixed(2)} EUR, te recomendaría no superar el 1-2% de riesgo por operación. Con tu configuración actual de ${context.botConfig?.gridMaxLevels ?? 4} niveles, un lote de 0.01-0.02 sería conservador. ¿Quieres que lo ajuste?"`;
}

/**
 * Procesar mensaje del usuario con IA
 */
export async function processAIMessage(
  tenantId: string,
  userMessage: string
): Promise<AIResponse> {
  // Verificar acceso
  const hasAccess = await canUseAIAgent(tenantId);
  if (!hasAccess) {
    return {
      success: false,
      message: "El Agente IA está disponible solo para el plan VIP. Actualiza tu plan para acceder.",
      error: "PLAN_NOT_ALLOWED",
    };
  }

  // Obtener contexto
  const context = await getTradingContext(tenantId);
  if (!context) {
    return {
      success: false,
      message: "No pude obtener tu información de trading. Intenta de nuevo.",
      error: "CONTEXT_ERROR",
    };
  }

  const systemPrompt = buildSystemPrompt(context);

  try {
    let aiMessage: string;

    if (USE_CLAUDE) {
      // Usar Claude API
      aiMessage = await callClaudeAPI(systemPrompt, userMessage);
    } else if (OPENAI_API_KEY) {
      // Usar OpenAI API
      aiMessage = await callOpenAIAPI(systemPrompt, userMessage);
    } else {
      // Modo demo sin API
      aiMessage = generateDemoResponse(userMessage, context);
    }

    // Detectar si hay una acción a ejecutar
    const actionMatch = aiMessage.match(/\{"action":\s*"([^"]+)"(?:,\s*"params":\s*(\{[^}]+\}))?\}/);

    let action: AIResponse["action"] = undefined;
    let cleanMessage = aiMessage;

    if (actionMatch) {
      const actionType = actionMatch[1] as AIAction["type"];
      const params = actionMatch[2] ? JSON.parse(actionMatch[2]) : undefined;

      action = { type: actionType, params };
      cleanMessage = aiMessage.replace(actionMatch[0], "").trim();
    }

    return {
      success: true,
      message: cleanMessage,
      action,
    };
  } catch (error) {
    console.error("[AI Agent] Error:", error);
    return {
      success: false,
      message: "Hubo un error procesando tu mensaje. Intenta de nuevo.",
      error: String(error),
    };
  }
}

/**
 * Llamar a Claude API (Anthropic)
 */
async function callClaudeAPI(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

/**
 * Llamar a OpenAI API
 */
async function callOpenAIAPI(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Generar respuesta demo cuando no hay API key configurada
 */
function generateDemoResponse(userMessage: string, context: TradingContext): string {
  const lowerMessage = userMessage.toLowerCase();

  // Detectar intención
  if (lowerMessage.includes("como voy") || lowerMessage.includes("cómo voy") || lowerMessage.includes("resumen")) {
    return `📊 **Resumen de tu Operativa**

Hola ${context.tenantName}! Aquí tienes el resumen:

💰 **Balance:** ${context.balance.toFixed(2)} EUR
📈 **P&L Mes:** ${context.monthlyPnL >= 0 ? "+" : ""}${context.monthlyPnL.toFixed(2)} EUR
🎯 **Win Rate:** ${context.winRate.toFixed(1)}%
📊 **Operaciones:** ${context.totalTrades}

${context.winRate > 50 ? "✅ Vas por buen camino!" : "⚠️ Tu win rate está bajo el 50%. Quizás convenga revisar la estrategia."}

_Nota: Modo demo - Configura OPENAI_API_KEY o ANTHROPIC_API_KEY para respuestas inteligentes._`;
  }

  // Verificar comandos de cambio ANTES de consultas sobre lote
  if (lowerMessage.includes("cambia") || lowerMessage.includes("cambiar")) {
    // Intentar parsear cambio de lote
    const lotMatch = lowerMessage.match(/lote?\s*(?:a\s*)?(\d+\.?\d*)/);
    if (lotMatch) {
      const newLot = parseFloat(lotMatch[1]);
      return `✅ Entendido! Cambiaré el lote de entrada a ${newLot}.

{"action": "UPDATE_CONFIG", "params": {"entryLot": ${newLot}}}`;
    }

    // Intentar parsear cambio de niveles
    const levelsMatch = lowerMessage.match(/niveles?\s*(?:a\s*)?(\d+)/);
    if (levelsMatch) {
      const newLevels = parseInt(levelsMatch[1]);
      return `✅ Perfecto! Cambiaré los niveles máximos a ${newLevels}.

{"action": "UPDATE_CONFIG", "params": {"gridMaxLevels": ${newLevels}}}`;
    }
  }

  if (lowerMessage.includes("lote") || lowerMessage.includes("lot")) {
    const recommendedLot = Math.max(0.01, Math.floor((context.balance * 0.01) / 1000) / 100);
    return `🎯 **Recomendación de Lote**

Con tu balance de ${context.balance.toFixed(2)} EUR, te recomiendo:

- **Conservador:** 0.01 - 0.02 (riesgo ~1% por operación)
- **Moderado:** ${recommendedLot.toFixed(2)} (riesgo ~2%)
- **Actual:** ${context.botConfig?.entryLot ?? "No configurado"}

Para cambiar tu lote, escribe: "cambia el lote a 0.02"`;
  }

  if (lowerMessage.includes("pausa") || lowerMessage.includes("parar") || lowerMessage.includes("stop")) {
    return `⏸️ Entendido, pausaré el bot.

{"action": "PAUSE_BOT"}`;
  }

  if (lowerMessage.includes("reanuda") || lowerMessage.includes("continua") || lowerMessage.includes("resume")) {
    return `▶️ Perfecto, reanudaré el bot.

{"action": "RESUME_BOT"}`;
  }

  // Respuesta por defecto
  return `👋 Hola ${context.tenantName}!

Soy Xisco, tu asistente de trading. Puedo ayudarte con:

📊 **Análisis:** "Cómo voy esta semana?"
🎯 **Riesgo:** "Qué lote me recomiendas?"
⚙️ **Config:** "Cambia el lote a 0.02"
⏸️ **Control:** "Pausa el bot" / "Reanuda el bot"

¿En qué puedo ayudarte?`;
}

/**
 * Ejecutar acción solicitada por el AI Agent
 */
export async function executeAIAction(
  tenantId: string,
  action: AIAction
): Promise<{ success: boolean; message: string }> {
  const botConfig = await prisma.botConfig.findUnique({
    where: { tenantId },
  });

  if (!botConfig) {
    return { success: false, message: "No tienes configuración de bot." };
  }

  switch (action.type) {
    case "UPDATE_CONFIG":
      if (action.params) {
        await prisma.botConfig.update({
          where: { tenantId },
          data: action.params,
        });
        return { success: true, message: "Configuración actualizada correctamente." };
      }
      return { success: false, message: "No se especificaron parámetros." };

    case "PAUSE_BOT":
      await prisma.botConfig.update({
        where: { tenantId },
        data: { status: "PAUSED" },
      });
      return { success: true, message: "Bot pausado. No abrirá nuevas operaciones." };

    case "RESUME_BOT":
      await prisma.botConfig.update({
        where: { tenantId },
        data: { status: "ONLINE" },
      });
      return { success: true, message: "Bot reanudado. Continuará operando." };

    case "CLOSE_ALL":
      await prisma.botConfig.update({
        where: { tenantId },
        data: { status: "KILL_REQUESTED" },
      });
      return {
        success: true,
        message: "Kill Switch activado. Se cerrarán todas las posiciones.",
      };

    default:
      return { success: false, message: "Acción no reconocida." };
  }
}
