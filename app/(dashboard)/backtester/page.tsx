"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  useRealPrices?: boolean;
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
  useRealPrices: false,
};

// Estilos en línea para animaciones y transiciones suaves
const styles = `
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
  }
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .animate-fade-in { animation: fade-in 0.3s ease-out; }
  .animate-slide-up { animation: slide-up 0.4s ease-out; }
  .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
  .animate-shimmer {
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
  .trade-row { transition: all 0.15s ease; }
  .trade-row:hover { transform: translateX(2px); }
  .trade-row-selected {
    box-shadow: inset 3px 0 0 #3b82f6, inset 0 0 0 1px rgba(59, 130, 246, 0.2);
  }
  .metric-value { transition: all 0.2s ease; }
  .btn-execute { transition: all 0.2s ease; }
  .btn-execute:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4); }
  .btn-execute:active:not(:disabled) { transform: translateY(0); }
`;

export default function BacktesterPage() {
  const [config, setConfig] = useState<BacktestConfig>(defaultConfig);
  const [signalLimit, setSignalLimit] = useState(100);
  const [chartTheme, setChartTheme] = useState<string>(() => {
    if (typeof window !== "undefined") return getPreferredTheme();
    return "mt5";
  });

  // tRPC hooks
  const signalsInfo = trpc.backtester.getSignalsInfo.useQuery({ source: config.signalsSource });
  const signalSources = trpc.backtester.listSignalSources.useQuery();
  const cacheStatus = trpc.backtester.getCacheStatus.useQuery();
  const executeBacktest = trpc.backtester.execute.useMutation();
  const clearCache = trpc.backtester.clearCache.useMutation();

  // Optimizer
  const optimizationPresets = trpc.backtester.getOptimizationPresets.useQuery();
  const runOptimization = trpc.backtester.optimize.useMutation();
  const [optimizationResults, setOptimizationResults] = useState<any[]>([]);
  const [selectedPreset, setSelectedPreset] = useState(1);

  // Comparador
  const [savedResults, setSavedResults] = useState<Array<{ name: string; config: BacktestConfig; results: any }>>([]);
  const [compareIndexes, setCompareIndexes] = useState<number[]>([]);

  // Gráfico
  const [selectedTradeIndex, setSelectedTradeIndex] = useState<number | null>(null);

  // Cargar datos de localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("backtest-saved-results");
      if (saved) {
        try { setSavedResults(JSON.parse(saved)); } catch (e) {}
      }
    }
  }, []);

  const saveCurrentResult = () => {
    if (!executeBacktest.data?.results) return;
    const name = `${config.strategyName} - ${new Date().toLocaleDateString()}`;
    const newSaved = [...savedResults, { name, config: { ...config }, results: executeBacktest.data.results }];
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
      const processedConfig = {
        ...config,
        filters: config.filters ? {
          ...config.filters,
          dateFrom: config.filters.dateFrom ? new Date(config.filters.dateFrom) : undefined,
          dateTo: config.filters.dateTo ? new Date(config.filters.dateTo) : undefined,
        } : undefined,
      };
      await executeBacktest.mutateAsync({ config: processedConfig, signalLimit });
      setSelectedTradeIndex(null);
    } catch (error) {
      console.error("Error ejecutando backtest:", error);
    }
  };

  const updateConfig = <K extends keyof BacktestConfig>(key: K, value: BacktestConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const results = executeBacktest.data?.results;

  // Build config summary string
  const configSummary = `${config.pipsDistance}p × ${config.maxLevels}L × ${config.takeProfitPips}TP × ${config.trailingSLPercent}%Trail`;

  return (
    <div className="space-y-4 p-4 max-w-[1600px] mx-auto">
      {/* Inject styles */}
      <style>{styles}</style>

      {/* Header mejorado */}
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Backtester</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Grid con promedios y trailing SL
            </p>
          </div>
          <div className="hidden md:flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
            <span className="text-xs text-muted-foreground">Config:</span>
            <span className="text-xs font-mono font-medium text-foreground">{configSummary}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {signalsInfo.data && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg text-xs">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-medium">{signalsInfo.data.total}</span>
              <span className="text-muted-foreground">señales</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-green-500 font-medium">{signalsInfo.data.bySide.buy}B</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-red-500 font-medium">{signalsInfo.data.bySide.sell}S</span>
            </div>
          )}
          {cacheStatus.data && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
              cacheStatus.data.isLoaded ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-600"
            }`}>
              <span>{cacheStatus.data.isLoaded ? "✓" : "⏳"}</span>
              <span className="font-medium">{(cacheStatus.data.totalTicks / 1000000).toFixed(1)}M</span>
              <span className="opacity-70">ticks</span>
            </div>
          )}
        </div>
      </div>

      {/* Main grid: Config + Results */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Panel de configuración mejorado */}
        <Card className="lg:col-span-1 border-border/50 shadow-sm">
          <CardHeader className="pb-2 pt-3 bg-gradient-to-r from-card to-muted/20">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-1.5 h-4 bg-blue-500 rounded-full" />
              Configuración
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
            {/* Fila 1: Fuente + Estrategia */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Señales</Label>
                <select
                  className="w-full px-2.5 py-2 text-xs border rounded-lg bg-background/50 hover:bg-background transition-colors focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={config.signalsSource}
                  onChange={(e) => updateConfig("signalsSource", e.target.value)}
                >
                  {signalSources.data?.map((s) => (
                    <option key={s.file} value={s.file}>{s.file.replace('.csv', '')} ({s.total})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Estrategia</Label>
                <select
                  className="w-full px-2.5 py-2 text-xs border rounded-lg bg-background/50 hover:bg-background transition-colors focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={config.strategyName}
                  onChange={(e) => updateConfig("strategyName", e.target.value)}
                >
                  <option>Toni (G4)</option>
                  <option>Xisco (G2)</option>
                  <option>Personalizada</option>
                </select>
              </div>
            </div>

            {/* Fila 2: Capital + Lotes + Órdenes */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Capital €</Label>
                <Input
                  type="number"
                  className="h-9 text-xs font-mono bg-background/50 hover:bg-background transition-colors"
                  value={config.initialCapital}
                  onChange={(e) => updateConfig("initialCapital", parseFloat(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Lote</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="h-9 text-xs font-mono bg-background/50 hover:bg-background transition-colors"
                  value={config.lotajeBase}
                  onChange={(e) => updateConfig("lotajeBase", parseFloat(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Órdenes</Label>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  className="h-9 text-xs font-mono bg-background/50 hover:bg-background transition-colors"
                  value={config.numOrders}
                  onChange={(e) => updateConfig("numOrders", parseInt(e.target.value))}
                />
              </div>
            </div>

            {/* Fila 3: Grid params con iconos */}
            <div className="p-2.5 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-lg border border-blue-500/10">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Parámetros Grid</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-blue-600 dark:text-blue-400">📏 Pips</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    className="h-8 text-xs font-mono"
                    value={config.pipsDistance}
                    onChange={(e) => updateConfig("pipsDistance", parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-purple-600 dark:text-purple-400">📊 Niveles</Label>
                  <Input
                    type="number"
                    min="1"
                    max="40"
                    className="h-8 text-xs font-mono"
                    value={config.maxLevels}
                    onChange={(e) => updateConfig("maxLevels", parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-green-600 dark:text-green-400">🎯 TP</Label>
                  <Input
                    type="number"
                    min="5"
                    max="100"
                    className="h-8 text-xs font-mono"
                    value={config.takeProfitPips}
                    onChange={(e) => updateConfig("takeProfitPips", parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>

            {/* Fila 4: Trailing SL mejorado */}
            <div className={`flex items-center gap-3 p-2.5 rounded-lg transition-all ${
              config.useTrailingSL
                ? "bg-amber-500/10 border border-amber-500/20"
                : "bg-muted/30 border border-transparent"
            }`}>
              <input
                type="checkbox"
                id="useTrailingSL"
                checked={config.useTrailingSL}
                onChange={(e) => updateConfig("useTrailingSL", e.target.checked)}
                className="w-4 h-4 rounded accent-amber-500"
              />
              <Label htmlFor="useTrailingSL" className="text-xs cursor-pointer flex-1 font-medium">
                Trailing SL
              </Label>
              {config.useTrailingSL && (
                <>
                  <Input
                    type="number"
                    min="10"
                    max="90"
                    className="w-16 h-7 text-xs font-mono"
                    value={config.trailingSLPercent}
                    onChange={(e) => updateConfig("trailingSLPercent", parseInt(e.target.value))}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </>
              )}
            </div>

            {/* Fila 5: Filtros */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Sesión</Label>
                <select
                  className="w-full px-2 py-1.5 text-xs border rounded-lg bg-background/50 hover:bg-background transition-colors"
                  value={config.filters?.session || ""}
                  onChange={(e) => updateConfig("filters", { ...config.filters, session: e.target.value as any || undefined })}
                >
                  <option value="">Todas</option>
                  <option value="ASIAN">🌏 Asia</option>
                  <option value="EUROPEAN">🇪🇺 Europa</option>
                  <option value="US">🇺🇸 US</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Dirección</Label>
                <select
                  className="w-full px-2 py-1.5 text-xs border rounded-lg bg-background/50 hover:bg-background transition-colors"
                  value={config.filters?.side || ""}
                  onChange={(e) => updateConfig("filters", { ...config.filters, side: e.target.value as any || undefined })}
                >
                  <option value="">Ambas</option>
                  <option value="BUY">📈 BUY</option>
                  <option value="SELL">📉 SELL</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Límite</Label>
                <Input
                  type="number"
                  min="1"
                  className="h-8 text-xs font-mono bg-background/50 hover:bg-background transition-colors"
                  value={signalLimit}
                  onChange={(e) => setSignalLimit(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Toggle: Ticks reales */}
            <div className={`flex items-center gap-2 p-2.5 rounded-lg transition-all ${
              config.useRealPrices
                ? "bg-blue-500/10 border border-blue-500/20"
                : "bg-muted/30 border border-transparent"
            }`}>
              <input
                type="checkbox"
                id="useRealPrices"
                checked={config.useRealPrices}
                onChange={(e) => updateConfig("useRealPrices", e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500"
              />
              <Label htmlFor="useRealPrices" className="text-xs cursor-pointer">
                Usar ticks reales <span className="text-muted-foreground">(lento)</span>
              </Label>
            </div>

            {/* Botones mejorados */}
            <div className="flex gap-2 pt-1">
              <Button
                className={`flex-1 h-10 btn-execute font-medium ${
                  executeBacktest.isPending ? "animate-pulse" : ""
                }`}
                onClick={handleExecute}
                disabled={executeBacktest.isPending}
              >
                {executeBacktest.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Ejecutando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span>▶</span>
                    Ejecutar Backtest
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                className="h-10 px-3 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50"
                onClick={() => { clearCache.mutate(); executeBacktest.reset(); }}
                disabled={clearCache.isPending}
                title="Limpiar caché"
              >
                {clearCache.isPending ? "⏳" : "🗑️"}
              </Button>
            </div>

            {executeBacktest.isError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs animate-fade-in">
                <div className="font-medium mb-1">Error</div>
                {executeBacktest.error.message}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel de resultados mejorado */}
        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader className="pb-2 pt-3 bg-gradient-to-r from-card to-muted/20">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-1.5 h-4 bg-green-500 rounded-full" />
              Resultados
              {results && (
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  {results.totalTrades} trades procesados
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            {results ? (
              <div className="space-y-4 animate-fade-in">
                {/* Métricas principales con diseño mejorado */}
                <div className="grid grid-cols-6 gap-2">
                  <MetricBox
                    label="Profit"
                    value={`${results.totalProfit >= 0 ? "+" : ""}${results.totalProfit?.toFixed(2)}€`}
                    positive={results.totalProfit >= 0}
                    highlight
                    icon={results.totalProfit >= 0 ? "📈" : "📉"}
                  />
                  <MetricBox
                    label="Pips"
                    value={`${results.totalProfitPips >= 0 ? "+" : ""}${results.totalProfitPips?.toFixed(1)}`}
                    positive={results.totalProfitPips >= 0}
                  />
                  <MetricBox
                    label="WinRate"
                    value={`${results.winRate?.toFixed(0)}%`}
                    positive={results.winRate >= 50}
                    subtitle={results.totalTrades ? `${Math.round(results.totalTrades * results.winRate / 100)}W` : undefined}
                  />
                  <MetricBox
                    label="Trades"
                    value={results.totalTrades?.toString()}
                  />
                  <MetricBox
                    label="DD Max"
                    value={`${results.maxDrawdownPercent?.toFixed(1)}%`}
                    positive={results.maxDrawdownPercent < 20}
                    warning={results.maxDrawdownPercent >= 20}
                  />
                  <MetricBox
                    label="Sharpe"
                    value={results.sharpeRatio?.toFixed(2) || "-"}
                    positive={(results.sharpeRatio ?? 0) >= 1}
                  />
                </div>

                {/* Segmentación por sesión mejorada */}
                {results.segmentation && (
                  <div className="grid grid-cols-3 gap-2">
                    {results.segmentation.bySession?.map((s: any) => (
                      <div
                        key={s.segment}
                        className={`p-3 rounded-lg border transition-all hover:scale-[1.02] cursor-default ${
                          s.totalProfit >= 0
                            ? "bg-green-500/5 border-green-500/20"
                            : "bg-red-500/5 border-red-500/20"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{s.segment}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            s.winRate >= 50 ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"
                          }`}>
                            {s.winRate.toFixed(0)}% WR
                          </span>
                        </div>
                        <div className={`text-xl font-bold mt-1 ${
                          s.totalProfit >= 0 ? "text-green-500" : "text-red-500"
                        }`}>
                          {s.totalProfit >= 0 ? "+" : ""}{s.totalProfit.toFixed(0)}€
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {s.trades} trades • {s.avgProfit?.toFixed(1) || "0"}€/trade
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tabla de trades mejorada */}
                {results.tradeDetails && results.tradeDetails.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Trades Detalle
                      </h4>
                      <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                        Click para ver gráfico
                      </span>
                    </div>
                    <div className="max-h-52 overflow-y-auto border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gradient-to-r from-muted to-muted/80 z-10">
                          <tr>
                            <th className="text-left p-2 font-medium">#</th>
                            <th className="text-left p-2 font-medium">Fecha</th>
                            <th className="text-left p-2 font-medium">Side</th>
                            <th className="text-right p-2 font-medium">Entry</th>
                            <th className="text-right p-2 font-medium">Exit</th>
                            <th className="text-right p-2 font-medium">Pips</th>
                            <th className="text-right p-2 font-medium">Profit</th>
                            <th className="text-center p-2 font-medium">Close</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.tradeDetails.map((trade: any, i: number) => (
                            <tr
                              key={i}
                              onClick={() => setSelectedTradeIndex(i)}
                              className={`trade-row cursor-pointer border-b border-border/30 ${
                                selectedTradeIndex === i
                                  ? "trade-row-selected bg-blue-500/10"
                                  : trade.totalProfit >= 0
                                    ? "hover:bg-green-500/5"
                                    : "bg-red-500/5 hover:bg-red-500/10"
                              }`}
                            >
                              <td className="p-2 font-mono text-muted-foreground">{i + 1}</td>
                              <td className="p-2">{new Date(trade.signalTimestamp).toLocaleDateString()}</td>
                              <td className="p-2">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  trade.signalSide === "BUY"
                                    ? "bg-green-500/20 text-green-600"
                                    : "bg-red-500/20 text-red-600"
                                }`}>
                                  {trade.signalSide === "BUY" ? "↑" : "↓"} {trade.signalSide}
                                </span>
                              </td>
                              <td className="p-2 text-right font-mono">{trade.entryPrice?.toFixed(2)}</td>
                              <td className="p-2 text-right font-mono">{trade.exitPrice?.toFixed(2)}</td>
                              <td className={`p-2 text-right font-mono font-medium ${
                                trade.totalProfitPips >= 0 ? "text-green-600" : "text-red-600"
                              }`}>
                                {trade.totalProfitPips >= 0 ? "+" : ""}{trade.totalProfitPips?.toFixed(1)}
                              </td>
                              <td className={`p-2 text-right font-mono font-bold ${
                                trade.totalProfit >= 0 ? "text-green-600" : "text-red-600"
                              }`}>
                                {trade.totalProfit >= 0 ? "+" : ""}{trade.totalProfit?.toFixed(2)}€
                              </td>
                              <td className="p-2 text-center">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  trade.exitReason === "TAKE_PROFIT"
                                    ? "bg-green-500/20 text-green-700 dark:text-green-400"
                                    : trade.exitReason === "TRAILING_SL"
                                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                                      : "bg-red-500/20 text-red-700 dark:text-red-400"
                                }`}>
                                  {trade.exitReason === "TAKE_PROFIT" ? "🎯 TP" : trade.exitReason === "TRAILING_SL" ? "📍 Trail" : "⛔ SL"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Gráfico de velas del trade seleccionado */}
                {selectedTradeIndex !== null && results.tradeDetails[selectedTradeIndex] && (
                  <div className="border rounded-lg overflow-hidden animate-slide-up shadow-lg">
                    <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">📊</span>
                        <div>
                          <h4 className="text-sm font-semibold">
                            Trade #{selectedTradeIndex + 1}
                          </h4>
                          <span className={`text-xs font-medium ${
                            results.tradeDetails[selectedTradeIndex].signalSide === "BUY"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}>
                            {results.tradeDetails[selectedTradeIndex].signalSide === "BUY" ? "📈 LONG" : "📉 SHORT"}
                          </span>
                          <span className={`ml-2 text-xs font-bold ${
                            results.tradeDetails[selectedTradeIndex].totalProfit >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}>
                            {results.tradeDetails[selectedTradeIndex].totalProfit >= 0 ? "+" : ""}
                            {results.tradeDetails[selectedTradeIndex].totalProfit?.toFixed(2)}€
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">Tema:</Label>
                          <select
                            value={chartTheme}
                            onChange={(e) => { setChartTheme(e.target.value); savePreferredTheme(e.target.value); }}
                            className="px-2 py-1 text-xs border rounded-lg bg-background hover:bg-muted transition-colors"
                          >
                            {CHART_THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                        <button
                          onClick={() => setSelectedTradeIndex(null)}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                          title="Cerrar gráfico"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <TradeChartWrapper
                      trade={results.tradeDetails[selectedTradeIndex]}
                      config={{ takeProfitPips: config.takeProfitPips, pipsDistance: config.pipsDistance, maxLevels: config.maxLevels }}
                      themeId={chartTheme}
                    />
                  </div>
                )}

                {/* Botón guardar resultado */}
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={saveCurrentResult}
                    className="gap-2 hover:bg-blue-500/10 hover:text-blue-600 hover:border-blue-500/50"
                  >
                    💾 Guardar para comparar
                  </Button>
                  {results.totalTrades > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Rentabilidad: <span className={`font-bold ${
                        results.totalProfit >= 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {((results.totalProfit / (config.initialCapital || 10000)) * 100).toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 animate-fade-in">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 mb-4">
                  <span className="text-3xl">📊</span>
                </div>
                <h3 className="text-lg font-medium mb-1">Sin resultados</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Configura los parámetros y ejecuta un backtest para ver los resultados aquí
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Optimizador mejorado */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2 pt-3 bg-gradient-to-r from-card to-muted/20">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="w-1.5 h-4 bg-purple-500 rounded-full" />
            Optimizador
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {optimizationPresets.data?.map((preset: any) => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPreset(preset.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                    selectedPreset === preset.id
                      ? "bg-purple-500 text-white shadow-md shadow-purple-500/20"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              onClick={async () => {
                const preset = optimizationPresets.data?.[selectedPreset];
                if (!preset) return;
                setOptimizationResults([]);
                const result = await runOptimization.mutateAsync({
                  params: preset.params,
                  options: { signalsSource: config.signalsSource, signalLimit, metric: "totalProfit" },
                });
                if (result.topResults) setOptimizationResults(result.topResults);
              }}
              disabled={runOptimization.isPending}
              className="bg-purple-500 hover:bg-purple-600"
            >
              {runOptimization.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Optimizando...
                </span>
              ) : (
                "▶ Optimizar"
              )}
            </Button>
          </div>

          {optimizationResults.length > 0 && (
            <div className="mt-3 overflow-x-auto animate-slide-up">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-2 font-medium text-muted-foreground">#</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Config</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Profit</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">WR%</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Sharpe</th>
                    <th className="text-center p-2 font-medium text-muted-foreground">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {optimizationResults.slice(0, 5).map((opt: any, i: number) => (
                    <tr
                      key={i}
                      className={`border-b border-border/30 transition-colors ${
                        i === 0
                          ? "bg-gradient-to-r from-green-500/10 to-transparent"
                          : "hover:bg-muted/30"
                      }`}
                    >
                      <td className="p-2">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                          i === 0 ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                        }`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="p-2">
                        <span className="font-mono px-2 py-0.5 bg-muted/50 rounded text-[10px]">
                          {opt.config.pipsDistance}p/{opt.config.maxLevels}L/{opt.config.takeProfitPips}TP
                        </span>
                      </td>
                      <td className={`p-2 text-right font-mono font-bold ${
                        opt.result.totalProfit >= 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {opt.result.totalProfit >= 0 ? "+" : ""}{opt.result.totalProfit?.toFixed(0)}€
                      </td>
                      <td className="p-2 text-right">
                        <span className={`font-medium ${opt.result.winRate >= 50 ? "text-green-600" : "text-red-600"}`}>
                          {opt.result.winRate?.toFixed(0)}%
                        </span>
                      </td>
                      <td className="p-2 text-right font-mono">{opt.result.sharpeRatio?.toFixed(2)}</td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => setConfig({ ...config, ...opt.config, strategyName: `Opt_${i + 1}` })}
                          className="px-3 py-1 text-xs bg-purple-500/10 text-purple-600 rounded-lg hover:bg-purple-500/20 transition-colors font-medium"
                        >
                          Usar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparador mejorado */}
      {savedResults.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2 pt-3 bg-gradient-to-r from-card to-muted/20">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-1.5 h-4 bg-amber-500 rounded-full" />
              Comparador
              <span className="text-xs font-normal text-muted-foreground">
                {savedResults.length} guardados
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="grid grid-cols-3 gap-2">
              {savedResults.map((saved, index) => (
                <div
                  key={index}
                  onClick={() => toggleCompare(index)}
                  className={`p-3 rounded-lg cursor-pointer transition-all border-2 ${
                    compareIndexes.includes(index)
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-transparent bg-muted/30 hover:bg-muted/50 hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-medium truncate flex-1">{saved.name}</div>
                    {compareIndexes.includes(index) && (
                      <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center ml-2">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className={`text-2xl font-bold ${saved.results.totalProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {saved.results.totalProfit >= 0 ? "+" : ""}{saved.results.totalProfit?.toFixed(0)}€
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                    <span>{saved.results.winRate?.toFixed(0)}% WR</span>
                    <span>{saved.results.totalTrades} trades</span>
                  </div>
                </div>
              ))}
            </div>

            {compareIndexes.length >= 2 && (
              <div className="mt-3 p-3 bg-muted/20 rounded-lg border animate-fade-in">
                <div className="text-xs font-medium mb-2 text-muted-foreground">Comparación</div>
                <div className="grid gap-2">
                  {["totalProfit", "winRate", "profitFactor", "sharpeRatio"].map(metric => (
                    <div key={metric} className="grid grid-cols-4 gap-2 text-xs">
                      <div className="font-medium text-muted-foreground capitalize">{metric.replace(/([A-Z])/g, ' $1')}</div>
                      {compareIndexes.map(i => (
                        <div key={i} className="text-center font-mono">
                          {savedResults[i]?.results?.[metric]?.toFixed(2) || "-"}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Equity curve mejorada */}
      {results?.equityCurve && results.equityCurve.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2 pt-3 bg-gradient-to-r from-card to-muted/20">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-1.5 h-4 bg-blue-500 rounded-full" />
              Curva de Equity
              <span className="text-xs font-normal text-muted-foreground ml-auto">
                Hover para ver detalles
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <EquityChart data={results.equityCurve} initialCapital={results.initialCapital} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Componentes auxiliares mejorados
function MetricBox({
  label,
  value,
  positive,
  warning,
  highlight,
  icon,
  subtitle
}: {
  label: string;
  value: string;
  positive?: boolean;
  warning?: boolean;
  highlight?: boolean;
  icon?: string;
  subtitle?: string;
}) {
  return (
    <div className={`p-3 rounded-lg text-center transition-all hover:scale-[1.02] ${
      highlight
        ? positive
          ? "bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30"
          : "bg-gradient-to-br from-red-500/20 to-red-500/5 border border-red-500/30"
        : warning
          ? "bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20"
          : "bg-muted/30 hover:bg-muted/50"
    }`}>
      <div className="flex items-center justify-center gap-1 mb-1">
        {icon && <span className="text-xs">{icon}</span>}
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-sm font-bold metric-value ${
        positive === true ? "text-green-500" : positive === false ? "text-red-500" : ""
      }`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-[9px] text-muted-foreground mt-0.5">{subtitle}</div>
      )}
    </div>
  );
}

function EquityChart({ data, initialCapital }: { data: any[]; initialCapital: number }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (data.length === 0) return null;

  const width = 800, height = 150, padding = 40;
  const minEquity = Math.min(...data.map(d => d.equity), initialCapital);
  const maxEquity = Math.max(...data.map(d => d.equity), initialCapital);
  const range = maxEquity - minEquity || 1;
  const xScale = (i: number) => padding + (i / (data.length - 1)) * (width - 2 * padding);
  const yScale = (v: number) => height - padding - ((v - minEquity) / range) * (height - 2 * padding);
  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.equity)}`).join(' ');

  const finalEquity = data[data.length - 1]?.equity || initialCapital;
  const isPositive = finalEquity >= initialCapital;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const chartWidth = width - 2 * padding;
    const index = Math.round(((x - padding) / chartWidth) * (data.length - 1));
    setHoverIndex(Math.max(0, Math.min(data.length - 1, index)));
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {/* Background gradient */}
        <defs>
          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor={isPositive ? "#22c55e" : "#ef4444"} />
          </linearGradient>
        </defs>

        {/* Initial capital line */}
        <line
          x1={padding}
          y1={yScale(initialCapital)}
          x2={width - padding}
          y2={yScale(initialCapital)}
          stroke="#94a3b8"
          strokeDasharray="4,4"
          strokeWidth="1"
        />

        {/* Area under curve */}
        <path
          d={`${pathD} L ${xScale(data.length - 1)} ${height - padding} L ${padding} ${height - padding} Z`}
          fill="url(#eqGrad)"
        />

        {/* Main line */}
        <path d={pathD} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinecap="round" />

        {/* Hover point */}
        {hoverIndex !== null && (
          <>
            <line
              x1={xScale(hoverIndex)}
              y1={padding}
              x2={xScale(hoverIndex)}
              y2={height - padding}
              stroke="#fff"
              strokeOpacity="0.3"
              strokeDasharray="2,2"
            />
            <circle
              cx={xScale(hoverIndex)}
              cy={yScale(data[hoverIndex].equity)}
              r="5"
              fill={data[hoverIndex].equity >= initialCapital ? "#22c55e" : "#ef4444"}
              stroke="#fff"
              strokeWidth="2"
            />
          </>
        )}

        {/* Labels */}
        <text x={padding - 5} y={12} className="text-[10px] fill-muted-foreground" textAnchor="end">
          {maxEquity.toFixed(0)}€
        </text>
        <text x={padding - 5} y={height - 5} className="text-[10px] fill-muted-foreground" textAnchor="end">
          {minEquity.toFixed(0)}€
        </text>
        <text x={width - padding + 5} y={yScale(initialCapital) + 4} className="text-[9px] fill-muted-foreground">
          Inicial
        </text>
      </svg>

      {/* Tooltip */}
      {hoverIndex !== null && (
        <div
          className="absolute top-2 right-2 bg-popover border rounded-lg px-3 py-2 text-xs shadow-lg animate-fade-in"
          style={{ zIndex: 10 }}
        >
          <div className="text-muted-foreground">
            {new Date(data[hoverIndex].timestamp).toLocaleDateString()}
          </div>
          <div className={`font-bold text-lg ${data[hoverIndex].equity >= initialCapital ? "text-green-500" : "text-red-500"}`}>
            €{data[hoverIndex].equity.toFixed(2)}
          </div>
          <div className={`text-[10px] ${
            data[hoverIndex].equity >= initialCapital ? "text-green-500/70" : "text-red-500/70"
          }`}>
            {data[hoverIndex].equity >= initialCapital ? "+" : ""}
            {(((data[hoverIndex].equity - initialCapital) / initialCapital) * 100).toFixed(2)}%
          </div>
        </div>
      )}
    </div>
  );
}

function isValidTradeForChart(trade: any): boolean {
  if (!trade) return false;
  if (trade.entryPrice == null || isNaN(trade.entryPrice)) return false;
  if (trade.exitPrice == null || isNaN(trade.exitPrice)) return false;
  if (!trade.entryTime || !trade.exitTime || !trade.signalSide) return false;
  const entryDate = new Date(trade.entryTime);
  const exitDate = new Date(trade.exitTime);
  return !isNaN(entryDate.getTime()) && !isNaN(exitDate.getTime());
}

function TradeChartWrapper({ trade, config, themeId = "mt5" }: { trade: any; config: any; themeId?: string }) {
  if (!isValidTradeForChart(trade)) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <span className="text-3xl mb-2">⚠️</span>
        <span className="text-sm">Datos del trade incompletos</span>
      </div>
    );
  }

  const tradeTicks = trpc.backtester.getTradeTicks.useQuery(
    { entryTime: new Date(trade.entryTime), exitTime: new Date(trade.exitTime) },
    { enabled: true, retry: 1 }
  );

  if (tradeTicks.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="relative">
          <div className="w-10 h-10 border-4 border-muted border-t-blue-500 rounded-full animate-spin" />
        </div>
        <span className="text-sm text-muted-foreground mt-3 animate-pulse">Cargando gráfico...</span>
      </div>
    );
  }

  if (tradeTicks.isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-red-500">
        <span className="text-3xl mb-2">❌</span>
        <span className="text-sm">Error: {tradeTicks.error?.message}</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <SimpleCandleChart
        ticks={tradeTicks.data?.ticks || []}
        trade={trade}
        config={config}
        hasRealTicks={tradeTicks.data?.hasRealTicks ?? false}
        themeId={themeId}
      />
    </div>
  );
}
