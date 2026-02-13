"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

interface BacktestConfig {
  strategyName: string;
  lotajeBase: number;
  numOrders: number;
  pipsDistance: number;
  maxLevels: number;
  takeProfitPips: number;
  stopLossPips?: number;
  useStopLoss: boolean;
  restrictionType?: "RIESGO" | "SIN_PROMEDIOS" | "SOLO_1_PROMEDIO";
}

const defaultConfig: BacktestConfig = {
  strategyName: "Toni (G4)",
  lotajeBase: 0.1,
  numOrders: 1,
  pipsDistance: 10,
  maxLevels: 4,
  takeProfitPips: 20,
  useStopLoss: false,
};

export default function BacktesterPage() {
  const [config, setConfig] = useState<BacktestConfig>(defaultConfig);
  const [signalLimit, setSignalLimit] = useState(100);

  // tRPC hooks
  const signalsInfo = trpc.backtester.getSignalsInfo.useQuery();
  const executeBacktest = trpc.backtester.execute.useMutation();
  const history = trpc.backtester.getHistory.useQuery();

  const handleExecute = async () => {
    try {
      await executeBacktest.mutateAsync({
        config,
        signalLimit,
      });
    } catch (error) {
      console.error("Error ejecutando backtest:", error);
    }
  };

  const updateConfig = <K extends keyof BacktestConfig>(
    key: K,
    value: BacktestConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const results = executeBacktest.data?.results;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Backtester</h1>
        <p className="text-muted-foreground mt-2">
          Simula tu estrategia con datos históricos - Grid con promedios y trailing SL
        </p>
      </div>

      {/* Stats de señales */}
      {signalsInfo.data && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{signalsInfo.data.total}</div>
                <div className="text-sm text-muted-foreground">Señales totales</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-500">{signalsInfo.data.bySide.buy}</div>
                <div className="text-sm text-muted-foreground">BUY</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-500">{signalsInfo.data.bySide.sell}</div>
                <div className="text-sm text-muted-foreground">SELL</div>
              </div>
              <div>
                <div className="text-sm font-medium">
                  {signalsInfo.data.dateRange.start
                    ? new Date(signalsInfo.data.dateRange.start).toLocaleDateString()
                    : "-"}
                </div>
                <div className="text-sm text-muted-foreground">Desde</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Configuración */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración</CardTitle>
            <CardDescription>
              Ajusta los parámetros de tu estrategia de trading
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Estrategia y Restricción */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="strategy">Estrategia</Label>
                <select
                  id="strategy"
                  className="w-full mt-1.5 px-3 py-2 border rounded-md bg-background"
                  value={config.strategyName}
                  onChange={(e) => updateConfig("strategyName", e.target.value)}
                >
                  <option>Toni (G4)</option>
                  <option>Xisco (G2)</option>
                  <option>Personalizada</option>
                </select>
              </div>
              <div>
                <Label htmlFor="restriction">Restricción</Label>
                <select
                  id="restriction"
                  className="w-full mt-1.5 px-3 py-2 border rounded-md bg-background"
                  value={config.restrictionType || ""}
                  onChange={(e) =>
                    updateConfig(
                      "restrictionType",
                      e.target.value as BacktestConfig["restrictionType"]
                    )
                  }
                >
                  <option value="">Sin restricción</option>
                  <option value="RIESGO">Riesgo (1 op)</option>
                  <option value="SIN_PROMEDIOS">Sin promedios</option>
                  <option value="SOLO_1_PROMEDIO">Solo 1 promedio</option>
                </select>
              </div>
            </div>

            {/* Parámetros de entrada */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Entrada
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lotajeBase">Lotaje Base</Label>
                  <Input
                    id="lotajeBase"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="10"
                    value={config.lotajeBase}
                    onChange={(e) => updateConfig("lotajeBase", parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="numOrders">Órdenes por señal</Label>
                  <Input
                    id="numOrders"
                    type="number"
                    min="1"
                    max="5"
                    value={config.numOrders}
                    onChange={(e) => updateConfig("numOrders", parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>

            {/* Parámetros del Grid */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Grid de Promedios
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pipsDistance">Distancia (pips)</Label>
                  <Input
                    id="pipsDistance"
                    type="number"
                    min="1"
                    max="100"
                    value={config.pipsDistance}
                    onChange={(e) => updateConfig("pipsDistance", parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="maxLevels">Máx. Niveles</Label>
                  <Input
                    id="maxLevels"
                    type="number"
                    min="1"
                    max="40"
                    value={config.maxLevels}
                    onChange={(e) => updateConfig("maxLevels", parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>

            {/* Take Profit y Stop Loss */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Salida
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="takeProfitPips">Take Profit (pips)</Label>
                  <Input
                    id="takeProfitPips"
                    type="number"
                    min="5"
                    max="100"
                    value={config.takeProfitPips}
                    onChange={(e) => updateConfig("takeProfitPips", parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="stopLossPips">Stop Loss (pips)</Label>
                  <Input
                    id="stopLossPips"
                    type="number"
                    min="0"
                    max="500"
                    value={config.stopLossPips || ""}
                    onChange={(e) =>
                      updateConfig("stopLossPips", e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    disabled={!config.useStopLoss}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useStopLoss"
                  checked={config.useStopLoss}
                  onChange={(e) => updateConfig("useStopLoss", e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="useStopLoss" className="cursor-pointer">
                  Activar Stop Loss de emergencia
                </Label>
              </div>
            </div>

            {/* Límite de señales */}
            <div>
              <Label htmlFor="signalLimit">Señales a simular</Label>
              <Input
                id="signalLimit"
                type="number"
                min="1"
                max="10000"
                value={signalLimit}
                onChange={(e) => setSignalLimit(parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Máximo: {signalsInfo.data?.total || 0} señales disponibles
              </p>
            </div>

            {/* Botón ejecutar */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleExecute}
              disabled={executeBacktest.isPending}
            >
              {executeBacktest.isPending ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Ejecutando...
                </>
              ) : (
                "Ejecutar Backtest"
              )}
            </Button>

            {executeBacktest.isError && (
              <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                Error: {executeBacktest.error.message}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resultados */}
        <Card>
          <CardHeader>
            <CardTitle>Resultados</CardTitle>
            <CardDescription>
              Métricas del backtest ejecutado
            </CardDescription>
          </CardHeader>
          <CardContent>
            {results ? (
              <div className="space-y-6">
                {/* Métricas principales */}
                <div className="grid grid-cols-2 gap-4">
                  <MetricCard
                    label="Profit Total"
                    value={`$${results.totalProfit.toFixed(2)}`}
                    positive={results.totalProfit >= 0}
                  />
                  <MetricCard
                    label="Profit (pips)"
                    value={`${results.totalProfitPips.toFixed(1)} pips`}
                    positive={results.totalProfitPips >= 0}
                  />
                  <MetricCard
                    label="Win Rate"
                    value={`${results.winRate.toFixed(1)}%`}
                    positive={results.winRate >= 50}
                  />
                  <MetricCard
                    label="Profit Factor"
                    value={results.profitFactor.toFixed(2)}
                    positive={results.profitFactor >= 1}
                  />
                  <MetricCard
                    label="Total Operaciones"
                    value={results.totalTrades.toString()}
                  />
                  <MetricCard
                    label="Max Drawdown"
                    value={`$${results.maxDrawdown.toFixed(2)}`}
                    positive={results.maxDrawdown < 1000}
                  />
                </div>

                {/* Trades recientes */}
                {results.trades.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Últimas operaciones</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {results.trades.slice(-10).reverse().map((trade: any, i: number) => (
                        <div
                          key={i}
                          className={`p-2 rounded text-sm ${
                            trade.profit >= 0 ? "bg-green-100" : "bg-red-100"
                          }`}
                        >
                          <div className="flex justify-between">
                            <span className={trade.side === "BUY" ? "text-green-600" : "text-red-600"}>
                              {trade.side} - {trade.type}
                            </span>
                            <span className="font-mono">
                              {trade.profit >= 0 ? "+" : ""}${trade.profit?.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Nivel {trade.level} @ {trade.price?.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>Ejecuta un backtest para ver los resultados</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historial */}
      {history.data && history.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
            <CardDescription>Últimos backtests ejecutados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">ID</th>
                    <th className="text-left py-2">Estrategia</th>
                    <th className="text-right py-2">Trades</th>
                    <th className="text-right py-2">Profit</th>
                    <th className="text-right py-2">Win Rate</th>
                    <th className="text-right py-2">Drawdown</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.map((h: {
                    id: string;
                    strategyName: string;
                    totalTrades?: number;
                    totalProfit?: number;
                    winRate?: number;
                    maxDrawdown?: number;
                  }) => (
                    <tr key={h.id} className="border-b">
                      <td className="py-2 font-mono text-xs">{h.id.slice(-8)}</td>
                      <td className="py-2">{h.strategyName}</td>
                      <td className="text-right py-2">{h.totalTrades}</td>
                      <td className={`text-right py-2 ${h.totalProfit && h.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        ${h.totalProfit?.toFixed(2)}
                      </td>
                      <td className="text-right py-2">{h.winRate?.toFixed(1)}%</td>
                      <td className="text-right py-2">${h.maxDrawdown?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Componente auxiliar para métricas
function MetricCard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="p-4 rounded-lg bg-muted/50">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div
        className={`text-xl font-bold ${
          positive === true
            ? "text-green-600"
            : positive === false
            ? "text-red-600"
            : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
