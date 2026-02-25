"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Copy,
  Check,
  Download,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Terminal,
  Settings,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface ApiKeyInfo {
  apiKey: string;
  status: string;
  createdAt: string;
  lastUsed: string | null;
}

export default function MT4SetupPage() {
  const [apiKeyInfo, setApiKeyInfo] = useState<ApiKeyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const fetchApiKey = useCallback(async () => {
    try {
      const res = await fetch("/api/mt4-setup/api-key");
      const data = await res.json();
      if (data.success) {
        setApiKeyInfo(data);
      } else if (data.error === "No API key") {
        // Crear API key automáticamente
        await generateApiKey();
      }
    } catch (error) {
      console.error("Error fetching API key:", error);
    } finally {
      setLoading(false);
    }
  }

  async function generateApiKey() {
    setRegenerating(true);
    try {
      const res = await fetch("/api/mt4-setup/api-key", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setApiKeyInfo(data);
      }
    } catch (error) {
      console.error("Error generating API key:", error);
    } finally {
      setRegenerating(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const steps = [
    {
      number: 1,
      title: "Descargar el EA",
      description: "Descarga el archivo BotOperativaReceiver.ex4",
      action: (
        <Button variant="outline" className="w-full" disabled>
          <Download className="w-4 h-4 mr-2" />
          Próximamente
        </Button>
      ),
    },
    {
      number: 2,
      title: "Copiar a MT4",
      description: "Copia el archivo a MQL4/Experts/ en tu MT4",
      action: null,
    },
    {
      number: 3,
      title: "Configurar URLs",
      description: "Herramientas → Opciones → Expertos → Permitir WebRequest",
      action: null,
    },
    {
      number: 4,
      title: "Copiar tu API Key",
      description: "Introduce esta API Key en el EA",
      action: null,
    },
    {
      number: 5,
      title: "Activar el EA",
      description: "Arrastra el EA al gráfico y configura los parámetros",
      action: null,
    },
  ];

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Configurar MetaTrader 4</h1>
        <p className="text-muted-foreground">
          Sigue estos pasos para conectar tu MT4 con el Bot Operativa
        </p>
      </div>

      {/* API Key Section */}
      <Card className="mb-8 border-primary/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Tu API Key
          </CardTitle>
          <CardDescription>
            Esta clave es necesaria para que el EA se conecte a tu cuenta
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apiKeyInfo ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={apiKeyInfo.apiKey}
                    readOnly
                    className="pr-20 font-mono"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(apiKeyInfo.apiKey)}
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                      apiKeyInfo.status === "ACTIVE"
                        ? "bg-green-500/10 text-green-500"
                        : "bg-yellow-500/10 text-yellow-500"
                    }`}
                  >
                    {apiKeyInfo.status === "ACTIVE" ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <AlertCircle className="w-3 h-3" />
                    )}
                    {apiKeyInfo.status}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateApiKey}
                  disabled={regenerating}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${regenerating ? "animate-spin" : ""}`} />
                  Regenerar
                </Button>
              </div>

              <Alert>
                <AlertDescription className="text-sm">
                  <strong>Importante:</strong> Nunca compartas tu API Key. Si la has compartido,
                  regénala inmediatamente.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <Button onClick={generateApiKey} disabled={regenerating}>
              <RefreshCw className={`w-4 h-4 mr-2 ${regenerating ? "animate-spin" : ""}`} />
              Generar API Key
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Installation Steps */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Pasos de Instalación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {steps.map((step) => (
              <div key={step.number} className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    {step.number}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium mb-1">{step.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{step.description}</p>
                  {step.action}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* URL Configuration */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Configurar URLs Permitidas en MT4</CardTitle>
          <CardDescription>
            MT4 bloquea conexiones externas por defecto. Debes añadir esta URL:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <code className="flex-1 text-sm">https://bot.refuelparts.com</code>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard("https://bot.refuelparts.com")}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <ol className="mt-4 text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Abre MetaTrader 4</li>
            <li>Ve a <strong>Herramientas → Opciones</strong></li>
            <li>Pestaña <strong>Expertos asesores</strong></li>
            <li>Marca <strong>&quot;Permitir WebRequest para las siguientes URL&quot;</strong></li>
            <li>Añade la URL de arriba y haz clic en OK</li>
          </ol>
        </CardContent>
      </Card>

      {/* Parameters Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Parámetros del EA</CardTitle>
          <CardDescription>
            Configura estos parámetros al añadir el EA al gráfico
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Parámetro</th>
                  <th className="text-left py-2">Valor</th>
                  <th className="text-left py-2">Descripción</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 font-mono">ApiKey</td>
                  <td className="py-2 font-mono text-primary">{apiKeyInfo?.apiKey?.substring(0, 8)}...</td>
                  <td className="py-2">Tu API Key personal</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-mono">SaasUrl</td>
                  <td className="py-2 font-mono">https://bot.refuelparts.com</td>
                  <td className="py-2">URL del servidor</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-mono">PollInterval</td>
                  <td className="py-2">3</td>
                  <td className="py-2">Segundos entre consultas</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-mono">DefaultLotSize</td>
                  <td className="py-2">0.01</td>
                  <td className="py-2">Lotaje por defecto</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-mono">MagicNumber</td>
                  <td className="py-2">123456</td>
                  <td className="py-2">No modificar</td>
                </tr>
                <tr>
                  <td className="py-2 font-mono">EnableTrailing</td>
                  <td className="py-2">false/true</td>
                  <td className="py-2">Según tu plan</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Help */}
      <div className="mt-8 p-6 bg-muted/50 rounded-lg">
        <h3 className="font-semibold mb-2">¿Necesitas ayuda?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Si tienes problemas con la configuración, contacta con soporte:
        </p>
        <div className="flex gap-4">
          <Button variant="outline" asChild>
            <a href="https://t.me/refuelparts" target="_blank" rel="noopener noreferrer">
              Telegram
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="mailto:soporte@refuelparts.com">
              Email
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
