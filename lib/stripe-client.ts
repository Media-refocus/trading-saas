import { loadStripe } from "@stripe/stripe-js";

// Singleton pattern para el cliente Stripe en el navegador
let stripePromise: ReturnType<typeof loadStripe> | null = null;

export const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey) {
      throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined");
    }

    stripePromise = loadStripe(publishableKey);
  }

  return stripePromise;
};
