"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ApiKeyStatus {
  hasApiKey: boolean;
  isActive: boolean;
  lastHeartbeat: string | null;
  plan: {
    name: string;
    maxLevels: number;
    maxPositions: number;
  } | null;
}

interface NewApiKey {
  apiKey: string;
  warning: string;
}

export default function SetupPage() {
  const [status, setStatus] = useState<ApiKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/bot/apikey");
      const data = await res.json();
      setStatus(data);
    } catch (error) {
      console.error("Error fetching status:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/bot/apikey", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setNewApiKey(data.apiKey);
        fetchStatus();
      }
    } catch (error) {
      console.error("Error generating API key:", error);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadScript = async (platform: "windows" | "linux") => {
    window.location.href = `/api/bot/install-script?platform=${platform}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Configuracion del Bot</h1>
        <p className="text-muted-foreground mt-2">
          Sigue los pasos para instalar y conectar tu bot de trading
        </p>
      </div>

      {/* Paso 1: API Key */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  1
                </span>
                API Key
              </CardTitle>
              <CardDescription>
                Necesitas una API key para conectar tu bot
              </CardDescription>
            </div>
            {status?.hasApiKey && (
              <Badge variant={status.isActive ? "default" : "secondary"}>
                {status.isActive ? "Activo" : "Inactivo"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!status?.hasApiKey && !newApiKey && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Aun no tienes una API key. Genera una para poder conectar tu bot.
              </p>
              <Button onClick={generateApiKey} disabled={generating}>
                {generating ? "Generando..." : "Generar API Key"}
              </Button>
            </div>
          )}

          {newApiKey && (
            <div className="space-y-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Importante: Copia tu API key ahora</span>
              </div>
              <p className="text-sm text-yellow-700">
                Esta es la unica vez que veras esta key. Guardala en un lugar seguro.
              </p>
              <div className="flex gap-2">
                <Input
                  value={newApiKey}
                  readOnly
                  className="font-mono text-sm bg-white"
                />
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(newApiKey)}
                >
                  {copied ? "Copiado!" : "Copiar"}
                </Button>
              </div>
            </div>
          )}

          {status?.hasApiKey && !newApiKey && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">Ya tienes una API key configurada</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Si necesitas una nueva key, puedes regenerarla. La anterior dejara de funcionar.
              </p>
              <Button variant="outline" onClick={generateApiKey} disabled={generating}>
                {generating ? "Generando..." : "Regenerar API Key"}
              </Button>
            </div>
          )}

          {status?.lastHeartbeat && (
            <div className="text-sm text-muted-foreground">
              Ultima conexion: {new Date(status.lastHeartbeat).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paso 2: Descargar Script */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              2
            </span>
            Descargar Instalador
          </CardTitle>
          <CardDescription>
            Descarga el script de instalacion para tu sistema operativo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="windows" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="windows">Windows</TabsTrigger>
              <TabsTrigger value="linux">Linux</TabsTrigger>
            </TabsList>
            <TabsContent value="windows" className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <p className="text-sm">
                  <strong>Requisitos:</strong> Windows 10/11 o Windows Server 2019+
                </p>
                <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                  <li>Descarga el script</li>
                  <li>Abre PowerShell como Administrador</li>
                  <li>Ejecuta: <code className="bg-background px-1 rounded">.\install-trading-bot.ps1 -ApiKey &quot;tu_api_key&quot;</code></li>
                </ol>
              </div>
              <Button onClick={() => downloadScript("windows")} className="w-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Descargar para Windows
              </Button>
            </TabsContent>
            <TabsContent value="linux" className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <p className="text-sm">
                  <strong>Requisitos:</strong> Ubuntu 20.04+ o similar con Python 3.10+
                </p>
                <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                  <li>Descarga el script</li>
                  <li>Dale permisos: <code className="bg-background px-1 rounded">chmod +x install-trading-bot.sh</code></li>
                  <li>Ejecuta: <code className="bg-background px-1 rounded">sudo ./install-trading-bot.sh tb_tu_api_key</code></li>
                </ol>
              </div>
              <Button onClick={() => downloadScript("linux")} className="w-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Descargar para Linux
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Paso 3: Configurar MT5 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              3
            </span>
            Configurar MT5
          </CardTitle>
          <CardDescription>
            Edita el archivo .env con tus credenciales de MetaTrader 5
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Despues de instalar el bot, edita el archivo <code className="bg-muted px-1 rounded">.env</code> en el directorio de instalacion:
            </p>
            <div className="bg-zinc-900 text-zinc-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <pre>{`MT5_LOGIN=12345678
MT5_PASSWORD=tu_password
MT5_SERVER=VTMarkets-Live
MT5_PATH=C:\\Program Files\\VTMarkets\\MetaTrader5\\terminal64.exe`}</pre>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>Nota:</strong> Asegurate de que MT5 este instalado y que puedas hacer login manualmente primero.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Paso 4: Iniciar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              4
            </span>
            Iniciar el Bot
          </CardTitle>
          <CardDescription>
            Inicia el servicio y verifica la conexion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="windows-start" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="windows-start">Windows</TabsTrigger>
              <TabsTrigger value="linux-start">Linux</TabsTrigger>
            </TabsList>
            <TabsContent value="windows-start" className="space-y-4">
              <div className="bg-zinc-900 text-zinc-100 p-4 rounded-lg font-mono text-sm">
                <p className="text-zinc-400 mb-2"># Opcion A: Script .bat</p>
                <p>iniciar-bot.bat</p>
                <p className="text-zinc-400 mt-4 mb-2"># Opcion B: PowerShell</p>
                <p>cd C:\TradingBot</p>
                <p>.\venv\Scripts\activate</p>
                <p>python trading_bot_saas.py</p>
              </div>
            </TabsContent>
            <TabsContent value="linux-start" className="space-y-4">
              <div className="bg-zinc-900 text-zinc-100 p-4 rounded-lg font-mono text-sm">
                <p className="text-zinc-400 mb-2"># Iniciar servicio</p>
                <p>sudo systemctl start trading-bot</p>
                <p className="text-zinc-400 mt-4 mb-2"># Ver estado</p>
                <p>sudo systemctl status trading-bot</p>
                <p className="text-zinc-400 mt-4 mb-2"># Ver logs</p>
                <p>journalctl -u trading-bot -f</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Estado de conexion */}
      {status?.hasApiKey && (
        <Card>
          <CardHeader>
            <CardTitle>Estado de Conexion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${status.isActive ? "bg-green-500" : "bg-red-500"}`}></div>
              <div>
                <p className="font-medium">
                  {status.isActive ? "Bot Conectado" : "Bot Desconectado"}
                </p>
                {status.lastHeartbeat && (
                  <p className="text-sm text-muted-foreground">
                    Ultima actividad: {new Date(status.lastHeartbeat).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
