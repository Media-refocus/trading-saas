/**
 * CSV Export utilities for backtest trades
 * Generates Excel-compatible CSV format
 */

interface TradeForExport {
  timestamp: Date;
  side: string;
  entryPrice: number;
  exitPrice: number;
  profitPips: number;
  profitEur: number;
  exitReason: string;
  levels?: number;
  durationMinutes?: number;
}

/**
 * Escape a value for CSV (handle quotes, commas, newlines)
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape existing quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format date for CSV (Excel-compatible)
 */
function formatDate(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

/**
 * Export trades to CSV and trigger download
 */
export function exportTradesToCSV(
  trades: TradeForExport[],
  strategyName: string = "backtest"
): void {
  // BOM for Excel UTF-8 compatibility
  const BOM = "\uFEFF";

  // CSV header
  const headers = [
    "Timestamp",
    "Side",
    "Entry Price",
    "Exit Price",
    "Profit Pips",
    "Profit EUR",
    "Close Reason",
    "Levels",
    "Duration (min)",
  ];

  // Build CSV rows
  const rows = trades.map((trade) => [
    escapeCSV(formatDate(new Date(trade.timestamp))),
    escapeCSV(trade.side),
    escapeCSV(trade.entryPrice.toFixed(2)),
    escapeCSV(trade.exitPrice.toFixed(2)),
    escapeCSV(trade.profitPips.toFixed(1)),
    escapeCSV(trade.profitEur.toFixed(2)),
    escapeCSV(trade.exitReason),
    escapeCSV(trade.levels ?? ""),
    escapeCSV(trade.durationMinutes ? Math.round(trade.durationMinutes) : ""),
  ]);

  // Combine all
  const csv = BOM + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

  // Generate filename with date
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${strategyName}-${date}.csv`;

  // Create blob and download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
