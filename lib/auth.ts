import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import type { DefaultSession } from "next-auth";

// Declaracion de tipos para extender NextAuth
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    tenantId: string;
    role: string;
  }
}

// NextAuth completo con autorizacion usando bcrypt
// Este archivo NO debe ser importado desde middleware.ts (usa Node.js modules)
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { Tenant: true },
        });

        if (!user || !user.password) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordMatch) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          tenantId: user.tenantId,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Para OAuth providers (Google), crear usuario si no existe
      if (account?.provider === "google" && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
          include: { Tenant: true },
        });

        if (existingUser) {
          // Usuario ya existe, usar su tenantId y role
          user.tenantId = existingUser.tenantId;
          user.role = existingUser.role;
          return true;
        }

        // Crear nuevo usuario con tenant y suscripcion trial
        // Fecha de fin de trial: 14 días desde ahora
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 14);

        const newUser = await prisma.$transaction(async (tx) => {
          // Crear tenant
          const tenant = await tx.tenant.create({
            data: {
              name: user.name || "Mi Cuenta",
              email: user.email,
            },
          });

          // Crear usuario
          const u = await tx.user.create({
            data: {
              email: user.email!,
              name: user.name,
              image: user.image,
              tenantId: tenant.id,
              role: "USER",
            },
          });

          // Crear suscripcion trial (14 dias con features PRO)
          await tx.subscription.create({
            data: {
              tenantId: tenant.id,
              plan: "PRO",
              status: "TRIAL",
              trialEnd,
            },
          });

          return u;
        });

        user.tenantId = newUser.tenantId;
        user.role = newUser.role;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.tenantId = user.tenantId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
