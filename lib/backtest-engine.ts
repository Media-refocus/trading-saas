/**
 * MOTOR DE BACKTESTING - Trading Bot SaaS
 *
 * Simula la operativa del bot Python:
 * - Grid infinito con trailing SL virtual
 * - Cierre escalonado por niveles
 * - Múltiples operaciones por nivel
 *
 * Referencia: codigo-existente/señales_toni_v3_MONOCUENTA.py
 */

// ==================== TIPOS ====================

export type Side = "BUY" | "SELL";

export type TradeType = "OPEN" | "AVERAGE" | "CLOSE" | "TAKE_PROFIT" | "STOP_LOSS";

export interface BacktestConfig {
  // Estrategia
  strategyName: string;

  // Parámetros de entrada
  lotajeBase: number;
  numOrders: number; // Cuántas operaciones por señal (default: 1)

  // Parámetros de grid
  pipsDistance: number; // Distancia entre niveles en pips
  maxLevels: number; // Máximo número de niveles

  // Take Profit
  takeProfitPips: number; // TP desde precio promedio (default: 20)

  // Stop Loss (opcional)
  stopLossPips?: number; // SL de emergencia (opcional)
  useStopLoss: boolean; // Si el usuario activa gestión de riesgo

  // Restricciones de canal
  restrictionType?: "RIESGO" | "SIN_PROMEDIOS" | "SOLO_1_PROMEDIO";
}

export interface BacktestResult {
  // Resumen
  totalTrades: number;
  totalProfit: number;
  totalProfitPips: number;
  winRate: number;
  maxDrawdown: number;
  profitFactor: number;

  // Detalles
  trades: SimulatedTrade[];
  equityCurve: number[];
}

export interface SimulatedTrade {
  id: string;
  type: TradeType;
  side: Side;
  price: number;
  lotSize: number;
  level: number; // 0 = base, 1 = primer promedio, etc.
  profit: number;
  profitPips: number;
  timestamp: Date;
  signalIndex?: number; // Índice en el CSV de señales
}

export interface PriceTick {
  timestamp: Date;
  bid: number;
  ask: number;
  spread: number;
}

// ==================== CONSTANTES ====================

const PIP_VALUE = 0.10; // 1 pip = 0.10 para XAUUSD

// ==================== CLASE PRINCIPAL ====================

export class BacktestEngine {
  private config: BacktestConfig;
  private entryPrice: number | null = null;
  private side: Side | null = null;
  private entryOpen = false;
  private positions: Map<number, SimulatedTrade[]> = new Map(); // nivel -> array de trades
  private pendingLevels: Set<number> = new Set();
  private entrySL: number | null = null; // Trailing SL virtual
  private totalLevels: number = 0;

  private currentTick = 0;
  private totalTicks = 0;

  private trades: SimulatedTrade[] = [];
  private highEquity: number = 0;
  private lowEquity: number = 0;
  private currentEquity: number = 0;
  private peakEquity: number = 0;
  private maxDrawdown: number = 0;

  constructor(config: BacktestConfig) {
    this.config = config;
  }

  /**
   * Inicia una nueva señal
   */
  startSignal(side: Side, price: number) {
    this.side = side;
    this.entryPrice = price;
    this.entryOpen = false;
    this.entrySL = null;
    this.positions.clear();
    this.pendingLevels.clear();
    this.totalLevels = 0;

    // Calcular cuántos niveles caben según la restricción
    this.totalLevels = this.calculateMaxLevels();
  }

  /**
   * Calcula el máximo número de niveles según restricción
   */
  private calculateMaxLevels(): number {
    const { maxLevels, restrictionType } = this.config;

    switch (restrictionType) {
      case "RIESGO":
        return Math.min(maxLevels, 1); // Solo 1 operación
      case "SIN_PROMEDIOS":
        return 1; // Solo nivel base
      case "SOLO_1_PROMEDIO":
        return Math.min(maxLevels, 2); // Base + 1 promedio
      default:
        return maxLevels;
    }
  }

  /**
   * Abre las operaciones iniciales según numOrders
   */
  openInitialOrders(currentPrice: number): SimulatedTrade[] {
    const trades: SimulatedTrade[] = [];
    const { lotajeBase, numOrders, takeProfitPips } = this.config;

    for (let i = 0; i < numOrders; i++) {
      const isTPFixed = (i === 0); // Primera operación con TP fijo
      const tpPrice = isTPFixed
        ? this.entryPrice! + (takeProfitPips * PIP_VALUE * (this.side === "BUY" ? 1 : -1))
        : null; // Segunda operación sin TP (SL dinámico)

      const trade: SimulatedTrade = {
        id: `trade_${Date.now()}_${i}`,
        type: "OPEN",
        side: this.side!,
        price: currentPrice,
        lotSize: lotajeBase,
        level: i,
        profit: 0,
        profitPips: 0,
        timestamp: new Date(),
      };

      trades.push(trade);

      // Guardar en el mapa de posiciones
      this.positions.set(i, [trade]);
    }

    this.entryOpen = true;
    this.entrySL = null; // Resetear SL virtual
    return trades;
  }

  /**
   * Procesa un tick de precio
   */
  processTick(tick: PriceTick): SimulatedTrade[] | null {
    if (!this.entryPrice || !this.side) {
      return null;
    }

    this.currentTick++;
    const newTrades: SimulatedTrade[] = [];

    const isBuy = this.side === "BUY";
    const closePrice = isBuy ? tick.bid : tick.ask;
    const spread = tick.spread;

    // 1. Actualizar Trailing SL Virtual (si está activo)
    this.updateTrailingStopLoss(closePrice);

    // 2. Verificar si se ha golpeado el SL virtual de la entrada
    const entrySLHit = this.checkEntryStopLoss(closePrice);
    if (entrySLHit) {
      newTrades.push(...this.closeAllPositions(closePrice, "STOP_LOSS"));
      return newTrades;
    }

    // 3. Calcular precio promedio actual de todas las operaciones
    const avgPrice = this.calculateAveragePrice(closePrice);

    if (avgPrice === null) {
      return null;
    }

    // 4. Verificar Take Profit (cierre escalonado)
    const profitPips = isBuy
      ? (avgPrice - this.entryPrice) / PIP_VALUE
      : (this.entryPrice - avgPrice) / PIP_VALUE;

    if (profitPips >= this.config.takeProfitPips) {
      newTrades.push(...this.closeAllLevelsInProfit(closePrice, avgPrice));
      return newTrades;
    }

    // 5. Gestionar niveles (abrir promedios si corresponde)
    this.manageGridLevels(closePrice, avgPrice);

    // 6. Actualizar métricas de equity
    this.updateEquityMetrics(closePrice);

    return newTrades.length > 0 ? newTrades : null;
  }

  /**
   * Actualiza el Stop Loss virtual (trailing)
   */
  private updateTrailingStopLoss(currentPrice: number): void {
    if (!this.entryOpen || !this.entryPrice || !this.side) {
      return;
    }

    const { takeProfitPips } = this.config;
    const isBuy = this.side === "BUY";

    // La operación 0 (TP fijo) no tiene SL virtual
    // La operación 1 tiene SL que se mueve

    const activateDistance = takeProfitPips * PIP_VALUE; // Distancia para activar trailing (desde entrada)
    const backDistance = 20 * PIP_VALUE; // Distancia del SL desde precio actual (20 pips)
    const stepDistance = 10 * PIP_VALUE; // Cuánto se mueve el SL cada vez
    const buffer = 1 * PIP_VALUE; // Buffer de seguridad

    if (isBuy) {
      // BUY: El SL está por encima (venta)
      if (currentPrice >= this.entryPrice + activateDistance) {
        const targetSL = currentPrice - backDistance - buffer;
        const currentSL = this.entrySL;

        if (currentSL === null || (targetSL - currentSL >= stepDistance - 0.000001)) {
          this.entrySL = targetSL;
        }
      }
    } else {
      // SELL: El SL está por debajo (compra)
      if (currentPrice <= this.entryPrice - activateDistance) {
        const targetSL = currentPrice + backDistance + buffer;
        const currentSL = this.entrySL;

        if (currentSL === null || (currentSL - targetSL >= stepDistance - 0.000001)) {
          this.entrySL = targetSL;
        }
      }
    }
  }

  /**
   * Verifica si se ha golpeado el SL virtual de la entrada
   */
  private checkEntryStopLoss(currentPrice: number): boolean {
    if (this.entrySL === null || !this.entryPrice || !this.side) {
      return false;
    }

    const isBuy = this.side === "BUY";

    if (isBuy) {
      // BUY: SL golpeado si precio <= SL
      return currentPrice <= this.entrySL;
    } else {
      // SELL: SL golpeado si precio >= SL
      return currentPrice >= this.entrySL;
    }
  }

  /**
   * Calcula el precio promedio de todas las operaciones abiertas
   */
  private calculateAveragePrice(currentPrice: number): number | null {
    if (this.positions.size === 0) {
      return this.entryPrice;
    }

    let totalLots = 0;
    let weightedPrice = 0;

    // Recorrer todos los niveles
    for (const [level, trades] of this.positions.entries()) {
      for (const trade of trades) {
        if (trade.type === "CLOSE" || trade.type === "STOP_LOSS") {
          continue; // Ignorar operaciones cerradas
        }

        totalLots += trade.lotSize;
        weightedPrice += trade.price * trade.lotSize;
      }
    }

    if (totalLots === 0) {
      return null;
    }

    return weightedPrice / totalLots;
  }

  /**
   * Gestiona los niveles del grid (abrir promedios)
   */
  private manageGridLevels(currentPrice: number, avgPrice: number): void {
    const { pipsDistance, maxLevels, useStopLoss } = this.config;
    const gridDistance = pipsDistance * PIP_VALUE;
    const halfGrid = gridDistance / 2;

    const isBuy = this.side === "BUY";
    const againstMovement = isBuy
      ? (this.entryPrice! - currentPrice) // Movimiento en contra en BUY
      : (currentPrice - this.entryPrice!); // Movimiento en contra en SELL

    // Verificar si se ha movido suficiente para abrir nuevo nivel
    if (againstMovement < halfGrid) {
      return;
    }

    // Calcular niveles vivos actuales
    const liveLevels = new Set<number>();
    for (const [lvl, trades] of this.positions.entries()) {
      for (const trade of trades) {
        if (trade.type !== "CLOSE" && trade.type !== "STOP_LOSS") {
          liveLevels.add(lvl);
        }
      }
    }

    // Calcular niveles en el mercado (pendientes)
    const marketLevels = new Set<number>();
    // Esto se llenaría con datos del CSV de señales

    // Niveles disponibles para abrir
    const availableSlots = maxLevels - liveLevels.size;
    if (availableSlots <= 0) {
      return;
    }

    // Abrir nuevo nivel
    const nextLevel = this.getNextAvailableLevel(liveLevels);
    if (nextLevel !== null && nextLevel < this.totalLevels) {
      const newTrade: SimulatedTrade = {
        id: `avg_${Date.now()}_${nextLevel}`,
        type: "AVERAGE",
        side: this.side!,
        price: currentPrice,
        lotSize: this.config.lotajeBase,
        level: nextLevel,
        profit: 0,
        profitPips: 0,
        timestamp: new Date(),
      };

      if (!this.positions.has(nextLevel)) {
        this.positions.set(nextLevel, []);
      }

      const levelTrades = this.positions.get(nextLevel)!;
      levelTrades.push(newTrade);

      this.pendingLevels.add(nextLevel);
    }
  }

  /**
   * Encuentra el siguiente nivel disponible
   */
  private getNextAvailableLevel(liveLevels: Set<number>): number | null {
    for (let i = 0; i < this.totalLevels; i++) {
      if (!liveLevels.has(i)) {
        return i;
      }
    }
    return null;
  }

  /**
   * Cierra todas las operaciones en profit (take profit)
   */
  private closeAllLevelsInProfit(currentPrice: number, avgPrice: number): SimulatedTrade[] {
    const closingTrades: SimulatedTrade[] = [];
    const isBuy = this.side === "BUY";

    for (const [level, trades] of this.positions.entries()) {
      for (const trade of trades) {
        if (trade.type === "CLOSE" || trade.type === "STOP_LOSS") {
          continue;
        }

        // Calcular profit de esta operación
        const profitPips = isBuy
          ? (currentPrice - trade.price) / PIP_VALUE
          : (trade.price - currentPrice) / PIP_VALUE;

        const profit = profitPips * trade.lotSize / PIP_VALUE;

        const closingTrade: SimulatedTrade = {
          ...trade,
          type: "CLOSE",
          profit,
          profitPips,
        };

        closingTrades.push(closingTrade);
        this.trades.push(closingTrade);
      }
    }

    // Limpiar posiciones
    this.positions.clear();
    this.pendingLevels.clear();
    this.entryOpen = false;
    this.entrySL = null;

    return closingTrades;
  }

  /**
   * Cierra todas las operaciones (cuando SL de entrada o emergencia)
   */
  private closeAllPositions(currentPrice: number, reason: "STOP_LOSS" | "TAKE_PROFIT"): SimulatedTrade[] {
    const closingTrades: SimulatedTrade[] = [];
    const isBuy = this.side === "BUY";

    for (const [level, trades] of this.positions.entries()) {
      for (const trade of trades) {
        if (trade.type === "CLOSE" || trade.type === "STOP_LOSS") {
          continue;
        }

        // Calcular profit/loss
        const profitPips = isBuy
          ? (currentPrice - trade.price) / PIP_VALUE
          : (trade.price - currentPrice) / PIP_VALUE;

        const profit = profitPips * trade.lotSize / PIP_VALUE;

        const closingTrade: SimulatedTrade = {
          ...trade,
          type: reason,
          profit,
          profitPips,
        };

        closingTrades.push(closingTrade);
        this.trades.push(closingTrade);
      }
    }

    this.positions.clear();
    this.pendingLevels.clear();
    this.entryOpen = false;
    this.entrySL = null;

    return closingTrades;
  }

  /**
   * Actualiza métricas de equity y drawdown
   */
  private updateEquityMetrics(currentPrice: number): void {
    // Calcular equity actual
    let floatingProfit = 0;

    for (const [level, trades] of this.positions.entries()) {
      for (const trade of trades) {
        if (trade.type === "CLOSE" || trade.type === "STOP_LOSS") {
          continue;
        }

        const isBuy = this.side === "BUY";
        const profitPips = isBuy
          ? (currentPrice - trade.price) / PIP_VALUE
          : (trade.price - currentPrice) / PIP_VALUE;

        floatingProfit += profitPips * trade.lotSize / PIP_VALUE;
      }
    }

    // Sumar profit de operaciones cerradas
    let closedProfit = 0;
    for (const trade of this.trades) {
      closedProfit += trade.profit;
    }

    this.currentEquity = 10000 + floatingProfit + closedProfit; // 10000 = balance inicial

    // Actualizar peak
    if (this.currentEquity > this.peakEquity) {
      this.peakEquity = this.currentEquity;
    }

    // Calcular drawdown
    const dd = this.peakEquity - this.currentEquity;
    if (dd > this.maxDrawdown) {
      this.maxDrawdown = dd;
    }
  }

  /**
   * Obtiene el resultado final del backtest
   */
  getResults(): BacktestResult {
    const winningTrades = this.trades.filter(t => t.type === "CLOSE" && t.profit > 0);
    const losingTrades = this.trades.filter(t => t.type === "CLOSE" && t.profit < 0);

    return {
      totalTrades: this.trades.length,
      totalProfit: this.currentEquity - 10000,
      totalProfitPips: this.trades.reduce((sum, t) => sum + t.profitPips, 0),
      winRate: this.trades.length > 0 ? (winningTrades.length / this.trades.length) * 100 : 0,
      maxDrawdown: this.maxDrawdown,
      profitFactor: this.trades.length > 0 ? this.trades.reduce((sum, t) => sum + t.profit, 0) /
        Math.abs(this.trades.reduce((sum, t) => sum + t.profit, 0)) * losingTrades.reduce((sum, t) => sum + Math.abs(t.profit), 0)) : 0,
      trades: this.trades,
      equityCurve: [], // TODO: Implementar
    };
  }
}
