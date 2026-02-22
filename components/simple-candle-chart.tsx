"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ==================== INTERFACES ====================

interface TradeLevel {
  level: number;
  openPrice: number;
  closePrice: number;
  openTime: Date;
  closeTime: Date;
}

interface TradeDetail {
  signalTimestamp: Date;
  signalSide: "BUY" | "SELL";
  signalPrice: number;
  entryPrice: number;
  entryTime: Date;
  exitPrice: number;
  exitTime: Date;
  exitReason: "TAKE_PROFIT" | "STOP_LOSS" | "TRAILING_SL";
  totalProfit: number;
  levels: TradeLevel[];
}

interface Tick {
  timestamp: Date;
  bid: number;
  ask: number;
  spread: number;
}

interface Candle {
  time: number; // Unix timestamp en segundos del inicio de la vela
  open: number;
  high: number;
  low: number;
  close: number;
  startTime: Date;
  endTime: Date;
}

// Posición abierta simulada
interface OpenPosition {
  side: "BUY" | "SELL";
  entryPrice: number;
  entryTime: Date;
  volume: number; // lotes
  stopLoss?: number;
  takeProfit?: number;
}

// Estado de cuenta estilo MT5
interface AccountState {
  balance: number;          // Balance cerrado (solo cambia al cerrar trades)
  equity: number;           // Balance + P/L flotante
  floatingPL: number;       // P/L no realizado de la posición actual
  usedMargin: number;       // Margen usado
  freeMargin: number;       // Margen libre
  marginLevel: number;      // Nivel de margen (%)
  realizedPL: number;       // P/L ya cerrado
}

type Timeframe = "1" | "5" | "15" | "60";

// ==================== CONSTANTES ====================

const PIP_VALUE = 0.10;
const LOT_VALUE = 10; // 1 lote = $10 por pip aproximado en XAUUSD
const LEVERAGE = 100; // Apalancamiento 1:100
const COLORS = {
  background: "#1a1a2e",
  grid: "#2a2a4a",
  text: "#e0e0e0",
  candleUp: "#00c853",
  candleDown: "#ff1744",
  wickUp: "#00c853",
  wickDown: "#ff1744",
  entryLine: "#2196f3",
  tpLine: "#00e676",
  slLine: "#ff5252",
  levelColors: ["#ab47bc", "#ff9100", "#76ff03", "#e91e63"],
  crosshair: "#64b5f6",
  currentPrice: "#ffd700",
};

// ==================== COMPONENTE PRINCIPAL ====================

export default function SimpleCandleChart({
  ticks,
  trade,
  config,
  hasRealTicks = true,
}: {
  ticks: Tick[];
  trade: TradeDetail | null;
  config: {
    takeProfitPips: number;
    pipsDistance: number;
    maxLevels: number;
  };
  hasRealTicks?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Estado del timeframe y reproducción
  const [timeframe, setTimeframe] = useState<Timeframe>("5");
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [progress, setProgress] = useState(0);
  const [currentTickIndex, setCurrentTickIndex] = useState(0);

  // Estado del gráfico
  const [candles, setCandles] = useState<Candle[]>([]);
  const [allTicks, setAllTicks] = useState<Tick[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [currentTick, setCurrentTick] = useState<Tick | null>(null);

  // Estado de la posición y cuenta (estilo MT5)
  const [position, setPosition] = useState<OpenPosition | null>(null);
  const [account, setAccount] = useState<AccountState>({
    balance: 10000,      // Capital inicial
    equity: 10000,
    floatingPL: 0,
    usedMargin: 0,
    freeMargin: 10000,
    marginLevel: 0,
    realizedPL: 0,
  });

  const speedOptions = [1, 2, 5, 10, 20, 50, 100];

  // ==================== FUNCIONES AUXILIARES ====================

  // Obtener precio mid de un tick
  const getMidPrice = useCallback((tick: Tick) => {
    return (tick.bid + tick.ask) / 2;
  }, []);

  // Obtener precio de ejecución (bid para sell, ask para buy)
  const getExecutionPrice = useCallback((tick: Tick, side: "BUY" | "SELL") => {
    return side === "BUY" ? tick.ask : tick.bid;
  }, []);

  // Obtener timestamp de inicio de vela para un tick
  const getCandleStartTime = useCallback((tick: Tick, tf: Timeframe): Date => {
    const intervalMs = parseInt(tf) * 60 * 1000;
    const tickTime = new Date(tick.timestamp).getTime();
    return new Date(Math.floor(tickTime / intervalMs) * intervalMs);
  }, []);

  // Calcular P/L flotante
  const calculateFloatingPL = useCallback((
    pos: OpenPosition | null,
    currentTickPrice: number
  ): number => {
    if (!pos) return 0;

    const priceDiff = pos.side === "BUY"
      ? currentTickPrice - pos.entryPrice
      : pos.entryPrice - currentTickPrice;

    const pips = priceDiff / PIP_VALUE;
    return pips * LOT_VALUE * pos.volume;
  }, []);

  // Calcular margen requerido
  const calculateRequiredMargin = useCallback((pos: OpenPosition | null): number => {
    if (!pos) return 0;
    // Margen = (Volumen * Precio) / Apalancamiento
    return (pos.volume * pos.entryPrice * 100) / LEVERAGE;
  }, []);

  // ==================== CARGA DE TICKS ====================

  useEffect(() => {
    if (!trade) {
      setAllTicks([]);
      setCandles([]);
      setPosition(null);
      setAccount({
        balance: 10000,
        equity: 10000,
        floatingPL: 0,
        usedMargin: 0,
        freeMargin: 10000,
        marginLevel: 0,
        realizedPL: 0,
      });
      return;
    }

    if (ticks.length > 0) {
      setAllTicks(ticks);
    } else {
      const syntheticTicks = generateSyntheticTicks(
        trade.entryPrice,
        trade.exitPrice,
        new Date(trade.entryTime),
        new Date(trade.exitTime)
      );
      setAllTicks(syntheticTicks);
    }

    // Reset
    setCandles([]);
    setCurrentTickIndex(0);
    setProgress(0);
    setIsPlaying(false);
    setCurrentPrice(null);
    setCurrentTick(null);
    setPosition(null);
    setAccount({
      balance: 10000,
      equity: 10000,
      floatingPL: 0,
      usedMargin: 0,
      freeMargin: 10000,
      marginLevel: 0,
      realizedPL: 0,
    });
  }, [trade, ticks]);

  // Generar ticks sintéticos realistas
  const generateSyntheticTicks = useCallback((
    entryPrice: number,
    exitPrice: number,
    entryTime: Date,
    exitTime: Date
  ): Tick[] => {
    const durationMs = exitTime.getTime() - entryTime.getTime();
    // En XAUUSD, los ticks llegan aproximadamente cada 100-500ms en mercado activo
    const avgTickInterval = 300; // 300ms promedio
    const numTicks = Math.max(100, Math.ceil(durationMs / avgTickInterval));
    const result: Tick[] = [];
    const priceDiff = exitPrice - entryPrice;
    const baseSpread = 0.02;

    let currentPrice = entryPrice;
    let lastTime = entryTime.getTime();

    for (let i = 0; i < numTicks; i++) {
      const progress = i / (numTicks - 1);
      const targetPrice = entryPrice + priceDiff * progress;

      // Random walk con tendencia hacia el precio objetivo
      const trend = (targetPrice - currentPrice) * 0.1;
      const noise = (Math.random() - 0.5) * 0.05;
      currentPrice += trend + noise;

      // Spread variable
      const spread = baseSpread + (Math.random() - 0.5) * 0.01;

      // Timestamp con intervalo variable
      const tickInterval = avgTickInterval + (Math.random() - 0.5) * 200;
      lastTime += tickInterval;

      result.push({
        timestamp: new Date(lastTime),
        bid: currentPrice,
        ask: currentPrice + spread,
        spread,
      });
    }

    return result;
  }, []);

  // ==================== PROCESAMIENTO DE TICKS (ESTILO MT5) ====================

  // Procesar un tick y actualizar velas
  const processTick = useCallback((
    tick: Tick,
    currentCandles: Candle[],
    tf: Timeframe
  ): Candle[] => {
    const price = getMidPrice(tick);
    const candleStart = getCandleStartTime(tick, tf);
    const intervalMs = parseInt(tf) * 60 * 1000;
    const candleEnd = new Date(candleStart.getTime() + intervalMs);

    if (currentCandles.length === 0) {
      // Primer tick: crear primera vela
      return [{
        time: Math.floor(candleStart.getTime() / 1000),
        open: price,
        high: price,
        low: price,
        close: price,
        startTime: candleStart,
        endTime: candleEnd,
      }];
    }

    const lastCandle = currentCandles[currentCandles.length - 1];

    // Verificar si el tick pertenece a la vela actual
    if (lastCandle.startTime.getTime() === candleStart.getTime()) {
      // Tick dentro de la vela actual: actualizar OHLC
      return [
        ...currentCandles.slice(0, -1),
        {
          ...lastCandle,
          high: Math.max(lastCandle.high, price),
          low: Math.min(lastCandle.low, price),
          close: price, // Close siempre es el último precio
        },
      ];
    } else {
      // Tick de una nueva vela: crear nueva
      return [
        ...currentCandles,
        {
          time: Math.floor(candleStart.getTime() / 1000),
          open: price,
          high: price,
          low: price,
          close: price,
          startTime: candleStart,
          endTime: candleEnd,
        },
      ];
    }
  }, [getMidPrice, getCandleStartTime]);

  // ==================== SIMULACIÓN DE TRADING ====================

  // Abrir posición cuando llega el momento de entrada
  useEffect(() => {
    if (!trade || !currentTick || position) return;

    const tickTime = new Date(currentTick.timestamp).getTime();
    const entryTime = new Date(trade.entryTime).getTime();

    // Si llegamos al momento de entrada, abrir posición
    if (tickTime >= entryTime && !position) {
      const entryPrice = getExecutionPrice(currentTick, trade.signalSide);

      // Calcular volúmen total basado en los niveles
      const totalVolume = config.maxLevels * 0.1; // 0.1 lote por nivel

      setPosition({
        side: trade.signalSide,
        entryPrice,
        entryTime: new Date(currentTick.timestamp),
        volume: totalVolume,
        stopLoss: trade.signalSide === "BUY"
          ? entryPrice - 50 * PIP_VALUE // SL 50 pips
          : entryPrice + 50 * PIP_VALUE,
        takeProfit: trade.signalSide === "BUY"
          ? entryPrice + config.takeProfitPips * PIP_VALUE
          : entryPrice - config.takeProfitPips * PIP_VALUE,
      });
    }
  }, [currentTick, trade, position, config, getExecutionPrice]);

  // Cerrar posición cuando llega el momento de salida
  useEffect(() => {
    if (!trade || !currentTick || !position) return;

    const tickTime = new Date(currentTick.timestamp).getTime();
    const exitTime = new Date(trade.exitTime).getTime();

    if (tickTime >= exitTime && position) {
      const exitPrice = getExecutionPrice(currentTick, position.side === "BUY" ? "SELL" : "BUY");

      // Calcular P/L realizado
      const priceDiff = position.side === "BUY"
        ? exitPrice - position.entryPrice
        : position.entryPrice - exitPrice;

      const pips = priceDiff / PIP_VALUE;
      const realizedPL = pips * LOT_VALUE * position.volume;

      setAccount(prev => ({
        ...prev,
        balance: prev.balance + realizedPL,
        equity: prev.balance + realizedPL,
        floatingPL: 0,
        usedMargin: 0,
        freeMargin: prev.balance + realizedPL,
        marginLevel: 0,
        realizedPL: prev.realizedPL + realizedPL,
      }));

      setPosition(null);
    }
  }, [currentTick, trade, position, getExecutionPrice]);

  // Actualizar P/L flotante en cada tick
  useEffect(() => {
    if (!position || currentPrice === null) return;

    const floatingPL = calculateFloatingPL(position, currentPrice);
    const usedMargin = calculateRequiredMargin(position);

    setAccount(prev => {
      const equity = prev.balance + floatingPL;
      const freeMargin = equity - usedMargin;
      const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : 0;

      return {
        ...prev,
        equity,
        floatingPL,
        usedMargin,
        freeMargin,
        marginLevel,
      };
    });
  }, [currentPrice, position, calculateFloatingPL, calculateRequiredMargin]);

  // ==================== REPRODUCCIÓN ANIMADA ====================

  useEffect(() => {
    if (!isPlaying || allTicks.length === 0) return;

    const intervalMs = Math.max(5, 100 / speed);
    let idx = currentTickIndex;

    const interval = setInterval(() => {
      if (idx >= allTicks.length) {
        setIsPlaying(false);
        clearInterval(interval);
        return;
      }

      const tick = allTicks[idx];
      const price = getMidPrice(tick);

      // Actualizar velas
      setCandles(prev => processTick(tick, prev, timeframe));

      // Actualizar estado actual
      setCurrentPrice(price);
      setCurrentTick(tick);
      setProgress(((idx + 1) / allTicks.length) * 100);
      setCurrentTickIndex(idx);
      idx++;
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, speed, allTicks, currentTickIndex, timeframe, getMidPrice, processTick]);

  // ==================== CONTROLES ====================

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentTickIndex(0);
    setProgress(0);
    setCurrentPrice(null);
    setCurrentTick(null);
    setCandles([]);
    setPosition(null);
    setAccount({
      balance: 10000,
      equity: 10000,
      floatingPL: 0,
      usedMargin: 0,
      freeMargin: 10000,
      marginLevel: 0,
      realizedPL: 0,
    });
  }, []);

  // ==================== RENDERIZADO DEL GRÁFICO ====================

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Configurar tamaño
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 400 * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = "400px";
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = 400;
    const padding = { top: 20, right: 70, bottom: 30, left: 10 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Limpiar
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    // Si no hay velas
    if (candles.length === 0) {
      ctx.fillStyle = COLORS.text;
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Presiona Play para iniciar la simulación", width / 2, height / 2);
      return;
    }

    // Calcular rango de precios
    let minPrice = Math.min(...candles.map(c => c.low));
    let maxPrice = Math.max(...candles.map(c => c.high));

    // Incluir niveles del trade
    if (trade) {
      minPrice = Math.min(minPrice, trade.entryPrice, trade.exitPrice);
      maxPrice = Math.max(maxPrice, trade.entryPrice, trade.exitPrice);

      const isBuy = trade.signalSide === "BUY";
      const tpPrice = isBuy
        ? trade.entryPrice + config.takeProfitPips * PIP_VALUE
        : trade.entryPrice - config.takeProfitPips * PIP_VALUE;
      minPrice = Math.min(minPrice, tpPrice);
      maxPrice = Math.max(maxPrice, tpPrice);

      if (position?.stopLoss) {
        minPrice = Math.min(minPrice, position.stopLoss);
        maxPrice = Math.max(maxPrice, position.stopLoss);
      }
    }

    // Margen
    const priceRange = maxPrice - minPrice || 1;
    minPrice -= priceRange * 0.08;
    maxPrice += priceRange * 0.08;

    const priceToY = (price: number) =>
      padding.top + chartHeight - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight;

    // Grid horizontal
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;
    const priceStep = (maxPrice - minPrice) / 6;
    for (let i = 0; i <= 6; i++) {
      const price = minPrice + priceStep * i;
      const y = priceToY(price);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      ctx.fillStyle = COLORS.text;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(price.toFixed(2), width - padding.right + 5, y + 4);
    }

    // Líneas de niveles del trade
    if (trade && candles.length > 0) {
      const isBuy = trade.signalSide === "BUY";

      // Entry
      const entryY = priceToY(trade.entryPrice);
      ctx.strokeStyle = COLORS.entryLine;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding.left, entryY);
      ctx.lineTo(width - padding.right, entryY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLORS.entryLine;
      ctx.font = "bold 10px sans-serif";
      ctx.fillText(`Entry: ${trade.entryPrice.toFixed(2)}`, padding.left + 5, entryY - 5);

      // TP
      const tpPrice = isBuy
        ? trade.entryPrice + config.takeProfitPips * PIP_VALUE
        : trade.entryPrice - config.takeProfitPips * PIP_VALUE;
      const tpY = priceToY(tpPrice);
      ctx.strokeStyle = COLORS.tpLine;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padding.left, tpY);
      ctx.lineTo(width - padding.right, tpY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLORS.tpLine;
      ctx.fillText(`TP: ${tpPrice.toFixed(2)}`, padding.left + 5, tpY - 5);

      // SL (si hay posición)
      if (position?.stopLoss) {
        const slY = priceToY(position.stopLoss);
        ctx.strokeStyle = COLORS.slLine;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(padding.left, slY);
        ctx.lineTo(width - padding.right, slY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = COLORS.slLine;
        ctx.fillText(`SL: ${position.stopLoss.toFixed(2)}`, padding.left + 5, slY + 12);
      }
    }

    // Dibujar velas
    const candleWidth = Math.max(3, Math.min(25, chartWidth / Math.max(candles.length, 1) * 0.8));
    const bodyWidth = candleWidth * 0.7;

    candles.forEach((candle, i) => {
      const x = padding.left + (i + 0.5) * (chartWidth / candles.length);
      const isUp = candle.close >= candle.open;

      // Mecha
      ctx.strokeStyle = isUp ? COLORS.wickUp : COLORS.wickDown;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, priceToY(candle.high));
      ctx.lineTo(x, priceToY(candle.low));
      ctx.stroke();

      // Cuerpo
      const bodyTop = priceToY(Math.max(candle.open, candle.close));
      const bodyBottom = priceToY(Math.min(candle.open, candle.close));
      const bodyHeight = Math.max(1, bodyBottom - bodyTop);

      ctx.fillStyle = isUp ? COLORS.candleUp : COLORS.candleDown;
      ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);

      // Indicador en vela actual (última)
      if (i === candles.length - 1) {
        ctx.strokeStyle = COLORS.currentPrice;
        ctx.lineWidth = 2;
        ctx.strokeRect(x - bodyWidth / 2 - 2, bodyTop - 2, bodyWidth + 4, bodyHeight + 4);
      }
    });

    // Flecha de entrada
    if (trade && candles.length > 0) {
      const isBuy = trade.signalSide === "BUY";
      const x = padding.left + 0.5 * (chartWidth / candles.length);
      const y = priceToY(trade.entryPrice);

      ctx.fillStyle = isBuy ? COLORS.candleUp : COLORS.candleDown;
      ctx.beginPath();

      if (isBuy) {
        ctx.moveTo(x, y + 12);
        ctx.lineTo(x - 8, y + 22);
        ctx.lineTo(x + 8, y + 22);
      } else {
        ctx.moveTo(x, y - 12);
        ctx.lineTo(x - 8, y - 22);
        ctx.lineTo(x + 8, y - 22);
      }
      ctx.closePath();
      ctx.fill();

      ctx.font = "bold 10px sans-serif";
      ctx.fillText(isBuy ? "BUY" : "SELL", x + 12, isBuy ? y + 18 : y - 15);
    }

    // Línea de precio actual
    if (currentPrice !== null && candles.length > 0) {
      const currentY = priceToY(currentPrice);
      ctx.strokeStyle = COLORS.currentPrice;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padding.left, currentY);
      ctx.lineTo(width - padding.right, currentY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = COLORS.currentPrice;
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "right";
      ctx.fillText(currentPrice.toFixed(2), width - 5, currentY - 5);
    }

  }, [candles, trade, config, currentPrice, position]);

  // Resize
  useEffect(() => {
    const handleResize = () => setCandles(c => [...c]);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ==================== RENDER ====================

  if (!trade) {
    return (
      <div className="text-center py-12 text-gray-400">
        Selecciona un trade para ver el gráfico
      </div>
    );
  }

  const tfLabel = { "1": "M1", "5": "M5", "15": "M15", "60": "H1" }[timeframe];

  return (
    <div className="space-y-4">
      {/* Panel de Cuenta estilo MT5 */}
      <div className="bg-slate-800 rounded-lg p-4">
        <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Terminal - Cuenta</div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-sm">
          <div>
            <div className="text-gray-400 text-xs">Balance</div>
            <div className="font-mono text-white">{account.balance.toFixed(2)} €</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Equity</div>
            <div className={`font-mono ${account.equity >= account.balance ? "text-green-400" : "text-red-400"}`}>
              {account.equity.toFixed(2)} €
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Floating P/L</div>
            <div className={`font-mono ${account.floatingPL >= 0 ? "text-green-400" : "text-red-400"}`}>
              {account.floatingPL >= 0 ? "+" : ""}{account.floatingPL.toFixed(2)} €
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Margin</div>
            <div className="font-mono text-white">{account.usedMargin.toFixed(2)} €</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Free Margin</div>
            <div className="font-mono text-white">{account.freeMargin.toFixed(2)} €</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Margin Level</div>
            <div className={`font-mono ${account.marginLevel > 200 ? "text-green-400" : account.marginLevel > 100 ? "text-yellow-400" : "text-red-400"}`}>
              {account.marginLevel > 0 ? account.marginLevel.toFixed(0) + "%" : "-"}
            </div>
          </div>
        </div>

        {/* Posición actual */}
        {position && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Posición Abierta</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <div className="text-gray-400 text-xs">Symbol</div>
                <div className="font-mono text-white">XAUUSD</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Side</div>
                <div className={`font-bold ${position.side === "BUY" ? "text-green-400" : "text-red-400"}`}>
                  {position.side}
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Volume</div>
                <div className="font-mono text-white">{position.volume.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Entry Price</div>
                <div className="font-mono text-white">{position.entryPrice.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Current P/L</div>
                <div className={`font-bold ${account.floatingPL >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {account.floatingPL >= 0 ? "+" : ""}{account.floatingPL.toFixed(2)} €
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controles del gráfico */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-800 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">TF:</span>
          <select
            value={timeframe}
            onChange={(e) => { setTimeframe(e.target.value as Timeframe); handleReset(); }}
            className="px-2 py-1 bg-slate-700 rounded text-sm border-0 text-white"
          >
            <option value="1">M1</option>
            <option value="5">M5</option>
            <option value="15">M15</option>
            <option value="60">H1</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Speed:</span>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="px-2 py-1 bg-slate-700 rounded text-sm border-0 text-white"
          >
            {speedOptions.map(s => <option key={s} value={s}>{s}x</option>)}
          </select>
        </div>

        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`px-4 py-1.5 rounded font-medium text-white ${
            isPlaying ? "bg-amber-600 hover:bg-amber-700" : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isPlaying ? "⏸ Pausar" : "▶ Play"}
        </button>

        <button
          onClick={handleReset}
          className="px-4 py-1.5 bg-slate-600 hover:bg-slate-500 rounded font-medium text-white"
        >
          ⟲ Reset
        </button>

        {currentPrice && (
          <div className="ml-auto text-sm">
            <span className="text-gray-400">Precio: </span>
            <span className="font-mono text-yellow-400">{currentPrice.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Progreso */}
      <div className="space-y-1">
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{allTicks.length.toLocaleString()} ticks</span>
          <span>{currentTickIndex.toLocaleString()} procesados</span>
          <span>TF: {tfLabel} ({parseInt(timeframe) * 60}s por vela)</span>
        </div>
      </div>

      {/* Canvas del gráfico */}
      <div ref={containerRef} className="w-full rounded-lg overflow-hidden bg-slate-900">
        <canvas ref={canvasRef} />
      </div>

      {/* Info del trade */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 bg-slate-800 rounded-lg text-sm">
        <div>
          <span className="text-gray-400 text-xs">Side</span>
          <div className={`font-bold ${trade.signalSide === "BUY" ? "text-green-400" : "text-red-400"}`}>
            {trade.signalSide}
          </div>
        </div>
        <div>
          <span className="text-gray-400 text-xs">Entrada</span>
          <div className="font-mono text-white">{trade.entryPrice.toFixed(2)}</div>
        </div>
        <div>
          <span className="text-gray-400 text-xs">Salida</span>
          <div className="font-mono text-white">{trade.exitPrice.toFixed(2)}</div>
        </div>
        <div>
          <span className="text-gray-400 text-xs">Profit</span>
          <div className={`font-bold ${trade.totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
            {trade.totalProfit >= 0 ? "+" : ""}{trade.totalProfit.toFixed(2)}€
          </div>
        </div>
        <div>
          <span className="text-gray-400 text-xs">Cierre</span>
          <div className={`${
            trade.exitReason === "TAKE_PROFIT" ? "text-green-400" :
            trade.exitReason === "TRAILING_SL" ? "text-yellow-400" : "text-red-400"
          }`}>
            {trade.exitReason === "TAKE_PROFIT" ? "TP" : trade.exitReason === "TRAILING_SL" ? "Trail" : "SL"}
          </div>
        </div>
      </div>

      {!hasRealTicks && ticks.length === 0 && (
        <p className="text-yellow-400 text-sm text-center py-2">
          Sin ticks reales - simulando con ticks sintéticos
        </p>
      )}
    </div>
  );
}
