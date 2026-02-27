"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Activity, Settings, BarChart3, Bot, LogOut, Circle, Store, CreditCard, AlertTriangle, Clock, Zap } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { useState } from "react";

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  };

  // Fetch subscription status
  const { data: subscription } = trpc.tenant.getSubscription.useQuery(undefined, {
    enabled: !!session?.user,
    refetchInterval: 60000, // Refresh every minute for trial countdown
  });

  // Obtener estado del bot (solo si estamos en rutas del dashboard)
  const { data: botStatus } = trpc.bot.getStatus.useQuery(undefined, {
    refetchInterval: 30000, // Cada 30 segundos
    enabled: pathname.startsWith("/dashboard") || pathname.startsWith("/bot") || pathname === "/",
  });

  const isOnline = botStatus?.isOnline;
  const isPaused = botStatus?.status === "PAUSED";

  // Handle billing portal redirect
  const handleBillingPortal = async () => {
    if (!subscription?.hasStripeCustomer) {
      router.push("/pricing");
      return;
    }

    setIsPortalLoading(true);
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to create portal session");
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error("Portal error:", error);
      router.push("/pricing");
    } finally {
      setIsPortalLoading(false);
    }
  };

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/backtester", label: "Backtester", icon: Activity },
    { href: "/operativas", label: "Operativas", icon: Store },
    { href: "/bot", label: "Bot Operativo", icon: Bot },
    { href: "/settings", label: "Configuración", icon: Settings },
  ];

  return (
    <>
      {/* Warning banner for past_due or paused subscriptions */}
      {subscription && (subscription.isPastDue || subscription.isPaused) && (
        <div
          className={cn(
            "w-full py-2 px-4 text-center text-sm font-medium",
            subscription.isPastDue
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-b border-amber-500/20"
              : "bg-red-500/10 text-red-700 dark:text-red-400 border-b border-red-500/20"
          )}
        >
          <div className="container mx-auto flex items-center justify-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {subscription.isPastDue && (
              <>
                <span>Pago pendiente. Tu suscripción será cancelada si no se completa el pago.</span>
                <Button
                  variant="link"
                  size="sm"
                  className="text-amber-700 dark:text-amber-400 p-0 h-auto"
                  onClick={handleBillingPortal}
                >
                  Actualizar pago
                </Button>
              </>
            )}
            {subscription.isPaused && (
              <>
                <span>Tu periodo de prueba ha finalizado.</span>
                <Link href="/pricing">
                  <Button
                    variant="link"
                    size="sm"
                    className="text-red-700 dark:text-red-400 p-0 h-auto"
                  >
                    Suscribirse ahora
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}

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
              {/* Subscription status badge */}
              {subscription && (
                <button
                  onClick={handleBillingPortal}
                  disabled={isPortalLoading}
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                  title={
                    subscription.hasStripeCustomer
                      ? "Gestionar suscripción"
                      : "Ver planes"
                  }
                >
                  <Badge
                    variant={
                      subscription.isPastDue
                        ? "destructive"
                        : subscription.isPaused
                        ? "outline"
                        : subscription.isTrial
                        ? "secondary"
                        : "default"
                    }
                    className={cn(
                      "gap-1.5",
                      subscription.isPaused && "border-red-500/50 text-red-600"
                    )}
                  >
                    {subscription.isTrial && (
                      <Clock className="h-3 w-3" />
                    )}
                    {subscription.isPastDue && (
                      <AlertTriangle className="h-3 w-3" />
                    )}
                    {subscription.isPaused && (
                      <Zap className="h-3 w-3" />
                    )}
                    {subscription.planName}
                    {subscription.isTrial && subscription.trialDaysRemaining !== null && subscription.trialDaysRemaining > 0 && (
                      <span className="text-[10px] opacity-80">
                        ({subscription.trialDaysRemaining}d)
                      </span>
                    )}
                  </Badge>
                </button>
              )}

              <NotificationBell />
              <Link href="/bot/monitor">
                <Button variant="outline" size="sm" className="gap-2">
                  <Activity className="h-4 w-4" />
                  Monitor
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Cerrar Sesion
              </Button>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
