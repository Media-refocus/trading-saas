import { router } from "../init";
import { authRouter } from "./auth";
import { tenantRouter } from "./tenant";
import { backtesterRouter } from "./backtester";

export const appRouter = router({
  auth: authRouter,
  tenant: tenantRouter,
  backtester: backtesterRouter,
});

export type AppRouter = typeof appRouter;
