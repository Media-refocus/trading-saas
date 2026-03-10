"use client";

import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Loader2, Sparkles, TrendingUp, Target, Gauge } from "lucide-react";

interface AutoTuningSuggestionsProps {
  onApplyConfig: (config: AutoTuningConfig) => void;
}

export interface AutoTuningConfig {
  pipsDistance?: number;
  maxLevels?: number;
  takeProfitPips?: number;
  lotajeBase?: number;
  numOrders?: number;
  useTrailingSL?: boolean;
  trailingSLPercent?: number;
  useStopLoss?: boolean;
  stopLossPips?: number;
  restrictionType?: "RIESGO" | "SIN_PROMEDIOS" | "SOLO_1_PROMEDIO";
}

interface Suggestion {
  config: AutoTuningConfig;
  metrics: {
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    profitPercent: number;
    maxDrawdown: number;
  };
  score: number;
  consistency: number;
  totalProfit: number;
  backtestId: string;
}

export function AutoTuningSuggestions({ onApplyConfig }: AutoTuningSuggestionsProps) {
  const { data, isLoading, error } = api.backtester.getAutoTuningSuggestions.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6 bg-[#1E1E1E] rounded-lg border border-[#3C3C3C]">
        <Loader2 className="w-5 h-5 animate-spin text-[#0078D4] mr-2" />
        <span className="text-[#888888] text-sm">Analyzing historical backtests...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-[#2D1F1F] rounded-lg border border-[#5C3D3D]">
        <span className="text-[#FF6B6B] text-sm">Error loading suggestions</span>
      </div>
    );
  }

  if (!data?.hasData || data.suggestions.length === 0) {
    return (
      <div className="p-4 bg-[#1E1E1E] rounded-lg border border-[#3C3C3C]">
        <div className="flex items-center gap-2 text-[#888888] text-sm">
          <Sparkles className="w-4 h-4" />
          <span>{data?.message || "Run more backtests to unlock auto-tuning suggestions"}</span>
        </div>
        <div className="mt-2 text-xs text-[#666666]">
          Need at least 10 completed backtests with 10+ trades each
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1E1E1E] rounded-lg border border-[#3C3C3C] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-[#252526] border-b border-[#3C3C3C] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#0078D4]" />
          <span className="text-sm font-medium text-white">Auto-Tuning Suggestions</span>
        </div>
        <span className="text-xs text-[#666666]">
          Based on {data.totalBacktests} backtests ({data.uniqueConfigs} configs)
        </span>
      </div>

      {/* Suggestions List */}
      <div className="divide-y divide-[#3C3C3C]">
        {data.suggestions.map((suggestion: Suggestion, index: number) => (
          <SuggestionCard
            key={suggestion.backtestId}
            rank={index + 1}
            suggestion={suggestion}
            onApply={() => onApplyConfig(suggestion.config)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-[#252526] border-t border-[#3C3C3C]">
        <div className="text-xs text-[#666666]">
          Score = Win Rate (35%) + Profit Factor (35%) + Sharpe Ratio (30%)
        </div>
      </div>
    </div>
  );
}

interface SuggestionCardProps {
  rank: number;
  suggestion: Suggestion;
  onApply: () => void;
}

function SuggestionCard({ rank, suggestion, onApply }: SuggestionCardProps) {
  const { config, metrics, score, consistency } = suggestion;

  const rankColors = {
    1: "from-yellow-500/20 to-amber-500/10 border-yellow-500/30",
    2: "from-slate-400/20 to-slate-500/10 border-slate-400/30",
    3: "from-amber-600/20 to-amber-700/10 border-amber-600/30",
  };

  const rankBadge = {
    1: "🥇",
    2: "🥈",
    3: "🥉",
  };

  return (
    <div className={cn(
      "p-4 bg-gradient-to-r",
      rankColors[rank as keyof typeof rankColors]
    )}>
      <div className="flex items-start justify-between gap-4">
        {/* Left: Rank + Config */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{rankBadge[rank as keyof typeof rankBadge]}</span>
            <span className="text-sm font-semibold text-white">Rank #{rank}</span>
            <span className="text-xs text-[#0078D4] bg-[#0078D4]/10 px-2 py-0.5 rounded">
              Score: {score}
            </span>
          </div>

          {/* Config Summary */}
          <div className="flex flex-wrap gap-2 text-xs">
            <ConfigBadge label="Pips" value={config.pipsDistance} />
            <ConfigBadge label="Levels" value={config.maxLevels} />
            <ConfigBadge label="TP" value={config.takeProfitPips} />
            <ConfigBadge label="Lot" value={config.lotajeBase} />
            {config.useTrailingSL && (
              <ConfigBadge label="Trail" value={`${config.trailingSLPercent}%`} />
            )}
            {config.useStopLoss && (
              <ConfigBadge label="SL" value={config.stopLossPips} highlight />
            )}
          </div>

          {/* Consistency indicator */}
          <div className="mt-2 text-xs text-[#666666]">
            {consistency} backtest{consistency !== 1 ? "s" : ""} with this config
          </div>
        </div>

        {/* Middle: Metrics */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <MetricCard
            icon={<Target className="w-3 h-3" />}
            label="Win Rate"
            value={`${metrics.winRate}%`}
            color={metrics.winRate >= 60 ? "text-green-400" : metrics.winRate >= 50 ? "text-yellow-400" : "text-red-400"}
          />
          <MetricCard
            icon={<TrendingUp className="w-3 h-3" />}
            label="PF"
            value={metrics.profitFactor.toFixed(2)}
            color={metrics.profitFactor >= 2 ? "text-green-400" : metrics.profitFactor >= 1.5 ? "text-yellow-400" : "text-red-400"}
          />
          <MetricCard
            icon={<Gauge className="w-3 h-3" />}
            label="Sharpe"
            value={metrics.sharpeRatio.toFixed(2)}
            color={metrics.sharpeRatio >= 1.5 ? "text-green-400" : metrics.sharpeRatio >= 1 ? "text-yellow-400" : "text-red-400"}
          />
        </div>

        {/* Right: Apply Button */}
        <button
          onClick={onApply}
          className="px-4 py-2 bg-[#0078D4] hover:bg-[#1E90FF] text-white text-sm font-medium rounded transition-colors active:scale-95"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

function ConfigBadge({ label, value, highlight = false }: { label: string; value: any; highlight?: boolean }) {
  if (value === undefined || value === null) return null;

  return (
    <span className={cn(
      "px-2 py-0.5 rounded text-[10px] font-mono",
      highlight
        ? "bg-red-500/20 text-red-400"
        : "bg-[#333333] text-[#AAAAAA]"
    )}>
      {label}: {value}
    </span>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className={cn("flex items-center gap-1", color)}>
        {icon}
        <span className="text-sm font-bold">{value}</span>
      </div>
      <span className="text-[10px] text-[#666666]">{label}</span>
    </div>
  );
}
