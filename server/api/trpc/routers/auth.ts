import { z } from "zod";
import { protectedProcedure, router } from "../init";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

export const authRouter = router({
  /**
   * Obtiene la información del usuario autenticado
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        tenantId: true,
        createdAt: true,
        Tenant: {
          select: {
            id: true,
            name: true,
            plan: true,
            email: true,
            createdAt: true,
            _count: {
              select: {
                TradingAccount: true,
                Signal: true,
                Trade: true,
              },
            },
          },
        },
      },
    });

    return user;
  }),

  /**
   * Actualiza el perfil del usuario
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "El nombre es requerido").max(100).optional(),
        image: z.string().url().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: { name?: string; image?: string | null } = {};

      if (input.name !== undefined) {
        updateData.name = input.name;
      }

      if (input.image !== undefined) {
        updateData.image = input.image;
      }

      const updatedUser = await prisma.user.update({
        where: { id: ctx.user.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
        },
      });

      return updatedUser;
    }),

  /**
   * Cambia la contraseña del usuario
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Obtener usuario con contraseña
      const user = await prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { id: true, password: true },
      });

      if (!user?.password) {
        throw new Error("Usuario no tiene contraseña configurada");
      }

      // Verificar contraseña actual
      const isValid = await bcrypt.compare(input.currentPassword, user.password);
      if (!isValid) {
        throw new Error("La contraseña actual es incorrecta");
      }

      // Hashear nueva contraseña
      const hashedPassword = await bcrypt.hash(input.newPassword, 10);

      // Actualizar
      await prisma.user.update({
        where: { id: ctx.user.id },
        data: { password: hashedPassword },
      });

      return { success: true };
    }),
});
