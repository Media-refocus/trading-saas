"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity, Target } from "lucide-react";

interface WinRateCardProps {
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgProfit: number;
  avgLoss: number;
}

export function WinRateCard({
  winRate,
  totalTrades,
  winningTrades,
  losingTrades,
  avgProfit,
  avgLoss,
}: WinRateCardProps) {
  const isPositive = winRate >= 50;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          Win Rate
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Win Rate Principal */}
          <div className="text-center">
            <div
              className={`text-5xl font-bold ${isPositive ? "text-green-500" : "text-red-500"}`}
            >
              {winRate.toFixed(1)}%
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Tasa de operaciones ganadoras
            </p>
          </div>

          {/* Barra de progreso visual */}
          <div className="relative h-4 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-500"
              style={{ width: `${winRate}%` }}
            />
            <div
              className="absolute right-0 top-0 h-full bg-red-500 transition-all duration-500"
              style={{ width: `${100 - winRate}%` }}
            />
          </div>

          {/* Estadisticas detalladas */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            {/* Ganadores */}
            <div className="space-y-1 p-3 bg-green-500/10 rounded-lg">
              <div className="flex items-center gap-1 text-green-500">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">Ganadores</span>
              </div>
              <div className="text-2xl font-bold text-green-500">
                {winningTrades}
              </div>
              <div className="text-xs text-muted-foreground">
                +{avgProfit.toFixed(2)} promedio
              </div>
            </div>

            {/* Perdedores */}
            <div className="space-y-1 p-3 bg-red-500/10 rounded-lg">
              <div className="flex items-center gap-1 text-red-500">
                <TrendingDown className="w-4 h-4" />
                <span className="text-sm font-medium">Perdedores</span>
              </div>
              <div className="text-2xl font-bold text-red-500">
                {losingTrades}
              </div>
              <div className="text-xs text-muted-foreground">
                {avgLoss.toFixed(2)} promedio
              </div>
            </div>
          </div>

          {/* Total de operaciones */}
          <div className="flex items-center justify-center gap-2 pt-2 border-t">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Total: <span className="font-medium text-foreground">{totalTrades}</span> operaciones
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
