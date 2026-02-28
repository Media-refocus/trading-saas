"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";

// Plan data - NUEVO PRICING 2026 (merged with Stripe integration features)
const plans = [
  {
    id: "basic",
    name: "Trader",
    price: 57,
    description: "Bot completo + proteccion basica",
    popular: true,
    features: [
      { name: "1 cuenta MT5", included: true },
      { name: "Bot senales XAUUSD", included: true },
      { name: "Dashboard completo", included: true },
      { name: "Backtester", included: true },
      { name: "Heartbeat monitoring", included: true },
      { name: "Telegram notificaciones", included: true },
      { name: "Daily Loss Limit", included: true },
      { name: "Kill Switch emergencia", included: true },
      { name: "Soporte email", included: true },
      { name: "Circuit Breaker", included: false },
      { name: "News Filter", included: false },
      { name: "Multi-cuenta", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 147,
    description: "Multi-cuenta + proteccion profesional completa",
    popular: false,
    features: [
      { name: "3 cuentas MT5", included: true },
      { name: "Todo lo de Trader", included: true },
      { name: "Circuit Breaker", included: true },
      { name: "Account Guardian", included: true },
      { name: "News Filter", included: true },
      { name: "TradingView Bridge", included: true },
      { name: "Analytics Pro", included: true },
      { name: "Equity Curve", included: true },
      { name: "Heatmap horario", included: true },
      { name: "Smart Entry Filter", included: true },
      { name: "Smart Trailing", included: true },
      { name: "Webhooks personalizados", included: true },
    ],
  },
  {
    id: "enterprise",
    name: "VIP",
    price: 347,
    description: "Cuentas ilimitadas + acceso exclusivo",
    popular: false,
    features: [
      { name: "Cuentas MT5 ilimitadas", included: true },
      { name: "Todo lo de Pro", included: true },
      { name: "Backtesting Engine avanzado", included: true },
      { name: "Monte Carlo Simulation", included: true },
      { name: "Multi-Timeframe Confirmation", included: true },
      { name: "Copy Trading Network", included: true },
      { name: "API Publica REST + WebSocket", included: true },
      { name: "Multi-Simbolo", included: true },
      { name: "Paper Trading", included: true },
      { name: "Canal VIP con Xisco", included: true },
      { name: "Soporte prioritario (4h)", included: true },
      { name: "Calls mensuales + Onboarding", included: true },
    ],
  },
];

export default function PricingPage() {
  const { data: session } = useSession();
  const isAuthenticated = !!session;

  return (
    <div className="py-16 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Elige tu plan
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Comienza con 14 dias de prueba gratis con todas las funciones Pro.
            Sin tarjeta de credito requerida.
          </p>
        </div>

        {/* Trial Banner */}
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-4 mb-12 text-center">
          <p className="text-blue-300">
            <span className="font-semibold">Prueba Gratis:</span> 14 dias con
            todas las funciones Pro. Sin compromiso.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative border-2 bg-slate-800/50 backdrop-blur ${
                plan.popular
                  ? "border-blue-500 scale-105 shadow-lg shadow-blue-500/20"
                  : "border-slate-700"
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white">
                  Mas Popular
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl text-white">{plan.name}</CardTitle>
                <CardDescription className="text-slate-400">
                  {plan.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">
                    {plan.price}
                  </span>
                  <span className="text-slate-400">/mes</span>
                </div>
                <ul className="space-y-0 text-left">
                  {plan.features.map((feature, index) => (
                    <li
                      key={index}
                      className={`flex items-center gap-2.5 py-2 ${
                        feature.included ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {feature.included ? (
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-slate-600 flex-shrink-0" />
                      )}
                      <span className="text-[13px]">{feature.name}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {isAuthenticated ? (
                  <Link href="/dashboard" className="w-full">
                    <Button
                      className={`w-full ${
                        plan.popular
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : "bg-slate-700 hover:bg-slate-600 text-white"
                      }`}
                    >
                      Suscribirse
                    </Button>
                  </Link>
                ) : (
                  <Link href="/register" className="w-full">
                    <Button
                      className={`w-full ${
                        plan.popular
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : "bg-slate-700 hover:bg-slate-600 text-white"
                      }`}
                    >
                      {plan.popular ? "Comenzar Prueba Gratis" : "Empezar"}
                    </Button>
                  </Link>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* ROI Section */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-white mb-6">
            Valor Real del Plan Trader
          </h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <div className="text-3xl font-bold text-green-400 mb-2">
                700-1,750 EUR
              </div>
              <p className="text-slate-400 text-[13px]">
                Ahorrados al mes con Daily Loss Limit activo
              </p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <div className="text-3xl font-bold text-green-400 mb-2">
                Infinite
              </div>
              <p className="text-slate-400 text-[13px]">
                Proteccion de cuenta con Kill Switch de emergencia
              </p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <div className="text-3xl font-bold text-green-400 mb-2">
                57 EUR/mes
              </div>
              <p className="text-slate-400 text-[13px]">
                Menos de 2 EUR/dia para proteccion profesional
              </p>
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Preguntas Frecuentes
          </h2>
          <div className="space-y-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-2">
                Puedo cambiar de plan?
              </h3>
              <p className="text-slate-400 text-sm">
                Si, puedes hacer upgrade o downgrade en cualquier momento.
              </p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-2">
                El trial requiere tarjeta?
              </h3>
              <p className="text-slate-400 text-sm">
                No, el trial de 14 dias es completamente gratis sin tarjeta de
                credito.
              </p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-2">
                Que pasa si el pago falla?
              </h3>
              <p className="text-slate-400 text-sm">
                Tienes 8 dias de gracia con 3 intentos de cobro. Despues, el
                acceso se pausa temporalmente.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg">
                Ir al Dashboard
              </Button>
            </Link>
          ) : (
            <Link href="/register">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg">
                Comenzar Prueba Gratis de 14 Dias
              </Button>
            </Link>
          )}
          <p className="text-slate-500 text-sm mt-4">
            Sin tarjeta de credito. Cancela cuando quieras.
          </p>
        </div>
      </div>
    </div>
  );
}
