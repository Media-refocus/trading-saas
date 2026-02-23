"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import SimpleCandleChart from "@/components/simple-candle-chart";
import { CHART_THEMES, getPreferredTheme, savePreferredTheme } from "@/lib/chart-themes";

interface BacktestFilters {
  dateFrom?: string;
  dateTo?: string;
  daysOfWeek?: number[];
  session?: "ASIAN" | "EUROPEAN" | "US" | "ALL";
  side?: "BUY" | "SELL";
}

interface BacktestConfig {
  strategyName: string;
  lotajeBase: number;
  numOrders: number;
  pipsDistance: number;
  maxLevels: number;
  takeProfitPips: number;
  stopLossPips?: number;
  useStopLoss: boolean;
  useTrailingSL?: boolean;
  trailingSLPercent?: number;
  restrictionType?: "RIESGO" | "SIN_PROMEDIOS" | "SOLO_1_PROMEDIO";
  signalsSource?: string;
  initialCapital?: number;
  useRealPrices?: boolean; // Habilitado para tests con pocas señales
  filters?: BacktestFilters;
}

const defaultConfig: BacktestConfig = {
  strategyName: "Toni (G4)",
  lotajeBase: 0.1,
  numOrders: 1,
  pipsDistance: 10,
  maxLevels: 4,
  takeProfitPips: 20,
  useStopLoss: false,
  useTrailingSL: true,
  trailingSLPercent: 50,
  signalsSource: "signals_simple.csv",
  initialCapital: 10000,
  useRealPrices: true, // Habilitado para tests con pocas señales
};

export default function BacktesterPage() {
  const [config, setConfig] = useState<BacktestConfig>(defaultConfig);
  const [signalLimit, setSignalLimit] = useState(100);
  const [chartTheme, setChartTheme] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return getPreferredTheme();
    }
    return "mt5";
  });

  // tRPC hooks
  const signalsInfo = trpc.backtester.getSignalsInfo.useQuery({ source: config.signalsSource });
  const signalSources = trpc.backtester.listSignalSources.useQuery();
  const cacheStatus = trpc.backtester.getCacheStatus.useQuery();
  const executeBacktest = trpc.backtester.execute.useMutation();
  const allJobs = trpc.backtester.getAllJobs.useQuery();
  const clearCache = trpc.backtester.clearCache.useMutation();

  // Optimizer hooks
  const optimizationPresets = trpc.backtester.getOptimizationPresets.useQuery();
  const runOptimization = trpc.backtester.optimize.useMutation();
  const [optimizationResults, setOptimizationResults] = useState<any[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<number>(1); // Balanceado por defecto

  // Comparador de estrategias
  const [savedResults, setSavedResults] = useState<Array<{ name: string; config: BacktestConfig; results: any }>>([]);
  const [compareIndexes, setCompareIndexes] = useState<number[]>([]);

  // Gráfico de trade
  const [selectedTradeIndex, setSelectedTradeIndex] = useState<number | null>(null);

  // Cargar resultados guardados del localStorage
  useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("backtest-saved-results");
      if (saved) {
        try {
          setSavedResults(JSON.parse(saved));
        } catch (e) {
          console.error("Error loading saved results:", e);
        }
      }
    }
  });

  const saveCurrentResult = () => {
    if (!executeBacktest.data?.results) return;
    const name = `${config.strategyName} - ${new Date().toLocaleDateString()}`;
    const newSaved = [...savedResults, {
      name,
      config: { ...config },
      results: executeBacktest.data.results,
    }];
    setSavedResults(newSaved);
    localStorage.setItem("backtest-saved-results", JSON.stringify(newSaved));
  };

  const deleteSavedResult = (index: number) => {
    const newSaved = savedResults.filter((_, i) => i !== index);
    setSavedResults(newSaved);
    setCompareIndexes(compareIndexes.filter(i => i !== index));
    localStorage.setItem("backtest-saved-results", JSON.stringify(newSaved));
  };

  const toggleCompare = (index: number) => {
    if (compareIndexes.includes(index)) {
      setCompareIndexes(compareIndexes.filter(i => i !== index));
    } else if (compareIndexes.length < 3) {
      setCompareIndexes([...compareIndexes, index]);
    }
  };

  const handleExecute = async () => {
    try {
      // Convertir filtros de string a Date si es necesario
      const processedConfig = {
        ...config,
        filters: config.filters ? {
          ...config.filters,
          dateFrom: config.filters.dateFrom ? new Date(config.filters.dateFrom) : undefined,
          dateTo: config.filters.dateTo ? new Date(config.filters.dateTo) : undefined,
        } : undefined,
      };
      await executeBacktest.mutateAsync({
        config: processedConfig,
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

      {/* Stats de señales y cache */}
      <div className="grid lg:grid-cols-2 gap-6">
        {signalsInfo.data && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Señales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{signalsInfo.data.total}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
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

        {cacheStatus.data && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Cache de Ticks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{cacheStatus.data.isLoaded ? "OK" : "..."}</div>
                  <div className="text-sm text-muted-foreground">Estado</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{(cacheStatus.data.totalTicks / 1000000).toFixed(1)}M</div>
                  <div className="text-sm text-muted-foreground">Ticks</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{cacheStatus.data.totalDays}</div>
                  <div className="text-sm text-muted-foreground">Días</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{cacheStatus.data.memoryMB}MB</div>
                  <div className="text-sm text-muted-foreground">RAM</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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
            {/* Fuente de señales y Estrategia */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="signalsSource">Fuente de señales</Label>
                <select
                  id="signalsSource"
                  className="w-full mt-1.5 px-3 py-2 border rounded-md bg-background"
                  value={config.signalsSource}
                  onChange={(e) => updateConfig("signalsSource", e.target.value)}
                >
                  {signalSources.data?.map((s) => (
                    <option key={s.file} value={s.file}>
                      {s.file} ({s.total} señales)
                    </option>
                  ))}
                </select>
              </div>
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
            </div>

            {/* Restricción */}
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

            {/* Parámetros de entrada */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Entrada
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="initialCapital">Capital Inicial (€)</Label>
                  <Input
                    id="initialCapital"
                    type="number"
                    step="100"
                    min="100"
                    max="10000000"
                    value={config.initialCapital}
                    onChange={(e) => updateConfig("initialCapital", parseFloat(e.target.value))}
                  />
                </div>
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
              </div>
              <div className="grid grid-cols-2 gap-4">
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

            {/* Trailing Stop Loss Virtual */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Trailing Stop Loss Virtual
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useTrailingSL"
                  checked={config.useTrailingSL}
                  onChange={(e) => updateConfig("useTrailingSL", e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="useTrailingSL" className="cursor-pointer">
                  Activar Trailing SL Virtual
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                El trailing SL se activa al alcanzar el TP y se arrastra detrás del precio para proteger ganancias.
              </p>
              {config.useTrailingSL && (
                <div>
                  <Label htmlFor="trailingSLPercent">Distancia del trailing (% del TP)</Label>
                  <Input
                    id="trailingSLPercent"
                    type="number"
                    min="10"
                    max="90"
                    value={config.trailingSLPercent}
                    onChange={(e) => updateConfig("trailingSLPercent", parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    50% = El SL se queda a mitad de camino (ej: TP 20 pips → SL cierra con +10 pips mínimo)
                  </p>
                </div>
              )}
            </div>

            {/* Filtros */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Filtros
              </h3>

              {/* Filtro de sesión */}
              <div>
                <Label htmlFor="session">Sesión de Trading</Label>
                <select
                  id="session"
                  className="w-full mt-1.5 px-3 py-2 border rounded-md bg-background"
                  value={config.filters?.session || ""}
                  onChange={(e) =>
                    updateConfig("filters", {
                      ...config.filters,
                      session: e.target.value as any || undefined,
                    })
                  }
                >
                  <option value="">Todas</option>
                  <option value="ASIAN">Asia (00:00-08:00 UTC)</option>
                  <option value="EUROPEAN">Europa (08:00-16:00 UTC)</option>
                  <option value="US">USA (13:00-21:00 UTC)</option>
                </select>
              </div>

              {/* Filtro de dirección */}
              <div>
                <Label htmlFor="sideFilter">Dirección</Label>
                <select
                  id="sideFilter"
                  className="w-full mt-1.5 px-3 py-2 border rounded-md bg-background"
                  value={config.filters?.side || ""}
                  onChange={(e) =>
                    updateConfig("filters", {
                      ...config.filters,
                      side: e.target.value as any || undefined,
                    })
                  }
                >
                  <option value="">Todas</option>
                  <option value="BUY">Solo BUY</option>
                  <option value="SELL">Solo SELL</option>
                </select>
              </div>

              {/* Filtro de días */}
              <div>
                <Label>Días de la semana</Label>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {["L", "M", "X", "J", "V", "S", "D"].map((day, i) => {
                    const dayNum = i === 6 ? 0 : i + 1; // Ajustar índice
                    const isSelected = config.filters?.daysOfWeek?.includes(dayNum);
                    return (
                      <button
                        key={day}
                        onClick={() => {
                          const current = config.filters?.daysOfWeek || [];
                          const newDays = isSelected
                            ? current.filter((d) => d !== dayNum)
                            : [...current, dayNum];
                          updateConfig("filters", {
                            ...config.filters,
                            daysOfWeek: newDays.length > 0 ? newDays : undefined,
                          });
                        }}
                        className={`w-8 h-8 rounded text-sm font-medium ${
                          isSelected
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botón limpiar filtros */}
              {(config.filters?.session || config.filters?.side || config.filters?.daysOfWeek) && (
                <button
                  onClick={() => updateConfig("filters", undefined)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            {/* Límite de señales */}
            <div>
              <Label htmlFor="signalLimit">Señales a simular</Label>
              <Input
                id="signalLimit"
                type="number"
                min="1"
                max="10000"
                value={signalLimit ?? ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setSignalLimit(isNaN(val) ? 0 : val);
                }}
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

            {/* Botón limpiar cache */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                clearCache.mutate();
                executeBacktest.reset();
              }}
              disabled={clearCache.isPending}
            >
              {clearCache.isPending ? "Limpiando..." : "Limpiar Cache"}
            </Button>
            {clearCache.isSuccess && (
              <p className="text-xs text-green-600 text-center">Cache limpiado</p>
            )}

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
                {/* Capital */}
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-sm text-muted-foreground">Capital Inicial</div>
                      <div className="text-xl font-bold">{results.initialCapital?.toLocaleString()}€</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Capital Final</div>
                      <div className={`text-xl font-bold ${results.finalCapital >= results.initialCapital ? "text-green-600" : "text-red-600"}`}>
                        {results.finalCapital?.toLocaleString()}€
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Retorno</div>
                      <div className={`text-xl font-bold ${results.profitPercent >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {results.profitPercent >= 0 ? "+" : ""}{results.profitPercent?.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Métricas principales */}
                <div className="grid grid-cols-2 gap-4">
                  <MetricCard
                    label="Profit Total"
                    value={`${results.totalProfit >= 0 ? "+" : ""}${results.totalProfit.toFixed(2)}€`}
                    positive={results.totalProfit >= 0}
                  />
                  <MetricCard
                    label="Profit (pips)"
                    value={`${results.totalProfitPips >= 0 ? "+" : ""}${results.totalProfitPips.toFixed(1)} pips`}
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
                    value={`${results.maxDrawdown.toFixed(2)}€ (${results.maxDrawdownPercent?.toFixed(1)}%)`}
                    positive={results.maxDrawdown < results.initialCapital * 0.2}
                  />
                </div>

                {/* Métricas Avanzadas */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Métricas Avanzadas
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <MetricCard
                      label="Sharpe Ratio"
                      value={results.sharpeRatio?.toFixed(2) || "-"}
                      positive={(results.sharpeRatio ?? 0) >= 1}
                    />
                    <MetricCard
                      label="Sortino Ratio"
                      value={results.sortinoRatio?.toFixed(2) || "-"}
                      positive={(results.sortinoRatio ?? 0) >= 1}
                    />
                    <MetricCard
                      label="Calmar Ratio"
                      value={results.calmarRatio?.toFixed(2) || "-"}
                      positive={(results.calmarRatio ?? 0) >= 3}
                    />
                    <MetricCard
                      label="Expectancy"
                      value={`${results.expectancy >= 0 ? "+" : ""}${results.expectancy?.toFixed(2) || "0"}€`}
                      positive={(results.expectancy ?? 0) > 0}
                    />
                    <MetricCard
                      label="Reward/Risk"
                      value={results.rewardRiskRatio?.toFixed(2) || "-"}
                      positive={(results.rewardRiskRatio ?? 0) >= 1.5}
                    />
                    <MetricCard
                      label="Avg Win / Loss"
                      value={`${results.avgWin?.toFixed(2) || "0"} / ${results.avgLoss?.toFixed(2) || "0"}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <MetricCard
                      label="Racha Wins"
                      value={results.maxConsecutiveWins?.toString() || "0"}
                    />
                    <MetricCard
                      label="Racha Losses"
                      value={results.maxConsecutiveLosses?.toString() || "0"}
                      positive={(results.maxConsecutiveLosses ?? 0) < 5}
                    />
                  </div>
                </div>

                {/* Profit Factor por Mes */}
                {results.profitFactorByMonth && results.profitFactorByMonth.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Profit Factor por Mes</h3>
                    <div className="overflow-x-auto">
                      <div className="flex gap-2 pb-2">
                        {results.profitFactorByMonth.slice(-12).map((m: any) => (
                          <div
                            key={m.month}
                            className={`flex-shrink-0 px-3 py-2 rounded text-center text-xs ${
                              m.profit >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}
                          >
                            <div className="font-medium">{m.month}</div>
                            <div className="font-bold">
                              {m.profitFactor === Infinity ? "∞" : m.profitFactor.toFixed(1)}
                            </div>
                            <div className="text-[10px]">
                              {m.profit >= 0 ? "+" : ""}{m.profit.toFixed(0)}€
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Segmentación */}
                {results.segmentation && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Análisis por Segmentos
                    </h3>

                    {/* Por sesión */}
                    {results.segmentation.bySession && results.segmentation.bySession.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Por Sesión</h4>
                        <div className="grid grid-cols-3 gap-2">
                          {results.segmentation.bySession.map((s: any) => (
                            <div key={s.segment} className="p-2 rounded bg-muted/50 text-center">
                              <div className="text-xs font-medium">{s.segment}</div>
                              <div className={`text-sm font-bold ${s.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {s.totalProfit >= 0 ? "+" : ""}{s.totalProfit.toFixed(0)}€
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {s.total} trades | {s.winRate.toFixed(0)}% WR
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Por día */}
                    {results.segmentation.byDay && results.segmentation.byDay.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Por Día</h4>
                        <div className="overflow-x-auto">
                          <div className="flex gap-1">
                            {results.segmentation.byDay.map((s: any) => (
                              <div key={s.segment} className="flex-shrink-0 p-2 rounded bg-muted/50 text-center min-w-[70px]">
                                <div className="text-xs font-medium">{s.segment.slice(0, 3)}</div>
                                <div className={`text-sm font-bold ${s.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                  {s.totalProfit >= 0 ? "+" : ""}{s.totalProfit.toFixed(0)}€
                                </div>
                                <div className="text-[10px] text-muted-foreground">{s.winRate.toFixed(0)}%</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Por dirección */}
                    {results.segmentation.bySide && results.segmentation.bySide.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Por Dirección</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {results.segmentation.bySide.map((s: any) => (
                            <div key={s.segment} className={`p-2 rounded text-center ${
                              s.segment === "BUY" ? "bg-green-50" : "bg-red-50"
                            }`}>
                              <div className={`text-sm font-bold ${s.segment === "BUY" ? "text-green-600" : "text-red-600"}`}>
                                {s.segment}
                              </div>
                              <div className={`text-lg font-bold ${s.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {s.totalProfit >= 0 ? "+" : ""}{s.totalProfit.toFixed(0)}€
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {s.total} | {s.winRate.toFixed(0)}% WR
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

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

      {/* Jobs */}
      {allJobs.data && (allJobs.data.active.length > 0 || allJobs.data.completed.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Jobs de Backtest</CardTitle>
            <CardDescription>
              Activos: {allJobs.data.stats.active} | En cola: {allJobs.data.stats.queued} | Completados: {allJobs.data.stats.completed}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">ID</th>
                    <th className="text-left py-2">Estado</th>
                    <th className="text-right py-2">Progreso</th>
                    <th className="text-right py-2">Profit</th>
                    <th className="text-right py-2">Drawdown</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Jobs activos */}
                  {allJobs.data.active.map((job: any) => (
                    <tr key={job.id} className="border-b bg-blue-50">
                      <td className="py-2 font-mono text-xs">{job.id.slice(-8)}</td>
                      <td className="py-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                          {job.status} ({job.currentSignal}/{job.totalSignals})
                        </span>
                      </td>
                      <td className="text-right py-2">{job.progress}%</td>
                      <td className="text-right py-2">-</td>
                      <td className="text-right py-2">-</td>
                    </tr>
                  ))}
                  {/* Jobs completados */}
                  {allJobs.data.completed.map((job: any) => (
                    <tr key={job.id} className="border-b">
                      <td className="py-2 font-mono text-xs">{job.id.slice(-8)}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          job.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="text-right py-2">100%</td>
                      <td className={`text-right py-2 ${job.results?.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        ${job.results?.totalProfit?.toFixed(2) || "-"}
                      </td>
                      <td className="text-right py-2">${job.results?.maxDrawdown?.toFixed(2) || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Optimizador de Parámetros */}
      <Card>
        <CardHeader>
          <CardTitle>Optimizador de Parámetros</CardTitle>
          <CardDescription>
            Encuentra la mejor configuración automáticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selector de preset */}
          <div className="grid grid-cols-3 gap-2">
            {optimizationPresets.data?.map((preset: any) => (
              <button
                key={preset.id}
                onClick={() => setSelectedPreset(preset.id)}
                className={`p-3 rounded-lg border text-left transition ${
                  selectedPreset === preset.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium">{preset.name}</div>
                <div className="text-xs text-muted-foreground">
                  {preset.combinations} combinaciones
                </div>
              </button>
            ))}
          </div>

          {/* Botón ejecutar */}
          <Button
            className="w-full"
            onClick={async () => {
              const preset = optimizationPresets.data?.[selectedPreset];
              if (!preset) return;

              setOptimizationResults([]);
              const result = await runOptimization.mutateAsync({
                params: preset.params,
                options: {
                  signalsSource: config.signalsSource,
                  signalLimit,
                  metric: "totalProfit",
                },
              });

              if (result.topResults) {
                setOptimizationResults(result.topResults);
              }
            }}
            disabled={runOptimization.isPending}
          >
            {runOptimization.isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Optimizando...
              </>
            ) : (
              "Ejecutar Optimización"
            )}
          </Button>

          {/* Resultados de optimización */}
          {optimizationResults.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3">Top 10 Configuraciones</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">#</th>
                      <th className="text-left py-2 px-2">Config</th>
                      <th className="text-right py-2 px-2">Profit</th>
                      <th className="text-right py-2 px-2">Win%</th>
                      <th className="text-right py-2 px-2">PF</th>
                      <th className="text-right py-2 px-2">DD%</th>
                      <th className="text-right py-2 px-2">Sharpe</th>
                      <th className="text-center py-2 px-2">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optimizationResults.slice(0, 10).map((opt: any, i: number) => (
                      <tr key={i} className={`border-b ${i === 0 ? "bg-green-50" : ""}`}>
                        <td className="py-2 px-2 font-bold">{i + 1}</td>
                        <td className="py-2 px-2">
                          <div className="text-xs">
                            {opt.config.pipsDistance}p / {opt.config.maxLevels}L / {opt.config.takeProfitPips}TP / {opt.config.trailingSLPercent}%Trail
                          </div>
                        </td>
                        <td className={`py-2 px-2 text-right font-mono ${opt.result.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {opt.result.totalProfit >= 0 ? "+" : ""}{opt.result.totalProfit?.toFixed(0)}€
                        </td>
                        <td className="py-2 px-2 text-right">{opt.result.winRate?.toFixed(0)}%</td>
                        <td className="py-2 px-2 text-right">{opt.result.profitFactor?.toFixed(2)}</td>
                        <td className="py-2 px-2 text-right text-red-600">{opt.result.maxDrawdownPercent?.toFixed(1)}%</td>
                        <td className="py-2 px-2 text-right">{opt.result.sharpeRatio?.toFixed(2)}</td>
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => {
                              setConfig({
                                ...config,
                                pipsDistance: opt.config.pipsDistance,
                                maxLevels: opt.config.maxLevels,
                                takeProfitPips: opt.config.takeProfitPips,
                                trailingSLPercent: opt.config.trailingSLPercent,
                                strategyName: `Optimized_${i + 1}`,
                              });
                            }}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                          >
                            Usar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Curva de Equity */}
      {results?.equityCurve && results.equityCurve.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Curva de Equity</CardTitle>
            <CardDescription>
              Evolución del balance durante el backtest
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EquityChart
              data={results.equityCurve}
              initialCapital={results.initialCapital}
            />
          </CardContent>
        </Card>
      )}

      {/* Detalle de Trades */}
      {results?.tradeDetails && results.tradeDetails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detalle de Operaciones</CardTitle>
            <CardDescription>
              {results.tradeDetails.length} operaciones completadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">#</th>
                    <th className="text-left py-2 px-2">Fecha</th>
                    <th className="text-left py-2 px-2">Side</th>
                    <th className="text-right py-2 px-2">Señal</th>
                    <th className="text-right py-2 px-2">Entrada</th>
                    <th className="text-right py-2 px-2">Salida</th>
                    <th className="text-right py-2 px-2">Niveles</th>
                    <th className="text-right py-2 px-2">Pips</th>
                    <th className="text-right py-2 px-2">Profit</th>
                    <th className="text-left py-2 px-2">Cierre</th>
                  </tr>
                </thead>
                <tbody>
                  {results.tradeDetails.slice(-50).reverse().map((trade: any, i: number) => (
                    <tr key={i} className={`border-b ${trade.totalProfit >= 0 ? "bg-green-50/50" : "bg-red-50/50"}`}>
                      <td className="py-2 px-2 font-mono text-xs">{results.tradeDetails.length - i}</td>
                      <td className="py-2 px-2">
                        {new Date(trade.signalTimestamp).toLocaleDateString()}
                      </td>
                      <td className={`py-2 px-2 font-semibold ${trade.signalSide === "BUY" ? "text-green-600" : "text-red-600"}`}>
                        {trade.signalSide}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">{trade.signalPrice?.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right font-mono">{trade.entryPrice?.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right font-mono">{trade.exitPrice?.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right">{trade.maxLevels}</td>
                      <td className={`py-2 px-2 text-right font-mono ${trade.totalProfitPips >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {trade.totalProfitPips >= 0 ? "+" : ""}{trade.totalProfitPips?.toFixed(1)}
                      </td>
                      <td className={`py-2 px-2 text-right font-mono font-semibold ${trade.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {trade.totalProfit >= 0 ? "+" : ""}{trade.totalProfit?.toFixed(2)}€
                      </td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          trade.exitReason === "TAKE_PROFIT"
                            ? "bg-green-100 text-green-800"
                            : trade.exitReason === "TRAILING_SL"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}>
                          {trade.exitReason === "TAKE_PROFIT" ? "TP" : trade.exitReason === "TRAILING_SL" ? "Trail" : "SL"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparador de Estrategias */}
      <Card>
        <CardHeader>
          <CardTitle>Comparador de Estrategias</CardTitle>
          <CardDescription>
            Guarda resultados y compáralos side-by-side
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Guardar resultado actual */}
          {results && (
            <Button onClick={saveCurrentResult} variant="outline" className="w-full">
              Guardar resultado actual
            </Button>
          )}

          {/* Lista de resultados guardados */}
          {savedResults.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Resultados Guardados ({savedResults.length})</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {savedResults.map((saved, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded border flex items-center justify-between ${
                      compareIndexes.includes(index) ? "border-blue-500 bg-blue-50" : "border-gray-200"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{saved.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {saved.config.pipsDistance}p | {saved.config.maxLevels}L | {saved.config.takeProfitPips}TP
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono font-bold ${saved.results.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {saved.results.totalProfit >= 0 ? "+" : ""}{saved.results.totalProfit?.toFixed(0)}€
                      </span>
                      <button
                        onClick={() => toggleCompare(index)}
                        disabled={!compareIndexes.includes(index) && compareIndexes.length >= 3}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 disabled:opacity-50"
                      >
                        {compareIndexes.includes(index) ? "Quitar" : "Comparar"}
                      </button>
                      <button
                        onClick={() => deleteSavedResult(index)}
                        className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200"
                      >
                        Borrar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabla comparativa */}
          {compareIndexes.length >= 2 && (
            <div>
              <h4 className="font-semibold mb-2">Comparación</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Métrica</th>
                      {compareIndexes.map(i => (
                        <th key={i} className="text-right py-2 px-2">{savedResults[i]?.name?.slice(0, 20)}...</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Profit", key: "totalProfit", format: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}€` },
                      { label: "Win Rate", key: "winRate", format: (v: number) => `${v.toFixed(1)}%` },
                      { label: "Profit Factor", key: "profitFactor", format: (v: number) => v.toFixed(2) },
                      { label: "Max DD %", key: "maxDrawdownPercent", format: (v: number) => `${v.toFixed(1)}%` },
                      { label: "Sharpe", key: "sharpeRatio", format: (v: number) => v.toFixed(2) },
                      { label: "Sortino", key: "sortinoRatio", format: (v: number) => v.toFixed(2) },
                      { label: "Expectancy", key: "expectancy", format: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}€` },
                      { label: "Trades", key: "totalTrades", format: (v: number) => v.toString() },
                    ].map(metric => (
                      <tr key={metric.key} className="border-b">
                        <td className="py-2 px-2 font-medium">{metric.label}</td>
                        {compareIndexes.map(i => {
                          const value = savedResults[i]?.results?.[metric.key];
                          const isProfit = metric.key === "totalProfit";
                          return (
                            <td
                              key={i}
                              className={`py-2 px-2 text-right font-mono ${
                                isProfit ? (value >= 0 ? "text-green-600" : "text-red-600") : ""
                              }`}
                            >
                              {metric.format(value || 0)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mensaje si no hay resultados */}
          {savedResults.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Ejecuta un backtest y guárdalo para poder comparar estrategias
            </p>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Trade Tipo MT5 */}
      {results?.tradeDetails && results.tradeDetails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Visualización de Trade</CardTitle>
            <CardDescription>
              Selecciona un trade para ver el gráfico con reproducción
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Selector de trade */}
            <div className="mb-4">
              <select
                value={selectedTradeIndex ?? ""}
                onChange={(e) => setSelectedTradeIndex(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 bg-slate-800 border-slate-700 rounded text-white"
              >
                <option value="">Selecciona un trade...</option>
                {results.tradeDetails.map((trade: any, i: number) => (
                  <option key={i} value={i}>
                    #{i + 1} - {new Date(trade.signalTimestamp).toLocaleDateString()} - {trade.signalSide} @ {trade.signalPrice?.toFixed(2)} -
                    {trade.totalProfit >= 0 ? "+" : ""}{trade.totalProfit?.toFixed(0)}€ ({trade.exitReason === "TAKE_PROFIT" ? "TP" : trade.exitReason === "TRAILING_SL" ? "Trail" : "SL"})
                  </option>
                ))}
              </select>
            </div>

            {/* Gráfico */}
            {selectedTradeIndex !== null && results.tradeDetails[selectedTradeIndex] && (
              <>
                {/* Selector de tema */}
                <div className="flex items-center gap-2 mb-4">
                  <Label className="text-sm text-gray-400">Tema:</Label>
                  <select
                    value={chartTheme}
                    onChange={(e) => {
                      setChartTheme(e.target.value);
                      savePreferredTheme(e.target.value);
                    }}
                    className="px-3 py-1.5 bg-slate-700 rounded text-sm text-white border border-slate-600"
                  >
                    {CHART_THEMES.map((theme) => (
                      <option key={theme.id} value={theme.id}>{theme.name}</option>
                    ))}
                  </select>
                </div>
                <TradeChartWrapper
                  trade={results.tradeDetails[selectedTradeIndex]}
                  config={{
                    takeProfitPips: config.takeProfitPips,
                    pipsDistance: config.pipsDistance,
                    maxLevels: config.maxLevels,
                  }}
                  themeId={chartTheme}
                />
              </>
            )}
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

// Componente para gráfico de equity
function EquityChart({
  data,
  initialCapital,
}: {
  data: Array<{ timestamp: Date; equity: number; balance: number; drawdown: number }>;
  initialCapital: number;
}) {
  if (data.length === 0) return null;

  const width = 800;
  const height = 300;
  const padding = 40;

  const minEquity = Math.min(...data.map(d => d.equity), initialCapital);
  const maxEquity = Math.max(...data.map(d => d.equity), initialCapital);
  const range = maxEquity - minEquity || 1;

  const xScale = (i: number) => padding + (i / (data.length - 1)) * (width - 2 * padding);
  const yScale = (v: number) => height - padding - ((v - minEquity) / range) * (height - 2 * padding);

  const pathD = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.equity)}`)
    .join(' ');

  const baselineY = yScale(initialCapital);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[600px]">
        {/* Línea de capital inicial */}
        <line
          x1={padding}
          y1={baselineY}
          x2={width - padding}
          y2={baselineY}
          stroke="#94a3b8"
          strokeDasharray="5,5"
        />

        {/* Área bajo la curva */}
        <path
          d={`${pathD} L ${xScale(data.length - 1)} ${height - padding} L ${padding} ${height - padding} Z`}
          fill="url(#equityGradient)"
          opacity="0.3"
        />

        {/* Línea de equity */}
        <path
          d={pathD}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
        />

        {/* Gradiente */}
        <defs>
          <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Labels */}
        <text x={padding} y={20} className="text-xs fill-muted-foreground">
          {maxEquity.toFixed(0)}€
        </text>
        <text x={padding} y={height - 10} className="text-xs fill-muted-foreground">
          {minEquity.toFixed(0)}€
        </text>
        <text x={width - padding - 80} y={baselineY - 5} className="text-xs fill-muted-foreground">
          Capital inicial
        </text>
      </svg>
    </div>
  );
}

// Función helper para validar que un trade tiene todos los datos necesarios
function isValidTradeForChart(trade: any): boolean {
  if (!trade) return false;
  if (trade.entryPrice == null || isNaN(trade.entryPrice)) return false;
  if (trade.exitPrice == null || isNaN(trade.exitPrice)) return false;
  if (!trade.entryTime) return false;
  if (!trade.exitTime) return false;
  if (!trade.signalSide) return false;

  // Verificar que las fechas son válidas
  const entryDate = new Date(trade.entryTime);
  const exitDate = new Date(trade.exitTime);
  if (isNaN(entryDate.getTime()) || isNaN(exitDate.getTime())) return false;

  return true;
}

// Componente wrapper para el gráfico con query de ticks
function TradeChartWrapper({
  trade,
  config,
  themeId = "mt5",
}: {
  trade: any;
  config: { takeProfitPips: number; pipsDistance: number; maxLevels: number };
  themeId?: string;
}) {
  // Validar que el trade tiene todos los datos necesarios ANTES de hacer cualquier cosa
  if (!isValidTradeForChart(trade)) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="mb-2">Datos del trade incompletos o inválidos</div>
        <div className="text-xs text-gray-500">
          Verifica que el trade tenga entryPrice, exitPrice, entryTime y exitTime válidos
        </div>
      </div>
    );
  }

  // Convertir fechas de forma segura (solo si pasamos la validación)
  const entryTime = new Date(trade.entryTime);
  const exitTime = new Date(trade.exitTime);

  const tradeTicks = trpc.backtester.getTradeTicks.useQuery(
    {
      entryTime,
      exitTime,
    },
    {
      enabled: true,
      retry: 1,
    }
  );

  // Mostrar estado de carga
  if (tradeTicks.isLoading) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="animate-spin text-2xl mb-2">⏳</div>
        Cargando datos del trade...
      </div>
    );
  }

  // Mostrar error si falla
  if (tradeTicks.isError) {
    return (
      <div className="text-center py-12 text-red-400">
        Error al cargar datos: {tradeTicks.error?.message || "Unknown error"}
      </div>
    );
  }

  return (
    <SimpleCandleChart
      ticks={tradeTicks.data?.ticks || []}
      trade={trade}
      config={config}
      hasRealTicks={tradeTicks.data?.hasRealTicks ?? false}
      themeId={themeId}
    />
  );
}
