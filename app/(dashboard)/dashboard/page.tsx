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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
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

      {/* Quick Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Señales Disponibles</p>
                <p className="text-2xl font-bold">{signalsInfo?.total || 0}</p>
              </div>
              <Signal className="w-8 h-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Operativas Publicadas</p>
                <p className="text-2xl font-bold">{topStrategies?.length || 0}</p>
              </div>
              <Store className="w-8 h-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bot Status</p>
                <p className="text-2xl font-bold">{botStatus?.isOnline ? "Activo" : "Inactivo"}</p>
              </div>
              <Activity className="w-8 h-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Win Rate Promedio</p>
                <p className="text-2xl font-bold">--</p>
              </div>
              <TrendingUp className="w-8 h-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Top Operativas */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5" />
                Top Operativas del Mes
              </CardTitle>
              <CardDescription>Las estrategias más populares en el marketplace</CardDescription>
            </div>
            <Link href="/operativas">
              <Button variant="outline" size="sm">
                Ver todas
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {topStrategies && topStrategies.length > 0 ? (
              <div className="space-y-4">
                {topStrategies.map((strategy, idx) => (
                  <div
                    key={strategy.id}
                    className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                      idx === 0 ? "bg-yellow-500/20 text-yellow-600" :
                      idx === 1 ? "bg-gray-500/20 text-gray-600" :
                      "bg-amber-700/20 text-amber-700"
                    }`}>
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{strategy.name}</p>
                      <p className="text-sm text-muted-foreground">
                        por {strategy.author?.name || "Anónimo"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className={`font-mono font-bold ${
                        strategy.totalProfit >= 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {formatProfit(strategy.totalProfit)}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Heart className="w-4 h-4" />
                        {strategy.likesCount}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Download className="w-4 h-4" />
                        {strategy.downloadsCount}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Store className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No hay operativas publicadas aún</p>
                <Link href="/backtester">
                  <Button variant="outline" size="sm" className="mt-3">
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
            <CardTitle>Acciones Rápidas</CardTitle>
            <CardDescription>Comienza a operar en minutos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/backtester" className="block">
              <div className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Ejecutar Backtest</h3>
                  <p className="text-sm text-muted-foreground">
                    Prueba estrategias con datos históricos
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>

            <Link href="/operativas" className="block">
              <div className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Store className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Explorar Marketplace</h3>
                  <p className="text-sm text-muted-foreground">
                    Descubre estrategias de otros traders
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>

            <Link href="/bot" className="block">
              <div className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Bot className="w-5 h-5 text-purple-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Bot Operativo</h3>
                  <p className="text-sm text-muted-foreground">
                    Configura el bot de trading automático
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>

            <Link href="/settings" className="block">
              <div className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="p-2 rounded-lg bg-muted">
                  <Settings className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Configuración</h3>
                  <p className="text-sm text-muted-foreground">
                    Gestiona tu cuenta y preferencias
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity / Tips */}
      <Card>
        <CardHeader>
          <CardTitle>💡 Tips para Empezar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted/30 rounded-lg">
              <h4 className="font-semibold mb-2">1. Prueba el Backtester</h4>
              <p className="text-sm text-muted-foreground">
                Usa las {signalsInfo?.total || "3,139"} señales históricas disponibles para probar tus estrategias.
              </p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg">
              <h4 className="font-semibold mb-2">2. Publica tu Mejor Estrategia</h4>
              <p className="text-sm text-muted-foreground">
                Comparte tus resultados y ayuda a otros traders a encontrar operativas rentables.
              </p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg">
              <h4 className="font-semibold mb-2">3. Conecta tu Bot</h4>
              <p className="text-sm text-muted-foreground">
                Configura el bot para ejecutar automáticamente las señales en tu cuenta MT5.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
