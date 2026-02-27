import Stripe from "stripe";

const globalForStripe = globalThis as unknown as {
  stripe: Stripe | undefined;
};

/**
 * Get the Stripe client instance (lazy initialization).
 * This avoids build-time errors when STRIPE_SECRET_KEY is not set.
 */
export function getStripe(): Stripe {
  if (!globalForStripe.stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    globalForStripe.stripe = new Stripe(secretKey, {
      apiVersion: "2025-02-24.acacia",
      appInfo: {
        name: "Trading Bot SaaS",
        version: "1.0.0",
      },
    });
  }
  return globalForStripe.stripe;
}

// For convenience, export a getter that can be used like `stripe.customers.create()`
// but requires calling getStripe() first in the route handler.
export const stripe = new Proxy<Stripe>({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});
