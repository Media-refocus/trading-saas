"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Search,
  TrendingUp,
  Users,
  Download,
  Heart,
  Star,
  ChevronRight,
  ArrowUpDown,
  Clock,
  Target,
  Shield,
  Copy,
  Loader2,
} from "lucide-react";

interface PublishedStrategy {
  id: string;
  name: string;
  description: string | null;
  authorId: string;
  author: { id: string; name: string | null; email: string };
  totalTrades: number;
  totalProfit: number;
  winRate: number;
  maxDrawdown: number;
  profitFactor: number;
  likesCount: number;
  forksCount: number;
  downloadsCount: number;
  tags: string[] | null;
  publishedAt: Date;
  strategyName: string;
  lotajeBase: number;
  maxLevels: number;
  takeProfitPips: number;
  useStopLoss: boolean;
}

type SortOption = "recent" | "popular" | "profitable" | "downloads";

export default function OperativasPage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [selectedStrategy, setSelectedStrategy] = useState<PublishedStrategy | null>(null);
  const [forking, setForking] = useState(false);

  // Obtener operativas
  const { data, isLoading, refetch } = trpc.marketplace.list.useQuery({
    search: search || undefined,
    sortBy,
    limit: 20,
  });

  // Obtener top strategies
  const { data: topStrategies } = trpc.marketplace.getTop.useQuery({
    period: "month",
    limit: 5,
  });

  // Fork mutation
  const forkMutation = trpc.marketplace.fork.useMutation({
    onSuccess: () => {
      setForking(false);
      setSelectedStrategy(null);
      // TODO: Mostrar toast de éxito
    },
    onError: (error) => {
      setForking(false);
      console.error("Error al hacer fork:", error);
    },
  });

  // Like mutation
  const likeMutation = trpc.marketplace.like.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleFork = async (strategyId: string) => {
    setForking(true);
    forkMutation.mutate({ publishedId: strategyId });
  };

  const handleLike = (strategyId: string) => {
    likeMutation.mutate({ id: strategyId });
  };

  const formatProfit = (value: number) => {
    const prefix = value >= 0 ? "+" : "";
    return `${prefix}$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(date));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Marketplace de Operativas</h1>
        <p className="text-muted-foreground mt-2">
          Descubre y usa estrategias probadas por otros traders
        </p>
      </div>

      {/* Top Strategies Banner */}
      {topStrategies && topStrategies.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Top del Mes
            </CardTitle>
            <CardDescription>Las operativas más populares este mes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {topStrategies.map((strategy, idx) => (
                <div
                  key={strategy.id}
                  className="flex-shrink-0 w-48 p-3 bg-background/50 rounded-lg border cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedStrategy(strategy as any)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg font-bold text-primary">#{idx + 1}</span>
                    <span className="font-medium truncate">{strategy.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatProfit(strategy.totalProfit)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Heart className="h-3 w-3" />
                    {strategy.likesCount}
                    <Download className="h-3 w-3 ml-2" />
                    {strategy.downloadsCount}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar operativas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[200px]">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Más recientes</SelectItem>
            <SelectItem value="popular">Más populares</SelectItem>
            <SelectItem value="profitable">Más rentables</SelectItem>
            <SelectItem value="downloads">Más descargadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data?.strategies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No se encontraron operativas</h3>
            <p className="text-muted-foreground">
              Intenta con otros términos de búsqueda o filtros
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.strategies.map((strategy) => (
            <Card
              key={strategy.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedStrategy(strategy as any)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{strategy.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <span>por {strategy.author?.name || "Anónimo"}</span>
                    </CardDescription>
                  </div>
                  {strategy.totalProfit >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  ) : (
                    <TrendingUp className="h-5 w-5 text-red-500 rotate-180" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <div className={`text-lg font-bold ${strategy.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatProfit(strategy.totalProfit)}
                    </div>
                    <div className="text-xs text-muted-foreground">Profit</div>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <div className="text-lg font-bold">{formatPercent(strategy.winRate)}</div>
                    <div className="text-xs text-muted-foreground">Win Rate</div>
                  </div>
                </div>

                {/* Tags */}
                {strategy.tags && Array.isArray(strategy.tags) && (strategy.tags as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(strategy.tags as string[]).slice(0, 3).map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Heart className="h-4 w-4" />
                      {strategy.likesCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="h-4 w-4" />
                      {strategy.downloadsCount}
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-xs">
                    <Clock className="h-3 w-3" />
                    {formatDate(strategy.publishedAt)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!selectedStrategy} onOpenChange={() => setSelectedStrategy(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedStrategy && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedStrategy.name}</DialogTitle>
                <DialogDescription>
                  por {selectedStrategy.author?.name || "Anónimo"} • Publicado {formatDate(selectedStrategy.publishedAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Description */}
                {selectedStrategy.description && (
                  <div>
                    <h4 className="font-semibold mb-2">Descripción</h4>
                    <p className="text-muted-foreground">{selectedStrategy.description}</p>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className={`text-2xl font-bold ${selectedStrategy.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatProfit(selectedStrategy.totalProfit)}
                      </div>
                      <div className="text-xs text-muted-foreground">Profit Total</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold">{formatPercent(selectedStrategy.winRate)}</div>
                      <div className="text-xs text-muted-foreground">Win Rate</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold">{selectedStrategy.totalTrades}</div>
                      <div className="text-xs text-muted-foreground">Trades</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold text-red-500">
                        {formatPercent(selectedStrategy.maxDrawdown)}
                      </div>
                      <div className="text-xs text-muted-foreground">Max DD</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Parameters */}
                <div>
                  <h4 className="font-semibold mb-3">Parámetros de la Estrategia</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span className="text-muted-foreground">Estrategia</span>
                      <span className="font-medium">{selectedStrategy.strategyName}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span className="text-muted-foreground">Lotaje Base</span>
                      <span className="font-medium">{selectedStrategy.lotajeBase}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span className="text-muted-foreground">TP</span>
                      <span className="font-medium">{selectedStrategy.takeProfitPips} pips</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span className="text-muted-foreground">Niveles Max</span>
                      <span className="font-medium">{selectedStrategy.maxLevels}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span className="text-muted-foreground">Stop Loss</span>
                      <span className="font-medium">{selectedStrategy.useStopLoss ? "Sí" : "No"}</span>
                    </div>
                  </div>
                </div>

                {/* Tags */}
                {selectedStrategy.tags && Array.isArray(selectedStrategy.tags) && (selectedStrategy.tags as string[]).length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {(selectedStrategy.tags as string[]).map((tag, idx) => (
                        <Badge key={idx} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Social Stats */}
                <div className="flex items-center gap-6 py-3 border-t">
                  <button
                    className="flex items-center gap-1 text-muted-foreground hover:text-red-500 transition-colors"
                    onClick={() => handleLike(selectedStrategy.id)}
                  >
                    <Heart className="h-5 w-5" />
                    <span>{selectedStrategy.likesCount}</span>
                  </button>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Copy className="h-5 w-5" />
                    <span>{selectedStrategy.forksCount} forks</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Download className="h-5 w-5" />
                    <span>{selectedStrategy.downloadsCount} descargas</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    className="flex-1"
                    onClick={() => handleFork(selectedStrategy.id)}
                    disabled={forking}
                  >
                    {forking ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    {forking ? "Copiando..." : "Copiar a mis Estrategias"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      // TODO: Ir al backtester con estos parámetros
                    }}
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Probar en Backtester
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
