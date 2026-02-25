"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Zap, Crown, Rocket, Building2 } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  implementationFee: number | null;
  features: string[];
}

interface CurrentPlan {
  name: string;
  id: string | null;
  limits: {
    maxPositions: number;
    maxLevels: number;
    hasTrailingSL: boolean;
    hasAdvancedGrid: boolean;
    hasOptimizador: boolean;
    hasBacktestsIlimitados: boolean;
    hasMetricsDashboard: boolean;
    hasMultiCuenta: boolean;
    hasApiAccess: boolean;
    hasVpsDedicado: boolean;
    hasPriority: boolean;
    hasSoporte247: boolean;
  };
}

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    try {
      const res = await fetch("/api/plans");
      const data = await res.json();
      if (data.success) {
        setPlans(data.availablePlans);
        setCurrentPlan(data.currentPlan);
      }
    } catch (error) {
      console.error("Error fetching plans:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(planId: string) {
    setUpgrading(planId);
    try {
      // Crear sesión de checkout con Stripe
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();

      if (data.success && data.url) {
        // Redirigir a Stripe Checkout
        window.location.href = data.url;
      } else {
        alert(data.error || "Error al crear sesión de pago");
        setUpgrading(null);
      }
    } catch (error) {
      console.error("Error upgrading:", error);
      alert("Error al procesar el pago");
      setUpgrading(null);
    }
    // No quitamos upgrading aquí porque vamos a redirigir
  }

  function getPlanIcon(name: string) {
    switch (name.toLowerCase()) {
      case "starter":
        return <Zap className="w-6 h-6" />;
      case "trader":
        return <Crown className="w-6 h-6" />;
      case "pro":
        return <Rocket className="w-6 h-6" />;
      case "enterprise":
        return <Building2 className="w-6 h-6" />;
      default:
        return <Zap className="w-6 h-6" />;
    }
  }

  function getPlanColor(name: string) {
    switch (name.toLowerCase()) {
      case "starter":
        return "from-slate-500/10 to-slate-500/5 border-slate-500/20";
      case "trader":
        return "from-blue-500/10 to-blue-500/5 border-blue-500/20";
      case "pro":
        return "from-purple-500/10 to-purple-500/5 border-purple-500/20";
      case "enterprise":
        return "from-amber-500/10 to-amber-500/5 border-amber-500/20";
      default:
        return "from-gray-500/10 to-gray-500/5 border-gray-500/20";
    }
  }

  function formatCurrency(amount: number, currency: string) {
    return currency === "EUR" ? `${amount}€` : `$${amount}`;
  }

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-2">Planes y Precios</h1>
          <p className="text-muted-foreground">Cargando planes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-2">Planes y Precios</h1>
        <p className="text-muted-foreground">
          Elige el plan que mejor se adapte a tu capital y necesidades de trading
        </p>
        {currentPlan && (
          <Badge variant="outline" className="mt-4">
            Plan actual: {currentPlan.name}
          </Badge>
        )}
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan?.id === plan.id;
          const isPro = plan.name.toLowerCase() === "pro";
          const hasFee = plan.implementationFee !== null;

          return (
            <Card
              key={plan.id}
              className={`relative bg-gradient-to-b ${getPlanColor(plan.name)} ${
                isPro ? "md:-mt-2 md:mb-2 ring-2 ring-purple-500" : ""
              }`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-purple-500">Mas Popular</Badge>
                </div>
              )}

              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-2 p-3 rounded-full bg-primary/10 w-fit">
                  {getPlanIcon(plan.name)}
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">
                    {formatCurrency(plan.price, plan.currency)}
                  </span>
                  <span className="text-muted-foreground">/mes</span>
                </CardDescription>
                {hasFee && (
                  <p className="text-xs text-muted-foreground mt-1">
                    + {formatCurrency(plan.implementationFee!, plan.currency)} implementacion
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-2">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={isCurrentPlan ? "outline" : "default"}
                  disabled={isCurrentPlan || upgrading !== null}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {upgrading === plan.id
                    ? "Procesando..."
                    : isCurrentPlan
                    ? "Plan Actual"
                    : "Cambiar Plan"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="mt-12 p-6 bg-muted/50 rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Comparacion de Planes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Caracteristica</th>
                {plans.map((p) => (
                  <th key={p.id} className="text-center py-2">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2">Precio mensual</td>
                {plans.map((p) => (
                  <td key={p.id} className="text-center py-2 font-medium">
                    {formatCurrency(p.price, p.currency)}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2">Fee implementacion</td>
                {plans.map((p) => (
                  <td key={p.id} className="text-center py-2">
                    {p.implementationFee ? formatCurrency(p.implementationFee, p.currency) : "Incluido"}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2">Posiciones simultaneas</td>
                {plans.map((p) => {
                  const feature = p.features.find((f) => f.includes("posicion"));
                  const value = feature?.match(/\d+/)?.[0] || "-";
                  return (
                    <td key={p.id} className="text-center py-2 font-medium">
                      {value}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b">
                <td className="py-2">Niveles de promedio</td>
                {plans.map((p) => {
                  const feature = p.features.find((f) => f.includes("nivel"));
                  const value = feature?.match(/\d+/)?.[0] || "-";
                  return (
                    <td key={p.id} className="text-center py-2 font-medium">
                      {value}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b">
                <td className="py-2">Trailing Stop Loss</td>
                {plans.map((p) => (
                  <td key={p.id} className="text-center py-2">
                    {p.features.some((f) => f.includes("Trailing")) ? (
                      <Check className="w-4 h-4 text-green-500 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-red-500 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2">Optimizador automatico</td>
                {plans.map((p) => (
                  <td key={p.id} className="text-center py-2">
                    {p.features.some((f) => f.includes("Optimizador")) ? (
                      <Check className="w-4 h-4 text-green-500 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-red-500 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2">Backtests ilimitados</td>
                {plans.map((p) => (
                  <td key={p.id} className="text-center py-2">
                    {p.features.some((f) => f.includes("backtests ilimitados")) ? (
                      <Check className="w-4 h-4 text-green-500 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-red-500 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2">Dashboard metricas</td>
                {plans.map((p) => (
                  <td key={p.id} className="text-center py-2">
                    {p.features.some((f) => f.includes("Dashboard") || f.includes("metricas")) ? (
                      <Check className="w-4 h-4 text-green-500 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-red-500 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2">Multi-cuenta MT5</td>
                {plans.map((p) => (
                  <td key={p.id} className="text-center py-2">
                    {p.features.some((f) => f.includes("Multi-cuenta")) ? (
                      <Check className="w-4 h-4 text-green-500 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-red-500 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2">API Access</td>
                {plans.map((p) => (
                  <td key={p.id} className="text-center py-2">
                    {p.features.some((f) => f.includes("API")) ? (
                      <Check className="w-4 h-4 text-green-500 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-red-500 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2">VPS dedicado</td>
                {plans.map((p) => (
                  <td key={p.id} className="text-center py-2">
                    {p.features.some((f) => f.includes("VPS")) ? (
                      <Check className="w-4 h-4 text-green-500 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-red-500 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2">Soporte 24/7</td>
                {plans.map((p) => (
                  <td key={p.id} className="text-center py-2">
                    {p.features.some((f) => f.includes("24/7")) ? (
                      <Check className="w-4 h-4 text-green-500 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-red-500 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 p-6 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <h3 className="font-semibold mb-2">💡 Capital recomendado por plan</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li><strong>Starter (57€):</strong> Capital de 500€ a 5.000€</li>
          <li><strong>Trader (97€):</strong> Capital de 5.000€ a 25.000€</li>
          <li><strong>Pro (197€):</strong> Capital de 25.000€ a 100.000€</li>
          <li><strong>Enterprise (497€):</strong> Capital superior a 100.000€</li>
        </ul>
      </div>
    </div>
  );
}
