/**
 * Router para el Marketplace de Operativas
 *
 * Permite a los usuarios:
 * - Publicar estrategias al marketplace
 * - Ver, buscar y filtrar operativas publicas
 * - Hacer fork de operativas
 * - Dar/quitar like a operativas (con tracking en StrategyLike)
 * - Comentar en operativas
 */

import { z } from "zod";
import { procedure, router } from "../init";
import { prisma } from "@/lib/prisma";

// ============================================
// HELPER: Obtener usuario actual
// ============================================
// TODO: Reemplazar con contexto de autenticacion real (ctx.user)
async function getCurrentUser() {
  let user = await prisma.user.findFirst();

  if (!user) {
    // Crear usuario por defecto si no existe
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: { name: "Default Tenant", email: "default@example.com" },
      });
    }
    user = await prisma.user.create({
      data: {
        email: "default@example.com",
        password: "hashed",
        name: "Usuario por defecto",
        tenantId: tenant.id,
      },
    });
  }

  return user;
}

// ============================================
// SCHEMAS
// ============================================

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
  cursor: z.string().optional(), // Para paginacion
});

// Schema para comentarios
const CommentInputSchema = z.object({
  publishedStrategyId: z.string(),
  content: z.string().min(1).max(1000),
});

// ============================================
// ROUTER
// ============================================

export const marketplaceRouter = router({
  /**
   * Lista operativas publicas con filtros y paginacion
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
        take: limit + 1, // +1 para detectar si hay mas
        cursor: cursor ? { id: cursor } : undefined,
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Paginacion
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
   * Obtiene una operativa publica por ID
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
      const user = await getCurrentUser();

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
          tenantId: user.tenantId,
          authorId: user.id,
          name: input.name,
          description: input.description,
          tags: input.tags || [],
          isPublic: input.isPublic,

          // Copiar parametros de la estrategia
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
      const user = await getCurrentUser();

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
          tenantId: user.tenantId,
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

  // ============================================
  // SISTEMA DE LIKES
  // ============================================

  /**
   * Toggle like: anade o quita like segun el estado actual
   * Registra en la tabla StrategyLike y actualiza likesCount
   */
  toggleLike: procedure
    .input(z.object({ publishedStrategyId: z.string() }))
    .mutation(async ({ input }) => {
      const user = await getCurrentUser();

      // Verificar que la estrategia existe
      const strategy = await prisma.publishedStrategy.findUnique({
        where: { id: input.publishedStrategyId },
        select: { id: true, likesCount: true },
      });

      if (!strategy) {
        throw new Error("Estrategia no encontrada");
      }

      // Verificar si ya existe el like
      const existingLike = await prisma.strategyLike.findUnique({
        where: {
          userId_publishedStrategyId: {
            userId: user.id,
            publishedStrategyId: input.publishedStrategyId,
          },
        },
      });

      let hasLiked: boolean;
      let likesCount: number;

      if (existingLike) {
        // Quitar like
        await prisma.$transaction([
          prisma.strategyLike.delete({
            where: { id: existingLike.id },
          }),
          prisma.publishedStrategy.update({
            where: { id: input.publishedStrategyId },
            data: { likesCount: { decrement: 1 } },
          }),
        ]);
        hasLiked = false;
        likesCount = Math.max(0, strategy.likesCount - 1);
      } else {
        // Anadir like
        await prisma.$transaction([
          prisma.strategyLike.create({
            data: {
              userId: user.id,
              publishedStrategyId: input.publishedStrategyId,
            },
          }),
          prisma.publishedStrategy.update({
            where: { id: input.publishedStrategyId },
            data: { likesCount: { increment: 1 } },
          }),
        ]);
        hasLiked = true;
        likesCount = strategy.likesCount + 1;
      }

      return {
        success: true,
        hasLiked,
        likesCount,
      };
    }),

  /**
   * Obtiene el estado de like del usuario actual para una estrategia
   * Retorna si el usuario ya dio like y el contador total de likes
   */
  getLikeStatus: procedure
    .input(z.object({ publishedStrategyId: z.string() }))
    .query(async ({ input }) => {
      const user = await getCurrentUser();

      // Obtener la estrategia con su contador de likes
      const strategy = await prisma.publishedStrategy.findUnique({
        where: { id: input.publishedStrategyId },
        select: { likesCount: true },
      });

      if (!strategy) {
        throw new Error("Estrategia no encontrada");
      }

      // Verificar si el usuario dio like
      const like = await prisma.strategyLike.findUnique({
        where: {
          userId_publishedStrategyId: {
            userId: user.id,
            publishedStrategyId: input.publishedStrategyId,
          },
        },
      });

      return {
        hasLiked: !!like,
        likesCount: strategy.likesCount,
      };
    }),

  /**
   * Da like a una operativa (deprecated: usar toggleLike)
   * @deprecated Use toggleLike instead
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
   * Quita like de una operativa (deprecated: usar toggleLike)
   * @deprecated Use toggleLike instead
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

  // ============================================
  // SISTEMA DE COMENTARIOS
  // ============================================

  /**
   * Anade un comentario a una estrategia
   * Retorna el comentario creado con info del autor
   */
  addComment: procedure
    .input(CommentInputSchema)
    .mutation(async ({ input }) => {
      const user = await getCurrentUser();

      // Verificar que la estrategia existe
      const strategy = await prisma.publishedStrategy.findUnique({
        where: { id: input.publishedStrategyId },
        select: { id: true },
      });

      if (!strategy) {
        throw new Error("Estrategia no encontrada");
      }

      // Crear el comentario
      const comment = await prisma.strategyComment.create({
        data: {
          userId: user.id,
          publishedStrategyId: input.publishedStrategyId,
          content: input.content,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      });

      return {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        author: comment.user,
      };
    }),

  /**
   * Obtiene comentarios de una estrategia con paginacion
   * Incluye info del autor (name, email)
   */
  getComments: procedure
    .input(z.object({
      publishedStrategyId: z.string(),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { publishedStrategyId, limit, cursor } = input;

      const comments = await prisma.strategyComment.findMany({
        where: { publishedStrategyId },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      });

      // Paginacion
      let nextCursor: string | undefined;
      if (comments.length > limit) {
        const nextItem = comments.pop();
        nextCursor = nextItem!.id;
      }

      return {
        comments: comments.map((c) => ({
          id: c.id,
          content: c.content,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          author: c.user,
        })),
        nextCursor,
      };
    }),

  // ============================================
  // OTROS ENDPOINTS
  // ============================================

  /**
   * Verifica si el usuario actual ha dado like a una operativa
   * @deprecated Use getLikeStatus instead
   */
  hasLiked: procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const user = await getCurrentUser();

      const like = await prisma.strategyLike.findUnique({
        where: {
          userId_publishedStrategyId: {
            userId: user.id,
            publishedStrategyId: input.id,
          },
        },
      });

      return { liked: !!like };
    }),

  /**
   * Obtiene estrategias relacionadas por tags similares
   */
  getRelated: procedure
    .input(z.object({
      id: z.string(),
      limit: z.number().min(1).max(10).default(3),
    }))
    .query(async ({ input }) => {
      // Obtener la estrategia actual para sus tags
      const current = await prisma.publishedStrategy.findUnique({
        where: { id: input.id },
        select: { tags: true },
      });

      if (!current || !current.tags || current.tags.length === 0) {
        // Si no tiene tags, retornar estrategias populares
        const popular = await prisma.publishedStrategy.findMany({
          where: {
            isPublic: true,
            id: { not: input.id },
          },
          orderBy: { likesCount: "desc" },
          take: input.limit,
          include: {
            author: { select: { name: true } },
          },
        });
        return popular;
      }

      // Buscar estrategias con tags similares
      const related = await prisma.publishedStrategy.findMany({
        where: {
          isPublic: true,
          id: { not: input.id },
          tags: { hasSome: current.tags },
        },
        orderBy: { likesCount: "desc" },
        take: input.limit,
        include: {
          author: { select: { name: true } },
        },
      });

      return related;
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
   * Obtiene las operativas mas populares (top 10)
   */
  getTop: procedure
    .input(z.object({
      period: z.enum(["week", "month", "all"]).default("month"),
      limit: z.number().min(1).max(20).default(10),
    }))
    .query(async ({ input }) => {
      const { period, limit } = input;

      // Calcular fecha minima segun periodo
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
   * Obtiene operativas de un autor especifico
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
   * Verifica que el usuario que hace unpublish es el autor de la estrategia
   */
  unpublish: procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const user = await getCurrentUser();

      // Obtener la estrategia para verificar autoria
      const strategy = await prisma.publishedStrategy.findUnique({
        where: { id: input.id },
        select: { authorId: true },
      });

      if (!strategy) {
        throw new Error("Estrategia no encontrada");
      }

      // Verificar que el usuario es el autor
      if (strategy.authorId !== user.id) {
        throw new Error("No tienes permiso para eliminar esta estrategia. Solo el autor puede unpublish.");
      }

      // Eliminar la estrategia (los likes y comentarios se eliminan en cascada)
      await prisma.publishedStrategy.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
