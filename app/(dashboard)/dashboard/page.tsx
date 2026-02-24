"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BotStatus {
  hasApiKey: boolean;
  isActive: boolean;
  lastHeartbeat: string | null;
}

export default function DashboardPage() {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBotStatus();
  }, []);

  const fetchBotStatus = async () => {
    try {
      const res = await fetch("/api/bot/apikey");
      const data = await res.json();
      setBotStatus(data);
    } catch (error) {
      console.error("Error fetching bot status:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Bienvenido a tu panel de control de trading
        </p>
      </div>

      {/* Estado del Bot */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Estado del Bot</CardTitle>
              <CardDescription>
                Tu conexion con el bot de trading
              </CardDescription>
            </div>
            {!loading && botStatus && (
              <Badge variant={botStatus.isActive ? "default" : "secondary"}>
                {botStatus.isActive ? "Conectado" : botStatus.hasApiKey ? "Desconectado" : "No configurado"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-1/3"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          ) : !botStatus?.hasApiKey ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Aun no has configurado tu bot. Sigue los pasos de instalacion para comenzar a operar.
              </p>
              <Button asChild>
                <Link href="/setup">Configurar Bot</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${botStatus.isActive ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></div>
                <div>
                  <p className="font-medium">
                    {botStatus.isActive ? "Bot operando normalmente" : "Bot desconectado"}
                  </p>
                  {botStatus.lastHeartbeat && (
                    <p className="text-sm text-muted-foreground">
                      Ultima conexion: {new Date(botStatus.lastHeartbeat).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <Button variant="outline" asChild>
                <Link href="/setup">Ver Configuracion</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metricas */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Senales Procesadas</CardTitle>
            <CardDescription>Ultimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
            <p className="text-sm text-muted-foreground mt-2">
              Sin datos aun
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Posiciones Abiertas</CardTitle>
            <CardDescription>En tiempo real</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
            <p className="text-sm text-muted-foreground mt-2">
              Sin posiciones activas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profit del Mes</CardTitle>
            <CardDescription>Este mes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">+$0</div>
            <p className="text-sm text-muted-foreground mt-2">
              Sin datos aun
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Acciones */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rapidas</CardTitle>
          <CardDescription>
            Accede a las herramientas del SaaS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 border rounded-lg">
            <div className="flex-1">
              <h3 className="font-semibold">Ejecutar Backtest</h3>
              <p className="text-sm text-muted-foreground">
                Analiza las senales historicas con tus parametros
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/backtester">Ir a Backtester</Link>
            </Button>
          </div>

          <div className="flex items-center gap-4 p-4 border rounded-lg">
            <div className="flex-1">
              <h3 className="font-semibold">Instalar Bot en VPS</h3>
              <p className="text-sm text-muted-foreground">
                Descarga el script de instalacion para tu servidor
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/setup">Ir a Setup</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
