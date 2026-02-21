/**
 * FILTROS DE BACKTESTING - Trading Bot SaaS
 *
 * Permite filtrar señales por fecha, día, hora, sesión y dirección.
 * También proporciona estadísticas de segmentación.
 */

import { TradingSignal } from "./parsers/signals-csv";
import { BacktestFilters, Side, TradingSession } from "./backtest-engine";

// ==================== CONSTANTES ====================

// Horarios de sesiones de trading (UTC)
export const TRADING_SESSIONS: Record<TradingSession, { start: number; end: number }> = {
  ASIAN: { start: 0, end: 8 },      // 00:00 - 08:00 UTC
  EUROPEAN: { start: 8, end: 16 },  // 08:00 - 16:00 UTC
  US: { start: 13, end: 21 },       // 13:00 - 21:00 UTC
  ALL: { start: 0, end: 24 },
};

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// ==================== FILTRADO ====================

/**
 * Aplica filtros a una lista de señales
 */
export function filterSignals(
  signals: TradingSignal[],
  filters?: BacktestFilters
): TradingSignal[] {
  if (!filters) return signals;

  return signals.filter(signal => passesFilters(signal, filters));
}

/**
 * Verifica si una señal pasa todos los filtros
 */
export function passesFilters(
  signal: TradingSignal,
  filters: BacktestFilters
): boolean {
  const signalDate = new Date(signal.timestamp);

  // Filtro por rango de fechas
  if (filters.dateFrom && signalDate < filters.dateFrom) {
    return false;
  }
  if (filters.dateTo && signalDate > filters.dateTo) {
    return false;
  }

  // Filtro por día de la semana
  if (filters.daysOfWeek && filters.daysOfWeek.length > 0) {
    const dayOfWeek = signalDate.getDay();
    if (!filters.daysOfWeek.includes(dayOfWeek)) {
      return false;
    }
  }

  // Filtro por hora del día
  const hour = signalDate.getUTCHours();

  if (filters.session && filters.session !== "ALL") {
    const session = TRADING_SESSIONS[filters.session];
    if (hour < session.start || hour >= session.end) {
      return false;
    }
  } else {
    // Filtro manual por hora
    if (filters.hourFrom !== undefined && hour < filters.hourFrom) {
      return false;
    }
    if (filters.hourTo !== undefined && hour >= filters.hourTo) {
      return false;
    }
  }

  // Filtro por dirección
  if (filters.side && signal.side !== filters.side) {
    return false;
  }

  return true;
}

// ==================== SEGMENTACIÓN ====================

export interface SegmentStats {
  segment: string;
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  totalProfit: number;
  avgProfit: number;
}

/**
 * Calcula estadísticas por día de la semana
 */
export function getStatsByDay(
  signals: TradingSignal[],
  profits: number[]
): SegmentStats[] {
  const byDay = new Map<number, { total: number; wins: number; profit: number }>();

  signals.forEach((signal, i) => {
    const day = new Date(signal.timestamp).getDay();
    const profit = profits[i] || 0;

    const existing = byDay.get(day) || { total: 0, wins: 0, profit: 0 };
    existing.total++;
    existing.profit += profit;
    if (profit >= 0) existing.wins++;
    byDay.set(day, existing);
  });

  return Array.from(byDay.entries())
    .map(([day, stats]) => ({
      segment: DAY_NAMES[day],
      total: stats.total,
      wins: stats.wins,
      losses: stats.total - stats.wins,
      winRate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
      totalProfit: stats.profit,
      avgProfit: stats.total > 0 ? stats.profit / stats.total : 0,
    }))
    .sort((a, b) => DAY_NAMES.indexOf(a.segment) - DAY_NAMES.indexOf(b.segment));
}

/**
 * Calcula estadísticas por sesión de trading
 */
export function getStatsBySession(
  signals: TradingSignal[],
  profits: number[]
): SegmentStats[] {
  const bySession = new Map<TradingSession, { total: number; wins: number; profit: number }>();

  signals.forEach((signal, i) => {
    const hour = new Date(signal.timestamp).getUTCHours();
    const profit = profits[i] || 0;

    let session: TradingSession = "ALL";
    if (hour >= 0 && hour < 8) session = "ASIAN";
    else if (hour >= 8 && hour < 16) session = "EUROPEAN";
    else if (hour >= 13 && hour < 21) session = "US";

    const existing = bySession.get(session) || { total: 0, wins: 0, profit: 0 };
    existing.total++;
    existing.profit += profit;
    if (profit >= 0) existing.wins++;
    bySession.set(session, existing);
  });

  const sessionOrder: TradingSession[] = ["ASIAN", "EUROPEAN", "US"];

  return sessionOrder
    .filter(s => bySession.has(s))
    .map(session => {
      const stats = bySession.get(session)!;
      return {
        segment: session === "ASIAN" ? "Asia" : session === "EUROPEAN" ? "Europa" : "USA",
        total: stats.total,
        wins: stats.wins,
        losses: stats.total - stats.wins,
        winRate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
        totalProfit: stats.profit,
        avgProfit: stats.total > 0 ? stats.profit / stats.total : 0,
      };
    });
}

/**
 * Calcula estadísticas por dirección (BUY/SELL)
 */
export function getStatsBySide(
  signals: TradingSignal[],
  profits: number[]
): SegmentStats[] {
  const bySide = new Map<Side, { total: number; wins: number; profit: number }>();

  signals.forEach((signal, i) => {
    const profit = profits[i] || 0;

    const existing = bySide.get(signal.side) || { total: 0, wins: 0, profit: 0 };
    existing.total++;
    existing.profit += profit;
    if (profit >= 0) existing.wins++;
    bySide.set(signal.side, existing);
  });

  return ["BUY", "SELL"]
    .filter(s => bySide.has(s as Side))
    .map(side => {
      const stats = bySide.get(side as Side)!;
      return {
        segment: side,
        total: stats.total,
        wins: stats.wins,
        losses: stats.total - stats.wins,
        winRate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
        totalProfit: stats.profit,
        avgProfit: stats.total > 0 ? stats.profit / stats.total : 0,
      };
    });
}

/**
 * Calcula estadísticas por mes
 */
export function getStatsByMonth(
  signals: TradingSignal[],
  profits: number[]
): SegmentStats[] {
  const byMonth = new Map<string, { total: number; wins: number; profit: number }>();

  signals.forEach((signal, i) => {
    const month = new Date(signal.timestamp).toISOString().slice(0, 7); // "YYYY-MM"
    const profit = profits[i] || 0;

    const existing = byMonth.get(month) || { total: 0, wins: 0, profit: 0 };
    existing.total++;
    existing.profit += profit;
    if (profit >= 0) existing.wins++;
    byMonth.set(month, existing);
  });

  return Array.from(byMonth.entries())
    .map(([month, stats]) => ({
      segment: month,
      total: stats.total,
      wins: stats.wins,
      losses: stats.total - stats.wins,
      winRate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
      totalProfit: stats.profit,
      avgProfit: stats.total > 0 ? stats.profit / stats.total : 0,
    }))
    .sort((a, b) => a.segment.localeCompare(b.segment));
}

/**
 * Obtiene todas las estadísticas de segmentación
 */
export function getSegmentationStats(
  signals: TradingSignal[],
  profits: number[]
): {
  byDay: SegmentStats[];
  bySession: SegmentStats[];
  bySide: SegmentStats[];
  byMonth: SegmentStats[];
} {
  return {
    byDay: getStatsByDay(signals, profits),
    bySession: getStatsBySession(signals, profits),
    bySide: getStatsBySide(signals, profits),
    byMonth: getStatsByMonth(signals, profits),
  };
}
