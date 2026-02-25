"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import AlertsBadge from "@/components/alerts-badge";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/backtester", label: "Backtester" },
  { href: "/settings", label: "Configuracion" },
  { href: "/pricing", label: "Planes" },
  { href: "/telegram", label: "Telegram" },
  { href: "/setup", label: "Instalar Bot" },
  { href: "/help", label: "Ayuda" },
];

export function Navigation() {
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      window.location.href = "/";
    } catch (error) {
      console.error("Error al cerrar sesion:", error);
    }
  };

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-xl font-bold">
              Trading Bot
            </Link>
            <div className="flex gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href ||
                  (link.href !== "/dashboard" && pathname.startsWith(link.href));

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 text-sm rounded-md transition ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertsBadge />
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Cerrar Sesion
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
