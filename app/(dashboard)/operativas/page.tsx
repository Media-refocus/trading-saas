"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Download,
  Heart,
  Star,
  ArrowUpDown,
  Clock,
  Target,
  Copy,
  Loader2,
  MessageCircle,
  Send,
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

interface Comment {
  id: string;
  content: string;
  createdAt: Date;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

type SortOption = "recent" | "popular" | "profitable" | "downloads";

// Funcion para formatear fecha relativa
function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `hace ${years} año${years > 1 ? "s" : ""}`;
  if (months > 0) return `hace ${months} mes${months > 1 ? "es" : ""}`;
  if (weeks > 0) return `hace ${weeks} semana${weeks > 1 ? "s" : ""}`;
  if (days > 0) return `hace ${days} dia${days > 1 ? "s" : ""}`;
  if (hours > 0) return `hace ${hours} hora${hours > 1 ? "s" : ""}`;
  if (minutes > 0) return `hace ${minutes} minuto${minutes > 1 ? "s" : ""}`;
  return "hace unos segundos";
}

export default function OperativasPage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [selectedStrategy, setSelectedStrategy] = useState<PublishedStrategy | null>(null);
  const [forking, setForking] = useState(false);
  const [likedStrategies, setLikedStrategies] = useState<Set<string>>(new Set());
  const [newComment, setNewComment] = useState("");

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

  // Obtener estado de like para estrategia seleccionada
  const { data: likeStatus } = trpc.marketplace.getLikeStatus.useQuery(
    { publishedStrategyId: selectedStrategy?.id ?? "" },
    { enabled: !!selectedStrategy }
  );

  // Obtener comentarios
  const { data: commentsData, refetch: refetchComments } = trpc.marketplace.getComments.useQuery(
    { publishedStrategyId: selectedStrategy?.id ?? "", limit: 20 },
    { enabled: !!selectedStrategy }
  );

  // Obtener estrategias relacionadas
  const { data: relatedStrategies } = trpc.marketplace.getRelated.useQuery(
    { id: selectedStrategy?.id ?? "", limit: 3 },
    { enabled: !!selectedStrategy }
  );

  // Fork mutation
  const forkMutation = trpc.marketplace.fork.useMutation({
    onSuccess: () => {
      setForking(false);
      setSelectedStrategy(null);
    },
    onError: (error) => {
      setForking(false);
      console.error("Error al hacer fork:", error);
    },
  });

  // Toggle like mutation
  const toggleLikeMutation = trpc.marketplace.toggleLike.useMutation({
    onSuccess: (result, variables) => {
      if (result.hasLiked) {
        setLikedStrategies(prev => new Set(prev).add(variables.publishedStrategyId));
      } else {
        setLikedStrategies(prev => {
          const next = new Set(prev);
          next.delete(variables.publishedStrategyId);
          return next;
        });
      }
      refetch();
    },
  });

  // Add comment mutation
  const addCommentMutation = trpc.marketplace.addComment.useMutation({
    onSuccess: () => {
      setNewComment("");
      refetchComments();
    },
  });

  // Actualizar estado de like cuando cambia la estrategia seleccionada
  useEffect(() => {
    if (likeStatus && selectedStrategy) {
      if (likeStatus.hasLiked) {
        setLikedStrategies(prev => new Set(prev).add(selectedStrategy.id));
      }
    }
  }, [likeStatus, selectedStrategy]);

  const handleFork = async (strategyId: string) => {
    setForking(true);
    forkMutation.mutate({ publishedId: strategyId });
  };

  const handleToggleLike = (strategyId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    toggleLikeMutation.mutate({ publishedStrategyId: strategyId });
  };

  const handleAddComment = () => {
    if (!selectedStrategy || !newComment.trim()) return;
    addCommentMutation.mutate({
      publishedStrategyId: selectedStrategy.id,
      content: newComment.trim(),
    });
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

  const isLiked = (strategyId: string) => likedStrategies.has(strategyId);

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
            <CardDescription>Las operativas mas populares este mes</CardDescription>
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
            <SelectItem value="recent">Mas recientes</SelectItem>
            <SelectItem value="popular">Mas populares</SelectItem>
            <SelectItem value="profitable">Mas rentables</SelectItem>
            <SelectItem value="downloads">Mas descargadas</SelectItem>
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
              Intenta con otros terminos de busqueda o filtros
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
                      <span>por {strategy.author?.name || "Anonimo"}</span>
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
                    <button
                      className={`flex items-center gap-1 transition-colors ${
                        isLiked(strategy.id) ? "text-red-500" : "hover:text-red-500"
                      }`}
                      onClick={(e) => handleToggleLike(strategy.id, e)}
                    >
                      <Heart className={`h-4 w-4 ${isLiked(strategy.id) ? "fill-current" : ""}`} />
                      {strategy.likesCount}
                    </button>
                    <span className="flex items-center gap-1">
                      <Download className="h-4 w-4" />
                      {strategy.downloadsCount}
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-xs">
                    <Clock className="h-3 w-3" />
                    {formatRelativeDate(strategy.publishedAt)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!selectedStrategy} onOpenChange={() => setSelectedStrategy(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
          {selectedStrategy && (
            <>
              {/* Header fijo */}
              <DialogHeader className="p-6 pb-4 border-b shrink-0">
                <DialogTitle className="text-xl">{selectedStrategy.name}</DialogTitle>
                <DialogDescription>
                  por {selectedStrategy.author?.name || "Anonimo"} - Publicado {formatDate(selectedStrategy.publishedAt)}
                </DialogDescription>
              </DialogHeader>

              {/* Contenido scrolleable */}
              <ScrollArea className="flex-1 px-6">
                <div className="space-y-6 py-4">
                  {/* Description */}
                  {selectedStrategy.description && (
                    <div>
                      <h4 className="font-semibold mb-2">Descripcion</h4>
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
                    <h4 className="font-semibold mb-3">Parametros de la Estrategia</h4>
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
                        <span className="font-medium">{selectedStrategy.useStopLoss ? "Si" : "No"}</span>
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
                      className={`flex items-center gap-1 transition-colors ${
                        isLiked(selectedStrategy.id) ? "text-red-500" : "text-muted-foreground hover:text-red-500"
                      }`}
                      onClick={() => handleToggleLike(selectedStrategy.id)}
                    >
                      <Heart className={`h-5 w-5 ${isLiked(selectedStrategy.id) ? "fill-current" : ""}`} />
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
                        // TODO: Ir al backtester con estos parametros
                      }}
                    >
                      <Target className="h-4 w-4 mr-2" />
                      Probar en Backtester
                    </Button>
                  </div>

                  {/* Comments Section */}
                  <Separator className="my-4" />
                  <div>
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Comentarios
                    </h4>

                    {/* Add Comment */}
                    <div className="flex gap-2 mb-4">
                      <Input
                        placeholder="Escribe un comentario..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment();
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || addCommentMutation.isPending}
                      >
                        {addCommentMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Comments List */}
                    <div className="space-y-4">
                      {commentsData?.comments.length === 0 ? (
                        <p className="text-muted-foreground text-sm text-center py-4">
                          Se el primero en comentar
                        </p>
                      ) : (
                        commentsData?.comments.map((comment) => (
                          <div key={comment.id} className="flex gap-3">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={comment.author.image ?? undefined} />
                              <AvatarFallback>
                                {comment.author.name?.charAt(0).toUpperCase() ?? "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">
                                  {comment.author.name ?? "Anonimo"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatRelativeDate(comment.createdAt)}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground break-words">
                                {comment.content}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Related Strategies */}
                  {relatedStrategies && relatedStrategies.length > 0 && (
                    <>
                      <Separator className="my-4" />
                      <div>
                        <h4 className="font-semibold mb-3">Estrategias Relacionadas</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {relatedStrategies.map((related) => (
                            <Card
                              key={related.id}
                              className="cursor-pointer hover:border-primary/50 transition-colors"
                              onClick={() => {
                                setSelectedStrategy(related as any);
                                setNewComment("");
                              }}
                            >
                              <CardContent className="p-3">
                                <div className="font-medium truncate mb-1">{related.name}</div>
                                <div className="text-sm text-muted-foreground mb-2">
                                  por {related.author?.name ?? "Anonimo"}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className={`font-medium ${related.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {formatProfit(related.totalProfit)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Heart className="h-3 w-3" />
                                    {related.likesCount}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
