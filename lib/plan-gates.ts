/**
 * Plan Enforcement - Feature Gates for Subscription Tiers
 *
 * This module defines which features are available for each plan tier:
 * - BASIC: Core bot functionality, 1 MT5 account
 * - PRO: Protection features, analytics, automation
 * - ENTERPRISE: Backtesting, API access, multi-symbol
 *
 * Trial users get PRO features during their 14-day trial.
 */

import { prisma } from "@/lib/prisma";
import type { PlanType, SubscriptionStatus } from "@prisma/client";

/**
 * Feature flags for each plan tier
 */
export interface PlanFeatures {
  // Core features (available in all plans)
  botSignals: boolean; // Bot de señales XAUUSD
  dashboard: boolean; // Dashboard básico
  heartbeat: boolean; // Monitoreo de estado del bot

  // Account limits
  maxMt5Accounts: number; // Maximum MT5 accounts

  // Protection features (Pro+)
  circuitBreaker: boolean; // Pausa automática en volatilidad extrema
  accountGuardian: boolean; // DD protection
  lossLimits: boolean; // Límites de pérdida (D/S/M)
  killSwitch: boolean; // Emergency kill switch
  positionSizing: boolean; // Position sizing auto (Kelly)

  // Analytics (Pro+)
  analyticsPro: boolean; // Métricas profesionales
  equityCurve: boolean; // Equity curve interactiva
  heatmap: boolean; // Heatmap rendimiento horario
  streaks: boolean; // Análisis de rachas
  pdfReports: boolean; // Reportes PDF semanales
  benchmark: boolean; // Benchmark vs Buy & Hold

  // Automation (Pro+)
  telegramBot: boolean; // Telegram notificaciones
  newsFilter: boolean; // News filter
  sessionTrading: boolean; // Session trading
  tradingView: boolean; // TradingView bridge
  webhooks: boolean; // Webhooks personalizados

  // Smart trading (Pro+)
  smartEntry: boolean; // Smart entry filter
  signalConfidence: boolean; // Signal confidence score
  breakevenLock: boolean; // Breakeven + Lock profit
  smartTrailing: boolean; // Smart trailing ATR-based

  // Premium features (Enterprise only)
  backtester: boolean; // Backtesting engine
  monteCarlo: boolean; // Monte Carlo simulation
  multiTimeframe: boolean; // Multi-timeframe confirmation
  copyTrading: boolean; // Copy trading network
  apiAccess: boolean; // API pública REST + WebSocket
  multiSymbol: boolean; // Multi-símbolo
  paperTrading: boolean; // Paper trading
}

/**
 * Features available for each plan
 * Trial users get PRO features
 */
const PLAN_FEATURES: Record<PlanType | "TRIAL", PlanFeatures> = {
  TRIAL: {
    // Trial gets PRO features
    botSignals: true,
    dashboard: true,
    heartbeat: true,
    maxMt5Accounts: 3,
    circuitBreaker: true,
    accountGuardian: true,
    lossLimits: true,
    killSwitch: true,
    positionSizing: true,
    analyticsPro: true,
    equityCurve: true,
    heatmap: true,
    streaks: true,
    pdfReports: true,
    benchmark: true,
    telegramBot: true,
    newsFilter: true,
    sessionTrading: true,
    tradingView: true,
    webhooks: true,
    smartEntry: true,
    signalConfidence: true,
    breakevenLock: true,
    smartTrailing: true,
    backtester: false,
    monteCarlo: false,
    multiTimeframe: false,
    copyTrading: false,
    apiAccess: false,
    multiSymbol: false,
    paperTrading: false,
  },
  BASIC: {
    // Basic - core features only
    botSignals: true,
    dashboard: true,
    heartbeat: true,
    maxMt5Accounts: 1,
    circuitBreaker: false,
    accountGuardian: false,
    lossLimits: false,
    killSwitch: false,
    positionSizing: false,
    analyticsPro: false,
    equityCurve: false,
    heatmap: false,
    streaks: false,
    pdfReports: false,
    benchmark: false,
    telegramBot: false,
    newsFilter: false,
    sessionTrading: false,
    tradingView: false,
    webhooks: false,
    smartEntry: false,
    signalConfidence: false,
    breakevenLock: false,
    smartTrailing: false,
    backtester: false,
    monteCarlo: false,
    multiTimeframe: false,
    copyTrading: false,
    apiAccess: false,
    multiSymbol: false,
    paperTrading: false,
  },
  PRO: {
    // Pro - all except enterprise features
    botSignals: true,
    dashboard: true,
    heartbeat: true,
    maxMt5Accounts: 3,
    circuitBreaker: true,
    accountGuardian: true,
    lossLimits: true,
    killSwitch: true,
    positionSizing: true,
    analyticsPro: true,
    equityCurve: true,
    heatmap: true,
    streaks: true,
    pdfReports: true,
    benchmark: true,
    telegramBot: true,
    newsFilter: true,
    sessionTrading: true,
    tradingView: true,
    webhooks: true,
    smartEntry: true,
    signalConfidence: true,
    breakevenLock: true,
    smartTrailing: true,
    backtester: false,
    monteCarlo: false,
    multiTimeframe: false,
    copyTrading: false,
    apiAccess: false,
    multiSymbol: false,
    paperTrading: false,
  },
  ENTERPRISE: {
    // Enterprise - everything
    botSignals: true,
    dashboard: true,
    heartbeat: true,
    maxMt5Accounts: Infinity,
    circuitBreaker: true,
    accountGuardian: true,
    lossLimits: true,
    killSwitch: true,
    positionSizing: true,
    analyticsPro: true,
    equityCurve: true,
    heatmap: true,
    streaks: true,
    pdfReports: true,
    benchmark: true,
    telegramBot: true,
    newsFilter: true,
    sessionTrading: true,
    tradingView: true,
    webhooks: true,
    smartEntry: true,
    signalConfidence: true,
    breakevenLock: true,
    smartTrailing: true,
    backtester: true,
    monteCarlo: true,
    multiTimeframe: true,
    copyTrading: true,
    apiAccess: true,
    multiSymbol: true,
    paperTrading: true,
  },
};

/**
 * Get features available for a specific plan
 *
 * @param plan - Plan type (BASIC, PRO, ENTERPRISE, or TRIAL)
 * @returns Feature flags for the plan
 */
export function getPlanFeatures(plan: PlanType | "TRIAL"): PlanFeatures {
  return PLAN_FEATURES[plan] ?? PLAN_FEATURES.BASIC;
}

/**
 * Check if a specific feature is available for a plan
 *
 * @param plan - Plan type
 * @param feature - Feature key to check
 * @returns true if feature is available
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
 *
 * - TRIAL status during trial period -> PRO features
 * - TRIAL status expired -> BASIC (downgrade)
 * - ACTIVE status -> use subscription plan
 * - PAST_DUE -> use subscription plan (grace period)
 * - PAUSED/CANCELED -> BASIC (downgrade)
 *
 * @param status - Subscription status
 * @param plan - Subscription plan
 * @param trialEnd - Trial end date (if applicable)
 * @returns Effective plan for feature access
 */
export function getEffectivePlan(
  status: SubscriptionStatus,
  plan: PlanType,
  trialEnd?: Date | null
): PlanType | "TRIAL" {
  const now = new Date();

  switch (status) {
    case "TRIAL":
      // If trial is still active, give PRO features
      if (trialEnd && trialEnd > now) {
        return "TRIAL"; // TRIAL gets PRO features
      }
      // Trial expired - downgrade to BASIC
      return "BASIC";

    case "ACTIVE":
      return plan;

    case "PAST_DUE":
      // Grace period - still allow current plan
      return plan;

    case "PAUSED":
    case "CANCELED":
      // Downgrade to basic
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
 *
 * @param tenantId - Tenant ID
 * @returns Subscription info or null if no subscription
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
 * Feature requirement type for middleware
 */
export type FeatureRequirement = keyof PlanFeatures;

/**
 * Plan names for display
 */
export const PLAN_NAMES: Record<PlanType | "TRIAL", string> = {
  TRIAL: "Pro (Trial)",
  BASIC: "Básico",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
};

/**
 * Check if a tenant's trial has expired and auto-pause if needed
 *
 * This function:
 * 1. Checks if the tenant has a TRIAL subscription
 * 2. If trial has expired (trialEnd < now), updates status to PAUSED
 * 3. Returns the updated subscription info
 *
 * @param tenantId - Tenant ID to check
 * @returns Subscription info after potential update
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

  // No subscription = treat as paused
  if (!subscription) {
    return {
      status: "PAUSED",
      plan: "BASIC",
      trialEnd: null,
    };
  }

  const now = new Date();

  // Check if trial has expired
  if (
    subscription.status === "TRIAL" &&
    subscription.trialEnd &&
    subscription.trialEnd < now
  ) {
    // Trial expired - auto-pause
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "PAUSED" },
    });

    // Also update tenant plan
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { plan: "TRIAL" }, // Keep TRIAL as indicator of former trial user
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
 *
 * @param tenantId - Tenant ID to check
 * @returns true if tenant has active access
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
      // Trial is active if trialEnd is in the future
      return subscription.trialEnd ? subscription.trialEnd > now : false;

    case "ACTIVE":
    case "PAST_DUE": // Grace period
      return true;

    case "PAUSED":
    case "CANCELED":
      return false;

    default:
      return false;
  }
}

/**
 * Plan prices for display (EUR/month)
 */
export const PLAN_PRICES: Record<PlanType, number> = {
  BASIC: 57,
  PRO: 147,
  ENTERPRISE: 347,
};
