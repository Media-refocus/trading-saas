"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    title: "Modo Paper Trading",
    description: "Prueba el bot sin arriesgar dinero real. Las operaciones se simulan en memoria.",
    badge: "Nuevo",
    href: "/settings",
  },
  {
    title: "Alertas en Telegram",
    description: "Recibe notificaciones cuando tu bot se desconecta o hay errores.",
    badge: "Nuevo",
    href: "/telegram",
  },
  {
    title: "Backtester",
    description: "Prueba estrategias con datos historicos antes de operar en real.",
    badge: null,
    href: "/backtester",
  },
  {
    title: "Seguridad API Key",
    description: "API keys hasheadas, rate limiting, y rotacion automatica.",
    badge: "Seguro",
    href: "/settings",
  },
];

const faqs = [
  {
    question: "Como instalo el bot?",
    answer:
      "Ve a la pagina 'Instalar Bot' y descarga el script de instalacion. Ejecutalo en tu VPS con MT5 instalado.",
  },
  {
    question: "Que es el modo Paper Trading?",
    answer:
      "Es un modo de simulacion donde el bot no ejecuta ordenes reales. Te permite probar la configuracion sin riesgo.",
  },
  {
    question: "Como configuro las alertas de Telegram?",
    answer:
      "1. Crea un bot con @BotFather en Telegram. 2. Inicia chat con tu bot. 3. Ve a /telegram y pega tu Chat ID.",
  },
  {
    question: "Puedo usar el bot en MT4?",
    answer:
      "Actualmente solo soportamos MT5. El soporte para MT4 esta en desarrollo.",
  },
  {
    question: "Que pasa si mi suscripcion expira?",
    answer:
      "El bot dejara de funcionar despues de 3 dias de periodo de gracia. Renueva para continuar operando.",
  },
  {
    question: "Como roto mi API key?",
    answer:
      "Ve a Configuracion > Gestionar API Key > Rotar. Puedes rotar una vez cada 30 dias.",
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Ayuda</h1>
        <p className="text-muted-foreground mt-2">
          Documentacion y preguntas frecuentes del Trading Bot
        </p>
      </div>

      {/* Features */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Funcionalidades</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  {feature.badge && (
                    <Badge variant="secondary">{feature.badge}</Badge>
                  )}
                </div>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" asChild>
                  <Link href={feature.href}>Configurar</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Preguntas Frecuentes</h2>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <Card key={faq.question}>
              <CardHeader>
                <CardTitle className="text-base">{faq.question}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{faq.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Necesitas mas ayuda?</CardTitle>
          <CardDescription>
            Contacta a soporte si tienes problemas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button variant="outline" asChild>
              <a href="mailto:soporte@tu-dominio.com">Email</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="https://t.me/tu_soporte" target="_blank" rel="noopener">
                Telegram
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
