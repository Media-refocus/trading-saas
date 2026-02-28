"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Activity, Settings, BarChart3, Bot, LogOut, Circle, Store, CreditCard, AlertTriangle, Clock, Zap, Menu, X } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { useState, useEffect, useRef } from "react";

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
          <div className="container mx-auto flex items-center justify-center gap-2 flex-wrap">
            <AlertTriangle className="h-4 w-4" />
            {subscription.isPastDue && (
              <>
                <span className="hidden sm:inline">Pago pendiente. Tu suscripción será cancelada si no se completa el pago.</span>
                <span className="sm:hidden">Pago pendiente</span>
                <Button
                  variant="link"
                  size="sm"
                  className="text-amber-700 dark:text-amber-400 p-0 h-auto"
                  onClick={handleBillingPortal}
                >
                  Actualizar
                </Button>
              </>
            )}
            {subscription.isPaused && (
              <>
                <span className="hidden sm:inline">Tu periodo de prueba ha finalizado.</span>
                <span className="sm:hidden">Prueba finalizada</span>
                <Link href="/pricing">
                  <Button
                    variant="link"
                    size="sm"
                    className="text-red-700 dark:text-red-400 p-0 h-auto"
                  >
                    Suscribirse
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      <nav className="border-b bg-background">
        <div className="container mx-auto px-4">
          <div className="flex h-14 md:h-16 items-center justify-between">
            {/* Logo + Status */}
            <Link href="/dashboard" className="text-lg md:text-xl font-bold flex items-center gap-2">
              <span className="hidden sm:inline">Trading Bot SaaS</span>
              <span className="sm:hidden">TradingBot</span>
              {/* Indicador de estado del bot */}
              {(isOnline || isPaused) && (
                <span className="flex items-center gap-1 ml-1 md:ml-2">
                  <Circle
                    className={cn(
                      "h-2.5 w-2.5",
                      isPaused ? "fill-amber-500 text-amber-500" :
                      isOnline ? "fill-green-500 text-green-500 animate-pulse" :
                      "fill-red-500 text-red-500"
                    )}
                  />
                  <span className="text-xs text-muted-foreground font-normal hidden sm:inline">
                    {isPaused ? "Pausado" : isOnline ? "Online" : "Offline"}
                  </span>
                </span>
              )}
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
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

            {/* Desktop Right Side */}
            <div className="hidden md:flex items-center gap-3">
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

            {/* Mobile Hamburger Button */}
            <button
              className="md:hidden p-2.5 rounded-md hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Backdrop */}
        {mobileMenuOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div
            ref={mobileMenuRef}
            className="md:hidden border-t bg-background animate-in slide-in-from-top-2 duration-200 relative z-50"
          >
            <div className="container mx-auto px-4 py-2 space-y-0.5">
              {/* Mobile Nav Links */}
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href ||
                  (link.href === "/bot" && pathname?.startsWith("/bot"));

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition min-h-[48px]",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {link.label}
                  </Link>
                );
              })}

              {/* Divider */}
              <div className="border-t my-2" />

              {/* Mobile Subscription Badge */}
              {subscription && (
                <button
                  onClick={handleBillingPortal}
                  disabled={isPortalLoading}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm hover:bg-muted transition-colors min-h-[48px]"
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
                    {subscription.isTrial && <Clock className="h-3 w-3" />}
                    {subscription.isPastDue && <AlertTriangle className="h-3 w-3" />}
                    {subscription.isPaused && <Zap className="h-3 w-3" />}
                    {subscription.planName}
                    {subscription.isTrial && subscription.trialDaysRemaining !== null && subscription.trialDaysRemaining > 0 && (
                      <span className="text-[10px] opacity-80">({subscription.trialDaysRemaining}d)</span>
                    )}
                  </Badge>
                </button>
              )}

              {/* Mobile Monitor Link */}
              <Link
                href="/bot/monitor"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition min-h-[48px]"
              >
                <Activity className="h-5 w-5" />
                Monitor en vivo
              </Link>

              {/* Mobile Notification Bell */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-muted-foreground min-h-[48px]">
                <NotificationBell />
                <span>Notificaciones</span>
              </div>

              {/* Mobile Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors min-h-[48px]"
              >
                <LogOut className="h-5 w-5" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
