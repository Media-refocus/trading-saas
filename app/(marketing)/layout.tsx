"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-white">
            Trading Bot
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/pricing"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Precios
            </Link>
            <Link
              href="/login"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Iniciar Sesion
            </Link>
            <Link
              href="/register"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Registrarse
            </Link>
          </nav>

          {/* Mobile: CTA + Hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              href="/register"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Prueba Gratis
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-md hover:bg-slate-700/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6 text-white" />
              ) : (
                <Menu className="h-6 w-6 text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-700/50 bg-slate-800/95 backdrop-blur">
            <nav className="container mx-auto px-4 py-2 flex flex-col">
              <Link
                href="/pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="py-3 px-4 text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors min-h-[48px] flex items-center"
              >
                Precios
              </Link>
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="py-3 px-4 text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors min-h-[48px] flex items-center"
              >
                Iniciar Sesion
              </Link>
            </nav>
          </div>
        )}
      </header>
      <main>{children}</main>
      <footer className="border-t border-slate-700/50 py-8">
        <div className="container mx-auto px-4 text-center text-slate-400 text-[13px] md:text-sm">
          <p>&copy; {new Date().getFullYear()} Trading Bot SaaS. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
