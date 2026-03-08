"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Deal {
  index: number;
  timestamp: Date;
  type: "BUY" | "SELL";
  side: "entry" | "exit" | "level";
  order: number;
  volume: number;
  price: number;
  sl?: number;
  tp?: number;
  profit: number;
  balance: number;
  level?: number;
  exitReason?: string;
}

interface TradeLevel {
  level: number;
  openPrice: number;
  closePrice: number;
  lotSize: number;
  profit: number;
  profitPips: number;
  openTime: Date;
  closeTime: Date;
}

interface Trade {
  signalTimestamp: Date;
  signalSide: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  maxLevels: number;
  totalProfitPips: number;
  totalProfit: number;
  exitReason: string;
  levels?: TradeLevel[];
  avgPrice?: number;
  durationMinutes?: number;
}

interface DealsTableProps {
  deals: Deal[];
  trades: Trade[];
  onSelectTrade: (index: number) => void;
  selectedTradeIndex: number | null;
}

export function DealsTable({
  deals,
  trades,
  onSelectTrade,
  selectedTradeIndex,
}: DealsTableProps) {
  const [viewMode, setViewMode] = useState<"deals" | "trades" | "report">("trades");

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#2D2D2D] border-b border-[#3C3C3C]">
        <button
          onClick={() => setViewMode("deals")}
          className={cn(
            "px-3 py-1 text-xs rounded transition-colors",
            viewMode === "deals"
              ? "bg-[#0078D4] text-white"
              : "bg-[#333333] text-[#888888] hover:text-white"
          )}
        >
          Deals
        </button>
        <button
          onClick={() => setViewMode("trades")}
          className={cn(
            "px-3 py-1 text-xs rounded transition-colors",
            viewMode === "trades"
              ? "bg-[#0078D4] text-white"
              : "bg-[#333333] text-[#888888] hover:text-white"
          )}
        >
          Trades
        </button>
        <button
          onClick={() => setViewMode("report")}
          className={cn(
            "px-3 py-1 text-xs rounded transition-colors",
            viewMode === "report"
              ? "bg-[#0078D4] text-white"
              : "bg-[#333333] text-[#888888] hover:text-white"
          )}
        >
          Report
        </button>

        <div className="flex-1" />

        <div className="text-xs text-[#888888]">
          {trades.length} trades • {deals.length} deals
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === "deals" && (
          <DealsView deals={deals} />
        )}
        {viewMode === "trades" && (
          <TradesView
            trades={trades}
            onSelectTrade={onSelectTrade}
            selectedTradeIndex={selectedTradeIndex}
          />
        )}
        {viewMode === "report" && (
          <ReportView trades={trades} />
        )}
      </div>
    </div>
  );
}

// Vista de Deals individuales (estilo MT5)
function DealsView({ deals }: { deals: Deal[] }) {
  return (
    <table className="w-full text-xs" aria-label="Tabla de operaciones individuales">
      <thead className="bg-[#2D2D2D] sticky top-0">
        <tr>
          <th scope="col" className="text-left py-2 px-3 text-[#888888]">#</th>
          <th scope="col" className="text-left py-2 px-3 text-[#888888]">Time</th>
          <th scope="col" className="text-left py-2 px-3 text-[#888888]">Type</th>
          <th scope="col" className="text-left py-2 px-3 text-[#888888]">Order</th>
          <th scope="col" className="text-right py-2 px-3 text-[#888888]">Volume</th>
          <th scope="col" className="text-right py-2 px-3 text-[#888888]">Price</th>
          <th scope="col" className="text-right py-2 px-3 text-[#888888]">S/L</th>
          <th scope="col" className="text-right py-2 px-3 text-[#888888]">T/P</th>
          <th scope="col" className="text-right py-2 px-3 text-[#888888]">Profit</th>
          <th scope="col" className="text-right py-2 px-3 text-[#888888]">Balance</th>
        </tr>
      </thead>
      <tbody>
        {deals.map((deal, i) => (
          <tr
            key={i}
            className={cn(
              "border-b border-[#333333] hover:bg-[#2A2A2A] transition-colors",
              deal.profit > 0 && "bg-[#1A2E1A]/30",
              deal.profit < 0 && "bg-[#2E1A1A]/30"
            )}
          >
            <td className="py-2 px-3 font-mono text-[#666666]">{deal.index}</td>
            <td className="py-2 px-3 font-mono">
              {new Date(deal.timestamp).toLocaleString()}
            </td>
            <td className={cn(
              "py-2 px-3 font-semibold",
              deal.type === "BUY" ? "text-[#00C853]" : "text-[#FF5252]"
            )}>
              {deal.type}
              {deal.level && deal.level > 0 && (
                <span className="text-[#666666] ml-1">L{deal.level}</span>
              )}
            </td>
            <td className="py-2 px-3 font-mono text-[#888888]">{deal.order}</td>
            <td className="py-2 px-3 text-right font-mono">{deal.volume.toFixed(2)}</td>
            <td className="py-2 px-3 text-right font-mono">{deal.price.toFixed(2)}</td>
            <td className="py-2 px-3 text-right font-mono text-[#FF5252]">
              {deal.sl?.toFixed(2) || "-"}
            </td>
            <td className="py-2 px-3 text-right font-mono text-[#00C853]">
              {deal.tp?.toFixed(2) || "-"}
            </td>
            <td className={cn(
              "py-2 px-3 text-right font-mono font-semibold",
              deal.profit > 0 ? "text-[#00C853]" : deal.profit < 0 ? "text-[#FF5252]" : "text-[#888888]"
            )}>
              {deal.profit > 0 ? "+" : ""}{deal.profit.toFixed(2)}
            </td>
            <td className="py-2 px-3 text-right font-mono">
              {deal.balance.toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Vista de Trades completos (agrupados)
function TradesView({
  trades,
  onSelectTrade,
  selectedTradeIndex,
}: {
  trades: Trade[];
  onSelectTrade: (index: number) => void;
  selectedTradeIndex: number | null;
}) {
  const [expandedTrade, setExpandedTrade] = useState<number | null>(null);

  const toggleExpand = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTrade(expandedTrade === index ? null : index);
  };

  return (
    <div className="w-full">
      <table className="w-full text-xs" aria-label="Tabla de trades agrupados">
        <thead className="bg-[#2D2D2D] sticky top-0">
          <tr>
            <th scope="col" className="w-6 py-2 px-2 text-[#888888]"></th>
            <th scope="col" className="text-left py-2 px-3 text-[#888888]">#</th>
            <th scope="col" className="text-left py-2 px-3 text-[#888888]">Date</th>
            <th scope="col" className="text-left py-2 px-3 text-[#888888]">Side</th>
            <th scope="col" className="text-right py-2 px-3 text-[#888888]">Entry</th>
            <th scope="col" className="text-right py-2 px-3 text-[#888888]">Exit</th>
            <th scope="col" className="text-right py-2 px-3 text-[#888888]">Levels</th>
            <th scope="col" className="text-right py-2 px-3 text-[#888888]">Pips</th>
            <th scope="col" className="text-right py-2 px-3 text-[#888888]">Profit</th>
            <th scope="col" className="text-left py-2 px-3 text-[#888888]">Close</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade, i) => (
            <>
              <tr
                key={`row-${i}`}
                onClick={() => onSelectTrade(i)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectTrade(i); }}
                role="button"
                tabIndex={0}
                className={cn(
                  "border-b border-[#333333] cursor-pointer transition-colors",
                  selectedTradeIndex === i
                    ? "bg-[#0078D4]/20 border-l-2 border-l-[#0078D4]"
                    : "hover:bg-[#2A2A2A]",
                  trade.totalProfit >= 0 ? "bg-[#1A2E1A]/20" : "bg-[#2E1A1A]/20"
                )}
              >
                <td className="py-2 px-2">
                  <button
                    onClick={(e) => toggleExpand(i, e)}
                    className="p-0.5 hover:bg-[#444] rounded transition-colors"
                    aria-label={expandedTrade === i ? "Collapse" : "Expand"}
                  >
                    {expandedTrade === i ? (
                      <ChevronDown className="w-3 h-3 text-[#888]" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-[#888]" />
                    )}
                  </button>
                </td>
                <td className="py-2 px-3 font-mono text-[#666666]">{i + 1}</td>
                <td className="py-2 px-3 font-mono">
                  {new Date(trade.signalTimestamp).toLocaleDateString()}
                </td>
                <td className={cn(
                  "py-2 px-3 font-semibold",
                  trade.signalSide === "BUY" ? "text-[#00C853]" : "text-[#FF5252]"
                )}>
                  {trade.signalSide}
                </td>
                <td className="py-2 px-3 text-right font-mono">{trade.entryPrice?.toFixed(2)}</td>
                <td className="py-2 px-3 text-right font-mono">{trade.exitPrice?.toFixed(2)}</td>
                <td className="py-2 px-3 text-right">{trade.maxLevels}</td>
                <td className={cn(
                  "py-2 px-3 text-right font-mono",
                  trade.totalProfitPips >= 0 ? "text-[#00C853]" : "text-[#FF5252]"
                )}>
                  {trade.totalProfitPips >= 0 ? "+" : ""}{trade.totalProfitPips?.toFixed(1)}
                </td>
                <td className={cn(
                  "py-2 px-3 text-right font-mono font-semibold",
                  trade.totalProfit >= 0 ? "text-[#00C853]" : "text-[#FF5252]"
                )}>
                  {trade.totalProfit >= 0 ? "+" : ""}{trade.totalProfit?.toFixed(2)}€
                </td>
                <td className="py-2 px-3">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium",
                    trade.exitReason === "TAKE_PROFIT"
                      ? "bg-[#00C853]/20 text-[#00C853]"
                      : trade.exitReason === "TRAILING_SL"
                      ? "bg-[#FFA500]/20 text-[#FFA500]"
                      : "bg-[#FF5252]/20 text-[#FF5252]"
                  )}>
                    {trade.exitReason === "TAKE_PROFIT" ? "TP" : trade.exitReason === "TRAILING_SL" ? "Trail" : "SL"}
                  </span>
                </td>
              </tr>
              {/* Expanded row with grid details */}
              {expandedTrade === i && trade.levels && trade.levels.length > 0 && (
                <tr key={`expanded-${i}`} className="bg-[#1A1A1A] border-b border-[#333333]">
                  <td colSpan={10} className="p-0">
                    <div className="overflow-hidden transition-all duration-200 ease-in-out">
                      <div className="p-3 space-y-2">
                        {/* Summary row */}
                        <div className="flex items-center gap-4 text-[11px] text-[#888] pb-2 border-b border-[#333]">
                          <span>Avg Price: <span className="font-mono text-white">{trade.avgPrice?.toFixed(2)}</span></span>
                          <span>Duration: <span className="font-mono text-white">{trade.durationMinutes ? `${Math.round(trade.durationMinutes)}m` : '-'}</span></span>
                          <span>Total Lots: <span className="font-mono text-white">{trade.levels.reduce((s, l) => s + l.lotSize, 0).toFixed(2)}</span></span>
                        </div>
                        {/* Grid levels */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="text-[#666]">
                                <th className="text-left py-1 px-2">Level</th>
                                <th className="text-left py-1 px-2">Open Time</th>
                                <th className="text-right py-1 px-2">Open Price</th>
                                <th className="text-right py-1 px-2">Close Price</th>
                                <th className="text-right py-1 px-2">Lots</th>
                                <th className="text-right py-1 px-2">Pips</th>
                                <th className="text-right py-1 px-2">Profit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {trade.levels.map((level, li) => (
                                <tr key={li} className="border-t border-[#2A2A2A]">
                                  <td className="py-1.5 px-2">
                                    <span className={cn(
                                      "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                      level.level === 0 ? "bg-[#0078D4]/20 text-[#0078D4]" : "bg-[#8B5CF6]/20 text-[#8B5CF6]"
                                    )}>
                                      L{level.level}
                                    </span>
                                  </td>
                                  <td className="py-1.5 px-2 font-mono text-[#888]">
                                    {new Date(level.openTime).toLocaleTimeString()}
                                  </td>
                                  <td className="py-1.5 px-2 text-right font-mono">{level.openPrice.toFixed(2)}</td>
                                  <td className="py-1.5 px-2 text-right font-mono">{level.closePrice.toFixed(2)}</td>
                                  <td className="py-1.5 px-2 text-right font-mono">{level.lotSize.toFixed(2)}</td>
                                  <td className={cn(
                                    "py-1.5 px-2 text-right font-mono",
                                    level.profitPips >= 0 ? "text-[#00C853]" : "text-[#FF5252]"
                                  )}>
                                    {level.profitPips >= 0 ? "+" : ""}{level.profitPips.toFixed(1)}
                                  </td>
                                  <td className={cn(
                                    "py-1.5 px-2 text-right font-mono font-medium",
                                    level.profit >= 0 ? "text-[#00C853]" : "text-[#FF5252]"
                                  )}>
                                    {level.profit >= 0 ? "+" : ""}{level.profit.toFixed(2)}€
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Vista de Report (estadísticas)
function ReportView({ trades }: { trades: any[] }) {
  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[#888888]">
        No trades to report
      </div>
    );
  }

  // Calcular estadísticas
  const wins = trades.filter(t => t.totalProfit >= 0);
  const losses = trades.filter(t => t.totalProfit < 0);
  const totalProfit = trades.reduce((sum, t) => sum + (t.totalProfit || 0), 0);
  const grossProfit = wins.reduce((sum, t) => sum + (t.totalProfit || 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.totalProfit || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Drawdown calculation
  let peak = 0;
  let maxDrawdown = 0;
  let balance = 10000; // initial capital
  trades.forEach(t => {
    balance += t.totalProfit || 0;
    if (balance > peak) peak = balance;
    const dd = peak - balance;
    if (dd > maxDrawdown) maxDrawdown = dd;
  });

  const stats = [
    { label: "Total Net Profit", value: `${totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(2)}€`, color: totalProfit >= 0 ? "text-[#00C853]" : "text-[#FF5252]" },
    { label: "Gross Profit", value: `+${grossProfit.toFixed(2)}€`, color: "text-[#00C853]" },
    { label: "Gross Loss", value: `-${grossLoss.toFixed(2)}€`, color: "text-[#FF5252]" },
    { label: "Profit Factor", value: profitFactor === Infinity ? "∞" : profitFactor.toFixed(2), color: profitFactor >= 1 ? "text-[#00C853]" : "text-[#FF5252]" },
    { label: "Total Trades", value: trades.length.toString(), color: "" },
    { label: "Win Trades", value: `${wins.length} (${((wins.length / trades.length) * 100).toFixed(1)}%)`, color: "text-[#00C853]" },
    { label: "Loss Trades", value: `${losses.length} (${((losses.length / trades.length) * 100).toFixed(1)}%)`, color: "text-[#FF5252]" },
    { label: "Max Drawdown", value: `${maxDrawdown.toFixed(2)}€`, color: "text-[#FF5252]" },
  ];

  // Largest win/loss
  const largestWin = Math.max(...wins.map(t => t.totalProfit || 0), 0);
  const largestLoss = Math.min(...losses.map(t => t.totalProfit || 0), 0);
  stats.push({ label: "Largest Win", value: `+${largestWin.toFixed(2)}€`, color: "text-[#00C853]" });
  stats.push({ label: "Largest Loss", value: `${largestLoss.toFixed(2)}€`, color: "text-[#FF5252]" });

  // Average win/loss
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.totalProfit || 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.totalProfit || 0), 0) / losses.length) : 0;
  stats.push({ label: "Average Win", value: `+${avgWin.toFixed(2)}€`, color: "text-[#00C853]" });
  stats.push({ label: "Average Loss", value: `-${avgLoss.toFixed(2)}€`, color: "text-[#FF5252]" });

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-2">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="flex justify-between items-center bg-[#252526] p-3 rounded border border-[#3C3C3C]"
          >
            <span className="text-xs text-[#888888]">{stat.label}</span>
            <span className={cn("font-mono font-semibold", stat.color || "text-white")}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
