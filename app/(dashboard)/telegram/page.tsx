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

interface TelegramConfig {
  chatId: string | null;
  notificationsEnabled: boolean;
}

interface BotStatus {
  configured: boolean;
  username?: string;
  name?: string;
  error?: string;
}

interface SetupResponse {
  success: boolean;
  config: TelegramConfig;
  bot: BotStatus;
}

export default function TelegramPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<TelegramConfig | null>(null);
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [chatIdInput, setChatIdInput] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/telegram/setup");
      const data: SetupResponse = await res.json();

      if (data.success) {
        setConfig(data.config);
        setBot(data.bot);
        if (data.config.chatId) {
          setChatIdInput(data.config.chatId);
        }
      }
    } catch (error) {
      console.error("Error fetching config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChatId = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/telegram/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: chatIdInput,
          sendWelcome: true,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setConfig(data.config);
        setMessage({
          type: "success",
          text: "Chat ID guardado. Recibiras un mensaje de bienvenida.",
        });
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    setMessage(null);

    try {
      const res = await fetch("/api/telegram/setup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationsEnabled: enabled }),
      });

      const data = await res.json();

      if (data.success) {
        setConfig((prev) => prev ? { ...prev, notificationsEnabled: enabled } : null);
        setMessage({
          type: "success",
          text: data.message,
        });
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error al actualizar" });
    }
  };

  const handleTestNotification = async () => {
    setTesting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/telegram/setup", {
        method: "PATCH",
      });

      const data = await res.json();

      if (data.success) {
        setMessage({
          type: "success",
          text: "Mensaje de prueba enviado. Revisa tu Telegram.",
        });
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error enviando prueba" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Notificaciones Telegram</h1>
        <p className="text-muted-foreground mt-2">
          Recibe alertas de tu bot directamente en tu Telegram
        </p>
      </div>

      {/* Estado del Bot */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Estado del Bot
            {bot?.configured ? (
              <Badge variant="default" className="bg-green-600">
                Activo
              </Badge>
            ) : (
              <Badge variant="destructive">No configurado</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Informacion del bot de Telegram del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bot?.configured ? (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
                🤖
              </div>
              <div>
                <p className="font-medium">@{bot.username}</p>
                <p className="text-sm text-muted-foreground">{bot.name}</p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800">
                El bot de Telegram no esta configurado en el servidor.
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Contacta al administrador para configurar TELEGRAM_BOT_TOKEN
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Como obtener Chat ID */}
      <Card>
        <CardHeader>
          <CardTitle>Como configurar</CardTitle>
          <CardDescription>
            Pasos para vincular tu cuenta de Telegram
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4 list-decimal list-inside">
            <li className="flex items-start gap-2">
              <span className="font-medium">Abre Telegram</span>
              <span className="text-muted-foreground">
                y busca @{bot?.username || "tu_bot"}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-medium">Inicia una conversacion</span>
              <span className="text-muted-foreground">
                pulsa &quot;Start&quot; o escribe /start
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-medium">Obten tu Chat ID</span>
              <span className="text-muted-foreground">
                puedes usar el bot @userinfobot o @RawDataBot para obtener tu ID
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-medium">Introduce tu Chat ID</span>
              <span className="text-muted-foreground">
                en el formulario de abajo
              </span>
            </li>
          </ol>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Consejo:</p>
            <p className="text-sm text-muted-foreground">
              Tu Chat ID es un numero como <code className="bg-background px-1 rounded">123456789</code>.
              Para grupos, el ID comienza con <code className="bg-background px-1 rounded">-100</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Formulario de configuracion */}
      <Card>
        <CardHeader>
          <CardTitle>Tu configuracion</CardTitle>
          <CardDescription>
            Introduce tu Chat ID de Telegram para recibir alertas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Input Chat ID */}
            <div className="space-y-2">
              <Label htmlFor="chatId">Chat ID de Telegram</Label>
              <div className="flex gap-2">
                <Input
                  id="chatId"
                  type="text"
                  placeholder="123456789"
                  value={chatIdInput}
                  onChange={(e) => setChatIdInput(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSaveChatId} disabled={saving || !chatIdInput}>
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </div>
              {config?.chatId && (
                <p className="text-sm text-green-600">
                  ✓ Chat ID configurado
                </p>
              )}
            </div>

            {/* Toggle notificaciones */}
            {config?.chatId && (
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Notificaciones</p>
                  <p className="text-sm text-muted-foreground">
                    {config.notificationsEnabled
                      ? "Recibiras alertas en Telegram"
                      : "Las alertas estan desactivadas"}
                  </p>
                </div>
                <Button
                  variant={config.notificationsEnabled ? "destructive" : "default"}
                  onClick={() =>
                    handleToggleNotifications(!config.notificationsEnabled)
                  }
                >
                  {config.notificationsEnabled ? "Desactivar" : "Activar"}
                </Button>
              </div>
            )}

            {/* Boton de prueba */}
            {config?.chatId && config.notificationsEnabled && (
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Probar notificacion</p>
                  <p className="text-sm text-muted-foreground">
                    Envia un mensaje de prueba a tu Telegram
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleTestNotification}
                  disabled={testing}
                >
                  {testing ? "Enviando..." : "Probar"}
                </Button>
              </div>
            )}

            {/* Mensaje de estado */}
            {message && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  message.type === "success"
                    ? "bg-green-50 border border-green-200 text-green-800"
                    : "bg-red-50 border border-red-200 text-red-800"
                }`}
              >
                {message.text}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tipos de alertas */}
      <Card>
        <CardHeader>
          <CardTitle>Alertas disponibles</CardTitle>
          <CardDescription>
            Estas son las notificaciones que recibiras
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <span className="text-xl">🔴</span>
              <div>
                <p className="font-medium">Bot Offline</p>
                <p className="text-sm text-muted-foreground">
                  Cuando tu bot deja de enviar heartbeats
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="font-medium">Error del Bot</p>
                <p className="text-sm text-muted-foreground">
                  Cuando el bot reporta un error de operacion
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <span className="text-xl">📉</span>
              <div>
                <p className="font-medium">Drawdown Alto</p>
                <p className="text-sm text-muted-foreground">
                  Cuando el drawdown supera el limite establecido
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <span className="text-xl">💳</span>
              <div>
                <p className="font-medium">Suscripcion por Vencer</p>
                <p className="text-sm text-muted-foreground">
                  Recordatorio antes de que venza tu suscripcion
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
