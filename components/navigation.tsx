"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Activity, Settings, BarChart3, Bot, LogOut, Circle } from "lucide-react";

export default function Navigation() {
  const pathname = usePathname();

  // Obtener estado del bot (solo si estamos en rutas del dashboard)
  const { data: botStatus } = trpc.bot.getStatus.useQuery(undefined, {
    refetchInterval: 30000, // Cada 30 segundos
    enabled: pathname.startsWith("/dashboard") || pathname.startsWith("/bot") || pathname === "/",
  });

  const isOnline = botStatus?.isOnline;
  const isPaused = botStatus?.status === "PAUSED";

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/backtester", label: "Backtester", icon: Activity },
    { href: "/bot", label: "Bot Operativo", icon: Bot },
    { href: "/settings", label: "Configuración", icon: Settings },
  ];

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-xl font-bold flex items-center gap-2">
              Trading Bot SaaS
              {/* Indicador de estado del bot */}
              {(isOnline || isPaused) && (
                <span className="flex items-center gap-1 ml-2">
                  <Circle
                    className={cn(
                      "h-2.5 w-2.5",
                      isPaused ? "fill-amber-500 text-amber-500" :
                      isOnline ? "fill-green-500 text-green-500 animate-pulse" :
                      "fill-red-500 text-red-500"
                    )}
                  />
                  <span className="text-xs text-muted-foreground font-normal">
                    {isPaused ? "Pausado" : isOnline ? "Online" : "Offline"}
                  </span>
                </span>
              )}
            </Link>
            <div className="flex gap-1">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href ||
                  (link.href === "/bot" && pathname?.startsWith("/bot"));

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/bot/monitor">
              <Button variant="outline" size="sm" className="gap-2">
                <Activity className="h-4 w-4" />
                Monitor
              </Button>
            </Link>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
