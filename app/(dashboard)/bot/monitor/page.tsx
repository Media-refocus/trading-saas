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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  Download,
  DollarSign,
  Target,
  BarChart3,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

// ==================== TYPES ====================

type Position = any;
type BotStatus = any;
type Signal = any;
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
    <div className="flex items-center justify-between py-3 border-b last:border-0 gap-2">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`p-1.5 rounded shrink-0 ${isBuy ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
          {isBuy ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm">
            {signal.isCloseSignal ? "🔒 CERRAR RANGO" : `${signal.side} ${signal.symbol}`}
          </p>
          <p className="text-[13px] text-muted-foreground break-words line-clamp-2">
            {signal.messageText.length > 80 ? signal.messageText.slice(0, 80) + '...' : signal.messageText}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
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
          <p className="font-medium text-sm">
            {trade.symbol} · L{trade.level}
          </p>
          <p className="text-[13px] text-muted-foreground">
            {isClosed ? trade.closeReason : "Abierto"} · #{trade.mt5Ticket}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          {isClosed ? (
            <>
              <p className={`font-semibold text-sm ${isProfit ? "text-green-600" : "text-red-600"}`}>
                {isProfit ? "+" : ""}${pnl.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">
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

  const { data: stats, isLoading: statsLoading } = trpc.bot.getStats.useQuery();

  const exportCsv = trpc.bot.exportTradesCsv.useQuery(undefined, { enabled: false });

  // Kill switch mutation
  const killSwitchMutation = trpc.bot.killSwitch.useMutation({
    onSuccess: () => {
      refetchStatus();
    },
  });

  const handleExport = async () => {
    const result = await exportCsv.refetch();
    if (result.data?.csv) {
      const blob = new Blob([result.data.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchStatus()]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const isLoading = statusLoading || signalsLoading || tradesLoading || statsLoading;

  return (
    <div className="space-y-6 pb-8 md:pb-0">
      {/* Header */}
      <div className="flex flex-col gap-4">
        {/* Title row */}
        <div className="flex items-center gap-4">
          <Link href="/bot">
            <Button variant="ghost" size="sm" className="min-h-[44px]">
              ← Config
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Monitor en vivo</h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Estado del bot en tiempo real
            </p>
          </div>
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Kill Switch - normal button, not full-width */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="gap-2 min-h-[44px]"
                disabled={killSwitchMutation.isPending}
              >
                <AlertTriangle className="h-4 w-4" />
                Kill Switch
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  ¿Activar Kill Switch?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    <strong>Esto cerrará TODAS las posiciones abiertas inmediatamente a precio de mercado.</strong>
                  </p>
                  <p>
                    Esta acción es irreversible y el bot se pausará automáticamente.
                  </p>
                  <p className="text-red-600 font-medium">
                    Solo úsalo en caso de emergencia.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => killSwitchMutation.mutate()}
                >
                  {killSwitchMutation.isPending ? "Ejecutando..." : "Sí, cerrar todo"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Secondary controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Clock className="h-4 w-4" />
              Auto: {refreshInterval / 1000}s
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="gap-2 min-h-[44px]"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="min-h-[44px] min-w-[44px]"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Performance Stats - 2x2 + 1 full-width on mobile, 5 cols on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <span className={`text-xl md:text-2xl font-bold ${(stats?.total.pnl || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                {(stats?.total.pnl || 0) >= 0 ? "+" : ""}{(stats?.total.pnl || 0).toFixed(2)}
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground mt-1">P&L Total</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              <span className="text-xl md:text-2xl font-bold">
                {stats?.total.winRate.toFixed(1) || 0}%
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground mt-1">Win Rate</p>
            <p className="text-[13px] text-muted-foreground">
              {stats?.total.wins || 0}W / {stats?.total.losses || 0}L
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              <span className="text-xl md:text-2xl font-bold">
                {stats?.total.trades || 0}
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground mt-1">Total Trades</p>
            <p className="text-[13px] text-muted-foreground">
              PF: {stats?.total.profitFactor || 0}
            </p>
          </CardContent>
        </Card>

        {/* Hoy card merged with Posiciones on mobile */}
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center justify-between md:flex-col md:items-start md:gap-0">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-500" />
                <span className={`text-lg md:text-xl font-bold ${(stats?.today.pnl || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {(stats?.today.pnl || 0) >= 0 ? "+" : ""}{(stats?.today.pnl || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground md:hidden">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="font-bold">{status?.positions.length || 0}</span>
                <span className="text-sm">pos</span>
              </div>
            </div>
            <p className="text-[13px] text-muted-foreground mt-1">Hoy</p>
            <p className="text-[13px] text-muted-foreground">
              {stats?.today.trades || 0} trades
            </p>
          </CardContent>
        </Card>

        {/* Posiciones - desktop only, hidden on mobile since merged above */}
        <Card className="hidden md:block">
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <span className="text-xl md:text-2xl font-bold">
                {status?.positions.length || 0}
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground mt-1">Posiciones</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-3">
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
