import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email requerido" },
        { status: 400 }
      );
    }

    // Verificar si existe el usuario
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Por seguridad, siempre retornamos éxito aunque el usuario no exista
    // Esto previene enumeración de usuarios
    if (!user) {
      return NextResponse.json({ success: true });
    }

    // Generar token seguro
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

    // Eliminar tokens anteriores para este email
    await prisma.passwordResetToken.deleteMany({
      where: { email: email.toLowerCase() },
    });

    // Guardar token en la base de datos
    await prisma.passwordResetToken.create({
      data: {
        email: email.toLowerCase(),
        token,
        expires,
      },
    });

    // Construir URL de reset
    const baseUrl = process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // En desarrollo, loguear el enlace
    if (process.env.NODE_ENV !== "production") {
      console.log("=".repeat(60));
      console.log("PASSWORD RESET LINK (desarrollo):");
      console.log(resetUrl);
      console.log("=".repeat(60));
    }

    // Intentar enviar email (Resend o SMTP)
    const emailSent = await sendPasswordResetEmail(email, resetUrl);

    if (!emailSent && process.env.NODE_ENV === "production") {
      console.warn("[Forgot Password] Email could not be sent. Configure RESEND_API_KEY or SMTP_* vars.");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en forgot-password:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
