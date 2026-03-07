import { PlanType, SubscriptionStatus } from '@prisma/client';
import { z } from "zod";
import { procedure, router, protectedProcedure } from "../init";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import {
  getEffectivePlan,
  PLAN_NAMES,
  type SubscriptionInfo,
} from "@/lib/plan-gates";

// Map Stripe subscription status to our SubscriptionStatus
const STRIPE_STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: "ACTIVE",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  unpaid: "PAST_DUE",
  paused: "PAUSED",
  trialing: "TRIAL",
};

export const tenantRouter = router({
  hello: procedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return { greeting: `Hello ${input.name}!` };
    }),

  /**
   * Get subscription status for the current tenant
   * Returns plan info, trial days remaining, and status flags.
   * If tenant has Stripe subscription, fetches real-time status from Stripe API.
   */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user.tenantId) {
      return null;
    }

    // Check if tenant has Stripe customer ID
    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.user.tenantId },
      select: { stripeCustomerId: true },
    });

    const subscription = await prisma.subscription.findFirst({
      where: { tenantId: ctx.user.tenantId },
      select: {
        id: true,
        status: true,
        plan: true,
        trialEnd: true,
        stripeSubId: true,
        stripePriceId: true,
        currentPeriodEnd: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!subscription) {
      return null;
    }

    let currentStatus = subscription.status as SubscriptionStatus;
    let currentPeriodEnd = subscription.currentPeriodEnd;

    // If has Stripe subscription, fetch real-time status from Stripe
    if (subscription.stripeSubId && tenant?.stripeCustomerId) {
      try {
        const stripe = getStripe();
        const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubId);

        // Map Stripe status to our status
        const mappedStatus = STRIPE_STATUS_MAP[stripeSub.status];
        if (mappedStatus && mappedStatus !== currentStatus) {
          // Update our DB with the latest status from Stripe
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              status: mappedStatus,
              currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
            },
          });
          currentStatus = mappedStatus;
          currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);
        }
      } catch (error) {
        // If Stripe API fails, continue with DB status
        console.error("Failed to fetch Stripe subscription:", error);
      }
    }

    const now = new Date();
    const effectivePlan = getEffectivePlan(
      currentStatus,
      subscription.plan,
      subscription.trialEnd
    );

    // Calculate trial days remaining
    let trialDaysRemaining: number | null = null;
    if (currentStatus === "TRIAL" && subscription.trialEnd) {
      const diffMs = subscription.trialEnd.getTime() - now.getTime();
      trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    // Calculate days until next billing for active subscriptions
    let daysUntilBilling: number | null = null;
    if (currentStatus === "ACTIVE" && currentPeriodEnd) {
      const diffMs = currentPeriodEnd.getTime() - now.getTime();
      daysUntilBilling = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return {
      status: currentStatus,
      plan: subscription.plan,
      planName: PLAN_NAMES[effectivePlan as PlanType] || effectivePlan,
      effectivePlan,
      trialEnd: subscription.trialEnd,
      trialDaysRemaining,
      currentPeriodEnd,
      daysUntilBilling,
      hasStripeCustomer: !!tenant?.stripeCustomerId,
      hasStripeSubscription: !!subscription.stripeSubId,
      // Convenience flags for UI
      isTrial: currentStatus === "TRIAL",
      isTrialExpired: currentStatus === "TRIAL" && subscription.trialEnd && subscription.trialEnd < now,
      isPastDue: currentStatus === "PAST_DUE",
      isPaused: currentStatus === "PAUSED",
      isCanceled: currentStatus === "CANCELED",
      isActive: currentStatus === "ACTIVE",
    };
  }),
});
