import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Navigation() {
  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-xl font-bold">
              Trading Bot SaaS
            </Link>
            <div className="flex gap-4">
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground hover:text-foreground transition"
              >
                Dashboard
              </Link>
              <Link
                href="/backtester"
                className="text-sm text-muted-foreground hover:text-foreground transition"
              >
                Backtester
              </Link>
              <Link
                href="/bot"
                className="text-sm text-muted-foreground hover:text-foreground transition"
              >
                Bot Operativo
              </Link>
              <Link
                href="/settings"
                className="text-sm text-muted-foreground hover:text-foreground transition"
              >
                Configuración
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm">
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
