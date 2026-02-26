"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import {
  ArrowLeft,
  Heart,
  Download,
  Copy,
  Share2,
  Target,
  Settings,
  Loader2,
  MessageCircle,
  Send,
} from "lucide-react";

export default function OperativaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const strategyId = params.id as string;

  const [comment, setComment] = useState("");
  const [forking, setForking] = useState(false);

  // Queries
  const { data: strategy, isLoading } = trpc.marketplace.get.useQuery({ id: strategyId });
  const { data: likeStatus } = trpc.marketplace.hasLiked.useQuery({ id: strategyId });
  const { data: commentsData } = trpc.marketplace.getComments.useQuery({
    publishedStrategyId: strategyId,
    limit: 20,
  });
  const { data: relatedStrategies } = trpc.marketplace.getRelated.useQuery({
    id: strategyId,
    limit: 3,
  });

  // Mutations
  const toggleLikeMutation = trpc.marketplace.toggleLike.useMutation();
  const forkMutation = trpc.marketplace.fork.useMutation();
  const addCommentMutation = trpc.marketplace.addComment.useMutation();

  const utils = trpc.useUtils();

  const handleFork = async () => {
    if (!strategy) return;
    setForking(true);
    try {
      await forkMutation.mutateAsync({
        publishedId: strategy.id,
        name: `${strategy.name} (fork)`,
      });
      router.push("/backtester");
    } catch (error) {
      console.error("Error al hacer fork:", error);
    } finally {
      setForking(false);
    }
  };

  const handleLike = async () => {
    if (!strategy) return;
    await toggleLikeMutation.mutateAsync({ id: strategy.id });
    utils.marketplace.hasLiked.invalidate({ id: strategyId });
    utils.marketplace.get.invalidate({ id: strategyId });
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    await addCommentMutation.mutateAsync({
      publishedStrategyId: strategyId,
      content: comment.trim(),
    });
    setComment("");
    utils.marketplace.getComments.invalidate({ publishedStrategyId: strategyId });
  };

  const formatProfit = (value: number) => {
    const prefix = value >= 0 ? "+" : "";
    return `${prefix}$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date));
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Hoy";
    if (days === 1) return "Ayer";
    if (days < 7) return `Hace ${days} días`;
    if (days < 30) return `Hace ${Math.floor(days / 7)} semanas`;
    return formatDate(date);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-4">Operativa no encontrada</h1>
        <Link href="/operativas">
          <Button>Volver al Marketplace</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/operativas">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{strategy.name}</h1>
          <p className="text-muted-foreground mt-1">
            por {strategy.author?.name || "Anónimo"} • Publicado el {formatDate(strategy.publishedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={likeStatus?.liked ? "default" : "outline"}
            size="icon"
            onClick={handleLike}
            className={likeStatus?.liked ? "bg-red-500 hover:bg-red-600" : "hover:text-red-500"}
          >
            <Heart className={`w-4 h-4 ${likeStatus?.liked ? "fill-current" : ""}`} />
          </Button>
          <Button variant="outline" size="icon">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className={`text-2xl font-bold ${strategy.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatProfit(strategy.totalProfit)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Profit Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold">{formatPercent(strategy.winRate)}</div>
            <div className="text-xs text-muted-foreground mt-1">Win Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold">{strategy.totalTrades}</div>
            <div className="text-xs text-muted-foreground mt-1">Trades</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-red-500">{formatPercent(strategy.maxDrawdown)}</div>
            <div className="text-xs text-muted-foreground mt-1">Max Drawdown</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {strategy.description && (
            <Card>
              <CardHeader>
                <CardTitle>Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{strategy.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Parameters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Parámetros de la Estrategia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Estrategia Base</span>
                  <span className="font-medium">{strategy.strategyName}</span>
                </div>
                <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Lotaje Base</span>
                  <span className="font-medium">{strategy.lotajeBase}</span>
                </div>
                <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Grid Spacing</span>
                  <span className="font-medium">{strategy.pipsDistance} pips</span>
                </div>
                <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Max Levels</span>
                  <span className="font-medium">{strategy.maxLevels}</span>
                </div>
                <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Take Profit</span>
                  <span className="font-medium text-green-600">{strategy.takeProfitPips} pips</span>
                </div>
                <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Stop Loss</span>
                  <span className="font-medium">
                    {strategy.useStopLoss ? `${strategy.stopLossPips} pips` : "No"}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Trailing SL</span>
                  <span className="font-medium">
                    {strategy.useTrailingSL ? `${strategy.trailingSLPercent}%` : "No"}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Restricción</span>
                  <span className="font-medium">{strategy.restrictionType || "Ninguna"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          {strategy.tags && Array.isArray(strategy.tags) && (strategy.tags as string[]).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(strategy.tags as string[]).map((tag, idx) => (
                    <Badge key={idx} variant="secondary" className="text-sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comments Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Comentarios
              </CardTitle>
              <CardDescription>Comparte tu opinión sobre esta operativa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add comment */}
              <div className="flex gap-2">
                <Input
                  placeholder="Escribe un comentario..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!comment.trim() || addCommentMutation.isPending}
                >
                  {addCommentMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {/* Comments list */}
              {commentsData?.comments && commentsData.comments.length > 0 ? (
                <div className="space-y-4 pt-4">
                  {commentsData.comments.map((c) => (
                    <div key={c.id} className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {c.user?.name?.[0] || "?"}
                        </div>
                        <div>
                          <span className="font-medium">{c.user?.name || "Anónimo"}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {formatRelativeTime(c.createdAt)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground pl-10">{c.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Sé el primero en comentar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                onClick={handleFork}
                disabled={forking}
              >
                {forking ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Copy className="w-4 h-4 mr-2" />
                )}
                {forking ? "Copiando..." : "Copiar a mis Estrategias"}
              </Button>
              <Link href="/backtester" className="block">
                <Button variant="outline" className="w-full">
                  <Target className="w-4 h-4 mr-2" />
                  Probar en Backtester
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Social Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Estadísticas Sociales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Heart className="w-4 h-4" />
                    <span>Likes</span>
                  </div>
                  <span className="font-bold">{strategy.likesCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Copy className="w-4 h-4" />
                    <span>Forks</span>
                  </div>
                  <span className="font-bold">{strategy.forksCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Download className="w-4 h-4" />
                    <span>Descargas</span>
                  </div>
                  <span className="font-bold">{strategy.downloadsCount}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Related Strategies */}
          {relatedStrategies && relatedStrategies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Operativas Relacionadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {relatedStrategies.map((s) => (
                    <Link
                      key={s.id}
                      href={`/operativas/${s.id}`}
                      className="block p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="font-medium text-sm truncate">{s.name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className={s.totalProfit >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatProfit(s.totalProfit)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {s.likesCount}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fork info */}
          {strategy.parentStrategy && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Esta operativa es un fork de:
                </p>
                <Link
                  href={`/operativas/${strategy.parentStrategy.id}`}
                  className="font-medium hover:underline"
                >
                  {strategy.parentStrategy.name}
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
