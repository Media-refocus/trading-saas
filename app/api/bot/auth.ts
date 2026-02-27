/**
 * Middleware de autenticación para endpoints del bot
 * Valida API key y proporciona contexto del bot
 * Incluye rate limiting para proteger contra abuso
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractApiKeyFromHeader, validateApiKey } from "@/lib/api-key";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  createRateLimitHeaders,
} from "@/lib/rate-limit";
import { checkAndUpdateExpiredTrial } from "@/lib/plan-gates";

// Cache de bot configs para evitar consultas repetidas
// TTL: 60 segundos
const botConfigCache = new Map<
  string,
  { botConfig: BotConfigContext; cachedAt: number }
>();
const CACHE_TTL_MS = 60 * 1000;

export interface BotConfigContext {
  id: string;
  tenantId: string;
  status: string;
}

export interface BotAuthResult {
  success: true;
  botConfig: BotConfigContext;
}

export interface BotAuthError {
  success: false;
  error: NextResponse;
}

/**
 * Verifica rate limiting antes de procesar la autenticacion
 * Se aplica por IP para proteger contra ataques de fuerza bruta
 */
export function checkBotRateLimit(
  request: NextRequest
): { allowed: true } | { allowed: false; error: NextResponse } {
  const clientIp = getClientIp(request);
  const rateLimitKey = `bot:${clientIp}`;
  const result = checkRateLimit(rateLimitKey, RATE_LIMITS.bot);

  if (!result.allowed) {
    const headers = createRateLimitHeaders(result);
    return {
      allowed: false,
      error: NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Demasiadas solicitudes. Intenta de nuevo en ${result.retryAfter} segundos.`,
          retryAfter: result.retryAfter,
        },
        { status: 429, headers }
      ),
    };
  }

  return { allowed: true };
}

/**
 * Autentica una request del bot usando la API key
 *
 * @param request - NextRequest con header Authorization
 * @returns BotAuthResult si es válido, BotAuthError si no
 *
 * @example
 * const auth = await authenticateBot(request);
 * if (!auth.success) {
 *   return auth.error;
 * }
 * const { botConfig } = auth;
 */
export async function authenticateBot(
  request: NextRequest
): Promise<BotAuthResult | BotAuthError> {
  // Verificar rate limiting primero
  const rateLimitCheck = checkBotRateLimit(request);
  if (!rateLimitCheck.allowed) {
    return { success: false, error: rateLimitCheck.error };
  }

  const authHeader = request.headers.get("authorization");
  const apiKey = extractApiKeyFromHeader(authHeader);

  if (!apiKey) {
    return {
      success: false,
      error: NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      ),
    };
  }

  // Buscar en cache primero
  const cached = botConfigCache.get(apiKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { success: true, botConfig: cached.botConfig };
  }

  // Buscar todos los bot configs activos
  // Nota: En producción con PostgreSQL, usaríamos un índice específico
  const botConfigs = await prisma.botConfig.findMany({
    select: {
      id: true,
      tenantId: true,
      apiKeyHash: true,
      status: true,
    },
  });

  // Validar API key contra cada hash
  for (const config of botConfigs) {
    const isValid = await validateApiKey(apiKey, config.apiKeyHash);

    if (isValid) {
      const botConfigContext: BotConfigContext = {
        id: config.id,
        tenantId: config.tenantId,
        status: config.status,
      };

      // Check subscription status - auto-pause expired trials
      const subscriptionInfo = await checkAndUpdateExpiredTrial(config.tenantId);

      // If subscription is paused, deny access
      if (subscriptionInfo.status === "PAUSED" || subscriptionInfo.status === "CANCELED") {
        return {
          success: false,
          error: NextResponse.json(
            {
              error: "Subscription paused or expired",
              code: "SUBSCRIPTION_PAUSED",
              message: "Tu suscripción está pausada. Actívala desde el dashboard.",
            },
            { status: 403 }
          ),
        };
      }

      // Guardar en cache
      botConfigCache.set(apiKey, {
        botConfig: botConfigContext,
        cachedAt: Date.now(),
      });

      return { success: true, botConfig: botConfigContext };
    }
  }

  return {
    success: false,
    error: NextResponse.json(
      { error: "Invalid API key" },
      { status: 401 }
    ),
  };
}

/**
 * Obtiene el config completo del bot desde DB
 */
export async function getFullBotConfig(botConfigId: string) {
  return prisma.botConfig.findUnique({
    where: { id: botConfigId },
    include: {
      botAccounts: {
        where: { isActive: true },
      },
    },
  });
}

/**
 * Invalida el cache de autenticación (útil al cambiar API keys)
 */
export function invalidateAuthCache(apiKey?: string) {
  if (apiKey) {
    botConfigCache.delete(apiKey);
  } else {
    botConfigCache.clear();
  }
}

/**
 * Helper para respuestas de error estandarizadas
 */
export function botErrorResponse(
  message: string,
  status: number = 400,
  code?: string
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * Helper para respuestas exitosas estandarizadas
 */
export function botSuccessResponse<T>(data: T): NextResponse {
  return NextResponse.json({
    success: true,
    ...data,
    timestamp: new Date().toISOString(),
  });
}
