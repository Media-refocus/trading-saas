"use client";

import { useMemo, useState } from "react";
import {
  EnhancedCandleViewer,
  useDemoCandles,
} from "@/components/backtester";
import type { OHLC } from "@/lib/candle-compression";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Zap } from "lucide-react";

// Generador de números pseudo-aleatorios con semilla (determinístico para SSR)
function seededRandom(seed: number): () => number {
  return function () {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

export default function DemoViewerPage() {
  const [candleCount, setCandleCount] = useState(5000);
  const [refreshKey, setRefreshKey] = useState(0);

  // Generate demo candles
  const candles = useDemoCandles(candleCount);

  // Generate some demo trades (determinístico para evitar hydration mismatch)
  const trades = useMemo(() => {
    if (candles.length === 0) return [];

    // Semilla fija para consistencia SSR
    const random = seededRandom(12345);

    const result = [];
    let i = 100;
    let tradeId = 1;

    while (i < candles.length - 50) {
      const entryCandle = candles[i];
      const holdTime = 20 + Math.floor(random() * 60);
      const exitCandle = candles[Math.min(i + holdTime, candles.length - 1)];

      const isBuy = random() > 0.4;
      const pipValue = 0.1;
      const pipsMove = (random() - 0.4) * 30; // Slight bullish bias
      const exitPrice = isBuy
        ? entryCandle.close + pipsMove * pipValue
        : entryCandle.close - pipsMove * pipValue;

      const profit = isBuy
        ? (exitPrice - entryCandle.close) * 100
        : (entryCandle.close - exitPrice) * 100;

      result.push({
        id: `trade-${tradeId++}`,
        entryTime: new Date(entryCandle.time * 1000),
        exitTime: new Date(exitCandle.time * 1000),
        entryPrice: entryCandle.close,
        exitPrice,
        side: isBuy ? ("BUY" as const) : ("SELL" as const),
        profit,
        exitReason:
          profit > 0
            ? ("TAKE_PROFIT" as const)
            : profit < -50
              ? ("STOP_LOSS" as const)
              : ("TRAILING_SL" as const),
      });

      i += holdTime + 10 + Math.floor(random() * 30);
    }

    return result;
  }, [candles]);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Demo: Visor de Velas Mejorado</h1>
          <p className="text-muted-foreground">
            Prueba del virtual scrolling con {candleCount.toLocaleString()} velas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={candleCount}
            onChange={(e) => setCandleCount(Number(e.target.value))}
            className="px-3 py-2 rounded border bg-background"
          >
            <option value={1000}>1,000 velas</option>
            <option value={5000}>5,000 velas</option>
            <option value={10000}>10,000 velas</option>
            <option value={20000}>20,000 velas</option>
            <option value={50000}>50,000 velas</option>
          </select>
          <Button onClick={handleRefresh} variant="outline" size="icon">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card>
          <CardHeader className="p-3">
            <CardTitle className="text-xs text-muted-foreground">
              Total Velas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold font-mono">
              {candles.length.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3">
            <CardTitle className="text-xs text-muted-foreground">
              Trades
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold font-mono">{trades.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3">
            <CardTitle className="text-xs text-muted-foreground">
              Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold font-mono text-green-500">
              {trades.length > 0
                ? (
                    (trades.filter((t) => t.profit > 0).length / trades.length) *
                    100
                  ).toFixed(1)
                : 0}
              %
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3">
            <CardTitle className="text-xs text-muted-foreground">
              Profit Total
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div
              className={`text-xl font-bold font-mono ${
                trades.reduce((sum, t) => sum + t.profit, 0) >= 0
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            >
              {trades.reduce((sum, t) => sum + t.profit, 0).toFixed(0)}€
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Candle Viewer */}
      <div className="border rounded-lg overflow-hidden">
        <EnhancedCandleViewer
          key={refreshKey}
          candles={candles}
          trades={trades}
          isLoading={false}
        />
      </div>

      {/* Performance tips */}
      <Card>
        <CardHeader className="p-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            Tips de Rendimiento
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 text-xs text-muted-foreground space-y-1">
          <p>• Usa la rueda del ratón para scroll horizontal</p>
          <p>• Los botones de zoom ajustan el nivel de detalle</p>
          <p>• Cambia entre modos (Detalle/Operativa/Overview) para ver más o menos velas</p>
          <p>• El playback reproduce las velas a diferentes velocidades (hasta x50)</p>
          <p>• La compresión automática reduce velas cuando hay muchas</p>
        </CardContent>
      </Card>
    </div>
  );
}
