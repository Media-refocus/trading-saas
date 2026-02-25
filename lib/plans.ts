/**
 * Sistema de Planes y Límites
 * ===========================
 *
 * Funciones para verificar y aplicar límites según el plan del tenant.
 */

import { prisma } from "./prisma";

// Plan por defecto cuando un tenant no tiene plan asignado
const DEFAULT_PLAN_LIMITS = {
  maxPositions: 1,
  maxBrokers: 1,
  maxLevels: 2,
  hasTrailingSL: true,
  hasAdvancedGrid: false,
  hasPriority: false,
};

export interface PlanLimits {
  maxPositions: number;
  maxBrokers: number;
  maxLevels: number;
  hasTrailingSL: boolean;
  hasAdvancedGrid: boolean;
  hasPriority: boolean;
  planName: string;
  planId: string | null;
}

/**
 * Obtiene los límites del plan de un tenant
 */
export async function getTenantPlanLimits(tenantId: string): Promise<PlanLimits> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: true },
  });

  if (!tenant) {
    throw new Error(`Tenant ${tenantId} no encontrado`);
  }

  // Si tiene plan asignado, usar sus límites
  if (tenant.plan) {
    return {
      maxPositions: tenant.plan.maxPositions,
      maxBrokers: tenant.plan.maxBrokers,
      maxLevels: tenant.plan.maxLevels,
      hasTrailingSL: tenant.plan.hasTrailingSL,
      hasAdvancedGrid: tenant.plan.hasAdvancedGrid,
      hasPriority: tenant.plan.hasPriority,
      planName: tenant.plan.name,
      planId: tenant.plan.id,
    };
  }

  // Sin plan asignado, usar límites por defecto
  return {
    ...DEFAULT_PLAN_LIMITS,
    planName: "Free",
    planId: null,
  };
}

/**
 * Verifica si un valor está dentro del límite del plan
 */
export function checkLimit(value: number, max: number): { allowed: boolean; remaining: number } {
  return {
    allowed: value < max,
    remaining: Math.max(0, max - value),
  };
}

/**
 * Verifica si el tenant puede abrir más posiciones
 */
export async function canOpenPosition(tenantId: string): Promise<{ allowed: boolean; reason?: string; remaining: number }> {
  const limits = await getTenantPlanLimits(tenantId);
  
  // Contar posiciones abiertas actuales
  const openPositions = await prisma.position.count({
    where: {
      tenantId,
      status: "OPEN",
    },
  });

  const check = checkLimit(openPositions, limits.maxPositions);
  
  if (!check.allowed) {
    return {
      allowed: false,
      reason: `Límite de posiciones alcanzado (${limits.maxPositions}). Haz upgrade a un plan superior.`,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    remaining: check.remaining,
  };
}

/**
 * Verifica si el tenant puede usar más niveles de promedio
 */
export async function canUseLevel(
  tenantId: string, 
  requestedLevel: number
): Promise<{ allowed: boolean; reason?: string; maxLevels: number }> {
  const limits = await getTenantPlanLimits(tenantId);

  if (requestedLevel > limits.maxLevels) {
    return {
      allowed: false,
      reason: `Tu plan ${limits.planName} solo permite ${limits.maxLevels} niveles. Solicitado: ${requestedLevel}`,
      maxLevels: limits.maxLevels,
    };
  }

  return {
    allowed: true,
    maxLevels: limits.maxLevels,
  };
}

/**
 * Verifica si el tenant puede usar trailing SL
 */
export async function canUseTrailingSL(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getTenantPlanLimits(tenantId);

  if (!limits.hasTrailingSL) {
    return {
      allowed: false,
      reason: `Tu plan ${limits.planName} no incluye Trailing Stop Loss. Haz upgrade a Pro o Enterprise.`,
    };
  }

  return { allowed: true };
}

/**
 * Verifica si el tenant puede usar grid avanzado
 */
export async function canUseAdvancedGrid(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getTenantPlanLimits(tenantId);

  if (!limits.hasAdvancedGrid) {
    return {
      allowed: false,
      reason: `Tu plan ${limits.planName} no incluye Grid Avanzado. Haz upgrade a Pro o Enterprise.`,
    };
  }

  return { allowed: true };
}

/**
 * Aplica límites a la configuración del bot
 * Modifica la configuración para que respete los límites del plan
 */
export async function applyPlanLimits(
  tenantId: string,
  config: {
    maxLevels?: number;
    trailingActivate?: number | null;
    trailingStep?: number | null;
    trailingBack?: number | null;
  }
): Promise<{
  config: typeof config;
  warnings: string[];
  limited: boolean;
}> {
  const limits = await getTenantPlanLimits(tenantId);
  const warnings: string[] = [];
  let limited = false;
  const result = { ...config };

  // Limitar maxLevels
  if (result.maxLevels && result.maxLevels > limits.maxLevels) {
    result.maxLevels = limits.maxLevels;
    warnings.push(`maxLevels limitado a ${limits.maxLevels} por tu plan ${limits.planName}`);
    limited = true;
  }

  // Deshabilitar trailing SL si no está permitido
  if (!limits.hasTrailingSL && (result.trailingActivate || result.trailingStep || result.trailingBack)) {
    result.trailingActivate = null;
    result.trailingStep = null;
    result.trailingBack = null;
    warnings.push(`Trailing SL deshabilitado por tu plan ${limits.planName}`);
    limited = true;
  }

  return { config: result, warnings, limited };
}

/**
 * Obtiene información del plan para mostrar en el dashboard
 */
export async function getPlanInfo(tenantId: string): Promise<{
  current: PlanLimits;
  plans: Array<{
    id: string;
    name: string;
    price: number;
    currency: string;
    maxPositions: number;
    maxLevels: number;
    hasTrailingSL: boolean;
    hasAdvancedGrid: boolean;
    hasPriority: boolean;
  }>;
}> {
  const [limits, plans] = await Promise.all([
    getTenantPlanLimits(tenantId),
    prisma.plan.findMany({
      orderBy: { price: "asc" },
      select: {
        id: true,
        name: true,
        price: true,
        currency: true,
        maxPositions: true,
        maxLevels: true,
        hasTrailingSL: true,
        hasAdvancedGrid: true,
        hasPriority: true,
      },
    }),
  ]);

  return {
    current: limits,
    plans,
  };
}
