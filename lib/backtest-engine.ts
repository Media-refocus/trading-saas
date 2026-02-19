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

  // Trailing SL Virtual
  useTrailingSL?: boolean; // Activar/desactivar Trailing SL Virtual (default: true)
  trailingSLPercent?: number; // % del TP para el trailing (default: 50 = la mitad)

  // Restricciones de canal
  restrictionType?: "RIESGO" | "SIN_PROMEDIOS" | "SOLO_1_PROMEDIO";

  // Capital y dinero
  initialCapital?: number; // Capital inicial en euros (default: 10000)
}

export interface BacktestResult {
  // Resumen
  totalTrades: number;
  totalProfit: number;        // Profit en la moneda del cálculo (USD)
  totalProfitPips: number;
  winRate: number;
  maxDrawdown: number;
  profitFactor: number;

  // Capital y dinero real
  initialCapital: number;     // Capital inicial en euros
  finalCapital: number;       // Capital final = inicial + profit
  profitPercent: number;      // % de retorno sobre capital inicial
  maxDrawdownPercent: number; // % de drawdown sobre capital inicial

  // Detalles
  trades: any[];
  tradeDetails: TradeDetail[];  // Detalle ampliado por señal
  equityCurve: EquityPoint[];   // Curva de equity con timestamps
}

export interface PriceTick {
  timestamp: Date;
  bid: number;
  ask: number;
  spread: number;
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

// ==================== NUEVOS TIPOS PARA DETALLE ====================

export interface TradeLevel {
  level: number;           // 0 = base, 1+ = promedios
  openPrice: number;       // Precio de apertura
  closePrice: number;      // Precio de cierre
  lotSize: number;         // Tamaño del lote
  profit: number;          // Profit en $
  profitPips: number;      // Profit en pips
  openTime: Date;          // Cuándo se abrió
  closeTime: Date;         // Cuándo se cerró
}

export interface TradeDetail {
  signalIndex: number;           // Índice de la señal
  signalTimestamp: Date;         // Fecha/hora de la señal
  signalSide: Side;              // BUY o SELL
  signalPrice: number;           // Precio de la señal

  // Entrada real
  entryPrice: number;            // Precio real de entrada (del tick)
  entryTime: Date;               // Cuándo se entró

  // Salida
  exitPrice: number;             // Precio de cierre
  exitTime: Date;                // Cuándo se cerró
  exitReason: "TAKE_PROFIT" | "STOP_LOSS" | "TRAILING_SL";

  // Métricas
  totalLots: number;             // Suma de lotes
  avgPrice: number;              // Precio promedio ponderado
  totalProfit: number;           // Profit total en $
  totalProfitPips: number;       // Profit total en pips
  durationMinutes: number;       // Duración en minutos
  maxLevels: number;             // Niveles alcanzados

  // Desglose por nivel
  levels: TradeLevel[];
}

export interface EquityPoint {
  timestamp: Date;
  equity: number;          // Balance + floating P&L
  balance: number;         // Balance sin floating
  drawdown: number;        // Drawdown actual
}

// ==================== CONSTANTES ====================

const PIP_VALUE = 0.10; // 1 pip ≈ 0.10 USD (XAU/USD típico)

// ==================== CLASE PRINCIPAL ====================

export class BacktestEngine {
  private config: BacktestConfig;
  private entryPrice: number | null = null;
  private side: Side | null = null;
  private entryOpen = false;
  private positions: Map<number, any[]> = new Map(); // nivel -> array de trades
  private pendingLevels: Set<number> = new Set();
  private entrySL: number | null = null; // Trailing SL virtual
  private totalLevels: number = 0;

  private currentTick = 0;
  private totalTicks = 0;

  private trades: any[] = [];
  private tradeDetails: TradeDetail[] = []; // Detalle ampliado por señal
  private equityCurve: EquityPoint[] = []; // Curva de equity

  // Tracking de la señal actual
  private currentSignalIndex: number = 0;
  private currentSignalTimestamp: Date | null = null;
  private currentSignalPrice: number | null = null;
  private currentEntryTime: Date | null = null;
  private currentLevels: TradeLevel[] = [];

  private highEquity: number = 0;
  private lowEquity: number = 0;
  private currentEquity: number = 0;
  private currentBalance: number = 0;
  private peakEquity: number = 0;
  private maxDrawdown: number = 0;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.currentBalance = config.initialCapital || 10000;
  }

  /**
   * Inicia una nueva señal
   */
  startSignal(side: Side, price: number, signalIndex: number = 0, signalTimestamp: Date = new Date()): void {
    // Guardar info de la señal actual
    this.currentSignalIndex = signalIndex;
    this.currentSignalTimestamp = signalTimestamp;
    this.currentSignalPrice = price;
    this.currentLevels = [];

    this.side = side;
    this.entryPrice = price;
    this.entryOpen = false;
    this.entrySL = null;
    this.positions.clear();
    this.pendingLevels.clear();
    this.totalLevels = this.calculateMaxLevels();

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
  openInitialOrders(currentPrice: number, tickTimestamp: Date = new Date()): any[] {
    const trades: any[] = [];
    const { lotajeBase, numOrders, takeProfitPips } = this.config;

    // Guardar tiempo de entrada
    this.currentEntryTime = tickTimestamp;

    for (let i = 0; i < numOrders; i++) {
      const isTPFixed = (i === 0); // Primera operación con TP fijo
      const tpPrice = isTPFixed
        ? this.entryPrice! + (takeProfitPips * PIP_VALUE * (this.side === "BUY" ? 1 : -1))
        : null; // Segunda operación sin TP (SL dinámico)

      const trade: any = {
        id: `trade_${Date.now()}_${i}`,
        type: "OPEN",
        side: this.side!,
        price: currentPrice,
        lotSize: lotajeBase,
        level: i,
        profit: 0,
        profitPips: 0,
        timestamp: tickTimestamp,
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
  processTick(tick: PriceTick): any[] | null {
    if (!this.entryPrice || !this.side) {
      return null;
    }

    this.currentTick++;
    const newTrades: any[] = [];

    const isBuy = this.side === "BUY";
    const closePrice = isBuy ? tick.bid : tick.ask;
    const spread = tick.spread;

    // 1. Actualizar Trailing SL Virtual (si está activo)
    this.updateTrailingStopLoss(closePrice);

    // 2. Verificar si se ha golpeado el SL virtual de la entrada
    const entrySLHit = this.checkEntryStopLoss(closePrice);
    if (entrySLHit) {
      newTrades.push(...this.closeAllPositions(closePrice, "STOP_LOSS", tick.timestamp));
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
      newTrades.push(...this.closeAllLevelsInProfit(closePrice, avgPrice, tick.timestamp));
      return newTrades;
    }

    // 5. Gestionar niveles (abrir promedios si corresponde)
    this.manageGridLevels(closePrice, avgPrice);

    // 6. Actualizar métricas de equity
    this.updateEquityMetrics(closePrice, tick.timestamp);

    return newTrades.length > 0 ? newTrades : null;
  }

  /**
   * Actualiza el Stop Loss virtual (trailing)
   *
   * NOTA: El Trailing SL solo se activa si useTrailingSL es true (default)
   * El backDistance es proporcional al activateDistance para garantizar profit
   */
  private updateTrailingStopLoss(currentPrice: number): void {
    if (!this.entryOpen || !this.entryPrice || !this.side) {
      return;
    }

    // Si el usuario desactivó el Trailing SL, no hacer nada
    if (this.config.useTrailingSL === false) {
      return;
    }

    const { takeProfitPips, trailingSLPercent } = this.config;
    const isBuy = this.side === "BUY";

    // Distancia para activar el trailing SL (takeProfitPips)
    const activateDistance = takeProfitPips * PIP_VALUE;

    // Back distance: % del activateDistance (default 50% = la mitad)
    // Esto garantiza que el trailing SL proteja ganancias
    // Ejemplo: TP=20 pips, trailing 50% = SL a 10 pips detrás = cierra con +10 pips mínimo
    const trailingPercent = trailingSLPercent ?? 50;
    const backDistance = (activateDistance * trailingPercent) / 100;

    const stepDistance = 10 * PIP_VALUE;
    const buffer = 1 * PIP_VALUE;

    if (isBuy) {
      // BUY: El SL está por debajo (venta para cerrar)
      if (currentPrice >= this.entryPrice + activateDistance) {
        const targetSL = currentPrice - backDistance - buffer;
        const currentSL = this.entrySL;

        // Solo mover el SL a favor (hacia arriba para BUY)
        if (currentSL === null || targetSL > currentSL) {
          this.entrySL = targetSL;
        }
      }
    } else {
      // SELL: El SL está por encima (compra para cerrar)
      if (currentPrice <= this.entryPrice - activateDistance) {
        const targetSL = currentPrice + backDistance + buffer;
        const currentSL = this.entrySL;

        // Solo mover el SL a favor (hacia abajo para SELL)
        if (currentSL === null || targetSL < currentSL) {
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

    // Niveles en el mercado (pendientes)
    // Esto se llenaría con datos del CSV de señales

    // Niveles disponibles para abrir
    const availableSlots = maxLevels - liveLevels.size;
    if (availableSlots <= 0) {
      return;
    }

    // Abrir nuevo nivel
    const nextLevel = this.getNextAvailableLevel(liveLevels);
    if (nextLevel !== null && nextLevel < this.totalLevels) {
      const newTrade: any = {
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
  private closeAllLevelsInProfit(currentPrice: number, avgPrice: number, closeTimestamp: Date = new Date()): any[] {
    const closingTrades: any[] = [];
    const isBuy = this.side === "BUY";
    const levels: TradeLevel[] = [];
    let totalProfit = 0;
    let totalProfitPips = 0;
    let totalLots = 0;
    let weightedPrice = 0;

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

        const closingTrade: any = {
          ...trade,
          type: "CLOSE",
          profit,
          profitPips,
        };

        closingTrades.push(closingTrade);
        this.trades.push(closingTrade);

        // Acumular para TradeDetail
        totalProfit += profit;
        totalProfitPips += profitPips;
        totalLots += trade.lotSize;
        weightedPrice += trade.price * trade.lotSize;

        levels.push({
          level: trade.level,
          openPrice: trade.price,
          closePrice: currentPrice,
          lotSize: trade.lotSize,
          profit,
          profitPips,
          openTime: trade.timestamp,
          closeTime: closeTimestamp,
        });
      }
    }

    // Crear TradeDetail
    if (this.currentEntryTime && this.currentSignalTimestamp) {
      const durationMinutes = (closeTimestamp.getTime() - this.currentEntryTime.getTime()) / 60000;

      const detail: TradeDetail = {
        signalIndex: this.currentSignalIndex,
        signalTimestamp: this.currentSignalTimestamp,
        signalSide: this.side!,
        signalPrice: this.currentSignalPrice!,
        entryPrice: totalLots > 0 ? weightedPrice / totalLots : this.entryPrice!,
        entryTime: this.currentEntryTime,
        exitPrice: currentPrice,
        exitTime: closeTimestamp,
        exitReason: "TAKE_PROFIT",
        totalLots,
        avgPrice: totalLots > 0 ? weightedPrice / totalLots : this.entryPrice!,
        totalProfit,
        totalProfitPips,
        durationMinutes,
        maxLevels: levels.length,
        levels,
      };

      this.tradeDetails.push(detail);

      // Actualizar balance
      this.currentBalance += totalProfit;
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
  private closeAllPositions(currentPrice: number, reason: "TAKE_PROFIT" | "STOP_LOSS", closeTimestamp: Date = new Date()): any[] {
    const closingTrades: any[] = [];
    const isBuy = this.side === "BUY";
    const levels: TradeLevel[] = [];
    let totalProfit = 0;
    let totalProfitPips = 0;
    let totalLots = 0;
    let weightedPrice = 0;

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

        const closingTrade: any = {
          ...trade,
          type: reason,
          profit,
          profitPips,
        };

        closingTrades.push(closingTrade);
        this.trades.push(closingTrade);

        // Acumular para TradeDetail
        totalProfit += profit;
        totalProfitPips += profitPips;
        totalLots += trade.lotSize;
        weightedPrice += trade.price * trade.lotSize;

        levels.push({
          level: trade.level,
          openPrice: trade.price,
          closePrice: currentPrice,
          lotSize: trade.lotSize,
          profit,
          profitPips,
          openTime: trade.timestamp,
          closeTime: closeTimestamp,
        });
      }
    }

    // Crear TradeDetail
    if (this.currentEntryTime && this.currentSignalTimestamp) {
      const durationMinutes = (closeTimestamp.getTime() - this.currentEntryTime.getTime()) / 60000;

      // Determinar razón de salida real
      let exitReason: "TAKE_PROFIT" | "STOP_LOSS" | "TRAILING_SL" = "STOP_LOSS";
      if (reason === "STOP_LOSS" && this.entrySL !== null) {
        exitReason = "TRAILING_SL";
      } else if (reason === "TAKE_PROFIT") {
        exitReason = "TAKE_PROFIT";
      }

      const detail: TradeDetail = {
        signalIndex: this.currentSignalIndex,
        signalTimestamp: this.currentSignalTimestamp,
        signalSide: this.side!,
        signalPrice: this.currentSignalPrice!,
        entryPrice: totalLots > 0 ? weightedPrice / totalLots : this.entryPrice!,
        entryTime: this.currentEntryTime,
        exitPrice: currentPrice,
        exitTime: closeTimestamp,
        exitReason,
        totalLots,
        avgPrice: totalLots > 0 ? weightedPrice / totalLots : this.entryPrice!,
        totalProfit,
        totalProfitPips,
        durationMinutes,
        maxLevels: levels.length,
        levels,
      };

      this.tradeDetails.push(detail);

      // Actualizar balance
      this.currentBalance += totalProfit;
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
  private updateEquityMetrics(currentPrice: number, timestamp: Date = new Date()): void {
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

    // Calcular balance actual (profit de operaciones cerradas)
    const closedProfit = this.tradeDetails.reduce((sum, d) => sum + d.totalProfit, 0);

    this.currentEquity = this.currentBalance + floatingProfit;

    // Actualizar peak
    if (this.currentEquity > this.peakEquity) {
      this.peakEquity = this.currentEquity;
    }

    // Calcular drawdown
    const dd = this.peakEquity - this.currentEquity;
    if (dd > this.maxDrawdown) {
      this.maxDrawdown = dd;
    }

    // Guardar punto en equity curve (solo cada 60 segundos para no generar demasiados puntos)
    const lastPoint = this.equityCurve[this.equityCurve.length - 1];
    const shouldAddPoint = !lastPoint ||
      (timestamp.getTime() - lastPoint.timestamp.getTime() >= 60000);

    if (shouldAddPoint && this.entryOpen) {
      this.equityCurve.push({
        timestamp,
        equity: this.currentEquity,
        balance: this.currentBalance,
        drawdown: dd,
      });
    }
  }

  /**
   * Obtiene el resultado final del backtest
   */
  getResults(): BacktestResult {
    const winningTrades = this.trades.filter((t: any) => t.type === "CLOSE" && t.profit > 0);
    const losingTrades = this.trades.filter((t: any) => t.type === "CLOSE" && t.profit < 0);
    const totalWinning = winningTrades.reduce((sum: any, t: any) => sum + t.profit, 0);
    const totalLosing = losingTrades.reduce((sum: any, t: any) => sum + Math.abs(t.profit), 0);

    // Capital inicial (del config o default 10000)
    const initialCapital = this.config.initialCapital || 10000;

    // Profit total (basado en tradeDetails para mayor precisión)
    const totalProfit = this.tradeDetails.reduce((sum, d) => sum + d.totalProfit, 0);

    // Capital final
    const finalCapital = initialCapital + totalProfit;

    // Porcentaje de retorno
    const profitPercent = (totalProfit / initialCapital) * 100;

    // Porcentaje de drawdown
    const maxDrawdownPercent = (this.maxDrawdown / initialCapital) * 100;

    // Win rate basado en tradeDetails
    const winningDetails = this.tradeDetails.filter(d => d.totalProfit > 0);
    const winRate = this.tradeDetails.length > 0
      ? (winningDetails.length / this.tradeDetails.length) * 100
      : 0;

    // Profit factor basado en tradeDetails
    const totalWinningDetail = winningDetails.reduce((sum, d) => sum + d.totalProfit, 0);
    const losingDetails = this.tradeDetails.filter(d => d.totalProfit < 0);
    const totalLosingDetail = losingDetails.reduce((sum, d) => sum + Math.abs(d.totalProfit), 0);
    const profitFactor = totalLosingDetail > 0 ? totalWinningDetail / totalLosingDetail : 0;

    // Total pips
    const totalProfitPips = this.tradeDetails.reduce((sum, d) => sum + d.totalProfitPips, 0);

    return {
      totalTrades: this.tradeDetails.length,
      totalProfit,
      totalProfitPips,
      winRate,
      maxDrawdown: this.maxDrawdown,
      profitFactor,
      // Campos nuevos de capital
      initialCapital,
      finalCapital,
      profitPercent,
      maxDrawdownPercent,
      // Detalles
      trades: this.trades,
      tradeDetails: this.tradeDetails,
      equityCurve: this.equityCurve,
    };
  }
}
