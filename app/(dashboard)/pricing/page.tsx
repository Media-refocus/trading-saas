"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Zap, Crown, Rocket } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
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
    hasPriority: boolean;
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
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchPlans();
        alert(`Plan ${data.plan.name} activado correctamente`);
      } else {
        alert(data.error || "Error al cambiar de plan");
      }
    } catch (error) {
      console.error("Error upgrading:", error);
      alert("Error al cambiar de plan");
    } finally {
      setUpgrading(null);
    }
  }

  function getPlanIcon(name: string) {
    switch (name.toLowerCase()) {
      case "basic":
        return <Zap className="w-6 h-6" />;
      case "pro":
        return <Crown className="w-6 h-6" />;
      case "enterprise":
        return <Rocket className="w-6 h-6" />;
      default:
        return <Zap className="w-6 h-6" />;
    }
  }

  function getPlanColor(name: string) {
    switch (name.toLowerCase()) {
      case "basic":
        return "from-blue-500/10 to-blue-500/5 border-blue-500/20";
      case "pro":
        return "from-purple-500/10 to-purple-500/5 border-purple-500/20";
      case "enterprise":
        return "from-amber-500/10 to-amber-500/5 border-amber-500/20";
      default:
        return "from-gray-500/10 to-gray-500/5 border-gray-500/20";
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-2">Planes y Precios</h1>
          <p className="text-muted-foreground">Cargando planes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-2">Planes y Precios</h1>
        <p className="text-muted-foreground">
          Elige el plan que mejor se adapte a tus necesidades de trading
        </p>
        {currentPlan && (
          <Badge variant="outline" className="mt-4">
            Plan actual: {currentPlan.name}
          </Badge>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan?.id === plan.id;
          const isPro = plan.name.toLowerCase() === "pro";

          return (
            <Card
              key={plan.id}
              className={`relative bg-gradient-to-b ${getPlanColor(plan.name)} ${
                isPro ? "md:-mt-4 md:mb-4" : ""
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
                    ${plan.price}
                  </span>
                  <span className="text-muted-foreground">/mes</span>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
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
        <h2 className="text-lg font-semibold mb-4">Comparacion de Limites</h2>
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
                <td className="py-2">Posiciones Simultaneas</td>
                {plans.map((p) => {
                  const feature = p.features.find((f) =>
                    f.includes("posicion")
                  );
                  const value = feature?.match(/\d+/)?.[0] || "-";
                  return (
                    <td key={p.id} className="text-center py-2 font-medium">
                      {value}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b">
                <td className="py-2">Niveles de Promedio</td>
                {plans.map((p) => {
                  const feature = p.features.find((f) =>
                    f.includes("nivel")
                  );
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
                <td className="py-2">Grid Avanzado</td>
                {plans.map((p) => (
                  <td key={p.id} className="text-center py-2">
                    {p.features.some((f) => f.includes("Grid Avanzado")) ? (
                      <Check className="w-4 h-4 text-green-500 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-red-500 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2">Soporte Prioritario</td>
                {plans.map((p) => (
                  <td key={p.id} className="text-center py-2">
                    {p.features.some((f) => f.includes("Prioritario")) ? (
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
    </div>
  );
}
