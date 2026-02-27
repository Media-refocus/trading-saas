/**
 * Plan Enforcement - Feature Gates for Subscription Tiers
 *
 * NUEVO PRICING 2026:
 * - TRADER €57/mes: Bot completo + protección básica
 * - PRO €97/mes: Multi-cuenta + features avanzadas
 * - VIP €197/mes: Cuentas ilimitadas + acceso exclusivo
 *
 * Trial users get PRO features durante 14 días.
 */

import { prisma } from "@/lib/prisma";
import type { PlanType, SubscriptionStatus } from "@prisma/client";

/**
 * Feature flags for each plan tier
 */
export interface PlanFeatures {
  // Core features (disponible en todos los planes)
  botSignals: boolean; // Bot de señales XAUUSD
  dashboard: boolean; // Dashboard básico
  heartbeat: boolean; // Monitoreo de estado del bot
  backtester: boolean; // Backtesting engine

  // Account limits
  maxMt5Accounts: number; // Maximum MT5 accounts

  // Protection features (TRADER+)
  dailyLossLimit: boolean; // Límite de pérdida diaria
  killSwitch: boolean; // Emergency kill switch

  // Automation (TRADER+)
  telegramBot: boolean; // Telegram notificaciones

  // Pro features (PRO+)
  circuitBreaker: boolean; // Pausa automática en volatilidad extrema
  newsFilter: boolean; // News filter
  tradingView: boolean; // TradingView bridge
  webhooks: boolean; // Webhooks personalizados

  // Analytics (PRO+)
  analyticsPro: boolean; // Métricas profesionales
  equityCurve: boolean; // Equity curve interactiva
  heatmap: boolean; // Heatmap rendimiento horario

  // Smart trading (PRO+)
  smartEntry: boolean; // Smart entry filter
  smartTrailing: boolean; // Smart trailing ATR-based

  // VIP features (VIP only)
  unlimitedAccounts: boolean; // Cuentas ilimitadas
  vipCommunity: boolean; // Acceso canal VIP con Xisco
  prioritySupport: boolean; // Soporte prioritario
  earlyAccess: boolean; // Nuevas features antes
}

/**
 * Features available for each plan
 * Trial users get PRO features
 */
const PLAN_FEATURES: Record<PlanType | "TRIAL", PlanFeatures> = {
  TRIAL: {
    // Trial obtiene PRO features
    botSignals: true,
    dashboard: true,
    heartbeat: true,
    backtester: true,
    maxMt5Accounts: 3,
    dailyLossLimit: true,
    killSwitch: true,
    telegramBot: true,
    circuitBreaker: true,
    newsFilter: true,
    tradingView: true,
    webhooks: true,
    analyticsPro: true,
    equityCurve: true,
    heatmap: true,
    smartEntry: true,
    smartTrailing: true,
    unlimitedAccounts: false,
    vipCommunity: false,
    prioritySupport: false,
    earlyAccess: false,
  },
  BASIC: {
    // TRADER €57/mes - Todo lo esencial + protección
    botSignals: true,
    dashboard: true,
    heartbeat: true,
    backtester: true,
    maxMt5Accounts: 1,
    dailyLossLimit: true,
    killSwitch: true,
    telegramBot: true,
    circuitBreaker: false,
    newsFilter: false,
    tradingView: false,
    webhooks: false,
    analyticsPro: false,
    equityCurve: false,
    heatmap: false,
    smartEntry: false,
    smartTrailing: false,
    unlimitedAccounts: false,
    vipCommunity: false,
    prioritySupport: false,
    earlyAccess: false,
  },
  PRO: {
    // PRO €97/mes - Multi-cuenta + features avanzadas
    botSignals: true,
    dashboard: true,
    heartbeat: true,
    backtester: true,
    maxMt5Accounts: 3,
    dailyLossLimit: true,
    killSwitch: true,
    telegramBot: true,
    circuitBreaker: true,
    newsFilter: true,
    tradingView: true,
    webhooks: true,
    analyticsPro: true,
    equityCurve: true,
    heatmap: true,
    smartEntry: true,
    smartTrailing: true,
    unlimitedAccounts: false,
    vipCommunity: false,
    prioritySupport: false,
    earlyAccess: false,
  },
  ENTERPRISE: {
    // VIP €197/mes - Todo ilimitado + exclusividad
    botSignals: true,
    dashboard: true,
    heartbeat: true,
    backtester: true,
    maxMt5Accounts: Infinity,
    dailyLossLimit: true,
    killSwitch: true,
    telegramBot: true,
    circuitBreaker: true,
    newsFilter: true,
    tradingView: true,
    webhooks: true,
    analyticsPro: true,
    equityCurve: true,
    heatmap: true,
    smartEntry: true,
    smartTrailing: true,
    unlimitedAccounts: true,
    vipCommunity: true,
    prioritySupport: true,
    earlyAccess: true,
  },
};

/**
 * Get features available for a specific plan
 */
export function getPlanFeatures(plan: PlanType | "TRIAL"): PlanFeatures {
  return PLAN_FEATURES[plan] ?? PLAN_FEATURES.BASIC;
}

/**
 * Check if a specific feature is available for a plan
 */
export function hasFeature(
  plan: PlanType | "TRIAL",
  feature: keyof PlanFeatures
): boolean {
  const features = getPlanFeatures(plan);
  const value = features[feature];
  return typeof value === "boolean" ? value : value > 0;
}

/**
 * Get the effective plan for a tenant based on subscription status
 */
export function getEffectivePlan(
  status: SubscriptionStatus,
  plan: PlanType,
  trialEnd?: Date | null
): PlanType | "TRIAL" {
  const now = new Date();

  switch (status) {
    case "TRIAL":
      if (trialEnd && trialEnd > now) {
        return "TRIAL";
      }
      return "BASIC";

    case "ACTIVE":
      return plan;

    case "PAST_DUE":
      return plan;

    case "PAUSED":
    case "CANCELED":
      return "BASIC";

    default:
      return "BASIC";
  }
}

/**
 * Subscription info for plan enforcement
 */
export interface SubscriptionInfo {
  status: SubscriptionStatus;
  plan: PlanType;
  trialEnd?: Date | null;
}

/**
 * Get subscription info for a tenant
 */
export async function getTenantSubscription(
  tenantId: string
): Promise<SubscriptionInfo | null> {
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId },
    select: {
      status: true,
      plan: true,
      trialEnd: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return subscription;
}

/**
 * Plan names for display
 */
export const PLAN_NAMES: Record<PlanType | "TRIAL", string> = {
  TRIAL: "Pro (Trial)",
  BASIC: "Trader",
  PRO: "Pro",
  ENTERPRISE: "VIP",
};

/**
 * Plan prices for display (EUR/month)
 */
export const PLAN_PRICES: Record<PlanType, number> = {
  BASIC: 57,
  PRO: 97,
  ENTERPRISE: 197,
};

/**
 * Check if a tenant's trial has expired and auto-pause if needed
 */
export async function checkAndUpdateExpiredTrial(
  tenantId: string
): Promise<SubscriptionInfo> {
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId },
    select: {
      id: true,
      status: true,
      plan: true,
      trialEnd: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    return {
      status: "PAUSED",
      plan: "BASIC",
      trialEnd: null,
    };
  }

  const now = new Date();

  if (
    subscription.status === "TRIAL" &&
    subscription.trialEnd &&
    subscription.trialEnd < now
  ) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "PAUSED" },
    });

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { plan: "TRIAL" },
    });

    return {
      status: "PAUSED",
      plan: subscription.plan,
      trialEnd: subscription.trialEnd,
    };
  }

  return {
    status: subscription.status,
    plan: subscription.plan,
    trialEnd: subscription.trialEnd,
  };
}

/**
 * Check if a tenant has active access (not paused)
 */
export async function hasActiveAccess(tenantId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId },
    select: {
      status: true,
      trialEnd: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    return false;
  }

  const now = new Date();

  switch (subscription.status) {
    case "TRIAL":
      return subscription.trialEnd ? subscription.trialEnd > now : false;

    case "ACTIVE":
    case "PAST_DUE":
      return true;

    case "PAUSED":
    case "CANCELED":
      return false;

    default:
      return false;
  }
}

/**
 * Feature requirement type for middleware
 */
export type FeatureRequirement = keyof PlanFeatures;
