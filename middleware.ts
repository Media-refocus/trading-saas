import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Middleware usando solo la configuracion compatible con Edge Runtime
// NO importa lib/auth.ts directamente porque usa bcrypt (Node.js native module)
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api/auth (NextAuth API routes)
     */
    "/((?!_next/static|_next/image|favicon.ico|public/|api/auth).*)",
  ],
};
