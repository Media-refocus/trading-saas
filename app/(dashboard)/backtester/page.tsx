import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function BacktesterPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Backtester</h1>
        <p className="text-muted-foreground mt-2">
          Analiza 25,000+ señales históricas para optimizar tu estrategia
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Backtester</CardTitle>
          <CardDescription>
            Sube tu archivo CSV con datos históricos o usa los datos pre-cargados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-12 text-center">
            <p className="text-muted-foreground mb-4">
              Arrastra tu archivo CSV aquí o haz clic para seleccionar
            </p>
            <Button variant="outline">Seleccionar Archivo</Button>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Configuración del Backtest</h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Símbolo
                </label>
                <select className="w-full px-3 py-2 border rounded-md bg-background">
                  <option>XAUUSD</option>
                  <option>EURUSD</option>
                  <option>GBPUSD</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Estrategia
                </label>
                <select className="w-full px-3 py-2 border rounded-md">
                  <option>Toni (G4)</option>
                  <option>Xisco (G2)</option>
                  <option>Personalizada</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Lotaje Base
                </label>
                <Input
                  type="number"
                  step="0.01"
                  defaultValue="0.01"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Niveles de Promedio
                </label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  defaultValue="4"
                />
              </div>
            </div>

            <Button className="w-full">Ejecutar Backtest</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
