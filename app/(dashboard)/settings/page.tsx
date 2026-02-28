"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, MessageCircle, Copy, Check, XCircle } from "lucide-react";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Obtener datos del usuario
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  // Mutations
  const updateProfile = trpc.auth.updateProfile.useMutation();
  const utils = trpc.useUtils();

  // Cargar datos cuando el usuario esté disponible
  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    try {
      await updateProfile.mutateAsync({ name });
      utils.auth.me.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Error guardando perfil:", error);
    }
  };

  const copyLinkCode = () => {
    if (user?.tenant?.id) {
      navigator.clipboard.writeText(user.tenant.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Verificar si tiene plan compatible con Telegram
  const canUseTelegram = user?.tenant?.plan === "PRO" || user?.tenant?.plan === "ENTERPRISE";

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-muted rounded mb-2" />
          <div className="h-4 w-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8 md:pb-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground mt-2 text-[13px] md:text-base">
          Gestiona tu cuenta y preferencias
        </p>
      </div>

      <div className="space-y-6">
        {/* Suscripción */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Suscripción</CardTitle>
            <CardDescription className="text-[13px] md:text-sm">
              Plan actual y estado de pago
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg gap-3">
              <div>
                <h3 className="font-semibold text-[13px] md:text-base">
                  {user?.tenant?.plan === "PRO" ? "Plan Pro" :
                   user?.tenant?.plan === "BASIC" ? "Plan Básico" :
                   user?.tenant?.plan || "Plan Gratuito"}
                </h3>
                <p className="text-[13px] md:text-sm text-muted-foreground">
                  {user?.tenant?.name || "Tu organización"}
                </p>
              </div>
              <Link href="/pricing" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto min-h-[44px]">Mejorar Plan</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Cuentas de Trading */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Cuentas de Trading</CardTitle>
            <CardDescription className="text-[13px] md:text-sm">
              Conecta tus cuentas de MetaTrader
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground mb-4 text-[13px] md:text-base">
                Gestiona tus cuentas MT5 desde la sección del Bot
              </p>
              <Link href="/bot" className="block">
                <Button className="w-full sm:w-auto min-h-[44px]">Ir a Bot</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Perfil */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Perfil</CardTitle>
            <CardDescription className="text-[13px] md:text-sm">
              Información de tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-[13px] md:text-sm font-medium mb-2 block">
                Nombre
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Tu nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={updateProfile.isPending}
                className="h-11"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-[13px] md:text-sm font-medium mb-2 block">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                disabled
                value={user?.email || ""}
                className="bg-muted h-11"
              />
              <p className="text-[13px] text-muted-foreground mt-1">
                El email no se puede cambiar
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <Button
                onClick={handleSaveProfile}
                disabled={updateProfile.isPending || name === user?.name}
                className="w-full sm:w-auto min-h-[44px]"
              >
                {updateProfile.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Cambios"
                )}
              </Button>
              {saved && (
                <span className="text-[13px] text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Guardado
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Seguridad */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Seguridad</CardTitle>
            <CardDescription className="text-[13px] md:text-sm">
              Cambia tu contraseña de acceso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-[13px] md:text-sm mb-4">
              Para cambiar tu contraseña, cierra sesión y usa la opción "Olvidé mi contraseña" en la pantalla de login.
            </p>
            <Link href="/login" className="block">
              <Button variant="outline" className="w-full sm:w-auto min-h-[44px]">Cerrar Sesión</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Telegram */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Notificaciones Telegram
            </CardTitle>
            <CardDescription>
              Recibe alertas de trading en Telegram
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canUseTelegram ? (
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <XCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Plan no compatible</p>
                  <p className="text-sm text-muted-foreground">
                    Las notificaciones de Telegram requieren plan PRO o ENTERPRISE.
                  </p>
                  <Link href="/pricing">
                    <Button size="sm" className="mt-2">
                      Mejorar Plan
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">Plan compatible</p>
                    <p className="text-sm text-muted-foreground">
                      Tu plan incluye notificaciones de Telegram.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Código de Vinculación
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Copia este código y envíalo a tu bot de Telegram para vincular tu cuenta.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={user?.tenant?.id || ""}
                      className="font-mono text-sm bg-muted"
                    />
                    <Button
                      variant="outline"
                      onClick={copyLinkCode}
                      className="shrink-0"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Instrucciones</Label>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>Abre Telegram y busca tu bot</li>
                    <li>Inicia una conversación con <code className="bg-muted px-1 rounded">/start</code></li>
                    <li>Envía <code className="bg-muted px-1 rounded">/link {user?.tenant?.id?.slice(0, 8)}...</code></li>
                    <li>Recibirás confirmación de vinculación</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Notificaciones incluidas</Label>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Operaciones abiertas</Badge>
                    <Badge variant="secondary">Operaciones cerradas</Badge>
                    <Badge variant="secondary">Daily Loss Limit</Badge>
                    <Badge variant="secondary">Kill Switch</Badge>
                    <Badge variant="secondary">Errores del bot</Badge>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    El bot te enviará alertas en tiempo real sobre tu actividad de trading.
                    Puedes desvincularlo en cualquier momento enviando <code className="bg-muted px-1 rounded">/unlink</code> al bot.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
