"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import SimpleCandleChart from "@/components/simple-candle-chart";
import { CHART_THEMES, getPreferredTheme, savePreferredTheme } from "@/lib/chart-themes";
import {
  Play,
  Trash2,
  Save,
  Scale,
  Moon,
  Sun,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Settings,
  Zap,
  Target,
  Shield,
  Activity,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Database,
  Signal,
  RefreshCw,
  Store,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

// Dark mode toggle helper
function toggleDarkMode() {
  const html = document.documentElement;
  if (html.classList.contains("dark")) {
    html.classList.remove("dark");
    localStorage.setItem("theme", "light");
  } else {
    html.classList.add("dark");
    localStorage.setItem("theme", "dark");
  }
}

function useDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const theme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = theme === "dark" || (!theme && prefersDark);

    if (shouldBeDark) {
      document.documentElement.classList.add("dark");
    }
    setIsDark(shouldBeDark);
  }, []);

  const toggle = () => {
    toggleDarkMode();
    setIsDark(!isDark);
  };

  return { isDark, toggle };
}

export default function BacktesterPage() {
  const [config, setConfig] = useState<BacktestConfig>(defaultConfig);
  const [signalLimit, setSignalLimit] = useState(100);
  const [chartTheme, setChartTheme] = useState<string>(() => {
    if (typeof window !== "undefined") return getPreferredTheme();
    return "mt5";
  });
  const { isDark, toggle: toggleDark } = useDarkMode();

  // tRPC hooks
  const signalsInfo = trpc.backtester.getSignalsInfo.useQuery({ source: config.signalsSource });
  const signalSources = trpc.backtester.listSignalSources.useQuery();
  const cacheStatus = trpc.backtester.getCacheStatus.useQuery();
  const executeBacktest = trpc.backtester.execute.useMutation();
  const clearCache = trpc.backtester.clearCache.useMutation();
  const saveAsStrategy = trpc.backtester.saveAsStrategy.useMutation();

  // Estado para guardar estrategia
  const [strategyName, setStrategyName] = useState("");
  const [strategyDescription, setStrategyDescription] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Estado para publicar al marketplace
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishName, setPublishName] = useState("");
  const [publishDescription, setPublishDescription] = useState("");
  const [publishTags, setPublishTags] = useState("");
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [savedStrategyId, setSavedStrategyId] = useState<string | null>(null);

  // Marketplace mutation
  const publishMutation = trpc.marketplace.publish.useMutation();

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
      setSaveSuccess(false);
    } catch (error) {
      console.error("Error ejecutando backtest:", error);
    }
  };

  const handleSaveStrategy = async () => {
    if (!results || !strategyName.trim()) return;

    try {
      const result = await saveAsStrategy.mutateAsync({
        name: strategyName,
        description: strategyDescription || undefined,
        config: {
          strategyName: config.strategyName,
          lotajeBase: config.lotajeBase,
          numOrders: config.numOrders,
          pipsDistance: config.pipsDistance,
          maxLevels: config.maxLevels,
          takeProfitPips: config.takeProfitPips,
          stopLossPips: config.stopLossPips,
          useStopLoss: config.useStopLoss,
          useTrailingSL: config.useTrailingSL,
          trailingSLPercent: config.trailingSLPercent,
          restrictionType: config.restrictionType,
          signalsSource: config.signalsSource,
          initialCapital: config.initialCapital,
          useRealPrices: config.useRealPrices,
          filters: config.filters ? {
            ...config.filters,
            dateFrom: config.filters.dateFrom ? new Date(config.filters.dateFrom) : undefined,
            dateTo: config.filters.dateTo ? new Date(config.filters.dateTo) : undefined,
          } : undefined,
        },
        results: {
          totalTrades: results.totalTrades || 0,
          totalProfit: results.totalProfit || 0,
          winRate: results.winRate || 0,
          maxDrawdown: results.maxDrawdownPercent || 0,
        },
      });
      setSavedStrategyId(result.id);
      setSaveSuccess(true);
      setStrategyName("");
      setStrategyDescription("");
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error guardando estrategia:", error);
    }
  };

  const handlePublish = async () => {
    if (!savedStrategyId || !publishName.trim()) return;

    try {
      const tags = publishTags.split(",").map(t => t.trim()).filter(Boolean);
      await publishMutation.mutateAsync({
        strategyId: savedStrategyId,
        name: publishName,
        description: publishDescription || undefined,
        tags: tags.length > 0 ? tags : undefined,
        isPublic: true,
      });
      setPublishSuccess(true);
      setPublishDialogOpen(false);
      setPublishName("");
      setPublishDescription("");
      setPublishTags("");
      setTimeout(() => setPublishSuccess(false), 3000);
    } catch (error) {
      console.error("Error publicando estrategia:", error);
    }
  };

  const updateConfig = <K extends keyof BacktestConfig>(key: K, value: BacktestConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const results = executeBacktest.data?.results;

  // Build config summary string
  const configSummary = `${config.pipsDistance}p × ${config.maxLevels}L × ${config.takeProfitPips}TP × ${config.trailingSLPercent}%Trail`;

  return (
    <>
    <div className="space-y-4 max-w-[1600px] mx-auto font-sans pb-8">
      {/* Header mejorado */}
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Backtester</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Grid con promedios y trailing SL
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg border border-primary/20">
            <Settings className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground ml-1">Config:</span>
            <span className="text-xs font-mono font-medium text-foreground">{configSummary}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {signalsInfo.data && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg text-xs">
              <Signal className="w-3.5 h-3.5 text-green-500" />
              <span className="font-medium">{signalsInfo.data.total}</span>
              <span className="text-muted-foreground">señales</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-success font-medium">{signalsInfo.data.bySide.buy}B</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-destructive font-medium">{signalsInfo.data.bySide.sell}S</span>
            </div>
          )}
          {cacheStatus.data && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
              cacheStatus.data.isLoaded ? "bg-success/10 text-success" : "bg-amber-500/10 text-amber-600"
            }`}>
              <Database className="w-3.5 h-3.5" />
              <span className="font-medium">{(cacheStatus.data.totalTicks / 1000000).toFixed(1)}M</span>
              <span className="opacity-70">ticks</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDark}
            className="ml-2 min-h-[44px] min-w-[44px]"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
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
          <CardContent className="space-y-4 pt-3">
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

            {/* Grid Spacing Slider */}
            <div className="space-y-2 p-3 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scale className="w-3.5 h-3.5 text-primary" />
                  <Label className="text-xs font-medium text-primary">Grid Spacing (pips)</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="p-1.5 -m-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center">
                          <HelpCircle className="w-4 h-4 text-primary/50 cursor-help" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs"><strong>Distancia entre niveles</strong></p>
                        <p className="text-xs text-muted-foreground mt-1">Separación en pips entre cada orden del grid. Un valor menor = más operaciones pero mayor riesgo.</p>
                        <p className="text-xs text-muted-foreground mt-1">💡 Recomendado: 10-15 pips para XAUUSD</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="text-sm font-mono font-bold text-primary">{config.pipsDistance}</span>
              </div>
              <Slider
                min={5}
                max={50}
                step={1}
                value={[config.pipsDistance]}
                onValueChange={(value) => updateConfig("pipsDistance", value[0])}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>5</span>
                <span>50</span>
              </div>
            </div>

            {/* Max Levels Slider */}
            <div className="space-y-2 p-3 bg-gradient-to-r from-purple-500/5 to-purple-500/10 rounded-lg border border-purple-500/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-purple-500" />
                  <Label className="text-xs font-medium text-purple-600 dark:text-purple-400">Max Levels</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="p-1.5 -m-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center">
                          <HelpCircle className="w-4 h-4 text-purple-500/50 cursor-help" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs"><strong>Niveles máximos del grid</strong></p>
                        <p className="text-xs text-muted-foreground mt-1">Cantidad máxima de órdenes que se abrirán en contra del precio.</p>
                        <p className="text-xs text-muted-foreground mt-1">💡 Más niveles = más promedios pero mayor exposición</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="text-sm font-mono font-bold text-purple-600">{config.maxLevels}</span>
              </div>
              <Slider
                min={1}
                max={30}
                step={1}
                value={[config.maxLevels]}
                onValueChange={(value) => updateConfig("maxLevels", value[0])}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>1</span>
                <span>30</span>
              </div>
            </div>

            {/* Take Profit Slider */}
            <div className="space-y-2 p-3 bg-gradient-to-r from-success/5 to-success/10 rounded-lg border border-success/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-success" />
                  <Label className="text-xs font-medium text-success">Take Profit (pips)</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="p-1.5 -m-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center">
                          <HelpCircle className="w-4 h-4 text-success/50 cursor-help" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs"><strong>Objetivo de ganancia</strong></p>
                        <p className="text-xs text-muted-foreground mt-1">Distancia en pips donde se cierra la operación con ganancias.</p>
                        <p className="text-xs text-muted-foreground mt-1">💡 Recomendado: 15-25 pips para XAUUSD</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="text-sm font-mono font-bold text-success">{config.takeProfitPips}</span>
              </div>
              <Slider
                min={5}
                max={50}
                step={1}
                value={[config.takeProfitPips]}
                onValueChange={(value) => updateConfig("takeProfitPips", value[0])}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>5</span>
                <span>50</span>
              </div>
            </div>

            {/* Stop Loss Section */}
            <div className="space-y-2 p-3 rounded-lg border border-border/50 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.useStopLoss}
                    onCheckedChange={(checked) => updateConfig("useStopLoss", checked)}
                  />
                  <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                  <Label className="text-xs font-medium cursor-pointer">Use Stop Loss</Label>
                </div>
              </div>

              {config.useStopLoss && (
                <div className="space-y-2 mt-2 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-destructive">Stop Loss (pips)</Label>
                    <span className="text-sm font-mono font-bold text-destructive">{config.stopLossPips || 100}</span>
                  </div>
                  <Slider
                    min={0}
                    max={200}
                    step={5}
                    value={[config.stopLossPips || 100]}
                    onValueChange={(value) => updateConfig("stopLossPips", value[0])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0</span>
                    <span>200</span>
                  </div>
                </div>
              )}
            </div>

            {/* Lot Size Input */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Lot Size</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="1.0"
                  className="h-10 text-sm font-mono min-h-[44px]"
                  value={config.lotajeBase}
                  onChange={(e) => updateConfig("lotajeBase", parseFloat(e.target.value) || 0.1)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Capital €</Label>
                <Input
                  type="number"
                  className="h-10 text-sm font-mono min-h-[44px]"
                  value={config.initialCapital}
                  onChange={(e) => updateConfig("initialCapital", parseFloat(e.target.value) || 10000)}
                />
              </div>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Sesión</Label>
                <select
                  className="w-full px-2.5 py-2.5 text-xs border rounded-lg bg-background/50 hover:bg-background transition-colors min-h-[44px]"
                  value={config.filters?.session || ""}
                  onChange={(e) => updateConfig("filters", { ...config.filters, session: e.target.value as any || undefined })}
                >
                  <option value="">Todas</option>
                  <option value="ASIAN">Asia</option>
                  <option value="EUROPEAN">Europa</option>
                  <option value="US">US</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Dirección</Label>
                <select
                  className="w-full px-2.5 py-2.5 text-xs border rounded-lg bg-background/50 hover:bg-background transition-colors min-h-[44px]"
                  value={config.filters?.side || ""}
                  onChange={(e) => updateConfig("filters", { ...config.filters, side: e.target.value as any || undefined })}
                >
                  <option value="">Ambas</option>
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Límite</Label>
                <Input
                  type="number"
                  min="1"
                  className="h-11 text-xs font-mono bg-background/50 hover:bg-background transition-colors min-h-[44px]"
                  value={signalLimit}
                  onChange={(e) => setSignalLimit(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Toggle: Trailing SL */}
            <div className={`flex items-center gap-2 p-2.5 rounded-lg transition-all ${
              config.useTrailingSL
                ? "bg-amber-500/10 border border-amber-500/20"
                : "bg-muted/30 border border-transparent"
            }`}>
              <Switch
                checked={config.useTrailingSL}
                onCheckedChange={(checked) => updateConfig("useTrailingSL", checked)}
              />
              <Label className="text-xs cursor-pointer flex-1 font-medium">
                Trailing SL
              </Label>
              {config.useTrailingSL && (
                <>
                  <Input
                    type="number"
                    min="10"
                    max="90"
                    className="w-14 min-w-[56px] h-9 text-xs font-mono"
                    value={config.trailingSLPercent}
                    onChange={(e) => updateConfig("trailingSLPercent", parseInt(e.target.value) || 50)}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </>
              )}
            </div>

            {/* Toggle: Ticks reales */}
            <div className={`flex items-center gap-2 p-2.5 rounded-lg transition-all ${
              config.useRealPrices
                ? "bg-blue-500/10 border border-blue-500/20"
                : "bg-muted/30 border border-transparent"
            }`}>
              <Switch
                checked={config.useRealPrices}
                onCheckedChange={(checked) => updateConfig("useRealPrices", checked)}
              />
              <Label className="text-xs cursor-pointer">
                Usar ticks reales <span className="text-muted-foreground">(lento)</span>
              </Label>
            </div>

            {/* Botón Ejecutar Backtest - GRANDE */}
            <Button
              className={`w-full h-14 text-base font-semibold transition-all duration-200 ${
                executeBacktest.isPending ? "animate-pulse" : "hover:translate-y-[-1px] hover:shadow-lg hover:shadow-primary/40"
              }`}
              onClick={handleExecute}
              disabled={executeBacktest.isPending}
              size="lg"
            >
              {executeBacktest.isPending ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Procesando {signalLimit} señales...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Ejecutar Backtest
                </span>
              )}
            </Button>

            {/* Resumen de configuracion activa */}
            <div className="flex items-center justify-center gap-2 pt-1 text-xs text-muted-foreground flex-wrap">
              <span>Grid: {config.pipsDistance}p x {config.maxLevels}L</span>
              <span>•</span>
              <span>TP: {config.takeProfitPips}p</span>
              {config.useStopLoss && (
                <>
                  <span>•</span>
                  <span className="text-red-500">SL: {config.stopLossPips}p</span>
                </>
              )}
              {config.useTrailingSL && (
                <>
                  <span>•</span>
                  <span>Trail: {config.trailingSLPercent}%</span>
                </>
              )}
              <span>•</span>
              <span>Lote: {config.lotajeBase}</span>
            </div>

            {/* Botón limpiar cache */}
            <Button
              variant="outline"
              className="w-full h-9 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
              onClick={() => { clearCache.mutate(); executeBacktest.reset(); setSaveSuccess(false); }}
              disabled={clearCache.isPending}
            >
              {clearCache.isPending ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Limpiando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpiar caché
                </span>
              )}
            </Button>

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
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-1.5 h-4 bg-green-500 rounded-full" />
                Resultados
                {results && (
                  <span className="text-xs font-normal text-muted-foreground ml-2">
                    {results.totalTrades} trades procesados
                  </span>
                )}
              </CardTitle>
              {executeBacktest.data?.elapsedMs && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {executeBacktest.data.fromCache && (
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded-full">Desde cache</span>
                  )}
                  <span className="font-mono">
                    Tiempo: {(executeBacktest.data.elapsedMs / 1000).toFixed(2)}s
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            {results ? (
              <div className="space-y-4 animate-fade-in">
                {/* Métricas principales con diseño mejorado - 2 filas */}
                <div className="grid grid-cols-4 gap-2">
                  <MetricBox
                    label="Profit Total"
                    value={`${results.totalProfit >= 0 ? "+" : ""}${results.totalProfit?.toFixed(2)}€`}
                    positive={results.totalProfit >= 0}
                    highlight
                    icon={results.totalProfit >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    subtitle={results.profitPercent ? `${results.profitPercent >= 0 ? "+" : ""}${results.profitPercent.toFixed(1)}%` : undefined}
                  />
                  <MetricBox
                    label="Win Rate"
                    value={`${results.winRate?.toFixed(0)}%`}
                    positive={results.winRate >= 50}
                    icon={<Target className="w-3.5 h-3.5" />}
                    subtitle={results.totalTrades ? `${Math.round(results.totalTrades * results.winRate / 100)}W / ${results.totalTrades - Math.round(results.totalTrades * results.winRate / 100)}L` : undefined}
                  />
                  <MetricBox
                    label="Profit Factor"
                    value={results.profitFactor === Infinity ? "∞" : (results.profitFactor?.toFixed(2) || "-")}
                    positive={(results.profitFactor ?? 0) >= 1.5}
                    warning={(results.profitFactor ?? 0) >= 1 && (results.profitFactor ?? 0) < 1.5}
                    icon={<Scale className="w-3.5 h-3.5" />}
                  />
                  <MetricBox
                    label="Max Drawdown"
                    value={`${results.maxDrawdownPercent?.toFixed(1)}%`}
                    positive={results.maxDrawdownPercent < 15}
                    warning={results.maxDrawdownPercent >= 15 && results.maxDrawdownPercent < 25}
                    icon={<Shield className="w-3.5 h-3.5" />}
                    subtitle={results.maxDrawdown ? `€${results.maxDrawdown.toFixed(0)}` : undefined}
                  />
                </div>

                {/* Segunda fila de métricas */}
                <div className="grid grid-cols-5 gap-2">
                  <MetricBox
                    label="Total Pips"
                    value={`${results.totalProfitPips >= 0 ? "+" : ""}${results.totalProfitPips?.toFixed(1)}`}
                    positive={results.totalProfitPips >= 0}
                  />
                  <MetricBox
                    label="Trades"
                    value={results.totalTrades?.toString()}
                    subtitle={results.avgWin ? `Avg: €${results.avgWin.toFixed(0)}` : undefined}
                  />
                  <MetricBox
                    label="Sharpe"
                    value={results.sharpeRatio?.toFixed(2) || "-"}
                    positive={(results.sharpeRatio ?? 0) >= 1}
                  />
                  <MetricBox
                    label="Expectancy"
                    value={`€${results.expectancy?.toFixed(2) || "0.00"}`}
                    positive={(results.expectancy ?? 0) >= 0}
                  />
                  <MetricBox
                    label="Calmar"
                    value={results.calmarRatio?.toFixed(2) || "-"}
                    positive={(results.calmarRatio ?? 0) >= 3}
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
                        Historial de Trades
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                          Click para ver gráfico
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {results.tradeDetails.filter((t: any) => t.totalProfit >= 0).length}W / {results.tradeDetails.filter((t: any) => t.totalProfit < 0).length}L
                        </span>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gradient-to-r from-muted to-muted/80 z-10">
                          <tr>
                            <th className="text-left p-2 font-medium">#</th>
                            <th className="text-left p-2 font-medium">Fecha</th>
                            <th className="text-left p-2 font-medium">Side</th>
                            <th className="text-right p-2 font-medium">Entry</th>
                            <th className="text-right p-2 font-medium">Exit</th>
                            <th className="text-center p-2 font-medium">Lvls</th>
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
                              <td className="p-2">
                                <div className="flex flex-col">
                                  <span className="font-mono">{new Date(trade.signalTimestamp).toLocaleDateString()}</span>
                                  <span className="text-[10px] text-muted-foreground">{new Date(trade.signalTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              </td>
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
                              <td className="p-2 text-center">
                                <span className={`inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-mono ${
                                  trade.maxLevels > 1
                                    ? "bg-amber-500/20 text-amber-600"
                                    : "bg-muted text-muted-foreground"
                                }`}>
                                  {trade.maxLevels || 1}
                                </span>
                              </td>
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
                                  {trade.exitReason === "TAKE_PROFIT" ? "TP" : trade.exitReason === "TRAILING_SL" ? "Trail" : "SL"}
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
                    <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-primary/10 to-accent/10 border-b">
                      <div className="flex items-center gap-3">
                        <BarChart3 className="w-5 h-5 text-primary" />
                        <div>
                          <h4 className="text-sm font-semibold">
                            Trade #{selectedTradeIndex + 1}
                          </h4>
                          <span className={`text-xs font-medium flex items-center gap-1 ${
                            results.tradeDetails[selectedTradeIndex].signalSide === "BUY"
                              ? "text-success"
                              : "text-destructive"
                          }`}>
                            {results.tradeDetails[selectedTradeIndex].signalSide === "BUY"
                              ? <><ChevronUp className="w-3.5 h-3.5" /> LONG</>
                              : <><ChevronDown className="w-3.5 h-3.5" /> SHORT</>
                            }
                          </span>
                          <span className={`ml-2 text-xs font-bold font-mono ${
                            results.tradeDetails[selectedTradeIndex].totalProfit >= 0
                              ? "text-success"
                              : "text-destructive"
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

                {/* Estadisticas adicionales de trades */}
                {results.tradeDetails && results.tradeDetails.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 p-2 bg-muted/20 rounded-lg border border-border/30">
                    <div className="text-center">
                      <div className="text-[10px] text-muted-foreground uppercase">Mejor Trade</div>
                      <div className="text-sm font-bold text-green-500 font-mono">
                        +{Math.max(...results.tradeDetails.map((t: any) => t.totalProfit || 0)).toFixed(2)}€
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-muted-foreground uppercase">Peor Trade</div>
                      <div className="text-sm font-bold text-red-500 font-mono">
                        {Math.min(...results.tradeDetails.map((t: any) => t.totalProfit || 0)).toFixed(2)}€
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-muted-foreground uppercase">Racha Max W</div>
                      <div className="text-sm font-bold text-green-500 font-mono">
                        {results.maxConsecutiveWins || 0}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-muted-foreground uppercase">Racha Max L</div>
                      <div className="text-sm font-bold text-red-500 font-mono">
                        {results.maxConsecutiveLosses || 0}
                      </div>
                    </div>
                  </div>
                )}

                {/* Guardar estrategia */}
                <div className="p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg border border-border/50 space-y-3">
                  <div className="flex items-center gap-2">
                    <Save className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-semibold">Guardar como Estrategia</h4>
                  </div>
                  <div className="grid gap-2">
                    <Input
                      placeholder="Nombre de la estrategia"
                      value={strategyName}
                      onChange={(e) => setStrategyName(e.target.value)}
                      className="h-9"
                    />
                    <Input
                      placeholder="Descripcion (opcional)"
                      value={strategyDescription}
                      onChange={(e) => setStrategyDescription(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleSaveStrategy}
                      disabled={!strategyName.trim() || saveAsStrategy.isPending}
                      className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                    >
                      {saveAsStrategy.isPending ? (
                        <span className="flex items-center gap-2">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Guardando...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Save className="w-3.5 h-3.5" />
                          Guardar Estrategia
                        </span>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={saveCurrentResult}
                      className="hover:bg-primary/10 hover:text-primary hover:border-primary/50"
                    >
                      <Scale className="w-3.5 h-3.5 mr-1" />
                      Comparar
                    </Button>
                  </div>
                  {saveSuccess && (
                    <div className="p-2 bg-success/10 border border-success/20 text-success rounded-lg text-xs animate-fade-in flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Estrategia guardada correctamente
                    </div>
                  )}
                  {publishSuccess && (
                    <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-600 rounded-lg text-xs animate-fade-in flex items-center gap-2">
                      <Store className="w-3.5 h-3.5" />
                      Estrategia publicada al marketplace
                    </div>
                  )}
                  {savedStrategyId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPublishName(strategyName || `Estrategia ${config.strategyName}`);
                        setPublishDialogOpen(true);
                      }}
                      className="w-full border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-600"
                    >
                      <Store className="w-3.5 h-3.5 mr-2" />
                      Publicar al Marketplace
                    </Button>
                  )}
                  {saveAsStrategy.isError && (
                    <div className="p-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs animate-fade-in flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Error al guardar: {saveAsStrategy.error.message}
                    </div>
                  )}
                </div>

                {/* Rentabilidad */}
                {results.totalTrades > 0 && (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <span>Rentabilidad:</span>
                    <span className={`font-bold text-base ${
                      results.totalProfit >= 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {((results.totalProfit / (config.initialCapital || 10000)) * 100).toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 animate-fade-in">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 mb-4">
                  <BarChart3 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">¡Ejecuta tu primer backtest!</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">
                  Configura los parámetros de la estrategia y presiona el botón para ver los resultados
                </p>
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Tip: Empieza con los valores por defecto</span>
                  </div>
                  <Button
                    onClick={handleExecute}
                    disabled={executeBacktest.isPending}
                    className="gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Ejecutar Backtest
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Optimizador mejorado */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2 pt-3 bg-gradient-to-r from-card to-muted/20">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-500" />
            Optimizador
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex gap-1 flex-wrap">
              {optimizationPresets.data?.map((preset: any) => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPreset(preset.id)}
                  className={`px-3 py-2 text-[13px] rounded-lg transition-all min-h-[44px] sm:min-h-0 sm:py-1.5 ${
                    selectedPreset === preset.id
                      ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
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
              className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto min-h-[44px]"
            >
              {runOptimization.isPending ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Optimizando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5" />
                  Optimizar
                </span>
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
              <Scale className="w-4 h-4 text-accent" />
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
              <TrendingUp className="w-4 h-4 text-primary" />
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

    {/* Dialog para publicar al marketplace */}
    <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-blue-500" />
            Publicar al Marketplace
          </DialogTitle>
          <DialogDescription>
            Comparte tu estrategia con otros traders. Se publicará con los resultados del backtest.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nombre de la operativa</Label>
            <Input
              value={publishName}
              onChange={(e) => setPublishName(e.target.value)}
              placeholder="Ej: Grid Conservador XAUUSD"
            />
          </div>
          <div className="space-y-2">
            <Label>Descripción (opcional)</Label>
            <Input
              value={publishDescription}
              onChange={(e) => setPublishDescription(e.target.value)}
              placeholder="Describe tu estrategia..."
            />
          </div>
          <div className="space-y-2">
            <Label>Tags (separados por coma)</Label>
            <Input
              value={publishTags}
              onChange={(e) => setPublishTags(e.target.value)}
              placeholder="conservador, gold, grid"
            />
            {publishTags && (
              <div className="flex flex-wrap gap-1 mt-1">
                {publishTags.split(",").map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {tag.trim()}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Config:</span>
              <span>{config.pipsDistance}p × {config.maxLevels}L × {config.takeProfitPips}TP</span>
            </div>
            {results && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Profit:</span>
                  <span className={results.totalProfit >= 0 ? "text-green-600" : "text-red-600"}>
                    ${results.totalProfit?.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Win Rate:</span>
                  <span>{results.winRate?.toFixed(1)}%</span>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPublishDialogOpen(false)}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handlePublish}
            disabled={!publishName.trim() || publishMutation.isPending}
            className="flex-1"
          >
            {publishMutation.isPending ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Publicando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Store className="w-4 h-4" />
                Publicar
              </span>
            )}
          </Button>
        </div>
        {publishMutation.isError && (
          <div className="p-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Error: {publishMutation.error.message}
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
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
  icon?: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className={`p-2.5 rounded-lg text-center transition-all hover:scale-[1.02] cursor-default ${
      highlight
        ? positive
          ? "bg-gradient-to-br from-success/20 to-success/5 border border-success/30"
          : "bg-gradient-to-br from-destructive/20 to-destructive/5 border border-destructive/30"
        : warning
          ? "bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20"
          : "bg-muted/30 hover:bg-muted/50 border border-transparent"
    }`}>
      <div className="flex items-center justify-center gap-1 mb-0.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-base font-bold font-mono transition-all ${
        positive === true ? "text-success" : positive === false ? "text-destructive" : ""
      }`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">{subtitle}</div>
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
        <AlertCircle className="w-8 h-8 mb-2" />
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
          <RefreshCw className="w-10 h-10 text-primary animate-spin" />
        </div>
        <span className="text-sm text-muted-foreground mt-3 animate-pulse">Cargando gráfico...</span>
      </div>
    );
  }

  if (tradeTicks.isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-destructive">
        <AlertCircle className="w-8 h-8 mb-2" />
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
