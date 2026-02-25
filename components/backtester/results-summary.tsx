"use client";

import { cn } from "@/lib/utils";

interface ResultsSummaryProps {
  results: {
    initialCapital: number;
    finalCapital: number;
    profitPercent: number;
    totalProfit: number;
    totalProfitPips: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    sharpeRatio?: number;
    sortinoRatio?: number;
    calmarRatio?: number;
    expectancy?: number;
    rewardRiskRatio?: number;
    avgWin?: number;
    avgLoss?: number;
    maxConsecutiveWins?: number;
    maxConsecutiveLosses?: number;
  };
}

export function ResultsSummary({ results }: ResultsSummaryProps) {
  const stats = [
    // Profitability
    { section: "Profitability" },
    {
      label: "Total Net Profit",
      value: formatCurrency(results.totalProfit),
      color: results.totalProfit >= 0 ? "text-[#00C853]" : "text-[#FF5252]",
    },
    {
      label: "Gross Profit",
      value: formatCurrency(Math.max(0, results.totalProfit)),
      color: "text-[#00C853]",
    },
    {
      label: "Gross Loss",
      value: formatCurrency(-Math.min(0, results.totalProfit)),
      color: "text-[#FF5252]",
    },
    {
      label: "Profit Factor",
      value: results.profitFactor === Infinity ? "∞" : results.profitFactor.toFixed(2),
      color: results.profitFactor >= 1 ? "text-[#00C853]" : "text-[#FF5252]",
    },
    {
      label: "Expected Payoff",
      value: formatCurrency(results.expectancy || 0),
      color: (results.expectancy || 0) >= 0 ? "text-[#00C853]" : "text-[#FF5252]",
    },
    {
      label: "Total Pips",
      value: `${results.totalProfitPips >= 0 ? "+" : ""}${results.totalProfitPips.toFixed(1)}`,
      color: results.totalProfitPips >= 0 ? "text-[#00C853]" : "text-[#FF5252]",
    },

    // Trades
    { section: "Trades" },
    { label: "Total Trades", value: results.totalTrades.toString() },
    {
      label: "Win Rate",
      value: `${results.winRate.toFixed(1)}%`,
      color: results.winRate >= 50 ? "text-[#00C853]" : "text-[#FF5252]",
    },

    // Drawdown
    { section: "Drawdown" },
    {
      label: "Max Drawdown",
      value: formatCurrency(results.maxDrawdown),
      color: "text-[#FF5252]",
    },
    {
      label: "Relative Drawdown",
      value: `${results.maxDrawdownPercent.toFixed(1)}%`,
      color: results.maxDrawdownPercent < 20 ? "text-[#00C853]" : "text-[#FF5252]",
    },

    // Risk Metrics
    { section: "Risk Metrics" },
    {
      label: "Sharpe Ratio",
      value: results.sharpeRatio?.toFixed(2) || "-",
      color: (results.sharpeRatio || 0) >= 1 ? "text-[#00C853]" : "text-[#888888]",
    },
    {
      label: "Sortino Ratio",
      value: results.sortinoRatio?.toFixed(2) || "-",
      color: (results.sortinoRatio || 0) >= 1 ? "text-[#00C853]" : "text-[#888888]",
    },
    {
      label: "Calmar Ratio",
      value: results.calmarRatio?.toFixed(2) || "-",
      color: (results.calmarRatio || 0) >= 3 ? "text-[#00C853]" : "text-[#888888]",
    },

    // Consecutive
    { section: "Consecutive" },
    {
      label: "Max Consecutive Wins",
      value: results.maxConsecutiveWins?.toString() || "0",
      color: "text-[#00C853]",
    },
    {
      label: "Max Consecutive Losses",
      value: results.maxConsecutiveLosses?.toString() || "0",
      color: (results.maxConsecutiveLosses || 0) < 5 ? "text-[#00C853]" : "text-[#FF5252]",
    },
  ];

  let currentSection = "";

  return (
    <div className="p-4 space-y-1">
      {/* Header con métricas principales */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-[#252526] p-4 rounded border border-[#3C3C3C] text-center">
          <div className="text-xs text-[#888888] mb-1">Initial Capital</div>
          <div className="text-xl font-bold font-mono">
            {formatCurrency(results.initialCapital)}
          </div>
        </div>
        <div className="bg-[#252526] p-4 rounded border border-[#3C3C3C] text-center">
          <div className="text-xs text-[#888888] mb-1">Final Capital</div>
          <div className={cn(
            "text-xl font-bold font-mono",
            results.finalCapital >= results.initialCapital ? "text-[#00C853]" : "text-[#FF5252]"
          )}>
            {formatCurrency(results.finalCapital)}
          </div>
        </div>
        <div className="bg-[#252526] p-4 rounded border border-[#3C3C3C] text-center">
          <div className="text-xs text-[#888888] mb-1">Return</div>
          <div className={cn(
            "text-xl font-bold font-mono",
            results.profitPercent >= 0 ? "text-[#00C853]" : "text-[#FF5252]"
          )}>
            {results.profitPercent >= 0 ? "+" : ""}{results.profitPercent.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Tabla de estadísticas */}
      <div className="bg-[#252526] rounded border border-[#3C3C3C] overflow-hidden">
        <table className="w-full text-xs">
          <tbody>
            {stats.map((stat, i) => {
              if ("section" in stat && stat.section) {
                currentSection = stat.section;
                return (
                  <tr key={i} className="bg-[#2D2D2D]">
                    <td colSpan={2} className="py-2 px-3 text-[#0078D4] font-semibold">
                      {stat.section}
                    </td>
                  </tr>
                );
              }
              if (!("section" in stat)) {
                return (
                  <tr key={i} className="border-b border-[#333333]">
                    <td className="py-2 px-3 text-[#888888]">{stat.label}</td>
                    <td className={cn("py-2 px-3 text-right font-mono", stat.color || "text-white")}>
                      {stat.value}
                    </td>
                  </tr>
                );
              }
              return null;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCurrency(value: number): string {
  const formatted = Math.abs(value).toFixed(2);
  const prefix = value < 0 ? "-" : "";
  return `${prefix}€${formatted}`;
}
