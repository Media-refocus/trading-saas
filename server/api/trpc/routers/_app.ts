import { router } from "../init";
import { authRouter } from "./auth";
import { tenantRouter } from "./tenant";
import { backtesterRouter } from "./backtester";
import { strategiesRouter } from "./strategies";
import { botRouter } from "./bot";
import { marketplaceRouter } from "./marketplace";

export const appRouter = router({
  auth: authRouter,
  tenant: tenantRouter,
  backtester: backtesterRouter,
  strategies: strategiesRouter,
  bot: botRouter,
  marketplace: marketplaceRouter,
});

export type AppRouter = typeof appRouter;
