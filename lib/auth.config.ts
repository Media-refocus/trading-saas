import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Declaracion de tipos para extender NextAuth
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string;
    } & DefaultSession["user"];
  }

  interface User {
    tenantId: string;
  }
}

// Configuracion de NextAuth para Edge Runtime (sin dependencias de Node.js)
// Esta configuracion se usa en el middleware
export const authConfig: NextAuthConfig = {
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Authorize se maneja en el archivo principal auth.ts
      async authorize() {
        return null;
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isPublicRoute = ["/login", "/register", "/api", "/_next", "/favicon.ico", "/images"].some(
        (route) => nextUrl.pathname.startsWith(route)
      );
      const isProtectedRoute = ["/dashboard", "/backtester", "/operativas", "/bot", "/settings"].some(
        (route) => nextUrl.pathname.startsWith(route)
      );

      if (isProtectedRoute && !isLoggedIn) {
        return false; // Redirigir a login
      }

      if (isLoggedIn && (nextUrl.pathname === "/login" || nextUrl.pathname === "/register")) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.tenantId = user.tenantId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
      }
      return session;
    },
  },
};

import { DefaultSession } from "next-auth";
