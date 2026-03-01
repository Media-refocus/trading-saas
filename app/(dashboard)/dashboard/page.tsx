"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import {
  TrendingUp,
  Bot,
  BarChart3,
  Store,
  ArrowRight,
  Heart,
  Download,
  Copy,
  Activity,
  Signal,
  Settings,
} from "lucide-react";

export default function DashboardPage() {
  // Obtener datos del marketplace
  const { data: topStrategies } = trpc.marketplace.getTop.useQuery(
    { period: "month", limit: 3 },
    { refetchInterval: 60000 }
  );

  // Obtener estado del bot
  const { data: botStatus } = trpc.bot.getStatus.useQuery(undefined, {
    refetchInterval: 30000,
  });

  // Obtener info de señales
  const { data: signalsInfo } = trpc.backtester.getSignalsInfo.useQuery(
    { source: "signals_simple.csv" },
    { staleTime: 300000 }
  );

  const formatProfit = (value: number) => {
    const prefix = value >= 0 ? "+" : "";
    return `${prefix}$${value.toFixed(2)}`;
  };

  return (
    <div className="space-y-5 pb-8 md:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
            Bienvenido a tu panel de control de trading
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
            botStatus?.isOnline
              ? "bg-green-500/10 text-green-600"
              : "bg-muted text-muted-foreground"
          }`}>
            <Bot className="w-4 h-4" />
            <span>{botStatus?.isOnline ? "Bot Online" : "Bot Offline"}</span>
          </div>
        </div>
      </div>

      {/* Quick Stats - 2x2 grid on mobile */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 min-h-[80px]">
          <CardContent className="p-4 md:pt-6 md:pb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Señales</p>
                <p className="text-xl md:text-2xl font-bold">{signalsInfo?.total || 0}</p>
              </div>
              <Signal className="w-8 h-8 md:w-10 md:h-10 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20 min-h-[80px]">
          <CardContent className="p-4 md:pt-6 md:pb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Operativas</p>
                <p className="text-xl md:text-2xl font-bold">{topStrategies?.length || 0}</p>
              </div>
              <Store className="w-8 h-8 md:w-10 md:h-10 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20 min-h-[80px]">
          <CardContent className="p-4 md:pt-6 md:pb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Bot Status</p>
                <p className="text-xl md:text-2xl font-bold">{botStatus?.isOnline ? "Activo" : "Inactivo"}</p>
              </div>
              <Activity className="w-8 h-8 md:w-10 md:h-10 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20 min-h-[80px]">
          <CardContent className="p-4 md:pt-6 md:pb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Win Rate</p>
                <p className="text-xl md:text-2xl font-bold">--</p>
              </div>
              <TrendingUp className="w-8 h-8 md:w-10 md:h-10 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Top Operativas */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Store className="w-4 h-4 md:w-5 md:h-5" />
                Top Operativas del Mes
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">Las estrategias más populares</CardDescription>
            </div>
            <Link href="/operativas" className="shrink-0">
              <Button variant="outline" size="sm" className="text-xs md:text-sm">
                Ver todas
                <ArrowRight className="w-3 h-3 md:w-4 md:h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {topStrategies && topStrategies.length > 0 ? (
              <div className="space-y-3 md:space-y-4">
                {topStrategies.map((strategy, idx) => (
                  <div
                    key={strategy.id}
                    className="flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className={`flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full text-xs md:text-sm font-bold shrink-0 ${
                      idx === 0 ? "bg-yellow-500/20 text-yellow-600" :
                      idx === 1 ? "bg-gray-500/20 text-gray-600" :
                      "bg-amber-700/20 text-amber-700"
                    }`}>
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm md:text-base">{strategy.name}</p>
                      <p className="text-xs md:text-sm text-muted-foreground truncate">
                        por {"Usuario"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm shrink-0">
                      <div className={`font-mono font-bold hidden sm:block ${
                        strategy.totalProfit >= 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {formatProfit(strategy.totalProfit)}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Heart className="w-3 h-3 md:w-4 md:h-4" />
                        <span className="hidden sm:inline">{strategy.likesCount}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Download className="w-3 h-3 md:w-4 md:h-4" />
                        <span className="hidden sm:inline">{strategy.downloadsCount}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 px-4 text-muted-foreground">
                <Store className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 opacity-50" />
                <p className="text-[13px]">No hay operativas publicadas aún</p>
                <Link href="/backtester">
                  <Button variant="outline" size="sm" className="mt-3 text-xs md:text-sm min-h-[44px]">
                    Sé el primero en publicar
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Acciones Rápidas</CardTitle>
            <CardDescription className="text-xs md:text-sm">Comienza a operar en minutos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 md:space-y-3">
            <Link href="/backtester" className="block">
              <div className="flex items-center gap-3 md:gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="p-2.5 rounded-lg bg-blue-500/10 shrink-0">
                  <BarChart3 className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm md:text-base">Ejecutar Backtest</h3>
                  <p className="text-xs md:text-sm text-muted-foreground truncate">
                    Prueba estrategias con datos históricos
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 self-center" />
              </div>
            </Link>

            <Link href="/operativas" className="block">
              <div className="flex items-center gap-3 md:gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="p-2.5 rounded-lg bg-green-500/10 shrink-0">
                  <Store className="w-5 h-5 md:w-6 md:h-6 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm md:text-base">Explorar Marketplace</h3>
                  <p className="text-xs md:text-sm text-muted-foreground truncate">
                    Descubre estrategias de otros traders
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 self-center" />
              </div>
            </Link>

            <Link href="/bot" className="block">
              <div className="flex items-center gap-3 md:gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="p-2.5 rounded-lg bg-purple-500/10 shrink-0">
                  <Bot className="w-5 h-5 md:w-6 md:h-6 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm md:text-base">Bot Operativo</h3>
                  <p className="text-xs md:text-sm text-muted-foreground truncate">
                    Configura el bot de trading automático
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 self-center" />
              </div>
            </Link>

            <Link href="/settings" className="block">
              <div className="flex items-center gap-3 md:gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="p-2.5 rounded-lg bg-muted shrink-0">
                  <Settings className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm md:text-base">Configuración</h3>
                  <p className="text-xs md:text-sm text-muted-foreground truncate">
                    Gestiona tu cuenta y preferencias
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 self-center" />
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity / Tips */}
      <Card>
        <CardHeader className="pb-2 md:pb-4">
          <CardTitle className="text-base md:text-lg">Tips para Empezar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted/30 rounded-lg">
              <h4 className="font-semibold mb-2 text-sm md:text-base">1. Prueba el Backtester</h4>
              <p className="text-xs md:text-sm text-muted-foreground">
                Usa las {signalsInfo?.total || "3,139"} señales históricas disponibles para probar tus estrategias.
              </p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg">
              <h4 className="font-semibold mb-2 text-sm md:text-base">2. Publica tu Mejor Estrategia</h4>
              <p className="text-xs md:text-sm text-muted-foreground">
                Comparte tus resultados y ayuda a otros traders a encontrar operativas rentables.
              </p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg">
              <h4 className="font-semibold mb-2 text-sm md:text-base">3. Conecta tu Bot</h4>
              <p className="text-xs md:text-sm text-muted-foreground">
                Configura el bot para ejecutar automáticamente las señales en tu cuenta MT5.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
