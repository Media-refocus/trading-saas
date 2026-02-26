/**
 * Router para el Marketplace de Operativas
 *
 * Permite a los usuarios:
 * - Publicar estrategias al marketplace
 * - Ver, buscar y filtrar operativas públicas
 * - Hacer fork de operativas
 * - Dar like a operativas
 */

import { z } from "zod";
import { procedure, router } from "../init";
import { prisma } from "@/lib/prisma";

// Schema para publicar una estrategia
const PublishInputSchema = z.object({
  strategyId: z.string(), // ID de la estrategia local a publicar
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().default(true),
});

// Schema para filtrar operativas
const FilterSchema = z.object({
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  authorId: z.string().optional(),
  sortBy: z.enum(["recent", "popular", "profitable", "downloads"]).default("recent"),
  minWinRate: z.number().min(0).max(100).optional(),
  maxDrawdown: z.number().min(0).max(100).optional(),
  limit: z.number().min(1).max(50).default(20),
  cursor: z.string().optional(), // Para paginación
});

export const marketplaceRouter = router({
  /**
   * Lista operativas públicas con filtros y paginación
   */
  list: procedure
    .input(FilterSchema)
    .query(async ({ input }) => {
      const { search, tags, authorId, sortBy, minWinRate, maxDrawdown, limit, cursor } = input;

      // Construir filtros
      const where: any = {
        isPublic: true,
      };

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { description: { contains: search } },
        ];
      }

      if (authorId) {
        where.authorId = authorId;
      }

      if (minWinRate !== undefined) {
        where.winRate = { gte: minWinRate };
      }

      if (maxDrawdown !== undefined) {
        where.maxDrawdown = { lte: maxDrawdown };
      }

      if (tags && tags.length > 0) {
        // SQLite Json filter - buscar tags que coincidan
        // Note: SQLite JSON queries son limitadas, filtramos en memoria si es necesario
      }

      // Ordenamiento
      let orderBy: any = {};
      switch (sortBy) {
        case "recent":
          orderBy = { publishedAt: "desc" };
          break;
        case "popular":
          orderBy = { likesCount: "desc" };
          break;
        case "profitable":
          orderBy = { totalProfit: "desc" };
          break;
        case "downloads":
          orderBy = { downloadsCount: "desc" };
          break;
      }

      const strategies = await prisma.publishedStrategy.findMany({
        where,
        orderBy,
        take: limit + 1, // +1 para detectar si hay más
        cursor: cursor ? { id: cursor } : undefined,
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Paginación
      let nextCursor: string | undefined;
      if (strategies.length > limit) {
        const nextItem = strategies.pop();
        nextCursor = nextItem!.id;
      }

      return {
        strategies,
        nextCursor,
      };
    }),

  /**
   * Obtiene una operativa pública por ID
   */
  get: procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const strategy = await prisma.publishedStrategy.findUnique({
        where: { id: input.id },
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
          parentStrategy: {
            select: { id: true, name: true, author: { select: { name: true } } },
          },
          forks: {
            select: { id: true, name: true },
            take: 5,
          },
        },
      });

      return strategy;
    }),

  /**
   * Publica una estrategia al marketplace
   */
  publish: procedure
    .input(PublishInputSchema)
    .mutation(async ({ input }) => {
      // Obtener tenant y usuario por defecto
      // TODO: Obtener del contexto de autenticación
      let tenant = await prisma.tenant.findFirst();
      let user = await prisma.user.findFirst();

      if (!tenant) {
        tenant = await prisma.tenant.create({
          data: { name: "Default Tenant", email: "default@example.com" },
        });
      }

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: "default@example.com",
            password: "hashed",
            tenantId: tenant.id,
          },
        });
      }

      // Obtener la estrategia original
      const originalStrategy = await prisma.strategy.findUnique({
        where: { id: input.strategyId },
      });

      if (!originalStrategy) {
        throw new Error("Estrategia no encontrada");
      }

      // Crear la operativa publicada
      const published = await prisma.publishedStrategy.create({
        data: {
          tenantId: tenant.id,
          authorId: user.id,
          name: input.name,
          description: input.description,
          tags: input.tags ? JSON.stringify(input.tags) : undefined,
          isPublic: input.isPublic,

          // Copiar parámetros de la estrategia
          strategyName: originalStrategy.strategyName,
          lotajeBase: originalStrategy.lotajeBase,
          numOrders: originalStrategy.numOrders,
          pipsDistance: originalStrategy.pipsDistance,
          maxLevels: originalStrategy.maxLevels,
          takeProfitPips: originalStrategy.takeProfitPips,
          stopLossPips: originalStrategy.stopLossPips,
          useStopLoss: originalStrategy.useStopLoss,
          useTrailingSL: originalStrategy.useTrailingSL,
          trailingSLPercent: originalStrategy.trailingSLPercent,
          restrictionType: originalStrategy.restrictionType,

          // Copiar resultados del backtest
          totalTrades: originalStrategy.lastTotalTrades || 0,
          totalProfit: originalStrategy.lastTotalProfit || 0,
          winRate: originalStrategy.lastWinRate || 0,
          maxDrawdown: originalStrategy.lastMaxDrawdown || 0,
          profitFactor: 0, // TODO: calcular
        },
      });

      return published;
    }),

  /**
   * Hace fork de una operativa (la copia a tus estrategias)
   */
  fork: procedure
    .input(z.object({
      publishedId: z.string(),
      name: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Obtener tenant por defecto
      let tenant = await prisma.tenant.findFirst();

      if (!tenant) {
        tenant = await prisma.tenant.create({
          data: { name: "Default Tenant", email: "default@example.com" },
        });
      }

      // Obtener la operativa publicada
      const published = await prisma.publishedStrategy.findUnique({
        where: { id: input.publishedId },
      });

      if (!published) {
        throw new Error("Operativa no encontrada");
      }

      // Crear estrategia local a partir del fork
      const forked = await prisma.strategy.create({
        data: {
          tenantId: tenant.id,
          name: input.name || `${published.name} (fork)`,
          description: published.description,
          strategyName: published.strategyName,
          lotajeBase: published.lotajeBase,
          numOrders: published.numOrders,
          pipsDistance: published.pipsDistance,
          maxLevels: published.maxLevels,
          takeProfitPips: published.takeProfitPips,
          stopLossPips: published.stopLossPips,
          useStopLoss: published.useStopLoss,
          useTrailingSL: published.useTrailingSL,
          trailingSLPercent: published.trailingSLPercent,
          restrictionType: published.restrictionType,
        },
      });

      // Incrementar contador de forks en la original
      await prisma.publishedStrategy.update({
        where: { id: input.publishedId },
        data: { forksCount: { increment: 1 } },
      });

      return forked;
    }),

  /**
   * Da like a una operativa
   */
  like: procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const strategy = await prisma.publishedStrategy.update({
        where: { id: input.id },
        data: { likesCount: { increment: 1 } },
      });

      return { success: true, likesCount: strategy.likesCount };
    }),

  /**
   * Quita like de una operativa
   */
  unlike: procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const current = await prisma.publishedStrategy.findUnique({
        where: { id: input.id },
        select: { likesCount: true },
      });

      if (current && current.likesCount > 0) {
        const strategy = await prisma.publishedStrategy.update({
          where: { id: input.id },
          data: { likesCount: { decrement: 1 } },
        });

        return { success: true, likesCount: strategy.likesCount };
      }

      return { success: true, likesCount: 0 };
    }),

  /**
   * Registra una descarga (cuando alguien usa la operativa)
   */
  trackDownload: procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await prisma.publishedStrategy.update({
        where: { id: input.id },
        data: { downloadsCount: { increment: 1 } },
      });

      return { success: true };
    }),

  /**
   * Obtiene las operativas más populares (top 10)
   */
  getTop: procedure
    .input(z.object({
      period: z.enum(["week", "month", "all"]).default("month"),
      limit: z.number().min(1).max(20).default(10),
    }))
    .query(async ({ input }) => {
      const { period, limit } = input;

      // Calcular fecha mínima según período
      let minDate: Date | undefined;
      const now = new Date();

      switch (period) {
        case "week":
          minDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          minDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "all":
          minDate = undefined;
          break;
      }

      const strategies = await prisma.publishedStrategy.findMany({
        where: {
          isPublic: true,
          ...(minDate && { publishedAt: { gte: minDate } }),
        },
        orderBy: [
          { likesCount: "desc" },
          { downloadsCount: "desc" },
        ],
        take: limit,
        include: {
          author: {
            select: { name: true },
          },
        },
      });

      return strategies;
    }),

  /**
   * Busca operativas por texto
   */
  search: procedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input }) => {
      const { query, limit } = input;

      const strategies = await prisma.publishedStrategy.findMany({
        where: {
          isPublic: true,
          OR: [
            { name: { contains: query } },
            { description: { contains: query } },
          ],
        },
        take: limit,
        orderBy: { likesCount: "desc" },
      });

      return strategies;
    }),

  /**
   * Obtiene operativas de un autor específico
   */
  getByAuthor: procedure
    .input(z.object({
      authorId: z.string(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input }) => {
      const { authorId, limit } = input;

      const strategies = await prisma.publishedStrategy.findMany({
        where: {
          authorId,
          isPublic: true,
        },
        orderBy: { publishedAt: "desc" },
        take: limit,
      });

      return strategies;
    }),

  /**
   * Elimina una operativa publicada (solo el autor)
   */
  unpublish: procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // TODO: Verificar que el usuario es el autor

      await prisma.publishedStrategy.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
