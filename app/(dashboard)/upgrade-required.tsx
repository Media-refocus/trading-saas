import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CreditCard, Sparkles } from "lucide-react";
import type { SubscriptionStatus } from "@prisma/client";

interface UpgradeRequiredProps {
  status: SubscriptionStatus;
}

/**
 * Component shown when user's subscription is paused or canceled.
 * Displays message and CTA to upgrade or reactivate.
 */
export function UpgradeRequired({ status }: UpgradeRequiredProps) {
  const isPaused = status === "PAUSED";

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-lg w-full border-2 border-dashed">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-muted rounded-full w-fit">
            {isPaused ? (
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            ) : (
              <AlertTriangle className="h-8 w-8 text-red-500" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isPaused ? "Prueba Expirada" : "Suscripción Cancelada"}
          </CardTitle>
          <CardDescription className="text-base">
            {isPaused
              ? "Tu período de prueba de 14 días ha finalizado. Activa tu suscripción para continuar usando todas las funciones."
              : "Tu suscripción ha sido cancelada. Reactiva tu plan para recuperar el acceso."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Al activar tu suscripción podrás:
            </p>
            <ul className="text-sm space-y-1">
              <li className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Continuar recibiendo señales de trading
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Acceder al dashboard y métricas
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Mantener tu configuración y datos
              </li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="flex-1">
              <Link href="/pricing">
                <CreditCard className="h-4 w-4 mr-2" />
                Ver Planes
              </Link>
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Tus datos están guardados y seguros. Activa tu suscripción cuando estés listo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
