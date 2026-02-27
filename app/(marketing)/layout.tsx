import Link from "next/link";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-white">
            Trading Bot
          </Link>
          <nav className="flex items-center gap-6">
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
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-slate-700/50 py-8">
        <div className="container mx-auto px-4 text-center text-slate-400 text-sm">
          <p>&copy; {new Date().getFullYear()} Trading Bot SaaS. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
