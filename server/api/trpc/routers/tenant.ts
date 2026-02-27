import { z } from "zod";
import { procedure, router, protectedProcedure } from "../init";
import { prisma } from "@/lib/prisma";
import {
  getEffectivePlan,
  PLAN_NAMES,
  type SubscriptionInfo,
} from "@/lib/plan-gates";

export const tenantRouter = router({
  hello: procedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return { greeting: `Hello ${input.name}!` };
    }),

  /**
   * Get subscription status for the current tenant
   * Returns plan info, trial days remaining, and status flags
   */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user.tenantId) {
      return null;
    }

    const subscription = await prisma.subscription.findFirst({
      where: { tenantId: ctx.user.tenantId },
      select: {
        id: true,
        status: true,
        plan: true,
        trialEnd: true,
        stripeSubId: true,
        currentPeriodEnd: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!subscription) {
      return null;
    }

    const now = new Date();
    const effectivePlan = getEffectivePlan(
      subscription.status,
      subscription.plan,
      subscription.trialEnd
    );

    // Calculate trial days remaining
    let trialDaysRemaining: number | null = null;
    if (subscription.status === "TRIAL" && subscription.trialEnd) {
      const diffMs = subscription.trialEnd.getTime() - now.getTime();
      trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    // Check if tenant has Stripe customer ID
    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.user.tenantId },
      select: { stripeCustomerId: true },
    });

    return {
      status: subscription.status,
      plan: subscription.plan,
      planName: PLAN_NAMES[effectivePlan] || effectivePlan,
      effectivePlan,
      trialEnd: subscription.trialEnd,
      trialDaysRemaining,
      currentPeriodEnd: subscription.currentPeriodEnd,
      hasStripeCustomer: !!tenant?.stripeCustomerId,
      // Convenience flags for UI
      isTrial: subscription.status === "TRIAL",
      isTrialExpired: subscription.status === "TRIAL" && subscription.trialEnd && subscription.trialEnd < now,
      isPastDue: subscription.status === "PAST_DUE",
      isPaused: subscription.status === "PAUSED",
      isActive: subscription.status === "ACTIVE",
    };
  }),
});
