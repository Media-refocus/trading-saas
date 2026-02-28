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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  Play,
  Pause,
  Copy,
  RefreshCw,
  Plus,
  Trash2,
  Settings,
  Activity,
  Key,
  CreditCard,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Link from "next/link";

// ==================== TYPES ====================

type BotConfig = any;

// ==================== COMPONENTS ====================

function StatusBadge({ status, lastHeartbeat }: { status: string; lastHeartbeat: BotConfig["lastHeartbeat"] }) {
  const isOnline = lastHeartbeat &&
    Date.now() - new Date(lastHeartbeat.timestamp).getTime() < 60000;

  if (status === "PAUSED") {
    return <Badge variant="secondary">⏸️ Pausado</Badge>;
  }

  if (isOnline) {
    return <Badge variant="default" className="bg-green-600">🟢 Online</Badge>;
  }

  return <Badge variant="destructive">🔴 Offline</Badge>;
}

function ApiKeySection({ onRegenerate }: { onRegenerate: () => Promise<{ apiKey?: string }> }) {
  const [showKey, setShowKey] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const result = await onRegenerate();
      if (result?.apiKey) {
        setNewKey(result.apiKey);
        setShowKey(true);
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopy = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Key className="h-4 w-4 md:h-5 md:w-5" />
          API Key del Bot
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Clave de autenticación para conectar el bot Python con el SaaS
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 md:space-y-4">
        {newKey ? (
          <div className="space-y-2 md:space-y-3">
            <div className="p-3 md:p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-1 md:space-y-2">
                  <p className="text-xs md:text-sm font-medium text-amber-800 dark:text-amber-200">
                    ¡Guarda esta clave ahora!
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Esta es la única vez que se mostrará. Guárdala en un lugar seguro.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <code className="flex-1 p-2 md:p-3 bg-muted rounded font-mono text-xs md:text-sm break-all">
                {newKey}
              </code>
              <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
                {copied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowKey(false)} className="text-sm">
              Ya la guardé
            </Button>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-3">
            <div className="flex items-center gap-2 p-2 md:p-3 bg-muted rounded">
              <code className="font-mono text-xs md:text-sm">••••••••••••••••••••</code>
              <span className="text-xs md:text-sm text-muted-foreground hidden sm:inline">
                (clave oculta por seguridad)
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={isRegenerating} size="sm" className="w-full sm:w-auto min-h-[44px]">
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
                    Regenerar clave
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Regenerar API key?</AlertDialogTitle>
                    <AlertDialogDescription>
                      La clave actual dejará de funcionar inmediatamente.
                      Deberás actualizar el bot Python con la nueva clave.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <Button variant="outline" size="sm">Cancelar</Button>
                    <AlertDialogAction onClick={handleRegenerate} className="text-sm">
                      Regenerar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TradingConfigForm({ config, onSave }: { config: BotConfig | null; onSave: () => void }) {
  const [formData, setFormData] = useState({
    symbol: "XAUUSD",
    entryLot: 0.1,
    entryNumOrders: 1,
    gridStepPips: 10,
    gridLot: 0.1,
    gridMaxLevels: 4,
    gridNumOrders: 1,
    gridTolerancePips: 1,
    restrictionType: "",
    maxLevels: 4,
    // Trailing
    useTrailing: false,
    trailingActivate: 30,
    trailingStep: 10,
    trailingBack: 20,
    trailingBuffer: 1,
    // Daily loss limit
    dailyLossLimitPercent: 3,
  });

  const [isSaving, setIsSaving] = useState(false);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (config) {
      setFormData({
        symbol: config.symbol || "XAUUSD",
        entryLot: config.entryLot || 0.1,
        entryNumOrders: config.entryNumOrders || 1,
        gridStepPips: config.gridStepPips || 10,
        gridLot: config.gridLot || 0.1,
        gridMaxLevels: config.gridMaxLevels || 4,
        gridNumOrders: config.gridNumOrders || 1,
        gridTolerancePips: config.gridTolerancePips || 1,
        restrictionType: config.restrictionType || "",
        maxLevels: config.maxLevels || 4,
        useTrailing: !!config.entryTrailing,
        trailingActivate: config.entryTrailing?.activate || 30,
        trailingStep: config.entryTrailing?.step || 10,
        trailingBack: config.entryTrailing?.back || 20,
        trailingBuffer: config.entryTrailing?.buffer || 1,
        dailyLossLimitPercent: config.dailyLossLimitPercent || 3,
      });
    }
  }, [config]);

  const upsertConfig = trpc.bot.upsertConfig.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await upsertConfig.mutateAsync({
        symbol: formData.symbol,
        magicNumber: 20250101,
        entryLot: formData.entryLot,
        entryNumOrders: formData.entryNumOrders,
        entryTrailing: formData.useTrailing
          ? {
              activate: formData.trailingActivate,
              step: formData.trailingStep,
              back: formData.trailingBack,
              buffer: formData.trailingBuffer,
            }
          : undefined,
        gridStepPips: formData.gridStepPips,
        gridLot: formData.gridLot,
        gridMaxLevels: formData.gridMaxLevels,
        gridNumOrders: formData.gridNumOrders,
        gridTolerancePips: formData.gridTolerancePips,
        restrictionType: (formData.restrictionType || undefined) as "RIESGO" | "SIN_PROMEDIOS" | "SOLO_1_PROMEDIO" | undefined,
        maxLevels: formData.maxLevels,
        dailyLossLimitPercent: formData.dailyLossLimitPercent || undefined,
      });

      utils.bot.getConfig.invalidate();
      onSave();
    } catch (error) {
      console.error("Error saving config:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
      {/* Entry Config */}
      <Card>
        <CardHeader className="pb-2 md:pb-4">
          <CardTitle className="text-base md:text-lg">Entrada (Level 0)</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Configuración de la orden inicial de cada señal
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3">
          <div className="space-y-1.5 md:space-y-2">
            <Label htmlFor="symbol" className="text-xs md:text-sm">Símbolo</Label>
            <Input
              id="symbol"
              value={formData.symbol}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              className="h-9 md:h-10"
            />
          </div>
          <div className="space-y-1.5 md:space-y-2">
            <Label htmlFor="entryLot" className="text-xs md:text-sm">Lote entrada</Label>
            <Input
              id="entryLot"
              type="number"
              step="0.01"
              min="0.01"
              max="10"
              value={formData.entryLot}
              onChange={(e) => setFormData({ ...formData, entryLot: parseFloat(e.target.value) })}
              className="h-9 md:h-10"
            />
          </div>
          <div className="space-y-1.5 md:space-y-2">
            <Label htmlFor="entryNumOrders" className="text-xs md:text-sm">Nº órdenes</Label>
            <Input
              id="entryNumOrders"
              type="number"
              min="1"
              max="5"
              value={formData.entryNumOrders}
              onChange={(e) => setFormData({ ...formData, entryNumOrders: parseInt(e.target.value) })}
              className="h-9 md:h-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Trailing SL */}
      <Card>
        <CardHeader className="pb-2 md:pb-4">
          <CardTitle className="text-base md:text-lg">Trailing Stop Loss Virtual</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            SL que se mueve con el precio para proteger ganancias
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="useTrailing"
              checked={formData.useTrailing}
              onChange={(e) => setFormData({ ...formData, useTrailing: e.target.checked })}
              className="h-4 w-4"
            />
            <Label htmlFor="useTrailing" className="text-xs md:text-sm">Activar trailing SL</Label>
          </div>

          {formData.useTrailing && (
            <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4 pt-2">
              <div className="space-y-1.5 md:space-y-2">
                <Label htmlFor="trailingActivate" className="text-xs md:text-sm">Activar (pips)</Label>
                <Input
                  id="trailingActivate"
                  type="number"
                  min="1"
                  value={formData.trailingActivate}
                  onChange={(e) => setFormData({ ...formData, trailingActivate: parseInt(e.target.value) })}
                  className="h-9 md:h-10"
                />
              </div>
              <div className="space-y-1.5 md:space-y-2">
                <Label htmlFor="trailingStep" className="text-xs md:text-sm">Step (pips)</Label>
                <Input
                  id="trailingStep"
                  type="number"
                  min="1"
                  value={formData.trailingStep}
                  onChange={(e) => setFormData({ ...formData, trailingStep: parseInt(e.target.value) })}
                  className="h-9 md:h-10"
                />
              </div>
              <div className="space-y-1.5 md:space-y-2">
                <Label htmlFor="trailingBack" className="text-xs md:text-sm">Back (pips)</Label>
                <Input
                  id="trailingBack"
                  type="number"
                  min="1"
                  value={formData.trailingBack}
                  onChange={(e) => setFormData({ ...formData, trailingBack: parseInt(e.target.value) })}
                  className="h-9 md:h-10"
                />
              </div>
              <div className="space-y-1.5 md:space-y-2">
                <Label htmlFor="trailingBuffer" className="text-xs md:text-sm">Buffer (pips)</Label>
                <Input
                  id="trailingBuffer"
                  type="number"
                  min="0"
                  value={formData.trailingBuffer}
                  onChange={(e) => setFormData({ ...formData, trailingBuffer: parseInt(e.target.value) })}
                  className="h-9 md:h-10"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid Config */}
      <Card>
        <CardHeader className="pb-2 md:pb-4">
          <CardTitle className="text-base md:text-lg">Grid de Promedios</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Configuración de los niveles adicionales (escalones)
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3">
          <div className="space-y-1.5 md:space-y-2">
            <Label htmlFor="gridStepPips" className="text-xs md:text-sm">Distancia (pips)</Label>
            <Input
              id="gridStepPips"
              type="number"
              min="1"
              max="100"
              value={formData.gridStepPips}
              onChange={(e) => setFormData({ ...formData, gridStepPips: parseInt(e.target.value) })}
              className="h-9 md:h-10"
            />
          </div>
          <div className="space-y-1.5 md:space-y-2">
            <Label htmlFor="gridLot" className="text-xs md:text-sm">Lote promedios</Label>
            <Input
              id="gridLot"
              type="number"
              step="0.01"
              min="0.01"
              max="10"
              value={formData.gridLot}
              onChange={(e) => setFormData({ ...formData, gridLot: parseFloat(e.target.value) })}
              className="h-9 md:h-10"
            />
          </div>
          <div className="space-y-1.5 md:space-y-2">
            <Label htmlFor="gridMaxLevels" className="text-xs md:text-sm">Máx niveles</Label>
            <Input
              id="gridMaxLevels"
              type="number"
              min="1"
              max="20"
              value={formData.gridMaxLevels}
              onChange={(e) => setFormData({ ...formData, gridMaxLevels: parseInt(e.target.value) })}
              className="h-9 md:h-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Restrictions */}
      <Card>
        <CardHeader className="pb-2 md:pb-4">
          <CardTitle className="text-base md:text-lg">Restricciones</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Límites opcionales según el tipo de señal del canal
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2">
          <div className="space-y-1.5 md:space-y-2">
            <Label htmlFor="restrictionType" className="text-xs md:text-sm">Tipo de restricción</Label>
            <Select
              value={formData.restrictionType || "none"}
              onValueChange={(value) =>
                setFormData({ ...formData, restrictionType: value === "none" ? "" : value })
              }
            >
              <SelectTrigger className="h-9 md:h-10">
                <SelectValue placeholder="Sin restricción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin restricción</SelectItem>
                <SelectItem value="RIESGO">RIESGO (muy conservador)</SelectItem>
                <SelectItem value="SIN_PROMEDIOS">Sin promedios</SelectItem>
                <SelectItem value="SOLO_1_PROMEDIO">Solo 1 promedio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:space-y-2">
            <Label htmlFor="maxLevels" className="text-xs md:text-sm">Máx niveles (override)</Label>
            <Input
              id="maxLevels"
              type="number"
              min="1"
              max="20"
              value={formData.maxLevels}
              onChange={(e) => setFormData({ ...formData, maxLevels: parseInt(e.target.value) })}
              className="h-9 md:h-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Daily Loss Limit */}
      <Card className="border-amber-500/50">
        <CardHeader className="pb-2 md:pb-4">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-amber-500" />
            Límite de Pérdida Diaria
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            El bot se pausará automáticamente si la pérdida del día supera este límite
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 grid-cols-1 sm:grid-cols-2 p-4 md:pt-6 md:pb-6">
          <div className="space-y-1.5 md:space-y-2">
            <Label htmlFor="dailyLossLimitPercent" className="text-xs md:text-sm">Límite diario (%)</Label>
            <Input
              id="dailyLossLimitPercent"
              type="number"
              step="0.5"
              min="0.5"
              max="20"
              value={formData.dailyLossLimitPercent}
              onChange={(e) => setFormData({ ...formData, dailyLossLimitPercent: parseFloat(e.target.value) })}
              className="h-9 md:h-10"
            />
            <p className="text-xs text-muted-foreground">
              Ejemplo: 3% significa que si pierdes más del 3% de tu balance en un día, el bot se pausa.
            </p>
          </div>
          <div className="space-y-1.5 md:space-y-2">
            <Label className="text-xs md:text-sm font-medium">Estado actual</Label>
            {config?.dailyLossCurrent !== undefined && (
              <div className="p-2 md:p-3 bg-muted rounded-lg">
                <p className="text-xs md:text-sm">
                  Pérdida hoy: <span className={config.dailyLossCurrent > 0 ? "text-red-500 font-semibold" : "text-green-500 font-semibold"}>
                    ${config.dailyLossCurrent.toFixed(2)}
                  </span>
                </p>
                {config.dailyLossLimitPercent && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Límite: {config.dailyLossLimitPercent}% del balance
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 md:gap-3">
        <Button type="submit" disabled={isSaving} size="sm" className="text-sm w-full sm:w-auto min-h-[44px]">
          {isSaving ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Guardar configuración
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function AccountsSection({ accounts }: { accounts: BotConfig["accounts"] }) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({
    login: "",
    password: "",
    server: "",
    path: "",
    symbol: "XAUUSD",
    magic: 20250101,
  });

  const addAccount = trpc.bot.addAccount.useMutation();
  const removeAccount = trpc.bot.removeAccount.useMutation();
  const utils = trpc.useUtils();

  const handleAddAccount = async () => {
    try {
      await addAccount.mutateAsync(newAccount);
      utils.bot.getConfig.invalidate();
      setIsAddDialogOpen(false);
      setNewAccount({
        login: "",
        password: "",
        server: "",
        path: "",
        symbol: "XAUUSD",
        magic: 20250101,
      });
    } catch (error) {
      console.error("Error adding account:", error);
    }
  };

  const handleRemoveAccount = async (id: string) => {
    try {
      await removeAccount.mutateAsync({ id });
      utils.bot.getConfig.invalidate();
    } catch (error) {
      console.error("Error removing account:", error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <CreditCard className="h-4 w-4 md:h-5 md:w-5" />
              Cuentas MT5
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Cuentas de MetaTrader donde el bot ejecutará trades
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="text-xs md:text-sm w-full sm:w-auto min-h-[44px]">
                <Plus className="h-4 w-4 mr-2" />
                Añadir cuenta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-base md:text-lg">Añadir cuenta MT5</DialogTitle>
                <DialogDescription className="text-xs md:text-sm">
                  Las credenciales se cifran con AES-256-GCM antes de guardar
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 md:gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-2 md:gap-4">
                  <Label htmlFor="login" className="text-right text-xs md:text-sm">Login</Label>
                  <Input
                    id="login"
                    value={newAccount.login}
                    onChange={(e) => setNewAccount({ ...newAccount, login: e.target.value })}
                    className="col-span-3 h-9 md:h-10"
                    placeholder="12345678"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-2 md:gap-4">
                  <Label htmlFor="password" className="text-right text-xs md:text-sm">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newAccount.password}
                    onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                    className="col-span-3 h-9 md:h-10"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-2 md:gap-4">
                  <Label htmlFor="server" className="text-right text-xs md:text-sm">Servidor</Label>
                  <Input
                    id="server"
                    value={newAccount.server}
                    onChange={(e) => setNewAccount({ ...newAccount, server: e.target.value })}
                    className="col-span-3 h-9 md:h-10"
                    placeholder="Broker-Demo"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-2 md:gap-4">
                  <Label htmlFor="magic" className="text-right text-xs md:text-sm">Magic</Label>
                  <Input
                    id="magic"
                    type="number"
                    value={newAccount.magic}
                    onChange={(e) => setNewAccount({ ...newAccount, magic: parseInt(e.target.value) })}
                    className="col-span-3 h-9 md:h-10"
                    placeholder="20250101"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(false)} className="text-sm">
                  Cancelar
                </Button>
                <Button onClick={handleAddAccount} disabled={addAccount.isPending} size="sm" className="text-sm">
                  {addAccount.isPending ? "Añadiendo..." : "Añadir cuenta"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <div className="text-center py-6 md:py-8 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground mb-2 text-sm md:text-base">
              No hay cuentas MT5 configuradas
            </p>
            <p className="text-xs md:text-sm text-muted-foreground">
              Añade una cuenta para que el bot pueda operar
            </p>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-3">
            {accounts.map((account: any) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-3 md:p-4 border rounded-lg gap-2"
              >
                <div className="flex items-center gap-3 md:gap-4 min-w-0">
                  <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full shrink-0 ${account.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                  <div className="min-w-0">
                    <p className="font-medium text-sm md:text-base truncate">{account.server}</p>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">
                      {account.symbol} · Magic: {account.magic}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4 shrink-0">
                  {account.lastEquity && (
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium">
                        ${account.lastEquity.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Equity</p>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveAccount(account.id)}
                    className="shrink-0 min-h-[44px] min-w-[44px]"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== MAIN PAGE ====================

export default function BotPage() {
  const [saved, setSaved] = useState(false);
  const utils = trpc.useUtils();

  const { data: config, isLoading } = trpc.bot.getConfig.useQuery();
  const regenerateApiKey = trpc.bot.regenerateApiKey.useMutation();
  const pauseBot = trpc.bot.pause.useMutation();
  const resumeBot = trpc.bot.resume.useMutation();

  const handleRegenerateKey = async () => {
    const result = await regenerateApiKey.mutateAsync();
    return result;
  };

  const handlePause = async () => {
    await pauseBot.mutateAsync();
    utils.bot.getConfig.invalidate();
  };

  const handleResume = async () => {
    await resumeBot.mutateAsync();
    utils.bot.getConfig.invalidate();
  };

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <Skeleton className="h-10 md:h-12 w-40 md:w-48" />
        <Skeleton className="h-24 md:h-32 w-full" />
        <Skeleton className="h-48 md:h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8 pb-8 md:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Bot Operativo</h1>
          <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
            Configura y controla el bot de trading automático
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <Link href="/bot/monitor" className="hidden sm:block">
            <Button variant="outline" size="sm">
              <Activity className="h-4 w-4 mr-2" />
              Monitor en vivo
            </Button>
          </Link>
          {config?.status === "PAUSED" ? (
            <Button onClick={handleResume} disabled={resumeBot.isPending} size="sm">
              <Play className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Reanudar</span>
              <span className="sm:hidden">Play</span>
            </Button>
          ) : (
            <Button variant="outline" onClick={handlePause} disabled={pauseBot.isPending} size="sm">
              <Pause className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Pausar</span>
              <span className="sm:hidden">Pause</span>
            </Button>
          )}
        </div>
      </div>

      {/* Status Card */}
      <Card>
        <CardContent className="pt-4 md:pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 md:gap-4">
              <StatusBadge status={config?.status || "OFFLINE"} lastHeartbeat={config?.lastHeartbeat || null} />
              <div>
                <p className="text-[13px] md:text-sm text-muted-foreground">
                  Última conexión:{" "}
                  {config?.lastHeartbeat
                    ? new Date(config.lastHeartbeat.timestamp).toLocaleString()
                    : "Nunca"}
                </p>
                {config?.lastHeartbeat && (
                  <p className="text-[13px] md:text-sm text-muted-foreground">
                    {config.lastHeartbeat.openPositions} pos ·
                    MT5: {config.lastHeartbeat.mt5Connected ? "✅" : "❌"} ·
                    TG: {config.lastHeartbeat.telegramConnected ? "✅" : "❌"}
                  </p>
                )}
              </div>
            </div>
            {config?.lastHeartbeat && (
              <div className="flex gap-4 md:gap-6 text-xs md:text-sm">
                <div className="text-center">
                  <p className="font-semibold text-base md:text-lg">{config.lastHeartbeat.openPositions}</p>
                  <p className="text-muted-foreground">Posiciones</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Key */}
      <ApiKeySection onRegenerate={handleRegenerateKey} />

      {/* Trading Config */}
      <div>
        <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <Settings className="h-4 w-4 md:h-5 md:w-5" />
          Configuración de Trading
        </h2>
        <TradingConfigForm
          config={config || null}
          onSave={() => {
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
          }}
        />
      </div>

      {/* MT5 Accounts */}
      <AccountsSection accounts={config?.accounts || []} />

      {/* Telegram Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <MessageSquare className="h-4 w-4 md:h-5 md:w-5" />
            Telegram
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Configuración para recibir señales de canales de Telegram
          </CardDescription>
        </CardHeader>
        <CardContent>
          {config?.hasTelegramConfig ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5" />
              <span className="text-sm md:text-base">Telegram configurado ({Array.isArray(config.telegramChannels) ? config.telegramChannels.length : 0} canales)</span>
            </div>
          ) : (
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-sm md:text-base">Telegram no configurado</span>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">
                Para configurar Telegram, necesitas obtener API ID y API Hash desde{" "}
                <a
                  href="https://my.telegram.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  my.telegram.org
                </a>
              </p>
              <p className="text-xs text-muted-foreground">
                La configuración de Telegram se añadirá próximamente al dashboard.
                Por ahora, configura manualmente en el bot.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Success toast */}
      {saved && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          Configuración guardada
        </div>
      )}
    </div>
  );
}
