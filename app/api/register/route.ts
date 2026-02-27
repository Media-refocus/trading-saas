import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  createRateLimitHeaders,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  // Rate limiting por IP
  const clientIp = getClientIp(request);
  const rateLimitKey = `register:${clientIp}`;
  const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.register);

  if (!rateLimitResult.allowed) {
    const headers = createRateLimitHeaders(rateLimitResult);
    return NextResponse.json(
      {
        error: "Demasiados intentos de registro",
        message: `Por favor espera ${rateLimitResult.retryAfter} segundos antes de intentar de nuevo.`,
        retryAfter: rateLimitResult.retryAfter,
      },
      { status: 429, headers }
    );
  }

  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    // Verificar si el email ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "El email ya está registrado" },
        { status: 400 }
      );
    }

    // Hashear password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Fecha de fin de trial: 14 días desde ahora
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    // Crear tenant, usuario y suscripción trial en transacción atómica
    const result = await prisma.$transaction(async (tx) => {
      // Crear tenant
      const tenant = await tx.tenant.create({
        data: {
          name,
          email,
        },
      });

      // Crear usuario asociado al tenant
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          tenantId: tenant.id,
        },
      });

      // Crear suscripción trial (14 días con features PRO)
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: "PRO",
          status: "TRIAL",
          trialEnd,
        },
      });

      return { tenant, user };
    });

    return NextResponse.json(
      { message: "Usuario creado exitosamente", userId: result.user.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error en registro:", error);
    return NextResponse.json(
      { error: "Error al crear usuario" },
      { status: 500 }
    );
  }
}
