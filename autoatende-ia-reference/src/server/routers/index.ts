import { router } from '../trpc.ts';
import { systemRouter } from './system.ts';
import { authRouter } from './auth.ts';
import { empresaRouter } from './empresa.ts';
import { adminRouter } from './admin.ts';

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  empresa: empresaRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
