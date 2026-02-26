"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Zap,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";

// ==================== TYPES ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Position = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BotStatus = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Signal = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Trade = any;

// ==================== COMPONENTS ====================

function StatusIndicator({ isOnline, status }: { isOnline: boolean; status: string }) {
  if (status === "PAUSED") {
    return (
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-amber-600 font-medium">Pausado</span>
      </div>
    );
  }

  if (isOnline) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
        <span className="text-green-600 font-medium">Online</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full bg-red-500" />
      <span className="text-red-600 font-medium">Offline</span>
    </div>
  );
}

function PositionCard({ position }: { position: Position }) {
  const isBuy = position.side === "BUY";
  const pnl = position.unrealizedPL || 0;
  const pnlPips = position.unrealizedPips || 0;
  const isProfit = pnl >= 0;

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded ${isBuy ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
          {isBuy ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{position.symbol}</span>
            <Badge variant="outline">L{position.level}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            #{position.mt5Ticket} · {position.lotSize} lot
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className={`font-semibold ${isProfit ? "text-green-600" : "text-red-600"}`}>
          {isProfit ? "+" : ""}{pnl.toFixed(2)}
        </p>
        <p className="text-sm text-muted-foreground">
          {isProfit ? "+" : ""}{pnlPips.toFixed(1)} pips
        </p>
      </div>
    </div>
  );
}

function SignalRow({ signal }: { signal: Signal }) {
  const isBuy = signal.side === "BUY";

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded ${isBuy ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
          {isBuy ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        </div>
        <div>
          <p className="font-medium">
            {signal.isCloseSignal ? "🔒 CERRAR RANGO" : `${signal.side} ${signal.symbol}`}
          </p>
          <p className="text-xs text-muted-foreground truncate max-w-xs">
            {signal.messageText.slice(0, 50)}...
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge
          variant={
            signal.status === "EXECUTED"
              ? "default"
              : signal.status === "FAILED"
              ? "destructive"
              : "secondary"
          }
        >
          {signal.status}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {new Date(signal.receivedAt).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const isBuy = trade.side === "BUY";
  const isClosed = trade.status === "CLOSED";
  const pnl = trade.profitMoney || 0;
  const isProfit = pnl >= 0;

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <div
          className={`p-1.5 rounded ${
            isBuy ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
          }`}
        >
          {isBuy ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        </div>
        <div>
          <p className="font-medium">
            {trade.symbol} · L{trade.level}
          </p>
          <p className="text-xs text-muted-foreground">
            {isClosed ? trade.closeReason : "Abierto"} · #{trade.mt5Ticket}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          {isClosed ? (
            <>
              <p className={`font-semibold ${isProfit ? "text-green-600" : "text-red-600"}`}>
                {isProfit ? "+" : ""}${pnl.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                {trade.profitPips?.toFixed(1)} pips
              </p>
            </>
          ) : (
            <Badge variant="outline">Abierto</Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(isClosed ? trade.closedAt! : trade.openedAt).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// ==================== MAIN PAGE ====================

export default function BotMonitorPage() {
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 segundos
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = trpc.bot.getStatus.useQuery(
    undefined,
    {
      refetchInterval: refreshInterval,
    }
  );

  const { data: signalsData, isLoading: signalsLoading } = trpc.bot.getSignalHistory.useQuery({
    limit: 10,
  });

  const { data: tradesData, isLoading: tradesLoading } = trpc.bot.getTradeHistory.useQuery({
    limit: 10,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchStatus()]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const isLoading = statusLoading || signalsLoading || tradesLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/bot">
            <Button variant="ghost" size="sm">
              ← Config
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Monitor en vivo</h1>
            <p className="text-muted-foreground">
              Estado del bot en tiempo real
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Auto-refresh: {refreshInterval / 1000}s
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <StatusIndicator
              isOnline={status?.isOnline || false}
              status={status?.status || "OFFLINE"}
            />
            <p className="text-sm text-muted-foreground mt-2">
              {status?.lastHeartbeat?.mt5Connected ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" /> MT5 conectado
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" /> MT5 desconectado
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {status?.lastHeartbeat?.telegramConnected ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" /> Telegram conectado
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" /> Telegram desconectado
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold">
                {status?.positions.length || 0}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Posiciones abiertas</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <span className="text-lg font-semibold">
                {status?.lastHeartbeat?.uptimeSeconds
                  ? formatUptime(status.lastHeartbeat.uptimeSeconds)
                  : "-"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Uptime</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <span className="text-xs bg-muted px-2 py-1 rounded">
                v{status?.lastHeartbeat?.version || "?"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Versión del bot</p>
            <p className="text-xs text-muted-foreground mt-1">
              Último:{" "}
              {status?.lastHeartbeat
                ? new Date(status.lastHeartbeat.timestamp).toLocaleTimeString()
                : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Positions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Posiciones Actuales
            </CardTitle>
            <CardDescription>
              Posiciones abiertas en MetaTrader 5
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !status?.positions || status.positions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No hay posiciones abiertas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {status.positions.map((position) => (
                  <PositionCard key={position.id} position={position} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Signals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Señales Recientes
            </CardTitle>
            <CardDescription>
              Señales recibidas de Telegram
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !signalsData?.signals || signalsData.signals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No hay señales recientes</p>
              </div>
            ) : (
              <div>
                {signalsData.signals.map((signal) => (
                  <SignalRow key={signal.id} signal={signal} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trade History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Historial de Trades
          </CardTitle>
          <CardDescription>
            Últimas operaciones ejecutadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !tradesData?.trades || tradesData.trades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No hay trades en el historial</p>
            </div>
          ) : (
            <div>
              {tradesData.trades.map((trade) => (
                <TradeRow key={trade.id} trade={trade} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
