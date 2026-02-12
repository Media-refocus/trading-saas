import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Bienvenido a tu panel de control de trading
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Señales Procesadas</CardTitle>
            <CardDescription>Últimos 30 días</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
            <p className="text-sm text-muted-foreground mt-2">
              Sin datos aún
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Posiciones Abiertas</CardTitle>
            <CardDescription>En tiempo real</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
            <p className="text-sm text-muted-foreground mt-2">
              Sin posiciones activas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profit del Mes</CardTitle>
            <CardDescription>Este mes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">+$0</div>
            <p className="text-sm text-muted-foreground mt-2">
              Sin datos aún
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuración Inicial</CardTitle>
          <CardDescription>
            Comienza configurando tu cuenta de trading
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 border rounded-lg">
            <div className="flex-1">
              <h3 className="font-semibold">Conectar Cuenta MT5</h3>
              <p className="text-sm text-muted-foreground">
                Conecta tu cuenta de MetaTrader 5 para empezar a operar
              </p>
            </div>
            <Button>Conectar</Button>
          </div>

          <div className="flex items-center gap-4 p-4 border rounded-lg">
            <div className="flex-1">
              <h3 className="font-semibold">Ejecutar Backtest</h3>
              <p className="text-sm text-muted-foreground">
                Analiza las señales históricas con tus parámetros
              </p>
            </div>
            <Button variant="outline">Ir a Backtester</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
