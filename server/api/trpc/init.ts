import { initTRPC, TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";
import superjson from "superjson";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getEffectivePlan,
  getPlanFeatures,
  getTenantSubscription,
  hasFeature,
  type FeatureRequirement,
  type PlanFeatures,
  type SubscriptionInfo,
} from "@/lib/plan-gates";
import type { PlanType } from "@prisma/client";

interface CreateContextOptions {
  headers: Headers;
}

export const createContext = async ({ headers }: CreateContextOptions) => {
  // Obtener sesion de NextAuth
  const session = await auth();

  // Si hay usuario autenticado, obtener datos completos
  let user = null;
  if (session?.user?.id) {
    user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        tenantId: true,
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  return {
    headers,
    session,
    user,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof Error ? error.cause.message : null,
      },
    };
  },
});

export const router = t.router;
export const procedure = t.procedure;
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;

// Middleware para verificar autenticacion
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Debes iniciar sesion para acceder a este recurso",
    });
  }

  return next({
    ctx: {
      // Infieren que ctx.user no es null
      user: ctx.user,
      session: ctx.session,
    },
  });
});

// Procedimiento protegido que requiere autenticacion
export const protectedProcedure = t.procedure.use(isAuthed);

/**
 * Create a plan-gated middleware that checks feature access
 */
function createPlanGateMiddleware(requiredFeature: FeatureRequirement) {
  return t.middleware(async ({ ctx, next }) => {
    // Must be authenticated first
    if (!ctx.user?.tenantId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Debes iniciar sesion para acceder a este recurso",
      });
    }

    // Get subscription info
    const subscription = await getTenantSubscription(ctx.user.tenantId);

    // Default to BASIC if no subscription
    const effectivePlan = subscription
      ? getEffectivePlan(
          subscription.status,
          subscription.plan,
          subscription.trialEnd
        )
      : "BASIC";

    // Check feature access
    if (!hasFeature(effectivePlan, requiredFeature)) {
      const planName = effectivePlan === "TRIAL" ? "PRO (trial)" : effectivePlan;

      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Esta funcionalidad requiere un plan superior. Tu plan actual: ${planName}. Feature requerida: ${requiredFeature}`,
      });
    }

    return next({
      ctx: {
        user: ctx.user,
        session: ctx.session,
        planFeatures: getPlanFeatures(effectivePlan),
        effectivePlan,
      },
    });
  });
}

/**
 * Create a plan-gated procedure that requires both auth and a specific feature
 *
 * Usage:
 * ```ts
 * // In your router:
 * runBacktest: planGatedProcedure("backtester")
 *   .input(backtestSchema)
 *   .mutation(async ({ ctx, input }) => {
 *     // ctx.planFeatures is available here
 *   }),
 * ```
 */
export function planGatedProcedure(feature: FeatureRequirement) {
  return t.procedure.use(createPlanGateMiddleware(feature));
}

/**
 * Middleware that enriches context with plan info (but doesn't gate)
 * Useful for showing/hiding UI elements without blocking access
 */
const withPlanInfo = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user?.tenantId) {
    return next({ ctx });
  }

  const subscription = await getTenantSubscription(ctx.user.tenantId);
  const effectivePlan = subscription
    ? getEffectivePlan(
        subscription.status,
        subscription.plan,
        subscription.trialEnd
      )
    : "BASIC";

  return next({
    ctx: {
      planFeatures: getPlanFeatures(effectivePlan),
      effectivePlan,
      subscription,
    },
  });
});

/**
 * Protected procedure with plan info in context (no gating)
 * Use this when you need plan info but don't want to block access
 */
export const protectedProcedureWithPlan = protectedProcedure.use(withPlanInfo);

// Re-export types for convenience
export type { FeatureRequirement, PlanFeatures, SubscriptionInfo };
